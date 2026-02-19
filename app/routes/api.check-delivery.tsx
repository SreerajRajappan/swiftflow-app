import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const address = url.searchParams.get("address");

  if (!shop || !address) {
    return json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    // Get shop settings
    const settings = await db.appSettings.findFirst({
      where: { shopDomain: shop },
    });

    if (!settings) {
      return json(
        { inRadius: false },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      );
    }

    // Geocode customer address
    const customerCoords = await geocodeAddress(address);

    if (!customerCoords) {
      return json(
        { inRadius: false },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      );
    }

    // Check if within delivery radius
    const storeCoords = {
      lat: settings.storeLat || 0,
      lng: settings.storeLng || 0,
    };

    const distance = calculateDistance(
      storeCoords.lat,
      storeCoords.lng,
      customerCoords.lat,
      customerCoords.lng,
    );

    const radiusInMiles =
      settings.unitSystem === "IMPERIAL"
        ? settings.deliveryRadius
        : settings.deliveryRadius * 0.621371; // Convert km to miles

    const inRadius = distance <= radiusInMiles;

    // Log this check for analytics
    await db.deliveryCheck.create({
      data: {
        shopDomain: shop,
        customerAddress: address,
        distance,
        inRadius,
        timestamp: new Date(),
      },
    });

    return json(
      { inRadius, distance },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  } catch (error) {
    console.error("Delivery check error:", error);
    return json(
      { error: "Server error" },
      { status: 500 },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Haversine formula for distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959; // Earth's radius in miles
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

// Geocode address using Google Maps API
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address,
  )}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  return null;
}
