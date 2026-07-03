// app/api/delivery/tiers/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const tiers = await sql`
      SELECT id, max_distance_km, min_order_eur, delivery_fee_eur
      FROM delivery_tiers
      ORDER BY sort_order ASC, max_distance_km ASC
    `;

    if (!tiers.length) {
      return NextResponse.json(
        { error: "No delivery tiers configured" },
        { status: 404 }
      );
    }

    return NextResponse.json({ tiers });
  } catch (e) {
    console.error("[delivery/tiers] DB error:", e);
    return NextResponse.json(
      { error: "Failed to load delivery tiers" },
      { status: 500 }
    );
  }
}