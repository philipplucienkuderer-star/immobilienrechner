/**
 * Rechenkern des Immobilienrechners.
 *
 * Grundidee: Zwei Szenarien starten mit demselben Geld.
 *  - "Kaufen": Eigenkapital fließt in die Immobilie. Monatliche Überschüsse
 *    (positiver Cashflow) werden in eine Alternativanlage reinvestiert.
 *  - "Alternative": Das Eigenkapital wird stattdessen angelegt (z. B. ETF).
 *    Muss der Käufer monatlich zuschießen (negativer Cashflow), legt das
 *    Alternativ-Szenario genau diesen Betrag ebenfalls an.
 * Damit fließt in beiden Welten zu jedem Zeitpunkt gleich viel eigenes Geld
 * hinein, und das Endvermögen ist direkt vergleichbar.
 *
 * Alle Prozent-Parameter werden als Prozentzahl übergeben (4 = 4 %).
 */

export type Mode = "vermietung" | "eigennutzung";

export interface Params {
  mode: Mode;
  // Objekt & Kauf
  kaufpreis: number;
  wohnflaeche: number;
  grunderwerbsteuer: number;
  notar: number;
  makler: number;
  renovierung: number;
  eigenkapital: number;
  // Finanzierung
  zins: number;
  tilgung: number;
  zinsbindung: number;
  anschlusszins: number;
  sondertilgung: number;
  // Miete / Nutzung
  kaltmiete: number;
  vergleichsmiete: number;
  mietsteigerung: number;
  leerstand: number;
  nichtUmlagefaehig: number;
  instandhaltung: number;
  // Steuern (nur Vermietung)
  grenzsteuersatz: number;
  gebaeudeanteil: number;
  afaSatz: number;
  // Markt & Vergleich
  wertsteigerung: number;
  kostensteigerung: number;
  horizont: number;
  verkaufskosten: number;
  alternativeRendite: number;
  kapitalertragsteuer: number;
}

export interface YearRow {
  jahr: number;
  einnahmen: number;
  kosten: number;
  zinsen: number;
  tilgung: number;
  afa: number;
  steuer: number;
  cashflowVorSteuer: number;
  cashflowNachSteuer: number;
  restschuld: number;
  immobilienwert: number;
  vermoegenKauf: number;
  vermoegenAlternative: number;
}

export interface Result {
  nebenkosten: number;
  gesamtkosten: number;
  eigenkapitalEingesetzt: number;
  eigenkapitalUeberschuss: number;
  darlehen: number;
  monatsrate: number;
  monatsrateAnschluss: number;
  restschuldZinsbindung: number;
  schuldenfreiNachJahren: number | null;
  bruttomietrendite: number;
  nettomietrendite: number;
  kaufpreisfaktor: number;
  cashflowMonat1VorSteuer: number;
  cashflowMonat1NachSteuer: number;
  beleihungsauslauf: number;
  rows: YearRow[];
  endVermoegenKauf: number;
  endVermoegenAlternative: number;
  differenz: number;
  eigenkapitalrendite: number | null;
  breakEvenJahr: number | null;
  spekulationssteuer: number;
  warnungen: string[];
}

const pct = (v: number) => v / 100;

/** Monatlicher Zinssatz, der aufs Jahr gerechnet dem effektiven Jahreszins entspricht. */
function monthlyFromAnnual(annualPct: number): number {
  return Math.pow(1 + pct(annualPct), 1 / 12) - 1;
}

/** Steuer auf realisierte Gewinne einer Alternativanlage (vereinfachend am Ende). */
function nachSteuer(wert: number, einzahlungen: number, steuersatzPct: number): number {
  const gewinn = wert - einzahlungen;
  return gewinn > 0 ? wert - gewinn * pct(steuersatzPct) : wert;
}

interface LoanState {
  rest: number;
  rate: number;
}

/**
 * Ein Monat Annuitätendarlehen. Nach Ende der Zinsbindung bleibt die
 * Monatsrate gleich, wird aber mindestens so angehoben, dass 1 % p. a.
 * getilgt wird (sonst würde ein höherer Anschlusszins die Tilgung auffressen).
 */
function loanMonth(
  s: LoanState,
  monat: number,
  p: Params,
): { zinsen: number; tilgung: number } {
  if (s.rest <= 0.005) {
    s.rest = 0;
    return { zinsen: 0, tilgung: 0 };
  }
  const inBindung = monat <= p.zinsbindung * 12;
  const zinssatz = inBindung ? p.zins : p.anschlusszins;
  if (monat === p.zinsbindung * 12 + 1) {
    const minRate = (s.rest * (pct(p.anschlusszins) + 0.01)) / 12;
    if (s.rate < minRate) s.rate = minRate;
  }
  const zinsen = (s.rest * pct(zinssatz)) / 12;
  let tilgung = Math.min(Math.max(s.rate - zinsen, 0), s.rest);
  s.rest -= tilgung;
  // Sondertilgung einmal jährlich am Jahresende
  if (monat % 12 === 0 && p.sondertilgung > 0 && s.rest > 0) {
    const st = Math.min(p.sondertilgung, s.rest);
    s.rest -= st;
    tilgung += st;
  }
  return { zinsen, tilgung };
}

