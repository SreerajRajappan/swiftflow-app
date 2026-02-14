import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response();
  }

  const orderPayload = payload as any;

  // 1. Extract the order value and product IDs
  const totalAmount = parseFloat(orderPayload.total_price || "0");
  const lineItems = orderPayload.line_items || [];

  try {
    // 2. Record a conversion for each product in the order
    // We iterate through items to attribute revenue to specific products
    for (const item of lineItems) {
      await prisma.conversion.create({
        data: {
          shop: shop,
          productId: `gid://shopify/Product/${item.product_id}`,
          amount: totalAmount / lineItems.length, // Simple attribution split
        },
      });
    }

    console.log(
      `Successfully recorded conversion for ${shop}: $${totalAmount}`,
    );
  } catch (error) {
    console.error("Error recording conversion:", error);
  }

  return new Response();
};
