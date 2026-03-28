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

    if (topic !== "CHECKOUTS_UPDATE" && topic !== "CARTS_UPDATE") {
      return new Response("Unhandled webhook topic", { status: 200 });
    }

    const cart = payload as Record<string, any>;

    const checkoutToken = (cart.token as string | undefined) ?? null;
    const cartToken = (cart.cart_token as string | undefined) ?? checkoutToken;
    const customerEmail = (cart.email as string | undefined) ?? null;
    const shippingAddress = cart.shipping_address as Record<
      string,
      string
    > | null;
    const cartValue = parseFloat(cart.total_price ?? "0");
    const lineItems = cart.line_items || [];

    const abandonedCheckoutUrl =
      (cart.abandoned_checkout_url as string | undefined) ??
      `https://${shop}/cart`;

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

    if (!customerEmail) {
      return json({ success: true, skipped: "no_email" });
    }

    const radiusMiles = getRadiusInMiles(
      settings.deliveryRadius,
      settings.unitSystem,
    );

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
        inDeliveryZone = distance <= radiusMiles;
      }
    }

    const abTestVariant = settings.abTestEnabled
      ? Math.random() < 0.5
        ? "A"
        : "B"
      : null;

    // console.log(`\n🔥 [WEBHOOK] Processing Checkout Update...`);
    // console.log(`🌍 [GEO] Customer Address: ${customerAddress}`);
    // console.log(
    //   `📏 [GEO] Distance: ${distance?.toFixed(2) || "N/A"} miles | Radius: ${radiusMiles} miles`,
    // );
    // console.log(`🎯 [GEO] In Zone? ${inDeliveryZone}`);

    // Check what the AI agent is currently doing with this cart before we upsert
    const existingRecovery = await db.cartRecovery.findUnique({
      where: { cartToken },
    });

    let newAgentStatus: string | undefined = undefined;

    if (!existingRecovery) {
      // It's a brand new cart
      newAgentStatus =
        inDeliveryZone && shippingAddress ? "IDLE" : "OUT_OF_ZONE";
    } else {
      // It exists. ONLY reset to IDLE if the AI hasn't processed it yet!
      const isAlreadyProcessed =
        existingRecovery.emailSent ||
        existingRecovery.agentStatus === "COMPLETED" ||
        existingRecovery.agentStatus === "PROCESSING";

      if (!isAlreadyProcessed) {
        newAgentStatus =
          inDeliveryZone && shippingAddress ? "IDLE" : "OUT_OF_ZONE";
      }
    }

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
        abandonedCheckoutUrl,
        // Only update the agent status if it hasn't been locked by the AI
        ...(newAgentStatus ? { agentStatus: newAgentStatus } : {}),
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
        agentStatus: newAgentStatus || "OUT_OF_ZONE",
        abandonedCheckoutUrl,
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
