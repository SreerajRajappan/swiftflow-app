import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  json,
} from "@remix-run/node";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { BASIC_PLANS, PRO_PLANS, ELITE_PLANS } from "../constants";

function authenticateCron(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const rawSecret = process.env.CRON_SECRET || "UNDEFINED_SECRET";
  const expectedToken = `Bearer ${rawSecret.trim()}`;
  return authHeader === expectedToken;
}

async function executeWeeklyROIReport() {
  console.log("📈 Starting Weekly ROI Report Dispatch...");

  const activeShops = await db.appSettings.findMany({
    where: { revenueSuiteEnabled: true },
    select: { shop: true },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const { shop } of activeShops) {
    try {
      // 1. Fetch the true Account Owner's email from the Session table
      const ownerSession = await db.session.findFirst({
        where: { shop, accountOwner: true },
        select: { email: true },
      });
      const merchantEmail = ownerSession?.email;
      if (!merchantEmail) continue;

      // 2. Calculate purely Assisted/Recovered Revenue (NO Organic)
      const conversions = await db.conversionEvent.aggregate({
        where: {
          shop,
          createdAt: { gte: sevenDaysAgo },
          source: { in: ["delivery_badge", "cart_recovery"] },
        },
        _sum: { orderValue: true },
      });
      const weeklyRevenue = conversions._sum.orderValue || 0;

      // Only send the email if we actually generated meaningful revenue
      if (weeklyRevenue < 20) continue;

      // 3. Determine their live plan cost to calculate strict ROI
      const { admin } = await unauthenticated.admin(shop);
      const response = await admin.graphql(`
        #graphql
        query { currentAppInstallation { activeSubscriptions { name status } } }
      `);
      const payload = await response.json();
      const activeSub =
        payload.data?.currentAppInstallation?.activeSubscriptions?.find(
          (sub: any) => sub.status === "ACTIVE",
        );
      const planName = activeSub?.name || "";

      // 🚀 THE FIX: Use BASIC_PLANS to build an impenetrable gate
      const isBasic = BASIC_PLANS.includes(planName);
      const isPro = PRO_PLANS.includes(planName);
      const isElite = ELITE_PLANS.includes(planName);

      // If they are not on any of our paid tiers, DO NOT send them an ROI email
      if (!isBasic && !isPro && !isElite) {
        console.log(
          `🛑 Shop ${shop} is not on an active paid plan. Skipping ROI email.`,
        );
        continue;
      }

      // We now confidently know they are on a paid plan, so we map the exact cost
      let planCost = 29.99; // Safely default to the lowest tier
      if (isPro) planCost = 49.99;
      if (isElite) planCost = 99.99;

      // 4. The ROI Math: (Weekly Revenue / Weekly App Cost)
      const weeklyCost = planCost / 4;
      const roiMultiplier = Math.round(weeklyRevenue / weeklyCost);

      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e1e3e5; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #008060; margin-top: 0;">SwiftFlow Weekly Performance 🚀</h2>
          <p style="color: #202223; font-size: 16px;">Hi there,</p>
          <p style="color: #202223; font-size: 16px;">Here is your weekly ROI report. This week, SwiftFlow's AI Agent and Delivery Badge directly recovered and generated:</p>
          
          <div style="background-color: #f4f6f8; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
            <h1 style="font-size: 42px; color: #202223; margin: 0;">$${weeklyRevenue.toFixed(2)}</h1>
            <p style="color: #008060; font-weight: bold; margin-top: 10px; font-size: 16px;">
              That's a ${roiMultiplier}x Return on Investment this week!
            </p>
          </div>
          
          <p style="color: #202223; font-size: 16px;">Log in to your Shopify admin to view detailed conversion charts and missed revenue hotspots.</p>
          <br/>
          <p style="color: #6d7175; font-size: 12px; border-top: 1px solid #e1e3e5; padding-top: 15px;">
            You are receiving this automated report because you are the registered account owner of ${shop}.
          </p>
        </div>
      `;

      // 5. Dispatch via standard Resend REST API
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SwiftFlow Growth <reports@yourverifieddomain.com>", // Update to your domain
          to: merchantEmail,
          subject: `SwiftFlow recovered $${weeklyRevenue.toFixed(2)} for you this week! 💰`,
          html: htmlBody,
        }),
      });

      console.log(
        `✉️ [CHURN PREVENTED] Weekly ROI email sent to ${shop} (${merchantEmail})`,
      );
    } catch (err) {
      console.error(`❌ Failed to send ROI email to ${shop}`, err);
    }
  }

  return json({ success: true });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!authenticateCron(request))
    return json({ error: "Unauthorized" }, { status: 401 });
  return executeWeeklyROIReport();
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!authenticateCron(request))
    return json({ error: "Unauthorized" }, { status: 401 });
  return executeWeeklyROIReport();
};
