import {
  BlockStack,
  Banner,
  Card,
  InlineStack,
  Icon,
  Text,
  TextField,
  Button,
  ColorPicker,
  RangeSlider,
} from "@shopify/polaris";
import { EditIcon } from "@shopify/polaris-icons";
import "../styles/PersonalizerTab.css";

interface PersonalizerTabProps {
  isPro: boolean;
  trialDaysLeft: number;
  customText: string;
  setCustomText: (val: string) => void;
  color: any;
  setColor: (val: any) => void;
  hexColor: string;
  fontSize: number;
  setFontSize: (val: number) => void;
  isSaving: boolean;
  handleSave: () => void;
  navigate: (path: string) => void;
}

const SALES_EMOJIS = ["🔥", "👀", "⚡", "🛒", "⭐", "🎉", "🛍️", "🚀"];

export function PersonalizerTab({
  isPro,
  trialDaysLeft,
  customText,
  setCustomText,
  color,
  setColor,
  hexColor,
  fontSize,
  setFontSize,
  isSaving,
  handleSave,
  navigate,
}: PersonalizerTabProps) {
  return (
    <BlockStack gap="400">
      {/* 1. TOP BANNER */}
      {isPro && trialDaysLeft > 0 && (
        <Banner tone="info">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd">
              You are on a{" "}
              <Text as="span" fontWeight="bold">
                Pro Trial
              </Text>{" "}
              with
              <Text as="span" fontWeight="bold">
                {" "}
                {trialDaysLeft} days
              </Text>{" "}
              remaining.
            </Text>
            <Button
              variant="primary"
              tone="success"
              onClick={() => navigate("/app/billing")}
            >
              Secure Pro Access
            </Button>
          </InlineStack>
        </Banner>
      )}

      {/* 2. THE SYMMETRICAL GRID */}
      <div className="personalizer-container">
        {/* LEFT COLUMN: Configuration */}
        <div className="personalizer-card">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200">
                  <Icon source={EditIcon} tone="base" />
                  <Text as="h2" variant="headingMd">
                    Personalizer Configuration
                  </Text>
                </InlineStack>
                <Button
                  variant="primary"
                  size="slim"
                  loading={isSaving}
                  onClick={handleSave}
                >
                  Save & Publish
                </Button>
              </InlineStack>

              <BlockStack gap="300">
                <TextField
                  label="Widget Text"
                  value={customText}
                  onChange={setCustomText}
                  placeholder="e.g., 🔥 15 people are viewing this right now!" // Restored placeholder
                  autoComplete="off"
                  clearButton // Added clear icon
                  onClearButtonClick={() => setCustomText("")} // Handle clear
                  helpText="Use emojis to increase urgency and social proof."
                />
                <InlineStack gap="200">
                  {SALES_EMOJIS.map((e) => (
                    <Button
                      key={e}
                      size="micro"
                      onClick={() => setCustomText(customText + e)}
                    >
                      {e}
                    </Button>
                  ))}
                </InlineStack>
                <RangeSlider
                  label={`Font Size: ${fontSize}px`}
                  value={fontSize}
                  onChange={setFontSize}
                  min={10}
                  max={24}
                  output
                />
                <Text as="p" variant="bodyMd">
                  Color Theme
                </Text>
                <ColorPicker onChange={setColor} color={color} />
              </BlockStack>
            </BlockStack>
          </Card>
        </div>

        {/* RIGHT COLUMN: Live Preview */}
        <div className="personalizer-card">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Live Preview
              </Text>
              <div className="preview-area">
                <div
                  className="bubble"
                  style={{
                    backgroundColor: `${hexColor}15`,
                    borderColor: hexColor,
                    color: hexColor,
                    fontSize: `${fontSize}px`,
                  }}
                >
                  <span style={{ whiteSpace: "nowrap" }}>
                    {customText || "🔥 15 people are viewing this right now!"}
                  </span>
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
                    This widget will appear directly below your "Add to Cart"
                    button.
                  </Text>
                  <Text as="p" variant="bodySm" alignment="center">
                    <Text as="span" fontWeight="bold" tone="success">
                      Pro Tip:
                    </Text>{" "}
                    Reduce font size to fit long text in one line!
                  </Text>
                </BlockStack>
              </div>
            </BlockStack>
          </Card>
        </div>
      </div>
    </BlockStack>
  );
}