export function simulate(p: Params): Result {
  const warnungen: string[] = [];
  const vermietung = p.mode === "vermietung";
  const jahre = Math.max(1, Math.round(p.horizont));
  const monate = jahre * 12;

  const nebenkosten = p.kaufpreis * pct(p.grunderwerbsteuer + p.notar + p.makler);
  const gesamtkosten = p.kaufpreis + nebenkosten + p.renovierung;
  const eigenkapitalEingesetzt = Math.min(Math.max(p.eigenkapital, 0), gesamtkosten);
  const eigenkapitalUeberschuss = Math.max(p.eigenkapital - gesamtkosten, 0);
  const darlehen = gesamtkosten - eigenkapitalEingesetzt;
  const beleihungsauslauf = p.kaufpreis > 0 ? darlehen / p.kaufpreis : 0;

  if (eigenkapitalUeberschuss > 0) {
    warnungen.push(
      "Das Eigenkapital übersteigt die Gesamtkosten. Der Überschuss wird in beiden Szenarien gleich behandelt und nicht verglichen.",
    );
  }
  if (eigenkapitalEingesetzt < nebenkosten && darlehen > 0) {
    warnungen.push(
      "Das Eigenkapital deckt nicht einmal die Kaufnebenkosten. Banken finanzieren das nur selten und mit deutlichem Zinsaufschlag.",
    );
  }
  if (beleihungsauslauf > 1) {
    warnungen.push(
      `Das Darlehen liegt bei ${Math.round(beleihungsauslauf * 100)} % des Kaufpreises. Rechne mit einem höheren Zins als bei 60–80 % Beleihung.`,
    );
  }

  const monatsrate = (darlehen * pct(p.zins + p.tilgung)) / 12;
  const loan: LoanState = { rest: darlehen, rate: monatsrate };

  // Steuerliche Abschreibung (nur Vermietung). Renovierung wird vereinfachend
  // als anschaffungsnaher Herstellungsaufwand der AfA-Basis zugeschlagen.
  const anschaffungskosten = p.kaufpreis + nebenkosten + p.renovierung;
  const afaBasis = (p.kaufpreis + nebenkosten) * pct(p.gebaeudeanteil) + p.renovierung;
  const afaJahr = afaBasis * pct(p.afaSatz);
  let afaRest = afaBasis;
  let afaKumuliert = 0;

  const rAlt = monthlyFromAnnual(p.alternativeRendite);
  let depotKauf = 0;
  let einzahlungKauf = 0;
  let depotAlt = eigenkapitalEingesetzt;
  let einzahlungAlt = eigenkapitalEingesetzt;

  const flows: number[] = new Array(monate + 1).fill(0);
  flows[0] = -eigenkapitalEingesetzt;

  const rows: YearRow[] = [];
  let y = initYear();
  let monatsrateAnschluss = monatsrate;
  let restschuldZinsbindung = darlehen;
  let cfM1Vor = 0;
  let cfM1Nach = 0;
  let spekulationssteuerEnde = 0;
  let breakEvenJahr: number | null = null;

  function initYear() {
    return { einnahmen: 0, kosten: 0, zinsen: 0, tilgung: 0, afa: 0, steuer: 0, cfVor: 0, cfNach: 0 };
  }

  for (let m = 1; m <= monate; m++) {
    const jahr = Math.ceil(m / 12);
    const mietIndex = Math.pow(1 + pct(p.mietsteigerung), jahr - 1);
    const kostenIndex = Math.pow(1 + pct(p.kostensteigerung), jahr - 1);

    const einnahmen = vermietung
      ? p.kaltmiete * mietIndex * (1 - pct(p.leerstand))
      : p.vergleichsmiete * mietIndex; // ersparte Miete
    const kosten = ((p.nichtUmlagefaehig * 12 + p.instandhaltung * p.wohnflaeche) * kostenIndex) / 12;

    const { zinsen, tilgung } = loanMonth(loan, m, p);
    if (m === p.zinsbindung * 12) restschuldZinsbindung = loan.rest;
    if (m === p.zinsbindung * 12 + 1) monatsrateAnschluss = loan.rate;

    let afa = 0;
    let steuer = 0;
    if (vermietung) {
      afa = Math.min(afaJahr / 12, afaRest);
      afaRest -= afa;
      afaKumuliert += afa;
      const zuVersteuern = einnahmen - kosten - zinsen - afa;
      steuer = zuVersteuern * pct(p.grenzsteuersatz); // negativ = Erstattung
    }

    const cfVor = einnahmen - kosten - zinsen - tilgung;
    const cfNach = cfVor - steuer;
    if (m === 1) {
      cfM1Vor = cfVor;
      cfM1Nach = cfNach;
    }
    flows[m] = cfNach;

    depotKauf *= 1 + rAlt;
    depotAlt *= 1 + rAlt;
    if (cfNach >= 0) {
      depotKauf += cfNach;
      einzahlungKauf += cfNach;
    } else {
      depotAlt += -cfNach;
      einzahlungAlt += -cfNach;
    }

    y.einnahmen += einnahmen;
    y.kosten += kosten;
    y.zinsen += zinsen;
    y.tilgung += tilgung;
    y.afa += afa;
    y.steuer += steuer;
    y.cfVor += cfVor;
    y.cfNach += cfNach;

    if (m % 12 === 0) {
      const wert = p.kaufpreis * Math.pow(1 + pct(p.wertsteigerung), jahr);
      const verkauf = wert * pct(p.verkaufskosten);
      let spek = 0;
      if (vermietung && jahr < 10) {
        const gewinn = wert - verkauf - (anschaffungskosten - afaKumuliert);
        spek = Math.max(gewinn, 0) * pct(p.grenzsteuersatz);
      }
      const nettoVerkauf = wert - verkauf - loan.rest - spek;
      const vermoegenKauf = nettoVerkauf + nachSteuer(depotKauf, einzahlungKauf, p.kapitalertragsteuer);
      const vermoegenAlternative = nachSteuer(depotAlt, einzahlungAlt, p.kapitalertragsteuer);

      if (vermoegenKauf >= vermoegenAlternative) {
        if (breakEvenJahr === null) breakEvenJahr = jahr;
      } else {
        breakEvenJahr = null;
      }

      rows.push({
        jahr,
        einnahmen: y.einnahmen,
        kosten: y.kosten,
        zinsen: y.zinsen,
        tilgung: y.tilgung,
        afa: y.afa,
        steuer: y.steuer,
        cashflowVorSteuer: y.cfVor,
        cashflowNachSteuer: y.cfNach,
        restschuld: loan.rest,
        immobilienwert: wert,
        vermoegenKauf,
        vermoegenAlternative,
      });
      if (m === monate) {
        flows[m] += nettoVerkauf;
        spekulationssteuerEnde = spek;
      }
      y = initYear();
    }
  }

  if (p.zinsbindung >= jahre) {
    restschuldZinsbindung = restschuldNach(p, darlehen, monatsrate, p.zinsbindung * 12);
  }

  const last = rows[rows.length - 1];
  const kaltmieteJahr = p.kaltmiete * 12;
  const kostenJahr1 = p.nichtUmlagefaehig * 12 + p.instandhaltung * p.wohnflaeche;

  if (vermietung && jahre < 10) {
    warnungen.push(
      "Verkauf innerhalb von 10 Jahren: Der Gewinn ist als privates Veräußerungsgeschäft steuerpflichtig und wurde abgezogen.",
    );
  }

  return {
    nebenkosten,
    gesamtkosten,
    eigenkapitalEingesetzt,
    eigenkapitalUeberschuss,
    darlehen,
    monatsrate,
    monatsrateAnschluss,
    restschuldZinsbindung,
    schuldenfreiNachJahren: schuldenfrei(p, darlehen, monatsrate),
    bruttomietrendite: p.kaufpreis > 0 ? kaltmieteJahr / p.kaufpreis : 0,
    nettomietrendite:
      gesamtkosten > 0 ? (kaltmieteJahr * (1 - pct(p.leerstand)) - kostenJahr1) / gesamtkosten : 0,
    kaufpreisfaktor: kaltmieteJahr > 0 ? p.kaufpreis / kaltmieteJahr : Infinity,
    cashflowMonat1VorSteuer: cfM1Vor,
    cashflowMonat1NachSteuer: cfM1Nach,
    beleihungsauslauf,
    rows,
    endVermoegenKauf: last.vermoegenKauf,
    endVermoegenAlternative: last.vermoegenAlternative,
    differenz: last.vermoegenKauf - last.vermoegenAlternative,
    eigenkapitalrendite: irr(flows),
    breakEvenJahr,
    spekulationssteuer: spekulationssteuerEnde,
    warnungen,
  };
}

