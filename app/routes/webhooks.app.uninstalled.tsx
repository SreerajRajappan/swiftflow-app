import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("🚨 WEBHOOK RECEIVED: app/uninstalled");
  const { shop, session, topic } = await authenticate.webhook(request);

  if (topic !== "APP_UNINSTALLED") {
    return new Response();
  }

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  try {
    // 🚀 THE FIX: The Zombie App Compute Shield
    // We must physically disable all active pipelines so our serverless cron jobs
    // immediately skip this shop, saving us OpenAI and DB compute costs.
    await db.appSettings.updateMany({
      where: { shop },
      data: {
        revenueSuiteEnabled: false,
        abTestEnabled: false,
        dynamicDiscountEnabled: false,
      },
    });

    console.log(
      `💀 [CLEANUP SUCCESS] Purged session and halted cron pipelines for ${shop}.`,
    );
  } catch (error) {
    console.error(
      `❌ [CLEANUP FAILED] Error disabling settings for ${shop}:`,
      error,
    );
  }

  return new Response();
};
