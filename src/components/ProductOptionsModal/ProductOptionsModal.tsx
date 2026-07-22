"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProductOptionsModal.module.css";
import { type Product } from "@/app/context/CartContext";

/* ── Types ── */
interface Option {
  id: string;
  label: string;
  price_delta: number;
  is_default: boolean;
  subgroups?: OptionGroup[]; // revealed when this option is selected
}

interface OptionGroup {
  id: string;
  name: string;
  selection_type: "single" | "multi";
  is_required: boolean;
  sort_order: number;
  options: Option[];
}

interface Selections {
  [groupId: string]: Set<string>;
}

interface ProductOptionsModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (
    product: Product,
    selections: Record<string, Set<string>>,
    optionsMeta: Record<string, { label: string; price_delta: number }[]>,
    extraPrice: number
  ) => void;
}

/* ── Helpers ──
   A group is "visible" if it's top-level, or if its triggering option is
   currently selected. All price/completeness/confirm logic only looks at
   visible groups, so hidden sub-groups never silently affect the total. */
function collectVisibleGroups(groups: OptionGroup[], selections: Selections): OptionGroup[] {
  const acc: OptionGroup[] = [];
  const walk = (list: OptionGroup[]) => {
    for (const group of list) {
      acc.push(group);
      const chosen = selections[group.id];
      if (!chosen) continue;
      for (const opt of group.options) {
        if (chosen.has(opt.id) && opt.subgroups?.length) {
          walk(opt.subgroups);
        }
      }
    }
  };
  walk(groups);
  return acc;
}

function collectAllGroups(groups: OptionGroup[]): OptionGroup[] {
  const acc: OptionGroup[] = [];
  const walk = (list: OptionGroup[]) => {
    for (const group of list) {
      acc.push(group);
      for (const opt of group.options) {
        if (opt.subgroups?.length) walk(opt.subgroups);
      }
    }
  };
  walk(groups);
  return acc;
}

function computeExtra(groups: OptionGroup[], selections: Selections): number {
  let extra = 0;
  for (const group of collectVisibleGroups(groups, selections)) {
    const chosen = selections[group.id];
    if (!chosen) continue;
    for (const optId of chosen) {
      const opt = group.options.find((o) => o.id === optId);
      if (opt) extra += opt.price_delta;
    }
  }
  return extra;
}

function isComplete(groups: OptionGroup[], selections: Selections): boolean {
  return collectVisibleGroups(groups, selections)
    .filter((g) => g.is_required)
    .every((g) => (selections[g.id]?.size ?? 0) > 0);
}

function buildOptionsMeta(
  groups: OptionGroup[]
): Record<string, { label: string; price_delta: number }[]> {
  const meta: Record<string, { label: string; price_delta: number }[]> = {};
  for (const group of collectAllGroups(groups)) {
    for (const opt of group.options) {
      meta[opt.id] = [{ label: opt.label, price_delta: opt.price_delta }];
    }
  }
  return meta;
}

