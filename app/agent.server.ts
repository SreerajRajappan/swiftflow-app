import { OpenAI } from "openai";
import { Resend } from "resend";
import db from "./db.server";

// Initialize OpenAI and Resend using production secrets
const openai = new OpenAI();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function runCartRecoveryAgent() {
  console.log("🤖 [AI Agent] Waking up to check for abandoned carts...");

  try {
    // 1. Find all carts that are waiting for the Agent
    const pendingCarts = await db.cartRecovery.findMany({
      where: {
        agentStatus: "ANALYZING",
        emailSent: false,
        inDeliveryZone: true,
      },
      take: 10,
    });

    if (pendingCarts.length === 0) {
      console.log("🤖 [AI Agent] No pending carts found. Going back to sleep.");
      return;
    }

    console.log(`🤖 [AI Agent] Found ${pendingCarts.length} carts to process.`);

    for (const cart of pendingCarts) {
      // --- NEW: Find the associated Revenue Leak to keep the UI in sync ---
      const leaks = await db.revenueLeak.findMany({
        where: { shop: cart.shop },
      });
      // Find the most recent leak matching this cart token
      const currentLeak = leaks
        .reverse()
        .find((l) => (l.metadata as any)?.cartToken === cart.cartToken);

      // 2. Lock the cart immediately
      await db.cartRecovery.update({
        where: { id: cart.id },
        data: { agentStatus: "PROCESSING" },
      });

      // Show "Agent Working" in the UI
      if (currentLeak) {
        await db.revenueLeak.update({
          where: { id: currentLeak.id },
          data: { status: "AGENT_WORKING" },
        });
      }

      // 3. Validate we have an email address to send to
      if (!cart.customerEmail) {
        console.log(
          `⚠️ [AI Agent] Skipping cart ${cart.cartToken} - No email found.`,
        );
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "SKIPPED" },
        });
        continue;
      }

      // 4. Get the shop's global settings
      const settings = await db.appSettings.findUnique({
        where: { shop: cart.shop },
      });

      if (!settings) continue;

      // 5. Extract product names
      const items = cart.lineItems as any[];
      const productNames =
        items?.map((item) => item.title).join(", ") || "your selected items";

      // 6. Determine A/B variant
      const abMessage =
        cart.abTestVariant === "A"
          ? settings.abTestMessageA
          : settings.abTestMessageB;

      // 7. Generate the AI Content
      const prompt = `
        You are an expert e-commerce copywriter for a store named ${cart.shop}. 
        A customer just abandoned their cart containing: ${productNames}.
        They live in our local delivery zone. 

        Write a warm, 3-sentence email to encourage them to complete their $${cart.cartValue} order.
        Include this specific offer seamlessly: "${abMessage}"
        
        No subject line. Just the email body.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const generatedEmailBody = response.choices[0]?.message?.content?.trim();

      if (generatedEmailBody) {
        // 8. DISPATCH: Send the actual email via Resend
        try {
          await resend.emails.send({
            from: "SwiftFlow <hello@logiclooms.io>",
            to: cart.customerEmail,
            subject:
              settings.recoveryEmailSubject ||
              "We're headed your way! Finish your order?",
            text: generatedEmailBody,
          });

          // 9. UPDATE: Mark as sent and record the AI's work
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: {
              agentStatus: "COMPLETED",
              generatedEmail: generatedEmailBody,
              emailSent: true,
              emailSentAt: new Date(),
            },
          });

          // --- NEW: Sync the UI table to show the "Recovered" badge ---
          if (currentLeak) {
            await db.revenueLeak.update({
              where: { id: currentLeak.id },
              data: { status: "COMPLETED" },
            });
          }

          console.log(
            `✅ [AI Agent] Successfully sent recovery email to ${cart.customerEmail}`,
          );
        } catch (sendError) {
          console.error(
            `❌ [AI Agent] Resend failed for ${cart.customerEmail}:`,
            sendError,
          );
          await db.cartRecovery.update({
            where: { id: cart.id },
            data: { agentStatus: "FAILED" },
          });
        }
      } else {
        await db.cartRecovery.update({
          where: { id: cart.id },
          data: { agentStatus: "FAILED" },
        });
      }
    }
  } catch (error) {
    console.error("🚨 [AI Agent] Critical Failure:", error);
  }
}
