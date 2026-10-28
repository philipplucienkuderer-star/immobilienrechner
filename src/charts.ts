/**
 * Kleine, abhängigkeitsfreie SVG-Diagramme. Farben kommen über CSS-Klassen,
 * damit Hell- und Dunkelmodus automatisch passen.
 */

const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

export interface Series {
  name: string;
  cls: string;
  values: number[];
  fill?: boolean;
}

export interface LineOptions {
  labels: number[];
  series: Series[];
  format: (v: number) => string;
  formatAxis: (v: number) => string;
  /** Senkrechte Markierung an diesem Label (z. B. Break-even-Jahr). */
  marker?: { at: number; text: string } | null;
  xTitle?: string;
  height?: number;
}

interface Frame {
  svg: SVGSVGElement;
  w: number;
  h: number;
  pad: { t: number; r: number; b: number; l: number };
}

function frame(container: HTMLElement, height: number, padLeft = 64): Frame {
  container.innerHTML = "";
  const w = Math.max(container.clientWidth, 280);
  const h = height;
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: "chart-svg", role: "img" });
  container.appendChild(svg);
  return { svg, w, h, pad: { t: 16, r: 16, b: 32, l: padLeft } };
}

function yAxis(f: Frame, ticks: number[], y: (v: number) => number, fmt: (v: number) => string) {
  for (const t of ticks) {
    const yy = y(t);
    el("line", { x1: f.pad.l, x2: f.w - f.pad.r, y1: yy, y2: yy, class: t === 0 ? "axis-zero" : "grid" }, f.svg);
    const label = el("text", { x: f.pad.l - 8, y: yy + 4, class: "tick", "text-anchor": "end" }, f.svg);
    label.textContent = fmt(t);
  }
}

function xAxis(f: Frame, labels: number[], x: (i: number) => number, title?: string) {
  const every = Math.ceil(labels.length / Math.max(2, Math.floor((f.w - f.pad.l) / 56)));
  labels.forEach((lab, i) => {
    if (i % every !== 0 && i !== labels.length - 1) return;
    if (i !== labels.length - 1 && labels.length - 1 - i < every * 0.6) return;
    const t = el("text", { x: x(i), y: f.h - f.pad.b + 18, class: "tick", "text-anchor": "middle" }, f.svg);
    t.textContent = String(lab);
  });
  if (title) {
    const t = el("text", { x: f.w - f.pad.r, y: f.h - 2, class: "tick axis-title", "text-anchor": "end" }, f.svg);
    t.textContent = title;
  }
}

export function lineChart(container: HTMLElement, o: LineOptions) {
  const f = frame(container, o.height ?? 280);
  const all = o.series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all);
  const hi = Math.max(...all);
  const ticks = niceTicks(lo, hi);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const n = o.labels.length;
  const x = (i: number) => f.pad.l + (n === 1 ? 0 : (i / (n - 1)) * (f.w - f.pad.l - f.pad.r));
  const y = (v: number) => f.pad.t + (1 - (v - yMin) / (yMax - yMin)) * (f.h - f.pad.t - f.pad.b);

  yAxis(f, ticks, y, o.formatAxis);
  xAxis(f, o.labels, x, o.xTitle);

  if (o.marker) {
    const i = o.labels.indexOf(o.marker.at);
    if (i >= 0) {
      el("line", { x1: x(i), x2: x(i), y1: f.pad.t, y2: f.h - f.pad.b, class: "marker" }, f.svg);
      const anchor = i > n * 0.7 ? "end" : "start";
      const t = el("text", { x: x(i) + (anchor === "end" ? -6 : 6), y: f.pad.t + 10, class: "marker-label", "text-anchor": anchor }, f.svg);
      t.textContent = o.marker.text;
    }
  }

  for (const s of o.series) {
    const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    if (s.fill) {
      el("path", { d: `${d}L${x(n - 1)},${y(Math.max(yMin, 0))}L${x(0)},${y(Math.max(yMin, 0))}Z`, class: `area ${s.cls}` }, f.svg);
    }
    el("path", { d, class: `line ${s.cls}` }, f.svg);
  }

  // Interaktion: Fadenkreuz mit Werten
  const hover = el("g", { class: "hover", visibility: "hidden" }, f.svg);
  const vline = el("line", { y1: f.pad.t, y2: f.h - f.pad.b, class: "crosshair" }, hover);
  const dots = o.series.map((s) => el("circle", { r: 4, class: `dot ${s.cls}` }, hover));
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  container.appendChild(tip);

  const show = (i: number) => {
    hover.setAttribute("visibility", "visible");
    vline.setAttribute("x1", String(x(i)));
    vline.setAttribute("x2", String(x(i)));
    o.series.forEach((s, k) => {
      dots[k].setAttribute("cx", String(x(i)));
      dots[k].setAttribute("cy", String(y(s.values[i])));
    });
    tip.hidden = false;
    tip.innerHTML =
      `<strong>${o.xTitle ? `${o.xTitle} ` : ""}${o.labels[i]}</strong>` +
      o.series.map((s) => `<span><i class="key ${s.cls}"></i>${s.name}<b>${o.format(s.values[i])}</b></span>`).join("");
    const left = x(i);
    tip.style.left = `${Math.min(Math.max(left, 90), f.w - 90)}px`;
  };
  const hide = () => {
    hover.setAttribute("visibility", "hidden");
    tip.hidden = true;
  };
  const indexAt = (clientX: number) => {
    const r = f.svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * f.w;
    return Math.round(((px - f.pad.l) / (f.w - f.pad.l - f.pad.r)) * (n - 1));
  };
  const capture = el("rect", { x: f.pad.l, y: f.pad.t, width: f.w - f.pad.l - f.pad.r, height: f.h - f.pad.t - f.pad.b, class: "capture" }, f.svg);
  capture.addEventListener("pointermove", (e) => {
    const i = indexAt(e.clientX);
    if (i >= 0 && i < n) show(i);
  });
  capture.addEventListener("pointerleave", hide);
}

