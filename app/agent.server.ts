import { OpenAI } from "openai";
import db from "./db.server";
import shopify from "./shopify.server";
import { estimateDeliveryTime } from "./services/proximity.server";
import { sendRecoveryEmail } from "./services/email.server";
import { BASIC_PLANS, PRO_PLANS, ELITE_PLANS } from "./constants";

const openai = new OpenAI();

function sanitizeForPrompt(input: string, maxLength = 300): string {
  if (!input) return "";
  return input
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/ignore previous|system prompt|jailbreak/gi, "")
    .trim()
    .slice(0, maxLength);
}

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

    await Promise.allSettled(
      pendingCarts.map(async (cart) => {
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
          return;
        }

        if (planLevel.isPro && totalMonthlyRevenue >= 5000) {
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "LIMIT_REACHED" },
          });
          return;
        }

        const lock = await db.cartRecovery.updateMany({
          where: { id: cart.id, agentStatus: "ANALYZING" },
          data: { agentStatus: "PROCESSING" },
        });

        if (lock.count === 0) return;

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
            return;
          }

          const settings = await db.appSettings.findUnique({
            where: { shop: cart.shop },
          });

          if (!settings) return;

          const safeSettings = settings as any;
          const items = cart.lineItems as any[];
          const rawProductNames =
            items?.map((item) => item.title).join(", ") ||
            "your selected items";
          const safeProductNames = sanitizeForPrompt(rawProductNames, 150);
          const safeMerchantMessage = sanitizeForPrompt(
            settings.recoveryEmailBody || "",
            300,
          );

          let variant = cart.abTestVariant || "A";
          if (settings.abTestEnabled && !cart.abTestVariant) {
            variant = Math.random() > 0.5 ? "A" : "B";
          } else if (safeSettings.abTestWinner) {
            variant = safeSettings.abTestWinner;
          }

          let abContext = "";
          let safeAbMessage = "";
          if (settings.abTestEnabled || safeSettings.abTestWinner) {
            safeAbMessage = sanitizeForPrompt(
              variant === "A"
                ? settings.abTestMessageA
                : settings.abTestMessageB,
              200,
            );
            abContext = `- Required promotional phrase to include exactly as written: "${safeAbMessage}"`;
          }

          const distanceMiles = parseFloat(
            (currentLeak?.metadata as any)?.distanceMiles || "0",
          );
          let distanceContext = "They live in our local delivery zone.";
          let etaContext = "";

          let customerLocation = "your neighborhood";
          if (cart.customerAddress) {
            const parts = cart.customerAddress.split(",");
            if (parts.length > 1) {
              customerLocation = parts[1].trim();
            }
          }

          let routingContext =
            "Invite them to complete their order for fast local delivery.";

          if (distanceMiles > 0) {
            // 🚀 THE FIX 2.2: Localization support (Metric vs Imperial)
            const unitSystem = safeSettings.unitSystem || "IMPERIAL";
            const displayDistance =
              unitSystem === "METRIC"
                ? `${(distanceMiles * 1.60934).toFixed(1)} km`
                : `${distanceMiles.toFixed(1)} miles`;

            distanceContext = `They are exactly ${displayDistance} away from our store.`;
            etaContext = `Estimated delivery time for their address is ${estimateDeliveryTime(distanceMiles)}.`;
            routingContext = `Urgency Strategy (CRITICAL): Frame this as a live logistics update. Tell the customer that one of our drivers is already scheduled to head toward ${customerLocation} later today. Emphasize that if they complete their checkout now, we can seamlessly add their items to that specific delivery route.`;
          }

          const currentHour = new Date().getHours();
          let timeContext = "";
          if (currentHour >= 9 && currentHour <= 15) {
            timeContext = `- Time Context: It is daytime. Urgency Strategy: "Order in the next hour to make the evening delivery route."`;
          } else if (currentHour >= 16 && currentHour <= 21) {
            timeContext = `- Time Context: It is evening. Urgency Strategy: "Order tonight to secure the first delivery slot tomorrow morning."`;
          } else {
            timeContext = `- Time Context: Neutral.`;
          }

          let dynamicDiscountContext = "";
          let authorizedDiscountCode = "";

          if (
            safeSettings.dynamicDiscountEnabled &&
            safeSettings.discountCode &&
            cart.cartValue
          ) {
            if (
              cart.cartValue >= (safeSettings.discountCartThreshold || 100) &&
              distanceMiles <= (safeSettings.discountDistance || 3)
            ) {
              authorizedDiscountCode = safeSettings.discountCode;
              dynamicDiscountContext = `
               - 🚨 AUTHORIZED DISCOUNT NEGOTIATION 🚨 
               The customer's cart is highly profitable and close by. 
               You are authorized to offer them the 10% discount code '${authorizedDiscountCode}' to close the sale immediately. 
               Use this code exactly as written.`;
            }
          }

          const SYSTEM_PROMPT = `You are an expert e-commerce copywriter for a LOCAL delivery business.
          STRICT RULES:
          1. Write exactly 2 short paragraphs. No more, no less.
          2. NEVER invent specific delivery times, prices, discount codes, or product details.
          3. Only offer a discount code if explicitly authorized in the prompt below.
          4. Tone: warm, helpful, neighborhood-friendly.
          5. NO subject line. Just the email body.
          6. Max 100 words total.`;

          const USER_PROMPT = `
          Write a cart recovery email for this abandoned checkout:
          - Store Name: ${cart.shop}
          - Abandoned Products: ${safeProductNames}
          - Logistics Data: ${distanceContext} ${etaContext}
          - ${routingContext}
          - Merchant's Core Message: "${safeMerchantMessage}"
          ${timeContext}
          ${abContext}
          ${dynamicDiscountContext}
          `;

          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: USER_PROMPT },
            ],
            max_tokens: 250,
            temperature: 0.6,
          });

          let generatedEmailBody =
            response.choices?.[0]?.message?.content?.trim() || "";

          // 🚀 THE FIX 2.3: Robust Regex pattern matching for unauthorized discounts
          const DISCOUNT_PATTERNS = [
            /\d+\s*%\s*off/i,
            /save\s+\d+/i,
            /knock\s+.{0,20}\s+off/i,
            /complimentary\s+(delivery|shipping)/i,
            /special\s+(rate|price|offer)/i,
            /no\s+charge\s+for\s+(delivery|shipping)/i,
            /free\s+\w+/i,
            /discount/i,
            /promo/i,
            /coupon/i,
            /\$\d+/i,
            /\d+\s*percent/i,
          ];

          const hasUnauthorizedOffer = DISCOUNT_PATTERNS.some((pattern) => {
            const matchInOutput = pattern.test(generatedEmailBody);
            const matchInMerchant =
              pattern.test(safeMerchantMessage) ||
              pattern.test(safeAbMessage) ||
              (authorizedDiscountCode && pattern.test(authorizedDiscountCode));
            return matchInOutput && !matchInMerchant;
          });

          if (
            hasUnauthorizedOffer ||
            generatedEmailBody.length < 20 ||
            generatedEmailBody.length > 1200
          ) {
            console.warn(
              `🚨 [AI Agent] Hallucination or unauthorized offer detected for cart ${cart.cartToken}. Using safe fallback.`,
            );
            generatedEmailBody = generateFallbackEmail(
              cart.shop,
              safeProductNames,
            );
          }

          const cartUrl =
            cart.abandonedCheckoutUrl || `https://${cart.shop}/cart`;
          const subjectLine =
            settings.recoveryEmailSubject ||
            "We're headed your way! Finish your order?";
          const finalEmailHtml = `<p>${generatedEmailBody.replace(/\n/g, "<br/>")}</p><br/><p>Resume your order here: <a href="${cartUrl}">${cartUrl}</a></p>`;
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
                abTestVariant: variant,
              },
            });
            if (currentLeak)
              await db.revenueLeak.update({
                where: { id: currentLeak.id },
                data: { status: "COMPLETED" },
              });
          } else {
            await db.cartRecovery.update({
              where: { id: cart.id },
              data: { agentStatus: "FAILED" },
            });
            if (currentLeak)
              await db.revenueLeak.update({
                where: { id: currentLeak.id },
                data: { status: "FAILED" },
              });
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
          if (currentLeak)
            await db.revenueLeak.update({
              where: { id: currentLeak.id },
              data: { status: "FAILED" },
            });
        }
      }),
    );
  } catch (error) {
    console.error("🚨 [AI Agent] Critical Failure:", error);
  }
}
