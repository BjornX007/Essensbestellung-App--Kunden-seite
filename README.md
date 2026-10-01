# Lieferdienst-Plattform – Kundenapp

Bestellseite für einen Lieferdienst nach dem Vorbild von Plattformen wie Uber Eats: Kunden wählen Gerichte aus, legen sie in den Warenkorb und lassen sich die Bestellung nach Hause liefern. Die Seite ist der Kundenteil einer Gesamtplattform. Verwaltung und Fahrer-App liegen in einem separaten Projekt (`lieferdienst-plattform-admin`).

## Funktionen

- **Speisekarte nach Kategorien:** Produkte mit Beschreibung, Preis und Kategorie, direkt aus der Datenbank geladen
- **Warenkorb und Checkout:** Produkte hinzufügen, Mengen ändern, Lieferadresse angeben und die Bestellung abschicken
- **Lieferkosten nach Distanz:** Die Lieferkosten werden über Liefer-Stufen aus der Datenbank berechnet, nicht über feste Werte im Code
- **Online-Zahlung:** Bezahlung per PayPal
- **Bestellhistorie:** Übersicht der eigenen Bestellungen mit Datumsfilter

## Wie die Bestelllogik funktioniert

Die Bestellseite hält sich an Regeln, die der Betreiber im Admin-Dashboard festlegt. Dadurch muss am Code nichts geändert werden, wenn sich der Betrieb ändert.

| Einstellung im Admin | Wirkung auf der Bestellseite |
|---|---|
| Öffnungszeiten | Außerhalb der Öffnungszeiten können keine Bestellungen aufgegeben werden |
| Maximale Lieferdistanz | Adressen, die weiter entfernt liegen, werden abgelehnt |
| Maximaler Bestellwert | Bestellungen über dem Limit werden nicht angenommen |
| Name des Unternehmens | Wird auf der Seite und in der Bestellung angezeigt |
| Produkte, Preise, Kategorien | Die Speisekarte wird sofort aktualisiert |

## Ablauf einer Bestellung

1. Der Kunde öffnet die Seite und wählt Produkte aus den Kategorien.
2. Im Warenkorb wird der Preis inklusive Lieferkosten berechnet.
3. Die Seite prüft Öffnungszeiten, Lieferdistanz und Bestelllimit.
4. Der Kunde bezahlt und schickt die Bestellung ab.
5. Die Bestellung erscheint in der Küchenansicht des Admin-Dashboards und wird dort einem Fahrer zugewiesen.

## Technologie

- Next.js (App Router), React, TypeScript
- PostgreSQL (Neon)
- PayPal-Integration für Zahlungen
- Deployment auf Vercel

## Projektstruktur

Die Plattform besteht aus zwei getrennt gehosteten Anwendungen, die sich dieselbe Datenbank teilen:

| Projekt | Inhalt |
|---|---|
| `lieferdienst-plattform-kundenapp` | Bestellseite für Kunden (dieses Repository) |
| `lieferdienst-plattform-admin` | Admin-Dashboard und Fahrer-App |

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Datenbank- und PayPal-Zugangsdaten eintragen
npm run dev
```

Die Anwendung ist anschließend unter `http://localhost:3000` erreichbar.# Lieferdienst-Plattform – Kundenapp

Bestellseite für einen Lieferdienst nach dem Vorbild von Plattformen wie Uber Eats: Kunden wählen Gerichte aus, legen sie in den Warenkorb und lassen sich die Bestellung nach Hause liefern. Die Seite ist der Kundenteil einer Gesamtplattform. Verwaltung und Fahrer-App liegen in einem separaten Projekt (`lieferdienst-plattform-admin`).

## Funktionen

- **Speisekarte nach Kategorien:** Produkte mit Beschreibung, Preis und Kategorie, direkt aus der Datenbank geladen
- **Warenkorb und Checkout:** Produkte hinzufügen, Mengen ändern, Lieferadresse angeben und die Bestellung abschicken
- **Lieferkosten nach Distanz:** Die Lieferkosten werden über Liefer-Stufen aus der Datenbank berechnet, nicht über feste Werte im Code
- **Online-Zahlung:** Bezahlung per PayPal
- **Bestellhistorie:** Übersicht der eigenen Bestellungen mit Datumsfilter

## Wie die Bestelllogik funktioniert

Die Bestellseite hält sich an Regeln, die der Betreiber im Admin-Dashboard festlegt. Dadurch muss am Code nichts geändert werden, wenn sich der Betrieb ändert.

| Einstellung im Admin | Wirkung auf der Bestellseite |
|---|---|
| Öffnungszeiten | Außerhalb der Öffnungszeiten können keine Bestellungen aufgegeben werden |
| Maximale Lieferdistanz | Adressen, die weiter entfernt liegen, werden abgelehnt |
| Maximaler Bestellwert | Bestellungen über dem Limit werden nicht angenommen |
| Name des Unternehmens | Wird auf der Seite und in der Bestellung angezeigt |
| Produkte, Preise, Kategorien | Die Speisekarte wird sofort aktualisiert |

## Ablauf einer Bestellung

1. Der Kunde öffnet die Seite und wählt Produkte aus den Kategorien.
2. Im Warenkorb wird der Preis inklusive Lieferkosten berechnet.
3. Die Seite prüft Öffnungszeiten, Lieferdistanz und Bestelllimit.
4. Der Kunde bezahlt und schickt die Bestellung ab.
5. Die Bestellung erscheint in der Küchenansicht des Admin-Dashboards und wird dort einem Fahrer zugewiesen.

## Technologie

- Next.js (App Router), React, TypeScript
- PostgreSQL (Neon)
- PayPal-Integration für Zahlungen
- Deployment auf Vercel

## Projektstruktur

Die Plattform besteht aus zwei getrennt gehosteten Anwendungen, die sich dieselbe Datenbank teilen:

| Projekt | Inhalt |
|---|---|
| `lieferdienst-plattform-kundenapp` | Bestellseite für Kunden (dieses Repository) |
| `lieferdienst-plattform-admin` | Admin-Dashboard und Fahrer-App |

