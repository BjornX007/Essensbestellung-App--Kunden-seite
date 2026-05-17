/**
 * components/checkout/DeliveryBadge.tsx
 *
 * Drop this right after the postal_code / city row in FormStep.
 * It shows:
 *   • a spinner while checking
 *   • a green confirmation + fee when in range
 *   • a red alert when outside range
 *   • nothing when the address is incomplete (idle)
 */

"use client";

import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { DeliveryStatus } from "@/hooks/useDeliveryCheck";

interface Props {
  status: DeliveryStatus;
}

export default function DeliveryBadge({ status }: Props) {
  if (status.state === "idle") return null;

  /* ── checking ─────────────────────────────────────────────────────────── */
  if (status.state === "checking") {
    return (
      <div className="dlv-badge dlv-badge--checking" role="status" aria-live="polite">
        <Loader2 size={15} className="dlv-spin" />
        <span>Lieferzone wird geprüft…</span>
      </div>
    );
  }

  /* ── error ───────────────────────────────────────────────────────────── */
  if (status.state === "error") {
    return (
      <div className="dlv-badge dlv-badge--warn" role="alert">
        <AlertTriangle size={15} />
        <span>{status.message}</span>
      </div>
    );
  }

  /* ── outside range ───────────────────────────────────────────────────── */
  if (status.state === "outside_range") {
    return (
      <div className="dlv-badge dlv-badge--error" role="alert">
        <XCircle size={15} />
        <div className="dlv-badge__body">
          <span className="dlv-badge__title">Keine Lieferung möglich</span>
          <span className="dlv-badge__sub">{status.reason}</span>
          <span className="dlv-badge__sub">
            Entfernung: {status.distanceKm.toFixed(1)} km
          </span>
        </div>
      </div>
    );
  }

  /* ── ok ──────────────────────────────────────────────────────────────── */
  return (
    <div className="dlv-badge dlv-badge--ok" role="status" aria-live="polite">
      <CheckCircle2 size={15} />
      <div className="dlv-badge__body">
        <span className="dlv-badge__title">
          Lieferung möglich &mdash;{" "}
          <strong>{status.distanceKm.toFixed(1)} km</strong> (~{Math.round(status.durationMin)} Min.)
        </span>
        <span className="dlv-badge__fee">
          Liefergebühr: <strong>{status.deliveryFee.toFixed(2)} €</strong>
        </span>
      </div>
    </div>
  );
}