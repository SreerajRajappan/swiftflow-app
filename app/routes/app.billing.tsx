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
} from "@shopify/polaris-icons";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants";

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
    return Response.json({ error: "Billing failed" }, { status: 500 });
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
          {/* BASIC PLAN */}
          <Layout.Section variant="oneHalf">
            <Card>
              <Box minHeight="380px">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Basic Personalizer
                  </Text>
                  <BlockStack gap="100">
                    <Text as="h1" variant="headingLg">
                      $4.99{" "}
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
          <Layout.Section variant="oneHalf">
            <Card background="bg-surface-secondary">
              <Box minHeight="380px">
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <InlineStack gap="200">
                      <Icon source={StarIcon} tone="warning" />
                      <Text as="h2" variant="headingMd">
                        Pro Suite
                      </Text>
                    </InlineStack>
                    <Badge tone="success">7-DAY FREE TRIAL</Badge>
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
                      Save 10+ hours/week with Automated Routing & turn
                      abandoned carts into recovered revenue.
                    </Text>
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Everything in Basic" bold />
                    <FeatureItem text="Neighborhood Delivery Optimizer" bold />
                    <FeatureItem text="Live Social Proof (Fire Bubbles)" bold />
                    <FeatureItem text="Automated Order Recovery" />
                    <FeatureItem text="Priority 24/7 Chat Support" />
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
        </Layout>

        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Text as="h2" variant="headingMd">
                Feature Comparison
              </Text>
            </Box>
            <IndexTable
              resourceName={{ singular: "feature", plural: "features" }}
              itemCount={5}
              headings={[
                { title: "Power Features" },
                { title: "Basic", alignment: "center" },
                { title: "Pro", alignment: "center" },
              ]}
              selectable={false}
            >
              {[
                {
                  id: "1",
                  name: "Product Personalization",
                  basic: true,
                  pro: true,
                },
                {
                  id: "2",
                  name: "Delivery Optimizer (KM/Miles)",
                  basic: false,
                  pro: true,
                },
                {
                  id: "3",
                  name: "Social Proof Widgets",
                  basic: false,
                  pro: true,
                },
                {
                  id: "4",
                  name: "Revenue Performance Tracking",
                  basic: false,
                  pro: true,
                },
                {
                  id: "5",
                  name: "Order Recovery System",
                  basic: false,
                  pro: true,
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
                      <Icon source={CheckCircleIcon} tone="success" />
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
