export default function MenuSection() {
  return (
    <section id="speisekarte">
      <div className="container">
        <div className="menu-intro">
          <div className="s-tag">La Carta · Seit 2025</div>

          <h2>
            Frisch gemacht,
            <br />
            <em>schnell geliefert.</em>
          </h2>

          <p className="s-sub">
            Handgemachte Pizzen aus dem Steinofen, saftige Burger-Patties.
            Klicke auf ein Gericht für Extras, Soßen und Menü-Optionen.
          </p>
        </div>

        {/* 👉 Replace this later with real menu component */}
        <div id="menuMount" />

        {/* ALLERGEN-LEGENDE */}
        <div className="allergen-legend" id="allergenLegend">
          <div className="al-title">
            Hinweis zu Allergenen und Zusatzstoffen
          </div>

          <div className="al-cols">
            {/* Allergene */}
            <div className="al-group">
              <div className="al-head">Allergene</div>

              {[
                ["a", "Glutenhaltiges Getreide"],
                ["b", "Krebstiere"],
                ["c", "Eier"],
                ["d", "Fische"],
                ["e", "Erdnüsse"],
                ["f", "Soja(bohnen)"],
                ["g", "Milch"],
                ["h", "Schalenfrüchte"],
                ["i", "Sellerie"],
                ["j", "Senf"],
                ["k", "Sesamsamen"],
                ["l", "Schwefeldioxid & Sulphite"],
                ["m", "Lupinen"],
                ["n", "Weichtiere"],
              ].map(([code, text]) => (
                <div key={code} className="al-item">
                  <span className="al-code">{code}</span> {text}
                </div>
              ))}
            </div>

            {/* Zusatzstoffe */}
            <div className="al-group">
              <div className="al-head">Zusatzstoffe</div>

              {[
                ["1", "mit Farbstoff"],
                ["2", "mit Konservierungsstoff"],
                ["3", "mit Antioxidationsmittel"],
                ["4", "mit Geschmacksverstärker"],
                ["5", "geschwefelt"],
                ["6", "geschwärzt"],
                ["7", "mit Phosphat"],
                ["8", "mit Milcheiweiß (bei Fleischerzeugnissen)"],
                ["9", "koffeinhaltig"],
                ["10", "chininhaltig"],
                ["11", "mit Süßungsmittel"],
                ["13", "gewachst"],
              ].map(([code, text]) => (
                <div key={code} className="al-item">
                  <span className="al-code">{code}</span> {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAMILIENPIZZA HINWEIS */}
        <div className="menu-big-note">
          <div className="mbn-icon" aria-hidden="true">
            <svg
              viewBox="0 0 56 56"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="28" cy="28" r="24" />
              <circle cx="28" cy="28" r="20" opacity=".35" />
              <text
                x="28"
                y="36"
                textAnchor="middle"
                fontFamily="var(--f-display)"
                fontSize="24"
                fontStyle="italic"
                fill="currentColor"
                stroke="none"
              >
                A
              </text>
            </svg>
          </div>

          <div className="mbn-text">
            <h3>Du planst etwas Größeres?</h3>
            <p>
              Auf Anfrage machen wir auch Familienpizzen & Partybleche –
              perfekt für eure nächste Feier.
            </p>
          </div>

          <a href="tel:015738403589" className="btn-fill">
            <svg
              className="btn-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 4 C5 4 7 3 9 4 L11 8 L9 10 C10 13 11 14 14 15 L16 13 L20 15 C21 17 20 19 20 19 C14 20 4 10 5 4 Z" />
            </svg>
            Anfragen
          </a>
        </div>
      </div>
    </section>
  );
}