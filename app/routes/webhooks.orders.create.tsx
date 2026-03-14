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
  const orderId = String(orderPayload.id);

  // Shopify checkout tokens can be volatile. Capture all possible identifiers!
  const checkoutToken = orderPayload.checkout_token;
  const cartToken = orderPayload.cart_token;
  const customerEmail =
    orderPayload.email ||
    orderPayload.contact_email ||
    orderPayload.customer?.email;

  // We will track if this sale came from our AI Agent
  let isAiRecovery = false;

  try {
    // --- PHASE 3: AI RECOVERY CLOSURE ---
    // Search by Token OR Email to catch cross-device or new-checkout recoveries
    const searchConditions: any[] = [];
    if (checkoutToken) searchConditions.push({ cartToken: checkoutToken });
    if (cartToken) searchConditions.push({ cartToken: cartToken });
    if (customerEmail) searchConditions.push({ customerEmail: customerEmail });

    if (searchConditions.length > 0) {
      const recovery = await prisma.cartRecovery.findFirst({
        where: {
          shop: shop,
          emailSent: true,
          recovered: false,
          OR: searchConditions,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (recovery) {
        isAiRecovery = true; // Flag this order as an AI win!

        // 1. Mark the recovery as successful
        await prisma.cartRecovery.update({
          where: { id: recovery.id },
          data: {
            recovered: true,
            recoveredAt: new Date(),
            recoveryValue: totalAmount,
          },
        });

        // 2. Update the Revenue Leak UI to show the green "Recovered" badge
        const leaks = await prisma.revenueLeak.findMany({
          where: { shop: shop },
        });

        // Find the leak matching the original cart token
        const currentLeak = leaks
          .reverse()
          .find((l: any) => l.metadata?.cartToken === recovery.cartToken);

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

    // --- RECORD THE CONVERSION EVENT ---
    await prisma.conversionEvent.upsert({
      where: { orderId: orderId },
      update: {}, // Prevent double-counting on duplicate webhooks
      create: {
        shop: shop,
        orderId: orderId,
        orderValue: totalAmount,
        source: isAiRecovery ? "cart_recovery" : "organic",
        cartToken: checkoutToken || cartToken || null,
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
