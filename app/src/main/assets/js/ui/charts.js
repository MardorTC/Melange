import { model } from "../state/model.js";
import { empty, esc, money, colors } from "./components.js";

export function donut(tx) {
  const map = {};
  tx.forEach((t) => {
    const name =
      model.state.categories.find((c) => c.id === t.categoryId)?.name ||
      (t.kind === "fixed" ? "Gastos fijos" : "Sin categoría");
    map[name] = (map[name] || 0) + t.amount;
  });
  let pairs = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (pairs.length > 5)
    pairs = [
      ...pairs.slice(0, 5),
      ["Otros", pairs.slice(5).reduce((a, x) => a + x[1], 0)],
    ];
  const total = pairs.reduce((a, x) => a + x[1], 0);
  if (!total)
    return empty(
      "Todavía sin gastos",
      "Los movimientos del periodo aparecerán aquí.",
    );
  let offset = 0;
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Gasto por categoría: ${esc(pairs.map(([n, a]) => n + " " + money(a)).join(", "))}"><circle cx="70" cy="70" r="51" fill="none" stroke="#eee8dd" stroke-width="20"/>${pairs
    .map(([name, a], i) => {
      const len = (a / total) * 320.442,
        off = offset;
      offset += len;
      return `<circle cx="70" cy="70" r="51" fill="none" stroke="${colors[i]}" stroke-width="20" stroke-dasharray="${len} ${320.442 - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(name)}: ${money(a)}</title></circle>`;
    })
    .join(
      "",
    )}<text x="70" y="67" text-anchor="middle" fill="#82796a" font-size="10">TOTAL</text><text x="70" y="84" text-anchor="middle" fill="#30291f" font-size="13" font-weight="700">${money(total)}</text></svg><div class="legend">${pairs.map(([n, a], i) => `<div><span><i class="dot" style="background:${colors[i]}"></i>${esc(n)}</span><strong>${Math.round((a / total) * 100)}%</strong></div>`).join("")}</div></div>`;
}

export function lineChart(all) {
  const h = all.slice(-60);
  if (h.length < 2)
    return empty(
      "Tu historia comienza aquí",
      "El historial se construye con tus observaciones o movimientos reconstruidos.",
    );
  const min = Math.min(...h.map((x) => x.value)),
    max = Math.max(...h.map((x) => x.value)),
    range = max - min || 100;
  const start = Date.parse(h[0].date),
    end = Date.parse(h.at(-1).date),
    x = (d) => 15 + ((Date.parse(d) - start) / Math.max(1, end - start)) * 300,
    y = (v) => 125 - ((v - min) / range) * 90;
  const pts = h.map((p) => `${x(p.date)},${y(p.value)}`).join(" ");
  return `<div class="history-chart"><div class="chart-labels"><span>${money(max)}</span><span>Último: ${money(h.at(-1).value)}</span></div><svg class="chart" viewBox="0 25 330 115" preserveAspectRatio="none" role="img" aria-label="Historial de liquidez de ${h[0].date} a ${h.at(-1).date}"><path d="M15 125H315M15 80H315M15 35H315" stroke="#e9e3d8" stroke-dasharray="3 5" fill="none"/><polygon points="15,130 ${pts} 315,130" fill="#efdfc2"/><polyline points="${pts}" fill="none" stroke="#986437" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>${h.map((p) => `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="3" fill="#986437"><title>${p.date}: ${money(p.value)}</title></circle>`).join("")}</svg><div class="chart-labels"><span>${h[0].date}</span><span>${h.at(-1).date}</span></div></div>`;
}
