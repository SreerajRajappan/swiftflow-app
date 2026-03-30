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
    await Promise.allSettled(
      activeShops.map(async ({ shop }) => {
        console.log(`\n🔄 Processing Shop: ${shop}`);
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

          // If revenue exceeds the lowest tier limit ($1000), we must verify their actual plan
          if (currentMonthRevenue >= 1000) {
            // Fetch offline admin context to query live billing status
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

            // 🛑 Hard Enforce Billing Limits
            if (isBasic && currentMonthRevenue >= 1000) {
              console.warn(
                `🛑 [LIMIT REACHED] Shop ${shop} is on Basic Plan but hit $${currentMonthRevenue.toFixed(2)}. AI Agent paused.`,
              );
              return; // Halt execution for this shop
            }
            if (isPro && currentMonthRevenue >= 5000) {
              console.warn(
                `🛑 [LIMIT REACHED] Shop ${shop} is on Pro Plan but hit $${currentMonthRevenue.toFixed(2)}. AI Agent paused.`,
              );
              return; // Halt execution for this shop
            }
            if (!isBasic && !isPro && !isElite) {
              console.warn(
                `🛑 [NO VALID PLAN] Shop ${shop} has no active paid plan but hit $${currentMonthRevenue.toFixed(2)}. AI Agent paused.`,
              );
              return; // Prevent execution if they uninstalled or canceled billing
            }
          }

          // Autonomous A/B Test Resolution
          const settings = await db.appSettings.findUnique({ where: { shop } });

          if (settings?.abTestEnabled) {
            // Fetch recoveries that were part of the A/B test
            const abRecoveries = await db.cartRecovery.findMany({
              where: { shop, messageVariant: { not: null } },
            });

            const sendsA = abRecoveries.filter(
              (r) => r.messageVariant === "A",
            ).length;
            const sendsB = abRecoveries.filter(
              (r) => r.messageVariant === "B",
            ).length;

            // Resolve the test automatically after 50 sends for statistical significance
            if (sendsA + sendsB >= 50) {
              const winsA = abRecoveries.filter(
                (r) => r.messageVariant === "A" && r.recovered,
              ).length;
              const winsB = abRecoveries.filter(
                (r) => r.messageVariant === "B" && r.recovered,
              ).length;

              const crA = sendsA > 0 ? winsA / sendsA : 0;
              const crB = sendsB > 0 ? winsB / sendsB : 0;

              // The math decides the winner
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

// 👇 3. Support GET requests
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!authenticateCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return executeCartRecoveryCycle();
};

// 👇 4. Support POST requests
export const action = async ({ request }: ActionFunctionArgs) => {
  if (!authenticateCron(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return executeCartRecoveryCycle();
};
