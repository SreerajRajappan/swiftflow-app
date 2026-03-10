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
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    // Security Guard
    if (topic !== "CARTS_UPDATE") {
      return new Response("Unhandled webhook topic", { status: 200 });
    }

    if (!payload || !shop) {
      return json({ error: "Invalid webhook" }, { status: 400 });
    }

    const cart = payload as Record<string, any>;
    const cartToken = (cart.token as string | undefined) ?? null;
    const customerEmail = (cart.email as string | undefined) ?? null;
    const shippingAddress = cart.shipping_address as Record<
      string,
      string
    > | null;
    const cartValue = parseFloat(cart.total_price ?? "0");

    // --- VITAL FOR AI AGENT: Harvest the exact cart contents ---
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

    // Determine A/B variant for this cart (Claude's addition)
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
        lineItems, // Update the product context in case they added more items
        updatedAt: new Date(),
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
        lineItems, // Save the product context for the AI Agent
        abTestVariant,
        recoveryValue: cartValue,
        agentStatus: "IDLE", // Explicitly mark as ready for the background engine
      },
    });

    // NOTE: Synchronous email sending removed to comply with Shopify's 5-second timeout rule.
    // The AI Agent in the cron job will handle this safely!

    return json({ success: true, inDeliveryZone });
  } catch (err) {
    console.error("[Webhook:carts/update]", err);
    return json({ error: "Processing failed" }, { status: 500 });
  }
}
