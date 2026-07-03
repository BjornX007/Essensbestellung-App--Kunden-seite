// file: my-app/src/app/context/CartContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
}

export interface SelectedOption {
  groupId: string;
  optionId: string;
  label: string;
  price_delta: number;
}

export interface CartLine {
  lineId: string;
  product: Product;
  qty: number;
  selectedOptions: SelectedOption[];
  unitPrice: number;
}

interface CartContextType {
  lines: CartLine[];
  add: (
    product: Product,
    selections?: Record<string, Set<string>>,
    optionsMeta?: Record<string, { label: string; price_delta: number }[]>, // flat, keyed by option UUID
    extraPrice?: number
  ) => void;
  remove: (lineId: string) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  clear: () => void;
  totalItems: number;
  totalPrice: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "cart:lines:v1";

function makeLineId() {
  return Math.random().toString(36).slice(2);
}

function loadPersistedLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape check so a corrupted/old-format value can't crash the app
    return parsed.filter(
      (l) =>
        l &&
        typeof l.lineId === "string" &&
        l.product &&
        typeof l.qty === "number" &&
        typeof l.unitPrice === "number"
    );
  } catch (e) {
    console.warn("[CartContext] Failed to read persisted cart:", e);
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart after mount. Doing this in an effect (rather than a
  // lazy useState initializer) avoids a server/client hydration mismatch,
  // since the server always renders an empty cart and localStorage is only
  // available in the browser.
  useEffect(() => {
    setLines(loadPersistedLines());
    setHydrated(true);
  }, []);

  // Persist on every change, but only after initial hydration — otherwise
  // this effect would fire once on mount with the empty initial state and
  // immediately wipe out whatever was saved.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch (e) {
      console.warn("[CartContext] Failed to persist cart:", e);
    }
  }, [lines, hydrated]);

  const add = (
    product: Product,
    selections: Record<string, Set<string>> = {},
    optionsMeta: Record<string, { label: string; price_delta: number }[]> = {},
    extraPrice = 0
  ) => {
    const selectedOptions: SelectedOption[] = [];

    for (const [groupId, optionIds] of Object.entries(selections)) {
      for (const optionId of optionIds) {
        const metaList = optionsMeta[optionId];
        if (!metaList?.length) continue;
        const meta = metaList[0];
        selectedOptions.push({
          groupId,
          optionId,
          label: meta.label,
          price_delta: meta.price_delta,
        });
      }
    }

    const unitPrice = product.price + extraPrice;

    setLines((prev) => {
      const existing = prev.find(
        (l) =>
          l.product.id === product.id &&
          l.unitPrice === unitPrice &&
          l.selectedOptions.length === selectedOptions.length &&
          l.selectedOptions.every((o) =>
            selectedOptions.some((s) => s.optionId === o.optionId)
          )
      );

      if (existing) {
        return prev.map((l) =>
          l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l
        );
      }

      return [
        ...prev,
        { lineId: makeLineId(), product, qty: 1, selectedOptions, unitPrice },
      ];
    });
  };

  const remove = (lineId: string) =>
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));

  const increment = (lineId: string) =>
    setLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l))
    );

  const decrement = (lineId: string) =>
    setLines((prev) =>
      prev
        .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0)
    );

  // Only clear on a genuinely completed order (called from CheckoutModal
  // after a successful save). NOT called when the user just closes the
  // checkout modal to go add more items — that path must keep the cart.
  const clear = () => {
    setLines([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (e) {
      console.warn("[CartContext] Failed to clear persisted cart:", e);
    }
  };

  const totalItems = lines.reduce((s, l) => s + l.qty, 0);
  const totalPrice = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  return (
    <CartContext.Provider
      value={{
        lines,
        add,
        remove,
        increment,
        decrement,
        clear,
        totalItems,
        totalPrice,
        cartOpen,
        setCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}