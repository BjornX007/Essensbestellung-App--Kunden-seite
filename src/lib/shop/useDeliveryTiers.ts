// lib/shop/useDeliveryTiers.ts
"use client";

import { useEffect, useState } from "react";
import { saveToStorage, loadFromStorage } from "@/lib/storage/localCache";

export type DeliveryTier = {
  id: number;
  max_distance_km: number;
  min_order_eur: number;
  delivery_fee_eur: number;
};

type TiersState = {
  tiers: DeliveryTier[];
  minOrderEur: number | null;
  feeMinEur: number | null;
  feeMaxEur: number | null;
  loading: boolean;
  error: string | null;
};

const TIERS_KEY = "delivery:tiers";
const TIERS_TTL_MS = 1000 * 60 * 30; // 30min — tiers rarely change but shouldn't go stale forever

function deriveFromTiers(tiers: DeliveryTier[]) {
  const minOrders = tiers.map((t) => Number(t.min_order_eur));
  const fees = tiers.map((t) => Number(t.delivery_fee_eur));
  return {
    minOrderEur: Math.min(...minOrders),
    feeMinEur: Math.min(...fees),
    feeMaxEur: Math.max(...fees),
  };
}

export function useDeliveryTiers(): TiersState {
  const [state, setState] = useState<TiersState>(() => {
    const cached = loadFromStorage<DeliveryTier[]>(TIERS_KEY);
    if (cached && cached.length) {
      return { tiers: cached, ...deriveFromTiers(cached), loading: false, error: null };
    }
    return { tiers: [], minOrderEur: null, feeMinEur: null, feeMaxEur: null, loading: true, error: null };
  });

  useEffect(() => {
    // Already have cached tiers — skip refetch, but refresh silently in background
    const hadCache = state.tiers.length > 0;

    fetch("/api/delivery/tiers")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load tiers");
        return data.tiers as DeliveryTier[];
      })
      .then((tiers) => {
        if (!tiers.length) {
          if (!hadCache) setState((s) => ({ ...s, loading: false, error: "No tiers configured" }));
          return;
        }
        saveToStorage(TIERS_KEY, tiers, TIERS_TTL_MS);
        setState({ tiers, ...deriveFromTiers(tiers), loading: false, error: null });
      })
      .catch((e) => {
        if (!hadCache) setState((s) => ({ ...s, loading: false, error: String(e.message ?? e) }));
        // if we had cache, silently keep showing cached values on network failure
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}