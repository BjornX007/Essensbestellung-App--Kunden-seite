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

// ✅ update the prop type to match
interface ProductOptionsModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (
    product: Product,
    selections: Record<string, Set<string>>,
    optionsMeta: Record<string, { label: string; price_delta: number }[]>, // ✅ flat
    extraPrice: number
  ) => void;
}

/* ── Helpers ── */
function computeExtra(groups: OptionGroup[], selections: Selections): number {
  let extra = 0;
  for (const group of groups) {
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
  return groups
    .filter((g) => g.is_required)
    .every((g) => (selections[g.id]?.size ?? 0) > 0);
}

// ✅ replace the old buildOptionsMeta function
function buildOptionsMeta(
  groups: OptionGroup[]
): Record<string, { label: string; price_delta: number }[]> {
  const meta: Record<string, { label: string; price_delta: number }[]> = {};
  for (const group of groups) {
    for (const opt of group.options) {
      meta[opt.id] = [{ label: opt.label, price_delta: opt.price_delta }];
    }
  }
  return meta;
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

  /* fetch option groups */
  useEffect(() => {
    fetch(`${window.location.origin}/api/menu/${product.id}/options`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load options");
        return r.json();
      })
      .then(({ groups: g }: { groups: OptionGroup[] }) => {
        setGroups(g);
        /* pre-select defaults */
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

  /* close on overlay click */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  /* close on Escape */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  /* lock body scroll */
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
    onConfirm(product, selections, buildOptionsMeta(groups), extraPrice);
  };

  /* If no option groups exist, skip straight to adding */
  useEffect(() => {
    if (!loading && groups.length === 0 && !error) {
      onConfirm(product, {}, {}, 0);
    }
  }, [loading, groups, error]);

  if (!loading && groups.length === 0 && !error) return null;

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label={`Customise ${product.name}`}>
      <div className={styles.sheet}>
        {/* Hero image / fallback */}
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

        {/* Header */}
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

        {/* Body */}
        <div className={styles.body}>
          {loading && (
            <div className={styles.loadState}>
              <div className={styles.spinner} />
              <span>Loading options…</span>
            </div>
          )}

          {error && <p className={styles.errorText}>{error}</p>}

          {!loading && !error && groups.map((group) => (
            <section key={group.id} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupName}>{group.name}</span>
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
                    <button
                      key={opt.id}
                      className={`${styles.optionRow} ${chosen ? styles.optionChosen : ""}`}
                      onClick={() => toggleOption(group, opt.id)}
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
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
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