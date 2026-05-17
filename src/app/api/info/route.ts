// app/api/info/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const [business] = await sql`
      SELECT
        id, name, tagline, description,
        address, city, postal_code,
        phone, email,
        logo_url, hero_image_url,
        social_links, updated_at
      FROM business_profile
      LIMIT 1
    `;

    if (!business) {
      return NextResponse.json({ error: "No business found" }, { status: 404 });
    }

    const hours = await sql`
      SELECT
        day_of_week, open_time, close_time,
        is_closed, special_note
      FROM opening_hours
      WHERE business_id = ${business.id}
      ORDER BY day_of_week ASC
    `;

    return NextResponse.json({ ...business, opening_hours: hours });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load info" }, { status: 500 });
  }
}