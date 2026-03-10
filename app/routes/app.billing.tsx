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
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  StarIcon,
  CashDollarIcon,
  MagicIcon,
} from "@shopify/polaris-icons";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  MONTHLY_PLAN_BASIC,
  MONTHLY_PLAN_PRO,
  MONTHLY_PLAN_PLATINUM,
} from "../constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, redirect, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const plan = formData.get("plan");

  // Stable return URL for embedded apps
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

    console.error("Billing Error:", error);
    return json({ error: "Billing failed" }, { status: 500 });
  }
};

export default function BillingPage() {
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
      title="Scale Your Revenue"
      subtitle="Select the plan that matches your business goals."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="800">
        <Layout>
          {/* BASIC PLAN */}
          <Layout.Section variant="oneThird">
            <Card>
              <Box minHeight="420px">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Basic Personalizer
                  </Text>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      $9.99{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        / month
                      </Text>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Essential branding for growing shops.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Product Personalizer Widget" />
                    <FeatureItem text="Custom Colors & CSS" />
                    <FeatureItem text="Standard Analytics" />
                    <FeatureItem text="Email Support" />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Box paddingBlockStart="400">
                <Form method="post">
                  <input type="hidden" name="plan" value={MONTHLY_PLAN_BASIC} />
                  <Button submit loading={isSubmitting} fullWidth size="large">
                    Select Basic
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>

          {/* PRO PLAN */}
          <Layout.Section variant="oneThird">
            <Card background="bg-surface-secondary">
              <Box minHeight="420px">
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <InlineStack gap="200">
                      <Icon source={StarIcon} tone="warning" />
                      <Text as="h2" variant="headingMd">
                        Pro Suite
                      </Text>
                    </InlineStack>
                    <Badge tone="success">7-DAY TRIAL</Badge>
                  </InlineStack>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      $29.99{" "}
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
                      Turn abandoned carts into recovered revenue.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Everything in Basic" />
                    <FeatureItem text="Neighborhood Delivery Optimizer" bold />
                    <FeatureItem text="Live Social Proof Widgets" bold />
                    <FeatureItem text="Automated Order Recovery" />
                    <FeatureItem text="Priority Chat Support" />
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
                    Start Pro Free Trial
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>

          {/* PLATINUM PLAN */}
          <Layout.Section variant="oneThird">
            <Card background="bg-surface-magic">
              <Box minHeight="420px">
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <InlineStack gap="200">
                      <Icon source={MagicIcon} tone="magic" />
                      <Text as="h2" variant="headingMd">
                        Platinum AI
                      </Text>
                    </InlineStack>
                    <Badge tone="info">14-DAY TRIAL</Badge>
                  </InlineStack>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      $49.99{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        / month
                      </Text>
                    </Text>
                    <Text
                      as="p"
                      variant="bodySm"
                      tone="magic"
                      fontWeight="bold"
                    >
                      A dedicated AI Agent working for you 24/7.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Everything in Pro" />
                    <FeatureItem text="Autonomous AI Cart Recovery" bold />
                    <FeatureItem text="VIP Post-Purchase Upsell Agent" bold />
                    <FeatureItem text="AI A/B Test Optimizer" bold />
                    <FeatureItem text="Dedicated Account Manager" />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Box paddingBlockStart="400">
                <Form method="post">
                  <input
                    type="hidden"
                    name="plan"
                    value={MONTHLY_PLAN_PLATINUM}
                  />
                  <Button
                    submit
                    tone="success"
                    variant="primary"
                    loading={isSubmitting}
                    fullWidth
                    size="large"
                  >
                    Start Platinum Free Trial
                  </Button>
                </Form>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>

        {/* FEATURE COMPARISON TABLE */}
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Text as="h2" variant="headingMd">
                Feature Comparison
              </Text>
            </Box>
            <IndexTable
              resourceName={{ singular: "feature", plural: "features" }}
              itemCount={7}
              headings={[
                { title: "Power Features" },
                { title: "Basic", alignment: "center" },
                { title: "Pro", alignment: "center" },
                { title: "Platinum AI", alignment: "center" },
              ]}
              selectable={false}
            >
              {[
                {
                  id: "1",
                  name: "Product Personalization",
                  basic: true,
                  pro: true,
                  plat: true,
                },
                {
                  id: "2",
                  name: "Delivery Optimizer (KM/Miles)",
                  basic: false,
                  pro: true,
                  plat: true,
                },
                {
                  id: "3",
                  name: "Social Proof Widgets",
                  basic: false,
                  pro: true,
                  plat: true,
                },
                {
                  id: "4",
                  name: "Revenue Analytics Dashboard",
                  basic: false,
                  pro: true,
                  plat: true,
                },
                {
                  id: "5",
                  name: "Standard Order Recovery",
                  basic: false,
                  pro: true,
                  plat: true,
                },
                {
                  id: "6",
                  name: "Autonomous AI Cart Recovery",
                  basic: false,
                  pro: false,
                  plat: true,
                },
                {
                  id: "7",
                  name: "AI A/B Test Optimizer",
                  basic: false,
                  pro: false,
                  plat: true,
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
                      {row.basic ? (
                        <Icon source={CheckCircleIcon} tone="success" />
                      ) : (
                        <Text as="span" tone="subdued">
                          —
                        </Text>
                      )}
                    </div>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {row.pro ? (
                        <Icon source={CheckCircleIcon} tone="success" />
                      ) : (
                        <Text as="span" tone="subdued">
                          —
                        </Text>
                      )}
                    </div>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {row.plat ? (
                        <Icon source={CheckCircleIcon} tone="success" />
                      ) : (
                        <Text as="span" tone="subdued">
                          —
                        </Text>
                      )}
                    </div>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </Layout.Section>

        <Box paddingBlockEnd="800">
          <InlineStack align="center" gap="200">
            <Icon source={CashDollarIcon} tone="base" />
            <Text as="span" tone="subdued" variant="bodySm">
              Secure payments processed via Shopify Billing API.
            </Text>
          </InlineStack>
        </Box>
      </BlockStack>
    </Page>
  );
}
