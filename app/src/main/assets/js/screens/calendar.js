import C from "../domain/finance.js";
import { model } from "../state/model.js";
import {
  pageHeading,
  mlabel,
  money,
  icon,
  esc,
  empty,
  btn,
  metric,
} from "../ui/components.js";
import { periodChooser, openPage } from "../ui/navigation.js";
import { paymentRow } from "./home.js";

export function projectionPage() {
  const months = Array.from({ length: 12 }, (_, i) =>
    C.addMonth(model.period, i),
  );
  return (
    pageHeading("Proyección de 12 meses", "Una mirada al horizonte") +
    periodChooser() +
    `<p class="note">Presupuesto antes de variables: los pagos realizados siguen formando parte del compromiso mensual. No es un pronóstico de saldo bancario.</p><section class="card"><div class="scroll" tabindex="0" aria-label="Proyección de 12 meses"><table><thead><tr><th>Mes</th><th>Ingreso previsto</th><th>Fijos</th><th>Deudas</th><th>Libre antes de variables</th></tr></thead><tbody>${months
      .map((m) => {
        const v = C.metrics(model.state, m);
        return `<tr><td>${mlabel(m)}</td><td>${money(v.income)}</td><td>${money(v.fixed)}</td><td>${money(v.debt)}</td><td class="${v.budgetFree < 0 ? "bad" : "good"}">${money(v.budgetFree)}</td></tr>`;
      })
      .join("")}</tbody></table></div></section>`
  );
}

export function timelinePage() {
  const year = model.period.slice(0, 4),
    months = Array.from(
      { length: 12 },
      (_, i) => year + "-" + String(i + 1).padStart(2, "0"),
    );
  const byMonth = months.map((m) => C.obligations(model.state, m));
  const refs = new Map();
  byMonth.flat().forEach((i) =>
    refs.set(i.kind + ":" + i.ref, {
      ref: i.ref,
      kind: i.kind,
      name: i.name,
    }),
  );
  return (
    pageHeading("Timeline anual", "Los compromisos, en perspectiva") +
    `<div class="toolbar">${icon("back", "Año anterior", "timelineYear", "-1")}<h2 style="flex:1;text-align:center;margin:0">${year}</h2>${icon("back", "Año siguiente", "timelineYear", "1", 'style="transform:rotate(180deg)"')}</div><p class="note">Verde: pagado · Neutro: pendiente · Cobre rayado: abono parcial. Los periodos consecutivos forman una sola franja.</p><section class="card timeline-card"><div class="scroll" tabindex="0" aria-label="Timeline anual"><table class="timeline"><thead><tr><th>Compromiso</th>${months.map((m) => `<th>${mlabel(m)}</th>`).join("")}</tr></thead><tbody><tr class="timeline-total"><td>Total del mes</td>${byMonth.map((items) => `<td>${money(items.reduce((a, i) => a + i.amount, 0))}</td>`).join("")}</tr>${[
      ...refs.values(),
    ]
      .map((r) => timelineRow(r, byMonth))
      .join(
        "",
      )}</tbody></table></div>${refs.size ? "" : empty("Sin compromisos", "No hay cuotas ni gastos fijos para este año.")}</section>`
  );
}

function timelineRow(ref, byMonth) {
  const rowMonths = byMonth.map((items) =>
    items.filter((i) => i.ref === ref.ref && i.kind === ref.kind),
  );
  return `<tr><td>${esc(ref.name)}<br><small>${ref.kind === "debt" ? "Deuda" : "Gasto fijo"}</small></td>${rowMonths
    .map((occurrences, index) => {
      if (!occurrences.length)
        return '<td class="timeline-cell empty-cell">—</td>';
      const paid = occurrences.every((i) => i.paid),
        partial = !paid && occurrences.some((i) => i.recorded),
        status = paid ? "paid" : partial ? "partial" : "pending",
        hasPrev = Boolean(rowMonths[index - 1]?.length),
        hasNext = Boolean(rowMonths[index + 1]?.length),
        label = occurrences
          .map((i) => `${i.date.slice(8)} · ${money(i.amount)}`)
          .join(" / "),
        title = occurrences
          .map(
            (i) =>
              `${i.date} · ${i.paid ? "Pagado" : "Pendiente: " + money(i.remaining)}`,
          )
          .join(" · ");
      return `<td class="timeline-cell filled ${hasPrev ? "has-prev" : ""} ${hasNext ? "has-next" : ""}"><span class="timeline-flow ${status}" title="${esc(title)}">${esc(label)}</span></td>`;
    })
    .join("")}</tr>`;
}

export function calendarPage() {
  const items = C.obligations(model.state, model.period),
    m = C.metrics(model.state, model.period);
  return `<div class="eyebrow">Tu mes, a la vista</div><h1>Calendario</h1><div class="calendar-shortcuts">${btn("Ver timeline anual", "timeline", "", "full")}${btn("Ver proyección de 12 meses", "projection", "", "full")}</div>${periodChooser()}<div class="grid"><div class="card accent"><small>Pendiente</small>${metric(m.pending, "calPending", "small")}</div><div class="card sage"><small>Pagado</small>${metric(m.paid, "calPaid", "small")}</div></div><section class="card"><div class="row"><h2>Compromisos</h2><small>${money(m.fixed + m.debt)} total</small></div>${
    items.length
      ? items
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(paymentRow)
          .join("")
      : empty("Un mes despejado", "No hay compromisos calendarizados.")
  }</section>`;
}

export function showProjection() {
  openPage("projection");
}

export function timeline() {
  openPage("timeline");
}
