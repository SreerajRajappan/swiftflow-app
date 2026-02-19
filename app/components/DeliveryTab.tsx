import {
  Box,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  RangeSlider,
  Icon,
  Checkbox,
  Divider,
  List,
  Banner,
  Spinner,
} from "@shopify/polaris";
import {
  LocationIcon,
  LockIcon,
  OrderIcon,
  SaveIcon,
} from "@shopify/polaris-icons";
import { useEffect, useRef, useState } from "react";

interface DeliveryTabProps {
  isPro: boolean;
  deliveryRadius: number;
  setDeliveryRadius: (value: number) => void;
  unit: "miles" | "km";
  navigate: (url: string) => void;
  recoveryEnabled: boolean;
  setRecoveryEnabled: (value: boolean) => void;
  isSaving: boolean;
  handleSave: () => void;
  googleMapsApiKey: string;
  googleMapId: string;
  shopCoordinates: { lat: number; lng: number };
}

export function DeliveryTab({
  isPro,
  deliveryRadius,
  setDeliveryRadius,
  unit,
  navigate,
  recoveryEnabled,
  setRecoveryEnabled,
  isSaving,
  handleSave,
  googleMapsApiKey,
  googleMapId,
  shopCoordinates,
}: DeliveryTabProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const isMetric = unit === "km";
  const maxRange = isMetric ? 50 : 30;
  const stepSize = isMetric ? 1 : 0.5;

  const isFallback =
    shopCoordinates.lat === 34.0549 && shopCoordinates.lng === -118.2437;

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const circleInstance = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!isPro || !mapRef.current || !googleMapsApiKey) return;

    const loadScript = () => {
      if (window.google && window.google.maps) {
        initMap();
        return;
      }

      // 2. Prevent double-injection
      const existingScript = document.getElementById("google-maps-script");
      if (existingScript) return;

      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => initMap();
      document.head.appendChild(script);
    };

    async function initMap() {
      try {
        // 3. Destructure specifically from the library call
        const { Map, Circle } = (await window.google.maps.importLibrary(
          "maps",
        )) as google.maps.MapsLibrary;

        const center = {
          lat: Number(shopCoordinates.lat),
          lng: Number(shopCoordinates.lng),
        };

        if (!mapInstance.current && mapRef.current) {
          mapInstance.current = new Map(mapRef.current, {
            center,
            zoom: 11,
            disableDefaultUI: true,
            zoomControl: true,
            mapId: googleMapId || "DEMO_MAP_ID",
          });
        }

        const effectiveRadius =
          unit === "miles" && deliveryRadius === 10 ? 6 : deliveryRadius;

        const radiusInMeters =
          unit === "miles" ? effectiveRadius * 1609.34 : effectiveRadius * 1000;

        if (circleInstance.current) {
          circleInstance.current.setRadius(radiusInMeters);
          circleInstance.current.setCenter(center);
        } else if (mapInstance.current) {
          circleInstance.current = new Circle({
            strokeColor: "#008060",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#008060",
            fillOpacity: 0.15,
            map: mapInstance.current,
            center,
            radius: radiusInMeters,
          });
        }
        setIsLoadingMap(false);
      } catch (error) {
        console.error("Map initialization error:", error);
        setIsLoadingMap(false);
      }
    }

    loadScript();
  }, [
    isPro,
    googleMapsApiKey,
    shopCoordinates,
    googleMapId,
    deliveryRadius,
    unit,
  ]);

  return (
    <Box paddingBlockStart="400" paddingBlockEnd="800">
      <BlockStack gap="400">
        {isPro && showBanner && (
          <Banner
            title={
              isFallback
                ? "Location Coordinates Not Found"
                : "Verify Your Delivery Center"
            }
            tone={isFallback ? "warning" : "info"}
            icon={LocationIcon}
            onDismiss={() => setShowBanner(false)}
          >
            <Text as="p">
              {isFallback
                ? "Shopify hasn't provided GPS coordinates for your store yet. We're showing a default location."
                : "The map shows your primary fulfillment hub. If this isn't correct:"}
            </Text>
            <List>
              <List.Item>
                Go to <strong>Settings &gt; Locations</strong> in your Shopify
                Admin.
              </List.Item>
              <List.Item>
                Ensure your address is complete and verified by the address
                suggester.
              </List.Item>
              <List.Item>
                Save the location to trigger Shopify's coordinate geocoding.
              </List.Item>
            </List>
          </Banner>
        )}
        <Card padding="0">
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "var(--p-border-radius-200)",
            }}
          >
            {/* 1. THE ACTUAL UI CONTENT (Blurred if not Pro) */}
            <div
              style={{
                filter: isPro ? "none" : "blur(6px)",
                opacity: isPro ? 1 : 0.5,
                pointerEvents: isPro && !isSaving ? "auto" : "none", // Disable interaction while saving
                transition: "filter 0.5s ease, opacity 0.5s ease",
              }}
            >
              <BlockStack gap="400">
                <Box padding="400">
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingMd">
                        Local Delivery Strategy
                      </Text>
                      {isPro && (
                        <Button
                          size="slim"
                          variant="primary"
                          onClick={handleSave}
                          loading={isSaving}
                          icon={SaveIcon}
                        >
                          Save Strategy
                        </Button>
                      )}
                    </InlineStack>

                    <RangeSlider
                      label={`Neighborhood Delivery Radius (${unit})`}
                      value={deliveryRadius}
                      onChange={setDeliveryRadius}
                      min={1}
                      max={maxRange}
                      step={stepSize}
                      disabled={isSaving} // Prevent changes during save
                      suffix={
                        <Text as="span" variant="bodyMd">
                          {deliveryRadius} {unit}
                        </Text>
                      }
                    />

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200">
                        <Icon source={OrderIcon} tone="base" />
                        <BlockStack>
                          <Text as="p" variant="bodyMd" fontWeight="bold">
                            Automated Order Recovery
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            Notify customers when they are within your delivery
                            zone.
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      <Checkbox
                        label="Enable Recovery"
                        labelHidden
                        checked={recoveryEnabled}
                        onChange={setRecoveryEnabled}
                        disabled={isSaving} // Prevent toggling during save
                      />
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* GOOLE MAP*/}
                <div
                  style={{
                    position: "relative",
                    height: "450px",
                    width: "100%",
                    background: "#f1f1f1",
                  }}
                >
                  {isPro && isLoadingMap && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 5,
                        background: "rgba(241, 241, 241, 0.8)",
                      }}
                    >
                      <Spinner size="large" />
                    </div>
                  )}
                  <div
                    ref={mapRef}
                    style={{
                      height: "450px",
                      width: "100%",
                      background: "#f1f1f1",
                    }}
                  />
                </div>
              </BlockStack>
            </div>

            {/* 2. THE GLASS OVERLAY (Only visible if not Pro) */}
            {!isPro && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <Box padding="400">
                  <Card>
                    <div style={{ padding: "24px", textAlign: "center" }}>
                      <BlockStack gap="400" align="center">
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            backgroundColor:
                              "var(--p-color-bg-surface-secondary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto",
                          }}
                        >
                          <Icon source={LockIcon} tone="base" />
                        </div>
                        <BlockStack gap="200">
                          <Text as="h2" variant="headingLg">
                            Unlock Pro Suite Features
                          </Text>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Automate neighborhood routing & recover abandoned
                            sales.
                          </Text>
                        </BlockStack>
                        <Button
                          variant="primary"
                          size="large"
                          onClick={() => navigate("/app/billing")}
                        >
                          Start 7-Day Pro Trial
                        </Button>
                      </BlockStack>
                    </div>
                  </Card>
                </Box>
              </div>
            )}
          </div>
        </Card>
      </BlockStack>
    </Box>
  );
}
