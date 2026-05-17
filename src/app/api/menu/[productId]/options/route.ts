import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;

  /* 1. Find category for this product */
  const productRows = await sql`
    SELECT category_id
    FROM products
    WHERE id = ${productId}
    LIMIT 1
  `;

  if (productRows.length === 0) {
    return NextResponse.json({ error: "Product not found", productId }, { status: 404 });
  }

  const categoryId = productRows[0].category_id;

  /* 2. Fetch option groups + their options via the join table */
  const rows = await sql`
    SELECT
      cog.sort_order          AS join_sort_order,
      og.id                   AS group_id,
      og.name                 AS group_name,
      og.selection_type,
      og.is_required,
      og.sort_order           AS group_sort_order,
      ov.id                   AS option_id,
      ov.label,
      ov.price_delta,
      ov.is_default
    FROM category_option_groups cog
    JOIN option_groups og  ON og.id = cog.option_group_id
    LEFT JOIN option_values ov ON ov.option_group_id = og.id
    WHERE cog.category_id = ${categoryId}
    ORDER BY
      cog.sort_order ASC,
      og.sort_order  ASC,
      ov.label       ASC
  `;

  /* 3. Group flat rows into nested structure */
  const groupMap = new Map<string, {
    id: string;
    name: string;
    selection_type: string;
    is_required: boolean;
    options: { id: string; label: string; price_delta: number; is_default: boolean }[];
  }>();

  for (const row of rows) {
    if (!groupMap.has(row.group_id)) {
      groupMap.set(row.group_id, {
        id: row.group_id,
        name: row.group_name,
        selection_type: row.selection_type,
        is_required: row.is_required,
        options: [],
      });
    }

    if (row.option_id) {
      groupMap.get(row.group_id)!.options.push({
        id: row.option_id,
        label: row.label,
        price_delta: parseFloat(row.price_delta),
        is_default: row.is_default,
      });
    }
  }

  return NextResponse.json({ groups: Array.from(groupMap.values()) });
}