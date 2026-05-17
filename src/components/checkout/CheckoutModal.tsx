"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useCart } from "@/app/context/CartContext";

import FormStep from "./steps/FormStep";
import SummaryStep from "./steps/SummaryStep";
import ReviewStep from "./steps/ReviewStep";
import PaymentStep from "./steps/PaymentStep";
import { SuccessStep } from "./steps/SuccessStep";
import { ErrorStep } from "./steps/ErrorStep";

import {
  Step,
  PaymentMethod,
  CustomerForm,
  EMPTY_FORM,
} from "./checkout.types";
import "./checkout.css";

let sumupScriptLoaded = false;
function ensureSumUpScript() {
  if (sumupScriptLoaded || document.querySelector('script[src*="sumup.com"]')) {
    sumupScriptLoaded = true;
    return;
  }
  const s = document.createElement("script");
  s.src = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
  s.async = true;
  document.body.appendChild(s);
  sumupScriptLoaded = true;
}

const mapLines = (lines: ReturnType<typeof useCart>["lines"]) =>
  lines.map((l) => ({
    product_id: l.product.id,
    product_name: l.product.name,
    unit_price: l.unitPrice,
    qty: l.qty,
    selectedOptions: l.selectedOptions.map((o) => ({
      optionId: o.optionId,
      label: o.label,
      price_delta: o.price_delta,
    })),
  }));

function validateForm(form: CustomerForm): Partial<CustomerForm> {
  const e: Partial<CustomerForm> = {};
  if (!form.name.trim() || form.name.trim().length < 2)
    e.name = "Name muss mindestens 2 Zeichen haben";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
    e.email = "Ungültige E-Mail-Adresse";
  if (!form.phone.trim() || form.phone.trim().length < 5)
    e.phone = "Ungültige Telefonnummer";
  if (!form.street.trim()) e.street = "Straße erforderlich";
  if (!form.house_number.trim()) e.house_number = "Hausnummer erforderlich";
  if (!form.city.trim()) e.city = "Stadt erforderlich";
  if (!form.postal_code.trim()) e.postal_code = "PLZ erforderlich";
  return e;
}

