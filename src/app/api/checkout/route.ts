// app/api/checkout/route.ts
// Handles ONLY cash-on-delivery orders.
// Card → /api/create-checkout then /api/confirm-order
// PayPal → /api/confirm-order

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getShopStatus } from "@/lib/shop/getShopStatus";

const sql = neon(process.env.DATABASE_URL!);

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
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
      { error: "Zu viele Bestellungen. Bitte warte einige Minuten." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const { customer, items, total, payment_method, deliveryFee } = body as {
      customer: CustomerData;
      items: OrderItem[];
      total: number;
      payment_method: string;
      deliveryFee: number;
    };

    const resolvedFee =
      typeof deliveryFee === "number" && deliveryFee >= 0 ? deliveryFee : 0;

    if (payment_method !== "cash_on_delivery") {
      return NextResponse.json(
        { error: "Ungültige Zahlungsmethode für diesen Endpunkt" },
        { status: 400 }
      );
    }

    if (!customer?.name || !customer?.email || !customer?.phone) {
      return NextResponse.json(
        { error: "Kundendaten unvollständig" },
        { status: 400 }
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Warenkorb ist leer" }, { status: 400 });
    }

    const subtotalRaw = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const computedTotal = parseFloat((subtotalRaw + resolvedFee).toFixed(2));

    if (computedTotal < 15) {
      return NextResponse.json(
        { error: "Mindestbestellwert von 15,00 € nicht erreicht" },
        { status: 400 }
      );
    }

    // ── Address ──
    const [address] = await sql`
      INSERT INTO delivery_addresses (street, house_number, city, postal_code, country)
      VALUES (${customer.street}, ${customer.house_number}, ${customer.city}, ${customer.postal_code}, 'DE')
      RETURNING id
    `;

    const subtotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0);

    // ── Generate 4-digit order number from sequence ──
    const [seq] = await sql`SELECT nextval('orders_order_number_seq') AS n`;
    const orderNumber = String(seq.n).padStart(4, "0");

    // ── Order ──
    const [order] = await sql`
      INSERT INTO orders (
        order_number,
        status, order_type, customer_name, customer_email, customer_phone,
        customer_note, delivery_address_id, subtotal, delivery_fee, tax, total,
        payment_method, payment_status, paypal_order_id
      ) VALUES (
        ${orderNumber},
        'pending', 'delivery',
        ${customer.name}, ${customer.email}, ${customer.phone},
        ${customer.message ?? null}, ${address.id},
        ${subtotal}, ${resolvedFee}, 0, ${total},
        'cash_on_delivery', 'pending', null
      )
      RETURNING id, order_number
    `;

    // ── Order items + selected options ──
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
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}