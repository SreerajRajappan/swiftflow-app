import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  json,
} from "@remix-run/node";
import { processAbandonedCarts } from "../services/email.server";
import { runCartRecoveryAgent } from "../agent.server";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { BASIC_PLANS, PRO_PLANS, ELITE_PLANS } from "../constants";

// 👇 Reusable Security Guard
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

// 🚀 THE FIX: Helper to chunk arrays for controlled processing
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

// 👇 The Core Cron Logic
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

    // 🚀 THE FIX: Process in batches of 5 to protect RAM and API Rate Limits
    const BATCH_SIZE = 5;
    const batches = chunkArray(activeShops, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      console.log(`\n📦 Processing Batch ${i + 1} of ${batches.length}...`);
      const currentBatch = batches[i];

      await Promise.allSettled(
        currentBatch.map(async ({ shop }) => {
          console.log(`🔄 Checking Shop: ${shop}`);
          try {
            // --- 🛑 SECURE REVENUE & FREELOADER CHECK ---
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const currentMonthData = await db.conversionEvent.aggregate({
              where: { shop, createdAt: { gte: startOfMonth } },
              _sum: { orderValue: true },
            });
            const currentMonthRevenue = currentMonthData._sum?.orderValue || 0;

            // Fetch offline admin context to query live billing status FIRST
            const { admin } = await unauthenticated.admin(shop);
            const response = await admin.graphql(`
              #graphql
              query {
                currentAppInstallation {
                  activeSubscriptions {
                    name
                    status
                  }
                }
              }
            `);
            const payload = await response.json();
            const activeSub =
              payload.data?.currentAppInstallation?.activeSubscriptions?.find(
                (sub: any) => sub.status === "ACTIVE",
              );
            const planName = activeSub?.name || "";

            const isBasic = BASIC_PLANS.includes(planName);
            const isPro = PRO_PLANS.includes(planName);
            const isElite = ELITE_PLANS.includes(planName);

            // 🛑 Hard Enforce Billing Limits & Active Subscriptions
            if (!isBasic && !isPro && !isElite) {
              console.warn(
                `🛑 [NO VALID PLAN] Shop ${shop} has no active paid plan. AI Agent paused.`,
              );
              return; // Completely blocks freeloading
            }
            if (isBasic && currentMonthRevenue >= 1000) {
              console.warn(
                `🛑 [LIMIT REACHED] Shop ${shop} is on Basic Plan but hit $${currentMonthRevenue.toFixed(2)}. AI Agent paused.`,
              );
              return;
            }
            if (isPro && currentMonthRevenue >= 5000) {
              console.warn(
                `🛑 [LIMIT REACHED] Shop ${shop} is on Pro Plan but hit $${currentMonthRevenue.toFixed(2)}. AI Agent paused.`,
              );
              return;
            }

            // --- Autonomous A/B Test Resolution ---
            const settings = await db.appSettings.findUnique({
              where: { shop },
            });

            if (settings?.abTestEnabled) {
              const abRecoveries = await db.cartRecovery.findMany({
                where: { shop, messageVariant: { not: null } },
              });

              const sendsA = abRecoveries.filter(
                (r) => r.messageVariant === "A",
              ).length;
              const sendsB = abRecoveries.filter(
                (r) => r.messageVariant === "B",
              ).length;

              if (sendsA + sendsB >= 50) {
                const winsA = abRecoveries.filter(
                  (r) => r.messageVariant === "A" && r.recovered,
                ).length;
                const winsB = abRecoveries.filter(
                  (r) => r.messageVariant === "B" && r.recovered,
                ).length;

                const crA = sendsA > 0 ? winsA / sendsA : 0;
                const crB = sendsB > 0 ? winsB / sendsB : 0;
                const winner = crA >= crB ? "A" : "B";

                await db.appSettings.update({
                  where: { shop },
                  data: {
                    abTestEnabled: false,
                    abTestWinner: winner,
                  },
                });
                console.log(
                  `🏆 [A/B TEST RESOLVED] Shop ${shop} test concluded. Winner is Variant ${winner}!`,
                );
              }
            }

            // 🚀 EXECUTION (Only reached if limits aren't exceeded)
            await processAbandonedCarts(shop);
            await runCartRecoveryAgent(shop);
          } catch (shopError) {
            console.error(`❌ Failed processing shop ${shop}:`, shopError);
          }
        }),
      );

      // 🚀 THE FIX: Let the server breathe for 1 second between batches
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!authenticateCron(request))
    return json({ error: "Unauthorized" }, { status: 401 });
  return executeCartRecoveryCycle();
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!authenticateCron(request))
    return json({ error: "Unauthorized" }, { status: 401 });
  return executeCartRecoveryCycle();
};
