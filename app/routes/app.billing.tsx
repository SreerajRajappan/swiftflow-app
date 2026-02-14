//app.billing.tsx
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
import { CheckCircleIcon } from "@shopify/polaris-icons";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, redirect, session } = await authenticate.admin(request); // Added session

  const formData = await request.formData();
  const plan = formData.get("plan");

  // Generate a clean return URL using the shop domain
  // This is often more stable than using process.env.SHOPIFY_APP_URL
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

    // Check for the 401 Reauth header we fixed earlier
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

  const FeatureItem = ({ text }: { text: string }) => (
    <Box paddingBlockEnd="100">
      <InlineStack gap="300" align="start" blockAlign="center" wrap={false}>
        <Box width="20px">
          <Icon source={CheckCircleIcon} tone="success" />
        </Box>
        <Text as="span" variant="bodyMd">
          {text}
        </Text>
      </InlineStack>
    </Box>
  );

  return (
    <Page
      title="Select Your Plan"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="800">
        <Layout>
          {/* BASIC PLAN */}
          <Layout.Section variant="oneHalf">
            <Card>
              <Box minHeight="320px">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Basic Personalizer
                  </Text>
                  <Text as="h1" variant="headingLg">
                    $9.99{" "}
                    <Text as="span" variant="bodySm" tone="subdued">
                      / month
                    </Text>
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Product Personalizer Widget" />
                    <FeatureItem text="Custom Color/Text Support" />
                    <FeatureItem text="Standard Support" />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Form method="post">
                <input type="hidden" name="plan" value={MONTHLY_PLAN_BASIC} />
                <Button submit loading={isSubmitting} fullWidth size="large">
                  Select Basic
                </Button>
              </Form>
            </Card>
          </Layout.Section>

          {/* PRO PLAN */}
          <Layout.Section variant="oneHalf">
            <Card background="bg-surface-secondary">
              <Box minHeight="320px">
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      Pro Suite
                    </Text>
                    <Badge tone="success">7-DAY FREE TRIAL</Badge>
                  </InlineStack>
                  <Text as="h1" variant="headingLg">
                    $29.99{" "}
                    <Text as="span" variant="bodySm" tone="subdued">
                      / month
                    </Text>
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <FeatureItem text="Everything in Basic" />
                    <FeatureItem text="Local Delivery Optimizer" />
                    <FeatureItem text="Live Social Proof Widgets" />
                    <FeatureItem text="Verified Revenue Insights" />
                  </BlockStack>
                </BlockStack>
              </Box>
              <Form method="post">
                <input type="hidden" name="plan" value={MONTHLY_PLAN_PRO} />
                <Button
                  submit
                  variant="primary"
                  loading={isSubmitting}
                  fullWidth
                  size="large"
                >
                  Start 7-Day Free Trial
                </Button>
              </Form>
            </Card>
          </Layout.Section>
        </Layout>

        {/* COMPARISON TABLE SECTION */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Plan Comparison
              </Text>
              <IndexTable
                resourceName={{ singular: "feature", plural: "features" }}
                itemCount={4}
                headings={[
                  { title: "Feature" },
                  { title: "Basic", alignment: "center" }, // Added alignment
                  { title: "Pro", alignment: "center" }, // Added alignment
                ]}
                selectable={false}
              >
                {[
                  { id: "1", name: "Personalization", basic: true, pro: true },
                  {
                    id: "2",
                    name: "Delivery Optimization",
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
                    name: "Revenue Insights",
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

                    {/* Centered Basic Column */}
                    <IndexTable.Cell>
                      <div
                        style={{ display: "flex", justifyContent: "center" }}
                      >
                        {row.basic ? (
                          <Icon source={CheckCircleIcon} tone="success" />
                        ) : (
                          <Text tone="subdued" as="span">
                            —
                          </Text>
                        )}
                      </div>
                    </IndexTable.Cell>

                    {/* Centered Pro Column */}
                    <IndexTable.Cell>
                      <div
                        style={{ display: "flex", justifyContent: "center" }}
                      >
                        {row.pro ? (
                          <Icon source={CheckCircleIcon} tone="success" />
                        ) : (
                          <Text tone="subdued" as="span">
                            —
                          </Text>
                        )}
                      </div>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </BlockStack>
          </Card>
        </Layout.Section>
      </BlockStack>
    </Page>
  );
}
