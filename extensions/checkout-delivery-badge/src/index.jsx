/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useEffect, useState } from "react";
import {
  reactExtension,
  Banner,
  useApi,
  useApplyAttributeChange,
  useShippingAddress,
  useSettings as useExtensionSettings,
} from "@shopify/ui-extensions-react/checkout";

// Standard Shopify entry point for rendering inside the checkout
export default reactExtension("purchase.checkout.block.render", () => (
  <DeliveryBadge />
));

function DeliveryBadge() {
  const { shop } = useApi();
  const shippingAddress = useShippingAddress();
  const applyAttributeChange = useApplyAttributeChange();
  const settings = useExtensionSettings();

  const [shown, setShown] = useState(false);
  const [message, setMessage] = useState("");

  // The merchant sets this URL in the Checkout Editor settings
  const appUrl = settings?.app_url ?? "";

  // Build a stable address string so we only re-fetch when the actual location changes
  const addressStr = [
    shippingAddress?.address1,
    shippingAddress?.city,
    shippingAddress?.province,
    shippingAddress?.zip,
    shippingAddress?.countryCode,
  ]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    // If we don't have enough data, hide the badge
    if (!addressStr || !appUrl || !shop?.myshopifyDomain) {
      setShown(false);
      return;
    }

    let cancelled = false;

    // Call our app's public API to verify the distance
    const url = `${appUrl}/api/delivery-check?shop=${encodeURIComponent(
      shop.myshopifyDomain,
    )}&address=${encodeURIComponent(addressStr)}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        if (data.inRadius) {
          setShown(true);
          // Fallback to a default message if the backend doesn't provide one
          setMessage(data.message ?? "Great news! We deliver to your area.");

          // CRITICAL: This exact key maps to our ORDERS_CREATE webhook for Revenue Tracking
          applyAttributeChange({
            type: "updateAttribute",
            key: "_swiftflow_delivery",
            value: "true",
          });
        } else {
          setShown(false);
        }
      })
      .catch((err) => {
        console.error("[SwiftFlow] Delivery check failed:", err);
        if (!cancelled) setShown(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addressStr, appUrl, shop?.myshopifyDomain, applyAttributeChange]);

  if (!shown) return null;

  // Render using Polaris-style native checkout components
  return <Banner status="success">{message}</Banner>;
}
