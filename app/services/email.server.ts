import { Resend } from "resend";
import db from "../db.server";
import { geocodeAddress } from "./geocoding.server";
import { calculateDistance, getRadiusInMiles } from "./proximity.server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendRecoveryEmail(
  shop: string,
  customerEmail: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  merchantReplyTo?: string,
) {
  try {
    const storeName = shop
      .split(".")[0]
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const { data, error } = await resend.emails.send({
      from: `${storeName} <hello@logiclooms.io>`,
      replyTo: merchantReplyTo || "hello@logiclooms.io",
      to: customerEmail,
      subject: subject,
      html: htmlBody,
      text: textBody,
    });

    if (error) {
      console.error("[Resend] Failed to send email:", error);
      return false;
    }

    console.log(
      `[Resend] Successfully sent recovery email to ${customerEmail}. ID: ${data?.id}`,
    );
    return true;
  } catch (error) {
    console.error("[Resend] Exception sending email:", error);
    return false;
  }
}

// Helper to chunk arrays
function chunkCarts<T>(array: T[], size: number): T[][] {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

export async function processAbandonedCarts(shop: string) {
  console.log(
    `🤖 [AI Agent] Waking up to check for abandoned carts for ${shop}...`,
  );

  const oneHourAgo = new Date(Date.now() - 1 * 60 * 1000);

  const settings = await db.appSettings.findUnique({
    where: { shop },
  });

  if (!settings || !settings.storeLat || !settings.storeLng) {
    console.log(`⚠️ [AI Agent] Store coordinates missing for ${shop}.`);
    return;
  }

  const radiusMiles = getRadiusInMiles(
    settings.deliveryRadius,
    settings.unitSystem,
  );

  const abandonedCarts = await db.cartRecovery.findMany({
    where: {
      shop,
      updatedAt: { lte: oneHourAgo },
      recovered: false,
      agentStatus: { in: ["IDLE", "IN_ZONE"] },
    },
  });

  if (abandonedCarts.length === 0) return;

  // 🚀 1.1 FIX: Concurrent Cart Batch Processing (Replaces the slow sequential loop)
  const cartBatches = chunkCarts(abandonedCarts, 5);

  for (const batch of cartBatches) {
    await Promise.allSettled(
      batch.map(async (cart) => {
        const value = cart.cartValue || 0;

        console.log(
          `\n🔎 [AI Agent] Analyzing cart for: ${cart.customerEmail}`,
        );

        if (value < 10) return;

        let custLat = cart.customerLat;
        let custLng = cart.customerLng;

        if ((!custLat || !custLng) && cart.customerAddress) {
          const coords = await geocodeAddress(cart.customerAddress);
          if (coords) {
            custLat = coords.lat;
            custLng = coords.lng;
            await db.cartRecovery.update({
              where: { id: cart.id },
              data: { customerLat: custLat, customerLng: custLng },
            });
          }
        }

        if (!custLat || !custLng) {
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "NO_ADDRESS" },
          });
          return;
        }

        const distance = calculateDistance(
          settings.storeLat!,
          settings.storeLng!,
          custLat,
          custLng,
        );

        if (distance > radiusMiles) {
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "OUT_OF_ZONE", inDeliveryZone: false },
          });
          return;
        }

        const severity =
          value > 150 ? "CRITICAL" : value > 50 ? "WARNING" : "INFO";

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
              distanceMiles: distance,
            },
          },
        });

        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "ANALYZING", inDeliveryZone: true },
        });
      }),
    );
  }
}
