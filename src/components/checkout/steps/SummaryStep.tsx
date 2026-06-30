"use client";

import { CreditCard, Banknote } from "lucide-react";
import { CartLine } from "@/app/context/CartContext";
import { PaymentMethod, fmt } from "../checkout.types";
import PayPalCheckoutButton from "@/components/cart/PayPalCheckoutButton";

interface SummaryStepProps {
  lines: CartLine[];
  subtotalPrice: number;
  deliveryFee: number;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  submitting: boolean;
  onBack: () => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardContinue: () => void;
  onCashContinue: () => void;
  onPayPalApprove: (paypalOrderId: string) => Promise<void>;
  onPayPalError: () => void;
}

export default function SummaryStep({
  lines,
  subtotalPrice,
  deliveryFee,
  totalPrice,
  paymentMethod,
  submitting,
  onBack,
  onPaymentMethodChange,
  onCardContinue,
  onCashContinue,
  onPayPalApprove,
  onPayPalError,
}: SummaryStepProps) {
  return (
    <>
      <button className="co-btn-ghost" onClick={onBack}>
        ← Zurück
      </button>

      <h2 className="co-title">Bestellübersicht</h2>

      <div className="co-summary">
        {lines.map(({ product, qty }) => (
          <div key={product.id} className="co-summary-row">
            <span>{qty}× {product.name}</span>
            <span>{fmt(product.price * qty)}</span>
          </div>
        ))}

        <div className="co-summary-divider" />

        <div className="co-summary-row">
          <span>Zwischensumme</span>
          <span>{fmt(subtotalPrice)}</span>
        </div>
        <div className="co-summary-row">
          <span>Liefergebühr</span>
          <span>{deliveryFee > 0 ? fmt(deliveryFee) : "0,00 €"}</span>
        </div>
        <div className="co-summary-row co-summary-total">
          <span>Gesamt</span>
          <span>{fmt(totalPrice)}</span>
        </div>
      </div>

      <div className="co-section-label">Zahlungsmethode</div>
      <div className="co-payment-options">
        {/*
        <button
          type="button"
          className={`co-pay-option ${paymentMethod === "card" ? "co-pay-option--active" : ""}`}
          onClick={() => onPaymentMethodChange("card")}
        >
          <CreditCard size={20} />
          <span>Karte (SumUp)</span>

        </button>
        */}
        <button
          type="button"
          className={`co-pay-option ${paymentMethod === "paypal" ? "co-pay-option--active" : ""}`}
          onClick={() => onPaymentMethodChange("paypal")}
        >
          <span className="co-paypal-icon">P</span>
          <span>PayPal</span>
        </button>
        <button
          type="button"
          className={`co-pay-option ${paymentMethod === "cash_on_delivery" ? "co-pay-option--active" : ""}`}
          onClick={() => onPaymentMethodChange("cash_on_delivery")}
        >
          <Banknote size={20} />
          <span>Bar bei Lieferung</span>
        </button>
      </div>

      {paymentMethod === "card" && (
        <button className="co-btn-primary co-btn-continue" onClick={onCardContinue}>
          Mit Karte zahlen →
        </button>
      )}

      {paymentMethod === "paypal" && (
        <div className="co-paypal-wrap">
          <PayPalCheckoutButton
            amount={totalPrice}
            disabled={submitting}
            onApprove={onPayPalApprove}
            onError={onPayPalError}
          />
        </div>
      )}

      {paymentMethod === "cash_on_delivery" && (
        <button className="co-btn-primary co-btn-continue" onClick={onCashContinue}>
          Weiter zur Übersicht →
        </button>
      )}
    </>
  );
}