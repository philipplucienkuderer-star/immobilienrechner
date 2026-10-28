import type { Params } from "./engine.ts";

/** Grunderwerbsteuer je Bundesland in Prozent (Stand: Oktober 2026). */
export const BUNDESLAENDER: { name: string; satz: number }[] = [
  { name: "Baden-Württemberg", satz: 5.0 },
  { name: "Bayern", satz: 3.5 },
  { name: "Berlin", satz: 6.0 },
  { name: "Brandenburg", satz: 6.5 },
  { name: "Bremen", satz: 5.5 },
  { name: "Hamburg", satz: 5.5 },
  { name: "Hessen", satz: 6.0 },
  { name: "Mecklenburg-Vorpommern", satz: 6.0 },
  { name: "Niedersachsen", satz: 5.0 },
  { name: "Nordrhein-Westfalen", satz: 6.5 },
  { name: "Rheinland-Pfalz", satz: 5.0 },
  { name: "Saarland", satz: 6.5 },
  { name: "Sachsen", satz: 5.5 },
  { name: "Sachsen-Anhalt", satz: 5.0 },
  { name: "Schleswig-Holstein", satz: 6.5 },
  { name: "Thüringen", satz: 5.0 },
];

const gemeinsam = {
  grunderwerbsteuer: 5.0,
  notar: 2.0,
  makler: 3.57,
  zins: 4.0,
  tilgung: 2.0,
  zinsbindung: 10,
  anschlusszins: 4.5,
  sondertilgung: 0,
  mietsteigerung: 2.0,
  kostensteigerung: 2.0,
  wertsteigerung: 2.0,
  verkaufskosten: 4.0,
  alternativeRendite: 6.0,
  kapitalertragsteuer: 18.5,
  grenzsteuersatz: 42,
  gebaeudeanteil: 75,
  afaSatz: 2.0,
} satisfies Partial<Params>;

export const PRESETS: Record<string, { name: string; params: Params }> = {
  kapitalanlage: {
    name: "Vermietete Wohnung",
    params: {
      ...gemeinsam,
      mode: "vermietung",
      kaufpreis: 260_000,
      wohnflaeche: 62,
      renovierung: 0,
      eigenkapital: 60_000,
      kaltmiete: 850,
      vergleichsmiete: 850,
      leerstand: 3,
      nichtUmlagefaehig: 35,
      instandhaltung: 12,
      horizont: 20,
    },
  },
  eigenheim: {
    name: "Selbst bewohntes Haus",
    params: {
      ...gemeinsam,
      mode: "eigennutzung",
      kaufpreis: 480_000,
      wohnflaeche: 130,
      renovierung: 20_000,
      eigenkapital: 110_000,
      kaltmiete: 1_700,
      vergleichsmiete: 1_700,
      leerstand: 0,
      nichtUmlagefaehig: 20,
      instandhaltung: 15,
      horizont: 25,
    },
  },
};

export const DEFAULT_PRESET = "kapitalanlage";
