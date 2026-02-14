import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    console.error("❌ App Proxy: Authentication failed (No session)");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id") || "unknown";
  const shop = session.shop;

  // Logging to your terminal so you can see views happen in real-time
  console.log(`📡 Proxy Hit: Product ${productId} on ${shop}`);

  try {
    // 1. Record the view in your database
    await db.productView.create({
      data: {
        shop: shop,
        productId: productId,
      },
    });

    // 2. Count views for this product in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const viewCount = await db.productView.count({
      where: {
        shop: shop,
        productId: productId,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    console.log(
      `✅ Database Updated: ${viewCount} views in last 24h for ${productId}`,
    );

    return json({
      shop: shop,
      viewCount: viewCount,
      verified: true,
    });
  } catch (error) {
    console.error("❌ App Proxy Error:", error);
    return json({ error: "Failed to record view" }, { status: 500 });
  }
};
