export type ZoneHealth = {
  score: number;
  label: string;
  tips: string[];
};

export function calculateZoneHealth(
  settings: any,
  totalViews: number,
  conversionRate: number,
): ZoneHealth {
  let score = 0;
  const tips: string[] = [];

  // Core Setup (45 points)
  if (settings?.storeLat && settings?.storeLng) {
    score += 25;
  } else {
    tips.push("Confirm your store location for accurate delivery checks.");
  }

  if (settings?.hasCustomizedRadius) {
    score += 20;
  } else {
    tips.push(
      "Customize your delivery radius to match your actual delivery area.",
    );
  }

  // Revenue Features (40 points)
  if (settings?.revenueSuiteEnabled) {
    score += 25;
  } else {
    tips.push("Enable the Revenue Suite to start recovering abandoned carts.");
  }

  if (settings?.recoveryEmailEnabled) {
    score += 15;
  } else {
    tips.push(
      "Enable recovery emails in the Delivery tab to re-engage local customers.",
    );
  }

  // Traffic & Analytics (15 points)
  if (totalViews > 10) {
    score += 10;
  } else {
    tips.push(
      "Get more visitors! More storefront widget views = more AI data.",
    );
  }

  if (conversionRate > 5) {
    score += 5;
  }

  const label =
    score >= 90
      ? "Excellent"
      : score >= 70
        ? "Good"
        : score >= 50
          ? "Needs Work"
          : "Getting Started";

  return { score, label, tips };
}
