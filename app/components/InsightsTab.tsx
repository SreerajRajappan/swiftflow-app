import {
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Icon,
  Text,
  Badge,
  Divider,
  IndexTable,
  Box,
  EmptyState,
  InlineGrid,
  ProgressBar,
  DataTable,
} from "@shopify/polaris";
import { ChartVerticalIcon } from "@shopify/polaris-icons";
import { useNavigate } from "@remix-run/react";

interface InsightsTabProps {
  isPro: boolean;
  trendingProducts: any[];
  recentConversions: any[];
  stats: {
    totalRevenue: number;
    totalOrders: number;
    badgeRevenue: number;
    badgeOrders: number;
    recoveryRevenue: number;
    recoveryOrders: number;
    totalChecks: number;
    inRadiusCount: number;
    conversionRate: number;
    emailsSent: number;
    recoveredCount: number;
    recoveredRevenue: number;
    recoveryRate: number;
  };
}

export function InsightsTab({
  isPro,
  trendingProducts,
  recentConversions,
  stats,
}: InsightsTabProps) {
  const navigate = useNavigate();

  if (!isPro) {
    return (
      <Card>
        <Box padding="1000">
          <EmptyState
            heading="Unlock Deep Revenue Insights"
            action={{
              content: "Upgrade to Pro",
              onAction: () => navigate("/app/billing"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              The Insights tab is a Pro feature. Upgrade to unlock full revenue
              attribution, A/B testing data, and trending product analysis.
            </p>
          </EmptyState>
        </Box>
      </Card>
    );
  }

  // 👇 FIX 1: Safe Order ID extraction & Visual Badges
  const tableRows = (recentConversions || []).map((c) => {
    const orderIdDisplay = c.orderId ? `#${c.orderId.split("/").pop()}` : "N/A";

    let sourceBadge = <Badge tone="info">{c.source || "Unknown"}</Badge>;
    if (c.source === "delivery_badge") {
      sourceBadge = <Badge tone="success">Delivery Badge</Badge>;
    } else if (c.source === "cart_recovery") {
      sourceBadge = <Badge tone="magic">Cart Recovery</Badge>;
    }

    return [
      <Text key={`id-${c.id}`} as="span" fontWeight="bold">
        {orderIdDisplay}
      </Text>,
      <Text key={`val-${c.id}`} as="span" tone="success" fontWeight="bold">
        +${(c.orderValue || 0).toFixed(2)}
      </Text>,
      <Box key={`src-${c.id}`}>{sourceBadge}</Box>,
      <Text key={`date-${c.id}`} as="span" tone="subdued">
        {new Date(c.createdAt).toLocaleDateString()}
      </Text>,
    ];
  });

  const badgeProgress =
    stats?.totalRevenue > 0
      ? (stats.badgeRevenue / stats.totalRevenue) * 100
      : 0;
  const recoveryProgress =
    stats?.totalRevenue > 0
      ? (stats.recoveryRevenue / stats.totalRevenue) * 100
      : 0;

  return (
    <BlockStack gap="400">
      {/* KPI ROW */}
      <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
        {[
          {
            label: "Total Attributed Revenue",
            value: `$${(stats?.totalRevenue || 0).toFixed(2)}`,
            sub: `${stats?.totalOrders || 0} orders`,
          },
          {
            label: "Cart Recovery Revenue",
            value: `$${(stats?.recoveredRevenue || 0).toFixed(2)}`,
            sub: `${stats?.recoveredCount || 0} carts recovered`,
          },
          {
            label: "Zone Coverage Rate",
            value: `${(stats?.conversionRate || 0).toFixed(1)}%`,
            sub: `${stats?.inRadiusCount || 0} of ${
              stats?.totalChecks || 0
            } customers`,
          },
          {
            label: "Email Recovery Rate",
            value: `${(stats?.recoveryRate || 0).toFixed(1)}%`,
            sub: `${stats?.emailsSent || 0} emails sent`,
          },
        ].map((item) => (
          <Card key={item.label}>
            <BlockStack gap="200">
              <Text as="p" tone="subdued" variant="bodySm">
                {item.label}
              </Text>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {item.value}
              </Text>
              <Text as="p" tone="subdued" variant="bodySm">
                {item.sub}
              </Text>
            </BlockStack>
          </Card>
        ))}
      </InlineGrid>

      <Layout>
        {/* REVENUE BREAKDOWN */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Revenue Breakdown
              </Text>
              <Divider />
              <InlineGrid columns={2} gap="600">
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Delivery Badge
                    </Text>
                    <Badge tone="success">Badge</Badge>
                  </InlineStack>
                  <Text as="p" variant="headingLg">
                    ${(stats?.badgeRevenue || 0).toFixed(2)}
                  </Text>
                  <ProgressBar
                    progress={badgeProgress}
                    tone="success"
                    size="small"
                  />
                  <Text as="p" tone="subdued" variant="bodySm">
                    {stats?.badgeOrders || 0} orders
                  </Text>
                </BlockStack>

                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Cart Recovery
                    </Text>
                    <Badge tone="magic">Recovery</Badge>
                  </InlineStack>
                  <Text as="p" variant="headingLg">
                    ${(stats?.recoveryRevenue || 0).toFixed(2)}
                  </Text>
                  {/* Changed tone from "highlight" to "primary" for better visual contrast */}
                  <ProgressBar
                    progress={recoveryProgress}
                    tone="primary"
                    size="small"
                  />
                  <Text as="p" tone="subdued" variant="bodySm">
                    {stats?.recoveryOrders || 0} orders
                  </Text>
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* RECENT CONVERSIONS */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Recent Conversions
              </Text>
              {tableRows.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Order ID", "Value", "Source", "Date"]}
                  rows={tableRows}
                />
              ) : (
                <EmptyState
                  heading="No conversions yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Revenue data will appear once customers convert.</p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* TRENDING PRODUCTS TABLE */}
        <Layout.Section>
          <Box paddingBlockEnd="800">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200">
                    <Icon source={ChartVerticalIcon} tone="base" />
                    <Text variant="headingMd" as="h2">
                      Trending Products (Top 5)
                    </Text>
                  </InlineStack>
                  <Badge tone="info">Verified Real-Time Data</Badge>
                </InlineStack>
                <Divider />
                {trendingProducts.length > 0 ? (
                  <IndexTable
                    resourceName={{ singular: "product", plural: "products" }}
                    itemCount={trendingProducts.length}
                    headings={[
                      { title: "" },
                      { title: "Product Name" },
                      { title: "Performance Metrics" },
                      { title: "Revenue Generated", alignment: "end" },
                    ]}
                    selectable={false}
                  >
                    {trendingProducts.map((product, index) => (
                      <IndexTable.Row
                        id={product.productId}
                        key={index}
                        position={index}
                      >
                        <IndexTable.Cell>
                          <Box width="40px">
                            <img
                              src={
                                product.image ||
                                "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
                              }
                              alt={product.title}
                              style={{
                                width: "40px",
                                height: "40px",
                                objectFit: "cover",
                                borderRadius: "4px",
                                border:
                                  "1px solid var(--p-color-border-subdued)",
                              }}
                            />
                          </Box>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" fontWeight="bold">
                            {product.title}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <InlineStack gap="100">
                            <Badge tone="info">{`${
                              product._count?.productId || 0
                            } views`}</Badge>
                            {product._count?.productId > 10 && (
                              <Badge tone="critical" progress="complete">
                                HOT 🔥
                              </Badge>
                            )}
                          </InlineStack>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <div style={{ textAlign: "right" }}>
                            <Text as="span" fontWeight="bold" tone="success">
                              ${product.revenue?.toFixed(2) || "0.00"}
                            </Text>
                          </div>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                ) : (
                  <EmptyState
                    heading="No trending data yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Product performance will appear here automatically.</p>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Box>
        </Layout.Section>
      </Layout>
    </BlockStack>
  );
}
