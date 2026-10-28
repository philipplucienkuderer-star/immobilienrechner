import { simulate, breakEven, sensitivity, type Params, type Mode, type Result } from "./engine.ts";
import { GROUPS, type Field } from "./fields.ts";
import { PRESETS, DEFAULT_PRESET, BUNDESLAENDER } from "./presets.ts";
import { lineChart, barChart, tornado } from "./charts.ts";
import { eur, eurSigned, eurShort, percent, number, jahre } from "./format.ts";

const STORAGE_KEY = "immobilienrechner:v1";
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

let presetKey = DEFAULT_PRESET;
let params: Params = loadInitial();

// ---------- Zustand laden / speichern ----------

function loadInitial(): Params {
  const base = { ...PRESETS[DEFAULT_PRESET].params };
  const fromHash = parseHash(base);
  if (fromHash) return fromHash;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.preset && PRESETS[saved.preset]) presetKey = saved.preset;
      return sanitize({ ...PRESETS[presetKey].params, ...saved.params });
    }
  } catch {
    /* Speicher nicht verfügbar – Standardwerte nutzen */
  }
  return base;
}

function sanitize(p: Params): Params {
  const out = { ...p };
  out.mode = p.mode === "eigennutzung" ? "eigennutzung" : "vermietung";
  for (const g of GROUPS) for (const f of g.fields) {
    const v = Number(out[f.key]);
    (out[f.key] as number) = Number.isFinite(v) ? v : PRESETS[DEFAULT_PRESET].params[f.key];
  }
  return out;
}

function parseHash(base: Params): Params | null {
  if (!location.hash.startsWith("#")) return null;
  const q = new URLSearchParams(location.hash.slice(1));
  if (![...q.keys()].length) return null;
  const p: Params = { ...base };
  for (const [k, v] of q) {
    if (k === "mode") p.mode = v as Mode;
    else if (k in p) (p as unknown as Record<string, number>)[k] = Number(v);
  }
  return sanitize(p);
}

function persist() {
  const q = new URLSearchParams();
  q.set("mode", params.mode);
  for (const g of GROUPS) for (const f of g.fields) q.set(f.key, String(params[f.key]));
  history.replaceState(null, "", `#${q.toString()}`);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: presetKey, params }));
  } catch {
    /* ignorieren */
  }
}

// ---------- Eingaben ----------

function fieldId(f: Field) {
  return `f-${f.key}`;
}

function buildInputs() {
  const host = $("#inputs");
  host.innerHTML = "";
  for (const g of GROUPS) {
    const sec = document.createElement("details");
    sec.className = "group";
    sec.open = true;
    sec.dataset.only = g.only ?? "";
    sec.innerHTML = `<summary><h2>${g.title}</h2></summary>`;
    const body = document.createElement("div");
    body.className = "group-body";

    if (g.id === "kauf") {
      const row = document.createElement("div");
      row.className = "field";
      row.innerHTML = `
        <label for="bundesland">Bundesland</label>
        <select id="bundesland">
          <option value="">Eigener Wert</option>
          ${BUNDESLAENDER.map((b) => `<option value="${b.satz}" data-name="${b.name}">${b.name} · ${number(b.satz)} %</option>`).join("")}
        </select>`;
      body.appendChild(row);
    }

    for (const f of g.fields) {
      const row = document.createElement("div");
      row.className = "field";
      row.dataset.only = f.only ?? "";
      const id = fieldId(f);
      row.innerHTML = `
        <label for="${id}">${f.label}</label>
        <span class="input-wrap">
          <input id="${id}" type="number" inputmode="decimal" step="${f.step}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""} data-key="${f.key}" />
          <span class="unit">${f.unit}</span>
        </span>
        <button type="button" class="help-toggle" aria-expanded="false" aria-controls="${id}-help" aria-label="Erklärung zu ${f.label}">?</button>
        <p class="help" id="${id}-help" hidden>${f.help}</p>`;
      body.appendChild(row);
    }
    sec.appendChild(body);
    host.appendChild(sec);
  }

  host.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.id === "bundesland") {
      if (t.value) {
        params.grunderwerbsteuer = Number(t.value);
        ($(`#f-grunderwerbsteuer`) as HTMLInputElement).value = t.value;
        update();
      }
      return;
    }
    const key = t.dataset.key as Field["key"] | undefined;
    if (!key) return;
    const v = (t as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(v)) return;
    params[key] = v;
    if (key === "grunderwerbsteuer") syncBundesland();
    update();
  });

  host.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".help-toggle") as HTMLButtonElement | null;
    if (!btn) return;
    const help = document.getElementById(btn.getAttribute("aria-controls")!)!;
    const open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(open));
    help.hidden = !open;
  });
}

