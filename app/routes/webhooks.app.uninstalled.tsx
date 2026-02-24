import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { shop } = await authenticate.webhook(request);

    if (!shop) {
      return json({ error: "Invalid webhook" }, { status: 400 });
    }

    // Clean up all shop data
    await db.$transaction([
      db.appSettings.deleteMany({ where: { shop } }),
      db.deliveryCheck.deleteMany({ where: { shop } }),
      db.conversionEvent.deleteMany({ where: { shop } }),
      db.cartRecovery.deleteMany({ where: { shop } }),
      db.productView.deleteMany({ where: { shop } }),
    ]);

    console.log(`✅ Cleaned up data for shop: ${shop}`);
    return json({ success: true });
  } catch (error) {
    console.error("Uninstall webhook error:", error);
    return json({ error: "Cleanup failed" }, { status: 500 });
  }
}
