import { type ActionFunctionArgs, json } from "@remix-run/node";
import { processAbandonedCarts } from "../services/email.server";
import { runCartRecoveryAgent } from "../agent.server";
import db from "../db.server"; // 👈 Add your Prisma import

export const action = async ({ request }: ActionFunctionArgs) => {
  // 1. Security Check: Only allow authorized requests
  const authHeader = request.headers.get("Authorization");
  const rawSecret = process.env.CRON_SECRET || "UNDEFINED_SECRET";
  const expectedToken = `Bearer ${rawSecret.trim()}`;

  if (!authHeader || authHeader !== expectedToken) {
    console.warn("Unauthorized attempt to trigger cron job.");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Ensure it's a POST request
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // 3. Execute the service logic sequentially
  try {
    console.log("⏱️ Starting App-Wide Cart Recovery Cycle...");

    // 👇 3a. Fetch all active shops that have the Revenue Suite enabled
    const activeShops = await db.appSettings.findMany({
      where: { revenueSuiteEnabled: true },
      select: { shop: true },
    });

    if (activeShops.length === 0) {
      console.log("No active shops found. Exiting cron.");
      return json({ success: true, message: "No active shops." });
    }

    // 👇 3b. Loop through every shop and run the agent
    for (const { shop } of activeShops) {
      console.log(`\n🔄 Processing Shop: ${shop}`);

      // Phase 1: Scan for cold carts and flag as ANALYZING
      await processAbandonedCarts(shop);

      // Phase 2: AI Agent writes and sends the emails
      // (Assuming runCartRecoveryAgent also expects the shop string!)
      await runCartRecoveryAgent(shop);
    }

    return json(
      {
        success: true,
        message: "Abandoned cart cycle completed for all shops.",
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
};
