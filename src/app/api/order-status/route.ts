import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Simple in-memory rate limiter (per IP, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;        // max requests
const RATE_WINDOW = 60_000;   // per 60 seconds

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// UUID v4 format validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  // ── Input validation ───────────────────────────────────────────────────────
  const orderId = req.nextUrl.searchParams.get("orderId");

  if (!orderId || !UUID_REGEX.test(orderId)) {
    return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
  }

  try {
    // ── Fetch order ───────────────────────────────────────────────────────────
    const [order] = await sql`
      SELECT payment_status FROM orders WHERE id = ${orderId} LIMIT 1
    `;

    if (!order) {
      // Return 404 without revealing whether the order exists or not
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Already resolved — return immediately ─────────────────────────────────
    if (order.payment_status !== "awaiting") {
      return NextResponse.json({ payment_status: order.payment_status });
    }

    // ── Still awaiting — check SumUp ──────────────────────────────────────────
    const sumupRes = await fetch(
      `https://api.sumup.com/v0.1/checkouts?checkout_reference=${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SUMUP_API_SECRET}`,
        },
      }
    );

    if (!sumupRes.ok) {
      // SumUp unreachable — return current DB status, don't error out
      return NextResponse.json({ payment_status: order.payment_status });
    }

    const checkouts = await sumupRes.json();
    const checkout = Array.isArray(checkouts) ? checkouts[0] : checkouts;
    const status = checkout?.status?.toUpperCase();

    if (status === "PAID" || status === "SUCCESSFUL") {
      await sql`
        UPDATE orders
        SET payment_status = 'paid', status = 'confirmed'
        WHERE id = ${orderId}
          AND payment_status = 'awaiting'
      `;
      return NextResponse.json({ payment_status: "paid" });
    }

    if (status === "FAILED") {
      await sql`
        UPDATE orders
        SET payment_status = 'failed'
        WHERE id = ${orderId}
          AND payment_status = 'awaiting'
      `;
      return NextResponse.json({ payment_status: "failed" });
    }

    // SumUp still pending
    return NextResponse.json({ payment_status: order.payment_status });

  } catch (err) {
    // Don't leak internal error details to client
    console.error("Order status error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}