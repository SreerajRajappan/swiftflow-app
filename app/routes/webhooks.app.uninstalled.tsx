import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop } = await authenticate.webhook(request);

  if (topic !== "APP_UNINSTALLED") {
    return json({ error: "Invalid topic" }, { status: 400 });
  }

  try {
    // Clean up all data for this shop
    await db.appSettings.deleteMany({ where: { shop } });
    await db.deliveryCheck.deleteMany({ where: { shop } });
    await db.conversionEvent.deleteMany({ where: { shop } });
    await db.cartRecovery.deleteMany({ where: { shop } });

    console.log(`Cleaned up data for uninstalled shop: ${shop}`);
    return json({ success: true });
  } catch (error) {
    console.error("Uninstall webhook error:", error);
    return json({ error: "Cleanup failed" }, { status: 500 });
  }
}