function syncBundesland() {
  const sel = $("#bundesland") as HTMLSelectElement;
  const match = [...sel.options].find((o) => o.value && Number(o.value) === params.grunderwerbsteuer);
  // Mehrere Länder teilen sich einen Satz – die aktuelle Auswahl behalten, wenn sie passt.
  if (sel.value && Number(sel.value) === params.grunderwerbsteuer) return;
  sel.value = match ? match.value : "";
}

function fillInputs() {
  for (const g of GROUPS) for (const f of g.fields) {
    const input = document.getElementById(fieldId(f)) as HTMLInputElement;
    if (document.activeElement !== input) input.value = String(params[f.key]);
  }
  syncBundesland();
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.mode === params.mode));
  });
  document.querySelectorAll<HTMLElement>("[data-only]").forEach((n) => {
    n.hidden = !!n.dataset.only && n.dataset.only !== params.mode;
  });
  ($("#preset") as HTMLSelectElement).value = presetKey;
}

// ---------- Ergebnisse ----------

function verdict(r: Result) {
  const n = Math.round(params.horizont);
  const scale = Math.max(Math.abs(r.endVermoegenAlternative), Math.abs(r.endVermoegenKauf), 1);
  const knapp = Math.abs(r.differenz) < scale * 0.03;
  const altName = "Alternativanlage";

  let head: string;
  let line: string;
  let tone: string;
  if (knapp) {
    head = "Knapp – fast gleichauf";
    line = `Nach ${n} Jahren liegen Kaufen und ${altName} nur ${eur(Math.abs(r.differenz))} auseinander. Kleine Abweichungen bei den Annahmen drehen das Ergebnis.`;
    tone = "even";
  } else if (r.differenz > 0) {
    head = "Ja, der Kauf rechnet sich";
    line = `Nach ${n} Jahren hast du mit der Immobilie ${eur(r.differenz)} mehr Vermögen als mit der ${altName} – bei gleich viel eingesetztem Geld.`;
    tone = "kauf";
  } else {
    head = "Nein, der Kauf rechnet sich nicht";
    line = `Nach ${n} Jahren hättest du mit der ${altName} ${eur(-r.differenz)} mehr Vermögen – bei gleich viel eingesetztem Geld.`;
    tone = "alt";
  }
  const v = $("#verdict");
  v.dataset.tone = tone;
  $("#verdict-head").textContent = head;
  $("#verdict-line").textContent = line;

  const max = Math.max(r.endVermoegenKauf, r.endVermoegenAlternative, 1);
  const w = (x: number) => `${Math.max(0, (x / max) * 100)}%`;
  $("#scale").innerHTML = `
    <div class="scale-row kauf"><span class="scale-name">Kaufen</span><span class="scale-bar"><span style="width:${w(r.endVermoegenKauf)}"></span></span><span class="scale-val">${eur(r.endVermoegenKauf)}</span></div>
    <div class="scale-row alt"><span class="scale-name">${altName}</span><span class="scale-bar"><span style="width:${w(r.endVermoegenAlternative)}"></span></span><span class="scale-val">${eur(r.endVermoegenAlternative)}</span></div>`;

  // Kompakte Leiste für Mobilgeräte
  $("#sticky").innerHTML = `<span>${head}</span><b>${eurSigned(r.differenz)}</b>`;
  $("#sticky").dataset.tone = tone;
}

