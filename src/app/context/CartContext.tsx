"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
    optionsMeta?: Record<string, { label: string; price_delta: number }>, // ✅ flat, keyed by option UUID
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

function makeLineId() {
  return Math.random().toString(36).slice(2);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const add = (
    product: Product,
    selections: Record<string, Set<string>> = {},
    optionsMeta: Record<string, { label: string; price_delta: number }> = {}, // ✅ flat map
    extraPrice = 0
  ) => {
    const selectedOptions: SelectedOption[] = [];

    for (const [groupId, optionIds] of Object.entries(selections)) {
      for (const optionId of optionIds) {
        const meta = optionsMeta[optionId]; // ✅ direct UUID lookup — always correct
        if (!meta) continue;               // skip "Keine Sauce" / zero-delta defaults if desired
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

  const clear = () => setLines([]);

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