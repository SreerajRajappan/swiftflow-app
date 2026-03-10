import {
  BlockStack,
  Card,
  Text,
  Badge,
  DataTable,
  EmptyState,
  InlineStack,
  Icon,
  Button, // <-- Brought this back!
} from "@shopify/polaris";
import {
  AlertDiamondIcon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
} from "@shopify/polaris-icons";

export function RevenueLeaksTab({ leaks }: { leaks: any[] }) {
  if (!leaks || leaks.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No Revenue Leaks Detected"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          action={{
            content: "Run AI Agent Scan",
            icon: PlayIcon,
            onAction: () =>
              alert(
                "In Phase 2, this will instantly trigger the backend AI Agent!",
              ),
          }}
        >
          <p>
            Your store is running perfectly. When high-value carts are abandoned
            in your local delivery zone, our AI Agent will detect them and show
            them here.
          </p>
        </EmptyState>
      </Card>
    );
  }

  const tableRows = leaks.map((leak) => {
    const tone =
      leak.severity === "CRITICAL"
        ? "critical"
        : leak.severity === "WARNING"
          ? "warning"
          : "info";

    let statusBadge = (
      <Badge key={`status-${leak.id}`} tone="new">
        Detected
      </Badge>
    );
    if (leak.status === "AGENT_WORKING")
      statusBadge = (
        <Badge key={`status-${leak.id}`} tone="info" icon={ClockIcon}>
          Agent Working
        </Badge>
      );
    if (leak.status === "RECOVERED")
      statusBadge = (
        <Badge key={`status-${leak.id}`} tone="success" icon={CheckCircleIcon}>
          Recovered
        </Badge>
      );

    return [
      <InlineStack key={`details-${leak.id}`} gap="200" align="start">
        {leak.severity === "CRITICAL" && (
          <Icon source={AlertDiamondIcon} tone="critical" />
        )}
        <BlockStack>
          <Text as="span" variant="bodyMd" fontWeight="bold">
            {leak.title}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {leak.metadata?.customerEmail || "Anonymous Visitor"}
          </Text>
        </BlockStack>
      </InlineStack>,
      <Badge key={`sev-${leak.id}`} tone={tone}>
        {leak.severity}
      </Badge>,
      <Text key={`val-${leak.id}`} as="span" variant="bodyMd" fontWeight="bold">
        ${leak.potentialValue.toFixed(2)}
      </Text>,
      statusBadge,
      new Date(leak.createdAt).toLocaleDateString(),
    ];
  });

  const totalAtRisk = leaks
    .filter((l) => l.status !== "RECOVERED")
    .reduce((sum, leak) => sum + leak.potentialValue, 0);

  return (
    <BlockStack gap="400">
      <Card background="bg-surface-critical">
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd" tone="critical">
            Immediate Attention Required
          </Text>
          <Text as="p" variant="bodyMd">
            There is currently <strong>${totalAtRisk.toFixed(2)}</strong> in
            abandoned high-value carts. Your AI Agent is currently analyzing
            these to dispatch targeted recovery emails.
          </Text>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Active Revenue Leaks
            </Text>
            {/* The Action Button for Merchants */}
            <Button
              icon={PlayIcon}
              onClick={() =>
                alert(
                  "In Phase 2, this will instantly trigger the backend AI Agent!",
                )
              }
            >
              Run AI Agent Scan
            </Button>
          </InlineStack>
          <DataTable
            columnContentTypes={["text", "text", "numeric", "text", "text"]}
            headings={[
              "Leak Details",
              "Severity",
              "Potential Value",
              "Agent Status",
              "Detected On",
            ]}
            rows={tableRows}
          />
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
