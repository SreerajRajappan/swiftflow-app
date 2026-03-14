import db from "../db.server";
import { geocodeAddress } from "./geocoding.server";
import { calculateDistance, getRadiusInMiles } from "./proximity.server";

export async function processAbandonedCarts(shop: string) {
  console.log(
    `🤖 [AI Agent] Waking up to check for abandoned carts for ${shop}...`,
  );

  // 1. Define what "Abandoned" means (e.g., no updates in the last 60 minutes)
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 1000); // 1 min for testing

  // 2. Fetch Shop Settings to get the Store's Coordinates and Radius
  const settings = await db.appSettings.findUnique({
    where: { shop },
  });

  if (!settings || !settings.storeLat || !settings.storeLng) {
    console.log(
      `⚠️ [AI Agent] Store coordinates missing for ${shop}. Cannot perform geofence checks.`,
    );
    return;
  }

  // Normalize the merchant's configured radius into miles for calculation
  const radiusMiles = getRadiusInMiles(
    settings.deliveryRadius,
    settings.unitSystem,
  );

  // 3. Query the database for carts that have gone cold
  const abandonedCarts = await db.cartRecovery.findMany({
    where: {
      shop,
      updatedAt: { lte: oneHourAgo }, // Hasn't been touched in over a minute
      recovered: false,
      agentStatus: { in: ["IDLE", "IN_ZONE"] },
    },
  });

  if (abandonedCarts.length === 0) {
    console.log(
      "🤖 [AI Agent] No new abandoned carts detected. Going back to sleep.",
    );
    return;
  }

  // 4. Process each cart and push it to the Enterprise Dashboard
  for (const cart of abandonedCarts) {
    const value = cart.cartValue || 0;

    console.log(`\n🔎 [AI Agent] Analyzing cart for: ${cart.customerEmail}`);

    if (value < 10) {
      console.log(
        `⏭️ [AI Agent] Skipping ${cart.customerEmail} - Cart value too low (<$10).`,
      );
      continue;
    }

    // --- THE GEOFENCE TRUTH-LOCK ---
    let custLat = cart.customerLat;
    let custLng = cart.customerLng;

    // A. If coordinates are missing but we have an address, geocode it now
    if ((!custLat || !custLng) && cart.customerAddress) {
      console.log(
        `🌍 [Geocoding] Fetching coordinates for ${cart.customerEmail}...`,
      );
      const coords = await geocodeAddress(cart.customerAddress);

      if (coords) {
        custLat = coords.lat;
        custLng = coords.lng;

        // Save the coordinates back to the database so we never pay/wait to geocode this cart again
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { customerLat: custLat, customerLng: custLng },
        });
      }
    }

    // B. If we still don't have coordinates, we cannot verify they are local. Block the email.
    if (!custLat || !custLng) {
      console.log(
        `🚫 [AI Agent] Skipping ${cart.customerEmail} - No valid coordinates or address.`,
      );
      await db.cartRecovery.update({
        where: { id: cart.id },
        data: { agentStatus: "NO_ADDRESS" },
      });
      continue; // Skip Enterprise Dashboard leak creation and email generation
    }

    // C. Calculate Exact Distance
    const distance = calculateDistance(
      settings.storeLat,
      settings.storeLng,
      custLat,
      custLng,
    );

    // D. Enforce the Geofence
    if (distance > radiusMiles) {
      console.log(
        `🚫 [AI Agent] OUT OF ZONE: Skipping ${cart.customerEmail} - Distance: ${distance.toFixed(2)} miles (Radius limit: ${radiusMiles.toFixed(2)} miles)`,
      );

      await db.cartRecovery.update({
        where: { id: cart.id },
        data: { agentStatus: "OUT_OF_ZONE", inDeliveryZone: false },
      });
      continue; // Skip Enterprise Dashboard leak creation and email generation
    }

    // --- PASSED GEOFENCE CHECK: PROCEED WITH RECOVERY ---
    console.log(
      `🎯 [AI Agent] Target is IN ZONE (${distance.toFixed(2)} miles)! Queued for Local Delivery Email flow.`,
    );

    const severity = value > 150 ? "CRITICAL" : value > 50 ? "WARNING" : "INFO";

    // Create the Revenue Leak record so it instantly appears on the React UI
    await db.revenueLeak.create({
      data: {
        shop: cart.shop,
        type: "ABANDONED_CART",
        severity,
        title: `$${value.toFixed(2)} Cart Abandoned`,
        potentialValue: value,
        status: "DETECTED",
        metadata: {
          cartToken: cart.cartToken,
          customerEmail: cart.customerEmail,
          lineItems: cart.lineItems,
          distanceMiles: distance, // Storing this metadata allows you to display "📍 2.4 miles away" in the UI later
        },
      },
    });

    // Mark the Cart as ready for Phase 2 (The AI Agent Email Generation)
    await db.cartRecovery.update({
      where: { id: cart.id },
      data: { agentStatus: "ANALYZING", inDeliveryZone: true },
    });

    console.log(
      `🚨 [LEAK DETECTED] ${severity} - $${value} for shop ${cart.shop}`,
    );
  }
}
