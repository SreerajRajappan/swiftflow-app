import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  Divider,
  InlineStack,
  Icon,
  Badge,
  Box,
  IndexTable,
  Banner,
  ButtonGroup,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  MagicIcon,
  CashDollarIcon,
  LocationIcon,
  StarFilledIcon,
} from "@shopify/polaris-icons";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useNavigation, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  PLAN_BASIC_MONTHLY,
  PLAN_BASIC_ANNUAL,
  PLAN_PRO_MONTHLY,
  PLAN_PRO_ANNUAL,
  PLAN_ELITE_MONTHLY,
  PLAN_ELITE_ANNUAL,
} from "../constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  // 👇 FIX: Use explicit array casting to satisfy Shopify's strict type generation
  const planCheckArray: any = [
    PLAN_BASIC_MONTHLY,
    PLAN_BASIC_ANNUAL,
    PLAN_PRO_MONTHLY,
    PLAN_PRO_ANNUAL,
    PLAN_ELITE_MONTHLY,
    PLAN_ELITE_ANNUAL,
  ];

  const billingCheck = await billing.check({
    plans: planCheckArray,
    isTest: true,
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );

  let trialDaysLeft = 0;
  if (subscription && subscription.trialDays) {
    const createdAt = new Date(subscription.createdAt);
    const trialLength = subscription.trialDays;
    const daysPassed = Math.floor(
      (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    trialDaysLeft = Math.max(0, trialLength - daysPassed);
  }

  return json({
    apiKey: process.env.SHOPIFY_API_KEY,
    shop: session.shop,
    trialDaysLeft,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, redirect, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan");

  const returnUrl = `https://admin.shopify.com/store/${session.shop.split(".")[0]}/apps/${process.env.SHOPIFY_API_KEY}/app`;

  try {
    const confirmationUrl = await billing.request({
      plan: plan as any,
      isTest: true,
      returnUrl,
    });
    return redirect(confirmationUrl, { target: "_parent" });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    const reauthUrl = error.headers?.get?.(
      "X-Shopify-API-Request-Failure-Reauthorize-Url",
    );
    if (reauthUrl) return redirect(reauthUrl, { target: "_parent" });
    return json({ error: "Billing failed" }, { status: 500 });
  }
};

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting" || nav.state === "loading";
  const [isAnnual, setIsAnnual] = useState(false);

  const FeatureItem = ({
    text,
    bold = false,
  }: {
    text: string;
    bold?: boolean;
  }) => (
    <Box paddingBlockEnd="100">
      <InlineStack gap="300" align="start" blockAlign="center" wrap={false}>
        <Box width="20px">
          <Icon source={CheckCircleIcon} tone="success" />
        </Box>
        <Text as="span" variant="bodyMd" fontWeight={bold ? "bold" : "regular"}>
          {text}
        </Text>
      </InlineStack>
    </Box>
  );

  return (
    <Page
      title="Plans & Billing"
      subtitle="Scale your local recovery with the plan that fits your volume."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="600">
        {data.trialDaysLeft > 0 && (
          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p">
                You are currently in your <strong>14-day free trial</strong>.
                There are <strong>{data.trialDaysLeft} days</strong> remaining.
              </Text>
            </BlockStack>
          </Banner>
        )}

        {/* MONTHLY / ANNUAL TOGGLE */}
        <Box paddingBlockEnd="400">
          <InlineStack align="center" blockAlign="center">
            <ButtonGroup variant="segmented">
              <Button pressed={!isAnnual} onClick={() => setIsAnnual(false)}>
                Monthly
              </Button>
              <Button pressed={isAnnual} onClick={() => setIsAnnual(true)}>
                {/* @ts-expect-error: Polaris types children as strings, but React safely renders this DOM at runtime */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span>Yearly</span>
                  <span
                    style={{
                      backgroundColor: "var(--p-color-bg-surface-success)",
                      color: "var(--p-color-text-success)",
                      padding: "2px 6px",
                      borderRadius: "100px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      lineHeight: "1",
                      border: "1px solid var(--p-color-border-success-subdued)",
                    }}
                  >
                    Save 20%
                  </span>
                </div>
              </Button>
            </ButtonGroup>
          </InlineStack>
        </Box>

        <Layout>
          {/* BASIC PLAN */}
          <Layout.Section variant="oneThird">
            <Card>
              <Box minHeight="320px">
                <BlockStack gap="400">
                  <InlineStack gap={"200"}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Icon source={LocationIcon} tone="base" />
                    </div>
                    <Text as="h2" variant="headingMd">
                      Basic Recovery
                    </Text>
                  </InlineStack>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      ${isAnnual ? "279.00" : "29.00"}{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        {isAnnual ? "/ year" : "/ month"}
                      </Text>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Perfect for small shops starting out.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Up to $1,000 / mo recovered" bold />
                    <FeatureItem text="Geofenced Delivery Checking" />
                    <FeatureItem text="Standard Recovery Emails" />
                    <FeatureItem text="Tracking Dashboard" />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Box paddingBlockStart="400">
                <Form method="post">
                  <input
                    type="hidden"
                    name="plan"
                    value={isAnnual ? PLAN_BASIC_ANNUAL : PLAN_BASIC_MONTHLY}
                  />
                  <Button submit loading={isSubmitting} fullWidth>
                    Start 14-Day Free Trial
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>

          {/* PRO PLAN */}
          <Layout.Section variant="oneThird">
            <Card background="bg-surface-secondary">
              <Box minHeight="320px">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <InlineStack gap="200" align="center">
                        <Icon source={MagicIcon} tone="magic" />
                        <Text as="h2" variant="headingMd">
                          Pro Suite
                        </Text>
                      </InlineStack>
                    </div>
                    <Badge tone="success">POPULAR</Badge>
                  </InlineStack>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      ${isAnnual ? "469.00" : "49.00"}{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        {isAnnual ? "/ year" : "/ month"}
                      </Text>
                    </Text>
                    <Text
                      as="p"
                      variant="bodySm"
                      tone="success"
                      fontWeight="bold"
                    >
                      Unlock your AI copywriter.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Up to $5,000 / mo recovered" bold />
                    <FeatureItem text="Autonomous AI Emails" bold />
                    <FeatureItem text="A/B Offer Testing" />
                    <FeatureItem text="Customizable Badges" />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Box paddingBlockStart="400">
                <Form method="post">
                  <input
                    type="hidden"
                    name="plan"
                    value={isAnnual ? PLAN_PRO_ANNUAL : PLAN_PRO_MONTHLY}
                  />
                  <Button
                    submit
                    variant="primary"
                    loading={isSubmitting}
                    fullWidth
                  >
                    Start 14-Day Free Trial
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>

          {/* ELITE PLAN */}
          <Layout.Section variant="oneThird">
            <Card>
              <Box minHeight="320px">
                <BlockStack gap="400">
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <Icon source={StarFilledIcon} tone="warning" />
                    </div>
                    <Text as="h2" variant="headingMd">
                      Elite Enterprise
                    </Text>
                  </InlineStack>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      ${isAnnual ? "949.00" : "99.00"}{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        {isAnnual ? "/ year" : "/ month"}
                      </Text>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      For high-volume local networks.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Unlimited recovered revenue" bold />
                    <FeatureItem text="Everything in Pro Suite" />
                    <FeatureItem text="Priority 24/7 Support" />
                    <FeatureItem text="Multi-Location (Coming Soon)" bold />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Box paddingBlockStart="400">
                <Form method="post">
                  <input
                    type="hidden"
                    name="plan"
                    value={isAnnual ? PLAN_ELITE_ANNUAL : PLAN_ELITE_MONTHLY}
                  />
                  <Button submit loading={isSubmitting} fullWidth>
                    Start 14-Day Free Trial
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>

        <Box paddingBlockStart="200">
          <InlineStack align="center" gap="200" blockAlign="center">
            <div style={{ display: "flex" }}>
              <Icon source={CashDollarIcon} tone="base" />
            </div>
            <Text as="span" tone="subdued" variant="bodySm">
              Secure payments processed natively by Shopify. Cancel anytime.
            </Text>
          </InlineStack>
        </Box>

        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Text as="h2" variant="headingMd">
                Plan Comparison
              </Text>
            </Box>
            <IndexTable
              resourceName={{ singular: "feature", plural: "features" }}
              itemCount={8}
              headings={[
                { title: "Features" },
                { title: "Basic ($29)", alignment: "center" },
                { title: "Pro Suite ($49)", alignment: "center" },
                { title: "Elite ($99)", alignment: "center" },
              ]}
              selectable={false}
            >
              {[
                {
                  id: "1",
                  name: "Recovered Revenue Limit",
                  basic: "Up to $1,000/mo",
                  pro: "Up to $5,000/mo",
                  elite: "Unlimited",
                },
                {
                  id: "2",
                  name: "Geofenced Delivery Radius",
                  basic: "Fixed (6 miles)",
                  pro: "Custom (Unlimited)",
                  elite: "Custom (Unlimited)",
                },
                {
                  id: "3",
                  name: "Storefront Widget Design",
                  basic: "Standard",
                  pro: "Fully Customizable",
                  elite: "Fully Customizable",
                },
                {
                  id: "4",
                  name: "Cart Recovery Emails",
                  basic: "Standard Template",
                  pro: "Autonomous AI Agent",
                  elite: "Autonomous AI Agent",
                },
                {
                  id: "5",
                  name: "A/B Offer Testing",
                  basic: false,
                  pro: true,
                  elite: true,
                },
                {
                  id: "6",
                  name: "Revenue Leaks Detection",
                  basic: false,
                  pro: true,
                  elite: true,
                },
                {
                  id: "7",
                  name: "Deep Revenue Insights",
                  basic: false,
                  pro: true,
                  elite: true,
                },
                {
                  id: "8",
                  name: "Support",
                  basic: "Email",
                  pro: "Priority",
                  elite: "24/7 Priority",
                },
              ].map((row, index) => (
                <IndexTable.Row id={row.id} key={row.id} position={index}>
                  <IndexTable.Cell>
                    <Text fontWeight="bold" as="span">
                      {row.name}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {typeof row.basic === "boolean" ? (
                        row.basic ? (
                          <Icon source={CheckCircleIcon} tone="success" />
                        ) : (
                          <Text as="span" tone="subdued">
                            —
                          </Text>
                        )
                      ) : (
                        <Text as="span">{row.basic}</Text>
                      )}
                    </div>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {typeof row.pro === "boolean" ? (
                        row.pro ? (
                          <Icon source={CheckCircleIcon} tone="success" />
                        ) : (
                          <Text as="span" tone="subdued">
                            —
                          </Text>
                        )
                      ) : (
                        <Text as="span" fontWeight="bold">
                          {row.pro}
                        </Text>
                      )}
                    </div>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {typeof row.elite === "boolean" ? (
                        row.elite ? (
                          <Icon source={CheckCircleIcon} tone="success" />
                        ) : (
                          <Text as="span" tone="subdued">
                            —
                          </Text>
                        )
                      ) : (
                        <Text as="span" fontWeight="bold">
                          {row.elite}
                        </Text>
                      )}
                    </div>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </Layout.Section>
      </BlockStack>
    </Page>
  );
}
