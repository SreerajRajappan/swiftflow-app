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
  LocationIcon,
} from "@shopify/polaris-icons";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ZoneHealthCard } from "./ZoneHealthCard";
import type { ZoneHealth } from "~/services/zone-health.server";

interface RevenueSuiteProps {
  data: any;
  fetcher: any;
  totalRevenue: number;
  todayRevenue: number;
  todayChecks: number;
  dailyGoal: number;
  goalProgress: string;
  isEnabled: boolean;
  setIsEnabled: (val: boolean) => void;
  isSaving: boolean;
  handleToggle: () => void;
  totalViews: number;
  conversionRate: string;
  recentConversions: any[];
  recentChecks: any[];
  pendingRecoveries: any[];
  revenueChartData: { date: string; revenue: number; missed: number }[];
  funnelData: any[];
  heatmapData: any[];
  shop: string;
  onResetData: () => void;
  isPro: boolean;
  navigate: (path: string) => void;
  isDev: boolean;
  zoneHealth: ZoneHealth;
  shouldShowReviewNudge?: boolean;
  referralCode?: string;
  referralCount?: number;
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
  todayChecks,
  dailyGoal,
  goalProgress,
  isEnabled,
  isSaving,
  handleToggle,
  totalViews,
  conversionRate,
  recentConversions,
  recentChecks,
  pendingRecoveries,
  revenueChartData,
  funnelData,
  heatmapData,
  shop,
  onResetData,
  isPro,
  navigate,
  isDev,
  zoneHealth,
  shouldShowReviewNudge,
  referralCode,
  referralCount,
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
  const [wasLocalSaving, setWasLocalSaving] = useState(false);
  const [isChartMounted, setIsChartMounted] = useState(false);

  useEffect(() => {
    setIsChartMounted(true);
  }, []);

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

  const processedFunnelData = (funnelData || []).map((item, index) => {
    const fallbackColors = ["#c9cccf", "#9e52fa", "#ffc453", "#008060"];
    return { ...item, fill: fallbackColors[index % fallbackColors.length] };
  });

