import { OpenAI } from "openai";
import db from "./db.server";
import shopify from "./shopify.server";
import { estimateDeliveryTime } from "./services/proximity.server";
import { sendRecoveryEmail } from "./services/email.server";
import { MONTHLY_PLAN_PRO } from "./constants";

const openai = new OpenAI(); // Automatically uses process.env.OPENAI_API_KEY

/**
 * Validates if a shop is currently subscribed to the Pro Plan via Shopify Billing API.
 */
async function isShopPro(shop: string): Promise<boolean> {
  try {
    const { admin } = await shopify.unauthenticated.admin(shop);
    const response = await admin.graphql(`
      query {
        currentAppInstallation {
          activeSubscriptions {
            name
            status
          }
        }
      }
    `);
    const { data } = await response.json();
    const subs = data?.currentAppInstallation?.activeSubscriptions || [];
    return subs.some(
      (sub: any) => sub.name === MONTHLY_PLAN_PRO && sub.status === "ACTIVE",
    );
  } catch (err) {
    console.error(`[Billing Check] Failed to check plan for ${shop}`, err);
    return false; // Default to basic if API fails
  }
}

export async function runCartRecoveryAgent(shop?: string) {
  console.log("🤖 [AI Agent] Waking up to write and dispatch emails...");

  try {
    const whereClause: any = {
      agentStatus: "ANALYZING", // Ready for an email
    };

    if (shop) whereClause.shop = shop;

    // 1. Find all carts that are waiting for the Agent
    const pendingCarts = await db.cartRecovery.findMany({
      where: whereClause,
      take: 10,
    });

    if (pendingCarts.length === 0) {
      console.log("🤖 [AI Agent] No pending carts found. Going back to sleep.");
      return;
    }

    console.log(`🤖 [AI Agent] Found ${pendingCarts.length} carts to process.`);

    for (const cart of pendingCarts) {
      // 🚨 BILLING ENFORCEMENT CHECK 🚨
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const currentMonthRevenue = await db.conversionEvent.aggregate({
        where: { shop: cart.shop, createdAt: { gte: startOfMonth } },
        _sum: { orderValue: true },
      });

      const totalMonthlyRevenue = currentMonthRevenue._sum.orderValue || 0;

      if (totalMonthlyRevenue >= 1000) {
        const isPro = await isShopPro(cart.shop);
        if (!isPro) {
          console.log(
            `[Billing] ${cart.shop} exceeded $1,000 basic limit (Current: $${totalMonthlyRevenue}). Skipping cart ${cart.cartToken}.`,
          );
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "LIMIT_REACHED" }, // Custom status so you know why it stopped
          });
          continue;
        }
      }

      // --- FIX: Prevent Memory Leak by taking only the 50 most recent leaks ---
      const leaks = await db.revenueLeak.findMany({
        where: { shop: cart.shop },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const currentLeak = leaks.find(
        (l) => (l.metadata as any)?.cartToken === cart.cartToken,
      );

      // 2. Lock the cart immediately
      await db.cartRecovery.update({
        where: { id: cart.id },
        data: { agentStatus: "PROCESSING" },
      });

      if (currentLeak) {
        await db.revenueLeak.update({
          where: { id: currentLeak.id },
          data: { status: "AGENT_WORKING" },
        });
      }

      // 3. Validate we have an email address to send to
      if (!cart.customerEmail) {
        console.log(
          `⚠️ [AI Agent] Skipping cart ${cart.cartToken} - No email found.`,
        );
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "SKIPPED" },
        });
        continue;
      }

      // 4. Get the shop's global settings
      const settings = await db.appSettings.findUnique({
        where: { shop: cart.shop },
      });

      if (!settings) continue;

      // 5. Extract product names
      const items = cart.lineItems as any[];
      const productNames =
        items?.map((item) => item.title).join(", ") || "your selected items";

      // --- FIX: A/B Test Bug. Only inject if A/B testing is actually ON ---
      let abContext = "";
      if (settings.abTestEnabled) {
        const abMessage =
          cart.abTestVariant === "A"
            ? settings.abTestMessageA
            : settings.abTestMessageB;
        abContext = `5. Include this specific A/B test offer seamlessly into the text: "${abMessage}"`;
      } else {
        abContext = "5. Do not invent any discounts or special offers.";
      }

      // Extract Distance and Calculate ETA
      const distanceMiles = (currentLeak?.metadata as any)?.distanceMiles;
      let distanceContext = "They live in our local delivery zone.";
      let etaContext = "";

      if (distanceMiles) {
        distanceContext = `They are exactly ${distanceMiles.toFixed(1)} miles away from our store.`;
        etaContext = `Estimated delivery time for their address is ${estimateDeliveryTime(distanceMiles)}.`;
      }

      // 7. Generate the Hyper-Local AI Content
      const prompt = `
        You are an expert e-commerce copywriter for a local store named ${cart.shop}. 
        A customer just abandoned their cart containing: ${productNames}.
        
        MERCHANT'S CORE MESSAGE / STYLE GUIDE:
        "${settings.recoveryEmailBody}"

        CRITICAL CONTEXT:
        - ${distanceContext}
        - ${etaContext}

        Write a warm, highly-converting email to encourage them to complete their $${cart.cartValue} order.
        
        RULES:
        1. Base your writing style and main message strictly on the "Core Message" provided by the merchant above.
        2. Seamlessly mention the specific items they left behind.
        3. Emphasize how close they are to the store to highlight fast local delivery.
        4. If an estimated delivery time is provided above, explicitly mention it (e.g., "We can have this to your door in [ETA]").
        ${abContext}
        6. Keep it concise (under 3 paragraphs).
        7. No subject line. Just the email body.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const generatedEmailBody = response.choices[0]?.message?.content?.trim();

      if (generatedEmailBody) {
        const cartUrl = `https://${cart.shop}/cart`;
        const subjectLine =
          settings.recoveryEmailSubject ||
          "We're headed your way! Finish your order?";

        const finalEmailHtml = `
          <p>${generatedEmailBody.replace(/\n/g, "<br/>")}</p>
          <br/>
          <p>Resume your order here: <a href="${cartUrl}">${cartUrl}</a></p>
        `;

        const finalEmailText = `${generatedEmailBody}\n\nResume your order here: ${cartUrl}`;

        // 8. DISPATCH: Send the actual email via the utility we built earlier
        const sendSuccess = await sendRecoveryEmail(
          cart.shop,
          cart.customerEmail,
          subjectLine,
          finalEmailHtml,
          finalEmailText,
        );

        if (sendSuccess) {
          // 9. UPDATE: Mark as sent and record the AI's work
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: {
              agentStatus: "COMPLETED",
              generatedEmail: finalEmailText,
              emailSent: true,
              emailSentAt: new Date(),
            },
          });

          if (currentLeak) {
            await db.revenueLeak.update({
              where: { id: currentLeak.id },
              data: { status: "COMPLETED" },
            });
          }
        } else {
          // Send failed
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "FAILED" },
          });
        }
      } else {
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "FAILED" },
        });
      }
    }
  } catch (error) {
    console.error("🚨 [AI Agent] Critical Failure:", error);
  }
}
