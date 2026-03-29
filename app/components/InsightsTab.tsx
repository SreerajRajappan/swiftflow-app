import { useState, useEffect } from "react";
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
  DataTable,
} from "@shopify/polaris";
import { ChartVerticalIcon } from "@shopify/polaris-icons";
import { useNavigate } from "@remix-run/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface InsightsTabProps {
  isPro: boolean;
  trendingProducts: any[];
  recentConversions: any[];
  attributionChartData?: { date: string; badge: number; recovery: number }[];
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
  attributionChartData = [],
  stats,
}: InsightsTabProps) {
  const navigate = useNavigate();

  // Bulletproof rendering state to prevent Hydration & SVG measuring crashes
  const [isChartMounted, setIsChartMounted] = useState(false);
  useEffect(() => {
    setIsChartMounted(true);
  }, []);

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
      <span key={`date-${c.id}`} suppressHydrationWarning>
        {isChartMounted ? new Date(c.createdAt).toLocaleDateString() : ""}
      </span>,
    ];
  });

  return (
    <BlockStack gap="400">
      {/* 🚀 THE FIX: Global SVG override specifically protecting Recharts from Polaris */}
      <style>
        {`
          /* Override Shopify Polaris 20px SVG rule for Recharts elements */
          .recharts-wrapper svg,
          .recharts-surface {
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
        `}
      </style>

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
        {/* 🚀 THE UPGRADE: Full-Width Stacked Attribution Chart */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Revenue Attribution (Last 30 Days)
                </Text>
                <InlineStack gap="200">
                  <Badge tone="success">Passive (Badge)</Badge>
                  <Badge tone="magic">Active (AI Agent)</Badge>
                </InlineStack>
              </InlineStack>
              <Divider />

              <div
                style={{
                  height: 320,
                  width: "100%",
                  minWidth: 0,
                  position: "relative",
                }}
              >
                {isChartMounted && attributionChartData.length > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={attributionChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e1e3e5"
                        />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#6d7175", fontSize: 11 }}
                          dy={10}
                          minTickGap={30}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#6d7175", fontSize: 11 }}
                          tickFormatter={(val) => `$${val}`}
                        />
                        <Tooltip
                          cursor={{ fill: "#f4f6f8" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #c9cccf",
                            backgroundColor: "#ffffff",
                            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: any, name: any) => {
                            const formattedValue = `$${Number(value || 0).toFixed(2)}`;
                            const label =
                              name === "badge"
                                ? "Delivery Badge"
                                : "AI Cart Recovery";
                            return [formattedValue, label];
                          }}
                          labelStyle={{
                            color: "#202223",
                            fontWeight: "bold",
                            marginBottom: "8px",
                          }}
                        />
                        {/* Stack ID groups the bars together */}
                        <Bar
                          dataKey="badge"
                          name="badge"
                          stackId="a"
                          fill="#008060"
                          radius={[0, 0, 4, 4]}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="recovery"
                          name="recovery"
                          stackId="a"
                          fill="#9e52fa"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div
                    style={{
                      height: "100%",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text as="span" tone="subdued">
                      Loading attribution data...
                    </Text>
                  </div>
                )}
              </div>
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
        <Layout.Section variant="oneHalf">
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
                      { title: "Product" },
                      { title: "Metrics" },
                      { title: "Revenue", alignment: "end" },
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
                          <div
                            style={{ maxWidth: "120px", whiteSpace: "normal" }}
                          >
                            <Text as="span" fontWeight="bold" breakWord>
                              {product.title}
                            </Text>
                          </div>
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