  return (
    <Box paddingBlockEnd="800">
      {/* 🚀 THE FIX: Global SVG override specifically protecting Recharts from Polaris */}
      <style>
        {`
          @keyframes scrollTicker {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          
          /* Override Shopify Polaris 20px SVG rule for Recharts elements */
          .recharts-wrapper svg,
          .recharts-surface {
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
        `}
      </style>

      <Layout>
        {/* --- SMART REVIEW NUDGE --- */}
        {shouldShowReviewNudge && (
          <Box paddingBlockEnd="400">
            <Banner
              title="You're recovering revenue! 🎉"
              tone="success"
              onDismiss={() => {
                const form = new FormData();
                form.append("intent", "dismiss-review");
                fetcher.submit(form, { method: "post" });
              }}
              action={{
                content: "Leave a Review",
                url: `https://apps.shopify.com/swiftflow-local-delivery/reviews/new`,
                onAction: () => {
                  const form = new FormData();
                  form.append("intent", "completed-review");
                  fetcher.submit(form, { method: "post" });
                },
              }}
            >
              <Text as="p">
                We noticed SwiftFlow has successfully recovered{" "}
                <strong>${totalRevenue.toFixed(2)}</strong> for your store! If
                our app is helping your local business grow, it would mean the
                world to us if you left a 5-star review on the Shopify App
                Store.
              </Text>
            </Banner>
          </Box>
        )}

        {recentChecks && recentChecks.length > 0 && (
          <Box>
            <div
              style={{
                backgroundColor: "var(--p-color-bg-surface-magic)",
                border: "1px solid var(--p-color-border-magic)",
                padding: "12px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <div
                style={{
                  paddingRight: "12px",
                  display: "flex",
                  alignItems: "center",
                  zIndex: 2,
                  backgroundColor: "var(--p-color-bg-surface-magic)",
                }}
              >
                <Icon source={LocationIcon} tone="magic" />
                <Text
                  as="span"
                  variant="bodyMd"
                  fontWeight="bold"
                  tone="magic"
                  truncate
                >
                  &nbsp;Live Local Feed:
                </Text>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    display: "inline-block",
                    animation: "scrollTicker 25s linear infinite",
                    color: "var(--p-color-text-magic)",
                  }}
                >
                  {recentChecks.map((check: any, i: number) => {
                    const city =
                      check.customerAddress?.split(",")[1]?.trim() ||
                      "your area";
                    return (
                      <span key={check.id} style={{ marginRight: "50px" }}>
                        🔥 Customer in <strong>{city}</strong> just checked
                        delivery eligibility ({check.distance?.toFixed(1)} miles
                        away)
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </Box>
        )}

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
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr",
                        gap: "var(--p-space-400)",
                      }}
                    >
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
                    </div>
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

                  <InlineStack
                    align="space-between"
                    blockAlign="center"
                    wrap={false}
                    gap="400"
                  >
                    <div style={{ flex: 1 }}>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Upgrade to Pro to unlock our autonomous AI agent. It
                        verifies customer locations against your delivery radius
                        and generates hyper-personalized, highly-converting
                        recovery emails while you sleep.
                      </Text>
                    </div>
                    <Button
                      onClick={() => navigate("/app/billing")}
                      variant="primary"
                      tone="success"
                    >
                      Upgrade to Pro & Capture Lost Revenue
                    </Button>
                  </InlineStack>
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
            <div id="revenue-suite-section" style={{ scrollMarginTop: "24px" }}>
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
                    {isEnabled
                      ? "Disable Revenue Suite"
                      : "Enable Revenue Suite"}
                  </Button>
                </BlockStack>
              </Card>
            </div>

            {/* 🚀 Premium 30-Day Revenue Area Chart */}
            {totalRevenue > 0 && (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Icon source={ChartVerticalIcon} tone="success" />
                      <Text as="h2" variant="headingMd">
                        30-Day Revenue Impact (Recovered vs. Missed)
                      </Text>
                    </InlineStack>
                  </InlineStack>

                  <div
                    style={{
                      height: 280,
                      width: "100%",
                      minWidth: 0,
                      marginTop: "16px",
                    }}
                  >
                    {isChartMounted ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={revenueChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="colorRecovered"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#008060"
                                stopOpacity={0.6}
                              />
                              <stop
                                offset="95%"
                                stopColor="#008060"
                                stopOpacity={0}
                              />
                            </linearGradient>
                            <linearGradient
                              id="colorMissed"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#d82c0d"
                                stopOpacity={0.15}
                              />
                              <stop
                                offset="95%"
                                stopColor="#d82c0d"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>

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
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid #c9cccf",
                              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                              backgroundColor: "#ffffff",
                            }}
                            formatter={(value: any, name: any) => {
                              const formattedValue = `$${Number(value || 0).toFixed(2)}`;
                              const safeName = String(name || "");
                              const label =
                                safeName.charAt(0).toUpperCase() +
                                safeName.slice(1);
                              return [formattedValue, label];
                            }}
                            labelStyle={{
                              color: "#6d7175",
                              marginBottom: "8px",
                              fontWeight: "bold",
                            }}
                          />

                          <Area
                            type="monotone"
                            dataKey="missed"
                            name="missed"
                            stroke="#d82c0d"
                            strokeWidth={2}
                            strokeOpacity={0.4}
                            fillOpacity={1}
                            fill="url(#colorMissed)"
                            activeDot={false}
                            isAnimationActive={false}
                          />

                          <Area
                            type="monotone"
                            dataKey="recovered"
                            name="recovered"
                            stroke="#008060"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRecovered)"
                            activeDot={{
                              r: 6,
                              fill: "#ffffff",
                              stroke: "#008060",
                              strokeWidth: 2,
                            }}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
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
                          Loading chart...
                        </Text>
                      </div>
                    )}
                  </div>
                </BlockStack>
              </Card>
            )}

