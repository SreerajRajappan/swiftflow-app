import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. Extract topic again
    const { topic, shop, payload } = await authenticate.webhook(request);

    // 2. USE CASE: Helpful logging for your server terminal
    console.log(`[Webhook] Received ${topic} for shop: ${shop}`);

    // 3. USE CASE: Security Guard - Stop execution if it's the wrong webhook
    if (topic !== "ORDERS_CREATE") {
      console.warn(`[Webhook] Ignored unhandled topic: ${topic}`);
      return new Response("Unhandled webhook topic", { status: 200 });
      // Note: We return 200 so Shopify knows we received it, but we safely ignore it.
    }

    if (!payload || !shop) {
      return json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const order = payload as any;

    // Check for SwiftFlow attribution
    const swiftflowAttr = order.note_attributes?.find(
      (attr: any) => attr.name === "_swiftflow_delivery",
    );

    if (swiftflowAttr?.value === "true") {
      // Create conversion event
      await db.conversionEvent.create({
        data: {
          shop,
          orderId: order.id.toString(),
          orderValue: parseFloat(order.total_price || "0"),
          source: "delivery_badge",
          cartToken: order.cart_token,
        },
      });
    }

    // Check for cart recovery
    if (order.cart_token) {
      const cartRecovery = await db.cartRecovery.findUnique({
        where: { cartToken: order.cart_token },
      });

      if (cartRecovery && cartRecovery.emailSent && !cartRecovery.recovered) {
        await db.cartRecovery.update({
          where: { id: cartRecovery.id },
          data: {
            recovered: true,
            recoveredAt: new Date(),
            recoveryValue: parseFloat(order.total_price || "0"),
          },
        });

        // Also create conversion event
        await db.conversionEvent.create({
          data: {
            shop,
            orderId: order.id.toString(),
            orderValue: parseFloat(order.total_price || "0"),
            source: "cart_recovery",
            cartToken: order.cart_token,
          },
        });
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error("Order webhook error:", error);
    return json({ error: "Processing failed" }, { status: 500 });
  }
}
