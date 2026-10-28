import type { Mode, Params } from "./engine.ts";

export interface Field {
  key: Exclude<keyof Params, "mode">;
  label: string;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  help: string;
  /** Nur in diesem Modus anzeigen. */
  only?: Mode;
}

export interface Group {
  id: string;
  title: string;
  fields: Field[];
  only?: Mode;
}

export const GROUPS: Group[] = [
  {
    id: "kauf",
    title: "Objekt und Kauf",
    fields: [
      { key: "kaufpreis", label: "Kaufpreis", unit: "€", step: 5000, min: 0, help: "Reiner Kaufpreis laut Notarvertrag, ohne Nebenkosten." },
      { key: "wohnflaeche", label: "Wohnfläche", unit: "m²", step: 1, min: 1, help: "Wird für die Instandhaltungskosten und den Preis pro m² gebraucht." },
      { key: "grunderwerbsteuer", label: "Grunderwerbsteuer", unit: "%", step: 0.5, min: 0, max: 10, help: "Je nach Bundesland 3,5 bis 6,5 % des Kaufpreises. Über die Auswahl darüber setzen oder direkt eintragen." },
      { key: "notar", label: "Notar und Grundbuch", unit: "%", step: 0.1, min: 0, max: 5, help: "Üblich sind etwa 1,5 bis 2 % des Kaufpreises." },
      { key: "makler", label: "Maklerprovision", unit: "%", step: 0.01, min: 0, max: 10, help: "Käuferanteil inkl. MwSt. Bei Wohnungen und Einfamilienhäusern teilen sich Käufer und Verkäufer die Provision meist hälftig, oft 3,57 %. 0, wenn ohne Makler." },
      { key: "renovierung", label: "Renovierung", unit: "€", step: 1000, min: 0, help: "Einmalige Kosten direkt nach dem Kauf. Erhöht im Modell nicht den Marktwert, wird bei Vermietung aber abgeschrieben." },
      { key: "eigenkapital", label: "Eigenkapital", unit: "€", step: 5000, min: 0, help: "Was du selbst einbringst. Es deckt zuerst die Nebenkosten, der Rest mindert den Kredit. Im Vergleich wird genau dieser Betrag alternativ angelegt." },
    ],
  },
  {
    id: "finanzierung",
    title: "Finanzierung",
    fields: [
      { key: "zins", label: "Sollzins", unit: "% p. a.", step: 0.05, min: 0, max: 15, help: "Nominaler Zins während der Zinsbindung. Ende Oktober 2026 lagen 10 Jahre Zinsbindung je nach Beleihung grob bei 4 bis 5 %." },
      { key: "tilgung", label: "Anfängliche Tilgung", unit: "% p. a.", step: 0.25, min: 0, max: 15, help: "Zins + Tilgung ergeben die feste Monatsrate. Mehr Tilgung heißt höhere Rate, aber schneller schuldenfrei und weniger Zinsänderungsrisiko." },
      { key: "zinsbindung", label: "Zinsbindung", unit: "Jahre", step: 1, min: 1, max: 40, help: "So lange ist der Sollzins fest. Danach gilt der Anschlusszins." },
      { key: "anschlusszins", label: "Anschlusszins", unit: "% p. a.", step: 0.25, min: 0, max: 15, help: "Annahme für die Zeit nach der Zinsbindung. Niemand kennt ihn heute – spiel hier mit Werten, die dir Bauchschmerzen machen. Die Rate bleibt gleich, steigt aber mindestens so weit, dass 1 % getilgt wird." },
      { key: "sondertilgung", label: "Sondertilgung", unit: "€/Jahr", step: 500, min: 0, help: "Zusätzliche Tilgung jeweils am Jahresende. Viele Banken erlauben 5 % der Darlehenssumme pro Jahr." },
    ],
  },
  {
    id: "miete",
    title: "Miete und laufende Kosten",
    fields: [
      { key: "kaltmiete", label: "Kaltmiete", unit: "€/Monat", step: 10, min: 0, only: "vermietung", help: "Nettokaltmiete, die du bekommst. Umlagefähige Nebenkosten zahlt der Mieter und kommen hier nicht vor." },
      { key: "vergleichsmiete", label: "Miete, die du sparst", unit: "€/Monat", step: 10, min: 0, only: "eigennutzung", help: "Kaltmiete für eine vergleichbare Wohnung, die du sonst zahlen würdest. Nebenkosten fallen in beiden Fällen an und heben sich auf." },
      { key: "mietsteigerung", label: "Mietsteigerung", unit: "% p. a.", step: 0.25, min: -5, max: 10, help: "Jährliche Steigerung der Miete. Bei Mietspiegel und Kappungsgrenze in der Praxis oft 1,5 bis 2,5 %." },
      { key: "leerstand", label: "Leerstand und Mietausfall", unit: "%", step: 0.5, min: 0, max: 50, only: "vermietung", help: "Anteil der Jahresmiete, der durch Leerstand, Mieterwechsel oder Ausfälle fehlt. 2 bis 4 % ist eine übliche Reserve." },
      { key: "nichtUmlagefaehig", label: "Nicht umlagefähige Kosten", unit: "€/Monat", step: 5, min: 0, help: "Kosten, die du als Eigentümer selbst trägst, etwa WEG-Verwaltung, Kontoführung, Sondereigentumsverwaltung. Ohne Instandhaltung." },
      { key: "instandhaltung", label: "Instandhaltung", unit: "€/m² im Jahr", step: 1, min: 0, help: "Rücklage für Reparaturen und Modernisierung. Neubau etwa 7 bis 10 €, ältere Gebäude 12 bis 20 € pro m² und Jahr. Wird oft unterschätzt." },
      { key: "kostensteigerung", label: "Kostensteigerung", unit: "% p. a.", step: 0.25, min: -5, max: 15, help: "Jährliche Steigerung der laufenden Kosten, grob die Inflation." },
    ],
  },
  {
    id: "steuern",
    title: "Steuern bei Vermietung",
    only: "vermietung",
    fields: [
      { key: "grenzsteuersatz", label: "Grenzsteuersatz", unit: "%", step: 1, min: 0, max: 50, help: "Dein persönlicher Steuersatz auf zusätzliches Einkommen, inkl. Soli und ggf. Kirchensteuer. Verluste aus Vermietung senken deine Steuer zu diesem Satz." },
      { key: "gebaeudeanteil", label: "Gebäudeanteil", unit: "%", step: 5, min: 0, max: 100, help: "Nur das Gebäude wird abgeschrieben, nicht der Boden. In Städten oft 60 bis 80 %, steht im Gutachten oder lässt sich mit der Arbeitshilfe des BMF schätzen." },
      { key: "afaSatz", label: "Abschreibung (AfA)", unit: "% p. a.", step: 0.5, min: 0, max: 10, help: "Lineare AfA: 2 % für Gebäude ab 1925, 2,5 % vor 1925, 3 % für Neubauten ab 2023." },
    ],
  },
  {
    id: "markt",
    title: "Markt und Vergleich",
    fields: [
      { key: "wertsteigerung", label: "Wertsteigerung", unit: "% p. a.", step: 0.25, min: -10, max: 15, help: "Jährliche Veränderung des Marktwerts. Langfristig lagen Immobilienpreise in Deutschland grob im Bereich der Inflation, regional sehr unterschiedlich. Der Wert mit dem größten Einfluss auf das Ergebnis." },
      { key: "horizont", label: "Betrachtungszeitraum", unit: "Jahre", step: 1, min: 1, max: 50, help: "Nach so vielen Jahren wird verglichen, als würdest du verkaufen." },
      { key: "verkaufskosten", label: "Verkaufskosten", unit: "%", step: 0.5, min: 0, max: 15, help: "Makler, Notar und sonstiges beim Verkauf am Ende. Auch wenn du nicht verkaufen willst: Erst so wird der Wert vergleichbar." },
      { key: "alternativeRendite", label: "Rendite Alternativanlage", unit: "% p. a.", step: 0.25, min: -5, max: 15, help: "Was das Geld sonst bringen würde, z. B. ein breiter Aktien-ETF (historisch langfristig etwa 6 bis 8 % nominal, mit starken Schwankungen) oder Tagesgeld." },
      { key: "kapitalertragsteuer", label: "Steuer auf Kapitalerträge", unit: "%", step: 0.5, min: 0, max: 50, help: "Effektiv auf Gewinne der Alternativanlage, am Ende fällig. Aktien-ETF mit 30 % Teilfreistellung: etwa 18,5 %. Ohne Teilfreistellung 26,4 %." },
    ],
  },
];