export interface BarOptions {
  labels: number[];
  values: number[];
  format: (v: number) => string;
  formatAxis: (v: number) => string;
  xTitle?: string;
  height?: number;
}

export function barChart(container: HTMLElement, o: BarOptions) {
  const f = frame(container, o.height ?? 220);
  const ticks = niceTicks(Math.min(0, ...o.values), Math.max(0, ...o.values), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const n = o.labels.length;
  const band = (f.w - f.pad.l - f.pad.r) / n;
  const x = (i: number) => f.pad.l + band * (i + 0.5);
  const y = (v: number) => f.pad.t + (1 - (v - yMin) / (yMax - yMin)) * (f.h - f.pad.t - f.pad.b);
  yAxis(f, ticks, y, o.formatAxis);
  xAxis(f, o.labels, x, o.xTitle);
  const bw = Math.max(Math.min(band * 0.7, 28), 2);
  o.values.forEach((v, i) => {
    const y0 = y(0);
    const y1 = y(v);
    const r = el("rect", {
      x: x(i) - bw / 2,
      y: Math.min(y0, y1),
      width: bw,
      height: Math.max(Math.abs(y1 - y0), 1),
      rx: Math.min(2, bw / 4),
      class: v >= 0 ? "bar pos" : "bar neg",
    }, f.svg);
    const t = el("title", {}, r);
    t.textContent = `${o.xTitle ?? ""} ${o.labels[i]}: ${o.format(v)}`;
  });
}

export interface TornadoItem {
  label: string;
  lowLabel: string;
  highLabel: string;
  low: number;
  high: number;
}

/** Balken links/rechts der Basis-Differenz. Rendert als HTML für gut lesbare Beschriftungen. */
export function tornado(container: HTMLElement, basis: number, items: TornadoItem[], fmt: (v: number) => string) {
  const ext = Math.max(1, ...items.flatMap((i) => [Math.abs(i.low - basis), Math.abs(i.high - basis)]));
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "tornado";
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "t-row";
    const seg = (v: number, lab: string) => {
      const d = v - basis;
      const w = (Math.abs(d) / ext) * 50;
      const left = d < 0 ? 50 - w : 50;
      const cls = v >= 0 ? "pos" : "neg";
      return `<span class="t-bar ${cls}" style="left:${left}%;width:${w}%" title="${lab}: Differenz ${fmt(v)}"></span>`;
    };
    row.innerHTML = `
      <span class="t-label">${it.label}</span>
      <span class="t-track">${seg(it.low, it.lowLabel)}${seg(it.high, it.highLabel)}<span class="t-axis"></span></span>
      <span class="t-vals"><span>${it.lowLabel}: <b>${fmt(it.low)}</b></span><span>${it.highLabel}: <b>${fmt(it.high)}</b></span></span>`;
    list.appendChild(row);
  }
  container.appendChild(list);
}
