# Immobilienrechner

Webapp für die Frage: **Rechnet sich der Kauf einer Immobilie – oder bringt dasselbe Geld woanders angelegt mehr?**

Live: https://philipplucienkuderer-star.github.io/immobilienrechner/

Funktioniert für zwei Fälle:

- **Vermieten** (Kapitalanlage): Mieteinnahmen, Leerstand, laufende Kosten, Abschreibung (AfA) und Steuerwirkung über den Grenzsteuersatz, Spekulationsfrist.
- **Selbst wohnen**: Kaufen gegen Mieten – die ersparte Miete ist der Ertrag der Immobilie.

## Wie verglichen wird

Beide Szenarien bekommen exakt dasselbe Geld:

| | Kaufen | Alternativanlage |
|---|---|---|
| Start | Eigenkapital geht in Kaufnebenkosten und Kaufpreis | Eigenkapital wird angelegt |
| Monat mit Zuschuss (negativer Cashflow) | Käufer zahlt drauf | genau dieser Betrag wird angelegt |
| Monat mit Überschuss | Überschuss wird angelegt | – |
| Ende | Verkauf: Marktwert − Verkaufskosten − Restschuld − ggf. Steuer + Depot | Depot nach Abgeltungsteuer |

Die Differenz der Endvermögen beantwortet die Frage. Zusätzlich:

- **Eigenkapitalrendite** als interner Zinsfuß (IRR) aller Zahlungen
- **Ab welchem Jahr** Kaufen vorn liegt
- **Break-even-Werte**: nötige Wertsteigerung und nötige Miete, damit sich der Kauf rechnet
- **Sensitivitätsanalyse**: Welche Annahme verschiebt das Ergebnis am stärksten?
- Tilgungsplan Jahr für Jahr, CSV-Export, Teilen per Link (alle Werte stehen in der URL)

## Einstellungen

| Bereich | Werte |
|---|---|
| Objekt und Kauf | Kaufpreis, Wohnfläche, Grunderwerbsteuer (Auswahl nach Bundesland), Notar/Grundbuch, Makler, Renovierung, Eigenkapital |
| Finanzierung | Sollzins, anfängliche Tilgung, Zinsbindung, Anschlusszins, Sondertilgung |
| Miete und Kosten | Kaltmiete bzw. ersparte Miete, Mietsteigerung, Leerstand, nicht umlagefähige Kosten, Instandhaltung (€/m²), Kostensteigerung |
| Steuern (Vermietung) | Grenzsteuersatz, Gebäudeanteil, AfA-Satz |
| Markt und Vergleich | Wertsteigerung, Betrachtungszeitraum, Verkaufskosten, Rendite und Steuersatz der Alternativanlage |

## Vereinfachungen

- Monatliche Simulation, Annuitätendarlehen. Nach der Zinsbindung bleibt die Rate gleich, wird aber angehoben, falls sonst weniger als 1 % getilgt würde.
- Fester Grenzsteuersatz; Renovierung wird komplett der AfA-Basis zugeschlagen; Instandhaltung sofort absetzbar.
- Der Marktwert startet beim Kaufpreis, Renovierung erhöht ihn nicht.
- Alle Werte nominal, keine Schwankungen der Alternativanlage, kein Sparerpauschbetrag.
- Keine Steuer- oder Finanzberatung.

## Entwicklung

Keine Laufzeit-Abhängigkeiten: TypeScript, eigene SVG-Diagramme, Tests mit dem eingebauten Node-Testrunner. Benötigt Node ≥ 22.18.

```bash
npm install      # nur TypeScript
npm run dev      # baut bei Änderungen neu, http://localhost:5173
npm test         # Tests des Rechenkerns
npm run build    # statische Seite nach dist/
```

| Datei | Inhalt |
|---|---|
| `src/engine.ts` | Rechenkern: Simulation, IRR, Break-even, Sensitivität |
| `src/fields.ts` | Alle Eingabefelder mit Einheiten und Erklärungen |
| `src/presets.ts` | Beispielwerte, Grunderwerbsteuer je Bundesland |
| `src/charts.ts` | Linien-, Balken- und Sensitivitätsdiagramm |
| `src/main.ts` | Oberfläche, URL-Zustand |
| `tests/engine.test.ts` | Tests gegen Handrechnungen und Formeln |

Jeder Push auf `main` testet, baut und veröffentlicht die Seite über GitHub Pages (`.github/workflows/deploy.yml`).
