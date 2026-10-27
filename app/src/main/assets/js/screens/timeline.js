import C from "../domain/finance.js";
import { model } from "../state/model.js";
import {
  screenHead,
  btn,
  esc,
  money,
  mlabel,
  debtType,
  empty,
  svg,
} from "../ui/components.js";
import { debtPlan, debtCellState, planInYear } from "../domain/debt-plan.js";

const shortMonth = (m) =>
  new Date(m + "-15T12:00:00").toLocaleDateString("es-MX", {
    month: "short",
  });

const monthOf = (year, index) =>
  year + "-" + String(index + 1).padStart(2, "0");

const monthIndex = (month) => Number(month.slice(5, 7)) - 1;

function rowLabel(row) {
  const parts = [
    row.name,
    `saldo ${money(row.balance)}`,
    `termina ${mlabel(row.end)}`,
  ];
  if (row.payment) parts.push(`cuota ${money(row.payment)}`);
  if (row.overdue) parts.push("vencida, fecha estimada");
  else if (row.estimated) parts.push("fecha estimada");
  return parts.join(", ");
}

function planRow(row, year) {
  const startYear = row.start.slice(0, 4),
    endYear = row.end.slice(0, 4),
    start = startYear < year ? 0 : monthIndex(row.start),
    end = endYear > year ? 11 : monthIndex(row.end),
    months = Array.from({ length: 12 }, (_, i) => monthOf(year, i)),
    status = row.archived
      ? "Archivada"
      : row.overdue
        ? "Vencida"
        : row.partial
          ? "Parcial"
          : row.estimated
            ? "Estimada"
            : "En curso";
  const detail = row.cardName ? `MSI · ${row.cardName}` : debtType(row.kind);
  return `<button class="debt-plan-row" data-action="${row.cardId ? "creditDetails" : "debtDetails"}" data-id="${esc(row.cardId || row.id)}" aria-label="${esc(rowLabel(row))}">
    <div class="debt-plan-head">
      <span class="debt-plan-name">${esc(row.name)}<small>${esc(detail)}</small></span>
      <span class="debt-plan-end">${mlabel(row.end)}</span>
      <span class="debt-plan-amount">${money(row.balance)}${row.payment ? " · " + money(row.payment) + "/mes" : ""} · ${status}${row.partial ? ` · faltan ${money(row.currentRemaining)} de esta cuota` : ""}${row.lateCount ? ` · ${row.lateCount} ${row.lateCount === 1 ? "cuota atrasada" : "cuotas atrasadas"} (${money(row.lateAmount)})` : ""}</span>
    </div>
    <div class="debt-track" role="img" aria-label="${esc(rowLabel(row))}">
      ${months
        .map((month, index) => {
          const state =
            index < start || index > end
              ? "outside"
              : debtCellState(row, month, C.month());
          const isCurrent = month === C.month() ? " current" : "";
          return `<span class="debt-cell ${state}${isCurrent}" title="${esc(shortMonth(month) + " · " + state)}" aria-hidden="true"></span>`;
        })
        .join("")}
    </div>
    ${endYear > year ? `<span class="debt-continues">Continúa en ${endYear}</span>` : ""}
  </button>`;
}

