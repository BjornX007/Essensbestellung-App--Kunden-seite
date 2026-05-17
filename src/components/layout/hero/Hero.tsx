"use client";

import { useEffect, useState } from "react";

type BusinessInfo = {
  name: string;
  tagline: string | null;
  city: string | null;
  logo_url: string | null;
  hero_image_url: string | null; // primary hero image
};

export default function Hero() {
  const [info, setInfo] = useState<BusinessInfo | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetch("/api/info")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setInfo(data))
      .catch((e) => console.error("[Hero] failed to load info:", e));
  }, []);

  // Reset img error whenever info changes (new fetch)
  useEffect(() => {
    setImgError(false);
  }, [info]);

  // Priority: hero_image_url → logo_url → fallback placeholder
  const heroImageSrc =
    !imgError && (info?.hero_image_url ?? info?.logo_url)
      ? (info?.hero_image_url ?? info?.logo_url)!
      : null;

  const heroAlt = info?.name
    ? `${info.name} – Hero Bild`
    : "Almira Pizza & Burger – Hero Bild";

  const slogan = info?.tagline ?? "Knusprig. Saftig. Aus Herz und Hand.";
  const city = info?.city ?? "Köln";

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow-row">
            <span className="hero-num">N° 01</span>
            <span className="hero-tag">Foodtruck · {city} · seit 2025</span>
          </div>
          <h1>
            Pizza &amp; Burger.<br />
            <em>Zwei Klassiker. Eine Liebe.</em>
          </h1>
          <p className="hero-slogan">{slogan}</p>
          <div className="hero-btns">
            <a href="/menu" className="btn-fill">Zur Speisekarte →</a>
            <a href="#opening-hours" className="btn-line">Öffnungszeiten</a>
          </div>
        </div>

        <div className="hero-right">
          {heroImageSrc ? (
            <img
              className="hero-logo"
              src={heroImageSrc}
              alt={heroAlt}
              width={624}
              height={529}
              onError={() => setImgError(true)}
            />
          ) : (
            /* Fallback placeholder shown when no image is available */
            <div className="hero-img-fallback" aria-label={heroAlt}>
              <svg
                viewBox="0 0 120 120"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Pizza slice */}
                <circle cx="42" cy="52" r="30" fill="currentColor" opacity="0.15" />
                <path
                  d="M42 22 L68 72 L16 72 Z"
                  fill="currentColor"
                  opacity="0.4"
                />
                <circle cx="38" cy="56" r="4" fill="currentColor" opacity="0.6" />
                <circle cx="50" cy="62" r="3" fill="currentColor" opacity="0.6" />
                <circle cx="34" cy="65" r="3" fill="currentColor" opacity="0.6" />

                {/* Burger bun */}
                <ellipse cx="82" cy="62" rx="24" ry="10" fill="currentColor" opacity="0.4" />
                <rect x="60" y="62" width="44" height="6" fill="currentColor" opacity="0.3" />
                <rect x="60" y="68" width="44" height="4" fill="currentColor" opacity="0.25" />
                <ellipse cx="82" cy="72" rx="22" ry="6" fill="currentColor" opacity="0.35" />
              </svg>
              <span>{info?.name ?? "Almira Pizza & Burger"}</span>
            </div>
          )}
        </div>
      </div>

      {/* QUICK STRIP */}
      <div className="info-strip">
        <div className="strip-item">
          <svg className="strip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11 L12 3 L21 11 V20 A1 1 0 0 1 20 21 H4 A1 1 0 0 1 3 20 Z" />
            <path d="M9 21 V14 H15 V21" />
          </svg>
          Lieferung nach Hause
        </div>

        <div className="strip-item">
          <svg className="strip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 16 V11 L6 6 H18 L20 11 V16" />
            <path d="M4 16 H20" />
            <path d="M4 16 V19 H7 V16" />
            <path d="M20 16 V19 H17 V16" />
            <circle cx="8" cy="13.5" r=".8" fill="currentColor" />
            <circle cx="16" cy="13.5" r=".8" fill="currentColor" />
          </svg>
          Drive-in verfügbar
        </div>

        <div className="strip-item">
          <svg className="strip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 3 V10 M5 3 V8 A2 2 0 0 0 7 10" />
            <path d="M7 10 V21" />
            <path d="M17 3 C15 3 14 5 14 8 C14 10 15 11 17 11 V21" />
          </svg>
          Speisen vor Ort
        </div>

        <div className="strip-item">
          <svg className="strip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="6" width="18" height="13" rx="1.5" />
            <path d="M3 10 H21" />
            <path d="M7 15 H11" />
          </svg>
          Kontaktlose Bezahlung
        </div>
      </div>

      <style>{`
        .hero-img-fallback {
          width: 624px;
          max-width: 100%;
          height: 529px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          border-radius: 1.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 2px dashed rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.35);
        }
        .hero-img-fallback svg {
          width: 140px;
          height: 140px;
          color: currentColor;
        }
        .hero-img-fallback span {
          font-size: 0.9rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.6;
        }
      `}</style>
    </>
  );
}