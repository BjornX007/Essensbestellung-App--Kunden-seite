"use client";

import { AlertCircle } from "lucide-react";
import { PaymentMethod } from "../checkout.types";

interface ErrorStepProps {
  message: string;
  paymentMethod: PaymentMethod;
  onRetry: () => void;
  onClose: () => void;
}

export function ErrorStep({
  message,
  paymentMethod,
  onRetry,
  onClose,
}: ErrorStepProps) {
  return (
    <div className="co-state">
      <AlertCircle size={56} className="co-state-icon co-state-err" />
      <h2 className="co-title">Etwas ist schiefgelaufen</h2>
      <p className="co-subtitle">{message}</p>
      <div className="co-error-actions">
        <button className="co-btn-secondary" onClick={onRetry}>
          Erneut versuchen
        </button>
        <button className="co-btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}