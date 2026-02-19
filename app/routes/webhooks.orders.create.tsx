import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return json({ error: "Invalid topic" }, { status: 400 });
  }

  try {
    const order = payload;

    // Check if order has SwiftFlow attribution
    const hasSwiftFlowAttr = order.note_attributes?.some(
      (attr: any) =>
        attr.name === "_swiftflow_in_delivery_zone" && attr.value === "true",
    );

    if (hasSwiftFlowAttr) {
      // Attribute this order to SwiftFlow
      await db.conversionEvent.create({
        data: {
          shopDomain: shop,
          orderId: order.id.toString(),
          orderValue: parseFloat(order.total_price || "0"),
          source: "delivery_badge",
        },
      });
    }

    // Check if this recovers a cart
    const cartToken = order.cart_token;
    if (cartToken) {
      const cartRecovery = await db.cartRecovery.findFirst({
        where: {
          cartToken,
          shopDomain: shop,
          emailSent: true,
          recovered: false,
        },
      });

      if (cartRecovery) {
        await db.cartRecovery.update({
          where: { id: cartRecovery.id },
          data: {
            recovered: true,
            recoveryValue: parseFloat(order.total_price || "0"),
          },
        });

        // Also create conversion event
        await db.conversionEvent.create({
          data: {
            shopDomain: shop,
            orderId: order.id.toString(),
            orderValue: parseFloat(order.total_price || "0"),
            source: "cart_recovery",
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
