"use client";

import { useEffect, useRef } from "react";
import { CartLine } from "@/app/context/CartContext";
import { fmt } from "../checkout.types";

declare global {
  interface Window {
    SumUpCard?: {
      mount: (options: {
        id: string;
        checkoutId: string;
        onResponse: (type: string, body: unknown) => void;
        showSubmitButton?: boolean;
        showZipCode?: boolean;
        showInstallments?: boolean;
        locale?: string;
      }) => void;
    };
  }
}

interface PaymentStepProps {
  checkoutId: string;
  lines: CartLine[];
  totalPrice: number;
  deliveryFee?: number;
  onBack: () => void;
  onPaid: () => void;
  onError: () => void;
}

export default function PaymentStep({
  checkoutId,
  lines,
  totalPrice,
  deliveryFee = 0,
  onBack,
  onPaid,
  onError,
}: PaymentStepProps) {
  const mounted = useRef(false);

  const subtotal = lines.reduce((sum, { product, qty }) => {
  return sum + Number(product.price || 0) * Number(qty || 0);
}, 0);

const safeDeliveryFee = Number(deliveryFee || 0);

const finalTotal = subtotal + safeDeliveryFee;

  useEffect(() => {
    if (mounted.current) return;

    const tryMount = () => {
      if (!window.SumUpCard) {
        setTimeout(tryMount, 150);
        return;
      }

      mounted.current = true;

      window.SumUpCard.mount({
        id: "sumup-card",
        checkoutId,
        locale: "de-DE",
        showSubmitButton: true,
        showZipCode: false,

        async onResponse(type, body) {
          console.log(
            "SumUp widget response:",
            type,
            JSON.stringify(body)
          );

          const res = body as { status?: string };

          if (type === "response" && res?.status === "PAID") {
            onPaid();
          } else if (type === "error" || type === "fail") {
            onError();
          }
        },
      });
    };

    tryMount();

    return () => {
      mounted.current = false;
    };
  }, [checkoutId, onPaid, onError]);

  return (
    <>
      <button
        type="button"
        className="co-btn-ghost"
        onClick={onBack}
      >
        ← Zurück
      </button>

      <h2 className="co-title">Kartenzahlung</h2>

      <div className="co-summary">
        {lines.map(({ product, qty }) => {
          const lineTotal =
            Number(product.price || 0) * Number(qty || 0);

          return (
            <div
              key={product.id}
              className="co-summary-row"
            >
              <span>
                {qty}× {product.name}
              </span>

              <span>{fmt(lineTotal)}</span>
            </div>
          );
        })}

        <div className="co-summary-divider" />

        <div className="co-summary-row">
          <span>Zwischensumme</span>
          <span>{fmt(subtotal)}</span>
        </div>

        <div className="co-summary-row">
          <span>Liefergebühr</span>
          <span>
            {safeDeliveryFee > 0
              ? fmt(safeDeliveryFee)
              : "0,00 €"}
          </span>
        </div>

        <div className="co-summary-row co-summary-total">
          <span>Gesamt</span>
          <span>{fmt(subtotal + safeDeliveryFee)}</span>
        </div>
      </div>

      <div
        id="sumup-card"
        className="co-sumup-widget"
      />

      <p className="co-secure-note">
        🔒 Zahlung gesichert durch SumUp · PCI DSS konform
      </p>
    </>
  );
}