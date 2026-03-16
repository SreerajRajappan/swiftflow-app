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

    // 🚨 CRITICAL FIX: The Billing Exploit Patch
    // We delete volatile data to save DB space, but we NEVER delete ConversionEvents
    // or CartRecovery records. If they reinstall, their $1k/$5k limits remain enforced!
    await db.$transaction([
      db.revenueLeak.deleteMany({ where: { shop } }), // Clean up active Agent tasks
      db.deliveryCheck.deleteMany({ where: { shop } }), // Clear map pings
      db.productView.deleteMany({ where: { shop } }), // Clear storefront views
    ]);

    // Disable the suite so the cron job stops processing them
    await db.appSettings.updateMany({
      where: { shop },
      data: { revenueSuiteEnabled: false },
    });

    console.log(
      `✅ Cleaned up volatile data securely for shop: ${shop}. Billing history preserved.`,
    );
    return json({ success: true });
  } catch (error) {
    console.error("Uninstall webhook error:", error);
    return json({ error: "Cleanup failed" }, { status: 500 });
  }
}
