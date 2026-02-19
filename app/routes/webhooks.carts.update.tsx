import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "CARTS_UPDATE") {
    return json({ error: "Invalid topic" }, { status: 400 });
  }

  try {
    const cart = payload as any;

    if (!cart.token || !cart.email) {
      return json({ success: true, skipped: "No customer data" });
    }

    const shippingAddress = cart.shipping_address;
    if (!shippingAddress) {
      return json({ success: true, skipped: "No shipping address" });
    }

    const settings = await db.appSettings.findFirst({
      where: { shop },
    });

    if (!settings || !settings.recoveryEnabled) {
      return json({ success: true, skipped: "Recovery disabled" });
    }

    const address = `${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.zip}`;
    const customerCoords = await geocodeAddress(address);
    if (!customerCoords) {
      return json({ success: true, skipped: "Geocoding failed" });
    }

    const distance = calculateDistance(
      settings.storeLat || 0,
      settings.storeLng || 0,
      customerCoords.lat,
      customerCoords.lng,
    );

    const radiusInMiles =
      settings.unitSystem === "IMPERIAL"
        ? settings.deliveryRadius
        : settings.deliveryRadius * 0.621371;

    const inDeliveryZone = distance <= radiusInMiles;
    const cartValue = parseFloat(cart.total_price || "0");

    await db.cartRecovery.upsert({
      where: { cartToken: cart.token },
      update: {
        customerEmail: cart.email,
        customerAddress: address,
        inDeliveryZone,
      },
      create: {
        shop,
        cartToken: cart.token,
        customerEmail: cart.email,
        customerAddress: address,
        inDeliveryZone,
        recoveryValue: cartValue,
      },
    });

    if (inDeliveryZone && cartValue > 50) {
      console.log(
        `Would send recovery email to ${cart.email} for cart ${cart.token}`,
      );
      await db.cartRecovery.update({
        where: { cartToken: cart.token },
        data: { emailSent: true },
      });
    }

    return json({ success: true, inDeliveryZone });
  } catch (error) {
    console.error("Cart webhook error:", error);
    return json({ error: "Processing failed" }, { status: 500 });
  }
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.SHOPIFY_GOOGLE_MAPS_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results?.[0]) return data.results[0].geometry.location;
  } catch (error) {}
  return null;
}
