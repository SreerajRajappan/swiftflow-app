import { type ActionFunctionArgs, json } from "@remix-run/node";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // 🚨 SECURE THE ROUTE: Verify Shopify's cryptographic signature
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      console.error("❌ App Proxy: Auth failed (No session)");
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const shop = session.shop; // Safely extracted from Shopify's encrypted signature
    const payload = await request.json();
    const { productId, productTitle, isNewView } = payload;

    if (isNewView) {
      await db.productView.create({
        data: {
          productId: String(productId),
          productTitle: productTitle,
          shop: shop,
        },
      });
    }

    const viewCount = await db.productView.count({
      where: { shop, productId: String(productId) },
    });

    return json({ success: true, viewCount }, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to track view:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};
