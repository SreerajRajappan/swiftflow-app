import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  ProgressBar,
  List,
  Box,
  Badge,
} from "@shopify/polaris";

export function ZoneHealthCard({ health }: { health: any }) {
  // Determine the color of the progress bar based on the score
  const badgeTone =
    health.score >= 90
      ? "success"
      : health.score >= 70
        ? "attention"
        : "critical";

  const progressTone =
    health.score >= 90
      ? "success"
      : health.score >= 70
        ? "primary"
        : "critical";

  return (
    <Card background="bg-surface-secondary">
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Zone Health Score
          </Text>
          <Badge tone={badgeTone}>{health.label}</Badge>
        </InlineStack>

        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="end">
            <Text as="p" variant="heading3xl" fontWeight="bold">
              {health.score}
              <Text as="span" variant="headingLg" tone="subdued">
                /100
              </Text>
            </Text>
          </InlineStack>
          <ProgressBar
            progress={health.score}
            tone={progressTone}
            size="small"
          />
        </BlockStack>

        {health.tips.length > 0 && (
          <Box paddingBlockStart="200">
            <Text as="h3" variant="headingSm">
              How to improve your score:
            </Text>
            <Box paddingBlockStart="100">
              <List type="bullet">
                {health.tips.map((tip: string, index: number) => (
                  <List.Item key={index}>{tip}</List.Item>
                ))}
              </List>
            </Box>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}
