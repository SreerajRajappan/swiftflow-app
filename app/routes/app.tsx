//app.tsx
import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return Response.json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
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
