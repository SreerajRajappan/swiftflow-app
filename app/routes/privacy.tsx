import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - SwiftFlow" },
    {
      name: "description",
      content: "Privacy Policy for SwiftFlow Shopify App",
    },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        lineHeight: "1.6",
        color: "#333",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "10px" }}>
        Privacy Policy for SwiftFlow
      </h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        <strong>Last Updated:</strong> March 23, 2026
      </p>

      <p>
        SwiftFlow ("we", "us", or "our") provides the SwiftFlow: Local Delivery
        application (the "App") for Shopify merchants. This Privacy Policy
        describes how personal information is collected, used, and shared when
        you install or use the App in connection with your Shopify-supported
        store.
      </p>

      <h2
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "10px",
          marginTop: "30px",
        }}
      >
        1. Personal Information We Collect
      </h2>
      <p>
        When you install the App, we automatically access certain types of
        information from your Shopify account:
      </p>
      <ul>
        <li>
          <strong>Merchant Information:</strong> We collect your Shopify domain,
          store email, and localized settings to configure your app dashboard
          and provide customer support.
        </li>
        <li>
          <strong>Customer Information:</strong> To provide our core services
          (cart recovery and local delivery radius verification), we process
          data related to your customers' abandoned checkouts. This includes
          customer email addresses, shipping addresses (specifically to
          calculate distance), and order notes.
        </li>
        <li>
          <strong>Storefront Analytics:</strong> We process aggregated,
          non-personally identifiable data regarding active storefront visitors
          to power the Live Visitor Count widget.
        </li>
      </ul>

      <h2
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "10px",
          marginTop: "30px",
        }}
      >
        2. How We Use Your Personal Information
      </h2>
      <p>
        We use the personal information we collect from you and your customers
        to provide and operate the App. Specifically:
      </p>
      <ul>
        <li>
          To calculate the physical distance between your store and the
          customer's shipping address.
        </li>
        <li>
          To securely generate and dispatch customized abandoned cart recovery
          emails via automated logic.
        </li>
        <li>
          To communicate with you, the merchant, regarding App updates, support,
          or billing.
        </li>
      </ul>

      <h2
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "10px",
          marginTop: "30px",
        }}
      >
        3. Sharing Your Personal Information
      </h2>
      <p>
        We do not sell your data or your customers' data to third parties. We
        only share personal information in the following limited circumstances:
      </p>
      <ul>
        <li>
          <strong>Service Providers:</strong> We share necessary data points
          securely with our hosting and AI processing providers strictly to
          facilitate the App's core functionality (e.g., generating personalized
          email text based on distance).
        </li>
        <li>
          <strong>Legal Compliance:</strong> We may share personal information
          to comply with applicable laws and regulations, to respond to a
          subpoena, search warrant, or other lawful requests for information we
          receive, or to otherwise protect our rights.
        </li>
      </ul>

      <h2
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "10px",
          marginTop: "30px",
        }}
      >
        4. Data Retention and Deletion
      </h2>
      <p>
        When a merchant uninstalls the App, we retain the data strictly for the
        duration required to process outstanding billing and analytics. We fully
        comply with Shopify's mandatory Webhooks for GDPR/CCPA data requests,
        meaning if a merchant or a customer requests data deletion through
        Shopify, our systems automatically delete all associated Personal
        Identifiable Information (PII) within 48 hours.
      </p>

      <h2
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "10px",
          marginTop: "30px",
        }}
      >
        5. Your Rights
      </h2>
      <p>
        If you are a resident of Europe (GDPR) or California (CCPA), you have
        the right to access the personal information we hold about you and to
        ask that your personal information be corrected, updated, or deleted. If
        you would like to exercise this right, please contact us through the
        contact information below.
      </p>

      <h2
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "10px",
          marginTop: "30px",
        }}
      >
        6. Changes
      </h2>
      <p>
        We may update this privacy policy from time to time to reflect, for
        example, changes to our practices or for other operational, legal, or
        regulatory reasons.
      </p>

      <h2
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "10px",
          marginTop: "30px",
        }}
      >
        7. Contact Us
      </h2>
      <p>
        For more information about our privacy practices, if you have questions,
        or if you would like to make a complaint, please contact us by email at{" "}
        <strong>[INSERT YOUR SUPPORT EMAIL HERE]</strong>.
      </p>
    </div>
  );
}
