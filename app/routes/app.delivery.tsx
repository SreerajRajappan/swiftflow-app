import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Page, BlockStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ALL_PAID_PLANS, PRO_PLANS, ELITE_PLANS } from "../constants";
import DeliveryTab from "../components/DeliveryTab";
import { geocodeAddress } from "../services/geocoding.server";

const LOCATION_QUERY = `#graphql
  query GetPrimaryLocation {
    locations(first: 1) {
      edges {
        node {
          name
          address { address1, city, province, countryCode, latitude, longitude, zip }
        }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const planCheckArray: any = ALL_PAID_PLANS;

  const billingCheck = await billing.check({
    plans: planCheckArray,
    isTest: true,
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );

  const activePlanName = subscription?.name || "";
  const isPro =
    PRO_PLANS.includes(activePlanName) || ELITE_PLANS.includes(activePlanName);

  let settings = await prisma.appSettings.findUnique({ where: { shop } });

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

      if (!loc.address.latitude || !loc.address.longitude) {
        console.log("📍 Lat/Lng missing from Shopify, geocoding address...");
        const coords = await geocodeAddress(storeAddress);
        if (coords) {
          storeLat = coords.lat;
          storeLng = coords.lng;
        } else {
          locationWarning = true;
        }
      } else {
        storeLat = loc.address.latitude;
        storeLng = loc.address.longitude;
      }

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
    isPro,
    storeLat,
    storeLng,
    storeAddress,
    unitSystem,
    locationWarning,
    googleMapsApiKey: process.env.SHOPIFY_GOOGLE_MAPS_KEY ?? "",
    googleMapId: process.env.SHOPIFY_MAP_ID ?? "",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

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

    return json({ success: true, intent, message: "Delivery zone saved!" });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function DeliveryRoute() {
  const shopify = useAppBridge();
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [recoveryEmailEnabled, setrecoveryEmailEnabled] = useState(
    data.settings?.recoveryEmailEnabled || false,
  );

  useEffect(() => {
    if (fetcher.data && (fetcher.data as any).success) {
      shopify?.toast?.show(
        (fetcher.data as any).message || "Settings saved successfully",
      );
    } else if (fetcher.data && (fetcher.data as any).error) {
      shopify?.toast?.show(String((fetcher.data as any).error), {
        isError: true,
      });
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="Delivery Zone Configuration">
      <TitleBar title="Delivery Zone Configuration" />
      <BlockStack gap="400">
        <DeliveryTab
          isPro={data.isPro}
          data={data}
          fetcher={fetcher}
          recoveryEmailEnabled={recoveryEmailEnabled}
          setrecoveryEmailEnabled={setrecoveryEmailEnabled}
        />
      </BlockStack>
    </Page>
  );
}
