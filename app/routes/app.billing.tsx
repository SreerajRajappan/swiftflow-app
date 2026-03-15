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
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  StarIcon,
  CashDollarIcon,
  LocationIcon,
} from "@shopify/polaris-icons";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useNavigation, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  const billingCheck = await billing.check({
    plans: [MONTHLY_PLAN_PRO, MONTHLY_PLAN_BASIC],
    isTest: true,
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );

  let trialDaysLeft = 0;
  if (subscription && subscription.trialDays) {
    const createdAt = new Date(subscription.createdAt);
    const trialLength = subscription.trialDays;
    const now = new Date();
    const diffInMs = now.getTime() - createdAt.getTime();
    const daysPassed = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, trialLength - daysPassed);
  }

  return json({
    apiKey: process.env.SHOPIFY_API_KEY,
    shop: session.shop,
    trialDaysLeft, // 👇 Now being returned correctly
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
      returnUrl: returnUrl,
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
      subtitle="Rescue local delivery drop-offs before they buy from a competitor."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="500">
        {/* TRIAL STATUS BANNER */}
        {data.trialDaysLeft > 0 && (
          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p">
                You are currently in your <strong>14-day free trial</strong>.
                There are <strong>{data.trialDaysLeft} days</strong> remaining.
              </Text>
              <Text as="p" variant="bodySm">
                Your selected plan will begin automatically once the trial ends.
                You can change plans or cancel at any time.
              </Text>
            </BlockStack>
          </Banner>
        )}

        <Layout>
          {/* BASIC PLAN */}
          <Layout.Section variant="oneHalf">
            <Card>
              <Box minHeight="380px">
                <BlockStack gap="400">
                  <InlineStack align="start" gap={"200"}>
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
                      $29.00{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        / month
                      </Text>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Perfect for small local shops starting out.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem
                      text="Up to $1,000 / mo in recovered revenue"
                      bold
                    />
                    <FeatureItem text="Geofenced Delivery Checking" />
                    <FeatureItem text="Standard Cart Recovery Emails" />
                    <FeatureItem text="Revenue Tracking Dashboard" />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Box paddingBlockStart="400">
                <Form method="post">
                  <input type="hidden" name="plan" value={MONTHLY_PLAN_BASIC} />
                  <Button submit loading={isSubmitting} fullWidth size="large">
                    Start 14-Day Free Trial
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>

          {/* PRO PLAN */}
          <Layout.Section variant="oneHalf">
            <Card background="bg-surface-secondary">
              <Box minHeight="380px">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        height: "32px",
                      }}
                    >
                      <Icon source={StarIcon} tone="warning" />
                      <Text as="h2" variant="headingMd">
                        Pro Suite
                      </Text>
                    </div>
                    <Badge tone="success">MOST POPULAR</Badge>
                  </InlineStack>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      $49.00{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        / month
                      </Text>
                    </Text>
                    <Text
                      as="p"
                      variant="bodySm"
                      tone="success"
                      fontWeight="bold"
                    >
                      Unlock your dedicated AI copywriter.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Everything in Basic" />
                    <FeatureItem text="Unlimited recovered revenue" bold />
                    <FeatureItem text="Autonomous AI Email Generation" bold />
                    <FeatureItem
                      text="A/B Offer Testing & Revenue Leaks"
                      bold
                    />
                    <FeatureItem text="Customizable Storefront Badges" bold />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Box paddingBlockStart="400">
                <Form method="post">
                  <input type="hidden" name="plan" value={MONTHLY_PLAN_PRO} />
                  <Button
                    submit
                    variant="primary"
                    loading={isSubmitting}
                    fullWidth
                    size="large"
                  >
                    Start 14-Day Free Trial
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>

        <Box paddingBlockEnd="800">
          <InlineStack align="center" gap="200">
            <Icon source={CashDollarIcon} tone="base" />
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
              ]}
              selectable={false}
            >
              {[
                {
                  id: "1",
                  name: "Recovered Revenue Limit",
                  basic: "Up to $1,000/mo",
                  pro: "Unlimited",
                },
                {
                  id: "2",
                  name: "Geofenced Delivery Radius",
                  basic: "Fixed (6 miles)",
                  pro: "Custom (Unlimited)",
                },
                {
                  id: "3",
                  name: "Storefront Widget Design",
                  basic: "Standard",
                  pro: "Fully Customizable",
                },
                {
                  id: "4",
                  name: "Cart Recovery Emails",
                  basic: "Standard Template",
                  pro: "Autonomous AI Agent",
                },
                { id: "5", name: "A/B Offer Testing", basic: false, pro: true },
                {
                  id: "6",
                  name: "Revenue Leaks Detection",
                  basic: false,
                  pro: true,
                },
                {
                  id: "7",
                  name: "Deep Revenue Insights",
                  basic: false,
                  pro: true,
                },
                { id: "8", name: "Support", basic: "Email", pro: "Priority" },
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
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </Layout.Section>
      </BlockStack>
    </Page>
  );
}
