import React, { useEffect, useState } from "react";
import {
  reactExtension,
  Banner,
  useApi,
  useApplyAttributeChange,
  useExtensionCapability,
  useBuyerJourneyIntercept,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.checkout.block.render", () => (
  <DeliveryBadge />
));

function DeliveryBadge() {
  const { extension, shop } = useApi();
  const [deliveryAvailable, setDeliveryAvailable] = useState(null);
  const [loading, setLoading] = useState(true);
  const applyAttributeChange = useApplyAttributeChange();

  // Get customer's address from checkout
  const { shippingAddress } = useApi();

  useEffect(() => {
    async function checkDelivery() {
      if (!shippingAddress?.address1) {
        setLoading(false);
        return;
      }

      try {
        // Call your app's API to check if address is in delivery radius
        const response = await fetch(
          `https://your-app-url.com/api/check-delivery?shop=${shop.myshopifyDomain}&address=${encodeURIComponent(
            `${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.zip}`,
          )}`,
        );

        const data = await response.json();
        setDeliveryAvailable(data.inRadius);

        // Track this view for analytics
        if (data.inRadius) {
          await applyAttributeChange({
            type: "updateAttribute",
            key: "_swiftflow_in_delivery_zone",
            value: "true",
          });
        }
      } catch (error) {
        console.error("Delivery check failed:", error);
      } finally {
        setLoading(false);
      }
    }

    checkDelivery();
  }, [shippingAddress]);

  if (loading || deliveryAvailable === null) return null;

  if (deliveryAvailable) {
    return (
      <Banner status="success" title="Great news!">
        We deliver to your area! Your order will arrive fresh and fast.
      </Banner>
    );
  }

  return null;
}
