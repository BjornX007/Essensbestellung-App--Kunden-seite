import { NextResponse } from "next/server";
import { Pool } from "pg";
export const revalidate = 300; // cache for 5 minutes


console.log("API HIT"); // 👈 add this
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET() {
  const client = await pool.connect();

  try {
    const categoriesResult = await client.query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      image_url: string | null;
      sort_order: number;
    }>(`
      SELECT id, name, slug, description, image_url, sort_order
      FROM categories
      WHERE is_visible = true
      ORDER BY sort_order ASC, name ASC
    `);

    const productsResult = await client.query<{
      id: string;
      category_id: string;
      name: string;
      slug: string;
      description: string | null;
      price: string;
      image_url: string | null;
      is_available: boolean;
      is_featured: boolean;
      sort_order: number;
    }>(`
      SELECT
        p.id,
        p.category_id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.image_url,
        p.is_available,
        p.is_featured,
        p.sort_order
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      WHERE c.is_visible = true
      ORDER BY p.sort_order ASC, p.name ASC
    `);

    const categories = categoriesResult.rows.map((cat) => ({
      ...cat,
      products: productsResult.rows
        .filter((p) => p.category_id === cat.id)
        .map((p) => ({
          ...p,
          price: parseFloat(p.price),
        })),
    }));

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("[menu/route] DB error:", err);
    return NextResponse.json(
      { error: "Failed to load menu" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}