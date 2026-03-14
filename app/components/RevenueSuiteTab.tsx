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
  Select,
} from "@shopify/polaris";
import {
  ProductIcon,
  ChartVerticalIcon,
  MoneyIcon,
  ViewIcon,
  MagicIcon,
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
  isPro: boolean;
  navigate: (path: string) => void;
}

const TEMPLATES = {
  neighborhood: {
    subject: "Good news! We deliver right to your neighborhood 🏡",
    basicBody:
      "You left some great items in your cart! The good news is you are well within our local delivery zone. Complete your order today and we'll bring it right to your door.",
    proBody:
      "Write a friendly, neighborly email letting the customer know they left items behind. Emphasize that because they live in our local delivery zone, we can get their specific cart items delivered to them quickly. Keep the tone warm and helpful.",
  },
  fresh: {
    subject: "Craving something? Let us bring it to your door 🚚",
    basicBody:
      "Don't miss out! Your cart is waiting, and our team is ready to prep and deliver your order straight to your door. Click here to finish checking out so we can get started.",
    proBody:
      "Draft an enticing, slightly urgent message. Mention that we verified their address is within our fast-delivery radius. Encourage them to complete their order so we can start preparing their items fresh and dispatch our local driver.",
  },
  save_trip: {
    subject: "Save yourself a trip! Local delivery is available.",
    basicBody:
      "Why drive when we can deliver? You left some items in your cart, and we offer fast local delivery right to your area. Finish your order and let us do the heavy lifting.",
    proBody:
      "Create a helpful, service-oriented email. Point out that we offer local delivery to their specific area, saving them a trip to the store. Seamlessly mention the items in their cart and offer to bring everything directly to them to save them time.",
  },
};

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
  isPro,
  navigate,
}: RevenueSuiteProps) {
  const [template, setTemplate] = useState("custom");
  const [subject, setSubject] = useState(
    data?.recoveryEmailSubject || "Good news! We deliver to you!",
  );
  const [body, setBody] = useState(
    data?.recoveryEmailBody ||
      "You left something behind! Great news — we deliver directly to your area. Come back and complete your order.",
  );
  const [abEnabled, setAbEnabled] = useState(data?.abTestEnabled || false);
  const [msgA, setMsgA] = useState(
    data?.abTestMessageA ||
      "Good news! You're right in our local delivery zone 🏡",
  );
  const [msgB, setMsgB] = useState(
    data?.abTestMessageB ||
      "Your address qualifies for our special local delivery!",
  );

  const isLocalSaving =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "save-suite-config";

  const handleTemplateChange = useCallback(
    (value: string) => {
      setTemplate(value);
      if (value !== "custom") {
        const selected = TEMPLATES[value as keyof typeof TEMPLATES];
        setSubject(selected.subject);
        setBody(isPro ? selected.proBody : selected.basicBody);
      }
    },
    [isPro],
  );

  const handleSubjectChange = useCallback((value: string) => {
    setSubject(value);
    setTemplate("custom"); // Switch to custom if user manually edits
  }, []);

  const handleBodyChange = useCallback((value: string) => {
    setBody(value);
    setTemplate("custom"); // Switch to custom if user manually edits
  }, []);

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

  const templateOptions = [
    { label: "Custom / Manual Entry", value: "custom" },
    { label: "The Neighborhood (Warm & Community)", value: "neighborhood" },
    { label: "Fresh & Fast (Restaurants & Florists)", value: "fresh" },
    { label: "Save a Trip (Hardware & Supply)", value: "save_trip" },
  ];

  return (
    <Box paddingBlockEnd="800">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* AI AGENT STATUS CARD */}
            {isPro ? (
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
                          Verifying delivery radiuses and scanning for abandoned
                          carts ({">"}$50) within {data?.deliveryRadius || 10}{" "}
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
            ) : (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={MagicIcon} tone="magic" />
                      <Text as="h2" variant="headingMd">
                        SwiftFlow AI Agent
                      </Text>
                    </InlineStack>
                    <Badge tone="attention">Pro Feature</Badge>
                  </InlineStack>
                  <Divider />
                  <Box>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Upgrade to Pro to unlock our autonomous AI agent that
                      verifies customer locations against your delivery radius
                      and generates hyper-personalized recovery emails.
                    </Text>
                  </Box>
                  <Button
                    onClick={() => navigate("/app/billing")}
                    variant="primary"
                  >
                    Upgrade to Pro
                  </Button>
                </BlockStack>
              </Card>
            )}

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

            {/* STAT BOXES */}
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

            {/* RECENT CONVERSIONS */}
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

        {/* RIGHT COLUMN */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* EMAIL CONFIG */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  {isPro && <Icon source={MagicIcon} tone="magic" />}
                  <Text as="h2" variant="headingMd">
                    {isPro
                      ? "AI Delivery Email Guidelines"
                      : "Recovery Email Copy"}
                  </Text>
                </InlineStack>
                <Divider />

                <Select
                  label="Message Template"
                  options={templateOptions}
                  onChange={handleTemplateChange}
                  value={template}
                />

                <TextField
                  label="Email Subject"
                  value={subject}
                  onChange={handleSubjectChange}
                  autoComplete="off"
                />
                <TextField
                  label={isPro ? "Core Message / AI Prompt" : "Email Body"}
                  value={body}
                  onChange={handleBodyChange}
                  multiline={4}
                  autoComplete="off"
                  helpText={
                    isPro
                      ? "The AI Agent will use this core message, combine it with the customer's specific cart items, and highlight their verified local delivery zone to draft a highly personalized email."
                      : "This exact text will be sent to the customer if cart recovery is enabled."
                  }
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

            {/* A/B TESTING */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    A/B Testing
                  </Text>
                  <Badge
                    tone={
                      isPro
                        ? abEnabled
                          ? "success"
                          : "attention"
                        : "attention"
                    }
                  >
                    {isPro
                      ? abEnabled
                        ? "Active"
                        : "Inactive"
                      : "Pro Feature"}
                  </Badge>
                </InlineStack>
                <Divider />
                <Text as="p" tone="subdued" variant="bodySm">
                  Test two delivery messages. Customers will randomly see one
                  variant.
                </Text>

                <Button
                  variant={
                    isPro ? (abEnabled ? "primary" : "secondary") : "secondary"
                  }
                  onClick={() =>
                    isPro ? setAbEnabled(!abEnabled) : navigate("/app/billing")
                  }
                >
                  {isPro
                    ? abEnabled
                      ? "Disable A/B Testing"
                      : "Enable A/B Testing"
                    : "Upgrade to Pro to Enable"}
                </Button>

                <InlineGrid columns={2} gap="400">
                  <TextField
                    label="Message A (50%)"
                    value={msgA}
                    onChange={setMsgA}
                    autoComplete="off"
                    disabled={!isPro || !abEnabled}
                  />
                  <TextField
                    label="Message B (50%)"
                    value={msgB}
                    onChange={setMsgB}
                    autoComplete="off"
                    disabled={!isPro || !abEnabled}
                  />
                </InlineGrid>

                {isPro && (
                  <Button
                    variant="primary"
                    loading={isLocalSaving}
                    onClick={handleSaveConfig}
                    disabled={!abEnabled}
                  >
                    Save A/B Test
                  </Button>
                )}
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
