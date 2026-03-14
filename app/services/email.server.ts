import db from "../db.server";

export async function processAbandonedCarts(shop: string) {
  console.log(
    `🤖 [AI Agent] Waking up to check for abandoned carts for ${shop}...`,
  );

  // 1. Define what "Abandoned" means (e.g., no updates in the last 60 minutes)
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 1000); // 1 min for testing

  // 2. Query the database for carts that have gone cold
  const abandonedCarts = await db.cartRecovery.findMany({
    where: {
      shop,
      updatedAt: { lte: oneHourAgo }, // Hasn't been touched in over a minute
      recovered: false,
      // 👇 FIX: Allow the scanner to pick up carts that the webhook flagged as IN_ZONE
      agentStatus: { in: ["IDLE", "IN_ZONE"] },
    },
  });

  if (abandonedCarts.length === 0) {
    console.log(
      "🤖 [AI Agent] No new abandoned carts detected. Going back to sleep.",
    );
    return;
  }

  // 3. Process each cart and push it to the Enterprise Dashboard
  for (const cart of abandonedCarts) {
    const value = cart.cartValue || 0;

    // 👇 RICH LOGS: See exactly who the agent is analyzing
    console.log(`\n🔎 [AI Agent] Analyzing cart for: ${cart.customerEmail}`);
    console.log(
      `📍 [AI Agent] Geofence Status: ${cart.agentStatus} | Value: $${value}`,
    );

    // Ignore carts with practically nothing in them to keep the dashboard high-signal
    if (value < 10) {
      console.log(
        `⏭️ [AI Agent] Skipping ${cart.customerEmail} - Cart value too low (<$10).`,
      );
      continue;
    }

    // Dynamically assign severity based on lost revenue
    const severity = value > 150 ? "CRITICAL" : value > 50 ? "WARNING" : "INFO";

    // Create the Revenue Leak record so it instantly appears on the React UI
    await db.revenueLeak.create({
      data: {
        shop: cart.shop,
        type: "ABANDONED_CART",
        severity,
        title: `$${value.toFixed(2)} Cart Abandoned`,
        potentialValue: value,
        status: "DETECTED",
        metadata: {
          cartToken: cart.cartToken,
          customerEmail: cart.customerEmail,
          lineItems: cart.lineItems, // Pass context to the UI so merchants see exactly what was left
        },
      },
    });

    // Mark the Cart as ready for Phase 2 (The AI Agent Email Generation)
    await db.cartRecovery.update({
      where: { id: cart.id },
      data: { agentStatus: "ANALYZING" },
    });

    console.log(
      `🚨 [LEAK DETECTED] ${severity} - $${value} for shop ${cart.shop}`,
    );

    if (cart.agentStatus === "IN_ZONE") {
      console.log(
        `🎯 [AI Agent] Target is IN ZONE! Queued for Local Delivery Email flow.`,
      );
    }
  }
}
