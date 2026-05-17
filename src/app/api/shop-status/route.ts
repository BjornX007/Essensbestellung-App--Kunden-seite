// app/api/shop-status/route.ts
import { NextResponse } from "next/server";
import { getShopStatus } from "@/lib/shop/getShopStatus";

export const dynamic = "force-dynamic"; // ← add this

export async function GET() {
  try {
    const status = await getShopStatus();
    return NextResponse.json(status);
  } catch (err) {
    console.error("[shop-status] error:", err);
    return NextResponse.json(
      { is_open: false, reason: "manual_stop" },
      { status: 500 }
    );
  }
}