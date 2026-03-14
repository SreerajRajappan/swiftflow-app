import { OpenAI } from "openai";
import { Resend } from "resend";
import db from "./db.server";
import { estimateDeliveryTime } from "./services/proximity.server";

const openai = new OpenAI();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function runCartRecoveryAgent(shop?: string) {
  console.log("🤖 [AI Agent] Waking up to write and dispatch emails...");

  try {
    const whereClause: any = {
      // 👇 Trust the state machine! If it's ANALYZING, it's ready for an email.
      agentStatus: "ANALYZING",
    };

    // Only filter by shop if we are running a manual scan
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
      // --- Find the associated Revenue Leak to keep the UI in sync ---
      const leaks = await db.revenueLeak.findMany({
        where: { shop: cart.shop },
      });
      const currentLeak = leaks
        .reverse()
        .find((l) => (l.metadata as any)?.cartToken === cart.cartToken);

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

      // 6. Determine A/B variant
      const abMessage =
        cart.abTestVariant === "A"
          ? settings.abTestMessageA
          : settings.abTestMessageB;

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
        
        CRITICAL CONTEXT:
        - ${distanceContext}
        - ${etaContext}

        Write a warm, 3-sentence email to encourage them to complete their $${cart.cartValue} order.
        Make sure to emphasize how close they are to the store to highlight fast local delivery.
        If an estimated delivery time is provided above, explicitly mention it (e.g., "We can have this to your door in [ETA]").
        Include this specific offer seamlessly: "${abMessage}"
        
        No subject line. Just the email body.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const generatedEmailBody = response.choices[0]?.message?.content?.trim();

      if (generatedEmailBody) {
        const storeName = cart.shop
          .split(".")[0]
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        const cartUrl = `https://${cart.shop}/cart`;

        const finalEmailHtml = `
          <p>${generatedEmailBody.replace(/\n/g, "<br/>")}</p>
          <br/>
          <p>Resume your order here: <a href="${cartUrl}">${cartUrl}</a></p>
        `;

        const finalEmailText = `${generatedEmailBody}\n\nResume your order here: ${cartUrl}`;

        // 8. DISPATCH: Send the actual email via Resend
        try {
          await resend.emails.send({
            from: `${storeName} <hello@logiclooms.io>`,
            to: cart.customerEmail,
            subject:
              settings.recoveryEmailSubject ||
              "We're headed your way! Finish your order?",
            html: finalEmailHtml,
            text: finalEmailText,
          });

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

          console.log(
            `✅ [AI Agent] Successfully sent recovery email to ${cart.customerEmail}`,
          );
        } catch (sendError) {
          console.error(
            `❌ [AI Agent] Resend failed for ${cart.customerEmail}:`,
            sendError,
          );
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
