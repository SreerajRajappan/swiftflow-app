import {
  BlockStack,
  Card,
  Text,
  Badge,
  DataTable,
  EmptyState,
  InlineStack,
  Icon,
  Button,
  Box,
} from "@shopify/polaris";
import {
  AlertDiamondIcon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
} from "@shopify/polaris-icons";

export function RevenueLeaksTab({
  leaks,
  onRunScan,
  isScanning,
  isPro,
  navigate,
}: {
  leaks: any[];
  onRunScan: () => void;
  isScanning: boolean;
  isPro: boolean;
  navigate: (path: string) => void;
}) {
  if (!isPro) {
    return (
      <Card>
        <Box padding="1000">
          <EmptyState
            heading="Unlock AI Revenue Leaks Detection"
            action={{
              content: "Upgrade to Pro",
              onAction: () => navigate("/app/billing"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Revenue Leaks monitoring is a Pro feature. Upgrade to unlock our
              AI Agent that detects high-value abandoned carts and dispatches
              targeted recovery emails in real-time.
            </p>
          </EmptyState>
        </Box>
      </Card>
    );
  }

  if (!leaks || leaks.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No Revenue Leaks Detected"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          action={{
            content: "Run AI Agent Scan",
            icon: PlayIcon,
            onAction: onRunScan,
            loading: isScanning,
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
    const tone: "critical" | "warning" | "info" | "success" | "new" =
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

    if (leak.status === "AGENT_WORKING" || leak.status === "ANALYZING") {
      statusBadge = (
        <Badge key={`status-${leak.id}`} tone="info" icon={ClockIcon}>
          Agent Working
        </Badge>
      );
    }
    // The AI finished its job, but the customer hasn't bought yet
    if (leak.status === "COMPLETED") {
      statusBadge = (
        <Badge key={`status-${leak.id}`} tone="info" icon={CheckCircleIcon}>
          Email Sent
        </Badge>
      );
    }
    // The customer actually paid!
    if (leak.status === "RECOVERED") {
      statusBadge = (
        <Badge key={`status-${leak.id}`} tone="success" icon={CheckCircleIcon}>
          Recovered
        </Badge>
      );
    }

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
        ${(leak.potentialValue || 0).toFixed(2)}
      </Text>,
      statusBadge,
      new Date(leak.createdAt).toLocaleDateString(),
    ];
  });

  const totalAtRisk = leaks
    .filter((l) => l.status !== "RECOVERED" && l.status !== "COMPLETED")
    .reduce((sum, leak) => sum + (leak.potentialValue || 0), 0);

  return (
    <BlockStack gap="400">
      {totalAtRisk > 0 && (
        <Card background="bg-surface-critical">
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd" tone="critical">
              Immediate Attention Required
            </Text>
            <Text as="p" variant="bodyMd">
              There is currently <strong>${totalAtRisk.toFixed(2)}</strong> in
              abandoned high-value carts. Your AI Agent is analyzing these to
              dispatch targeted recovery emails.
            </Text>
          </BlockStack>
        </Card>
      )}

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Active Revenue Leaks
            </Text>
            <Button icon={PlayIcon} onClick={onRunScan} loading={isScanning}>
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
