import {
  Layout,
  BlockStack,
  Card,
  InlineStack,
  Text,
  Icon,
  Badge,
  Button,
  Box,
  IndexTable,
} from "@shopify/polaris";
import {
  ProductIcon,
  ChartVerticalIcon,
  MoneyIcon,
  ViewIcon,
} from "@shopify/polaris-icons";

interface RevenueSuiteProps {
  totalRevenue: number;
  dailyGoal: number;
  goalProgress: string;
  isEnabled: boolean;
  setIsEnabled: (val: boolean) => void;
  isSaving: boolean;
  handleToggle: () => void;
  totalViews: number;
  conversionRate: string;
  recentConversions: any[];
  shop: string;
  onResetData: () => void;
}

export function RevenueSuiteTab({
  totalRevenue,
  dailyGoal,
  goalProgress,
  isEnabled,
  isSaving,
  handleToggle,
  totalViews,
  conversionRate,
  recentConversions,
  shop,
  onResetData,
}: RevenueSuiteProps) {
  return (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Daily Revenue Goal
                </Text>
                <Text as="p" variant="bodyMd" fontWeight="bold">
                  ${totalRevenue.toFixed(2)} / ${dailyGoal}
                </Text>
              </InlineStack>
              <div
                style={{
                  width: "100%",
                  backgroundColor: "var(--p-color-bg-surface-secondary)",
                  borderRadius: "10px",
                  height: "12px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${goalProgress}%`,
                    backgroundColor: "var(--p-color-text-success)",
                    height: "100%",
                    transition: "width 0.5s",
                  }}
                />
              </div>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <InlineStack gap="200">
                  <Icon source={ProductIcon} tone="base" />
                  <Text as="h2" variant="headingMd">
                    Social Proof Master Control
                  </Text>
                </InlineStack>
                <Badge tone={isEnabled ? "success" : "critical"}>
                  {isEnabled ? "Live on Store" : "Paused"}
                </Badge>
              </InlineStack>
              <Button
                tone={isEnabled ? "critical" : "success"}
                variant="primary"
                loading={isSaving}
                onClick={handleToggle}
              >
                {isEnabled ? "Disable Revenue Suite" : "Enable Revenue Suite"}
              </Button>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between">
                <InlineStack gap="300" blockAlign="center">
                  <Icon source={ChartVerticalIcon} tone="base" />
                  <Text as="h2" variant="headingMd">
                    Performance Analytics
                  </Text>
                </InlineStack>
                {shop === "sreeraj-dev-lab.myshopify.com" && (
                  <Button
                    tone="critical"
                    variant="tertiary"
                    size="slim"
                    onClick={onResetData}
                  >
                    Reset Test Data
                  </Button>
                )}
              </InlineStack>
              <InlineStack gap="400">
                <StatBox
                  label="Est. Revenue Boost"
                  value={`$${totalRevenue.toLocaleString()}`}
                  icon={MoneyIcon}
                  tone="success"
                  color="var(--p-color-text-success)"
                />
                <StatBox
                  label="Conversion Lift"
                  value={`${conversionRate}%`}
                  icon={ChartVerticalIcon}
                  tone="base"
                  color="var(--p-color-text-info)"
                />
                <StatBox
                  label="Live Impressions"
                  value={totalViews.toLocaleString()}
                  icon={ViewIcon}
                  tone="base"
                  color="var(--p-color-text-secondary)"
                />
              </InlineStack>
            </BlockStack>
          </Card>

          <Card padding="0">
            <Box padding="400">
              <Text as="h2" variant="headingMd">
                Recent Conversions
              </Text>
            </Box>
            <IndexTable
              resourceName={{ singular: "conversion", plural: "conversions" }}
              itemCount={recentConversions.length}
              headings={[
                { title: "Date" },
                { title: "Product ID" },
                { title: "Revenue", alignment: "end" },
              ]}
              selectable={false}
            >
              {recentConversions.map((conv, index) => (
                <IndexTable.Row
                  id={conv.id.toString()}
                  key={conv.id}
                  position={index}
                >
                  <IndexTable.Cell>
                    {new Date(conv.createdAt).toLocaleTimeString()}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {conv.productId?.split("/").pop() || "N/A"}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ textAlign: "right" }}>
                      <Text as="span" fontWeight="bold" tone="success">
                        +${conv.amount.toFixed(2)}
                      </Text>
                    </div>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );
}

function StatBox({ label, value, icon, tone, color }: any) {
  return (
    <Box
      background="bg-surface-secondary"
      padding="500"
      borderRadius="300"
      width="220px"
    >
      <BlockStack gap="200" align="center">
        <Icon source={icon} tone={tone} />
        <Text as="p" variant="bodySm" alignment="center" tone="subdued">
          {label}
        </Text>
        <Text as="h2" variant="headingLg" alignment="center">
          <span style={{ color }}>{value}</span>
        </Text>
      </BlockStack>
    </Box>
  );
}
