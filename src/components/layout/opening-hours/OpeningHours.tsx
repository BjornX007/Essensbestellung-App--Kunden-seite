"use client";

import { useEffect, useState } from "react";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

interface HourRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface BusinessInfo {
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  opening_hours: HourRow[];
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

function isOpenNow(hours: HourRow[]) {
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7;
  const today = hours.find((h) => h.day_of_week === dayIndex);
  if (!today || today.is_closed) return false;
  const [oh, om] = today.open_time.split(":").map(Number);
  const [ch, cm] = today.close_time.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= oh * 60 + om && mins < ch * 60 + cm;
}

export default function OpeningHours() {
  const [info, setInfo] = useState<BusinessInfo | null>(null);

  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.json())
      .then(setInfo);
  }, []);

  const hours = info?.opening_hours ?? [];
  const open = info ? isOpenNow(hours) : false;

  return (
    <section className="opening-hours" id="opening-hours">
      <div className="container">
        <div className="s-tag">Wegweiser · Informazioni</div>
        <h2>Wann und wie du uns <em>findest</em></h2>

        <div className="info-two">
          <div>
            <div className="info-block">
              <div className="i-label">Adresse</div>
              <div className="i-val">
                {info ? `${info.address}` : "Weißer Str. 147–151"} <br />
                {info ? `${info.postal_code} ${info.city}` : "50999 Köln"}
              </div>
            </div>

            <div className="info-block">
              <div className="i-label">Telefon</div>
              <div className="i-val">
                <a href={`tel:${info?.phone ?? "015738403589"}`}>
                  {info?.phone ?? "01573 8403589"}
                </a>
              </div>
            </div>

            <div className="info-block">
              <div className="i-label">
                Öffnungszeiten{" "}
                {open && <span className="open-badge">Heute geöffnet</span>}
              </div>

              <table className="ot">
                <tbody>
                  {DAYS.map((day, i) => {
                    const row = hours.find((h) => h.day_of_week === i);
                    return (
                      <tr key={day}>
                        <td>{day}</td>
                        <td className={row?.is_closed ? "closed" : ""}>
                          {!row || row.is_closed
                            ? "Ruhetag"
                            : `${formatTime(row.open_time)} – ${formatTime(row.close_time)} Uhr`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* map block stays the same */}
        </div>
      </div>
    </section>
  );
}