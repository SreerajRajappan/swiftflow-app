import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// 1. New entry point format
export default function extension() {
  render(<DeliveryBadge />, document.body);
}

function DeliveryBadge() {
  // 2. We now read directly from the global `shopify` object!
  const shopDomain = shopify.shop.myshopifyDomain;
  const shippingAddress = shopify.shippingAddress?.value;

  const [deliveryAvailable, setDeliveryAvailable] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkDelivery() {
      if (!shippingAddress?.address1) {
        setLoading(false);
        return;
      }

      try {
        // ⚠️ NOTE: Replace 'your-app-url.com' with your actual App Proxy / Tunnel URL
        const response = await fetch(
          `https://your-app-url.com/api/check-delivery?shop=${shopDomain}&address=${encodeURIComponent(
            `${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.zip}`,
          )}`,
        );

        const data = await response.json();
        setDeliveryAvailable(data.inRadius);

        // Check if we are allowed to update attributes, then apply it
        if (
          data.inRadius &&
          shopify.instructions.value.attributes.canUpdateAttributes
        ) {
          await shopify.applyAttributeChange({
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
  }, [
    shippingAddress?.address1,
    shippingAddress?.city,
    shippingAddress?.zip,
    shopDomain,
  ]);

  if (loading || deliveryAvailable === null) return null;

  if (deliveryAvailable) {
    // 3. We use Polaris Web Components natively (s-banner instead of Banner)
    return (
      <s-banner tone="success" heading="Great news!">
        We deliver to your area! Your order will arrive fresh and fast.
      </s-banner>
    );
  }

  return null;
}
