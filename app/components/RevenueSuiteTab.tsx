import { useState, useCallback, useEffect } from "react";
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
  Banner,
} from "@shopify/polaris";
import {
  ProductIcon,
  ChartVerticalIcon,
  MoneyIcon,
  ViewIcon,
  MagicIcon,
} from "@shopify/polaris-icons";
import { ZoneHealthCard } from "./ZoneHealthCard";
import type { ZoneHealth } from "~/services/zone-health.server";

interface RevenueSuiteProps {
  data: any;
  fetcher: any;
  totalRevenue: number;
  todayRevenue: number;
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
  isDev: boolean;
  zoneHealth: ZoneHealth;
}

const TEMPLATES = {
  neighborhood: {
    subject: "Good news! We deliver right to your neighborhood 🏡",
    basicBody:
      "You left some great items in your cart! The good news is you are well within our local delivery zone. Complete your order today and we'll bring it right to your door.",
    proPrompt:
      "Write a friendly, neighborly email letting the customer know they left items behind. Emphasize that because they live in our local delivery zone, we can get their specific cart items delivered to them quickly. Keep the tone warm and helpful.",
  },
  fresh: {
    subject: "Craving something? Let us bring it to your door 🚚",
    basicBody:
      "Don't miss out! Your cart is waiting, and our team is ready to prep and deliver your order straight to your door. Click here to finish checking out so we can get started.",
    proPrompt:
      "Draft an enticing, slightly urgent message. Mention that we verified their address is within our fast-delivery radius. Encourage them to complete their order so we can start preparing their items fresh and dispatch our local driver.",
  },
  save_trip: {
    subject: "Save yourself a trip! Local delivery is available.",
    basicBody:
      "Why drive when we can deliver? You left some items in your cart, and we offer fast local delivery right to your area. Finish your order and let us do the heavy lifting.",
    proPrompt:
      "Create a helpful, service-oriented email. Point out that we offer local delivery to their specific area, saving them a trip to the store. Seamlessly mention the items in their cart and offer to bring everything directly to them to save them time.",
  },
};

