// app/api/delivery/distance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import {
  getBusinessCoords,
  geocodeAddress,
  getDrivingDistance,
  type LngLat,
} from "@/lib/openrouteservice";

const sql = neon(process.env.DATABASE_URL!);

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isPostalAllowed(
  customerPostal: string | undefined,
  allowedPostals: string[] | null
): boolean {
  if (!allowedPostals || allowedPostals.length === 0) return true;
  if (!customerPostal) return false;
  return allowedPostals.map((p) => p.trim()).includes(customerPostal.trim());
}

type DeliveryTier = {
  id: number;
  max_distance_km: number;
  min_order_eur: number;
  delivery_fee_eur: number;
};

export async function POST(req: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: { address?: string; lat?: number; lng?: number; postal?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const hasAddress = typeof body.address === "string" && body.address.trim();
  const hasCoords =
    typeof body.lat === "number" &&
    typeof body.lng === "number" &&
    Number.isFinite(body.lat) &&
    Number.isFinite(body.lng);

  if (!hasAddress && !hasCoords) {
    return err(
      'Provide either { "address": "..." } or { "lat": ..., "lng": ... }'
    );
  }

  // Basic sanity bounds if raw coords were supplied directly (skip geocoding)
  if (hasCoords) {
    const lat = body.lat as number;
    const lng = body.lng as number;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return err("lat/lng out of range");
    }
  }

  // ── 2. Business origin ─────────────────────────────────────────────────────
  let originCoords: LngLat;
  try {
    originCoords = getBusinessCoords();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[delivery/distance] Business coords error:", message);
    return err(message, 500);
  }

  // ── 3. Load delivery settings + tiers in parallel ──────────────────────────
  let allowedPostals: string[] | null;
  let tiers: DeliveryTier[];

  try {
    const [settingsRows, tierRows] = await Promise.all([
      sql`SELECT allowed_postals FROM delivery_settings WHERE id = 1`,
      sql`
        SELECT id, max_distance_km, min_order_eur, delivery_fee_eur
        FROM delivery_tiers
        ORDER BY sort_order ASC, max_distance_km ASC
      `,
    ]);

    if (!settingsRows[0]) return err("Delivery settings not configured", 404);
    if (!tierRows.length) return err("No delivery tiers configured", 404);

    allowedPostals = settingsRows[0].allowed_postals as string[] | null;

    // NUMERIC columns come back as strings from the driver — cast once, here,
    // so every downstream comparison and every value in the response is a
    // real number rather than something that silently misbehaves in
    // toLocaleString() or JSON consumers on the frontend.
    tiers = (tierRows as any[]).map((t) => ({
      id: Number(t.id),
      max_distance_km: Number(t.max_distance_km),
      min_order_eur: Number(t.min_order_eur),
      delivery_fee_eur: Number(t.delivery_fee_eur),
    }));

    if (tiers.some((t) => Number.isNaN(t.max_distance_km) || Number.isNaN(t.min_order_eur) || Number.isNaN(t.delivery_fee_eur))) {
      console.error("[delivery/distance] Malformed tier data:", tierRows);
      return err("Delivery configuration is invalid", 500);
    }
  } catch (e) {
    console.error("[delivery/distance] DB error loading config:", e);
    return err("Failed to load delivery configuration", 500);
  }

  // ── 4. Resolve customer coordinates ───────────────────────────────────────
  let destCoords: LngLat;
  try {
    if (hasCoords) {
      destCoords = [body.lng as number, body.lat as number];
    } else {
      destCoords = await geocodeAddress(`${body.address}, Köln, Germany`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[delivery/distance] Geocode error:", message);
    return err(`Could not find address: ${message}`, 400);
  }

  // ── 5. Get driving distance via ORS ───────────────────────────────────────
  let distanceKm: number;
  let durationMin: number;
  try {
    ({ distanceKm, durationMin } = await getDrivingDistance(
      originCoords,
      destCoords
    ));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[delivery/distance] Routing error:", message);
    return err(`Could not calculate route: ${message}`, 500);
  }

  // ── 6. Match tier ──────────────────────────────────────────────────────────
  // Pick the tier with the SMALLEST max_distance_km that still covers the
  // distance. This is deliberately independent of sort_order — sort_order
  // is admin-editable display ordering, not a guarantee that it's aligned
  // with ascending distance, so relying on "first match wins" would pick
  // the wrong tier if an admin ever reorders rows without noticing.
  const eligibleTiers = tiers.filter((t) => distanceKm <= t.max_distance_km);
  const matchedTier =
    eligibleTiers.length > 0
      ? eligibleTiers.reduce((closest, t) =>
          t.max_distance_km < closest.max_distance_km ? t : closest
        )
      : null;

  const postalAllowed = isPostalAllowed(body.postal, allowedPostals);
  const withinRange = matchedTier !== null;
  const allowed = withinRange && postalAllowed;

  if (!allowed) {
    const maxRange = tiers.reduce(
      (max, t) => (t.max_distance_km > max ? t.max_distance_km : max),
      0
    );
    return NextResponse.json(
      {
        distanceKm,
        durationMin,
        withinRange,
        postalAllowed,
        allowed,
        reason: !withinRange
          ? `Distance ${distanceKm.toFixed(1)} km exceeds the maximum delivery range of ${maxRange} km`
          : "Your postal code is not in the delivery zone",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    distanceKm,
    durationMin,
    withinRange,
    postalAllowed,
    allowed,
    tier: {
      id: matchedTier!.id,
      deliveryFee: matchedTier!.delivery_fee_eur,
      minOrder: matchedTier!.min_order_eur,
      maxDistanceKm: matchedTier!.max_distance_km,
    },
  });
}