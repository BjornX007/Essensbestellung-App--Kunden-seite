"use client";

import { CheckCircle2 } from "lucide-react";
import { PaymentMethod, fmt } from "../checkout.types";

interface SuccessStepProps {
  email: string;
  orderNumber: string;
  paymentMethod: PaymentMethod;
  totalPrice: number;
  onDone: () => void;
}

export function SuccessStep({
  email,
  orderNumber,
  paymentMethod,
  totalPrice,
  onDone,
}: SuccessStepProps) {
  return (
    <div className="co-state">
      <CheckCircle2 size={56} className="co-state-icon co-state-ok" />
      <h2 className="co-title">Bestellung erfolgreich!</h2>
      <p className="co-subtitle">
        Ihre Bestellnummer lautet <strong>#{orderNumber}</strong>
      </p>

      {paymentMethod === "paypal" && (
        <p className="co-cash-note">🅿️ Zahlung über PayPal abgeschlossen.</p>
      )}
      {paymentMethod === "cash_on_delivery" && (
        <p className="co-cash-note">
          💵 Bitte halte den Betrag von{" "}
          <strong>{fmt(totalPrice)}</strong> bei Lieferung bereit.
        </p>
      )}

      <button className="co-btn-primary" onClick={onDone}>
        Fertig
      </button>
    </div>
  );
}