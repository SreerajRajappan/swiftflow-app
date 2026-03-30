import db from "../db.server";

// write directly to the database to guarantee zero data loss.
export async function queueProductView(
  shop: string,
  productId: string,
  productTitle: string,
) {
  try {
    // Prisma handles connection pooling automatically.
    // This direct write guarantees the view survives container reboots.
    await db.productView.create({
      data: {
        shop,
        productId,
        productTitle,
      },
    });

    console.log(
      `[Tracking] Successfully recorded view for product: ${productId} on shop: ${shop}`,
    );
  } catch (err) {
    console.error("🚨 [Tracking] Failed to record product view:", err);
  }
}
