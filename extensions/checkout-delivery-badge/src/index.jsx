import { useEffect, useState } from "react";
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
      // Only check if we have cart items
      if (!cartLines || cartLines.length === 0) {
        setStatus("hidden");
        return;
      }

      try {
        // Get shop domain and make API call
        const shopDomain = shop.myshopifyDomain;
        const response = await fetch(
          `https://${shopDomain}/apps/swiftflow/api/delivery-check`,
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
          setMessage(data.message || "Great news! We deliver to your area.");

          // Mark this cart for tracking
          await applyAttributeChange({
            type: "updateAttribute",
            key: "_swiftflow_delivery",
            value: "true",
          });
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
