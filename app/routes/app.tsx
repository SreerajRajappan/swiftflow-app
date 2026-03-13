import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node"; // 👈 Added redirect here
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";

import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants"; // 👈 Added plan constants

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const url = new URL(request.url);

  // 1. The Paywall Bypass: Don't block the merchant if they are already on the billing page!
  if (url.pathname !== "/app/billing") {
    // 2. The Paywall: Require one of our two active plans
    await billing.require({
      plans: [MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO],
      isTest: true, // IMPORTANT: Keeps your card from being charged during development
      onFailure: async () => {
        // 3. The Redirect: Send them to our custom Polaris pricing page
        throw redirect(`/app/billing${url.search}`);
      },
    });
  }

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  // Use the type-safe loader data from Remix
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <ui-nav-menu>
          <a href="/app" rel="home">
            Home
          </a>
          <a href="/app/billing" rel="plans">
            Plans
          </a>
        </ui-nav-menu>
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

// In the Remix/Shopify default template, the ErrorBoundary
// is usually handled globally, but here is the stable version:
export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  return <div>An error occurred. Please check the console.</div>;
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
  return {
    "Content-Security-Policy":
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
  };
};
