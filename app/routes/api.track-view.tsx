import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { queueProductView } from "../services/tracking.server";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // 🚀 THE FIX: Enforce strict App Proxy HMAC Authentication
  // This physically prevents bots/hackers from curling your endpoint directly.
  let session;
  try {
    const authResult = await authenticate.public.appProxy(request);
    session = authResult.session;
  } catch (error) {
    console.error("🚨 Proxy Auth Error:", error);
    return json({ error: "Unauthorized Signature" }, { status: 401 });
  }

  if (!session || !session.shop) {
    console.warn("🚨 Unauthorized tracking attempt blocked. No valid session.");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const shop = session.shop;

  try {
    const body = await request.json();
    const productId = body.productId;
    const productTitle = body.productTitle || "Unknown Product";

    if (!productId) {
      return json({ error: "Missing productId" }, { status: 400 });
    }

    // Direct write to database (from our previous fix)
    await queueProductView(shop, productId, productTitle);

    return json({ success: true, queued: true });
  } catch (error) {
    console.error("Failed to parse tracking request body", error);
    return json({ error: "Bad Request" }, { status: 400 });
  }
}
