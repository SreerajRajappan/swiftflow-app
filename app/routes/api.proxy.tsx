import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // 1. Authenticate the request from Shopify
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    console.error("❌ App Proxy: Auth failed (No session)");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const shop = session.shop;
  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id") || "unknown";

  console.log(`📡 Proxy Hit: Product ${productId} on ${shop}`);

  try {
    // 2. Fetch merchant settings for the banner
    const settings = await db.appSettings.findUnique({ where: { shop } });

    // 3. Increment/Count views (last 24h)
    const viewCount = await db.productView.count({
      where: { shop, productId },
    });

    return json({
      headerText: settings?.headerText || "Local Delivery Available",
      headerColor: settings?.headerColor || "#008060",
      viewCount,
      verified: true,
    });
  } catch (error) {
    console.error("❌ App Proxy Error:", error);
    return json({ error: "Database error" }, { status: 500 });
  }
};
