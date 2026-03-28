import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { AppProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import "./app.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export default function App() {
  // This removes the restrictive SVG CSS the moment React hydrates and Vite has successfully injected the real Polaris CSS.
  useEffect(() => {
    const foucStyle = document.getElementById("fouc-fix");
    if (foucStyle) {
      foucStyle.remove();
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />

        {/* VITE FOUC FIX: Bruteforce SVGs to stay small. Removed by useEffect on load. */}
        <style
          id="fouc-fix"
          dangerouslySetInnerHTML={{
            __html: `
              svg {
                max-width: 24px !important;
                max-height: 24px !important;
                width: 24px !important;
                height: 24px !important;
              }
            `,
          }}
        />
      </head>
      <body>
        <AppProvider i18n={{}}>
          <Outlet />
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
