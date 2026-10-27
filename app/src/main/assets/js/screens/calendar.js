import C from "../domain/finance.js";
import { model } from "../state/model.js";
import {
  mlabel,
  money,
  empty,
  svg,
  screenHead,
  sectionHead,
} from "../ui/components.js";
import { openPage } from "../ui/navigation.js";
import { paymentRow } from "./home.js";

const monthLong = (month) =>
  new Date(month + "-15T12:00:00").toLocaleDateString("es-MX", {
    month: "long",
  });

export function projectionPage() {
  const months = Array.from({ length: 12 }, (_, i) =>
      C.addMonth(model.period, i),
    ),
    rows = months.map((month) => {
      const v = C.metrics(model.state, month),
        total = v.fixed + v.debt,
        pct = v.income > 0 ? Math.min(100, (v.budgetFree / v.income) * 100) : 0;
      return { month, v, total, pct };
    });
  return (
    screenHead("Proyección", "Próximos 12 meses", { back: true }) +
    `<div class="section-head"><div><h2>Libre antes de variables</h2><small>Ingreso previsto menos fijos y deudas.</small></div></div>` +
    `<section class="card projection-list">${rows
      .map(
        ({ month, v, total, pct }) =>
          `<div class="projection-row"><div class="projection-month"><strong>${monthLong(month)}</strong><small>${month.slice(0, 4)}</small></div><div class="projection-main"><div class="projection-free"><strong class="${v.budgetFree < 0 ? "bad" : "good"}">${money(v.budgetFree)}</strong><small>${total ? `${money(total)} de compromisos` : "Sin compromisos"}</small></div><div class="bar mini"><span class="${v.budgetFree < 0 ? "bad" : ""}" style="--p:${Math.max(0, pct)}%"></span></div><div class="projection-detail"><span>Ingreso ${money(v.income)}</span><span>Fijos ${money(v.fixed)}</span><span>Deudas ${money(v.debt)}</span></div></div></div>`,
      )
      .join("")}</section>` +
    `<details class="fine-print"><summary>Cómo leer esta proyección</summary><p>Es un presupuesto antes de variables: incluye los cargos a tarjeta ya registrados y sus MSI, sin anticipar compras futuras. No es un pronóstico de saldo bancario. Los pagos realizados siguen formando parte del compromiso mensual.</p></details>`
  );
}

export function timeline() {
  openPage("timeline");
}

function monthGrid(items) {
  const [year, month] = model.period.split("-").map(Number),
    days = new Date(year, month, 0).getDate(),
    first = (new Date(year, month - 1, 1).getDay() + 6) % 7,
    due = new Map();
  for (const item of items) {
    const day = Number(item.date.slice(8));
    due.set(day, (due.get(day) || 0) + 1);
  }
  const selected = Number(model.calendarDay || 0),
    today = C.today();
  return `<div class="calendar-weekdays" aria-hidden="true">${["L", "M", "X", "J", "V", "S", "D"].map((d) => `<span>${d}</span>`).join("")}</div><div class="calendar-days" role="grid" aria-label="Días de ${mlabel(model.period)}">${Array.from(
    { length: first },
    () => '<span class="calendar-day empty-day" aria-hidden="true"></span>',
  ).join("")}${Array.from({ length: days }, (_, i) => {
    const day = i + 1,
      date = model.period + "-" + String(day).padStart(2, "0"),
      count = due.get(day) || 0,
      classes = [
        "calendar-day",
        count ? "has-due" : "",
        date === today ? "today" : "",
        selected === day ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
    return `<button class="${classes}" role="gridcell" data-action="calendarDay" data-id="${day}" aria-label="${day} de ${mlabel(model.period)}${count ? `, ${count} vencimiento${count === 1 ? "" : "s"}` : ""}" aria-pressed="${selected === day}">${day}</button>`;
  }).join("")}</div>`;
}

export function calendarPage() {
  const items = C.obligations(model.state, model.period).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    m = C.metrics(model.state, model.period),
    selected = Number(model.calendarDay || 0),
    visible = selected
      ? items.filter((i) => Number(i.date.slice(8)) === selected)
      : items,
    selectedLabel = selected
      ? new Date(
          model.period + "-" + selected + "T12:00:00",
        ).toLocaleDateString("es-MX", { day: "numeric", month: "long" })
      : "Compromisos";
  return (
    screenHead("Calendario", "Tus vencimientos del mes.") +
    `<div class="calendar-tools"><button data-action="timeline">${svg("route")}Ruta de deudas</button><button data-action="projection">${svg("insights")}Proyección</button></div>` +
    `<section class="card calendar-card"><div class="calendar-head"><button class="icon" data-action="prev" aria-label="Mes anterior">${svg("back")}</button><strong>${monthLong(model.period)}<small>${model.period.slice(0, 4)}</small></strong><button class="icon rotate-180" data-action="next" aria-label="Mes siguiente">${svg("back")}</button></div>${monthGrid(items)}<div class="calendar-foot"><div><small>Pendiente</small><strong>${money(m.pending)}</strong></div><div><small>Pagado</small><strong>${money(m.paid)}</strong></div></div></section>` +
    sectionHead(
      selected ? selectedLabel : "Compromisos",
      selected
        ? `<button class="text-action" data-action="calendarDay" data-id="">Ver todo</button>`
        : `<small>${money(m.fixed + m.debt)} total</small>`,
    ) +
    `<section class="card list">${
      visible.length
        ? visible.map(paymentRow).join("")
        : empty(
            selected ? "Día despejado" : "Un mes despejado",
            "No hay compromisos para esta fecha.",
          )
    }</section>`
  );
}

export function showProjection() {
  openPage("projection");
}