export function RevenueSuiteTab({
  data,
  fetcher,
  totalRevenue,
  todayRevenue,
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
  isDev,
  zoneHealth,
}: RevenueSuiteProps) {
  const [localDailyGoal, setLocalDailyGoal] = useState(
    dailyGoal?.toString() || "500",
  );
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [template, setTemplate] = useState("custom");
  const [subject, setSubject] = useState(
    data?.recoveryEmailSubject || "Good news! We deliver to you!",
  );
  const [body, setBody] = useState(
    data?.recoveryEmailBody || (isPro ? "" : TEMPLATES.neighborhood.basicBody),
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

  const [isWaitingForAi, setIsWaitingForAi] = useState(false);

  // State to track if we were previously saving to accurately close the edit box
  const [wasLocalSaving, setWasLocalSaving] = useState(false);

  const isLocalSaving =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "save-suite-config";

  const isGeneratingPrompt =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "generate-ai-prompt";

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      isWaitingForAi &&
      fetcher.data?.generatedPrompt
    ) {
      setBody(fetcher.data.generatedPrompt);
      setIsWaitingForAi(false);
    }
  }, [fetcher.state, fetcher.data, isWaitingForAi]);

  // Bulletproof listener to close edit mode after save completes
  useEffect(() => {
    if (isLocalSaving) {
      setWasLocalSaving(true);
    } else if (wasLocalSaving && fetcher.state === "idle") {
      setIsEditingGoal(false);
      setWasLocalSaving(false);
    }
  }, [isLocalSaving, fetcher.state, wasLocalSaving]);

  const handleTemplateChange = useCallback(
    (value: string) => {
      setTemplate(value);
      if (value !== "custom") {
        const selected = TEMPLATES[value as keyof typeof TEMPLATES];
        setSubject(selected.subject);
        if (isPro) {
          setBody("");
        } else {
          setBody(selected.basicBody);
        }
      }
    },
    [isPro],
  );

  const handleSubjectChange = useCallback((value: string) => {
    setSubject(value);
    setTemplate("custom");
  }, []);

  const handleBodyChange = useCallback((value: string) => {
    setBody(value);
    setTemplate("custom");
  }, []);

  const handleGeneratePrompt = useCallback(() => {
    setIsWaitingForAi(true);
    const form = new FormData();
    form.append("intent", "generate-ai-prompt");
    form.append(
      "templateTheme",
      template === "custom" ? "neighborhood" : template,
    );
    fetcher.submit(form, { method: "post" });
  }, [fetcher, template]);

  const handleSaveConfig = useCallback(() => {
    const form = new FormData();
    form.append("intent", "save-suite-config");

    const finalBody =
      body.trim() === "" && isPro
        ? TEMPLATES[
            template === "custom"
              ? "neighborhood"
              : (template as keyof typeof TEMPLATES)
          ].proPrompt
        : body;

    form.append("recoveryEmailSubject", subject);
    form.append("recoveryEmailBody", finalBody);
    form.append("abTestEnabled", String(abEnabled));
    form.append("abTestMessageA", msgA);
    form.append("abTestMessageB", msgB);
    form.append("dailyGoal", localDailyGoal.toString());

    fetcher.submit(form, { method: "post" });
  }, [
    subject,
    body,
    abEnabled,
    msgA,
    msgB,
    fetcher,
    isPro,
    template,
    localDailyGoal,
  ]);

  const templateOptions = [
    { label: "Custom / Manual Entry", value: "custom" },
    { label: "The Neighborhood (Warm & Community)", value: "neighborhood" },
    { label: "Fresh & Fast (Restaurants & Florists)", value: "fresh" },
    { label: "Save a Trip (Hardware & Supply)", value: "save_trip" },
  ];

  const currentPlaceholder = isPro
    ? TEMPLATES[
        template === "custom"
          ? "neighborhood"
          : (template as keyof typeof TEMPLATES)
      ].proPrompt
    : "";

  return (
    <Box paddingBlockEnd="800">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* AI AGENT STATUS CARD */}
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
                          Verifying delivery radiuses and scanning all abandoned
                          carts within {data?.deliveryRadius || 10}{" "}
                          {data?.unitSystem === "METRIC" ? "km" : "miles"}.
                          Carts {">"}$50 are flagged as Critical.
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
              <Card background="bg-surface-secondary">
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

                  {/* 👇 THE ZERO-BUDGET UPSELL TRIGGER 👇 */}
                  {totalViews > 0 && totalRevenue === 0 ? (
                    <Banner tone="warning">
                      <Text as="p" variant="bodyMd">
                        Based on your{" "}
                        <strong>
                          {totalViews.toLocaleString()} recent local visitors
                        </strong>
                        , you are leaving an estimated{" "}
                        <strong>${(totalViews * 0.03 * 45).toFixed(0)}</strong>{" "}
                        on the table this month from abandoned carts.
                      </Text>
                    </Banner>
                  ) : null}

                  <Box>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Upgrade to Pro to unlock our autonomous AI agent. It
                      verifies customer locations against your delivery radius
                      and generates hyper-personalized, highly-converting
                      recovery emails while you sleep.
                    </Text>
                  </Box>
                  <Button
                    onClick={() => navigate("/app/billing")}
                    variant="primary"
                    tone="success"
                  >
                    Upgrade to Pro & Capture Lost Revenue
                  </Button>
                </BlockStack>
              </Card>
            )}

            {/* DAILY GOAL */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Daily Revenue Goal
                  </Text>
                  {isEditingGoal ? (
                    <InlineStack gap="200">
                      <Button
                        size="slim"
                        onClick={() => setIsEditingGoal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="slim"
                        variant="primary"
                        loading={isLocalSaving}
                        onClick={handleSaveConfig}
                      >
                        Save
                      </Button>
                    </InlineStack>
                  ) : (
                    <Button
                      size="slim"
                      variant="secondary"
                      onClick={() => setIsEditingGoal(true)}
                    >
                      Edit Goal
                    </Button>
                  )}
                </InlineStack>

                {isEditingGoal ? (
                  <TextField
                    label="Target Daily Revenue ($)"
                    type="number"
                    value={localDailyGoal}
                    onChange={setLocalDailyGoal}
                    autoComplete="off"
                    prefix="$"
                  />
                ) : (
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Today's Recovered Sales
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        ${todayRevenue.toFixed(2)} / ${dailyGoal}
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
                          width: `${Math.min(parseFloat(goalProgress), 100)}%`,
                          backgroundColor:
                            parseFloat(goalProgress) >= 100
                              ? "var(--p-color-text-success)"
                              : "var(--p-color-bg-fill-magic)",
                          height: "100%",
                          transition: "width 0.5s",
                        }}
                      />
                    </div>
                  </BlockStack>
                )}
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
                  {isDev && (
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
            {/* ZONE HEALTH */}
            <ZoneHealthCard health={zoneHealth} />
            {/* EMAIL CONFIG */}
            <Card>
              <BlockStack gap="400">
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {isPro && (
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={MagicIcon} tone="magic" />
                      <Text as="h2" variant="headingMd">
                        {isPro
                          ? "AI Delivery Email Guidelines"
                          : "Recovery Email Copy"}
                      </Text>
                    </InlineStack>
                  )}
                </div>
                <Divider />
                {isPro && (
                  <Box
                    padding="200"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <Text as="p" variant="bodySm" tone="magic">
                      The AI will automatically append specific cart items and
                      delivery context to your message.
                    </Text>
                  </Box>
                )}
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

                {isPro ? (
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyMd">
                        Core Message / AI Prompt
                      </Text>
                      <Button
                        variant="primary"
                        tone="success"
                        icon={MagicIcon}
                        onClick={handleGeneratePrompt}
                        loading={isGeneratingPrompt}
                      >
                        Generate
                      </Button>
                    </InlineStack>
                    <TextField
                      label="Core Message / AI Prompt"
                      labelHidden
                      value={body}
                      placeholder={currentPlaceholder}
                      onChange={handleBodyChange}
                      multiline={5}
                      autoComplete="off"
                      helpText="Leave blank to use the template, or generate a custom message."
                    />
                  </BlockStack>
                ) : (
                  <TextField
                    label="Email Body"
                    value={body}
                    placeholder={currentPlaceholder}
                    onChange={handleBodyChange}
                    multiline={5}
                    autoComplete="off"
                    helpText="This exact text will be sent to the customer if cart recovery is enabled."
                  />
                )}

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
