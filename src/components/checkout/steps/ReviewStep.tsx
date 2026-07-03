"use client";

import { Loader2 } from "lucide-react";
import { CartLine } from "@/app/context/CartContext";
import { fmt } from "../checkout.types";

interface ReviewStepProps {
  lines: CartLine[];
  totalPrice: number;
  deliveryFee?: number;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export default function ReviewStep({
  lines,
  totalPrice,
  deliveryFee = 0,
  submitting,
  onBack,
  onConfirm,
}: ReviewStepProps) {
  const safeTotalPrice = Number(totalPrice || 0);
  const safeDeliveryFee = Number(deliveryFee || 0);
  const finalTotal = safeTotalPrice + safeDeliveryFee;

  return (
    <>
      <h2 className="co-title">Bestellübersicht</h2>

      <p className="co-subtitle">
        Bitte überprüfe deine Bestellung vor der Bestätigung.
      </p>

      <div className="co-summary">
        {lines.map(({ product, qty }) => {
          const lineTotal = Number(product.price || 0) * Number(qty || 0);

          return (
            <div key={product.id} className="co-summary-row">
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
  <span>{fmt(safeTotalPrice)}</span>
</div>

<div className="co-summary-row">
  <span>Liefergebühr</span>
  <span>
    {safeDeliveryFee > 0 ? fmt(safeDeliveryFee) : "0,00 €"}
  </span>
</div>

<div className="co-summary-row co-summary-total">
  <span>Gesamt</span>
  <span>{fmt(safeTotalPrice + safeDeliveryFee)}</span>
</div>      </div>

      <div className="co-payment-badge">
         Zahlung bei Lieferung (Bar)
      </div>

      <div className="co-btn-row">
        <button
          type="button"
          className="co-btn-back"
          onClick={onBack}
          disabled={submitting}
        >
          ← Zurück
        </button>

        <button
          type="button"
          className="co-btn-primary"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="co-spin" />
              {" "}Wird bearbeitet…
            </>
          ) : (
            "Bestellung bestätigen ✓"
          )}
        </button>
      </div>
    </>
  );
}