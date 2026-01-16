import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { useOrder } from '@shopify/ui-extensions/customer-account/preact';

export default async function extension() {
  render(<OrderHelpExtension />, document.body);
}

function OrderHelpExtension() {
  const [showSupportPanel, setShowSupportPanel] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // TODO: Replace `orderNumber` with the correct field from the
  // Customer Account order API for this target once known.
  //
  // For example, once you read the order details from the `shopify` APIs,
  // you might do something like:
  // const orderNumber = shopify.order.current.value.name ?? shopify.order.current.value.id;
  //
  // For now we use a placeholder so the structure is clear.
  const order = useOrder();
  const orderNumber = order?.name ?? '';

  const handleCopySuccess = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleEmailSupport = () => {
    const subject = encodeURIComponent(`Help with ${orderNumber}`);
    const body = encodeURIComponent(
      'Hi support team,%0D%0A%0D%0AI need help with this order.%0D%0A%0D%0AThank you!',
    );

    // Use mailto: to let the buyer send an email from their email client.
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  };

  return (
    <s-section heading="Need help with this order?">
      <s-clipboard-item
        id="order-clipboard"
        text={orderNumber}
        onCopy={handleCopySuccess}
      />
      <s-stack direction="block" gap="base">
        <s-text>
          If you have a question about this order, you can contact our support team.
        </s-text>

        <s-stack direction="inline" gap="base">
          <s-button
            tone="auto"
            variant="secondary"
            onClick={() => setShowSupportPanel(true)}
          >
            Help &amp; contact options
          </s-button>

          <s-stack direction="inline" gap="base">
            <s-text color="subdued">Order:</s-text>
            <s-text type="strong">{orderNumber}</s-text>
            <s-button
              tone="neutral"
              variant="secondary"
              commandFor="order-clipboard"
              command="--copy"
            >
              {isCopied ? 'Copied' : 'Copy order number'}
            </s-button>
          </s-stack>
        </s-stack>

        {showSupportPanel && (
          <s-section heading="Contact support by email">
            <s-stack direction="block" gap="base">
              <s-text>
                Click the button below to open your email client with a pre-filled
                message to our support team.
              </s-text>

              <s-button
                tone="auto"
                variant="primary"
                onClick={handleEmailSupport}
              >
                Open email to support
              </s-button>

              <s-button
                tone="critical"
                variant="secondary"
                onClick={() => setShowSupportPanel(false)}
              >
                Close
              </s-button>
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-section>
  );
}