import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { geocodeAddress } from "../services/geocoding.server";
import {
  calculateDistance,
  getRadiusInMiles,
} from "../services/proximity.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log("🔥 WEBHOOK RECEIVED: checkouts/update");
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    // Allow both topics in case Shopify sends legacy cart updates
    if (topic !== "CHECKOUTS_UPDATE" && topic !== "CARTS_UPDATE") {
      return new Response("Unhandled webhook topic", { status: 200 });
    }

    const cart = payload as Record<string, any>;

    // 🛑 CRITICAL FIX: Handle the token switch between Carts and Checkouts
    const checkoutToken = (cart.token as string | undefined) ?? null;
    const cartToken = (cart.cart_token as string | undefined) ?? checkoutToken;

    const customerEmail = (cart.email as string | undefined) ?? null;
    const shippingAddress = cart.shipping_address as Record<
      string,
      string
    > | null;
    const cartValue = parseFloat(cart.total_price ?? "0");
    const lineItems = cart.line_items || [];

    if (!cartToken) {
      return json({ success: true, skipped: "no_cart_token" });
    }

    const settings = await db.appSettings.findFirst({ where: { shop } });

    if (!settings?.revenueSuiteEnabled) {
      return json({ success: true, skipped: "suite_disabled" });
    }

    if (!settings.storeLat || !settings.storeLng) {
      return json({ success: true, skipped: "store_location_missing" });
    }

    // FILTER: We only want to track checkouts that have an email!
    if (!customerEmail) {
      return json({ success: true, skipped: "no_email" });
    }

    // Resolve customer coordinates
    let customerLat: number | null = null;
    let customerLng: number | null = null;
    let customerAddress: string | null = null;
    let inDeliveryZone = false;
    let distance: number | null = null;

    if (shippingAddress) {
      customerAddress = [
        shippingAddress.address1,
        shippingAddress.city,
        shippingAddress.province,
        shippingAddress.zip,
        shippingAddress.country,
      ]
        .filter(Boolean)
        .join(", ");

      const coords = await geocodeAddress(customerAddress);

      if (coords) {
        customerLat = coords.lat;
        customerLng = coords.lng;
        distance = calculateDistance(
          settings.storeLat,
          settings.storeLng,
          customerLat,
          customerLng,
        );
        const radiusMiles = getRadiusInMiles(
          settings.deliveryRadius,
          settings.unitSystem,
        );
        inDeliveryZone = distance <= radiusMiles;
      }
    }

    const abTestVariant = settings.abTestEnabled
      ? Math.random() < 0.5
        ? "A"
        : "B"
      : null;

    // Upsert cart recovery record - quietly queueing it for the AI Agent
    await db.cartRecovery.upsert({
      where: { cartToken },
      update: {
        customerEmail,
        customerAddress,
        customerLat,
        customerLng,
        inDeliveryZone,
        cartValue,
        lineItems,
        updatedAt: new Date(),
        // Only queue for AI if they typed an address and are in the zone
        ...(inDeliveryZone && shippingAddress ? { agentStatus: "IDLE" } : {}),
      },
      create: {
        shop,
        cartToken,
        customerEmail,
        customerAddress,
        customerLat,
        customerLng,
        inDeliveryZone,
        cartValue,
        lineItems,
        abTestVariant,
        recoveryValue: cartValue,
        agentStatus: inDeliveryZone && shippingAddress ? "IDLE" : "OUT_OF_ZONE",
      },
    });

    console.log(
      `✅ [DB SUCCESS] Saved Checkout for ${customerEmail} | Items: ${lineItems.length}`,
    );
    return json({ success: true, inDeliveryZone });
  } catch (err) {
    console.error("[Webhook:checkouts/update]", err);
    return json({ error: "Processing failed" }, { status: 500 });
  }
}
