import { useState, useEffect, useRef, useCallback } from "react";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  RangeSlider,
  Select,
  Button,
  Banner,
  Badge,
  Box,
  Spinner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { geocodeAddress } from "../services/geocoding.server";

const LOCATION_QUERY = `#graphql
  query GetPrimaryLocation {
    locations(first: 1) {
      edges {
        node {
          name
          address {
            address1
            city
            province
            countryCode
            latitude
            longitude
          }
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

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await db.appSettings.findFirst({ where: { shop } });

  let storeLat: number | null = settings?.storeLat ?? null;
  let storeLng: number | null = settings?.storeLng ?? null;
  let storeAddress: string | null = settings?.storeAddress ?? null;
  let unitSystem = settings?.unitSystem ?? "IMPERIAL";
  let locationWarning = false;

  // Always try to refresh coordinates from Shopify
  try {
    const res = await admin.graphql(LOCATION_QUERY);
    const body = (await res.json()) as {
      data: {
        locations: {
          edges: Array<{
            node: {
              name: string;
              address: {
                address1: string;
                city: string;
                province: string;
                countryCode: string;
                latitude: number | null;
                longitude: number | null;
              };
            };
          }>;
        };
      };
    };

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

      // Auto-detect unit system
      if (!settings?.hasCustomizedRadius) {
        unitSystem = METRIC_COUNTRIES.includes(loc.address.countryCode)
          ? "METRIC"
          : "IMPERIAL";
      }

      // Fallback geocoding if Shopify has no coordinates
      if (!storeLat || !storeLng) {
        const geocoded = await geocodeAddress(storeAddress);
        if (geocoded) {
          storeLat = geocoded.lat;
          storeLng = geocoded.lng;
        } else {
          locationWarning = true;
        }
      }

      // Persist any updated coordinates
      if (storeLat && storeLng) {
        if (settings) {
          await db.appSettings.update({
            where: { shop },
            data: { storeLat, storeLng, storeAddress, unitSystem },
          });
        }
      }
    }
  } catch (err) {
    console.error("[Delivery Loader] Location fetch error:", err);
    locationWarning = !storeLat;
  }

  // Create default settings if none exist
  if (!settings) {
    const defaultRadius = unitSystem === "METRIC" ? 10.0 : 6.0;
    settings = await db.appSettings.create({
      data: {
        shop,
        deliveryRadius: defaultRadius,
        unitSystem,
        storeLat,
        storeLng,
        storeAddress,
      },
    });
  }

  return json({
    deliveryRadius: settings.deliveryRadius,
    unitSystem: settings.unitSystem,
    hasCustomizedRadius: settings.hasCustomizedRadius,
    storeLat: storeLat,
    storeLng: storeLng,
    storeAddress: storeAddress,
    locationWarning,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    googleMapId: process.env.GOOGLE_MAP_ID ?? "",
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const deliveryRadius = parseFloat(formData.get("deliveryRadius") as string);
  const unitSystem = formData.get("unitSystem") as string;

  if (isNaN(deliveryRadius) || deliveryRadius <= 0) {
    return json({ error: "Invalid radius" }, { status: 400 });
  }

  await db.appSettings.upsert({
    where: { shop },
    update: { deliveryRadius, unitSystem, hasCustomizedRadius: true },
    create: { shop, deliveryRadius, unitSystem, hasCustomizedRadius: true },
  });

  return json({ success: true });
}

export default function DeliveryPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [radius, setRadius] = useState(data.deliveryRadius);
  const [unitSystem, setUnitSystem] = useState(data.unitSystem);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const radiusInMeters =
    unitSystem === "IMPERIAL" ? radius * 1609.34 : radius * 1000;

  // Load and init Google Maps
  useEffect(() => {
    if (!data.googleMapsApiKey || !data.storeLat || !data.storeLng) return;

    async function initMap() {
      try {
        // Prevent duplicate script loading
        if (!(window as any).google?.maps?.importLibrary) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector("script[data-gmaps]");
            if (existing) {
              resolve();
              return;
            }
            const script = document.createElement("script");
            script.setAttribute("data-gmaps", "true");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${data.googleMapsApiKey}&loading=async`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Maps load failed"));
            document.head.appendChild(script);
          });
        }

        const { Map, Circle } = (await (
          window as any
        ).google.maps.importLibrary("maps")) as google.maps.MapsLibrary;

        if (!mapRef.current) return;

        const center = { lat: data.storeLat!, lng: data.storeLng! };

        mapInstanceRef.current = new Map(mapRef.current, {
          center,
          zoom: 11,
          mapId: data.googleMapId || undefined,
          disableDefaultUI: false,
        });

        circleRef.current = new Circle({
          map: mapInstanceRef.current,
          center,
          radius: radiusInMeters,
          fillColor: "#008060",
          fillOpacity: 0.15,
          strokeColor: "#008060",
          strokeOpacity: 0.85,
          strokeWeight: 2,
        });

        setMapReady(true);
      } catch (err) {
        console.error("[Map] Init error:", err);
        setMapError(true);
      }
    }

    initMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.storeLat, data.storeLng, data.googleMapsApiKey, data.googleMapId]);

  // Update circle radius live
  useEffect(() => {
    if (!circleRef.current) return;
    const meters = unitSystem === "IMPERIAL" ? radius * 1609.34 : radius * 1000;
    circleRef.current.setRadius(meters);
  }, [radius, unitSystem]);

  const handleSave = useCallback(() => {
    const form = new FormData();
    form.append("deliveryRadius", String(radius));
    form.append("unitSystem", unitSystem);
    fetcher.submit(form, { method: "post" });
  }, [radius, unitSystem, fetcher]);

  const unit = unitSystem === "IMPERIAL" ? "miles" : "km";
  const maxRadius = unitSystem === "IMPERIAL" ? 25 : 40;

  return (
    <Page
      title="Delivery Zone"
      subtitle="Set your local delivery radius and visualize your coverage area"
    >
      <Layout>
        {data.locationWarning && (
          <Layout.Section>
            <Banner title="Store location not found" tone="warning">
              <p>
                We couldn't geocode your store address. Please verify it in{" "}
                <strong>Shopify Settings → Locations</strong> and re-save. The
                map will use a default location until coordinates are confirmed.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {fetcher.data && "success" in fetcher.data && (
          <Layout.Section>
            <Banner title="Delivery zone saved successfully!" tone="success" />
          </Layout.Section>
        )}

        {fetcher.data && "error" in fetcher.data && (
          <Layout.Section>
            <Banner title={String(fetcher.data.error)} tone="critical" />
          </Layout.Section>
        )}

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Delivery Radius
                </Text>
                {data.storeAddress && (
                  <Text as="p" tone="subdued" variant="bodySm">
                    📍 {data.storeAddress}
                  </Text>
                )}
              </BlockStack>

              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodyMd">
                  Current radius
                </Text>
                <Badge tone="success" />
              </InlineStack>

              <InlineStack align="space-between" blockAlign="center">
                {radius + ""} {unit}
              </InlineStack>

              <RangeSlider
                label={`Radius (${unit})`}
                value={radius}
                min={1}
                max={maxRadius}
                step={unitSystem === "IMPERIAL" ? 0.5 : 1}
                onChange={(value) => setRadius(value as number)}
                output
              />

              <Select
                label="Unit System"
                options={[
                  { label: "Miles (US / Imperial)", value: "IMPERIAL" },
                  { label: "Kilometers (Metric)", value: "METRIC" },
                ]}
                value={unitSystem}
                onChange={setUnitSystem}
              />

              <Button
                variant="primary"
                onClick={handleSave}
                loading={fetcher.state === "submitting"}
                fullWidth
              >
                Save Delivery Zone
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Coverage Map
              </Text>

              {mapError && (
                <Banner title="Map unavailable" tone="critical">
                  Google Maps failed to load. Please check your API key
                  configuration in your environment variables.
                </Banner>
              )}

              {!mapError && !mapReady && data.storeLat && (
                <InlineStack align="center">
                  <Spinner size="small" />
                  <Text as="p" tone="subdued">
                    Loading map…
                  </Text>
                </InlineStack>
              )}

              <Box minHeight={mapError || !data.storeLat ? "0px" : "420px"}>
                <div
                  ref={mapRef}
                  style={{
                    height: data.storeLat && !mapError ? "420px" : "0px",
                    width: "100%",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                />
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
