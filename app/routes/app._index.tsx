import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import confetti from "canvas-confetti";
import {
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { Page, Tabs, Box, BlockStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "app/constants";

// Import your modularized tab components
import { PersonalizerTab } from "../components/PersonalizerTab";
import { DeliveryTab } from "../components/DeliveryTab";
import { RevenueSuiteTab } from "../components/RevenueSuiteTab";
import { InsightsTab } from "../components/InsightsTab";

// Utility: HEX to HSB (Kept in main file as it is a helper for state)
function hexToHsb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((s) => s + s)
      .join("");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max === 0 ? 0 : delta / max, brightness: max };
}

// LOADER: Fetches all data for all tabs
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const shopResponse = await admin.graphql(
    `#graphql
  query getShopLocation {
    locations(first: 10) { 
      nodes {
        name
        address {
          countryCode
        }
      }
    }
  }`,
  );
  const shopJson = await shopResponse.json();
  const locationNodes = shopJson.data?.locations?.nodes || [];
  const primaryLocation =
    locationNodes.find((node: any) => node.name === "Shop location") ||
    locationNodes[0];

  const countryCode = primaryLocation?.address?.countryCode;
  const unit = ["US", "MM", "LR"].includes(countryCode) ? "miles" : "km";

  const billingCheck = await billing.check({
    plans: [MONTHLY_PLAN_PRO, MONTHLY_PLAN_BASIC],
    isTest: true,
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );
  const isPro = subscription?.name === MONTHLY_PLAN_PRO;

  const settings = await prisma.appSettings.findUnique({ where: { shop } });
  const totalViews = await prisma.productView.count({ where: { shop } });

  const conversionData = await prisma.conversion.aggregate({
    _sum: { amount: true },
    _count: { id: true },
  });

  const totalRevenue = conversionData._sum.amount || 0;
  const conversionCount = conversionData._count.id || 0;
  const dailyGoal = 500;
  const goalProgress = (totalRevenue / dailyGoal) * 100;
  const conversionRate =
    totalViews > 0 ? ((conversionCount / totalViews) * 100).toFixed(2) : "0.00";

  const recentConversions = await prisma.conversion.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // 4. Trending Products Enrichment
  const trendingData = await prisma.productView.groupBy({
    by: ["productId"],
    where: { shop },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 5,
  });

  const enrichedProducts = await Promise.all(
    trendingData.map(async (item) => {
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

        const salesForProduct = await prisma.conversion.aggregate({
          where: { productId: item.productId },
          _sum: { amount: true },
        });
        return {
          ...item,
          title: product?.title || "Unknown Product",
          image: product?.featuredMedia?.preview?.image?.url || "",
          revenue: salesForProduct._sum.amount || 0,
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

  const response = await admin.graphql(
    `#graphql
    query getActiveFulfillmentLocation {
      locations(first: 10, query: "ships_inventory:true") {
        nodes {
          name
          shipsInventory
          address {
            latitude
            longitude
          }
        }
      }
    }
  `,
  );

  const data = await response.json();
  const locations = data.data.locations.nodes;

  // Manually find the first node where shipsInventory is true
  const activeHub = locations.find((node: any) => node.shipsInventory === true);
  console.log("activeHub: ", activeHub);

  const lat = activeHub?.address?.latitude ?? 34.0549;
  const lng = activeHub?.address?.longitude ?? -118.2437;

  return {
    shop,
    settings,
    totalViews,
    totalRevenue,
    conversionRate,
    recentConversions,
    dailyGoal,
    goalProgress: Math.min(goalProgress, 100).toFixed(0),
    trendingProducts: enrichedProducts,
    isPro,
    trialDaysLeft,
    unit,
    googleMapsApiKey: process.env.SHOPIFY_GOOGLE_MAPS_KEY,
    googleMapId: process.env.SHOPIFY_MAP_ID,
    shopCoordinates: { lat, lng },
  };
};

// ACTION: Handles settings updates and data resets
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  if (formData.get("intent") === "reset_data") {
    await prisma.conversion.deleteMany({});
    return { success: true, message: "Data reset successfully" };
  }

  const customText = formData.get("customText") as string;
  const customColor = formData.get("customColor") as string;
  const isEnabled = formData.get("isEnabled") === "true";
  const fontSize = Number(formData.get("fontSize")) || 16;
  const deliveryRadius = parseFloat(formData.get("deliveryRadius") as string);
  const recoveryEnabled = formData.get("recoveryEnabled") === "true";

  const storeLat = parseFloat(formData.get("storeLat") as string);
  const storeLng = parseFloat(formData.get("storeLng") as string);

  await prisma.appSettings.upsert({
    where: { shop },
    update: {
      customText,
      customColor,
      isEnabled,
      fontSize,
      deliveryRadius,
      recoveryEnabled,
      hasCustomizedRadius: true,
      storeLat,
      storeLng,
    },
    create: {
      shop,
      customText,
      customColor,
      isEnabled,
      fontSize,
      deliveryRadius,
      recoveryEnabled,
      hasCustomizedRadius: true,
      storeLat,
      storeLng,
    },
  });

  return { success: true };
};

export default function Index() {
  const shopify = useAppBridge();
  const {
    shop,
    settings,
    totalViews,
    trendingProducts,
    isPro,
    trialDaysLeft,
    totalRevenue,
    conversionRate,
    dailyGoal,
    goalProgress,
    recentConversions,
    unit,
    googleMapsApiKey,
    googleMapId,
    shopCoordinates,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const isSaving = useNavigation().state === "submitting";
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);
  const [fontSize, setFontSize] = useState(settings?.fontSize || 16);
  const [deliveryRadius, setDeliveryRadius] = useState(() => {
    if (settings?.hasCustomizedRadius) {
      return Number(settings.deliveryRadius);
    }

    return unit === "miles" ? 6 : 10;
  });
  const [recoveryEnabled, setRecoveryEnabled] = useState(
    settings?.recoveryEnabled || false,
  );
  const handleTabChange = useCallback(
    (index: number) => setSelectedTab(index),
    [],
  );

  const [customText, setCustomText] = useState(settings?.customText || "");
  const [color, setColor] = useState(
    hexToHsb(settings?.customColor || "#5c6ac4"),
  );
  const [isEnabled, setIsEnabled] = useState(settings?.isEnabled ?? true);

  const tabs = [
    { id: "personalizer", content: "Personalizer" },
    { id: "delivery", content: "Delivery" },
    { id: "revenue", content: "Revenue Suite" },
    { id: "insights", content: "Insights" },
  ];

  const handleSave = () => {
    submit(
      {
        customText,
        customColor: hsbToHex(color),
        isEnabled: String(isEnabled),
        fontSize: String(fontSize),
        deliveryRadius: String(deliveryRadius),
        recoveryEnabled: String(recoveryEnabled),
        storeLat: String(shopCoordinates.lat),
        storeLng: String(shopCoordinates.lng),
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
      { customText, customColor: hsbToHex(color), isEnabled: String(newState) },
      { method: "POST" },
    );
  };

  // Confetti & Toast Effects
  useEffect(() => {
    if (parseFloat(goalProgress) >= 100 && selectedTab === 2) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  }, [goalProgress, selectedTab]);

  useEffect(() => {
    if (actionData?.success) {
      const message =
        "message" in actionData
          ? actionData.message
          : "Settings saved successfully";
      shopify?.toast?.show(message as string, { duration: 3000 });
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
                color={color}
                setColor={setColor}
                hexColor={hsbToHex(color)}
                handleSave={handleSave}
                navigate={navigate}
                fontSize={fontSize}
                setFontSize={setFontSize}
              />
            )}
            {selectedTab === 1 && (
              <DeliveryTab
                isPro={isPro}
                deliveryRadius={deliveryRadius}
                setDeliveryRadius={setDeliveryRadius}
                recoveryEnabled={recoveryEnabled}
                setRecoveryEnabled={setRecoveryEnabled}
                isSaving={isSaving}
                unit={unit as "miles" | "km"}
                handleSave={handleSave}
                navigate={navigate}
                googleMapsApiKey={googleMapsApiKey ?? ""}
                googleMapId={googleMapId ?? ""}
                shopCoordinates={
                  shopCoordinates as { lat: number; lng: number }
                }
              />
            )}
            {selectedTab === 2 && (
              <RevenueSuiteTab
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
            {selectedTab === 3 && (
              <InsightsTab isPro={isPro} trendingProducts={trendingProducts} />
            )}
          </Box>
        </Tabs>
      </BlockStack>
    </Page>
  );
}

// Helper needed for the TitleBar/Action buttons
function hsbToHex(color: {
  hue: number;
  saturation: number;
  brightness: number;
}) {
  const { hue, saturation, brightness } = color;
  const chroma = brightness * saturation;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const m = brightness - chroma;
  let r = 0,
    g = 0,
    b = 0;
  if (huePrime >= 0 && huePrime < 1) {
    r = chroma;
    g = x;
  } else if (huePrime >= 1 && huePrime < 2) {
    r = x;
    g = chroma;
  } else if (huePrime >= 2 && huePrime < 3) {
    g = chroma;
    b = x;
  } else if (huePrime >= 3 && huePrime < 4) {
    g = x;
    b = chroma;
  } else if (huePrime >= 4 && huePrime < 5) {
    r = x;
    b = chroma;
  } else if (huePrime >= 5 && huePrime < 6) {
    r = chroma;
    b = x;
  }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
