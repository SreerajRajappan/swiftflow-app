import { OpenAI } from "openai";
import db from "./db.server";
import shopify from "./shopify.server";
import { estimateDeliveryTime } from "./services/proximity.server";
import { sendRecoveryEmail } from "./services/email.server";
import { BASIC_PLANS, PRO_PLANS, ELITE_PLANS } from "./constants";

const openai = new OpenAI();

// 👇 AI SAFETY: Sanitize user & merchant inputs against prompt injection
function sanitizeForPrompt(input: string, maxLength = 300): string {
  if (!input) return "";
  return input
    .replace(/[<>{}[\]\\]/g, "") // Strip code-injection chars
    .replace(/ignore previous|system prompt|jailbreak/gi, "") // Stop basic LLM jailbreaks
    .trim()
    .slice(0, maxLength);
}

// 👇 AI SAFETY: Safe fallback if the LLM hallucinates red flags
function generateFallbackEmail(shopName: string, productNames: string) {
  return `You left some great items in your cart! The good news is you are well within our local delivery zone for ${shopName}. Complete your order today and we'll bring your ${productNames} right to your door.`;
}

async function getShopPlanLevel(shop: string) {
  try {
    const { admin } = await shopify.unauthenticated.admin(shop);
    const response = await admin.graphql(`
      query { currentAppInstallation { activeSubscriptions { name status } } }
    `);
    const { data } = await response.json();
    const subs = data?.currentAppInstallation?.activeSubscriptions || [];
    const activeSub = subs.find((sub: any) => sub.status === "ACTIVE");
    const activePlanName = activeSub?.name || "";

    return {
      isBasic: BASIC_PLANS.includes(activePlanName),
      isPro: PRO_PLANS.includes(activePlanName),
      isElite: ELITE_PLANS.includes(activePlanName),
    };
  } catch (err) {
    console.error(`[Billing Check] Failed for ${shop}`, err);
    return { isBasic: true, isPro: false, isElite: false };
  }
}

