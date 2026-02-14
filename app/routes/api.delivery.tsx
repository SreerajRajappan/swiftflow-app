//api.delivery.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(`
      #graphql
      query getUnfulfilledOrders {
        orders(first: 50, query: "fulfillment_status:unfulfilled") {
          nodes {
            id
            name
            shippingAddress {
              address1
              city
              zip
              latitude
              longitude
            }
          }
        }
      }
    `);

    // Cast the response to any or a specific interface to bypass the 'errors' type error
    const result = (await response.json()) as any;

    return Response.json({
      orders: result.data?.orders?.nodes || [],
      // result.errors is now accessible
      errors: result.errors || null,
    });
  } catch (error) {
    console.error("Delivery API Error:", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
};
