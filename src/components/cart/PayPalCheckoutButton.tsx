"use client";

import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

interface Props {
  amount: number;
  disabled?: boolean;
  onApprove: (paypalOrderId: string) => Promise<void>;
  onError?: () => void;
  onCancel?: () => void;
}

function PayPalButtonsInner({ amount, disabled, onApprove, onError, onCancel }: Props) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const [localError, setLocalError] = useState<string | null>(null);

  if (isRejected) {
    return (
      <div style={styles.errorBox}>
        ❌ PayPal konnte nicht geladen werden. Adblocker prüfen oder Seite neu laden.
      </div>
    );
  }

  if (isPending) {
    return (
      <div style={styles.loadingBox}>
        <span style={styles.spinner} /> PayPal wird geladen…
      </div>
    );
  }

  return (
    <>
      {localError && <div style={{ ...styles.errorBox, marginBottom: "0.5rem" }}>{localError}</div>}
      <PayPalButtons
        style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 44, tagline: false }}
        disabled={disabled}
        forceReRender={[amount]}

        /* Step 1: create order server-side */
        createOrder={async () => {
          setLocalError(null);
          const res = await fetch("/api/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "PayPal order creation failed");
          return data.id as string;
        }}

        /* Step 2: capture server-side so DB gets verified "paid" status */
        onApprove={async (data) => {
          setLocalError(null);
          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paypalOrderId: data.orderID }),
          });
          const result = await res.json();
          if (!res.ok || !result.verified) {
            setLocalError("Zahlung konnte nicht verifiziert werden.");
            onError?.();
            return;
          }
          // Pass the verified paypal order ID up to CheckoutModal
          // which calls /api/checkout to save the order with status="paid"
          await onApprove(data.orderID);
        }}

        onError={(err) => {
          console.error("PayPal error:", err);
          setLocalError("PayPal-Fehler aufgetreten. Bitte erneut versuchen.");
          onError?.();
        }}
        onCancel={() => onCancel?.()}
      />
    </>
  );
}

export default function PayPalCheckoutButton(props: Props) {
  if (!PAYPAL_CLIENT_ID) {
    return (
      <div style={styles.errorBox}>
        ⚠️ <strong>NEXT_PUBLIC_PAYPAL_CLIENT_ID</strong> fehlt in <code>.env.local</code>
      </div>
    );
  }

  return (
    <PayPalScriptProvider
      options={{ clientId: PAYPAL_CLIENT_ID, currency: "EUR", intent: "capture", components: "buttons" }}
    >
      <div style={{ opacity: props.disabled ? 0.5 : 1, pointerEvents: props.disabled ? "none" : "auto", minHeight: 50 }}>
        <PayPalButtonsInner {...props} />
      </div>
    </PayPalScriptProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  errorBox: {
    background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "8px",
    padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#be123c", lineHeight: 1.5,
  },
  loadingBox: {
    display: "flex", alignItems: "center", gap: "0.5rem",
    padding: "0.75rem", color: "#888", fontSize: "0.85rem",
  },
  spinner: {
    display: "inline-block", width: "14px", height: "14px",
    border: "2px solid #e4e4e7", borderTopColor: "#888",
    borderRadius: "50%", animation: "pp-spin 0.7s linear infinite",
  },
};