// app/api/sumup-status/route.ts
// Lightweight poll endpoint — checks SumUp checkout status directly.
// Does NOT query the DB (no order exists yet during card payment).

import { NextRequest, NextResponse } from "next/server";

// ── In-memory rate limiter (poll-specific: higher limit, shorter window) ────
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;     // max 30 polls per minute per IP (every 2s = 30/min)
const ipMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}
// ────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const checkoutId = req.nextUrl.searchParams.get("checkoutId");
  if (!checkoutId) {
    return NextResponse.json({ error: "checkoutId fehlt" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
      headers: { Authorization: `Bearer ${process.env.SUMUP_API_SECRET}` },
    });
    if (!res.ok) {
      return NextResponse.json({ status: "PENDING" });
    }
    const data = await res.json();
    // Return only what the frontend needs
    return NextResponse.json({ status: data.status ?? "PENDING" });
  } catch (err) {
    console.error("sumup-status error:", err);
    return NextResponse.json({ status: "PENDING" });
  }
}