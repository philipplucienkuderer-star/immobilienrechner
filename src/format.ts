const eur0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const pct1 = new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const eur = (v: number) => eur0.format(Math.round(v) === 0 ? 0 : v);
export const eurSigned = (v: number) => (v > 0.5 ? "+" : "") + eur(v);
export const percent = (fraction: number) => pct1.format(fraction);
export const number = (v: number) => num1.format(v);

/** Kurzform für Achsen: 250.000 € -> "250 T€", 1.200.000 € -> "1,2 Mio. €" */
export function eurShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${num1.format(v / 1_000_000)} Mio. €`;
  if (a >= 1_000) return `${Math.round(v / 1_000)} T€`;
  return `${Math.round(v)} €`;
}

export function jahre(v: number): string {
  const ganz = Math.round(v * 10) / 10;
  return `${num1.format(ganz)} ${ganz === 1 ? "Jahr" : "Jahren"}`;
}
