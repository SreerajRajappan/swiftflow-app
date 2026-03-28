import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  json,
} from "@remix-run/node";
import { processAbandonedCarts } from "../services/email.server";
import { runCartRecoveryAgent } from "../agent.server";
import db from "../db.server";

// 👇 1. Reusable Security Guard
function authenticateCron(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const rawSecret = process.env.CRON_SECRET || "UNDEFINED_SECRET";
  const expectedToken = `Bearer ${rawSecret.trim()}`;

  if (!authHeader || authHeader !== expectedToken) {
    console.warn("🚨 Unauthorized attempt to trigger cron job.");
    return false;
  }
  return true;
}

// 👇 2. The Core Cron Logic
async function executeCartRecoveryCycle() {
  console.log("⏱️ Starting App-Wide Cart Recovery Cycle...");

  try {
    const activeShops = await db.appSettings.findMany({
      where: { revenueSuiteEnabled: true },
      select: { shop: true },
    });

    if (activeShops.length === 0) {
      console.log("No active shops found. Exiting cron.");
      return json({ success: true, message: "No active shops." });
    }

    // 🚀 CRITICAL FIX: Asynchronous Batching Across Shops
    // We use Promise.allSettled so all shops are processed in parallel.
    // If one shop crashes, it will NOT stop the others from recovering revenue.
    await Promise.allSettled(
      activeShops.map(async ({ shop }) => {
        console.log(`\n🔄 Processing Shop: ${shop}`);
        try {
          // Process emails and AI agent sequentially FOR THIS SHOP ONLY,
          // but parallelized across the global app.
          await processAbandonedCarts(shop);
          await runCartRecoveryAgent(shop);
        } catch (shopError) {
          console.error(`❌ Failed processing shop ${shop}:`, shopError);
        }
      }),
    );

    return json(
      {
        success: true,
        message: `Abandoned cart cycle completed for ${activeShops.length} shops.`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Cron Execution Failed:", error);
    return json(
      { error: "Internal Server Error during execution" },
      { status: 500 },
    );
  }
}

// 👇 3. Support GET requests (Standard for basic Cron services)
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!authenticateCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return executeCartRecoveryCycle();
};

// 👇 4. Support POST requests (If you trigger via webhooks or secure POST)
export const action = async ({ request }: ActionFunctionArgs) => {
  if (!authenticateCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return executeCartRecoveryCycle();
};
