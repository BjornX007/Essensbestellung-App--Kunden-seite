// app/api/paypal/capture-order/route.ts
//
// Call this INSTEAD of actions.order.capture() on the client.
// It verifies the payment server-side with PayPal, then updates
// your DB order status to "paid" — no webhooks needed.

import { NextRequest, NextResponse } from "next/server";

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error("Missing PayPal credentials");
  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Failed to get PayPal access token");
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const { paypalOrderId } = await req.json();

    if (!paypalOrderId) {
      return NextResponse.json({ error: "Missing paypalOrderId" }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    // 1. Capture the payment server-side
    const captureRes = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const capture = await captureRes.json();

    if (!captureRes.ok) {
      throw new Error(capture.message ?? "PayPal capture failed");
    }

    // 2. Verify the capture status
    const captureStatus = capture.status; // "COMPLETED" = paid
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const captureAmount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;

    if (captureStatus !== "COMPLETED") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${captureStatus}` },
        { status: 402 }
      );
    }

    // 3. Return verified payment details to /api/checkout to save in DB
    return NextResponse.json({
      verified: true,
      paypalOrderId,
      captureId,        // PayPal transaction ID — store this in your DB
      amount: captureAmount,
      status: "paid",   // Use this to set payment_status in your orders table
    });

  } catch (err) {
    console.error("[PayPal] capture-order error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}