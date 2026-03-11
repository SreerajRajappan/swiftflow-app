import { type ActionFunctionArgs, json } from "@remix-run/node";
import { processAbandonedCarts } from "../services/email.server";
import { runCartRecoveryAgent } from "../agent.server";

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
    console.log("⏱️ Starting Cart Recovery Cycle...");

    // Phase 1: Scan for cold carts and flag as ANALYZING
    await processAbandonedCarts();

    // Phase 2: AI Agent writes and sends the emails
    await runCartRecoveryAgent();

    return json(
      { success: true, message: "Abandoned cart cycle completed." },
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
