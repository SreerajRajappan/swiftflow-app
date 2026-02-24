import React, { useEffect, useState } from "react";
import {
  reactExtension,
  Banner,
  useApi,
  useCartLines,
  useApplyAttributeChange,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.checkout.block.render", () => (
  <DeliveryBadge />
));

function DeliveryBadge() {
  const { shop, extensionPoint } = useApi();
  const cartLines = useCartLines();
  const applyAttributeChange = useApplyAttributeChange();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkDelivery() {
      if (!cartLines || cartLines.length === 0) {
        setStatus("hidden");
        return;
      }

      try {
        const shopDomain = shop.myshopifyDomain;

        // Try to get user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;

              // Call the correct API endpoint
              const response = await fetch(
                `https://${shopDomain}/apps/api/delivery-check?shop=${shopDomain}&lat=${latitude}&lng=${longitude}`,
                {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  },
                },
              );

              const data = await response.json();

              if (data.inRadius) {
                setStatus("success");
                setMessage(
                  data.message || "Great news! We deliver to your area.",
                );

                await applyAttributeChange({
                  type: "updateAttribute",
                  key: "_swiftflow_delivery",
                  value: "true",
                });
              } else {
                setStatus("hidden");
              }
            },
            (error) => {
              console.error("Geolocation error:", error);
              setStatus("hidden");
            },
          );
        } else {
          setStatus("hidden");
        }
      } catch (error) {
        console.error("Delivery check failed:", error);
        setStatus("hidden");
      }
    }

    checkDelivery();
  }, [cartLines, shop, applyAttributeChange]);

  if (status === "loading" || status === "hidden") {
    return null;
  }

  return <Banner status="success">{message}</Banner>;
}