export default function CheckoutModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { lines, totalPrice, clear } = useCart();

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<CustomerForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [orderNumber, setOrderNumber] = useState("");

  const orderSaved = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { ensureSumUpScript(); }, []);
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const returnedCheckoutId = params.get("sumup_checkout_id");
  if (!returnedCheckoutId) return;

  // Clean URL immediately
  window.history.replaceState({}, "", window.location.pathname);

  const raw = sessionStorage.getItem("sumup_pending");
  if (!raw) return;
  sessionStorage.removeItem("sumup_pending");

  const pending = JSON.parse(raw);
  if (pending.checkoutId !== returnedCheckoutId) return;

  // Restore state and save order
  setForm(pending.form);
  setDeliveryFee(pending.deliveryFee);
  setCheckoutId(pending.checkoutId);
  setSubmitting(true);

  fetch("/api/confirm-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: pending.form,
      items: pending.lines,
      total: pending.totalPrice + pending.deliveryFee,
      deliveryFee: pending.deliveryFee,
      payment_method: "card",
      sumup_checkout_id: pending.checkoutId,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.orderNumber) {
        setOrderNumber(data.orderNumber);
        setStep("success");
      } else {
        setErrorMsg(data.error ?? "Bestellung konnte nicht gespeichert werden");
        setStep("error");
      }
    })
    .catch(() => {
      setErrorMsg("Bestellung konnte nicht gespeichert werden");
      setStep("error");
    })
    .finally(() => setSubmitting(false));
}, []);
  // ── Poll SumUp for 3DS ───────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "payment" || !checkoutId) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 150;

   pollRef.current = setInterval(async () => {
  // ✅ Add this line at the very top
  if (sessionStorage.getItem("sumup_pending")) return;

  attempts++;

      if (attempts > MAX_ATTEMPTS) {
        clearInterval(pollRef.current!);
        setErrorMsg("Zeitüberschreitung. Bitte versuche es erneut.");
        setStep("error");
        return;
      }
      try {
        const res = await fetch(`/api/sumup-status?checkoutId=${checkoutId}`);
        if (res.status === 429 || !res.ok) return;
        const data = await res.json();
        if (data.status === "PAID") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          await saveOrder("card");
        }
      } catch (e) {
        console.error("Poll error:", e);
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, checkoutId]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const scrollToFirstError = (errs: Partial<CustomerForm>) => {
    const first = Object.keys(errs)[0];
    if (first) document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleFormChange = (key: keyof CustomerForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // ── Step 1 continue: validate + delivery check → summary ─────────────────
  const handleContinue = async () => {
    const e = validateForm(form);
    setErrors(e);
    if (Object.keys(e).length) { scrollToFirstError(e); return; }

    setSubmitting(true);
    setDeliveryError(null);

    try {
      const res = await fetch("/api/delivery/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: `${form.street} ${form.house_number}, ${form.postal_code} ${form.city}`,
          postal: form.postal_code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDeliveryError(data.reason ?? data.error ?? "Lieferung an diese Adresse nicht möglich.");
        return;
      }

      setDeliveryFee(data.deliveryFee ?? 0);
      setStep("summary");
    } catch {
      setDeliveryError("Adresse konnte nicht geprüft werden. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 2a: card selected → create SumUp checkout → payment step ────────
 const handleSummaryCard = async () => {
  setSubmitting(true);
  orderSaved.current = false;
  try {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: mapLines(lines),
        total: totalPrice + deliveryFee,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Zahlung konnte nicht gestartet werden");
    }
    const data = await res.json();

    // ✅ Save everything to sessionStorage before SumUp redirects
    sessionStorage.setItem("sumup_pending", JSON.stringify({
      checkoutId: data.checkoutId,
      form,
      lines: mapLines(lines),
      totalPrice,
      deliveryFee,
    }));

    setCheckoutId(data.checkoutId);
    setStep("payment");
  } catch (err) {
    setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
    setStep("error");
  } finally {
    setSubmitting(false);
  }
};

  // ── Step 2b: cash selected → review step ────────────────────────────────
  const handleSummaryCash = () => setStep("review");

  // ── Step 2c: PayPal approved → save order ───────────────────────────────
  const handlePayPalApprove = async (paypalOrderId: string) => {
    setSubmitting(true);
    try {
      await saveOrder("paypal", paypalOrderId);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 3 (cash): confirmed → save ──────────────────────────────────────
  const handleConfirmCash = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: mapLines(lines),
          total: totalPrice + deliveryFee,
          deliveryFee,
          payment_method: "cash_on_delivery",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Bestellung konnte nicht erstellt werden");
      }
      const data = await res.json();
      setOrderNumber(data.orderNumber ?? "");
      clear();
      setStep("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Save order (card / paypal) ───────────────────────────────────────────
  const saveOrder = async (method: PaymentMethod, paypalOrderId?: string) => {
    if (orderSaved.current) return;
    orderSaved.current = true;
    try {
      const res = await fetch("/api/confirm-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: mapLines(lines),
          total: totalPrice + deliveryFee,
          deliveryFee,
          payment_method: method,
          sumup_checkout_id: method === "card" ? checkoutId : undefined,
          paypal_order_id: paypalOrderId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Bestellung konnte nicht gespeichert werden");
      }
      const data = await res.json();
      setOrderNumber(data.orderNumber ?? "");
      clear();
      setStep("success");
    } catch (err) {
      orderSaved.current = false;
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStep("error");
    }
  };

  // ── SumUp widget callbacks ───────────────────────────────────────────────
  const handleSumUpPaid = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    await saveOrder("card");
  };

  const handleSumUpError = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setErrorMsg("Zahlung fehlgeschlagen. Bitte versuche es erneut.");
    setStep("error");
  };

  const handleRetry = () => {
    orderSaved.current = false;
    setStep(paymentMethod === "card" ? "payment" : "form");
  };

  const handleBackFromPayment = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    orderSaved.current = false;
    setCheckoutId(null);
    setStep("summary");
  };

  const handleDone = () => { onSuccess(); onClose(); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="co-overlay" role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="co-modal">
        <button className="co-x" onClick={onClose} aria-label="Schließen">
          <X size={20} />
        </button>

        {step === "form" && (
          <FormStep
            form={form}
            errors={errors}
            submitting={submitting}
            deliveryError={deliveryError}
            onFormChange={handleFormChange}
            onContinue={handleContinue}
          />
        )}

        {step === "summary" && (
          <SummaryStep
            lines={lines}
            subtotalPrice={totalPrice}
            deliveryFee={deliveryFee}
            totalPrice={totalPrice + deliveryFee}
            paymentMethod={paymentMethod}
            submitting={submitting}
            onBack={() => setStep("form")}
            onPaymentMethodChange={setPaymentMethod}
            onCardContinue={handleSummaryCard}
            onCashContinue={handleSummaryCash}
            onPayPalApprove={handlePayPalApprove}
            onPayPalError={() => {
              setErrorMsg("PayPal-Zahlung fehlgeschlagen. Bitte versuche es erneut.");
              setStep("error");
            }}
          />
        )}

        {step === "review" && (
          <ReviewStep
            lines={lines}
            totalPrice={totalPrice}
            deliveryFee={deliveryFee}
            submitting={submitting}
            onBack={() => setStep("summary")}
            onConfirm={handleConfirmCash}
          />
        )}

        {step === "payment" && checkoutId && (
          <PaymentStep
            checkoutId={checkoutId}
            lines={lines}
            totalPrice={totalPrice}
            deliveryFee={deliveryFee}
            onBack={handleBackFromPayment}
            onPaid={handleSumUpPaid}
            onError={handleSumUpError}
          />
        )}

        {step === "success" && (
          <SuccessStep
            email={form.email}
            orderNumber={orderNumber}
            paymentMethod={paymentMethod}
            totalPrice={totalPrice + deliveryFee}
            onDone={handleDone}
          />
        )}

        {step === "error" && (
          <ErrorStep
            message={errorMsg}
            paymentMethod={paymentMethod}
            onRetry={handleRetry}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}