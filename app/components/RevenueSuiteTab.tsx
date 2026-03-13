import { useState, useCallback } from "react";
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
  TextField,
  Divider,
  InlineGrid,
} from "@shopify/polaris";
import {
  ProductIcon,
  ChartVerticalIcon,
  MoneyIcon,
  ViewIcon,
  MagicIcon, // <--- ADDED MAGIC ICON
} from "@shopify/polaris-icons";

interface RevenueSuiteProps {
  data: any;
  fetcher: any;
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
  data,
  fetcher,
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
  // Claude's Local State for Email & A/B Testing
  const [subject, setSubject] = useState(
    data?.recoveryEmailSubject || "Good news! We deliver to you!",
  );
  const [body, setBody] = useState(
    data?.recoveryEmailBody ||
      "You left something behind! We deliver directly to your area. Come back and complete your order.",
  );
  const [abEnabled, setAbEnabled] = useState(data?.abTestEnabled || false);
  const [msgA, setMsgA] = useState(
    data?.abTestMessageA || "We deliver to your area!",
  );
  const [msgB, setMsgB] = useState(
    data?.abTestMessageB || "Fast local delivery available!",
  );

  const isLocalSaving =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "save-suite-config";

  const handleSaveConfig = useCallback(() => {
    const form = new FormData();
    form.append("intent", "save-suite-config");
    form.append("recoveryEmailSubject", subject);
    form.append("recoveryEmailBody", body);
    form.append("abTestEnabled", String(abEnabled));
    form.append("abTestMessageA", msgA);
    form.append("abTestMessageB", msgB);
    fetcher.submit(form, { method: "post" });
  }, [subject, body, abEnabled, msgA, msgB, fetcher]);

  return (
    <Box paddingBlockEnd="800">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* 👇 NEW AI AGENT STATUS CARD 👇 */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={MagicIcon} tone="magic" />
                    <Text as="h2" variant="headingMd">
                      SwiftFlow AI Agent
                    </Text>
                  </InlineStack>
                  <Badge tone={isEnabled ? "success" : "critical"}>
                    {isEnabled ? "Active & Monitoring" : "Paused"}
                  </Badge>
                </InlineStack>

                <Divider />

                <Box>
                  <InlineStack gap="400" wrap={false}>
                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Current Mission
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        Scanning for abandoned carts within{" "}
                        {data?.deliveryRadius || 10}{" "}
                        {data?.unitSystem === "METRIC" ? "km" : "miles"}.
                      </Text>
                    </BlockStack>

                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Drafting Style
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        Helpful & Hyper-Local
                      </Text>
                    </BlockStack>

                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Action Taken
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        Autonomous Email Dispatch
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              </BlockStack>
            </Card>
            {/* 👆 END AI AGENT STATUS CARD 👆 */}

            {/* DAILY GOAL */}
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

            {/* MASTER TOGGLE */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <InlineStack gap="200">
                    <Icon source={ProductIcon} tone="base" />
                    <Text as="h2" variant="headingMd">
                      Revenue Suite Master Control
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

            {/* YOUR STAT BOXES */}
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

            {/* YOUR RECENT CONVERSIONS (Fixed Schema Mapping) */}
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
                  { title: "Order ID" },
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
                      {conv.orderId?.split("/").pop() || "N/A"}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <div style={{ textAlign: "right" }}>
                        <Text as="span" fontWeight="bold" tone="success">
                          +${conv.orderValue.toFixed(2)}
                        </Text>
                      </div>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* RIGHT COLUMN: Claude's Configuration Features */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* CLAUDE'S EMAIL CONFIG */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recovery Email Copy
                </Text>
                <Divider />
                <TextField
                  label="Email Subject"
                  value={subject}
                  onChange={setSubject}
                  autoComplete="off"
                />
                <TextField
                  label="Email Body"
                  value={body}
                  onChange={setBody}
                  multiline={4}
                  autoComplete="off"
                  helpText="Use plain text. The customer's exact cart will be appended by the AI automatically."
                />
                <Button
                  variant="primary"
                  loading={isLocalSaving}
                  onClick={handleSaveConfig}
                >
                  Save Configuration
                </Button>
              </BlockStack>
            </Card>

            {/* CLAUDE'S A/B TESTING */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    A/B Testing
                  </Text>
                  <Badge tone={abEnabled ? "success" : "attention"}>
                    {abEnabled ? "Active" : "Inactive"}
                  </Badge>
                </InlineStack>
                <Divider />
                <Text as="p" tone="subdued" variant="bodySm">
                  Test two delivery messages. Customers will randomly see one
                  variant.
                </Text>

                <Button
                  variant={abEnabled ? "primary" : "secondary"}
                  onClick={() => setAbEnabled(!abEnabled)}
                >
                  {abEnabled ? "Disable A/B Testing" : "Enable A/B Testing"}
                </Button>

                <InlineGrid columns={2} gap="400">
                  <TextField
                    label="Message A (50%)"
                    value={msgA}
                    onChange={setMsgA}
                    autoComplete="off"
                    disabled={!abEnabled}
                  />
                  <TextField
                    label="Message B (50%)"
                    value={msgB}
                    onChange={setMsgB}
                    autoComplete="off"
                    disabled={!abEnabled}
                  />
                </InlineGrid>

                <Button
                  variant="primary"
                  loading={isLocalSaving}
                  onClick={handleSaveConfig}
                  disabled={!abEnabled}
                >
                  Save A/B Test
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Box>
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
