import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, irr, breakEven, type Params } from "../src/engine.ts";
import { PRESETS } from "../src/presets.ts";

const near = (a: number, b: number, tol = 0.01, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} ≉ ${b} (±${tol})`);

/** Neutrales Szenario: keine Nebenkosten, keine Steuern, kein Wachstum. */
const neutral: Params = {
  mode: "eigennutzung",
  kaufpreis: 100_000,
  wohnflaeche: 50,
  grunderwerbsteuer: 0,
  notar: 0,
  makler: 0,
  renovierung: 0,
  eigenkapital: 100_000,
  zins: 0,
  tilgung: 2,
  zinsbindung: 10,
  anschlusszins: 0,
  sondertilgung: 0,
  kaltmiete: 0,
  vergleichsmiete: 500,
  mietsteigerung: 0,
  leerstand: 0,
  nichtUmlagefaehig: 0,
  instandhaltung: 0,
  grenzsteuersatz: 0,
  gebaeudeanteil: 80,
  afaSatz: 2,
  wertsteigerung: 0,
  kostensteigerung: 0,
  horizont: 10,
  verkaufskosten: 0,
  alternativeRendite: 0,
  kapitalertragsteuer: 0,
};

test("Kaufnebenkosten und Darlehenssumme", () => {
  const r = simulate({
    ...neutral,
    kaufpreis: 300_000,
    grunderwerbsteuer: 5,
    notar: 2,
    makler: 3.57,
    eigenkapital: 81_710,
    zins: 4,
    tilgung: 2,
  });
  near(r.nebenkosten, 31_710);
  near(r.darlehen, 250_000);
  near(r.monatsrate, 1_250); // 250.000 × 6 % / 12
});

test("Restschuld nach Zinsbindung entspricht der Annuitätenformel", () => {
  const L = 250_000;
  const i = 0.04 / 12;
  const n = 120;
  const A = (L * 0.06) / 12;
  const erwartet = L * Math.pow(1 + i, n) - (A * (Math.pow(1 + i, n) - 1)) / i;
  const r = simulate({
    ...neutral,
    kaufpreis: 250_000,
    eigenkapital: 0,
    zins: 4,
    tilgung: 2,
    anschlusszins: 4,
    horizont: 15,
  });
  near(r.restschuldZinsbindung, erwartet, 0.05);
});

test("Ohne Kredit und Rendite: Vorteil Kaufen = ersparte Miete", () => {
  const r = simulate(neutral);
  near(r.endVermoegenKauf, 160_000); // Haus 100k + 120 × 500 € angelegt
  near(r.endVermoegenAlternative, 100_000);
  near(r.differenz, 60_000);
  assert.equal(r.breakEvenJahr, 1);
});

test("Beide Szenarien bekommen gleich viel eigenes Geld", () => {
  // Kaufen kostet jeden Monat 1.000 € mehr als Mieten -> Alternative legt genau das an.
  const r = simulate({ ...neutral, vergleichsmiete: 0, nichtUmlagefaehig: 1_000 });
  near(r.endVermoegenAlternative, 100_000 + 120 * 1_000);
  near(r.endVermoegenKauf, 100_000);
});

test("IRR einfacher Zahlungsstrom", () => {
  const flows = new Array(13).fill(0);
  flows[0] = -100;
  flows[12] = 110;
  near(irr(flows)!, 0.1, 1e-6);
  assert.equal(irr([0, 10]), null);
});

test("Spekulationssteuer nur bei Vermietung und unter 10 Jahren", () => {
  const basis: Params = {
    ...neutral,
    mode: "vermietung",
    kaltmiete: 400,
    wertsteigerung: 5,
    grenzsteuersatz: 42,
  };
  assert.ok(simulate({ ...basis, horizont: 5 }).spekulationssteuer > 0);
  assert.equal(simulate({ ...basis, horizont: 10 }).spekulationssteuer, 0);
  assert.equal(simulate({ ...basis, mode: "eigennutzung", horizont: 5 }).spekulationssteuer, 0);
});

test("AfA senkt die Steuerlast bei Vermietung", () => {
  const ohne = simulate({ ...neutral, mode: "vermietung", kaltmiete: 500, grenzsteuersatz: 42, afaSatz: 0 });
  const mit = simulate({ ...neutral, mode: "vermietung", kaltmiete: 500, grenzsteuersatz: 42, afaSatz: 2 });
  // AfA 2 % von 80.000 = 1.600 €/Jahr -> 672 € weniger Steuer pro Jahr
  near(ohne.rows[0].steuer - mit.rows[0].steuer, 672, 0.5);
});

test("Anschlussrate tilgt mindestens 1 %", () => {
  const r = simulate({
    ...neutral,
    eigenkapital: 0,
    zins: 1,
    tilgung: 1,
    anschlusszins: 6,
    horizont: 20,
  });
  assert.ok(r.monatsrateAnschluss >= (r.restschuldZinsbindung * 0.07) / 12 - 0.01);
  assert.ok(r.schuldenfreiNachJahren !== null);
});

test("Break-even-Wertsteigerung macht die Differenz null", () => {
  const p = PRESETS.kapitalanlage.params;
  const g = breakEven(p, "wertsteigerung", -10, 15);
  assert.ok(g !== null);
  near(simulate({ ...p, wertsteigerung: g! }).differenz, 0, 1);
});

test("Presets laufen ohne NaN durch", () => {
  for (const preset of Object.values(PRESETS)) {
    const r = simulate(preset.params);
    for (const row of r.rows) {
      for (const v of Object.values(row)) assert.ok(Number.isFinite(v), `${preset.name}: ${v}`);
    }
  }
});
