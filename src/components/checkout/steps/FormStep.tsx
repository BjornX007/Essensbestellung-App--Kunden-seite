"use client";

import { Loader2 } from "lucide-react";
import { CustomerForm } from "../checkout.types";

interface FormStepProps {
  form: CustomerForm;
  errors: Partial<CustomerForm>;
  submitting: boolean;
  onFormChange: (key: keyof CustomerForm, value: string) => void;
  onContinue: () => void;
  deliveryError?: string | null;
}

export default function FormStep({
  form,
  errors,
  submitting,
  onFormChange,
  onContinue,
  deliveryError,
}: FormStepProps) {
  const field = (
    key: keyof CustomerForm,
    label: string,
    opts?: { type?: string; placeholder?: string }
  ) => (
    <div className="co-field">
      <label className="co-label" htmlFor={key}>
        {label}
        <span className="co-req">*</span>
      </label>
      <input
        id={key}
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder ?? ""}
        value={form[key]}
        onChange={(e) => onFormChange(key, e.target.value)}
        className={`co-input ${errors[key] ? "co-input-err" : ""}`}
        aria-describedby={errors[key] ? `${key}-err` : undefined}
      />
      {errors[key] && (
        <span id={`${key}-err`} className="co-err-msg" role="alert">
          {errors[key]}
        </span>
      )}
    </div>
  );

  return (
    <>
      <h2 className="co-title">Bestellung aufgeben</h2>

      <div className="co-section-label">Kontaktdaten</div>
      <div className="co-grid-2">
        {field("name", "Name")}
        {field("phone", "Telefon", { type: "tel", placeholder: "+49 …" })}
      </div>
      {field("email", "E-Mail", { type: "email", placeholder: "du@example.com" })}

      <div className="co-section-label">Lieferadresse</div>
      <div className="co-grid-2">
        {field("street", "Straße")}
        {field("house_number", "Hausnr.")}
      </div>
      <div className="co-grid-2">
        {field("postal_code", "PLZ")}
        {field("city", "Stadt")}
      </div>

      <div className="co-field">
        <label className="co-label" htmlFor="message">
          Anmerkung <span className="co-optional">(optional)</span>
        </label>
        <textarea
          id="message"
          rows={2}
          placeholder="z. B. Etage, Klingelschild Name…"
          value={form.message}
          onChange={(e) => onFormChange("message", e.target.value)}
          className="co-input co-textarea"
          maxLength={500}
        />
      </div>

      {deliveryError && (
        <p className="co-err-msg" role="alert">
          ⚠️ {deliveryError}
        </p>
      )}

      <button
        className="co-btn-primary co-btn-continue"
        onClick={onContinue}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="co-spin" /> Adresse wird geprüft…
          </>
        ) : (
          "Weiter →"
        )}
      </button>
    </>
  );
}