// lib/shop/getShopStatus.ts
// Single source of truth for whether the shop is accepting orders.
// Used by all 3 payment API routes + the /api/shop-status endpoint.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type ShopStatusReason = "open" | "manual_stop" | "outside_hours" | "day_closed";

export type ShopStatus = {
  is_open: boolean;
  reason: ShopStatusReason;
  opens_at?: string;  // e.g. "11:00" — set when reason is "outside_hours"
  closes_at?: string; // e.g. "22:00" — set when is_open is true
};

export async function getShopStatus(): Promise<ShopStatus> {
  // ── 1. Read delivery settings (single row) ───────────────────────────────
  const [settings] = await sql`
    SELECT is_accepting, order_time_rule
    FROM delivery_settings
    WHERE id = 1
  `;

  // Manual kill switch is off → closed immediately, skip hours check
  if (!settings?.is_accepting) {
    return { is_open: false, reason: "manual_stop" };
  }

  // Rule is "always" → open regardless of opening hours
  if (settings.order_time_rule === "always") {
    return { is_open: true, reason: "open" };
  }

  // ── 2. Get today's day index in Europe/Berlin time ───────────────────────
  const now = new Date();

  // formatToParts gives us "Sun" / "Mon" etc. reliably in Berlin timezone
  const berlinParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  }).formatToParts(now);

  const weekdayName = berlinParts.find((p) => p.type === "weekday")?.value ?? "";

  // 0 = Sunday … 6 = Saturday — matches your DB day_of_week column
 const dayMap: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};
  const todayIndex = dayMap[weekdayName] ?? 0;

  // ── 3. Fetch today's opening hours row ───────────────────────────────────
  const [hours] = await sql`
    SELECT open_time, close_time, is_closed
    FROM opening_hours
    WHERE day_of_week = ${todayIndex}
  `;

  // No row for today → treat as closed
  if (!hours) {
    return { is_open: false, reason: "day_closed" };
  }

  // Day explicitly marked closed
  if (hours.is_closed) {
    return { is_open: false, reason: "day_closed" };
  }

  // No times configured → treat as closed
  if (!hours.open_time || !hours.close_time) {
    return { is_open: false, reason: "day_closed" };
  }

  // ── 4. Compare current Berlin time against open/close window ────────────
  const currentMinutes = getCurrentMinutesBerlin(now);
  const openMinutes = timeToMinutes(hours.open_time);
  const closeMinutes = timeToMinutes(hours.close_time);

  if (currentMinutes < openMinutes || currentMinutes >= closeMinutes) {
    return {
      is_open: false,
      reason: "outside_hours",
      opens_at: formatTime(hours.open_time),
    };
  }

  return {
    is_open: true,
    reason: "open",
    closes_at: formatTime(hours.close_time),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMinutesBerlin(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

// Accepts "HH:MM:SS" or "HH:MM" (Postgres TIME format)
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Returns "HH:MM" display string
function formatTime(t: string): string {
  return t.slice(0, 5);
}