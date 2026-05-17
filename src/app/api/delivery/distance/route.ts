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

export async function POST(req: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: { address?: string; lat?: number; lng?: number; postal?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const hasAddress = typeof body.address === "string" && body.address.trim();
  const hasCoords = typeof body.lat === "number" && typeof body.lng === "number";

  if (!hasAddress && !hasCoords) {
    return err('Provide either { "address": "..." } or { "lat": ..., "lng": ... }');
  }

  // ── 2. Business origin from env (no geocoding needed) ─────────────────────
  let originCoords: LngLat;
  try {
    originCoords = getBusinessCoords();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[delivery/distance] Business coords error:", message);
    return err(message, 500);
  }

  // ── 3. Load delivery settings ──────────────────────────────────────────────
  let settings: { fee_per_km: number; max_distance_km: number; allowed_postals: string[] | null };
  try {
    const [row] = await sql`
      SELECT fee_per_km, max_distance_km, allowed_postals
      FROM delivery_settings
      WHERE id = 1
    `;
    if (!row) return err("Delivery settings not configured", 404);
    settings = row as typeof settings;
  } catch (e) {
    console.error("[delivery/distance] DB error loading settings:", e);
    return err("Failed to load delivery settings", 500);
  }

  // ── 4. Resolve customer coordinates via Nominatim ─────────────────────────
  let destCoords: LngLat;
  try {
    if (hasCoords) {
      destCoords = [body.lng as number, body.lat as number];
    } else {
      destCoords = await geocodeAddress(
  `${body.address}, Köln, Germany`
);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[delivery/distance] Geocode destination error:", message);
    return err(`Could not find address: ${message}`, 400);
  }

  // ── 5. Get driving distance via ORS ───────────────────────────────────────
  let distanceKm: number;
  let durationMin: number;
  try {
    ({ distanceKm, durationMin } = await getDrivingDistance(originCoords, destCoords));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
console.error("[delivery/distance] routing error:", message);
    return err(`Could not calculate route: ${message}`, 500);
  }

  // ── 6. Apply delivery rules ────────────────────────────────────────────────
  const withinRange = distanceKm <= settings.max_distance_km;
  const postalAllowed = isPostalAllowed(body.postal, settings.allowed_postals);
  const allowed = withinRange && postalAllowed;
  const deliveryFee = parseFloat((distanceKm * settings.fee_per_km).toFixed(2));

  if (!allowed) {
    return NextResponse.json(
      {
        distanceKm,
        durationMin,
        deliveryFee,
        withinRange,
        postalAllowed,
        allowed,
        reason: !withinRange
          ? `Distance ${distanceKm.toFixed(1)} km exceeds the maximum of ${settings.max_distance_km} km`
          : "Your postal code is not in the delivery zone",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ distanceKm, durationMin, deliveryFee, withinRange, postalAllowed, allowed });
}