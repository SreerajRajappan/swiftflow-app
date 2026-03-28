import { useState, useEffect, useRef, useCallback } from "react";
import {
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
  Checkbox,
} from "@shopify/polaris";

export default function DeliveryTab({
  data,
  fetcher,
  isPro,
  recoveryEmailEnabled,
  setrecoveryEmailEnabled,
}: {
  data: any;
  fetcher: any;
  isPro: boolean;
  recoveryEmailEnabled: boolean;
  setrecoveryEmailEnabled: (val: boolean) => void;
}) {
  const [radius, setRadius] = useState(data?.deliveryRadius || 6);
  const [unitSystem, setUnitSystem] = useState(data?.unitSystem || "IMPERIAL");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  // 👇 FIX: We need a ref to track the marker so we can destroy it later
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (data?.settings?.deliveryRadius) setRadius(data.settings.deliveryRadius);
    if (data?.unitSystem) setUnitSystem(data.unitSystem);
  }, [data?.settings?.deliveryRadius, data?.unitSystem]);

  const radiusInMeters =
    unitSystem === "IMPERIAL" ? radius * 1609.34 : radius * 1000;

  useEffect(() => {
    if (!data?.googleMapsApiKey) {
      setMapError(true);
      return;
    }
    if (!data?.googleMapsApiKey || !data?.storeLat || !data?.storeLng) {
      setMapError(true);
      return;
    }

    let isMounted = true;

    async function initMap() {
      try {
        // Bulletproof Google Maps Script Loader
        if (!(window as any).google?.maps?.Map) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector("script[data-gmaps]");
            if (existing) {
              if ((window as any).google?.maps?.Map) {
                resolve(); // Script is loaded and ready
              } else {
                existing.addEventListener("load", () => resolve()); // Wait for it
                existing.addEventListener("error", () =>
                  reject(new Error("Maps load failed")),
                );
              }
              return;
            }

            const script = document.createElement("script");
            script.setAttribute("data-gmaps", "true");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${data.googleMapsApiKey}&libraries=geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Maps load failed"));
            document.head.appendChild(script);
          });
        }

        if (!isMounted || !mapRef.current) return;

        const center = { lat: data.storeLat, lng: data.storeLng };

        // Initialize Map
        mapInstanceRef.current = new (window as any).google.maps.Map(
          mapRef.current,
          {
            center,
            zoom: 11,
            mapId: data.googleMapId || undefined,
            disableDefaultUI: false,
          },
        );

        // 👇 FIX: Attach the pin to our ref instead of making it anonymous
        markerRef.current = new (window as any).google.maps.Marker({
          position: center,
          map: mapInstanceRef.current,
          title: "Your Store",
          animation: (window as any).google.maps.Animation.DROP,
        });

        // Initialize Circle
        circleRef.current = new (window as any).google.maps.Circle({
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
        if (isMounted) setMapError(true);
      }
    }

    initMap();

    // 👇 FIX: Robust Cleanup Function including the missing Marker
    return () => {
      isMounted = false;

      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }

      if (markerRef.current) {
        markerRef.current.setMap(null); // Destroy the pin
        markerRef.current = null;
      }

      if (mapInstanceRef.current && (window as any).google?.maps?.event) {
        (window as any).google.maps.event.clearInstanceListeners(
          mapInstanceRef.current,
        );
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data?.storeLat,
    data?.storeLng,
    data?.googleMapsApiKey,
    data?.googleMapId,
  ]);

  // Update Circle when radius or unit changes
  useEffect(() => {
    if (!circleRef.current) return;
    const meters = unitSystem === "IMPERIAL" ? radius * 1609.34 : radius * 1000;
    circleRef.current.setRadius(meters);
  }, [radius, unitSystem]);

  const handleSave = useCallback(() => {
    const form = new FormData();
    form.append("intent", "save-delivery");
    form.append("deliveryRadius", String(radius));
    form.append("unitSystem", unitSystem);
    form.append("recoveryEmailEnabled", String(recoveryEmailEnabled));
    fetcher.submit(form, { method: "post" });
  }, [radius, unitSystem, recoveryEmailEnabled, fetcher]);

  const unit = unitSystem === "IMPERIAL" ? "miles" : "km";
  const maxRadius = unitSystem === "IMPERIAL" ? 25 : 40;

  const isSaving =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "save-delivery";

  return (
    <Box paddingBlockEnd="800">
      <Layout>
        {data?.locationWarning && (
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

        {!isPro && (
          <Layout.Section>
            <Banner title="Upgrade to Pro for Custom Zones" tone="info">
              <p>
                Free accounts are locked to an automatic 6-mile radius. Upgrade
                to Pro to unlock unlimited custom distances, metric unit
                toggling, and Smart Radius Optimization.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section variant="oneThird">
          <Card>
            <Box minHeight="455px">
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Delivery Radius
                  </Text>
                  {data?.storeAddress && (
                    <Text as="p" tone="subdued" variant="bodySm">
                      📍 {data.storeAddress}
                    </Text>
                  )}
                </BlockStack>

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    Current radius
                  </Text>
                  <Badge tone={isPro ? "success" : "info"} />
                  {radius} {unit} {!isPro ? "(Free Limit)" : ""}
                </InlineStack>

                <Box>
                  <RangeSlider
                    label={`Radius (${unit})`}
                    value={radius}
                    min={1}
                    max={maxRadius}
                    step={unitSystem === "IMPERIAL" ? 0.5 : 1}
                    onChange={(value) => setRadius(value as number)}
                    output
                    disabled={!isPro}
                  />
                </Box>

                <Box>
                  <Select
                    label="Unit System"
                    options={[
                      { label: "Miles (US / Imperial)", value: "IMPERIAL" },
                      { label: "Kilometers (Metric)", value: "METRIC" },
                    ]}
                    value={unitSystem}
                    onChange={setUnitSystem}
                    disabled={!isPro}
                  />
                </Box>

                <Box paddingBlockStart="200">
                  <Checkbox
                    label="Enable Cart Recovery Emails"
                    helpText="Automatically email customers who abandon their cart in your delivery zone."
                    checked={recoveryEmailEnabled}
                    onChange={setrecoveryEmailEnabled}
                  />
                </Box>

                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={isSaving}
                  fullWidth
                  disabled={!isPro}
                >
                  Save Delivery Zone
                </Button>
              </BlockStack>
            </Box>
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

              {!mapError && !mapReady && data?.storeLat && (
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text as="p" tone="subdued">
                    Loading map…
                  </Text>
                </InlineStack>
              )}

              <Box minHeight={mapError || !data?.storeLat ? "0px" : "420px"}>
                <div
                  ref={mapRef}
                  style={{
                    height: data?.storeLat && !mapError ? "420px" : "0px",
                    width: "100%",
                    borderRadius: "8px",
                    overflow: "hidden",
                    opacity: !isPro ? 0.8 : 1,
                  }}
                />
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Box>
  );
}
