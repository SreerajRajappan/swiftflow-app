import db from "../db.server";

interface TrackEvent {
  shop: string;
  productId: string;
  productTitle: string; // 👈 FIX: Added required schema field
}

// Module-level array to hold views in server RAM
let viewBuffer: TrackEvent[] = [];

// Configuration
const MAX_BUFFER_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;

let flushTimer: NodeJS.Timeout | null = null;

// 👈 FIX: Accept productTitle as the third argument
export function queueProductView(
  shop: string,
  productId: string,
  productTitle: string,
) {
  viewBuffer.push({ shop, productId, productTitle });

  if (viewBuffer.length >= MAX_BUFFER_SIZE) {
    flushBuffer();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushBuffer, FLUSH_INTERVAL_MS);
  }
}

async function flushBuffer() {
  if (viewBuffer.length === 0) return;

  const batch = [...viewBuffer];
  viewBuffer = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    await db.productView.createMany({
      data: batch.map((event) => ({
        shop: event.shop,
        productId: event.productId,
        productTitle: event.productTitle, // 👈 FIX: Map it into the database creation
      })),
    });
    console.log(
      `[Tracking] Successfully bulk inserted ${batch.length} product views.`,
    );
  } catch (err) {
    console.error(
      "🚨 [Tracking] Bulk insert failed. Dropping batch to save memory:",
      err,
    );
  }
}
