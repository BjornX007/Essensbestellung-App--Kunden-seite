"use client";

import { useEffect, useRef, useState } from "react";
import CartPanel from "@/components/cart/CartPanel";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";

type BusinessInfo = {
  name: string;
  logo_url: string | null;
};

export default function Navbar() {
  const { lines, setCartOpen } = useCart();
  const [info, setInfo] = useState<BusinessInfo | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setInfo(data))
      .catch((e) => console.error("[Navbar] failed to load info:", e));
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <nav ref={navRef} className={scrolled ? "nav-scrolled" : ""}>
        {/* Logo */}
        <Link href="/" className="nav-logo">
          {info?.logo_url ? (
            <img
              src={info.logo_url}
              alt={info.name}
              className="nav-logo-img"
              width={120}
              height={40}
            />
          ) : (
            <>
              {info?.name ?? "Almira"} <span>Pizza&amp;Burger</span>
            </>
          )}
        </Link>

        {/* Navigation Links */}
        <div className="nav-links">
          <Link href="/menu">Speisekarte</Link>
         
          <a href="#rezensionen">Bewertungen</a>
          <a href="#kontakt">Kontakt</a>
          <a href="#info">Öffnungszeiten</a>
        </div>

        {/* Right Side */}
        <div className="nav-right">
          <button
            className="cart-trigger"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-haspopup="dialog"
            aria-label="Warenkorb öffnen"
          >
            <ShoppingCart size={20} />
            <span>Warenkorb</span>
            {totalQty > 0 && (
              <span className="cart-badge" aria-live="polite" aria-atomic="true">
                {totalQty}
              </span>
            )}
          </button>

          <a href="tel:015738403589" className="nav-cta">
            <svg
              className="cta-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 4 C5 4 7 3 9 4 L11 8 L9 10 C10 13 11 14 14 15 L16 13 L20 15 C21 17 20 19 20 19 C14 20 4 10 5 4 Z" />
            </svg>
            <span className="cta-label">Jetzt anrufen</span>
          </a>
        </div>
      </nav>

      <CartPanel />
    </>
  );
}