import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import confetti from "canvas-confetti";
import {
  json,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
  useFetcher,
} from "@remix-run/react";
import { Page, Tabs, Box, BlockStack, Banner, Text } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "app/constants";

import { PersonalizerTab } from "../components/PersonalizerTab";
import DeliveryTab from "../components/DeliveryTab";
import { RevenueSuiteTab } from "../components/RevenueSuiteTab";
import { InsightsTab } from "../components/InsightsTab";
import { RevenueLeaksTab } from "../components/RevenueLeaksTab";
import { processAbandonedCarts } from "../services/email.server";
import { runCartRecoveryAgent } from "../agent.server";
import { geocodeAddress } from "~/services/geocoding.server";
import OpenAI from "openai";

const LOCATION_QUERY = `#graphql
  query GetPrimaryLocation {
    locations(first: 1) {
      edges {
        node {
          name
          address { address1, city, province, countryCode, latitude, longitude }
        }
      }
    }
  }
`;

// const METRIC_COUNTRIES = [
//   "CA",
//   "GB",
//   "AU",
//   "FR",
//   "DE",
//   "NL",
//   "SE",
//   "NO",
//   "DK",
//   "FI",
//   "JP",
//   "IN",
//   "BR",
//   "MX",
// ];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const billingCheck = await billing.check({
    plans: [MONTHLY_PLAN_PRO, MONTHLY_PLAN_BASIC],
    isTest: true,
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );
  const isPro = subscription?.name === MONTHLY_PLAN_PRO;

  let settings = await prisma.appSettings.findUnique({ where: { shop } });
  const totalViews = await prisma.productView.count({ where: { shop } });

  const conversionData = await prisma.conversionEvent.aggregate({
    _sum: { orderValue: true },
    _count: { id: true },
  });

  // 1. All-time revenue for the Stat Box
  const totalRevenue = conversionData._sum.orderValue || 0;
  const conversionCount = conversionData._count.id || 0;

  // 2. Calculate Today's Revenue for the Daily Goal
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaysConversions = await prisma.conversionEvent.findMany({
    where: {
      shop,
      createdAt: { gte: startOfToday },
    },
  });

  const todayRevenue = todaysConversions.reduce(
    (sum, conv) => sum + conv.orderValue,
    0,
  );

  // 3. Get the Daily Goal (allow merchant custom setting, default to 500)
  const dailyGoal = settings?.dailyGoal || 500;
  const goalProgress = (todayRevenue / dailyGoal) * 100;
  const conversionRate =
    totalViews > 0 ? ((conversionCount / totalViews) * 100).toFixed(2) : "0.00";

  const recentConversions = await prisma.conversionEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allConversions = await prisma.conversionEvent.findMany({
    where: { shop, createdAt: { gte: last30Days } },
  });
  const badgeConversions = allConversions.filter(
    (c) => c.source === "delivery_badge",
  );
  const recoveryConversions = allConversions.filter(
    (c) => c.source === "cart_recovery",
  );

  const allChecks = await prisma.deliveryCheck.findMany({
    where: { shop, timestamp: { gte: last30Days } },
  });
  const inRadiusCount = allChecks.filter((c) => c.inRadius).length;

  const cartRecoveries = await prisma.cartRecovery.findMany({
    where: { shop },
  });
  const emailsSent = cartRecoveries.filter((c) => c.emailSent).length;
  const recovered = cartRecoveries.filter(
    (c) => c.recovered && c.recoveredAt && c.recoveredAt >= last30Days,
  );

  const advancedStats = {
    todayRevenue,
    totalRevenue: allConversions.reduce((s, c) => s + c.orderValue, 0),
    totalOrders: allConversions.length,
    badgeRevenue: badgeConversions.reduce((s, c) => s + c.orderValue, 0),
    badgeOrders: badgeConversions.length,
    recoveryRevenue: recoveryConversions.reduce((s, c) => s + c.orderValue, 0),
    recoveryOrders: recoveryConversions.length,
    totalChecks: allChecks.length,
    inRadiusCount,
    conversionRate:
      allChecks.length > 0 ? (inRadiusCount / allChecks.length) * 100 : 0,
    emailsSent,
    recoveredCount: recovered.length,
    recoveredRevenue: recovered.reduce((s, c) => s + (c.recoveryValue ?? 0), 0),
    recoveryRate: emailsSent > 0 ? (recovered.length / emailsSent) * 100 : 0,
    status: "Test fired! Check your terminal and inbox.",
  };

  const activeLeaks = await prisma.revenueLeak.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const trendingData = await prisma.productView.groupBy({
    by: ["productId"],
    where: { shop },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 5,
  });

  const enrichedProducts = await Promise.all(
    trendingData.map(async (item: any) => {
      try {
        const response = await admin.graphql(
          `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              title
              featuredMedia { preview { image { url } } }
            }
          }`,
          { variables: { id: item.productId } },
        );
        const responseJson = await response.json();
        const product = responseJson.data?.product;

        return {
          ...item,
          title: product?.title || "Unknown Product",
          image: product?.featuredMedia?.preview?.image?.url || "",
          revenue: 0,
        };
      } catch (e) {
        return { ...item, title: "Product Deleted", image: "", revenue: 0 };
      }
    }),
  );

  let trialDaysLeft = 0;
  if (subscription && subscription.trialDays) {
    const createdAt = new Date(subscription.createdAt);
    const trialLength = subscription.trialDays;
    const now = new Date();
    const diffInMs = now.getTime() - createdAt.getTime();
    const daysPassed = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, trialLength - daysPassed);
  }

  // Auto-detect store location
  let storeLat = settings?.storeLat ?? null;
  let storeLng = settings?.storeLng ?? null;
  let storeAddress = settings?.storeAddress ?? null;
  let unitSystem = settings?.unitSystem ?? "IMPERIAL";
  let locationWarning = false;

  try {
    const res = await admin.graphql(LOCATION_QUERY);
    const body = await res.json();
    const loc = body.data?.locations?.edges?.[0]?.node;

    if (loc) {
      storeAddress = [
        loc.address.address1,
        loc.address.city,
        loc.address.province,
        loc.address.zip,
        loc.address.countryCode,
      ]
        .filter(Boolean)
        .join(", ");

      console.log("loc.address: ", loc.address);

      if (!loc.address.latitude || !loc.address.longitude) {
        console.log("📍 Lat/Lng missing from Shopify, geocoding address...");
        console.log("storeAddress: ", storeAddress);
        const coords = await geocodeAddress(storeAddress);
        if (coords) {
          storeLat = coords.lat;
          storeLng = coords.lng;
        }
      } else {
        storeLat = loc.address.latitude;
        storeLng = loc.address.longitude;
      }

      // Default to Miles for US
      if (!settings?.hasCustomizedRadius) {
        unitSystem = loc.address.countryCode === "US" ? "IMPERIAL" : "METRIC";
      }
    }
  } catch (err) {
    console.error("Location Fetch Error:", err);
  }

  if (!settings) {
    const defaultRadius = unitSystem === "IMPERIAL" ? 6.0 : 10.0;
    settings = await prisma.appSettings.upsert({
      where: { shop },
      create: {
        shop,
        deliveryRadius: defaultRadius,
        unitSystem,
        storeLat,
        storeLng,
        storeAddress,
      },
      update:
        storeLat && storeLng
          ? {
              storeLat,
              storeLng,
              storeAddress,
              unitSystem,
            }
          : {},
    });
  } else if (storeLat && storeLng) {
    settings = await prisma.appSettings.update({
      where: { shop },
      data: { storeLat, storeLng, storeAddress, unitSystem },
    });
  }

  return json({
    settings,
    shop,
    totalViews,
    totalRevenue,
    todayRevenue,
    activeLeaks,
    conversionRate,
    recentConversions,
    dailyGoal,
    goalProgress: Math.min(goalProgress, 100).toFixed(0),
    trendingProducts: enrichedProducts,
    isPro,
    trialDaysLeft,
    storeLat,
    storeLng,
    storeAddress,
    unitSystem,
    locationWarning,
    googleMapsApiKey: process.env.SHOPIFY_GOOGLE_MAPS_KEY ?? "",
    googleMapId: process.env.SHOPIFY_MAP_ID ?? "",
    advancedStats,
    isDev: process.env.NODE_ENV === "development",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "reset_data") {
    await prisma.conversionEvent.deleteMany({ where: { shop } });
    return json({ success: true, message: "Data reset successfully" });
  }

  if (intent === "save-delivery") {
    const deliveryRadius = parseFloat(formData.get("deliveryRadius") as string);
    const unitSystem = formData.get("unitSystem") as string;
    const recoveryEmailEnabled =
      formData.get("recoveryEmailEnabled") === "true";

    if (isNaN(deliveryRadius) || deliveryRadius <= 0) {
      return json({ error: "Invalid radius", intent }, { status: 400 });
    }

    await prisma.appSettings.update({
      where: { shop },
      data: {
        deliveryRadius,
        unitSystem,
        hasCustomizedRadius: true,
        recoveryEmailEnabled,
      },
    });

    return json({ success: true, intent });
  }

  if (intent === "save-global") {
    const customText = formData.get("customText") as string;
    const customColor = formData.get("customColor") as string;
    const buttonText = formData.get("buttonText") as string;
    const isEnabled = formData.get("isEnabled") === "true";
    const fontSize = String(formData.get("fontSize") || "16");
    const recoveryEmailEnabled =
      formData.get("recoveryEmailEnabled") === "true";

    await prisma.appSettings.update({
      where: { shop },
      data: {
        headerText: customText,
        headerColor: customColor,
        buttonText: buttonText,
        revenueSuiteEnabled: isEnabled,
        fontSize,
        recoveryEmailEnabled,
      },
    });

    return json({
      success: true,
      intent: "save-global",
      message: "Global settings saved",
    });
  }

  if (intent === "run-ai-agent") {
    try {
      console.log("⚡ Merchant manually triggered AI Agent");
      await processAbandonedCarts(shop);
      await runCartRecoveryAgent(shop);

      return json({
        success: true,
        intent: "run-ai-agent",
        message: "AI Scan Complete: Check Active Leaks table!",
      });
    } catch (error) {
      console.error("Manual AI Trigger Failed:", error);
      return json({ error: "AI Scan encountered an error" }, { status: 500 });
    }
  }

  if (intent === "save-suite-config") {
    const subject = formData.get("recoveryEmailSubject") as string;
    const body = formData.get("recoveryEmailBody") as string;
    const newGoal = parseFloat(formData.get("dailyGoal") as string) || 500;

    const abTestEnabled = formData.get("abTestEnabled") === "true";
    const abTestMessageA = formData.get("abTestMessageA") as string;
    const abTestMessageB = formData.get("abTestMessageB") as string;

    await prisma.appSettings.upsert({
      where: { shop },
      create: {
        shop,
        recoveryEmailSubject: subject,
        recoveryEmailBody: body,
        dailyGoal: newGoal,
        abTestEnabled,
        abTestMessageA,
        abTestMessageB,
      },
      update: {
        recoveryEmailSubject: subject,
        recoveryEmailBody: body,
        dailyGoal: newGoal,
        abTestEnabled,
        abTestMessageA,
        abTestMessageB,
      },
    });

    return json({
      success: true,
      intent: "save-suite-config",
      message: "Revenue Suite configuration saved!",
    });
  }

  if (intent === "generate-ai-prompt") {
    const theme = formData.get("templateTheme") || "neighborhood";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const promptInstructions = `
      You are an expert e-commerce copywriter for a local business.
      The merchant selected the "${theme}" theme for local delivery abandoned carts.
      
      Write a highly converting, brief 1-to-2 sentence email body that the merchant can use as their base message.
      It MUST be concise (under 25 words).
      It should sound like it's written directly to the customer, emphasizing local delivery and convenience.
      Do NOT include subject lines, greetings, or placeholders. Ensure perfect spelling and grammar.
      Just write the raw email text directly.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: promptInstructions }],
        temperature: 0.7,
      });

      return json({
        success: true,
        generatedPrompt: response.choices[0].message.content?.trim(),
      });
    } catch (error) {
      console.error("AI Generation Error:", error);
      return json(
        { success: false, error: "Failed to generate prompt" },
        { status: 500 },
      );
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function Index() {
  const shopify = useAppBridge();
  const data = useLoaderData<typeof loader>();
  const {
    shop,
    settings,
    totalViews,
    activeLeaks,
    trendingProducts,
    isPro,
    trialDaysLeft,
    totalRevenue,
    todayRevenue,
    conversionRate,
    dailyGoal,
    goalProgress,
    recentConversions,
    isDev,
  } = data;

  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const deliveryFetcher = useFetcher();
  const aiFetcher = useFetcher<typeof action>();
  const isSaving = useNavigation().state === "submitting";
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [fontSize, setFontSize] = useState(Number(settings?.fontSize) || 16);
  const [recoveryEmailEnabled, setrecoveryEmailEnabled] = useState(
    settings?.recoveryEmailEnabled || false,
  );
  const [customText, setCustomText] = useState(settings?.headerText || "");
  const [buttonText, setButtonText] = useState(
    settings?.buttonText || "Check Availability",
  );
  const [hexColor, setHexColor] = useState(settings?.headerColor || "#5c6ac4");
  const [isEnabled, setIsEnabled] = useState(
    settings?.revenueSuiteEnabled ?? true,
  );

  const handleTabChange = useCallback(
    (index: number) => setSelectedTab(index),
    [],
  );

  const tabs = [
    { id: "revenue", content: "Revenue Suite" },
    { id: "delivery", content: "Delivery" },
    { id: "leaks", content: "Revenue Leaks" },
    { id: "insights", content: "Insights" },
    { id: "personalizer", content: "Personalizer" },
  ];

  const handleSave = () => {
    submit(
      {
        intent: "save-global",
        customText,
        customColor: hexColor,
        buttonText,
        isEnabled: String(isEnabled),
        fontSize: String(fontSize),
        recoveryEmailEnabled: String(recoveryEmailEnabled),
      },
      { method: "POST" },
    );
  };

  const onResetData = () => {
    if (confirm("DEV ONLY: Permanently delete conversion data?")) {
      submit({ intent: "reset_data" }, { method: "POST" });
    }
  };

  const handleRunScan = () => {
    aiFetcher.submit({ intent: "run-ai-agent" }, { method: "POST" });
  };

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    submit(
      {
        intent: "save-global",
        customText,
        customColor: hexColor,
        buttonText,
        isEnabled: String(newState),
      },
      { method: "POST" },
    );
  };

  useEffect(() => {
    // Only fire if goal is met AND we haven't already celebrated today in this browser session
    const hasCelebratedToday = sessionStorage.getItem(
      `celebrated_${dailyGoal}`,
    );

    if (
      parseFloat(goalProgress) >= 100 &&
      selectedTab === 0 &&
      !hasCelebratedToday
    ) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      sessionStorage.setItem(`celebrated_${dailyGoal}`, "true");
    }

    // If they change their goal to a higher amount, reset the celebration flag
    if (parseFloat(goalProgress) < 100) {
      sessionStorage.removeItem(`celebrated_${dailyGoal}`);
    }
  }, [goalProgress, selectedTab, dailyGoal]);

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      const message =
        "message" in actionData
          ? actionData.message
          : "Settings saved successfully";
      shopify?.toast?.show(message as string, { duration: 3000 });
    } else if (actionData && "error" in actionData) {
      shopify?.toast?.show(String(actionData.error), {
        duration: 3000,
        isError: true,
      });
    }
  }, [actionData, shopify]);

  useEffect(() => {
    const aiData = aiFetcher.data as
      | {
          success?: boolean;
          error?: string;
          message?: string;
        }
      | undefined;

    if (aiData?.success) {
      shopify?.toast?.show(aiData.message || "AI Scan Complete!", {
        duration: 3000,
      });
    } else if (aiData?.error) {
      shopify?.toast?.show(aiData.error, {
        duration: 3000,
        isError: true,
      });
    }
  }, [aiFetcher.data, shopify]);

  return (
    <Page title="SwiftFlow: Local Cart Recovery">
      <TitleBar title="SwiftFlow: Local Cart Recovery">
        <button onClick={handleSave} variant="primary">
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </TitleBar>

      <BlockStack gap="400">
        {/* 👇 UPDATED GLOBAL SMART BANNER 👇 */}
        {isPro ? (
          trialDaysLeft > 0 ? (
            <Banner tone="success">
              <Text as="p">
                <strong>Pro Suite Active:</strong> Your AI Cart Recovery Agent
                is monitoring local drop-offs. You have{" "}
                <strong>{trialDaysLeft} days</strong> remaining in your free
                trial.
              </Text>
            </Banner>
          ) : null
        ) : (
          <Banner
            tone="info"
            action={{ content: "Upgrade to Pro", url: "/app/billing" }}
          >
            <Text as="p">
              <strong>Basic Plan Active:</strong>{" "}
              {trialDaysLeft > 0 &&
                `You have ${trialDaysLeft} days remaining in your free trial. `}
              Upgrade to Pro to unlock Autonomous AI Emails and unlimited
              recovered revenue.
            </Text>
          </Banner>
        )}

        {isMounted && (
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box paddingBlockStart="400">
              {selectedTab === 0 && (
                <RevenueSuiteTab
                  data={settings}
                  fetcher={deliveryFetcher}
                  totalRevenue={totalRevenue}
                  todayRevenue={todayRevenue}
                  dailyGoal={dailyGoal}
                  goalProgress={goalProgress}
                  isEnabled={isEnabled}
                  setIsEnabled={setIsEnabled}
                  isSaving={isSaving}
                  handleToggle={handleToggle}
                  totalViews={totalViews}
                  conversionRate={conversionRate}
                  recentConversions={recentConversions}
                  shop={shop}
                  onResetData={onResetData}
                  isPro={isPro}
                  navigate={navigate}
                  isDev={isDev}
                />
              )}
              {selectedTab === 1 && (
                <DeliveryTab
                  isPro={isPro}
                  data={data}
                  fetcher={deliveryFetcher}
                  recoveryEmailEnabled={recoveryEmailEnabled}
                  setrecoveryEmailEnabled={setrecoveryEmailEnabled}
                />
              )}
              {selectedTab === 2 && (
                <RevenueLeaksTab
                  leaks={activeLeaks}
                  onRunScan={handleRunScan}
                  isScanning={aiFetcher.state === "submitting"}
                  isPro={isPro}
                  navigate={navigate}
                />
              )}
              {selectedTab === 3 && (
                <InsightsTab
                  isPro={isPro}
                  trendingProducts={trendingProducts}
                  recentConversions={recentConversions}
                  stats={data.advancedStats}
                />
              )}
              {selectedTab === 4 && (
                <PersonalizerTab
                  isPro={isPro}
                  trialDaysLeft={trialDaysLeft}
                  isSaving={isSaving}
                  customText={customText}
                  setCustomText={setCustomText}
                  buttonText={buttonText}
                  setButtonText={setButtonText}
                  hexColor={hexColor}
                  setHexColor={setHexColor}
                  handleSave={handleSave}
                  navigate={navigate}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                />
              )}
            </Box>
          </Tabs>
        )}
      </BlockStack>
    </Page>
  );
}
