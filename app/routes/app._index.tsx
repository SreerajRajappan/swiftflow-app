import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import confetti from "canvas-confetti";
import {
  json,
  useLoaderData,
  useNavigate,
  useSubmit,
  useFetcher,
} from "@remix-run/react";
import { Page, Box, BlockStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants";
import { RevenueSuiteTab } from "../components/RevenueSuiteTab";
import OpenAI from "openai";

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

  let settings = await prisma.appSettings.findUnique({ where: { shop } });

  // Safety net: Ensure settings exist if this is the very first load
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: { shop },
    });
  }

  const totalViews = await prisma.productView.count({ where: { shop } });

  const conversionData = await prisma.conversionEvent.aggregate({
    _sum: { orderValue: true },
    _count: { id: true },
  });

  // 1. All-time revenue for the Stat Box
  const totalRevenue = conversionData._sum.orderValue || 0;
  const conversionCount = conversionData._count.id || 0;

  // 2. Calculate Today's Revenue for the Daily Goal
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaysConversions = await prisma.conversionEvent.findMany({
    where: {
      shop,
      createdAt: { gte: startOfToday },
    },
  });

  const todayRevenue = todaysConversions.reduce(
    (sum, conv) => sum + conv.orderValue,
    0,
  );

  // 3. Get the Daily Goal
  const dailyGoal = settings?.dailyGoal || 500;
  const goalProgress = dailyGoal > 0 ? (todayRevenue / dailyGoal) * 100 : 0;

  const conversionRate =
    totalViews > 0 ? ((conversionCount / totalViews) * 100).toFixed(2) : "0.00";

  const recentConversions = await prisma.conversionEvent.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

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
    settings,
    shop,
    totalViews,
    totalRevenue,
    todayRevenue,
    conversionRate,
    recentConversions,
    dailyGoal,
    goalProgress: Math.min(goalProgress, 100).toFixed(0),
    isPro,
    trialDaysLeft,
    isDev: process.env.NODE_ENV === "development",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "reset_data") {
    await prisma.conversionEvent.deleteMany({ where: { shop } });
    return json({ success: true, message: "Data reset successfully" });
  }

  if (intent === "save-global") {
    const isEnabled = formData.get("isEnabled") === "true";
    await prisma.appSettings.update({
      where: { shop },
      data: { revenueSuiteEnabled: isEnabled },
    });
    return json({ success: true, message: "Settings saved" });
  }

  if (intent === "save-suite-config") {
    const subject = formData.get("recoveryEmailSubject") as string;
    const body = formData.get("recoveryEmailBody") as string;
    const newGoal = parseFloat(formData.get("dailyGoal") as string) || 500;

    const abTestEnabled = formData.get("abTestEnabled") === "true";
    const abTestMessageA = formData.get("abTestMessageA") as string;
    const abTestMessageB = formData.get("abTestMessageB") as string;

    await prisma.appSettings.upsert({
      where: { shop },
      create: {
        shop,
        recoveryEmailSubject: subject,
        recoveryEmailBody: body,
        dailyGoal: newGoal,
        abTestEnabled,
        abTestMessageA,
        abTestMessageB,
      },
      update: {
        recoveryEmailSubject: subject,
        recoveryEmailBody: body,
        dailyGoal: newGoal,
        abTestEnabled,
        abTestMessageA,
        abTestMessageB,
      },
    });

    return json({
      success: true,
      intent: "save-suite-config",
      message: "Revenue Suite configuration saved!",
    });
  }

  if (intent === "generate-ai-prompt") {
    const theme = formData.get("templateTheme") || "neighborhood";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const promptInstructions = `
      You are an expert e-commerce copywriter for a local business.
      The merchant selected the "${theme}" theme for local delivery abandoned carts.
      
      Write a highly converting, brief 1-to-2 sentence email body that the merchant can use as their base message.
      It MUST be concise (under 25 words).
      It should sound like it's written directly to the customer, emphasizing local delivery and convenience.
      Do NOT include subject lines, greetings, or placeholders. Ensure perfect spelling and grammar.
      Just write the raw email text directly.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: promptInstructions }],
        temperature: 0.7,
      });

      return json({
        success: true,
        generatedPrompt: response.choices[0].message.content?.trim(),
      });
    } catch (error) {
      console.error("AI Generation Error:", error);
      return json(
        { success: false, error: "Failed to generate prompt" },
        { status: 500 },
      );
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function Index() {
  const shopify = useAppBridge();
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [isEnabled, setIsEnabled] = useState(
    data.settings?.revenueSuiteEnabled ?? true,
  );

  const handleToggle = useCallback(() => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    submit(
      {
        intent: "save-global",
        isEnabled: String(newState),
      },
      { method: "POST" },
    );
  }, [isEnabled, submit]);

  const onResetData = useCallback(() => {
    if (confirm("DEV ONLY: Permanently delete conversion data?")) {
      submit({ intent: "reset_data" }, { method: "POST" });
    }
  }, [submit]);

  // Confetti effect for Daily Goal
  useEffect(() => {
    const hasCelebratedToday = sessionStorage.getItem(
      `celebrated_${data.dailyGoal}`,
    );

    if (parseFloat(data.goalProgress) >= 100 && !hasCelebratedToday) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      sessionStorage.setItem(`celebrated_${data.dailyGoal}`, "true");
    }

    if (parseFloat(data.goalProgress) < 100) {
      sessionStorage.removeItem(`celebrated_${data.dailyGoal}`);
    }
  }, [data.goalProgress, data.dailyGoal]);

  // Toast notifications
  useEffect(() => {
    if (fetcher.data && (fetcher.data as any).success) {
      shopify?.toast?.show(
        (fetcher.data as any).message || "Saved successfully",
      );
    } else if (fetcher.data && (fetcher.data as any).error) {
      shopify?.toast?.show(String((fetcher.data as any).error), {
        isError: true,
      });
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="SwiftFlow: Revenue Suite">
      <TitleBar title="SwiftFlow: Revenue Suite" />

      <BlockStack gap="400">
        {/* GLOBAL SMART BANNER */}
        {/* {data.isPro ? (
          data.trialDaysLeft > 0 ? (
            <Banner tone="success">
              <Text as="p">
                <strong>Pro Suite Active:</strong> Your AI Cart Recovery Agent
                is monitoring local drop-offs. You have{" "}
                <strong>{data.trialDaysLeft} days</strong> remaining in your
                free trial.
              </Text>
            </Banner>
          ) : null
        ) : (
          <Banner
            tone="info"
            action={{ content: "Upgrade to Pro", url: "/app/billing" }}
          >
            <Text as="p">
              <strong>Basic Plan Active:</strong>{" "}
              {data.trialDaysLeft > 0 &&
                `You have ${data.trialDaysLeft} days remaining in your free trial. `}
              Upgrade to Pro to unlock Autonomous AI Emails and unlimited
              recovered revenue.
            </Text>
          </Banner>
        )} */}

        <Box paddingBlockStart="200">
          <RevenueSuiteTab
            data={data.settings}
            fetcher={fetcher}
            totalRevenue={data.totalRevenue}
            todayRevenue={data.todayRevenue}
            dailyGoal={data.dailyGoal}
            goalProgress={data.goalProgress}
            isEnabled={isEnabled}
            setIsEnabled={setIsEnabled}
            isSaving={fetcher.state === "submitting"}
            handleToggle={handleToggle}
            totalViews={data.totalViews}
            conversionRate={data.conversionRate}
            recentConversions={data.recentConversions}
            shop={data.shop}
            onResetData={onResetData}
            isPro={data.isPro}
            navigate={navigate}
            isDev={data.isDev}
          />
        </Box>
      </BlockStack>
    </Page>
  );
}