            {/* 🚀 Advanced Insights Row (Funnel & Heatmap) */}
            {((funnelData && funnelData.length > 0) ||
              (heatmapData && heatmapData.length > 0)) && (
              <InlineGrid columns={2} gap="400">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Local Conversion Funnel
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Identify where local customers drop off to optimize
                      pricing.
                    </Text>

                    <div style={{ height: 260, width: "100%", minWidth: 0 }}>
                      {isChartMounted ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={processedFunnelData}
                            layout="vertical"
                            margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              horizontal={true}
                              vertical={false}
                              stroke="#e1e3e5"
                            />
                            <XAxis type="number" hide />
                            <YAxis
                              dataKey="name"
                              type="category"
                              axisLine={false}
                              tickLine={false}
                              tick={{
                                fill: "#202223",
                                fontSize: 12,
                                fontWeight: "bold",
                              }}
                              width={110}
                            />
                            <Tooltip
                              cursor={{ fill: "#f4f6f8" }}
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid #c9cccf",
                                backgroundColor: "#ffffff",
                              }}
                              formatter={(value: any) => [
                                Number(value || 0).toLocaleString(),
                                "Count",
                              ]}
                            />
                            <Bar
                              dataKey="value"
                              radius={[0, 4, 4, 0]}
                              barSize={32}
                              isAnimationActive={false}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text as="span" tone="subdued">
                            Loading funnel...
                          </Text>
                        </div>
                      )}
                    </div>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Delivery Demand Heatmap
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Days and times when local customers check delivery.
                    </Text>

                    <div style={{ height: 260, width: "100%", minWidth: 0 }}>
                      {isChartMounted ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart
                            margin={{
                              top: 10,
                              right: 10,
                              bottom: 10,
                              left: -20,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#e1e3e5"
                            />
                            <XAxis
                              type="number"
                              dataKey="hourIndex"
                              name="Hour"
                              domain={[0, 23]}
                              tickCount={12}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(val) =>
                                `${val % 12 === 0 ? 12 : val % 12}${val >= 12 ? "p" : "a"}`
                              }
                              tick={{ fill: "#6d7175", fontSize: 11 }}
                            />
                            <YAxis
                              type="number"
                              dataKey="dayIndex"
                              name="Day"
                              domain={[0, 6]}
                              tickCount={7}
                              reversed
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(val) =>
                                [
                                  "Sun",
                                  "Mon",
                                  "Tue",
                                  "Wed",
                                  "Thu",
                                  "Fri",
                                  "Sat",
                                ][val] || ""
                              }
                              tick={{
                                fill: "#202223",
                                fontSize: 12,
                                fontWeight: "bold",
                              }}
                            />
                            <ZAxis
                              type="number"
                              dataKey="value"
                              range={[30, 250]}
                              name="Checks"
                            />
                            <Tooltip
                              cursor={{
                                strokeDasharray: "3 3",
                                stroke: "#c9cccf",
                              }}
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid #c9cccf",
                                backgroundColor: "#ffffff",
                              }}
                              formatter={(value: any, name: any) => {
                                if (name === "Checks")
                                  return [value, "Total Checks"];
                                return [value, name];
                              }}
                              labelFormatter={() => ""}
                              content={({ payload }) => {
                                if (payload && payload.length > 0) {
                                  const data = payload[0].payload;
                                  return (
                                    <div
                                      style={{
                                        backgroundColor: "#ffffff",
                                        padding: "8px",
                                        border: "1px solid #c9cccf",
                                        borderRadius: "8px",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                      }}
                                    >
                                      <Text
                                        as="p"
                                        variant="bodySm"
                                        fontWeight="bold"
                                      >
                                        {data.dayName} at {data.hourLabel}
                                      </Text>
                                      <div
                                        style={{
                                          color: "#9e52fa",
                                          marginTop: "2px",
                                          fontSize: "13px",
                                        }}
                                      >
                                        {data.value} Delivery Checks
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Scatter
                              data={heatmapData}
                              fill="#9e52fa"
                              fillOpacity={0.8}
                              isAnimationActive={false}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      ) : (
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text as="span" tone="subdued">
                            Loading heatmap...
                          </Text>
                        </div>
                      )}
                    </div>
                  </BlockStack>
                </Card>
              </InlineGrid>
            )}

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

                <InlineGrid columns={4} gap="400">
                  <StatBox
                    label="Delivery Checks Today"
                    value={todayChecks.toLocaleString()}
                    icon={LocationIcon}
                    tone="magic"
                    color="var(--p-color-text-magic)"
                  />
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
                    label="Total Impressions"
                    value={totalViews.toLocaleString()}
                    icon={ViewIcon}
                    tone="base"
                    color="var(--p-color-text-secondary)"
                  />
                </InlineGrid>
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
                      <span suppressHydrationWarning>
                        {isChartMounted
                          ? new Date(conv.createdAt).toLocaleTimeString()
                          : new Date(conv.createdAt).toLocaleDateString()}
                      </span>
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

            {/* Manual Recovery Permalinks */}
            {pendingRecoveries && pendingRecoveries.length > 0 && (
              <Card padding="0">
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Pending VIP Carts (Manual Outreach)
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      The AI Agent already emailed these customers. Copy their
                      direct checkout link to text or DM them personally to
                      close the sale.
                    </Text>
                  </BlockStack>
                </Box>
                <IndexTable
                  resourceName={{ singular: "cart", plural: "carts" }}
                  itemCount={pendingRecoveries.length}
                  headings={[
                    { title: "Customer" },
                    { title: "Cart Value" },
                    { title: "Action", alignment: "end" },
                  ]}
                  selectable={false}
                >
                  {pendingRecoveries.map((cart, index) => (
                    <IndexTable.Row
                      id={cart.id.toString()}
                      key={cart.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd" fontWeight="bold">
                          {cart.customerEmail || "Unknown"}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        ${cart.cartValue?.toFixed(2)}
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <div style={{ textAlign: "right" }}>
                          <Button
                            size="micro"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                cart.abandonedCheckoutUrl,
                              );
                              shopify?.toast?.show(
                                "Checkout link copied to clipboard!",
                              );
                            }}
                          >
                            Copy Checkout Link
                          </Button>
                        </div>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </Card>
            )}
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

            {/* --- LOCAL REFERRAL ENGINE --- */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Refer a Local Merchant
                  </Text>
                  <Badge tone="success">Give $50, Get $50</Badge>
                </InlineStack>
                <Divider />

                <Text as="p" variant="bodySm" tone="subdued">
                  Know another local business (like a bakery or florist) that
                  could use SwiftFlow? Share your unique link. When they upgrade
                  to Pro, you both get a $50 credit applied to your Shopify
                  bill.
                </Text>

                {referralCode ? (
                  <BlockStack gap="200">
                    <TextField
                      label="Your Unique Referral Link"
                      value={`https://swiftflow.logiclooms.io/join?ref=${referralCode}`}
                      autoComplete="off"
                      readOnly
                      selectTextOnFocus
                      connectedRight={
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `https://swiftflow.logiclooms.io/join?ref=${referralCode}`,
                            );
                            shopify?.toast?.show("Link copied to clipboard!");
                          }}
                        >
                          Copy
                        </Button>
                      }
                    />
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm">
                        Successful Referrals:
                      </Text>
                      <Text as="span" variant="bodySm" fontWeight="bold">
                        {referralCount}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                ) : (
                  <Button
                    variant="primary"
                    loading={
                      fetcher.state === "submitting" &&
                      fetcher.formData?.get("intent") === "generate-referral"
                    }
                    onClick={() => {
                      const form = new FormData();
                      form.append("intent", "generate-referral");
                      fetcher.submit(form, { method: "post" });
                    }}
                  >
                    Generate My Referral Link
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
      width="100%"
    >
      <BlockStack gap="200" inlineAlign="center">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Box width="20px" minHeight="20px">
            <Icon source={icon} tone={tone} />
          </Box>
        </div>
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
