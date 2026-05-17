// app/api/create-checkout/route.ts
// Creates a SumUp checkout session ONLY — nothing is written to the database.
// The order is saved later by /api/confirm-order once SumUp confirms payment.

import { NextRequest, NextResponse } from "next/server";
import { getShopStatus } from "@/lib/shop/getShopStatus";

// ── In-memory rate limiter ──────────────────────────────────────────────────
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 3;
const ipMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}
// ────────────────────────────────────────────────────────────────────────────

interface Item {
  product_name: string;
  unit_price: number;
  qty: number;
  selectedOptions?: {
    optionId: string;
    label: string;
    price_delta: number;
  }[];
}

export async function POST(req: NextRequest) {
  // ── Shop status guard ────────────────────────────────────────────────────
  const shopStatus = await getShopStatus();
  if (!shopStatus.is_open) {
    return NextResponse.json(
      { error: "shop_closed", reason: shopStatus.reason, opens_at: shopStatus.opens_at ?? null },
      { status: 403 }
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const { allowed, retryAfterSec } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte einige Minuten." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const { items, total } = (await req.json()) as { items: Item[]; total: number };

    if (!Array.isArray(items) || items.length === 0 || typeof total !== "number") {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    const tempRef = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const descriptionLines = items.map((item) => `${item.qty}x ${item.product_name}`);
    const description = `${descriptionLines.join(" | ")} – ${total.toFixed(2)} €`.slice(0, 255);

    const response = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUMUP_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: total,
        checkout_reference: tempRef,
        currency: "EUR",
        merchant_code: process.env.SUMUP_MERCHANT_CODE,
        pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
        description,
        redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/confirm-order`,
        line_items: items.map((item) => {
          const optionSuffix =
            item.selectedOptions && item.selectedOptions.length > 0
              ? ` (${item.selectedOptions.map((o) => o.label).join(", ")})`
              : "";
          return {
            name: `${item.product_name}${optionSuffix}`,
            unit_price: item.unit_price,
            quantity: item.qty,
            total_price: parseFloat((item.unit_price * item.qty).toFixed(2)),
          };
        }),
      }),
    });

    const checkout = await response.json();
    console.log("SumUp create-checkout response:", JSON.stringify(checkout, null, 2));

    if (!response.ok) {
      console.error("SumUp error:", checkout);
      return NextResponse.json(
        { error: "Zahlung konnte nicht gestartet werden" },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutId: checkout.id });
  } catch (err) {
    console.error("create-checkout error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}