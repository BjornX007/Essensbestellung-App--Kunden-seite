/**
 * hooks/useDeliveryCheck.ts
 *
 * Fires a POST to /api/delivery/distance whenever the customer has filled
 * in both `street` + `house_number` + `postal_code` + `city`.
 * Debounced by 600 ms so we don't hammer the API on every keystroke.
 */

import { useEffect, useRef, useState } from "react";

export type DeliveryStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; distanceKm: number; durationMin: number; deliveryFee: number }
  | { state: "outside_range"; distanceKm: number; reason: string }
  | { state: "error"; message: string };

interface AddressFields {
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
}

const DEBOUNCE_MS = 600;

function isComplete(f: AddressFields): boolean {
  return (
    f.street.trim().length > 0 &&
    f.house_number.trim().length > 0 &&
    f.postal_code.trim().length >= 4 &&
    f.city.trim().length > 0
  );
}

export function useDeliveryCheck(fields: AddressFields): DeliveryStatus {
  const [status, setStatus] = useState<DeliveryStatus>({ state: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear any pending debounce
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!isComplete(fields)) {
      setStatus({ state: "idle" });
      return;
    }

    setStatus({ state: "checking" });

    timerRef.current = setTimeout(async () => {
      // Cancel previous in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const address = `${fields.street} ${fields.house_number}, ${fields.postal_code} ${fields.city}`;

      try {
        const res = await fetch("/api/delivery/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, postal: fields.postal_code }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();

        if (res.ok) {
          setStatus({
            state: "ok",
            distanceKm: data.distanceKm,
            durationMin: data.durationMin,
            deliveryFee: data.deliveryFee,
          });
        } else if (res.status === 422) {
          setStatus({
            state: "outside_range",
            distanceKm: data.distanceKm,
            reason: data.reason ?? "Adresse liegt außerhalb der Lieferzone.",
          });
        } else {
          setStatus({
            state: "error",
            message: data.error ?? "Lieferprüfung fehlgeschlagen.",
          });
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // stale request, ignore
        setStatus({ state: "error", message: "Netzwerkfehler. Bitte erneut versuchen." });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.street, fields.house_number, fields.postal_code, fields.city]);

  return status;
}