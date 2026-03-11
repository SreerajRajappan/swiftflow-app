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
import { Page, Tabs, Box, BlockStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
// import { fireTestEmail } from "~/agent.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "app/constants";

// Import your modularized tab components
import { PersonalizerTab } from "../components/PersonalizerTab";
import DeliveryTab from "../components/DeliveryTab";
import { RevenueSuiteTab } from "../components/RevenueSuiteTab";
import { InsightsTab } from "../components/InsightsTab";
import { RevenueLeaksTab } from "../components/RevenueLeaksTab";

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

const METRIC_COUNTRIES = [
  "CA",
  "GB",
  "AU",
  "FR",
  "DE",
  "NL",
  "SE",
  "NO",
  "DK",
  "FI",
  "JP",
  "IN",
  "BR",
  "MX",
];

// LOADER: Fetches all data for all tabs
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  // 🛑 TEMPORARY AI TEST: Inject a fake abandoned cart
  // await prisma.cartRecovery.upsert({
  //   where: { cartToken: "fake-ai-test-cart" },
  //   update: {
  //     updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Force it to be 2 hours old
  //     agentStatus: "IDLE",
  //     emailSent: false,
  //   },
  //   create: {
  //     shop,
  //     cartToken: "fake-ai-test-cart",
  //     customerEmail: "sreerajrajapan@gmail.com", // ⬅️ The AI will email you here
  //     inDeliveryZone: true,
  //     cartValue: 120.5,
  //     abTestVariant: "A",
  //     agentStatus: "IDLE",
  //     lineItems: [{ title: "Premium Widget" }, { title: "Super Fast Charger" }],
  //     createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  //     updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  //   },
  // });

  // await fireTestEmail("sreerajrajapan@gmail.com");

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

  // --- NEW INSIGHTS MATH (From Claude) ---
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

  // Fetch Active Revenue Leaks for the Dashboard
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
      if (loc.address.latitude && loc.address.longitude) {
        storeLat = loc.address.latitude;
        storeLng = loc.address.longitude;
      }
      storeAddress = [
        loc.address.address1,
        loc.address.city,
        loc.address.province,
      ]
        .filter(Boolean)
        .join(", ");

      if (!settings?.hasCustomizedRadius) {
        unitSystem = METRIC_COUNTRIES.includes(loc.address.countryCode)
          ? "METRIC"
          : "IMPERIAL";
      }
    }
  } catch (err) {
    locationWarning = !storeLat;
  }

  // Safely ensure settings exist AND return the updated settings object
  if (!settings) {
    // Safely ensure settings exist AND return the updated settings object via atomic upsert
    const defaultRadius = unitSystem === "METRIC" ? 10.0 : 6.0;
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
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    googleMapId: process.env.GOOGLE_MAP_ID ?? "",
    advancedStats,
  });
};

// ACTION: Handles settings updates and data resets securely via Intents
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  // 1. Reset Data Action
  if (intent === "reset_data") {
    await prisma.conversionEvent.deleteMany({ where: { shop } });
    return json({ success: true, message: "Data reset successfully" });
  }

  // 2. Map & Radius Save Action (Triggered specifically by DeliveryTab)
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

  // 3. Global Save Action (Triggered by the Top Bar Button)
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
  const isSaving = useNavigation().state === "submitting";
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);

  // Use the explicitly returned `settings` object to initialize state!
  const [fontSize, setFontSize] = useState(Number(settings?.fontSize) || 16);
  const [recoveryEmailEnabled, setrecoveryEmailEnabled] = useState(
    settings?.recoveryEmailEnabled || false,
  );
  const [customText, setCustomText] = useState(settings?.headerText || "");
  const [buttonText, setButtonText] = useState(
    settings?.buttonText || "Check Availability",
  );
  const [hexColor, setHexColor] = useState(settings?.headerColor || "#5c6ac4"); // <--- CHANGED
  const [isEnabled, setIsEnabled] = useState(
    settings?.revenueSuiteEnabled ?? true,
  );

  const handleTabChange = useCallback(
    (index: number) => setSelectedTab(index),
    [],
  );

  const tabs = [
    { id: "personalizer", content: "Personalizer" },
    { id: "delivery", content: "Delivery" },
    { id: "revenue", content: "Revenue Suite" },
    { id: "leaks", content: "Revenue Leaks" },
    { id: "insights", content: "Insights" },
  ];

  // The global save button now safely sends "save-global" intent
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

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    submit(
      {
        intent: "save-global",
        customText,
        customColor: hexColor, // <--- CHANGED
        buttonText, // <--- NEW
        isEnabled: String(newState),
      },
      { method: "POST" },
    );
  };

  useEffect(() => {
    if (parseFloat(goalProgress) >= 100 && selectedTab === 2) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  }, [goalProgress, selectedTab]);

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

  return (
    <Page title="SwiftFlow Admin">
      <TitleBar title="SwiftFlow: Revenue Suite">
        <button onClick={handleSave} variant="primary">
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </TitleBar>

      <BlockStack gap="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && (
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
              />
            )}
            {selectedTab === 3 && <RevenueLeaksTab leaks={activeLeaks} />}
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
