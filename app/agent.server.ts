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

    // 🚀 Process all 10 carts concurrently to beat serverless timeout limits
    await Promise.allSettled(
      pendingCarts.map(async (cart) => {
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

        if (lock.count === 0) return; // Another thread grabbed it

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

          // Safe typecast for new schema fields to prevent TypeScript compilation errors
          const safeSettings = settings as any;

          // 👇 Sanitize Inputs
          const items = cart.lineItems as any[];
          const rawProductNames =
            items?.map((item) => item.title).join(", ") ||
            "your selected items";
          const safeProductNames = sanitizeForPrompt(rawProductNames, 150);
          const safeMerchantMessage = sanitizeForPrompt(
            settings.recoveryEmailBody || "",
            300,
          );

          // 🚀 FEATURE 2: Autonomous A/B Testing Integration
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

          // 🚀 THE FIX: Correctly parse distance from leak metadata, not the cart root
          const distanceMiles = parseFloat(
            (currentLeak?.metadata as any)?.distanceMiles || "0",
          );

          let distanceContext = "They live in our local delivery zone.";
          let etaContext = "";

          // Extract the customer's actual city/neighborhood for the prompt
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
            distanceContext = `They are exactly ${distanceMiles.toFixed(1)} miles away from our store.`;
            etaContext = `Estimated delivery time for their address is ${estimateDeliveryTime(distanceMiles)}.`;

            // 🚀 Agentic Local Urgency
            routingContext = `Urgency Strategy (CRITICAL): Frame this as a live logistics update. Tell the customer that one of our drivers is already scheduled to head toward ${customerLocation} later today. Emphasize that if they complete their checkout now, we can seamlessly add their items to that specific delivery route.`;
          }

          // 🚀 FEATURE 3: Time-of-Day Context Prompting
          const currentHour = new Date().getHours();
          let timeContext = "";
          if (currentHour >= 9 && currentHour <= 15) {
            timeContext = `- Time Context: It is daytime. Urgency Strategy: "Order in the next hour to make the evening delivery route."`;
          } else if (currentHour >= 16 && currentHour <= 21) {
            timeContext = `- Time Context: It is evening. Urgency Strategy: "Order tonight to secure the first delivery slot tomorrow morning."`;
          } else {
            timeContext = `- Time Context: Neutral.`;
          }

          // 🚀 FEATURE 4: Agentic Dynamic Pricing (The Unfair Advantage)
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

          // 👇 Strict System Rules Reinstated
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

          // 🚀 STRIKE 3 FIX: Defensive Extraction & Optional Chaining
          // If OpenAI degrades, returns an empty array, or the message is missing, this safely falls back to "" without crashing
          let generatedEmailBody =
            response.choices?.[0]?.message?.content?.trim() || "";

          // 👇 AI Output Validation (Red Flag Detection)
          const redFlags = ["$", "free shipping", "discount", "promo", "% off"];
          const merchantMessageLower = safeMerchantMessage.toLowerCase();
          const abMessageLower = safeAbMessage.toLowerCase();
          const authorizedDiscountLower = authorizedDiscountCode.toLowerCase();

          // Check if the AI invented a discount that the merchant didn't explicitly authorize
          const hasHallucinatedDiscount = redFlags.some(
            (flag) =>
              generatedEmailBody.toLowerCase().includes(flag) &&
              !merchantMessageLower.includes(flag) &&
              !abMessageLower.includes(flag) &&
              !(
                authorizedDiscountLower &&
                generatedEmailBody
                  .toLowerCase()
                  .includes(authorizedDiscountLower)
              ),
          );

          if (
            hasHallucinatedDiscount ||
            generatedEmailBody.length < 20 ||
            generatedEmailBody.length > 1200
          ) {
            console.warn(
              `🚨 [AI Agent] Hallucination or empty response detected for cart ${cart.cartToken}. Using safe fallback template.`,
            );
            generatedEmailBody = generateFallbackEmail(
              cart.shop,
              safeProductNames,
            );
          }

          // 🚀 The Cross-Device Persistent Cart Link
          const cartUrl =
            cart.abandonedCheckoutUrl || `https://${cart.shop}/cart`;

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
                abTestVariant: variant, // 🚀 Saves the specific test variant used
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
      }),
    );
  } catch (error) {
    console.error("🚨 [AI Agent] Critical Failure:", error);
  }
}
