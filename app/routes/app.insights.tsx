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
  DataTable,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get conversion events
  const conversions = await db.conversionEvent.findMany({
    where: {
      shop,
      createdAt: { gte: last30Days },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const totalRevenue = conversions.reduce(
    (sum, conv) => sum + conv.orderValue,
    0,
  );
  const totalOrders = conversions.length;

  // Get delivery checks
  const deliveryChecks = await db.deliveryCheck.findMany({
    where: {
      shop,
      timestamp: { gte: last30Days },
    },
  });

  const inRadiusCount = deliveryChecks.filter((c) => c.inRadius).length;
  const totalChecks = deliveryChecks.length;

  // Get cart recovery stats
  const recoveredCarts = await db.cartRecovery.findMany({
    where: {
      shop,
      recovered: true,
      recoveredAt: { gte: last30Days },
    },
  });

  const recoveredRevenue = recoveredCarts.reduce(
    (sum, cart) => sum + (cart.recoveryValue || 0),
    0,
  );

  return json({
    totalRevenue,
    totalOrders,
    inRadiusCount,
    totalChecks,
    conversionRate: totalChecks > 0 ? (inRadiusCount / totalChecks) * 100 : 0,
    recoveredCarts: recoveredCarts.length,
    recoveredRevenue,
    recentConversions: conversions,
  });
}

export default function Insights() {
  const data = useLoaderData<typeof loader>();

  const tableRows = data.recentConversions.map((conv) => [
    conv.orderId,
    `$${conv.orderValue.toFixed(2)}`,
    <Badge
      key={conv.id}
      tone={conv.source === "delivery_badge" ? "success" : "info"}
    >
      {conv.source.replace("_", " ")}
    </Badge>,
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
                <Text as="p" variant="heading2xl" fontWeight="bold">
                  ${data.totalRevenue.toFixed(2)}
                </Text>
                <Text as="p" tone="subdued">
                  {data.totalOrders} orders in last 30 days
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Delivery Zone Coverage
                </Text>
                <Text as="p" variant="heading2xl" fontWeight="bold">
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
                <Text as="p" variant="heading2xl" fontWeight="bold">
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
              {tableRows.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "numeric", "text", "text"]}
                  headings={["Order ID", "Value", "Source", "Date"]}
                  rows={tableRows}
                />
              ) : (
                <EmptyState
                  heading="No conversions yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Your revenue data will appear here once customers start
                    converting.
                  </p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
