import { useState, useCallback, useEffect, useRef } from "react";
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

  const totalRevenue = conversionData._sum.orderValue || 0;
  const conversionCount = conversionData._count.id || 0;
  const dailyGoal = 500;
  const goalProgress = (totalRevenue / dailyGoal) * 100;
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

  // Inside app/routes/app._index.tsx Loader
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
    conversionRate,
    dailyGoal,
    goalProgress,
    recentConversions,
  } = data;

  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const deliveryFetcher = useFetcher();
  const aiFetcher = useFetcher<typeof action>();
  const isSaving = useNavigation().state === "submitting";
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);

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
    { id: "personalizer", content: "Personalizer" },
    { id: "leaks", content: "Revenue Leaks" },
    { id: "insights", content: "Insights" },
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

  const lastCelebratedRevenue = useRef(0);

  useEffect(() => {
    // Only fire if goal is met, we are on the Home tab, AND the revenue has increased since the last celebration
    if (
      parseFloat(goalProgress) >= 100 &&
      selectedTab === 0 &&
      totalRevenue > lastCelebratedRevenue.current
    ) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      lastCelebratedRevenue.current = totalRevenue;
    }
  }, [goalProgress, selectedTab, totalRevenue]);

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

        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && (
              <RevenueSuiteTab
                data={settings}
                fetcher={deliveryFetcher}
                totalRevenue={totalRevenue}
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
            {selectedTab === 3 && (
              <RevenueLeaksTab
                leaks={activeLeaks}
                onRunScan={handleRunScan}
                isScanning={aiFetcher.state === "submitting"}
                isPro={isPro}
                navigate={navigate}
              />
            )}
            {selectedTab === 4 && (
              <InsightsTab
                isPro={isPro}
                trendingProducts={trendingProducts}
                recentConversions={recentConversions}
                stats={data.advancedStats}
              />
            )}
          </Box>
        </Tabs>
      </BlockStack>
    </Page>
  );
}
