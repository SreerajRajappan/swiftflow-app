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

  // We will track if this sale came from our AI Agent or the Badge
  let isAiRecovery = false;
  let isBadgeConversion = false;

  try {
    // 🚀 Scan line items for our hidden attribution property
    if (orderPayload.line_items && Array.isArray(orderPayload.line_items)) {
      for (const item of orderPayload.line_items) {
        if (item.properties && Array.isArray(item.properties)) {
          const hasTracking = item.properties.some(
            (prop: any) =>
              prop.name === "_SwiftFlow_Source" &&
              prop.value === "delivery_badge",
          );
          if (hasTracking) {
            isBadgeConversion = true;
            break; // Found it! No need to check other items
          }
        }
      }
    }

    // --- PHASE 3: AI RECOVERY CLOSURE ---
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

    // 🚀 Determine the final attribution source
    // Priority 1: AI Recovery (They abandoned, we emailed them, they bought)
    // Priority 2: Badge Conversion (They used the widget and bought directly)
    // Priority 3: Organic (They bought without ever interacting with the widget)
    let finalSource = "organic";
    if (isAiRecovery) {
      finalSource = "cart_recovery";
    } else if (isBadgeConversion) {
      finalSource = "delivery_badge";
    }

    // --- RECORD THE CONVERSION EVENT ---
    await prisma.conversionEvent.upsert({
      where: { orderId: orderId },
      update: {}, // Prevent double-counting on duplicate webhooks
      create: {
        shop: shop,
        orderId: orderId,
        orderValue: totalAmount,
        source: finalSource,
        cartToken: checkoutToken || cartToken || null,
      },
    });

    console.log(
      `Successfully recorded ConversionEvent for ${shop}: $${totalAmount} (Source: ${finalSource})`,
    );
  } catch (error) {
    console.error("Error processing order webhook:", error);
  }

  return new Response();
};
