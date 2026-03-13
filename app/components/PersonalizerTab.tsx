import {
  BlockStack,
  Card,
  InlineStack,
  Icon,
  Text,
  TextField,
  Button,
  RangeSlider,
  Box,
} from "@shopify/polaris";
import { EditIcon } from "@shopify/polaris-icons";
import "../styles/PersonalizerTab.css";

interface PersonalizerTabProps {
  isPro: boolean;
  trialDaysLeft: number;
  customText: string;
  setCustomText: (val: string) => void;
  // NEW: Added the button text prop
  buttonText: string;
  setButtonText: (val: string) => void;
  // REMOVED HSB ColorPicker props, swapped for standard hex string
  hexColor: string;
  setHexColor: (val: string) => void;
  fontSize: number;
  setFontSize: (val: number) => void;
  isSaving: boolean;
  handleSave: () => void;
  navigate: (path: string) => void;
}

const SALES_EMOJIS = [
  "🔥",
  "👀",
  "⚡",
  "🛒",
  "⭐",
  "🎉",
  "🛍️",
  "🚀",
  "📍",
  "🚚",
];

export function PersonalizerTab({
  isPro,
  trialDaysLeft,
  customText,
  setCustomText,
  buttonText, // New prop
  setButtonText, // New prop
  hexColor,
  setHexColor,
  fontSize,
  setFontSize,
  isSaving,
  handleSave,
  navigate,
}: PersonalizerTabProps) {
  return (
    <BlockStack gap="400">
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
                    Widget Configuration
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

              <BlockStack gap="400">
                <BlockStack gap="200">
                  <TextField
                    label="Header Text"
                    value={customText}
                    onChange={setCustomText}
                    placeholder="e.g., 📍 Local Delivery Available"
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setCustomText("")}
                  />
                  <InlineStack gap="200">
                    {SALES_EMOJIS.map((e) => (
                      <Button
                        key={e}
                        size="micro"
                        onClick={() => setCustomText(customText + " " + e)}
                      >
                        {e}
                      </Button>
                    ))}
                  </InlineStack>
                </BlockStack>

                {/* NEW: Button Text Field from Claude */}
                <TextField
                  label="Button Text"
                  value={buttonText}
                  onChange={setButtonText}
                  placeholder="Check Availability"
                  autoComplete="off"
                  helpText="The call-to-action button label."
                />

                <RangeSlider
                  label={`Font Size: ${fontSize}px`}
                  value={fontSize}
                  onChange={setFontSize}
                  min={12}
                  max={24}
                  output
                />

                {/* UPDATED: Native Color Picker from Claude */}
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Brand Color
                  </Text>
                  <InlineStack gap="300" blockAlign="center">
                    <input
                      type="color"
                      value={hexColor}
                      onChange={(e) => setHexColor(e.target.value)}
                      style={{
                        width: "48px",
                        height: "48px",
                        border: "1px solid #c9cccf",
                        borderRadius: "8px",
                        cursor: "pointer",
                        padding: "2px",
                      }}
                    />
                    <Box maxWidth="120px">
                      <TextField
                        label=""
                        labelHidden
                        value={hexColor}
                        onChange={setHexColor}
                        autoComplete="off"
                        placeholder="#008060"
                        maxLength={7}
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
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

              {/* UPDATED PREVIEW BUBBLE */}
              <div className="preview-area" style={{ padding: "40px 20px" }}>
                <BlockStack gap="300" align="center" inlineAlign="center">
                  <div
                    style={{
                      fontSize: `${fontSize}px`,
                      color: hexColor,
                      fontWeight: "700",
                      letterSpacing: "-0.01em",
                      textAlign: "center",
                    }}
                  >
                    {customText || "📍 Local Delivery Available"}
                  </div>

                  <button
                    style={{
                      backgroundColor: hexColor,
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "10px 24px",
                      fontSize: `${Math.max(12, fontSize - 2)}px`,
                      cursor: "pointer",
                      fontWeight: "600",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      transition: "transform 0.1s ease",
                    }}
                    onMouseDown={(e) =>
                      (e.currentTarget.style.transform = "scale(0.95)")
                    }
                    onMouseUp={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  >
                    {buttonText || "Check Availability"}
                  </button>
                </BlockStack>
              </div>

              <div className="tip-wrapper">
                <BlockStack gap="100">
                  <Text
                    as="p"
                    variant="bodySm"
                    tone="subdued"
                    alignment="center"
                  >
                    This widget will appear on your storefront via the theme app
                    block.
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
