import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("🔥 WEBHOOK RECEIVED: orders/create");
  const { shop, payload, topic } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response();
  }

  const orderPayload = payload as any;
  const totalAmount = parseFloat(orderPayload.total_price || "0");
  const cartToken = orderPayload.checkout_token || orderPayload.cart_token;
  const orderId = String(orderPayload.id);

  // We will track if this sale came from our AI Agent
  let isAiRecovery = false;

  try {
    // --- PHASE 3: AI RECOVERY CLOSURE ---
    if (cartToken) {
      const recovery = await prisma.cartRecovery.findFirst({
        where: { cartToken: cartToken, shop: shop },
      });

      if (recovery && recovery.emailSent && !recovery.recovered) {
        isAiRecovery = true; // Flag this order as an AI win!

        await prisma.cartRecovery.update({
          where: { id: recovery.id },
          data: {
            recovered: true,
            recoveredAt: new Date(),
            recoveryValue: totalAmount,
          },
        });

        const leaks = await prisma.revenueLeak.findMany({
          where: { shop: shop },
        });
        const currentLeak = leaks
          .reverse()
          .find((l: any) => l.metadata?.cartToken === cartToken);

        if (currentLeak) {
          await prisma.revenueLeak.update({
            where: { id: currentLeak.id },
            data: { status: "RECOVERED" },
          });
        }

        console.log(
          `🎉💰 [AI RECOVERY SUCCESS] Just banked $${totalAmount} for ${shop}!`,
        );
      }
    }

    // --- FIXED CONVERSION EVENT LOGIC ---
    // Uses ConversionEvent instead of Conversion, and maps to your exact schema fields
    await prisma.conversionEvent.upsert({
      where: { orderId: orderId },
      update: {}, // If Shopify sends duplicate webhooks, don't double-count the revenue
      create: {
        shop: shop,
        orderId: orderId,
        orderValue: totalAmount,
        source: isAiRecovery ? "cart_recovery" : "organic",
        cartToken: cartToken,
      },
    });

    console.log(
      `Successfully recorded ConversionEvent for ${shop}: $${totalAmount} (Source: ${isAiRecovery ? "AI Agent" : "Organic"})`,
    );
  } catch (error) {
    console.error("Error processing order webhook:", error);
  }

  return new Response();
};
