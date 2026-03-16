import { useState } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Icon,
  Badge,
  Button,
  Box,
} from "@shopify/polaris";
import { CheckCircleIcon, XCircleIcon } from "@shopify/polaris-icons";
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

export function OnboardingChecklist({ steps }: { steps: Step[] }) {
  const navigate = useNavigate();
  // State to handle manual dismissal
  const [isDismissed, setIsDismissed] = useState(false);

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // If the merchant clicked Dismiss, hide the component
  if (isDismissed) return null;

  return (
    <Box paddingBlockEnd="400">
      <Card background="bg-surface-secondary">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              🚀 Setup SwiftFlow ({completedCount}/{steps.length} complete)
            </Text>
            <InlineStack gap="300" blockAlign="center">
              <Badge tone={allDone ? "success" : "attention"}>
                {completedCount === 0
                  ? "Not started"
                  : `${completedCount} done`}
              </Badge>
              {/* Show the dismiss button when all steps are completed */}
              {allDone && (
                <Button
                  size="slim"
                  variant="primary"
                  tone="success"
                  onClick={() => setIsDismissed(true)}
                >
                  Dismiss Checklist
                </Button>
              )}
            </InlineStack>
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
                  <Icon
                    source={step.done ? CheckCircleIcon : XCircleIcon}
                    tone={step.done ? "success" : "critical"}
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
                            window.open(step.href, "_blank");
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
        </BlockStack>
      </Card>
    </Box>
  );
}