export async function runCartRecoveryAgent(shop?: string) {
  console.log("🤖 [AI Agent] Waking up to write and dispatch emails...");

  try {
    const whereClause: any = { agentStatus: "ANALYZING" };
    if (shop) whereClause.shop = shop;

    const pendingCarts = await db.cartRecovery.findMany({
      where: whereClause,
      take: 10,
    });

    if (pendingCarts.length === 0) return;

    for (const cart of pendingCarts) {
      // -- Billing Limits Check --
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const currentMonthRevenue = await db.conversionEvent.aggregate({
        where: { shop: cart.shop, createdAt: { gte: startOfMonth } },
        _sum: { orderValue: true },
      });

      const totalMonthlyRevenue = currentMonthRevenue._sum.orderValue || 0;
      const planLevel = await getShopPlanLevel(cart.shop);

      if (planLevel.isBasic && totalMonthlyRevenue >= 1000) {
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "LIMIT_REACHED" },
        });
        continue;
      }

      if (planLevel.isPro && totalMonthlyRevenue >= 5000) {
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "LIMIT_REACHED" },
        });
        continue;
      }

      // -- Atomic Lock --
      const lock = await db.cartRecovery.updateMany({
        where: { id: cart.id, agentStatus: "ANALYZING" },
        data: { agentStatus: "PROCESSING" },
      });

      if (lock.count === 0) continue;

      const leaks = await db.revenueLeak.findMany({
        where: { shop: cart.shop },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const currentLeak = leaks.find(
        (l) => (l.metadata as any)?.cartToken === cart.cartToken,
      );

      if (currentLeak) {
        await db.revenueLeak.update({
          where: { id: currentLeak.id },
          data: { status: "AGENT_WORKING" },
        });
      }

      try {
        if (!cart.customerEmail) {
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "SKIPPED" },
          });
          continue;
        }

        const settings = await db.appSettings.findUnique({
          where: { shop: cart.shop },
        });

        if (!settings) continue;

        // 👇 Sanitize Inputs
        const items = cart.lineItems as any[];
        const rawProductNames =
          items?.map((item) => item.title).join(", ") || "your selected items";
        const safeProductNames = sanitizeForPrompt(rawProductNames, 150);
        const safeMerchantMessage = sanitizeForPrompt(
          settings.recoveryEmailBody || "",
          300,
        );

        let abContext = "";
        let safeAbMessage = "";
        if (settings.abTestEnabled) {
          safeAbMessage = sanitizeForPrompt(
            cart.abTestVariant === "A"
              ? settings.abTestMessageA
              : settings.abTestMessageB,
            200,
          );
          abContext = `- Required promotional phrase to include: "${safeAbMessage}"`;
        }

        const distanceMiles = (currentLeak?.metadata as any)?.distanceMiles;
        let distanceContext = "They live in our local delivery zone.";
        let etaContext = "";

        if (distanceMiles) {
          distanceContext = `They are exactly ${distanceMiles.toFixed(1)} miles away from our store.`;
          etaContext = `Estimated delivery time for their address is ${estimateDeliveryTime(distanceMiles)}.`;
        }

        // 👇 Split into strict System Rules and User Context
        const SYSTEM_PROMPT = `You are an expert e-commerce copywriter for a LOCAL delivery business.
        STRICT RULES:
        1. Write exactly 2 short paragraphs. No more, no less.
        2. NEVER invent specific delivery times, prices, discount codes, or product details.
        3. NEVER use the words "urgent", "last chance", or high-pressure sales language.
        4. Tone: warm, helpful, neighborhood-friendly.
        5. NO subject line. Just the email body.
        6. Max 100 words total.`;

        const USER_PROMPT = `
        Write a cart recovery email for this abandoned checkout:
        - Store Name: ${cart.shop}
        - Abandoned Products: ${safeProductNames}
        - Logistics Context: ${distanceContext} ${etaContext}
        - Merchant's Core Message: "${safeMerchantMessage}"
        ${abContext}
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: USER_PROMPT },
          ],
          max_tokens: 250, // Hard ceiling
          temperature: 0.6, // Lowered for less hallucination
        });

        let generatedEmailBody =
          response.choices[0]?.message?.content?.trim() || "";

        // 👇 AI Output Validation (Red Flag Detection)
        const redFlags = [
          "$",
          "free shipping",
          "discount code",
          "promo",
          "% off",
        ];
        const merchantMessageLower = safeMerchantMessage.toLowerCase();
        const abMessageLower = safeAbMessage.toLowerCase();

        // Check if the AI invented a discount that the merchant didn't explicitly authorize
        const hasHallucinatedDiscount = redFlags.some(
          (flag) =>
            generatedEmailBody.toLowerCase().includes(flag) &&
            !merchantMessageLower.includes(flag) &&
            !abMessageLower.includes(flag),
        );

        if (
          hasHallucinatedDiscount ||
          generatedEmailBody.length < 20 ||
          generatedEmailBody.length > 1200
        ) {
          console.warn(
            `🚨 [AI Agent] Hallucination detected for cart ${cart.cartToken}. Using safe fallback template.`,
          );
          generatedEmailBody = generateFallbackEmail(
            cart.shop,
            safeProductNames,
          );
        }

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
        const merchantReplyTo = `info@${cart.shop.replace(".myshopify.com", ".com")}`;

        const sendSuccess = await sendRecoveryEmail(
          cart.shop,
          cart.customerEmail,
          subjectLine,
          finalEmailHtml,
          finalEmailText,
          merchantReplyTo,
        );

        if (sendSuccess) {
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
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "FAILED" },
          });
          if (currentLeak) {
            await db.revenueLeak.update({
              where: { id: currentLeak.id },
              data: { status: "FAILED" },
            });
          }
        }
      } catch (agentError) {
        console.error(
          `🚨 [AI Agent] Error generating/sending for cart ${cart.cartToken}:`,
          agentError,
        );
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "FAILED" },
        });
        if (currentLeak) {
          await db.revenueLeak.update({
            where: { id: currentLeak.id },
            data: { status: "FAILED" },
          });
        }
      }
    }
  } catch (error) {
    console.error("🚨 [AI Agent] Critical Failure:", error);
  }
}
