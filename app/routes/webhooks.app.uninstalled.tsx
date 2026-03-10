import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { shop, topic } = await authenticate.webhook(request);

    console.log(`[Webhook] Received ${topic} for shop: ${shop}`);

    // Security Guard
    if (topic !== "APP_UNINSTALLED") {
      console.warn(`[Webhook] Ignored unhandled topic: ${topic}`);
      return new Response("Unhandled webhook topic", { status: 200 });
    }

    if (!shop) {
      return json({ error: "Invalid webhook" }, { status: 400 });
    }

    // Clean up ALL shop data in the safest dependency order
    await db.$transaction([
      db.revenueLeak.deleteMany({ where: { shop } }), // <-- NEW: Clean up the Agent's memory
      db.deliveryCheck.deleteMany({ where: { shop } }),
      db.conversionEvent.deleteMany({ where: { shop } }),
      db.cartRecovery.deleteMany({ where: { shop } }),
      db.productView.deleteMany({ where: { shop } }),
      db.appSettings.deleteMany({ where: { shop } }), // Deleted last
    ]);

    console.log(`✅ Cleaned up all data securely for shop: ${shop}`);
    return json({ success: true });
  } catch (error) {
    console.error("Uninstall webhook error:", error);
    return json({ error: "Cleanup failed" }, { status: 500 });
  }
}
