import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { queueProductView } from "../services/tracking.server";

// Generic CORS headers so it doesn't get blocked by the merchant's theme
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }: LoaderFunctionArgs) {
  return handleTracking(request);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  return handleTracking(request);
}

async function handleTracking(request: Request) {
  const url = new URL(request.url);

  // Extract from URL (if GET request via App Proxy)
  let shop = url.searchParams.get("shop");
  let productId = url.searchParams.get("productId");
  let productTitle = url.searchParams.get("productTitle"); // 👈 Extract title

  // Extract from Body (if POST request via direct theme fetch)
  if (request.method === "POST") {
    try {
      const body = await request.json();
      if (body.shop) shop = body.shop;
      if (body.productId) productId = body.productId;
      if (body.productTitle) productTitle = body.productTitle; // 👈 Extract title
    } catch (e) {
      // Ignore JSON parse errors, fallback to URL params safely
    }
  }

  if (!shop || !productId) {
    return json(
      { error: "Missing parameters" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // 🚀 CRITICAL FIX: Ensure we never fail a tracking insert just because a title is missing
  const finalTitle = productTitle || "Unknown Product";

  // Pass all three arguments to the tracking buffer safely
  queueProductView(shop, productId, finalTitle);

  // Return immediately so the storefront widget isn't waiting on our database
  return json({ success: true, queued: true }, { headers: CORS_HEADERS });
}