export function timelinePage() {
  const year = model.period.slice(0, 4),
    plan = debtPlan(model.state),
    rows = planInYear(plan, year),
    months = Array.from({ length: 12 }, (_, i) => monthOf(year, i));
  const noDate = plan.rows.filter((row) => !row.end && !row.archived);
  const summary = plan.rows.length
    ? `<section class="card timeline-summary">
        <small>Libre de cuotas</small>
        <div class="timeline-free">${plan.debtFreeMonth ? mlabel(plan.debtFreeMonth) : "Sin fecha planificada"}</div>
        <p class="note">${plan.debtFreeMonth ? `${plan.monthsRemaining === 1 ? "Falta un mes" : `Faltan ${plan.monthsRemaining} meses`} si mantienes tus cuotas actuales.` : "Define una cuota en las deudas marcadas para revisar para calcular una fecha."}</p>
        <div class="timeline-stats">
          <div><small>Deuda en cuotas</small><strong>${money(plan.totalBalance)}</strong></div>
          <div><small>Cuota normal</small><strong>${money(plan.monthlyPayment)}</strong></div>
          <div><small>Resto de este mes</small><strong>${money(plan.thisMonthRemaining)}</strong></div>
          <div><small>Deudas</small><strong>${plan.rows.filter((row) => !row.archived).length}</strong></div>
        </div>
      </section>`
    : `<section class="card timeline-summary">
        <small>Libre de cuotas</small>
        <div class="timeline-free">Sin fechas pendientes</div>
        <p class="note">No hay MSI ni préstamos con saldo. Las compras a crédito sin MSI se ven en Deudas.</p>
      </section>`;
  return (
    screenHead("Ruta de deudas", "Cuándo vas a terminar de pagar.", {
      back: true,
    }) +
    `<div class="timeline-year"><button class="icon" data-action="timelineYear" data-id="-1" aria-label="Año anterior">${svg("back")}</button><strong>${year}</strong><button class="icon rotate-180" data-action="timelineYear" data-id="1" aria-label="Año siguiente">${svg("back")}</button></div>` +
    summary +
    (plan.latePayment
      ? `<section class="card danger-zone"><strong>Tienes cuotas atrasadas</strong><p class="note">${plan.lateCount} ${plan.lateCount === 1 ? "cuota" : "cuotas"} por ${money(plan.latePayment)} de meses anteriores. La fecha de libertad supone ponerte al día.</p>${btn("Revisar deudas", "tab", "debt", "full")}</section>`
      : "") +
    (noDate.length
      ? `<section class="card danger-zone"><strong>Deudas sin cuota</strong><p class="note">${noDate.length} ${noDate.length === 1 ? "deuda no tiene" : "deudas no tienen"} una cuota definida; no podemos calcular su fecha final.</p>${btn("Revisar deudas", "tab", "debt", "full")}</section>`
      : "") +
    (plan.archivedCount
      ? `<section class="card"><strong>${plan.archivedCount} ${plan.archivedCount === 1 ? "deuda archivada" : "deudas archivadas"} con saldo</strong><p class="note">${money(plan.archivedBalance)} no se incluye en la fecha de libertad porque no genera pagos. Reactívala en Deudas para retomarla.</p>${btn("Revisar deudas", "tab", "debt", "full")}</section>`
      : "") +
    (rows.length
      ? `<section class="card debt-plan">
          <div class="row"><div><h2>Calendario de deudas</h2><small class="muted">Cada barra es una deuda; no suma gastos fijos.</small></div></div>
          <div class="timeline-months" aria-hidden="true">${months.map((month) => `<span>${shortMonth(month).replace(".", "")}</span>`).join("")}</div>
          ${rows.map((row) => planRow(row, year)).join("")}
          <div class="timeline-legend"><span><i class="legend-swatch paid"></i>Pagado</span><span><i class="legend-swatch due"></i>Este mes</span><span><i class="legend-swatch future"></i>Pendiente</span><span><i class="legend-swatch estimated"></i>Estimado</span><span><i class="legend-swatch overdue"></i>Vencido</span></div>
          ${plan.capitalOnly ? '<p class="note">Hay deudas en modo capital: el saldo no incluye intereses futuros.</p>' : ""}
          ${plan.unassigned ? `<p class="note">${money(plan.unassigned)} abonados sin asignar: reducen el saldo, pero no marcan cuotas hasta aplicarlos.</p>` : ""}
        </section>`
      : `<section class="card">${empty("Sin deudas con vencimiento", "Cuando registres un MSI o un préstamo, aquí verás cuándo termina.")}${btn("Ver todas las deudas", "tab", "debt", "full")}</section>`) +
    `<details class="fine-print"><summary>Cómo se calcula</summary><p>Solo MSI, diferimientos y préstamos con cuotas. Los gastos fijos y las compras revolventes de tarjeta no forman parte de esta ruta. La fecha final usa las cuotas registradas y no incluye intereses futuros ni cambios de contrato. Las barras rayadas son una estimación basada en el saldo y la cuota actuales.</p></details>`
  );
}
