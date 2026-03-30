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

  // We will track if this sale came from our AI Agent, the Badge, or the Control Group
  let isAiRecovery = false;
  let isBadgeConversion = false;
  let isControlGroup = false; // 🚀 New flag added

  try {
    // Scan line items for our hidden attribution property
    if (orderPayload.line_items && Array.isArray(orderPayload.line_items)) {
      for (const item of orderPayload.line_items) {
        if (item.properties && Array.isArray(item.properties)) {
          const badgeTrack = item.properties.some(
            (prop: any) =>
              prop.name === "_SwiftFlow_Source" &&
              prop.value === "delivery_badge",
          );
          const controlTrack = item.properties.some(
            (prop: any) =>
              prop.name === "_SwiftFlow_Source" &&
              prop.value === "control_group",
          );

          if (badgeTrack) isBadgeConversion = true;
          if (controlTrack) isControlGroup = true;

          // Found a tracking token! No need to check other items
          if (isBadgeConversion || isControlGroup) {
            break;
          }
        }
      }
    }

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
        // Atomic Lock via updateMany.
        const claimResult = await prisma.cartRecovery.updateMany({
          where: {
            id: recovery.id,
            recovered: false, // The Atomic Lock
          },
          data: {
            recovered: true,
            recoveredAt: new Date(),
            recoveryValue: totalAmount,
          },
        });

        // Only proceed if THIS specific webhook process secured the database lock
        if (claimResult.count > 0) {
          isAiRecovery = true; // Flag this order as an AI win!

          // Update the Revenue Leak UI to show the green "Recovered" badge
          const leaks = await prisma.revenueLeak.findMany({
            where: { shop: shop },
          });

          // Find the leak matching the original cart token
          const currentLeak = leaks
            .reverse()
            .find((l: any) => l.metadata?.cartToken === recovery.cartToken);

          if (currentLeak) {
            // Apply the exact same atomic lock safety to the leak status
            await prisma.revenueLeak.updateMany({
              where: {
                id: currentLeak.id,
                status: { not: "RECOVERED" }, // The Atomic Lock
              },
              data: { status: "RECOVERED" },
            });
          }

          console.log(
            `🎉💰 [AI RECOVERY SUCCESS] Just banked $${totalAmount} for ${shop}!`,
          );
        } else {
          console.log(
            `⚠️ [RACE CONDITION PREVENTED] Duplicate webhook blocked for recovery ${recovery.id}`,
          );
        }
      }
    }

    // 🚀 Determine final attribution source
    let finalSource = "organic";
    if (isAiRecovery) {
      finalSource = "cart_recovery"; // AI recovery overrides everything
    } else if (isBadgeConversion) {
      finalSource = "delivery_badge";
    } else if (isControlGroup) {
      finalSource = "control_group"; // Record the A/B test holdout
    }

    // --- RECORD THE CONVERSION EVENT ---
    // The empty `update: {}` block ensures that if a duplicate webhook hits,
    // it safely ignores it without overwriting our first-touch attribution!
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
