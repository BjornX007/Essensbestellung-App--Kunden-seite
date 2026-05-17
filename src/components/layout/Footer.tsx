"use client";

import { useEffect, useState } from "react";

type BusinessInfo = {
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
};

export default function Footer() {
  const [info, setInfo] = useState<BusinessInfo | null>(null);

  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setInfo(data))
      .catch((e) => console.error("[Footer] failed to load info:", e));
  }, []);

  const name    = info?.name ?? "Almira Pizza & Burger";
  const phone   = info?.phone ?? "015738403589";
  const address = [info?.address, info?.postal_code, info?.city]
    .filter(Boolean)
    .join(", ");

  return (
    <footer>
      <div className="foot-meta">Grazie Mille · Seit 2025</div>

      <div className="foot-signature">
        Made with <em>amore</em> in {info?.city ?? "Köln"}.
      </div>

      <div>
        © {new Date().getFullYear()} {name}
        {address && <> · {address}</>}
      </div>

      <div className="foot-divider" />

      <div className="foot-links">
        <a href="#">Impressum</a>
        <a href="#">Datenschutz</a>
        <a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a>
      </div>
    </footer>
  );
}