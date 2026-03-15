import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO } from "../constants";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const url = new URL(request.url);

  // IMPORTANT: Strict billing check preserved
  if (url.pathname !== "/app/billing") {
    await billing.require({
      plans: [MONTHLY_PLAN_BASIC, MONTHLY_PLAN_PRO],
      isTest: true,
      onFailure: async () => {
        throw redirect(`/app/billing${url.search}`);
      },
    });
  }

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      {/* NATIVE SHOPIFY LEFT SIDEBAR */}
      <NavMenu>
        <Link to="/app" rel="home">
          Revenue Suite
        </Link>
        <Link to="/app/delivery">Delivery</Link>
        <Link to="/app/leaks">Revenue Leaks</Link>
        <Link to="/app/insights">Insights</Link>
        <Link to="/app/personalizer">Personalizer</Link>
        <Link to="/app/billing">Plans</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs these headers
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
