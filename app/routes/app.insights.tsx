import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ALL_PAID_PLANS, PRO_PLANS, ELITE_PLANS } from "../constants";
import { InsightsTab } from "../components/InsightsTab";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const planCheckArray: any = ALL_PAID_PLANS;
  const billingCheck = await billing.check({
    plans: planCheckArray,
    isTest: true,
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );

  const activePlanName = subscription?.name || "";
  const isPro =
    PRO_PLANS.includes(activePlanName) || ELITE_PLANS.includes(activePlanName);

  // 1. Recent Conversions
  const recentConversions = await prisma.conversionEvent.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // 🚀 THE FIX: Correctly calculate the 30-day window to INCLUDE TODAY
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29); // Back 29 days + Today = 30 Days total
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const allConversions = await prisma.conversionEvent.findMany({
    where: { shop, createdAt: { gte: thirtyDaysAgo } },
  });

  const badgeConversions = allConversions.filter(
    (c) => c.source === "delivery_badge",
  );
  const recoveryConversions = allConversions.filter(
    (c) => c.source === "cart_recovery",
  );

  const allChecks = await prisma.deliveryCheck.findMany({
    where: { shop, timestamp: { gte: thirtyDaysAgo } },
  });
  const inRadiusCount = allChecks.filter((c) => c.inRadius).length;

  const cartRecoveries = await prisma.cartRecovery.findMany({
    where: { shop },
  });
  const emailsSent = cartRecoveries.filter((c) => c.emailSent).length;
  const recovered = cartRecoveries.filter(
    (c) => c.recovered && c.recoveredAt && c.recoveredAt >= thirtyDaysAgo,
  );

  const advancedStats = {
    totalRevenue: allConversions.reduce((s, c) => s + c.orderValue, 0),
    totalOrders: allConversions.length,
    badgeRevenue: badgeConversions.reduce((s, c) => s + c.orderValue, 0),
    badgeOrders: badgeConversions.length,
    recoveryRevenue: recoveryConversions.reduce((s, c) => s + c.orderValue, 0),
    recoveryOrders: recoveryConversions.length,
    totalChecks: allChecks.length,
    inRadiusCount,
    conversionRate:
      allChecks.length > 0 ? (inRadiusCount / allChecks.length) * 100 : 0,
    emailsSent,
    recoveredCount: recovered.length,
    recoveredRevenue: recovered.reduce((s, c) => s + (c.recoveryValue ?? 0), 0),
    recoveryRate: emailsSent > 0 ? (recovered.length / emailsSent) * 100 : 0,
  };

  const attributionMap = new Map();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i); // This now finishes exactly on Today!
    const dateStr = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    // Add an organic bucket to the map
    attributionMap.set(dateStr, {
      date: dateStr,
      badge: 0,
      recovery: 0,
      organic: 0,
    });
  }

  allConversions.forEach((conv) => {
    const dateStr = new Date(conv.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (attributionMap.has(dateStr)) {
      const dayData = attributionMap.get(dateStr);
      if (conv.source === "cart_recovery") {
        dayData.recovery += conv.orderValue;
      } else if (conv.source === "delivery_badge") {
        dayData.badge += conv.orderValue;
      } else {
        dayData.organic += conv.orderValue; // Capture the organic sales!
      }
    }
  });

  const attributionChartData = Array.from(attributionMap.values());

  // 3. Trending Products via GraphQL
  const trendingData = await prisma.productView.groupBy({
    by: ["productId"],
    where: { shop },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 5,
  });

  const enrichedProducts = await Promise.all(
    trendingData.map(async (item: any) => {
      try {
        const response = await admin.graphql(
          `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              title
              featuredMedia { preview { image { url } } }
            }
          }`,
          { variables: { id: item.productId } },
        );
        const responseJson = await response.json();
        const product = responseJson.data?.product;

        return {
          ...item,
          title: product?.title || "Unknown Product",
          image: product?.featuredMedia?.preview?.image?.url || "",
          revenue: 0,
        };
      } catch (e) {
        return { ...item, title: "Product Deleted", image: "", revenue: 0 };
      }
    }),
  );

  return json({
    isPro,
    recentConversions,
    advancedStats,
    trendingProducts: enrichedProducts,
    attributionChartData,
  });
};

export default function InsightsRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Deep Revenue Insights">
      <TitleBar title="Deep Revenue Insights" />
      <BlockStack gap="400">
        <InsightsTab
          isPro={data.isPro}
          trendingProducts={data.trendingProducts}
          recentConversions={data.recentConversions}
          stats={data.advancedStats}
          attributionChartData={data.attributionChartData}
        />
      </BlockStack>
    </Page>
  );
}