/* ── Recursive group renderer ── */
function GroupBlock({
  group, selections, onToggle, depth = 0,
}: {
  group: OptionGroup;
  selections: Selections;
  onToggle: (group: OptionGroup, optionId: string) => void;
  depth?: number;
}) {
  return (
    <section
      className={styles.group}
      style={depth > 0 ? {
        marginLeft: 16, marginTop: 10, paddingLeft: 12,
        borderLeft: "2px solid var(--accent, #16a34a)",
      } : undefined}
    >
      <div className={styles.groupHeader}>
        <span className={styles.groupName}>{depth > 0 ? `↳ ${group.name}` : group.name}</span>
        <span className={`${styles.groupBadge} ${group.is_required ? styles.required : styles.optional}`}>
          {group.is_required ? "Required" : "Optional"}
        </span>
      </div>
      <p className={styles.groupHint}>
        {group.selection_type === "single" ? "Choose one" : "Choose any"}
      </p>

      <div className={styles.options}>
        {group.options.map((opt) => {
          const chosen = selections[group.id]?.has(opt.id) ?? false;
          return (
            <div key={opt.id}>
              <button
                className={`${styles.optionRow} ${chosen ? styles.optionChosen : ""}`}
                onClick={() => onToggle(group, opt.id)}
                role={group.selection_type === "single" ? "radio" : "checkbox"}
                aria-checked={chosen}
              >
                <span className={styles.optionLabel}>{opt.label}</span>
                <span className={styles.optionRight}>
                  {opt.price_delta !== 0 && (
                    <span className={styles.optionPrice}>
                      {opt.price_delta > 0 ? "+" : ""}€{opt.price_delta.toFixed(2)}
                    </span>
                  )}
                  <span className={`${styles.check} ${group.selection_type === "single" ? styles.radio : styles.checkbox} ${chosen ? styles.checkActive : ""}`}>
                    {chosen && group.selection_type === "multi" && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {chosen && group.selection_type === "single" && (
                      <div className={styles.radioDot} />
                    )}
                  </span>
                </span>
              </button>

              {chosen && opt.subgroups && opt.subgroups.length > 0 && (
                <div>
                  {opt.subgroups.map((sg) => (
                    <GroupBlock key={sg.id} group={sg} selections={selections} onToggle={onToggle} depth={depth + 1} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Modal ── */
export default function ProductOptionsModal({
  product,
  onClose,
  onConfirm,
}: ProductOptionsModalProps) {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [selections, setSelections] = useState<Selections>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/menu/${product.id}/options`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load options");
        return r.json();
      })
      .then(({ groups: g }: { groups: OptionGroup[] }) => {
        setGroups(g);
        const initial: Selections = {};
        for (const group of g) {
          const defaults = group.options.filter((o) => o.is_default).map((o) => o.id);
          initial[group.id] = new Set(defaults);
        }
        setSelections(initial);
      })
      .catch(() => setError("Couldn't load customisation options."))
      .finally(() => setLoading(false));
  }, [product.id]);

  // When a selection reveals a new sub-group (or its defaults haven't been
  // seeded yet), pre-select that sub-group's default options automatically.
  useEffect(() => {
    const visible = collectVisibleGroups(groups, selections);
    setSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of visible) {
        if (!(group.id in next)) {
          const defaults = group.options.filter((o) => o.is_default).map((o) => o.id);
          next[group.id] = new Set(defaults);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [groups, selections]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const toggleOption = (group: OptionGroup, optionId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      const current = new Set(next[group.id] ?? []);
      if (group.selection_type === "single") {
        next[group.id] = new Set([optionId]);
      } else {
        if (current.has(optionId)) current.delete(optionId);
        else current.add(optionId);
        next[group.id] = current;
      }
      return next;
    });
  };

  const extraPrice = computeExtra(groups, selections);
  const total = (product.price + extraPrice) * qty;
  const canAdd = isComplete(groups, selections);

  const handleConfirm = () => {
    if (!canAdd) return;
    // Only pass selections for groups that are actually visible right now —
    // stale picks from a sub-group the customer un-selected shouldn't count.
    const visibleIds = new Set(collectVisibleGroups(groups, selections).map((g) => g.id));
    const filtered: Record<string, Set<string>> = {};
    for (const [gid, set] of Object.entries(selections)) {
      if (visibleIds.has(gid)) filtered[gid] = set;
    }
    onConfirm(product, filtered, buildOptionsMeta(groups), extraPrice);
  };

  useEffect(() => {
    if (!loading && groups.length === 0 && !error) {
      onConfirm(product, {}, {}, 0);
    }
  }, [loading, groups, error]);

  if (!loading && groups.length === 0 && !error) return null;

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label={`Customise ${product.name}`}>
      <div className={styles.sheet}>
        {product.image_url ? (
          <div className={styles.hero}>
            <img src={product.image_url} alt={product.name} className={styles.heroImg} />
            <div className={styles.heroGradient} />
          </div>
        ) : (
          <div className={styles.heroFallback}>
            <svg className={styles.heroFallbackIcon} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="10" width="36" height="28" rx="4"/>
              <circle cx="18" cy="20" r="4"/>
              <path d="M6 32l10-8 8 6 6-5 12 9"/>
            </svg>
          </div>
        )}

        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{product.name}</h2>
            {product.description && (
              <p className={styles.desc}>{product.description}</p>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {loading && (
            <div className={styles.loadState}>
              <div className={styles.spinner} />
              <span>Loading options…</span>
            </div>
          )}

          {error && <p className={styles.errorText}>{error}</p>}

          {!loading && !error && groups.map((group) => (
            <GroupBlock key={group.id} group={group} selections={selections} onToggle={toggleOption} />
          ))}
        </div>

        <div className={styles.footer}>
          <div className={styles.stepper}>
            <button
              className={styles.stepBtn}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              disabled={qty <= 1}
            >−</button>
            <span className={styles.stepNum}>{qty}</span>
            <button
              className={styles.stepBtn}
              onClick={() => setQty((q) => q + 1)}
              aria-label="Increase quantity"
            >+</button>
          </div>

          <button
            className={`${styles.addBtn} ${!canAdd ? styles.addBtnDisabled : ""}`}
            onClick={handleConfirm}
            disabled={!canAdd}
          >
            <span>Add to order</span>
            <span className={styles.addPrice}>€{total.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}