function restschuldNach(p: Params, darlehen: number, rate: number, monate: number): number {
  const s: LoanState = { rest: darlehen, rate };
  for (let m = 1; m <= monate; m++) loanMonth(s, m, p);
  return s.rest;
}

function schuldenfrei(p: Params, darlehen: number, rate: number): number | null {
  if (darlehen <= 0) return 0;
  const s: LoanState = { rest: darlehen, rate };
  for (let m = 1; m <= 100 * 12; m++) {
    loanMonth(s, m, p);
    if (s.rest <= 0.005) return m / 12;
  }
  return null;
}

/** Interner Zinsfuß monatlicher Zahlungen, annualisiert. null wenn nicht bestimmbar. */
export function irr(flows: number[]): number | null {
  if (flows.length < 2 || flows[0] >= 0) return null;
  const npv = (annual: number) => {
    const r = Math.pow(1 + annual, 1 / 12) - 1;
    let v = 0;
    let d = 1;
    for (let i = 0; i < flows.length; i++) {
      v += flows[i] / d;
      d *= 1 + r;
    }
    return v;
  };
  let lo = -0.99;
  let hi = 5;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!isFinite(fLo) || Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

/**
 * Sucht den Wert eines Parameters, bei dem Kaufen und Alternative gleichauf
 * liegen (Differenz = 0). Setzt voraus, dass die Differenz in diesem
 * Parameter monoton ist (gilt für Wertsteigerung und Miete).
 */
export function breakEven(p: Params, key: keyof Params, lo: number, hi: number): number | null {
  const diff = (v: number) => simulate({ ...p, [key]: v }).differenz;
  let fLo = diff(lo);
  const fHi = diff(hi);
  if (Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fMid = diff(mid);
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export interface Sensitivity {
  label: string;
  lowLabel: string;
  highLabel: string;
  low: number;
  high: number;
}

/** Wie stark verschiebt sich die Vermögensdifferenz, wenn eine Annahme danebenliegt? */
export function sensitivity(p: Params): { basis: number; items: Sensitivity[] } {
  const basis = simulate(p).differenz;
  const run = (patch: Partial<Params>) => simulate({ ...p, ...patch }).differenz;
  const pp = (v: number) => `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
  const miete = p.mode === "vermietung" ? "kaltmiete" : "vergleichsmiete";
  const mietLabel = p.mode === "vermietung" ? "Kaltmiete" : "Vergleichsmiete";

  const items: Sensitivity[] = [
    {
      label: "Wertsteigerung",
      lowLabel: pp(p.wertsteigerung - 1),
      highLabel: pp(p.wertsteigerung + 1),
      low: run({ wertsteigerung: p.wertsteigerung - 1 }),
      high: run({ wertsteigerung: p.wertsteigerung + 1 }),
    },
    {
      label: "Rendite Alternativanlage",
      lowLabel: pp(p.alternativeRendite - 2),
      highLabel: pp(p.alternativeRendite + 2),
      low: run({ alternativeRendite: p.alternativeRendite - 2 }),
      high: run({ alternativeRendite: p.alternativeRendite + 2 }),
    },
    {
      label: "Sollzins",
      lowLabel: pp(p.zins - 1),
      highLabel: pp(p.zins + 1),
      low: run({ zins: Math.max(p.zins - 1, 0) }),
      high: run({ zins: p.zins + 1 }),
    },
    {
      label: "Anschlusszins",
      lowLabel: pp(p.anschlusszins - 2),
      highLabel: pp(p.anschlusszins + 2),
      low: run({ anschlusszins: Math.max(p.anschlusszins - 2, 0) }),
      high: run({ anschlusszins: p.anschlusszins + 2 }),
    },
    {
      label: mietLabel,
      lowLabel: "−10 %",
      highLabel: "+10 %",
      low: run({ [miete]: p[miete] * 0.9 }),
      high: run({ [miete]: p[miete] * 1.1 }),
    },
    {
      label: "Mietsteigerung",
      lowLabel: pp(p.mietsteigerung - 1),
      highLabel: pp(p.mietsteigerung + 1),
      low: run({ mietsteigerung: p.mietsteigerung - 1 }),
      high: run({ mietsteigerung: p.mietsteigerung + 1 }),
    },
    {
      label: "Kaufpreis",
      lowLabel: "−10 %",
      highLabel: "+10 %",
      low: run({ kaufpreis: p.kaufpreis * 0.9 }),
      high: run({ kaufpreis: p.kaufpreis * 1.1 }),
    },
    {
      label: "Instandhaltung",
      lowLabel: "−50 %",
      highLabel: "+50 %",
      low: run({ instandhaltung: p.instandhaltung * 0.5 }),
      high: run({ instandhaltung: p.instandhaltung * 1.5 }),
    },
  ];
  items.sort(
    (a, b) =>
      Math.max(Math.abs(b.low - basis), Math.abs(b.high - basis)) -
      Math.max(Math.abs(a.low - basis), Math.abs(a.high - basis)),
  );
  return { basis, items };
}
