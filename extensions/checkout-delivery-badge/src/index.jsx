import { useEffect, useState } from "react";
import {
  reactExtension,
  Banner,
  useApi,
  useApplyAttributeChange,
  useShippingAddress,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.checkout.block.render", () => (
  <DeliveryBadge />
));

function DeliveryBadge() {
  const { shop } = useApi();
  const [deliveryAvailable, setDeliveryAvailable] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyAttributeChange = useApplyAttributeChange();
  const shippingAddress = useShippingAddress();

  useEffect(() => {
    if (!shippingAddress?.address1) {
      setLoading(false);
      return;
    }

    // ⚠️ NOTE: Replace 'your-app-url.com' with your actual production or tunnel URL
    const url = `https://your-app-url.com/api/check-delivery?shop=${shop.myshopifyDomain}&address=${encodeURIComponent(
      `${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.zip}`,
    )}`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setDeliveryAvailable(data.inRadius);
        if (data.inRadius) {
          applyAttributeChange({
            type: "updateAttribute",
            key: "_swiftflow_in_delivery_zone",
            value: "true",
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [shippingAddress, shop.myshopifyDomain, applyAttributeChange]);

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
