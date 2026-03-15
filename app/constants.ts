// app/constants.ts
export const PLAN_BASIC_MONTHLY = "Basic Plan - Monthly";
export const PLAN_BASIC_ANNUAL = "Basic Plan - Annual";

export const PLAN_PRO_MONTHLY = "Pro Suite - Monthly";
export const PLAN_PRO_ANNUAL = "Pro Suite - Annual";

export const PLAN_ELITE_MONTHLY = "Elite Suite - Monthly";
export const PLAN_ELITE_ANNUAL = "Elite Suite - Annual";

// Helper arrays to make checking billing status easier across the app
export const BASIC_PLANS = [PLAN_BASIC_MONTHLY, PLAN_BASIC_ANNUAL];
export const PRO_PLANS = [PLAN_PRO_MONTHLY, PLAN_PRO_ANNUAL];
export const ELITE_PLANS = [PLAN_ELITE_MONTHLY, PLAN_ELITE_ANNUAL];

export const ALL_PAID_PLANS = [...BASIC_PLANS, ...PRO_PLANS, ...ELITE_PLANS];