function facts(r: Result) {
  const mietKey = params.mode === "vermietung" ? "kaltmiete" : "vergleichsmiete";
  const beWert = breakEven(params, "wertsteigerung", -15, 25);
  const beMiete = breakEven(params, mietKey, 0, Math.max(params[mietKey] * 10, 10_000));
  const item = (label: string, value: string, note = "") =>
    `<div class="fact"><dt>${label}</dt><dd>${value}</dd>${note ? `<p>${note}</p>` : ""}</div>`;

  const irrNote =
    params.mode === "vermietung"
      ? "Jährliche Rendite auf dein Eigenkapital, nach Steuern und Verkauf."
      : "Mit der ersparten Miete als Ertrag. Zum Vergleich mit der Alternativrendite.";

  $("#facts").innerHTML = [
    item(
      "Eigenkapitalrendite",
      r.eigenkapitalrendite === null ? "nicht bestimmbar" : percent(r.eigenkapitalrendite),
      r.eigenkapitalrendite === null ? "Ohne Eigenkapital gibt es keinen Startwert für die Rendite." : irrNote,
    ),
    item(
      "Kaufen liegt vorn ab",
      r.breakEvenJahr === null ? "–" : `Jahr ${r.breakEvenJahr}`,
      r.breakEvenJahr === null
        ? "Innerhalb des Zeitraums holt die Immobilie nicht auf."
        : "Vorher wäre ein Verkauf schlechter als die Alternative, vor allem wegen der Kaufnebenkosten.",
    ),
    item(
      "Nötige Wertsteigerung",
      beWert === null ? "außerhalb −15 bis 25 %" : `${beWert.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % p. a.`,
      "Ab diesem Wert pro Jahr rechnet sich der Kauf, alle anderen Annahmen gleich.",
    ),
    item(
      params.mode === "vermietung" ? "Nötige Kaltmiete" : "Nötige Vergleichsmiete",
      beMiete === null ? "–" : `${eur(beMiete)} / Monat`,
      params.mode === "vermietung"
        ? "Ab dieser Anfangsmiete liegt Kaufen vorn."
        : "Wäre eine vergleichbare Mietwohnung mindestens so teuer, lohnt sich der Kauf.",
    ),
  ].join("");
}

function monthly(r: Result) {
  const rows: [string, string, string?][] = [];
  rows.push(["Gesamtkosten", eur(r.gesamtkosten), `davon Nebenkosten ${eur(r.nebenkosten)}`]);
  rows.push(["Darlehen", eur(r.darlehen), `${percent(r.beleihungsauslauf)} des Kaufpreises`]);
  rows.push(["Monatsrate", eur(r.monatsrate), r.monatsrateAnschluss > r.monatsrate + 1 ? `ab Jahr ${params.zinsbindung + 1}: ${eur(r.monatsrateAnschluss)}` : "Zins und Tilgung"]);
  if (params.mode === "vermietung") {
    rows.push(["Cashflow im 1. Monat", eurSigned(r.cashflowMonat1VorSteuer), "vor Steuern"]);
    rows.push(["Cashflow nach Steuern", eurSigned(r.cashflowMonat1NachSteuer), r.cashflowMonat1NachSteuer < 0 ? "das zahlst du monatlich zu" : "bleibt dir monatlich übrig"]);
    rows.push(["Bruttomietrendite", percent(r.bruttomietrendite), `Kaufpreisfaktor ${number(r.kaufpreisfaktor)}`]);
    rows.push(["Nettomietrendite", percent(r.nettomietrendite), "nach Kosten, auf Gesamtkosten"]);
  } else {
    const mehr = -r.cashflowMonat1VorSteuer;
    rows.push([mehr >= 0 ? "Mehr als Miete" : "Weniger als Miete", eur(Math.abs(mehr)), "pro Monat im ersten Jahr, inkl. Tilgung"]);
  }
  rows.push(["Restschuld nach Zinsbindung", eur(r.restschuldZinsbindung), `nach ${params.zinsbindung} Jahren`]);
  rows.push(["Schuldenfrei nach", r.schuldenfreiNachJahren === null ? "über 100 Jahren" : jahre(r.schuldenfreiNachJahren), r.darlehen > 0 ? "inkl. Anschlussfinanzierung" : "kein Kredit"]);
  if (r.spekulationssteuer > 0) rows.push(["Steuer auf Verkaufsgewinn", eur(r.spekulationssteuer), "Verkauf vor Ablauf von 10 Jahren"]);

  $("#monthly").innerHTML = rows
    .map(([k, v, n]) => `<div class="kv"><dt>${k}</dt><dd>${v}</dd>${n ? `<p>${n}</p>` : ""}</div>`)
    .join("");

  const warn = $("#warnings");
  warn.innerHTML = r.warnungen.map((w) => `<li>${w}</li>`).join("");
  warn.hidden = r.warnungen.length === 0;
}

