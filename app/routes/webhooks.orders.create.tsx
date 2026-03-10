import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. Extract topic and payload (From your version)
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`[Webhook] Received ${topic} for shop: ${shop}`);

    // 2. Security Guard (From your version)
    if (topic !== "ORDERS_CREATE") {
      console.warn(`[Webhook] Ignored unhandled topic: ${topic}`);
      return new Response("Unhandled webhook topic", { status: 200 });
    }

    if (!payload || !shop) {
      return json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    // 3. Safe Parsing (From Claude's version)
    const order = payload as Record<string, any>;
    const orderId = String(order.id);
    const orderValue = parseFloat(order.total_price ?? "0");
    const cartToken = (order.cart_token as string) ?? null;

    // --- SwiftFlow delivery badge attribution ---
    const swiftAttr = (
      (order.note_attributes as Array<{ name: string; value: string }>) ?? []
    ).find((a) => a.name === "_swiftflow_delivery");

    if (swiftAttr?.value === "true") {
      // IDEMPOTENCY CHECK: Prevent duplicate entries if Shopify retries the webhook
      const exists = await db.conversionEvent.findUnique({
        where: { orderId },
      });
      if (!exists) {
        await db.conversionEvent.create({
          data: {
            shop,
            orderId,
            orderValue,
            source: "delivery_badge",
            cartToken,
          },
        });
      }
    }

    // --- Cart recovery attribution ---
    if (cartToken) {
      const recovery = await db.cartRecovery.findUnique({
        where: { cartToken },
      });

      // Only update if it hasn't already been recovered
      if (
        recovery &&
        recovery.shop === shop &&
        recovery.emailSent &&
        !recovery.recovered
      ) {
        await db.cartRecovery.update({
          where: { cartToken },
          data: {
            recovered: true,
            recoveredAt: new Date(),
            recoveryValue: orderValue,
          },
        });

        // IDEMPOTENCY CHECK: Prevent duplicate conversions
        const exists = await db.conversionEvent.findUnique({
          where: { orderId },
        });
        if (!exists) {
          await db.conversionEvent.create({
            data: {
              shop,
              orderId,
              orderValue,
              source: "cart_recovery",
              cartToken,
            },
          });
        }
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error("Order webhook error:", error);
    return json({ error: "Processing failed" }, { status: 500 });
  }
}
