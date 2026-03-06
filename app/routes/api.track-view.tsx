import { type ActionFunctionArgs, json } from "@remix-run/node";
import db from "../db.server"; // Adjust import to your Prisma client location

export const action = async ({ request }: ActionFunctionArgs) => {
  // Security check: ensure it's a POST request
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const payload = await request.json();
    const { productId, productTitle, shopDomain } = payload;

    // Optional but recommended: Validate the signature Shopify sends in the headers
    // to ensure the request actually came from a Shopify storefront.

    // Write to your database
    await db.productView.create({
      data: {
        productId: String(productId),
        productTitle: productTitle,
        shop: shopDomain,
        // Map any other fields your Prisma schema requires here
      },
    });

    return json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to track view:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};
