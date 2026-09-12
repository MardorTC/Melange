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
  if (!h.length)
    return empty(
      "Tu historia comienza aquí",
      "Al registrar movimientos aparecerán tus saldos por fecha.",
    );
  const min = Math.min(...h.map((p) => p.value)),
    max = Math.max(...h.map((p) => p.value)),
    range = max - min || 100;
  const start = Date.parse(h[0].date),
    end = Date.parse(h.at(-1).date);
  const x = (d) =>
    h.length === 1
      ? 500
      : 10 + ((Date.parse(d) - start) / Math.max(1, end - start)) * 980;
  const y = (v) => (max === min ? 90 : 150 - ((v - min) / range) * 120);
  const points = h.map((p) => `${x(p.date)},${y(p.value)}`).join(" "),
    last = h.at(-1),
    change = h.length > 1 ? last.value - h.at(-2).value : null;
  return `<div class="history-chart"><div class="history-readout" aria-live="polite"><div><small data-chart-date>${last.date}</small><strong data-chart-value>${money(last.value)}</strong></div><span data-chart-change>${change === null ? "Primer registro" : `${change > 0 ? "+" : ""}${money(change)} vs anterior`}</span></div><p class="note">Saldo en efectivo y bancos, incluidas reservas y cajitas. Excluye vales. Toca un punto o desliza para ver cada registro.</p><div class="history-plot"><svg viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true"><path d="M10 30H990M10 90H990M10 150H990" class="history-grid"/><polygon points="${x(h[0].date)},170 ${points} ${x(last.date)},170" class="history-area"/><polyline points="${points}" class="history-line" vector-effect="non-scaling-stroke"/></svg>${h.map((p, i) => `<button type="button" class="history-point" data-chart-point="${i}" data-date="${p.date}" data-value="${p.value}" data-change="${i ? p.value - h[i - 1].value : ""}" style="left:${x(p.date) / 10}%;top:${y(p.value) / 1.8}%" aria-label="${p.date}: ${money(p.value)}" aria-pressed="${i === h.length - 1}"></button>`).join("")}</div><input type="range" data-chart-slider min="0" max="${h.length - 1}" step="1" value="${h.length - 1}" aria-label="Explorar registros de saldo" ${h.length === 1 ? "disabled" : ""}><div class="chart-labels"><span>${h[0].date}</span><span>${last.date}</span></div><div class="history-range"><span>Mínimo <strong>${money(min)}</strong></span><span>Máximo <strong>${money(max)}</strong></span></div></div>`;
}

export function selectHistoryPoint(point) {
  if (!point) return;
  const chart = point.closest(".history-chart"),
    change = point.dataset.change;
  chart.querySelector("[data-chart-date]").textContent = point.dataset.date;
  chart.querySelector("[data-chart-value]").textContent = money(
    Number(point.dataset.value),
  );
  chart.querySelector("[data-chart-change]").textContent =
    change === ""
      ? "Primer registro"
      : `${Number(change) > 0 ? "+" : ""}${money(Number(change))} vs anterior`;
  chart
    .querySelectorAll("[data-chart-point]")
    .forEach((p) => p.setAttribute("aria-pressed", String(p === point)));
  chart.querySelector("[data-chart-slider]").value = point.dataset.chartPoint;
}
