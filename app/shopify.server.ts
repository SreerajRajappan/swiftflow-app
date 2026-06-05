import "@shopify/shopify-app-remix/adapters/node";
import {
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  ApiVersion,
  BillingInterval,
  BillingReplacementBehavior,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  billing: {
    "Basic Plan - Monthly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      trialDays: 14,
      lineItems: [
        {
          amount: 29.0,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    "Basic Plan - Annual": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      trialDays: 14,
      lineItems: [
        {
          amount: 279.0,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
      ],
    },
    "Pro Suite - Monthly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      trialDays: 14,
      lineItems: [
        {
          amount: 49.0,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    "Pro Suite - Annual": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      trialDays: 14,
      lineItems: [
        {
          amount: 469.0,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
      ],
    },
    "Elite Suite - Monthly": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      trialDays: 14,
      lineItems: [
        {
          amount: 99.0,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    "Elite Suite - Annual": {
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
      trialDays: 14,
      lineItems: [
        {
          amount: 949.0,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
      ],
    },
  },
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/app/uninstalled",
    },
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
    },
    CHECKOUTS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/checkouts/update",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      shopify.registerWebhooks({ session });
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
});

export default shopify;
export const apiVersion = ApiVersion.April24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
