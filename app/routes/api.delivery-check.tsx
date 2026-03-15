import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { geocodeAddress } from "../services/geocoding.server";
import {
  calculateDistance,
  getRadiusInMiles,
  estimateDeliveryTime,
} from "../services/proximity.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle the browser's preflight OPTIONS request correctly
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const address = url.searchParams.get("address");
  const cartToken = url.searchParams.get("cartToken");

  if (!shop) {
    return json({ error: "Missing shop" }, { status: 400, headers: CORS });
  }

  try {
    const settings = await db.appSettings.findUnique({ where: { shop } });

    if (!settings?.storeLat || !settings?.storeLng) {
      return json(
        { inRadius: false, error: "Store location not configured" },
        { headers: CORS },
      );
    }

    // Resolve customer coordinates
    let customerLat: number | null = null;
    let customerLng: number | null = null;
    let resolvedAddress: string | null = address;

    // 1. Try direct coordinates first
    if (lat && lng) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        customerLat = parsedLat;
        customerLng = parsedLng;
      }
    }

    // 2. Fallback: geocode the address string
    if ((customerLat === null || customerLng === null) && address) {
      const coords = await geocodeAddress(address);
      if (coords) {
        customerLat = coords.lat;
        customerLng = coords.lng;
      }
    }

    if (customerLat === null || customerLng === null) {
      return json(
        { inRadius: false, error: "Could not determine customer location" },
        { headers: CORS },
      );
    }

    const distance = calculateDistance(
      settings.storeLat,
      settings.storeLng,
      customerLat,
      customerLng,
    );

    const radiusInMiles = getRadiusInMiles(
      settings.deliveryRadius,
      settings.unitSystem,
    );

    const inRadius = distance <= radiusInMiles;

    let message: string;
    let abVariant: string | null = null;

    if (inRadius) {
      if (
        settings.abTestEnabled &&
        settings.abTestMessageA &&
        settings.abTestMessageB
      ) {
        abVariant = Math.random() < 0.5 ? "A" : "B";
        message =
          abVariant === "A" ? settings.abTestMessageA : settings.abTestMessageB;
      } else {
        message = `Great news! We deliver to your area (${distance.toFixed(1)} ${settings.unitSystem === "METRIC" ? "km" : "mi"} away)`;
      }
    } else {
      message = "Sorry, you're outside our current delivery zone";
    }

    const estimatedTime = inRadius ? estimateDeliveryTime(distance) : null;

    await db.deliveryCheck.create({
      data: {
        shop,
        customerAddress: resolvedAddress,
        customerLat,
        customerLng,
        distance,
        inRadius,
        cartToken: cartToken || null,
      },
    });

    return json(
      {
        inRadius,
        distance: parseFloat(distance.toFixed(2)),
        message,
        estimatedTime,
        abVariant,
      },
      { headers: CORS },
    );
  } catch (err) {
    console.error("[DeliveryCheck] Error:", err);
    return json(
      { inRadius: false, error: "Server error" },
      { status: 500, headers: CORS },
    );
  }
}
