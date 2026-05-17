// app/api/confirm-order/route.ts

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getShopStatus } from "@/lib/shop/getShopStatus";

const sql = neon(process.env.DATABASE_URL!);

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const ipMap = new Map<string, { count: number; resetAt: number }>();

// ✅ In-memory idempotency store (blocks duplicate requests within same server instance)
const processedKeys = new Set<string>();

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPayPalToken(): Promise<string | null> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("PayPal token error:", res.status, await res.text());
    return null;
  }
  const { access_token } = await res.json();
  return access_token;
}

async function verifySumUp(checkoutId: string): Promise<boolean> {
  const MAX_RETRIES = 5;
  const DELAY_MS = 1500;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
        headers: { Authorization: `Bearer ${process.env.SUMUP_API_SECRET}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`SumUp verify attempt ${attempt}: status=${data.status}`);
        if (data.status === "PAID") return true;
      } else {
        console.error(`SumUp verify attempt ${attempt}: HTTP ${res.status}`);
      }
    } catch (e) {
      console.error(`SumUp verify attempt ${attempt} threw:`, e);
    }
    if (attempt < MAX_RETRIES) await sleep(DELAY_MS);
  }
  return false;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  qty: number;
  selectedOptions?: {
    optionId: string;
    label: string;
    price_delta: number;
  }[];
}
interface CustomerData {
  name: string;
  email: string;
  phone: string;
  street: string;
  house_number: string;
  city: string;
  postal_code: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  // ── Shop status guard ──────────────────────────────────────────────────
  const shopStatus = await getShopStatus();
  if (!shopStatus.is_open) {
    return NextResponse.json(
      { error: "shop_closed", reason: shopStatus.reason, opens_at: shopStatus.opens_at ?? null },
      { status: 403 }
    );
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const { allowed, retryAfterSec } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte einige Minuten." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const {
      customer,
      items,
      total,
      payment_method,
      sumup_checkout_id,
      paypal_order_id,
      deliveryFee,
      idempotency_key,
    } = body as {
      customer: CustomerData;
      items: OrderItem[];
      total: number;
      payment_method: "card" | "paypal";
      sumup_checkout_id?: string;
      paypal_order_id?: string;
      deliveryFee: number;
      idempotency_key?: string;
    };

    // ✅ Layer 1: In-memory idempotency check (fast, same server instance)
    if (idempotency_key) {
      if (processedKeys.has(idempotency_key)) {
        console.warn("Duplicate order blocked by idempotency key:", idempotency_key);
        return NextResponse.json({ orderNumber: "already_saved" }, { status: 200 });
      }
      processedKeys.add(idempotency_key);
    }

    // ✅ Layer 2: DB-level duplicate check on sumup_checkout_id (survives reloads + server restarts)
    if (sumup_checkout_id) {
      const existing = await sql`
        SELECT order_number FROM orders WHERE sumup_checkout_id = ${sumup_checkout_id} LIMIT 1
      `;
      if (existing.length > 0) {
        console.warn("Duplicate SumUp checkout blocked:", sumup_checkout_id);
        return NextResponse.json({ orderNumber: existing[0].order_number }, { status: 200 });
      }
    }

    const resolvedFee =
      typeof deliveryFee === "number" && deliveryFee >= 0 ? deliveryFee : 0;

    if (!customer?.name || !customer?.email || !customer?.phone) {
      return NextResponse.json({ error: "Kundendaten unvollständig" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Warenkorb ist leer" }, { status: 400 });
    }
    if (total < 15) {
      return NextResponse.json(
        { error: "Mindestbestellwert von 15,00 € nicht erreicht" },
        { status: 400 }
      );
    }

    let paypalCaptureId: string | undefined;

    if (payment_method === "card") {
      if (!sumup_checkout_id) {
        return NextResponse.json({ error: "Checkout-ID fehlt" }, { status: 400 });
      }
      const paid = await verifySumUp(sumup_checkout_id);
      if (!paid) {
        return NextResponse.json(
          { error: "Kartenzahlung konnte nicht bestätigt werden. Bitte wende dich an den Support." },
          { status: 402 }
        );
      }
    } else if (payment_method === "paypal") {
      if (!paypal_order_id) {
        return NextResponse.json({ error: "PayPal-Order-ID fehlt" }, { status: 400 });
      }

      const token = await getPayPalToken();
      if (!token) {
        return NextResponse.json(
          { error: "PayPal-Authentifizierung fehlgeschlagen." },
          { status: 500 }
        );
      }

      const verifyRes = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${paypal_order_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: "PayPal-Bestellung konnte nicht überprüft werden." },
          { status: 502 }
        );
      }

      const paypalOrder = await verifyRes.json();

      if (paypalOrder.status !== "COMPLETED") {
        console.error("PayPal order not COMPLETED:", paypalOrder.status, paypal_order_id);
        return NextResponse.json(
          { error: "PayPal-Zahlung nicht abgeschlossen. Bitte versuche es erneut." },
          { status: 402 }
        );
      }

      paypalCaptureId = paypalOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id;

      if (!paypalCaptureId) {
        console.error("PayPal capture ID missing from completed order:", paypal_order_id);
        return NextResponse.json(
          { error: "PayPal-Capture-ID fehlt." },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json({ error: "Ungültige Zahlungsmethode" }, { status: 400 });
    }

    const [address] = await sql`
      INSERT INTO delivery_addresses (street, house_number, city, postal_code, country)
      VALUES (${customer.street}, ${customer.house_number}, ${customer.city}, ${customer.postal_code}, 'DE')
      RETURNING id
    `;

    const subtotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0);

    const [seq] = await sql`SELECT nextval('orders_order_number_seq') AS n`;
    const orderNumber = String(seq.n).padStart(4, "0");

    // ✅ sumup_checkout_id stored — UNIQUE constraint in DB prevents duplicates at DB level
    const [order] = await sql`
      INSERT INTO orders (
        order_number,
        status, order_type, customer_name, customer_email, customer_phone,
        customer_note, delivery_address_id, subtotal, delivery_fee, tax, total,
        payment_method, payment_status, paypal_order_id, sumup_checkout_id
      ) VALUES (
        ${orderNumber},
        'pending', 'delivery',
        ${customer.name}, ${customer.email}, ${customer.phone},
        ${customer.message ?? null}, ${address.id},
        ${subtotal}, ${resolvedFee}, 0, ${total},
        ${payment_method}, 'paid',
        ${paypalCaptureId ?? null},
        ${sumup_checkout_id ?? null}
      )
      RETURNING id, order_number
    `;

    for (const item of items) {
      const [insertedItem] = await sql`
        INSERT INTO order_items (
          order_id, product_id, product_name_snapshot,
          unit_price, unit_price_snapshot, quantity
        ) VALUES (
          ${order.id}, ${item.product_id}, ${item.product_name},
          ${item.unit_price}, ${item.unit_price}, ${item.qty}
        )
        RETURNING id
      `;

      if (item.selectedOptions && item.selectedOptions.length > 0) {
        for (const opt of item.selectedOptions) {
          await sql`
            INSERT INTO order_item_options (
              order_item_id,
              option_value_id,
              option_name_snapshot,
              value_label_snapshot,
              price_delta_snapshot
            ) VALUES (
              ${insertedItem.id},
              ${opt.optionId},
              ${opt.label},
              ${opt.label},
              ${opt.price_delta}
            )
          `;
        }
      }
    }

    return NextResponse.json({ orderId: order.id, orderNumber: order.order_number });
  } catch (err) {
    console.error("confirm-order error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// ── SumUp redirect handler ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkoutId = searchParams.get("checkout_id") ?? searchParams.get("id") ?? "";

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL}/menu?sumup_checkout_id=${checkoutId}`
  );
}