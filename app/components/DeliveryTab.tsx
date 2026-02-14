import {
  BlockStack,
  Card,
  InlineStack,
  Icon,
  Text,
  Badge,
  RangeSlider,
  Checkbox,
  Button,
} from "@shopify/polaris";
import { OrderIcon } from "@shopify/polaris-icons";

interface DeliveryTabProps {
  deliveryRadius: number;
  setDeliveryRadius: (val: number) => void;
  recoveryEnabled: boolean;
  setRecoveryEnabled: (val: boolean) => void;
  isSaving: boolean;
  handleSave: () => void;
  unit: string;
}

export function DeliveryTab({
  deliveryRadius,
  setDeliveryRadius,
  recoveryEnabled,
  setRecoveryEnabled,
  isSaving,
  handleSave,
  unit,
}: DeliveryTabProps) {
  // Calculate dynamic scale for the map circle (max 50km = 100% radius)
  const circleScale = (deliveryRadius / 50) * 80 + 20;

  return (
    <div className="personalizer-container">
      {/* LEFT COLUMN: Settings */}
      <div className="personalizer-card">
        <Card>
          <div className="card-content-wrapper">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200">
                  <Icon source={OrderIcon} tone="base" />
                  <Text as="h2" variant="headingMd">
                    Neighborhood Delivery Routing
                  </Text>
                </InlineStack>
                <Button
                  variant="primary"
                  size="slim"
                  loading={isSaving}
                  onClick={handleSave}
                >
                  Save Settings
                </Button>
              </InlineStack>

              <BlockStack gap="500">
                <RangeSlider
                  label="Neighborhood Delivery Radius"
                  value={deliveryRadius}
                  onChange={setDeliveryRadius}
                  min={1}
                  max={unit === "miles" ? 30 : 50}
                  step={unit === "miles" ? 0.5 : 1}
                  suffix={
                    <Text as="span" variant="bodyMd">
                      {deliveryRadius} {unit}
                    </Text>
                  }
                  helpText="Orders within this radius will be grouped into optimized batches."
                />

                <Checkbox
                  label="Enable Order Recovery"
                  checked={recoveryEnabled}
                  onChange={setRecoveryEnabled}
                  helpText="Notify customers if a delivery slot in their zone opens up."
                />
              </BlockStack>
            </BlockStack>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN: Zone Map Visualization */}
      <div className="personalizer-card">
        <Card>
          <div className="card-content-wrapper">
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Routing Insights
                </Text>
                <Badge tone="attention">Pro Plan</Badge>
              </InlineStack>

              {/* DYNAMIC ZONE MAP */}
              <div
                className="preview-area"
                style={{ position: "relative", overflow: "hidden" }}
              >
                <svg
                  width="100%"
                  height="160"
                  viewBox="0 0 200 160"
                  style={{ opacity: 0.8 }}
                >
                  <path
                    d="M0 40 H200 M0 120 H200 M60 0 V160 M140 0 V160"
                    stroke="#dfe3e8"
                    strokeWidth="2"
                  />
                  <path
                    d="M0 80 Q100 20 200 80"
                    fill="none"
                    stroke="#dfe3e8"
                    strokeWidth="2"
                  />

                  <circle
                    cx="100"
                    cy="80"
                    r={circleScale}
                    fill="rgba(0, 128, 96, 0.1)"
                    stroke="#008060"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    style={{ transition: "r 0.3s ease-out" }}
                  />

                  {/* Store Location Pin */}
                  <circle cx="100" cy="80" r="4" fill="#008060" />
                  <circle
                    cx="100"
                    cy="80"
                    r="8"
                    fill="none"
                    stroke="#008060"
                    strokeWidth="1"
                  />
                </svg>

                <div
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "10px",
                  }}
                >
                  <Badge tone="success" />
                  {`${deliveryRadius} ${unit} coverage`}
                </div>
              </div>

              <div className="tip-wrapper">
                <BlockStack gap="100">
                  <Text
                    as="p"
                    variant="bodySm"
                    tone="subdued"
                    alignment="center"
                  >
                    Current radius groups orders in{" "}
                    <Text as="span" fontWeight="bold">
                      optimized batches
                    </Text>
                    .
                  </Text>
                  <Text as="p" variant="bodySm" alignment="center">
                    <Text as="span" fontWeight="bold" tone="success">
                      Pro Tip:
                    </Text>{" "}
                    Keep radius under 15km for best neighborhood density!
                  </Text>
                </BlockStack>
              </div>
            </BlockStack>
          </div>
        </Card>
      </div>
    </div>
  );
}
