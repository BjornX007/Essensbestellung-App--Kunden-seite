"use client";
import { useEffect, useState } from "react";

export default function ReviewsSection() {
  const [score, setScore] = useState("–");
  const [count, setCount] = useState("Bewertungen werden geladen…");
  const [reviews, setReviews] = useState<{ text: string; author: string }[]>([]);

  // Simulated fetch (replace with real API later)
  useEffect(() => {
    setTimeout(() => {
      setScore("4.7");
      setCount("Basierend auf 120 Bewertungen");
      setReviews([
        {
          text: "Super leckeres Essen und schneller Service!",
          author: "Max",
        },
        {
          text: "Beste Pizza in der Gegend. Immer wieder gern.",
          author: "Sophie",
        },
        {
          text: "Freundliches Personal und top Qualität.",
          author: "Ali",
        },
      ]);
    }, 1500);
  }, []);

  return (
    <section className="reviews-section" id="rezensionen">
      <div className="container">
        <div className="s-tag">Kundenstimmen · Google</div>

        <h2>
          Was unsere Gäste <em>sagen</em>
        </h2>

        <div className="reviews-top">
          <div className="score">{score}</div>

          <div>
            <div className="stars">★★★★★</div>
            <div className="score-sub">{count}</div>
          </div>
        </div>

        <div className="r-grid">
          {reviews.length === 0 ? (
            <div className="r-card">
              <div className="r-text" style={{ color: "var(--muted)", fontSize: ".9rem" }}>
                Rezensionen werden geladen…
              </div>
            </div>
          ) : (
            reviews.map((review, i) => (
              <div className="r-card" key={i}>
                <div className="r-text">“{review.text}”</div>
                <div className="r-author">– {review.author}</div>
              </div>
            ))
          )}
        </div>

        <p className="reviews-cta">
          Alle Bewertungen auf{" "}
          <a
            href="https://www.google.com/maps/place/Almira+Pizza%26Burger/@50.8833403,5.8891403,184589m/data=!3m1!1e3!4m10!1m2!2m1!1sburger+pizza+almira!3m6!1s0x47bf2100252cdd0f:0xcd4911e9fe197bbb!8m2!3d50.8833403!4d7.0097458!15sChNidXJnZXIgcGl6emEgYWxtaXJhWhUiE2J1cmdlciBwaXp6YSBhbG1pcmGSAQ1waXp6YXRha2Vhd2F5mgFEQ2k5RFFVbFJRVU52WkVOb2RIbGpSamx2VDJ4c1VWSlZSbTVQVlZwSVVrZG9TazVJVWpOWU1taDVXREE0ZEdSdVl4QULgAQD6AQQIDhBG!16s%2Fg%2F11yfvgzy72?entry=ttu"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Maps ansehen →
          </a>
        </p>
      </div>
    </section>
  );
}