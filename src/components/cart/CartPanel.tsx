"use client";

import { useState } from "react";
import { X, ShoppingCart, Lock, Plus, Minus, Trash2, ChevronRight } from "lucide-react";
import { useCart } from "@/app/context/CartContext";
import CheckoutModal from "../checkout/CheckoutModal";
import { useShopStatus } from "@/lib/shop/useShopStatus";
import { useDeliveryTiers } from "@/lib/shop/useDeliveryTiers";
import { ShopClosedBanner } from "@/components/ShopClosedBanner";

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function CartPanel() {
  const { lines, increment, decrement, remove, clear, totalPrice, cartOpen, setCartOpen } =
    useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { status, loading: statusLoading } = useShopStatus();
  const {
    minOrderEur,
    feeMinEur,
    feeMaxEur,
    loading: tiersLoading,
    error: tiersError,
  } = useDeliveryTiers();

  const belowMin = minOrderEur === null ? true : totalPrice < minOrderEur;

  // Split "still figuring it out" from "confirmed closed" — these need
  // different rendering, since ShopClosedBanner requires a real status object.
  const statusUnknown = statusLoading || status === null;
  const shopClosed = !statusUnknown && !status.is_open;

  // Block checkout in both cases — we just can't confidently say it's open.
  const checkoutBlocked = belowMin || statusUnknown || shopClosed || tiersLoading || !!tiersError;

  // ... rest of component
  return (
    <>
      {/* Backdrop */}
      {cartOpen && (
        <div
          className="cart-backdrop"
          onClick={() => setCartOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={`cart-panel ${cartOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Warenkorb"
        aria-hidden={!cartOpen}
      >
        {/* Header */}
        <div className="cart-head">
          <div>
            <div className="cart-title">Dein Warenkorb</div>
            <div className="cart-count">
              {lines.reduce((s, l) => s + l.qty, 0)} Artikel
            </div>
          </div>
          <button
            className="cart-close"
            onClick={() => setCartOpen(false)}
            aria-label="Warenkorb schließen"
          >
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="cart-list">
          {lines.length === 0 ? (
            <div className="cart-empty">
              <ShoppingCart size={40} strokeWidth={1.2} />
              <p>Dein Warenkorb ist leer</p>
              <div className="small">Füge Gerichte aus der Speisekarte hinzu.</div>
            </div>
          ) : (
            lines.map(({ lineId, product, qty, selectedOptions, unitPrice }) => (
              <div key={lineId} className="cart-item">
                <div className="cart-item-img">
                  <img src={product.image_url ?? undefined} alt={product.name} />
                </div>

                <div className="cart-item-info">
                  {selectedOptions?.length > 0 && (
                    <span className="cart-item-options">
                      {selectedOptions.map((o) => o.label).join(", ")}
                    </span>
                  )}
                  <span className="cart-item-name">{product.name}</span>
                  <span className="cart-item-unit">{fmt(unitPrice)} / Stk.</span>
                  <div className="qty-controls">
                    <button className="qty-btn" onClick={() => decrement(lineId)} aria-label="Weniger">
                      <Minus size={13} />
                    </button>
                    <span className="qty-val">{qty}</span>
                    <button className="qty-btn" onClick={() => increment(lineId)} aria-label="Mehr">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <span className="cart-item-total">{fmt(unitPrice * qty)}</span>

                <button
                  className="cart-item-remove"
                  onClick={() => remove(lineId)}
                  aria-label="Entfernen"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {lines.length > 0 && (
          <div className="cart-summary">
            <div className="sum-divider" />
            <div className="sum-total">
              <span className="sum-total-label">Gesamt</span>
              <span className="sum-total-val">{fmt(totalPrice)}</span>
            </div>
            <div className="sum-row sum-row-pending">
              <span>Liefergebühr</span>
              <span>nach Addresse-Eingabe</span>
            </div>
            <div className="sum-note">
              {feeMinEur !== null && feeMaxEur !== null && minOrderEur !== null ? (
                <>
                  {feeMinEur === feeMaxEur
                    ? fmt(feeMinEur)
                    : `${fmt(feeMinEur)} – ${fmt(feeMaxEur)}`}{" "}
                  je nach Adresse · Mindestbestellwert {fmt(minOrderEur)}
                </>
              ) : tiersError ? (
                "Liefergebühren konnten nicht geladen werden"
              ) : (
                "Liefergebühren werden geladen …"
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {lines.length > 0 && (
          <div className="cart-foot">
            {shopClosed && (
              <ShopClosedBanner
                reason={status!.reason}
                opens_at={status!.opens_at}
              />
            )}

            {!shopClosed && !tiersLoading && !tiersError && belowMin && minOrderEur !== null && (
              <div className="cart-min-warning">
                Noch {fmt(minOrderEur - totalPrice)} bis zum Mindestbestellwert
              </div>
            )}

            <button
              className="cart-checkout"
              disabled={checkoutBlocked}
              onClick={() => {
                if (checkoutBlocked) return;
                setCartOpen(false);
                setCheckoutOpen(true);
              }}
            >
              <Lock size={16} />
              Sicher bezahlen
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </aside>

      {checkoutOpen && (
        <CheckoutModal
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            setCheckoutOpen(false);
            clear();
          }}
        />
      )}
    </>
  );
}