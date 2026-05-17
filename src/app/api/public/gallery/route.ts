// app/api/public/gallery/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export const revalidate = 60;

export async function GET() {
  try {
    const profiles = await sql`
      SELECT id FROM business_profile
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (profiles.length === 0) return NextResponse.json([]);

    const rows = await sql`
      SELECT slot, image_url, caption
      FROM gallery_images
      WHERE business_profile_id = ${profiles[0].id}
      ORDER BY slot ASC
    `;

    return NextResponse.json(rows);
  } catch (e) {
    console.error("[public/gallery]", e);
    return NextResponse.json([]);
  }
}