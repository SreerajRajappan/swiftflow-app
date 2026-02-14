import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import confetti from "canvas-confetti";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  ColorPicker,
  Text,
  hsbToHex,
  BlockStack,
  InlineStack,
  Box,
  Button,
  Banner,
  Tabs,
  Badge,
  Divider,
  Icon,
  EmptyState,
  IndexTable,
} from "@shopify/polaris";
import {
  EditIcon,
  OrderIcon,
  ProductIcon,
  MoneyIcon,
  ChartVerticalIcon,
  ViewIcon,
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "app/constants";

// Utility: HEX to HSB
function hexToHsb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((s) => s + s)
      .join("");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max === 0 ? 0 : delta / max, brightness: max };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Run the Billing Check
  const billingCheck = await billing.check({
    plans: [MONTHLY_PLAN_PRO, MONTHLY_PLAN_BASIC],
    isTest: true, // REMINDER: Change to false for production
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );

  const isPro = subscription?.name === MONTHLY_PLAN_PRO;
  const planName = subscription?.name || "FREE";
  const trialDaysLeft = subscription?.trialDays || 0;

  // 2. Fetch App Settings and Total Social Proof Views
  const settings = await prisma.appSettings.findUnique({
    where: { shop },
  });

  const totalViews = await prisma.productView.count({
    where: { shop },
  });

  // 3. Fetch Conversion Data for Analytics Boxes
  const conversionData = await prisma.conversion.aggregate({
    // where: { shop }, // REMINDER: Uncomment for Production
    _sum: { amount: true },
    _count: { id: true },
  });

  const totalRevenue = conversionData._sum.amount || 0;
  const conversionCount = conversionData._count.id || 0;
  const dailyGoal = 500;

  const goalProgress = (totalRevenue / dailyGoal) * 100;

  const conversionRate =
    totalViews > 0 ? ((conversionCount / totalViews) * 100).toFixed(2) : "0.00";

  // 4. Fetch 5 Most Recent Conversions for the Table
  const recentConversions = await prisma.conversion.findMany({
    // where: { shop }, // REMINDER: Uncomment for Production
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // 5. Fetch Trending Data and Enrich with Shopify Title/Image + Revenue
  const trendingData = await prisma.productView.groupBy({
    by: ["productId"],
    where: { shop },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 5,
  });

  const enrichedProducts = await Promise.all(
    trendingData.map(async (item) => {
      try {
        // Fetch Product Details from Shopify
        const response = await admin.graphql(
          `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              title
              featuredMedia {
                preview {
                  image {
                    url
                  }
                }
              }
            }
          }`,
          { variables: { id: item.productId } },
        );

        const responseJson = await response.json();
        const product = responseJson.data?.product;
        const imageUrl = product?.featuredMedia?.preview?.image?.url || "";

        // Fetch Revenue specifically for this product
        const salesForProduct = await prisma.conversion.aggregate({
          // where: { shop }, // REMINDER: Uncomment for Production
          where: { productId: item.productId }, // REMINDER: Add shop filter for Production
          _sum: { amount: true },
        });

        return {
          ...item,
          title: product?.title || "Unknown Product",
          image: imageUrl,
          revenue: salesForProduct._sum.amount || 0,
        };
      } catch (e) {
        return { ...item, title: "Product Deleted", image: "", revenue: 0 };
      }
    }),
  );

  return {
    shop,
    settings,
    totalViews,
    totalRevenue,
    conversionRate,
    recentConversions,
    dailyGoal,
    goalProgress: Math.min(goalProgress, 100).toFixed(0),
    trendingProducts: enrichedProducts,
    isPro,
    planName,
    trialDaysLeft,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  if (formData.get("intent") === "reset_data") {
    await prisma.conversion.deleteMany({
      // where: { shop }, // REMINDER: Uncomment for production
    });

    return { success: true, message: "Data reset successfully" };
  }

  const customText = formData.get("customText") as string;
  const customColor = formData.get("customColor") as string;
  const isEnabled = formData.get("isEnabled") === "true";

  await prisma.appSettings.upsert({
    where: { shop },
    update: { customText, customColor, isEnabled },
    create: { shop, customText, customColor, isEnabled },
  });

  return { success: true };
};

const SALES_EMOJIS = ["🔥", "👀", "⚡", "🛒", "⭐", "🎉", "🛍️", "🚀"];

export default function Index() {
  const shopify = useAppBridge();
  const {
    shop,
    settings,
    totalViews,
    trendingProducts,
    isPro,
    trialDaysLeft,
    totalRevenue,
    conversionRate,
    dailyGoal,
    goalProgress,
    recentConversions,
  } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();
  const isSaving = nav.state === "submitting";

  const [selectedTab, setSelectedTab] = useState(0);
  const handleTabChange = useCallback(
    (index: number) => setSelectedTab(index),
    [],
  );

  const [customText, setCustomText] = useState("");
  const [color, setColor] = useState(
    hexToHsb(settings?.customColor || "#5c6ac4"),
  );
  const [isEnabled, setIsEnabled] = useState(settings?.isEnabled ?? true);
  const hexColor = hsbToHex(color);

  useEffect(() => {
    if (parseFloat(goalProgress) >= 100 && selectedTab === 2) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 999,
      };

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
        });
      }, 250);
    }
  }, [goalProgress, selectedTab]);

  useEffect(() => {
    if (actionData?.success) {
      let toastMessage = "Settings saved successfully";

      if ("message" in actionData && typeof actionData.message === "string") {
        toastMessage = actionData.message;
      }

      shopify?.toast?.show(toastMessage, { duration: 3000 });
    }
  }, [actionData, shopify]);

  const tabs = [
    { id: "personalizer", content: "Personalizer", panelID: "personalizer" },
    { id: "delivery", content: "Delivery", panelID: "delivery" },
    { id: "revenue", content: "Revenue Suite", panelID: "revenue" },
    { id: "insights", content: "Insights", panelID: "insights" },
  ];

  const handleSave = () => {
    submit(
      {
        customText,
        customColor: hexColor,
        isEnabled: String(isEnabled),
      },
      { method: "POST" },
    );
  };

  return (
    <Page title="SwiftFlow Admin">
      <TitleBar title="SwiftFlow: Revenue Suite">
        <button onClick={handleSave} variant="primary">
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </TitleBar>

      <BlockStack gap="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            {/* PERSONALIZER TAB */}
            {selectedTab === 0 && (
              <BlockStack gap="400">
                {isPro && trialDaysLeft > 0 && (
                  <Banner tone="info">
                    <Text as="p" variant="bodyMd">
                      You have <strong>{trialDaysLeft} days</strong> left in
                      your Pro trial. Enjoy your Revenue Insights!
                    </Text>
                  </Banner>
                )}
                <Layout>
                  <Layout.Section variant="oneHalf">
                    <Card>
                      <BlockStack gap="300">
                        <Box paddingBlockStart="100" paddingBlockEnd="200">
                          <InlineStack
                            gap="200"
                            align="start"
                            blockAlign="center"
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                height: "24px",
                              }}
                            >
                              <Icon source={EditIcon} tone="base" />
                            </div>
                            <Text as="h2" variant="headingMd">
                              Personalizer Configuration
                            </Text>
                          </InlineStack>
                        </Box>
                        <TextField
                          label="Widget Text"
                          placeholder="e.g., 🔥 15 people are viewing this right now!"
                          value={customText}
                          onChange={setCustomText}
                          autoComplete="off"
                          helpText="Use emojis to increase urgency and social proof."
                        />
                        <Box>
                          <BlockStack gap="100">
                            <Text
                              as="p"
                              variant="bodyXs"
                              fontWeight="bold"
                              tone="subdued"
                            >
                              QUICK ADD ICONS
                            </Text>
                            <InlineStack gap="200">
                              {SALES_EMOJIS.map((emoji) => (
                                <Button
                                  key={emoji}
                                  size="micro"
                                  onClick={() =>
                                    setCustomText((prev) =>
                                      prev ? `${prev} ${emoji}` : emoji,
                                    )
                                  }
                                >
                                  {emoji}
                                </Button>
                              ))}
                            </InlineStack>
                          </BlockStack>
                        </Box>
                        <Box>
                          <Text as="p" variant="bodyMd">
                            Color
                          </Text>
                          <Box paddingBlockStart="200">
                            <ColorPicker onChange={setColor} color={color} />
                          </Box>
                        </Box>
                        <Divider />
                        <Button
                          loading={isSaving}
                          onClick={handleSave}
                          variant="primary"
                          fullWidth
                        >
                          Update Storefront
                        </Button>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                  <Layout.Section variant="oneHalf">
                    <Card>
                      <BlockStack gap="400">
                        <Box paddingBlockStart="100" paddingBlockEnd="200">
                          <Text as="h2" variant="headingMd">
                            Live Preview
                          </Text>
                        </Box>
                        <Box
                          background="bg-surface-secondary"
                          padding="1000"
                          borderRadius="300"
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: "250px",
                            }}
                          >
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "12px 24px",
                                backgroundColor: hexColor
                                  ? `${hexColor}15`
                                  : "#fbeae5",
                                border: `1px solid ${hexColor || "#de3618"}`,
                                borderRadius: "50px",
                                color: hexColor || "#de3618",
                                fontWeight: "600",
                                fontSize: "16px",
                                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                              }}
                            >
                              {customText ||
                                "🔥 15 people are viewing this right now!"}
                            </div>
                          </div>
                        </Box>
                        <Box paddingBlockStart="200">
                          <BlockStack gap="200">
                            <Text
                              as="p"
                              variant="bodySm"
                              tone="subdued"
                              alignment="center"
                            >
                              This is exactly how the widget will appear below
                              the "Add to Cart" button.
                            </Text>
                            <Text
                              as="p"
                              variant="bodySm"
                              tone="subdued"
                              alignment="center"
                            >
                              <Text as="span" fontWeight="bold">
                                Pro Tip:
                              </Text>{" "}
                              Use emojis like 🔥 or 👀 to increase urgency!
                            </Text>
                          </BlockStack>
                        </Box>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            )}

            {/* DELIVERY TAB */}
            {selectedTab === 1 && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <InlineStack gap="200">
                        <Icon source={OrderIcon} tone="base" />
                        <Text as="h2" variant="headingMd">
                          Neighborhood Delivery Routing
                        </Text>
                      </InlineStack>
                      <Badge tone="attention">Pro Plan</Badge>
                    </InlineStack>
                    <Divider />
                    <EmptyState
                      heading="Setup your delivery zones"
                      action={{ content: "Configure Zones" }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Group orders by neighborhood to save time and fuel.</p>
                    </EmptyState>
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}

            {/* REVENUE SUITE TAB */}
            {selectedTab === 2 && (
              <Layout>
                <Layout.Section>
                  <BlockStack gap="400">
                    <Card>
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text as="h2" variant="headingMd">
                            Daily Revenue Goal
                          </Text>
                          <Text as="p" variant="bodyMd" fontWeight="bold">
                            ${totalRevenue.toFixed(2)} / ${dailyGoal}
                          </Text>
                        </InlineStack>
                        <div
                          style={{
                            width: "100%",
                            backgroundColor:
                              "var(--p-color-bg-surface-secondary)",
                            borderRadius: "10px",
                            height: "12px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${goalProgress}%`,
                              backgroundColor: "var(--p-color-text-success)",
                              height: "100%",
                              transition: "width 0.5s ease-in-out",
                            }}
                          />
                        </div>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {goalProgress}% of your daily target reached. Keep it
                          up!
                        </Text>
                      </BlockStack>
                    </Card>

                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between">
                          <InlineStack gap="200">
                            <Icon source={ProductIcon} tone="base" />
                            <Text as="h2" variant="headingMd">
                              Social Proof Master Control
                            </Text>
                          </InlineStack>
                          <Badge tone={isEnabled ? "success" : "critical"}>
                            {isEnabled ? "Live on Store" : "Paused"}
                          </Badge>
                        </InlineStack>
                        <Text as="p" tone="subdued">
                          Use this switch to instantly enable or disable widgets
                          on your storefront.
                        </Text>
                        <Button
                          tone={isEnabled ? "critical" : "success"}
                          variant="primary"
                          loading={isSaving}
                          onClick={() => {
                            const newState = !isEnabled;
                            setIsEnabled(newState);
                            submit(
                              {
                                customText,
                                customColor: hexColor,
                                isEnabled: String(newState),
                              },
                              { method: "POST" },
                            );
                          }}
                        >
                          {isEnabled
                            ? "Disable Revenue Suite"
                            : "Enable Revenue Suite"}
                        </Button>
                      </BlockStack>
                    </Card>

                    <Card>
                      <BlockStack gap="500">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            <Icon source={ChartVerticalIcon} tone="base" />
                            <Text as="h2" variant="headingMd">
                              Performance Analytics
                            </Text>
                            <Badge tone="success">Real-time Proof</Badge>
                          </InlineStack>

                          {/* ONLY show this button if the shop is your development store */}
                          {shop === "your-dev-store.myshopify.com" && (
                            <Button
                              tone="critical"
                              variant="tertiary"
                              size="slim"
                              onClick={() => {
                                if (
                                  confirm(
                                    "DEV ONLY: Permanently delete conversion data?",
                                  )
                                ) {
                                  submit(
                                    { intent: "reset_data" },
                                    { method: "POST" },
                                  );
                                }
                              }}
                            >
                              Reset Test Data
                            </Button>
                          )}
                        </InlineStack>
                        <InlineStack gap="400" align="start">
                          {[
                            {
                              label: "Est. Revenue Boost",
                              value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                              icon: MoneyIcon,
                              bg: "bg-surface-success",
                              iconTone: "success" as const,
                              color: "var(--p-color-text-success)",
                            },
                            {
                              label: "Conversion Lift",
                              value: `${conversionRate}%`,
                              icon: ChartVerticalIcon,
                              bg: "bg-surface-info",
                              iconTone: "base" as const,
                              color: "var(--p-color-text-info)",
                            },
                            {
                              label: "Live Impressions",
                              value: totalViews.toLocaleString(),
                              icon: ViewIcon,
                              bg: "bg-surface-secondary",
                              iconTone: "base" as const,
                              color: "var(--p-color-text-secondary)",
                            },
                          ].map((box, i) => (
                            <Box
                              key={i}
                              background={box.bg as any}
                              padding="500"
                              borderRadius="300"
                              width="220px"
                            >
                              <BlockStack gap="200" align="center">
                                <InlineStack align="center">
                                  <Icon source={box.icon} tone={box.iconTone} />
                                </InlineStack>
                                <Text
                                  as="p"
                                  variant="bodySm"
                                  fontWeight="medium"
                                  alignment="center"
                                  tone="subdued"
                                >
                                  {box.label}
                                </Text>
                                <Box paddingBlockStart="100">
                                  <Text
                                    as="h2"
                                    variant="headingLg"
                                    alignment="center"
                                  >
                                    <span style={{ color: box.color }}>
                                      {box.value}
                                    </span>
                                  </Text>
                                </Box>
                              </BlockStack>
                            </Box>
                          ))}
                        </InlineStack>
                        <Divider />
                        <Box>
                          <Text as="p" variant="bodySm" tone="subdued">
                            <Text as="span" fontWeight="bold">
                              How we calculate this:
                            </Text>{" "}
                            We track orders placed after widget interaction
                            compared to impressions.
                          </Text>
                        </Box>
                      </BlockStack>
                    </Card>

                    <Card padding="0">
                      <Box padding="400">
                        <Text as="h2" variant="headingMd">
                          Recent Conversions
                        </Text>
                      </Box>
                      <IndexTable
                        resourceName={{
                          singular: "conversion",
                          plural: "conversions",
                        }}
                        itemCount={recentConversions.length}
                        headings={[
                          { title: "Date" },
                          { title: "Product ID" },
                          { title: "Revenue", alignment: "end" },
                        ]}
                        selectable={false}
                      >
                        {recentConversions.map((conv, index) => (
                          <IndexTable.Row
                            id={conv.id.toString()}
                            key={conv.id}
                            position={index}
                          >
                            <IndexTable.Cell>
                              {new Date(conv.createdAt).toLocaleTimeString()}
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodySm" tone="subdued">
                                {conv.productId
                                  ? conv.productId.split("/").pop()
                                  : "N/A"}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <div style={{ textAlign: "right" }}>
                                <Text
                                  as="span"
                                  fontWeight="bold"
                                  tone="success"
                                >
                                  +${conv.amount.toFixed(2)}
                                </Text>
                              </div>
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        ))}
                      </IndexTable>
                    </Card>
                    <Box paddingBlockEnd="500" />
                  </BlockStack>
                </Layout.Section>
              </Layout>
            )}

            {/* INSIGHTS TAB */}
            {selectedTab === 3 &&
              (isPro ? (
                <Layout>
                  <Layout.Section>
                    <Card>
                      <BlockStack gap="400">
                        {/* HEADER SECTION: Matches Delivery Tab structure exactly */}
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200">
                            <Icon source={ChartVerticalIcon} tone="base" />
                            <Text variant="headingMd" as="h2">
                              Trending Products (Top 5)
                            </Text>
                          </InlineStack>
                          {/* Keeping it consistent with a Pro badge like Delivery */}
                          <Badge tone="info">Verified Data</Badge>
                        </InlineStack>

                        <Divider />
                        {trendingProducts.length > 0 ? (
                          <IndexTable
                            resourceName={{
                              singular: "product",
                              plural: "products",
                            }}
                            itemCount={trendingProducts.length}
                            headings={[
                              { title: "" },
                              { title: "Product Name" },
                              { title: "Social Proof Views" },
                              { title: "Revenue Generated", alignment: "end" },
                            ]}
                            selectable={false}
                          >
                            {trendingProducts.map((product, index) => (
                              <IndexTable.Row
                                id={product.productId}
                                key={index}
                                position={index}
                              >
                                <IndexTable.Cell>
                                  {product.image && (
                                    <Box width="40px">
                                      <img
                                        src={product.image}
                                        alt={product.title}
                                        style={{
                                          width: "100%",
                                          borderRadius: "4px",
                                        }}
                                      />
                                    </Box>
                                  )}
                                </IndexTable.Cell>
                                <IndexTable.Cell>
                                  <Text as="p" fontWeight="bold">
                                    {product.title}
                                  </Text>
                                  <Text as="p" variant="bodyXs" tone="subdued">
                                    {product.productId.split("/").pop()}
                                  </Text>
                                </IndexTable.Cell>
                                <IndexTable.Cell>
                                  <InlineStack gap="100">
                                    <Badge tone="info">{`${product._count.productId} views`}</Badge>
                                    <Badge tone="success">Verified</Badge>
                                  </InlineStack>
                                </IndexTable.Cell>
                                <IndexTable.Cell>
                                  <div style={{ textAlign: "right" }}>
                                    <Text
                                      as="p"
                                      fontWeight="bold"
                                      tone="success"
                                    >
                                      ${product.revenue?.toFixed(2) || "0.00"}
                                    </Text>
                                  </div>
                                </IndexTable.Cell>
                              </IndexTable.Row>
                            ))}
                          </IndexTable>
                        ) : (
                          <Box padding="1000">
                            <EmptyState
                              heading="No trending data yet"
                              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                            >
                              <p>
                                Once customers start viewing products on your
                                store, your top-performing items will appear
                                here.
                              </p>
                            </EmptyState>
                          </Box>
                        )}
                      </BlockStack>
                    </Card>
                    <Box paddingBlockEnd="1000" />
                  </Layout.Section>
                </Layout>
              ) : (
                /* PRO UPGRADE WALL */
                <Box padding="1000">
                  <EmptyState
                    heading="Unlock Deep Revenue Insights"
                    action={{
                      content: "Upgrade to Pro",
                      onAction: () => navigate("/app/billing"),
                    }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      The Insights tab is a Pro feature. Upgrade to see which
                      products are driving your views.
                    </p>
                  </EmptyState>
                </Box>
              ))}
          </Box>
        </Tabs>
      </BlockStack>
    </Page>
  );
}
