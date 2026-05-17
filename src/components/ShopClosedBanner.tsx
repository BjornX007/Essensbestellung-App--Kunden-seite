// components/ShopClosedBanner.tsx
// Drop this wherever you render the cart button or checkout entry point.
// Shows a contextual message depending on WHY the shop is closed.

import { ShopStatusReason } from "@/lib/shop/useShopStatus";

type Props = {
  reason: ShopStatusReason;
  opens_at?: string; // e.g. "11:00"
};

export function ShopClosedBanner({ reason, opens_at }: Props) {
  const message = getMessage(reason, opens_at);

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      padding: "14px 16px",
      borderRadius: "10px",
      background: "#FEF3E2",
      border: "1px solid #F5C97A",
      color: "#7A4A00",
      fontSize: "13.5px",
      lineHeight: "1.5",
    }}>
      <span style={{ fontSize: "16px", flexShrink: 0 }}>🔒</span>
      <span>{message}</span>
    </div>
  );
}

function getMessage(reason: ShopStatusReason, opens_at?: string): string {
  switch (reason) {
    case "manual_stop":
      return "Wir nehmen gerade keine Bestellungen an. Bitte versuche es später erneut.";
    case "outside_hours":
      return opens_at
        ? `Wir sind gerade geschlossen.`
        : "Wir sind gerade geschlossen. Bitte schau später vorbei.";
    case "day_closed":
      return "Heute haben wir leider geschlossen. Wir freuen uns morgen auf deine Bestellung!";
    default:
      return "Bestellungen sind derzeit nicht möglich.";
  }
}