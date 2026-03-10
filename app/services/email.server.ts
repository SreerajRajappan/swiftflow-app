import db from "../db.server";

export async function processAbandonedCarts() {
  console.log("CRON EXECUTING: Scanning for new Revenue Leaks...");

  // 1. Define what "Abandoned" means (e.g., no updates in the last 60 minutes)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // 2. Query the database for carts that have gone cold
  const abandonedCarts = await db.cartRecovery.findMany({
    where: {
      updatedAt: { lte: oneHourAgo }, // Hasn't been touched in over an hour
      recovered: false,
      agentStatus: "IDLE", // Ensures we don't process the same cart twice
    },
  });

  if (abandonedCarts.length === 0) {
    console.log("No new abandoned carts detected.");
    return;
  }

  // 3. Process each cart and push it to the Enterprise Dashboard
  for (const cart of abandonedCarts) {
    const value = cart.cartValue || 0;

    // Ignore carts with practically nothing in them to keep the dashboard high-signal
    if (value < 10) continue;

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
      `[LEAK DETECTED] ${severity} - $${value} for shop ${cart.shop}`,
    );
  }
}
