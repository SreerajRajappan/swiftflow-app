import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  if (topic !== "CARTS_UPDATE") {
    return json({ error: "Invalid topic" }, { status: 400 });
  }

  try {
    const cart = payload;
    
    // CheckARTS_UPDATE") {
    return json({ error: "Invalid topic" }, { status: 400 });
  }

  try {
    const cart = payload;
    
    // Check if cart has customer info and address
    if (!cart.token || !cart.email) {
      return json({ success: true, skipped: "No customer data" });
    }

    // Extract shipping address if available
    const shippingAddress = cart.shipping_address;
    if (!shippingAddress) {
      return json({ success: true, skipped: "No shipping address" });
    }

    // Check if this cart is in delivery zone
    const settings = await db.appSettings.findFirst({
      where: { shopDomain: shop },
    });

    if (!settings || !settings.revenueSuiteEnabled) {
      return json({ success: true, skipped: "Revenue Suite disabled" });
    }

    const address = `${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.zip}`;
    
    // Geocode and check distance
    const customerCoords = await geocodeAddress(address);
    if (!customerCoords) {
      return json({ success: true, skipped: "Geocoding failed" });
    }

    const distance = calculateDistance(
      settings.storeLat || 0,
      settings.storeLng || 0,
      customerCoords.lat,
      customerCoords.lng
    );

    const radiusInMiles = settings.unitSystem === "IMPERIAL" 
      ? settings.deliveryRadius 
      : settings.deliveryRadius * 0.621371;

    const inDeliveryZone = distance <= radiusInMiles;

    // Calculate cart value
    const cartValue = parseFloat(cart.total_price || "0");

    // Save cart recovery record
    await db.cartRecovery.upsert({
      where: { cartToken: cart.token },
      update: {
        customerEmail: cart.email,
        customerAddress: address,
        inDeliveryZone,
      },
      create: {
        shopDomain: shop,
        cartToken: cart.token,
        customerEmail: cart.email,
        customerAddress: address,
        inDeliveryZone,
        recoveryValue: cartValue,
      },
    });

    // If in delivery zone and cart value > $50, send recovery email
    if (inDeliveryZone && cartValue > 50) {
      // TODO: Integrate with your email service or Shopify Email API
      await sendRecoveryEmail(cart.email, shop, cart.token);
      
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

// Helper functions (same as before)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results?.[0]) {
      return data.results[0].geometry.location;
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
}

async function sendRecoveryEmail(email: string, shop: string, cartToken: string) {
  // Implement using Shopify Email API or third-party service
  // For now, just log
  console.log(`Would send recovery email to ${email} for cart ${cartToken}`);
}
