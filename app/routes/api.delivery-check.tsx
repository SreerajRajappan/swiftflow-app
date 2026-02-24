import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Add CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400, headers });
  }

  try {
    const settings = await db.appSettings.findFirst({
      where: { shop },
    });

    if (!settings || !settings.storeLat || !settings.storeLng) {
      return json(
        { inRadius: false, error: "Store location not configured" },
        { headers },
      );
    }

    // If no customer location provided, can't check
    if (!lat || !lng) {
      return json(
        { inRadius: false, error: "Customer location required" },
        { headers },
      );
    }

    const customerLat = parseFloat(lat);
    const customerLng = parseFloat(lng);

    if (isNaN(customerLat) || isNaN(customerLng)) {
      return json(
        { inRadius: false, error: "Invalid coordinates" },
        { headers },
      );
    }

    // Calculate distance
    const distance = calculateDistance(
      settings.storeLat,
      settings.storeLng,
      customerLat,
      customerLng,
    );

    const radiusInMiles =
      settings.unitSystem === "IMPERIAL"
        ? settings.deliveryRadius
        : settings.deliveryRadius * 0.621371;

    const inRadius = distance <= radiusInMiles;

    // Log the check
    await db.deliveryCheck.create({
      data: {
        shop: settings.shop,
        customerLat,
        customerLng,
        distance,
        inRadius,
      },
    });

    return json(
      {
        inRadius,
        distance: distance.toFixed(2),
        message: inRadius
          ? `Great news! We deliver to your area (${distance.toFixed(1)} miles away)`
          : "Sorry, you're outside our delivery zone",
      },
      { headers },
    );
  } catch (error) {
    console.error("Delivery check error:", error);
    return json(
      { error: "Server error", inRadius: false },
      { status: 500, headers },
    );
  }
}

export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
