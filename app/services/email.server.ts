import { Resend } from "resend";
import db from "../db.server";

// Ensure your RESEND_API_KEY is in your .env file
const resend = new Resend(process.env.RESEND_API_KEY);

export async function processAbandonedCarts() {
  console.log("Starting abandoned cart processing...");

  // 1. Define the abandonment window (e.g., carts older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    // 2. Fetch eligible carts from your Prisma schema
    const abandonedCarts = await db.cartRecovery.findMany({
      where: {
        updatedAt: { lt: oneHourAgo },
        status: "ABANDONED",
        emailSent: false, // Ensure your schema has a boolean flag to prevent double-sending
      },
    });

    if (abandonedCarts.length === 0) {
      console.log("No abandoned carts to process at this time.");
      return;
    }

    // 3. Loop through and dispatch emails
    for (const cart of abandonedCarts) {
      // 1. Stop if there's no email (handles early abandonments)
      if (!cart.customerEmail) continue;

      // 2. Type Assertion: Tell TypeScript we are 100% sure it's a string now
      const targetEmail = cart.customerEmail as string;

      const fallbackUrl = `https://${cart.shop}/cart/${cart.cartToken}`;
      const finalUrl = cart.checkoutUrl || fallbackUrl;

      const { data, error } = await resend.emails.send({
        from: "SwiftFlow Recovery <hello@yourmerchantdomain.com>",
        // 3. Use the strictly typed variable here
        to: targetEmail,
        subject: "You left something behind! 🛒",
        html: `
          <div style="font-family: sans-serif; text-align: center;">
            <h2>We saved your cart!</h2>
            <p>Hi there,</p>
            <p>We noticed you left some great items in your cart. They are selling out fast!</p>
            <a href="${finalUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Complete Your Purchase
            </a>
          </div>
        `,
      });

      if (error) {
        console.error(`Failed to send email to ${cart.customerEmail}:`, error);
        continue; // Skip to the next cart
      }

      // 4. Mark the cart as processed in the database
      await db.cartRecovery.update({
        where: { id: cart.id },
        data: { emailSent: true },
      });

      console.log(
        `Recovery email sent to ${cart.customerEmail}. Resend ID: ${data?.id}`,
      );
    }
  } catch (err) {
    console.error("Critical error processing abandoned carts:", err);
  }
}
