import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { Page, BlockStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants";
import { RevenueLeaksTab } from "../components/RevenueLeaksTab";
import { processAbandonedCarts } from "../services/email.server";
import { runCartRecoveryAgent } from "../agent.server";

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

  const activeLeaks = await prisma.revenueLeak.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return json({ isPro, activeLeaks });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "run-ai-agent") {
    try {
      console.log("⚡ Merchant manually triggered AI Agent");
      await processAbandonedCarts(shop);
      await runCartRecoveryAgent(shop);

      return json({
        success: true,
        message: "AI Scan Complete: Check Active Leaks table!",
      });
    } catch (error) {
      console.error("Manual AI Trigger Failed:", error);
      return json({ error: "AI Scan encountered an error" }, { status: 500 });
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function RevenueLeaksRoute() {
  const shopify = useAppBridge();
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const handleRunScan = () => {
    fetcher.submit({ intent: "run-ai-agent" }, { method: "POST" });
  };

  useEffect(() => {
    const aiData = fetcher.data as
      | { success?: boolean; error?: string; message?: string }
      | undefined;

    if (aiData?.success) {
      shopify?.toast?.show(aiData.message || "AI Scan Complete!", {
        duration: 3000,
      });
    } else if (aiData?.error) {
      shopify?.toast?.show(aiData.error, { duration: 3000, isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="Revenue Leaks Detection">
      <TitleBar title="Revenue Leaks Detection" />
      <BlockStack gap="400">
        <RevenueLeaksTab
          leaks={data.activeLeaks}
          onRunScan={handleRunScan}
          isScanning={fetcher.state === "submitting"}
          isPro={data.isPro}
          navigate={navigate}
        />
      </BlockStack>
    </Page>
  );
}
