// lib/shop/useShopStatus.ts
// Client-side hook — call this on your cart/checkout button.
// Fetches /api/shop-status and returns the result.
//
// Usage:
//   const { status, loading } = useShopStatus();
//   if (!status?.is_open) show <ShopClosedBanner reason={status.reason} opensAt={status.opens_at} />

import { useEffect, useState } from "react";

export type ShopStatusReason = "open" | "manual_stop" | "outside_hours" | "day_closed";

export type ShopStatus = {
  is_open: boolean;
  reason: ShopStatusReason;
  opens_at?: string;
  closes_at?: string;
};

export function useShopStatus() {
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  fetch("/api/shop-status")
    .then((r) => r.json().catch(() => null))
    .then((data) => {
      setStatus(data ?? { is_open: false, reason: "manual_stop" });
    })
    .catch(() => {
      setStatus({ is_open: false, reason: "manual_stop" });
    })
    .finally(() => setLoading(false));
}, []);

  return { status, loading };
}