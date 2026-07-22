import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

interface OptionRow {
  id: string;
  label: string;
  price_delta: number;
  is_default: boolean;
}

interface GroupNode {
  id: string;
  name: string;
  selection_type: string;
  is_required: boolean;
  options: (OptionRow & { subgroups?: GroupNode[] })[];
}

const MAX_DEPTH = 5; // safety cap against accidental cyclic links

// For a batch of option value IDs, find any linked sub-groups (recursively),
// already filtered to exclude values the admin has hidden for that link.
async function fetchSubgroupsForValues(
  valueIds: string[],
  depth: number
): Promise<Map<string, GroupNode[]>> {
  const result = new Map<string, GroupNode[]>();
  if (valueIds.length === 0 || depth > MAX_DEPTH) return result;

  const rows = await sql`
    SELECT
      gl.id                AS link_id,
      gl.parent_value_id,
      gl.sort_order,
      sg.id                AS source_group_id,
      sg.name              AS source_group_name,
      sg.selection_type,
      sg.is_required,
      ov.id                AS option_id,
      ov.label,
      ov.price_delta,
      ov.is_default
    FROM group_links gl
    JOIN option_groups sg ON sg.id = gl.source_group_id
    LEFT JOIN option_values ov ON ov.option_group_id = sg.id
    LEFT JOIN group_link_disabled_values gldv
      ON gldv.group_link_id = gl.id AND gldv.option_value_id = ov.id
    WHERE gl.parent_value_id = ANY(${valueIds}::uuid[])
      AND gldv.option_value_id IS NULL
    ORDER BY gl.sort_order ASC, ov.is_default DESC, ov.label ASC
  `;

  // One GroupNode per link (keyed by link_id, not source_group_id — so the
  // same global group linked under two different parents stays independent)
  const byLink = new Map<string, GroupNode>();
  const linkToParentValue = new Map<string, string>();

  for (const row of rows as any[]) {
    if (!byLink.has(row.link_id)) {
      byLink.set(row.link_id, {
        id: row.link_id,
        name: row.source_group_name,
        selection_type: row.selection_type,
        is_required: row.is_required,
        options: [],
      });
      linkToParentValue.set(row.link_id, row.parent_value_id);
    }
    if (row.option_id) {
      byLink.get(row.link_id)!.options.push({
        id: row.option_id,
        label: row.label,
        price_delta: parseFloat(row.price_delta),
        is_default: row.is_default,
      });
    }
  }

  // Recurse: a value inside one of these sub-groups could itself trigger
  // further sub-groups (e.g. "Large drink" → "Choose a straw type")
  const nestedValueIds = Array.from(byLink.values()).flatMap(g => g.options.map(o => o.id));
  const nestedMap = nestedValueIds.length
    ? await fetchSubgroupsForValues(nestedValueIds, depth + 1)
    : new Map<string, GroupNode[]>();

  for (const group of byLink.values()) {
    for (const opt of group.options as any[]) {
      const nested = nestedMap.get(opt.id);
      if (nested && nested.length > 0) opt.subgroups = nested;
    }
  }

  for (const [linkId, group] of byLink.entries()) {
    const parentValueId = linkToParentValue.get(linkId)!;
    const list = result.get(parentValueId) ?? [];
    list.push(group);
    result.set(parentValueId, list);
  }

  return result;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;

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

  const groupMap = new Map<string, GroupNode>();

  for (const row of rows as any[]) {
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

  const topLevelGroups = Array.from(groupMap.values());

  const topLevelValueIds = topLevelGroups.flatMap(g => g.options.map(o => o.id));
  const subgroupsByValue = topLevelValueIds.length
    ? await fetchSubgroupsForValues(topLevelValueIds, 0)
    : new Map<string, GroupNode[]>();

  for (const group of topLevelGroups) {
    for (const opt of group.options as any[]) {
      const subs = subgroupsByValue.get(opt.id);
      if (subs && subs.length > 0) opt.subgroups = subs;
    }
  }

  return NextResponse.json({ groups: topLevelGroups });
}