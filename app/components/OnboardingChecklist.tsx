import { useState, useEffect } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Icon,
  Badge,
  Button,
  Box,
  Banner,
} from "@shopify/polaris";
import { CheckCircleIcon, XCircleIcon } from "@shopify/polaris-icons"; // Switched to CircleIcon
import { useNavigate } from "@remix-run/react";

export interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
  isExternal?: boolean;
}

export function OnboardingChecklist({
  steps,
  fetcher,
  shop,
}: {
  steps: Step[];
  fetcher: any;
  shop?: string;
}) {
  const navigate = useNavigate();
  const completedCount = steps.filter((s) => s.done).length;
  const isComplete = completedCount === steps.length;

  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (!isVisible) return null;

  if (isComplete) {
    return (
      <Box paddingBlockEnd="400">
        <Banner tone="success" title="Onboarding Complete! 🎉">
          <Text as="p">
            Your local delivery configuration is active. Loving SwiftFlow?
            Consider leaving a quick review in the App Store to support our
            development team! Hiding checklist...
          </Text>
        </Banner>
      </Box>
    );
  }

  const supportEmail = "hello@logiclooms.io";
  const emailSubject = encodeURIComponent("Concierge Setup Request");
  const emailBody = encodeURIComponent(
    `Hi SwiftFlow team,\n\nI need help setting up the app. Please request collaborator access and set it up for me!\n\nMy Shopify URL is: ${shop || "[INSERT YOUR STORE URL]"}`,
  );
  const mailtoLink = `mailto:${supportEmail}?subject=${emailSubject}&body=${emailBody}`;

  return (
    <Box paddingBlockEnd="400">
      <Card background="bg-surface-secondary">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              🚀 Required Setup ({completedCount}/{steps.length} complete)
            </Text>
            <Badge tone={isComplete ? "success" : "attention"}>
              {completedCount === 0 ? "Not started" : `${completedCount} done`}
            </Badge>
          </InlineStack>

          <BlockStack gap="300">
            {steps.map((step) => (
              <InlineStack
                key={step.id}
                gap="300"
                blockAlign="start"
                wrap={false}
              >
                <Box paddingBlockStart="025">
                  {/* Switched to clean neutral circles for uncompleted steps */}
                  <Icon
                    source={step.done ? CheckCircleIcon : XCircleIcon}
                    tone={step.done ? "success" : "subdued"}
                  />
                </Box>
                <BlockStack gap="100">
                  <Text
                    as="p"
                    variant="bodyMd"
                    fontWeight={step.done ? "regular" : "bold"}
                    tone={step.done ? "subdued" : "base"}
                  >
                    {step.title}
                  </Text>
                  {!step.done && (
                    <BlockStack gap="200" align="start">
                      <Text as="p" tone="subdued" variant="bodySm">
                        {step.description}
                      </Text>
                      <Button
                        variant="plain"
                        onClick={() => {
                          if (step.isExternal) {
                            // Enforce clean breakout to parent target window for external admin paths
                            window.open(
                              step.href,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          } else {
                            navigate(step.href);
                          }
                        }}
                      >
                        {step.cta} &rarr;
                      </Button>
                    </BlockStack>
                  )}
                </BlockStack>
              </InlineStack>
            ))}
          </BlockStack>

          <Box paddingBlockStart="200">
            <Banner
              tone="info"
              title="Don't have time? Let our engineers set it up for you."
            >
              <BlockStack gap="300">
                <Text as="p">
                  Skip the technical setup. Click below to request our free
                  concierge service. We will send a secure access request to
                  your Shopify admin—simply approve it, and our team will
                  configure your delivery radiuses and checkout widgets within
                  24 hours.
                </Text>
                <div style={{ display: "flex" }}>
                  <Button url={mailtoLink} target="_blank">
                    Request Free Concierge Setup
                  </Button>
                </div>
              </BlockStack>
            </Banner>
          </Box>
        </BlockStack>
      </Card>
    </Box>
  );
}
