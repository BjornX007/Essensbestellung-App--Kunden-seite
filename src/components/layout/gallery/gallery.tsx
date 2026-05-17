"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type GalleryRow = {
  slot: number;
  image_url: string;
  caption: string | null;
};

type BusinessInfo = {
  name: string;
  description: string | null;
};

// Fallback labels when the DB has no caption
const FALLBACK_CAPTIONS = [
  "Pizza & Steinofen",
  "Frische Zutaten",
  "Das Team",
  "Burger-Patties",
  "Lokal in Köln",
  "Familien-Pizza",
];

// ── Placeholder SVG ───────────────────────────────────────────────────────────
function PlaceholderSVG() {
  return (
    <svg
      className="gallery-ph"
      viewBox="0 0 64 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="56" height="36" rx="1" />
      <path d="M4 34 L20 22 L32 30 L44 18 L60 32" />
      <circle cx="48" cy="16" r="3" />
    </svg>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────
export default function Gallery() {
  const [images, setImages] = useState<Map<number, GalleryRow>>(new Map());
  const [info, setInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/public/gallery")
        .then((r) => r.json())
        .then((rows: GalleryRow[]) => {
          const map = new Map<number, GalleryRow>();
          for (const row of rows) map.set(row.slot, row);
          setImages(map);
        }),
      fetch("/api/info")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => data && setInfo(data))
        .catch((e) => console.error("[Gallery] failed to load info:", e)),
    ])
      .catch((e) => console.error("[Gallery] failed to load images:", e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="gallery" className="gallery-section">
      <div className="container">
        <div className="gallery-intro">
          {info?.name && (
            <div className="s-tag">{info.name} · Photogalleria</div>
          )}
          <h2>
            Aus unserer <em>Küche</em>
          </h2>
          {info?.description && (
            <p className="s-sub">{info.description}</p>
          )}
        </div>

        <div className={`gallery-grid${loading ? " gallery-grid--loading" : ""}`}>
          {[1, 2, 3, 4, 5, 6].map((num) => {
            const row = images.get(num);
            const hasImage = Boolean(row?.image_url);
            const caption = row?.caption || FALLBACK_CAPTIONS[num - 1];
            const isPlaceholder = !hasImage;

            return (
              <figure
                key={num}
                className={`gallery-tile gt-${num}${isPlaceholder ? " gallery-tile--placeholder" : ""}`}
              >
                <div className="gallery-frame">
                  {hasImage ? (
                    <img
                      src={row!.image_url}
                      alt={caption}
                      className="gallery-img"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <PlaceholderSVG />
                  )}

                  <span className="gallery-badge">
                    N° {num.toString().padStart(2, "0")}
                  </span>
                </div>

                <figcaption>
                  <span>{caption}</span>
                  {isPlaceholder && <em>Foto folgt</em>}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}