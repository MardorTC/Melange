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
    `<div class="toolbar">${icon("back", "Año anterior", "timelineYear", "-1")}<h2 style="flex:1;text-align:center;margin:0">${year}</h2>${icon("back", "Año siguiente", "timelineYear", "1", 'style="transform:rotate(180deg)"')}</div><p class="note">Cobre: pagado · Arena: pendiente · Rayado: abono parcial. Desliza para explorar los meses.</p><section class="card"><div class="scroll" tabindex="0" aria-label="Timeline anual"><table class="timeline"><thead><tr><th>Compromiso</th>${months.map((m) => `<th>${mlabel(m)}</th>`).join("")}</tr></thead><tbody><tr><td>Total del mes</td>${byMonth.map((items) => `<td>${money(items.reduce((a, i) => a + i.amount, 0))}</td>`).join("")}</tr>${[
      ...refs.values(),
    ]
      .map(
        (r) =>
          `<tr><td>${esc(r.name)}<br><small>${r.kind === "debt" ? "Deuda" : "Gasto fijo"}</small></td>${byMonth
            .map((items) => {
              const occurrences = items.filter(
                (i) => i.ref === r.ref && i.kind === r.kind,
              );
              return `<td>${occurrences.length ? occurrences.map((i) => `<span class="timeline-dot ${i.paid ? "paid" : i.recorded ? "partial" : ""}" title="${i.date} · ${i.paid ? "Pagado" : "Pendiente: " + money(i.remaining)}">${i.date.slice(8)} · ${money(i.amount)}</span>`).join("<br>") : "—"}</td>`;
            })
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table></div>${refs.size ? "" : empty("Sin compromisos", "No hay cuotas ni gastos fijos para este año.")}</section>`
  );
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
