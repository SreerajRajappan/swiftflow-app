import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { Page, BlockStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants";
import { PersonalizerTab } from "../components/PersonalizerTab";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const billingCheck = await billing.check({
    plans: [MONTHLY_PLAN_PRO, MONTHLY_PLAN_BASIC],
    isTest: true,
  });

  const subscription = billingCheck.appSubscriptions.find(
    (sub) => sub.status === "ACTIVE",
  );
  const isPro = subscription?.name === MONTHLY_PLAN_PRO;

  let trialDaysLeft = 0;
  if (subscription && subscription.trialDays) {
    const createdAt = new Date(subscription.createdAt);
    const trialLength = subscription.trialDays;
    const now = new Date();
    const diffInMs = now.getTime() - createdAt.getTime();
    const daysPassed = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, trialLength - daysPassed);
  }

  const settings = await prisma.appSettings.findUnique({ where: { shop } });

  return json({
    settings,
    isPro,
    trialDaysLeft,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-personalizer") {
    const customText = formData.get("customText") as string;
    const customColor = formData.get("customColor") as string;
    const buttonText = formData.get("buttonText") as string;
    const fontSize = String(formData.get("fontSize") || "16");

    await prisma.appSettings.update({
      where: { shop },
      data: {
        headerText: customText,
        headerColor: customColor,
        buttonText: buttonText,
        fontSize,
      },
    });

    return json({
      success: true,
      message: "Widget styling saved and published!",
    });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function PersonalizerRoute() {
  const shopify = useAppBridge();
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const [fontSize, setFontSize] = useState(
    Number(data.settings?.fontSize) || 16,
  );
  const [customText, setCustomText] = useState(data.settings?.headerText || "");
  const [buttonText, setButtonText] = useState(
    data.settings?.buttonText || "Check Availability",
  );
  const [hexColor, setHexColor] = useState(
    data.settings?.headerColor || "#5c6ac4",
  );

  const handleSave = () => {
    fetcher.submit(
      {
        intent: "save-personalizer",
        customText,
        customColor: hexColor,
        buttonText,
        fontSize: String(fontSize),
      },
      { method: "POST" },
    );
  };

  useEffect(() => {
    // 👇 TypeScript Fix: Explicitly cast the fetcher data shape
    const actionData = fetcher.data as
      | { success?: boolean; error?: string; message?: string }
      | undefined;

    if (actionData?.success) {
      shopify?.toast?.show(actionData.message || "Saved successfully");
    } else if (actionData?.error) {
      shopify?.toast?.show(actionData.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="Storefront Widget Personalizer">
      <TitleBar title="Storefront Widget Personalizer" />
      <BlockStack gap="400">
        <PersonalizerTab
          isPro={data.isPro}
          trialDaysLeft={data.trialDaysLeft}
          customText={customText}
          setCustomText={setCustomText}
          buttonText={buttonText}
          setButtonText={setButtonText}
          hexColor={hexColor}
          setHexColor={setHexColor}
          fontSize={fontSize}
          setFontSize={setFontSize}
          isSaving={fetcher.state === "submitting"}
          handleSave={handleSave}
          navigate={navigate}
        />
      </BlockStack>
    </Page>
  );
}
