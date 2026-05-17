/**
 * lib/openrouteservice.ts
 *
 * Geocoding  → Nominatim (OpenStreetMap, free, no key)
 * Routing    → Graphhopper (free tier, fastest car route)
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const GRAPHHOPPER_BASE = "https://graphhopper.com/api/1";

export type LngLat = [number, number]; // [lng, lat]

export interface DistanceResult {
  distanceKm: number;
  durationMin: number;
}

// ---------------------------------------------------------------------------
// Business origin — from env vars
// ---------------------------------------------------------------------------
export function getBusinessCoords(): LngLat {
  const lat = parseFloat(process.env.BUSINESS_LAT ?? "");
  const lng = parseFloat(process.env.BUSINESS_LNG ?? "");
  if (isNaN(lat) || isNaN(lng)) {
    throw new Error("BUSINESS_LAT / BUSINESS_LNG are not set in environment variables.");
  }
  return [lng, lat];
}

// ---------------------------------------------------------------------------
// Geocoding via Nominatim (OSM) — free, no key
// ---------------------------------------------------------------------------
export async function geocodeAddress(address: string): Promise<LngLat> {
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "DeliveryApp/1.0" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);

  const json = await res.json();
  if (!json.length) throw new Error(`No result found for: "${address}"`);

  console.log("[routing] geocoded:", address, "→", json[0].lon, json[0].lat, `(${json[0].display_name})`);

  return [parseFloat(json[0].lon), parseFloat(json[0].lat)];
}

// ---------------------------------------------------------------------------
// Routing via Graphhopper — fastest car route
// ---------------------------------------------------------------------------
export async function getDrivingDistance(
  origin: LngLat,
  destination: LngLat
): Promise<DistanceResult> {
  const apiKey = process.env.GRAPHHOPPER_API_KEY;
  if (!apiKey) throw new Error("GRAPHHOPPER_API_KEY is not set");

  // key must be a query param, body carries the route config
  const url = `${GRAPHHOPPER_BASE}/route?key=${apiKey}`;

  const payload = {
    points: [
      [origin[0], origin[1]],           // [lng, lat]
      [destination[0], destination[1]], // [lng, lat]
    ],
    profile: "car",
    weighting: "fastest",
    calc_points: false,
    locale: "de",
  };

  console.log("[routing] origin:", origin, "dest:", destination);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graphhopper error ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (!json.paths?.length) {
    throw new Error(`Graphhopper returned no route: ${JSON.stringify(json)}`);
  }

  const path = json.paths[0];
  console.log("[routing] raw distance metres:", path.distance, "raw time ms:", path.time);

  return {
    distanceKm: path.distance / 1000,  // metres → km
    durationMin: path.time / 60000,     // ms → minutes
  };
}