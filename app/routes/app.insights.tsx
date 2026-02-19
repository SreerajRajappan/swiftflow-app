import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineGrid,
  Box,
  Badge,
  DataTable,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get date ranges
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Total revenue attributed to SwiftFlow
  const totalRevenue = await db.conversionEvent.aggregate({
    where: {
      shopDomain: shop,
      createdAt: { gte: last30Days },
    },
    _sum: { orderValue: true },
    _count: true,
  });

  // Delivery checks
  const deliveryStats = await db.deliveryCheck.groupBy({
    by: ["inRadius"],
    where: {
      shopDomain: shop,
      timestamp: { gte: last30Days },
    },
    _count: true,
  });

  const inRadiusCount = deliveryStats.find((s) => s.inRadius)?._count || 0;
  const totalChecks = deliveryStats.reduce((sum, s) => sum + s._count, 0);
  const conversionRate =
    totalChecks > 0 ? (inRadiusCount / totalChecks) * 100 : 0;

  // Cart recovery stats
  const recoveryStats = await db.cartRecovery.aggregate({
    where: {
      shopDomain: shop,
      recovered: true,
      createdAt: { gte: last30Days },
    },
    _sum: { recoveryValue: true },
    _count: true,
  });

  // Recent conversions
  const recentConversions = await db.conversionEvent.findMany({
    where: { shopDomain: shop },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return json({
    totalRevenue: totalRevenue._sum.orderValue || 0,
    totalOrders: totalRevenue._count || 0,
    inRadiusCount,
    totalChecks,
    conversionRate,
    recoveredCarts: recoveryStats._count || 0,
    recoveredRevenue: recoveryStats._sum.recoveryValue || 0,
    recentConversions,
  });
}

export default function Insights() {
  const data = useLoaderData<typeof loader>();

  const tableRows = data.recentConversions.map((conv) => [
    conv.orderId,
    `$${conv.orderValue.toFixed(2)}`,
    conv.source,
    new Date(conv.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page title="Revenue Insights">
      <Layout>
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Revenue Attributed
                </Text>
                <Text as="p" variant="heading2xl">
                  ${data.totalRevenue.toFixed(2)}
                </Text>
                <Text as="p" tone="subdued">
                  Last 30 days • {data.totalOrders} orders
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Delivery Zone Coverage
                </Text>
                <Text as="p" variant="heading2xl">
                  {data.conversionRate.toFixed(1)}%
                </Text>
                <Text as="p" tone="subdued">
                  {data.inRadiusCount} of {data.totalChecks} customers in range
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Cart Recovery
                </Text>
                <Text as="p" variant="heading2xl">
                  ${data.recoveredRevenue.toFixed(2)}
                </Text>
                <Text as="p" tone="subdued">
                  {data.recoveredCarts} carts recovered
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Recent Conversions
              </Text>
              <DataTable
                columnContentTypes={["text", "numeric", "text", "text"]}
                headings={["Order ID", "Value", "Source", "Date"]}
                rows={tableRows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