function charts(r: Result) {
  const labels = r.rows.map((x) => x.jahr);
  lineChart($("#chart-wealth"), {
    labels,
    xTitle: "Jahr",
    format: eur,
    formatAxis: eurShort,
    marker: r.breakEvenJahr ? { at: r.breakEvenJahr, text: "Kaufen vorn" } : null,
    series: [
      { name: "Kaufen", cls: "kauf", values: r.rows.map((x) => x.vermoegenKauf) },
      { name: "Alternativanlage", cls: "alt", values: r.rows.map((x) => x.vermoegenAlternative) },
    ],
  });
  lineChart($("#chart-debt"), {
    labels,
    xTitle: "Jahr",
    format: eur,
    formatAxis: eurShort,
    height: 240,
    series: [
      { name: "Marktwert", cls: "kauf", values: r.rows.map((x) => x.immobilienwert), fill: true },
      { name: "Restschuld", cls: "debt", values: r.rows.map((x) => x.restschuld), fill: true },
    ],
  });
  barChart($("#chart-cashflow"), {
    labels,
    xTitle: "Jahr",
    format: eur,
    formatAxis: eurShort,
    values: r.rows.map((x) => x.cashflowNachSteuer),
  });
  $("#cashflow-title").textContent =
    params.mode === "vermietung" ? "Cashflow pro Jahr nach Steuern" : "Ersparte Miete minus Kosten der Immobilie";

  const s = sensitivity(params);
  tornado($("#chart-tornado"), s.basis, s.items, eurSigned);
  $("#t-basis").textContent = `Senkrechte Linie: dein aktuelles Ergebnis, ${eurSigned(s.basis)} für Kaufen.`;
  $("#kink-note").textContent =
    params.mode === "vermietung" && params.horizont >= 10
      ? " Der Sprung in Jahr 10 kommt von der Spekulationsfrist: Ab dann ist der Verkaufsgewinn steuerfrei."
      : "";
}

function table(r: Result) {
  const v = params.mode === "vermietung";
  const cols: [string, (x: Result["rows"][number]) => number][] = [
    ["Jahr", (x) => x.jahr],
    [v ? "Mieteinnahmen" : "Ersparte Miete", (x) => x.einnahmen],
    ["Kosten", (x) => -x.kosten],
    ["Zinsen", (x) => -x.zinsen],
    ["Tilgung", (x) => -x.tilgung],
    ...(v ? ([["Steuer", (x) => -x.steuer]] as typeof cols) : []),
    ["Cashflow", (x) => x.cashflowNachSteuer],
    ["Restschuld", (x) => x.restschuld],
    ["Marktwert", (x) => x.immobilienwert],
    ["Vermögen Kaufen", (x) => x.vermoegenKauf],
    ["Vermögen Alternative", (x) => x.vermoegenAlternative],
  ];
  const head = `<tr>${cols.map(([c]) => `<th scope="col">${c}</th>`).join("")}</tr>`;
  const body = r.rows
    .map((row) => `<tr>${cols.map(([, f], i) => (i === 0 ? `<th scope="row">${f(row)}</th>` : `<td class="${f(row) < -0.5 ? "neg" : ""}">${eur(f(row))}</td>`)).join("")}</tr>`)
    .join("");
  $("#table").innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;

  ($("#csv") as HTMLButtonElement).onclick = () => {
    const lines = [cols.map(([c]) => c).join(";")];
    for (const row of r.rows) lines.push(cols.map(([, f]) => (Math.round(f(row) * 100) / 100).toString().replace(".", ",")).join(";"));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "immobilienrechner.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}

let lastResult: Result | null = null;

function update() {
  fillInputs();
  const r = simulate(params);
  lastResult = r;
  verdict(r);
  facts(r);
  monthly(r);
  charts(r);
  table(r);
  $("#horizon-label").textContent = String(Math.round(params.horizont));
  persist();
}

// ---------- Kopfleiste ----------

function setupHeader() {
  const presetSel = $("#preset") as HTMLSelectElement;
  presetSel.innerHTML = Object.entries(PRESETS)
    .map(([k, p]) => `<option value="${k}">${p.name}</option>`)
    .join("");
  presetSel.addEventListener("change", () => {
    presetKey = presetSel.value;
    params = { ...PRESETS[presetKey].params };
    update();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      params.mode = b.dataset.mode as Mode;
      update();
    }),
  );

  $("#sticky").addEventListener("click", () => $("#verdict").scrollIntoView({ behavior: "smooth", block: "start" }));

  $("#reset").addEventListener("click", () => {
    params = { ...PRESETS[presetKey].params };
    update();
  });

  const share = $("#share") as HTMLButtonElement;
  share.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      share.textContent = "Link kopiert";
    } catch {
      share.textContent = "Link in der Adresszeile";
    }
    setTimeout(() => (share.textContent = "Link kopieren"), 2000);
  });
}

// Diagramme bei Größenänderung neu zeichnen
let resizeTimer = 0;
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => lastResult && charts(lastResult), 120);
});

setupHeader();
buildInputs();
update();
