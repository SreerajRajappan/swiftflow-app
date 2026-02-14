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
} from "@shopify/polaris";
import { ChartVerticalIcon } from "@shopify/polaris-icons";
import { useNavigate } from "@remix-run/react";

interface InsightsTabProps {
  isPro: boolean;
  trendingProducts: any[];
}

export function InsightsTab({ isPro, trendingProducts }: InsightsTabProps) {
  const navigate = useNavigate();

  if (!isPro) {
    return (
      <Layout.Section>
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
                The Insights tab is a Pro feature. Upgrade to see product
                revenue.
              </p>
            </EmptyState>
          </Box>
        </Card>
      </Layout.Section>
    );
  }

  return (
    <Layout>
      <Layout.Section>
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
                        <div
                          style={{
                            height: "40px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <img
                            src={
                              product.image ||
                              "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
                            }
                            alt={product.title}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid var(--p-color-border-subdued)",
                            }}
                          />
                        </div>
                      </Box>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="p" fontWeight="bold">
                        {product.title}
                      </Text>
                      <Text as="p" variant="bodyXs" tone="subdued">
                        ID: {product.productId.split("/").pop()}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="100">
                        <Badge tone="info">{`${product._count.productId} views`}</Badge>
                        {product._count.productId > 10 && (
                          <Badge tone="critical" progress="complete">
                            HOT 🔥
                          </Badge>
                        )}
                        <Badge tone="success">Verified</Badge>
                      </InlineStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <div style={{ textAlign: "right" }}>
                        <Text as="p" fontWeight="bold" tone="success">
                          $
                          {product.revenue?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) || "0.00"}
                        </Text>
                      </div>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            ) : (
              <Box padding="1000">
                <EmptyState
                  heading="No trending data yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Product performance will appear here automatically as
                    customers browse.
                  </p>
                </EmptyState>
              </Box>
            )}
          </BlockStack>
        </Card>
        <Box paddingBlockEnd="1000" />
      </Layout.Section>
    </Layout>
  );
}
