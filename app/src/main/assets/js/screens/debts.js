import { receivablesPage } from "./receivables.js";
import { model } from "../state/model.js";
import {
  icon,
  esc,
  debtType,
  money,
  empty,
  svg,
  btn,
  mlabel,
  dlabel,
  screenHead,
} from "../ui/components.js";
import C from "../domain/finance.js";
import { debtBreakdown, debtPlan } from "../domain/debt-plan.js";

export function debtsPage() {
  const selected = model.debtSub || "owe";
  const tabs = `<div class="segmented" role="tablist" aria-label="Tipo de deuda"><button class="${selected === "owe" ? "active" : ""}" role="tab" aria-selected="${selected === "owe"}" data-action="debtSub" data-id="owe">Debo</button><button class="${selected === "owed" ? "active" : ""}" role="tab" aria-selected="${selected === "owed"}" data-action="debtSub" data-id="owed">Me deben</button></div>`;
  const heading = screenHead(
    "Deudas",
    "MSI, préstamos y tarjetas.",
    selected === "owe"
      ? { action: "editDebt", actionLabel: "Agregar deuda" }
      : { action: "loanCreate", actionLabel: "Registrar préstamo" },
  );
  if (selected === "owed") return heading + tabs + receivablesPage();

  const breakdown = debtBreakdown(model.state),
    plan = debtPlan(model.state),
    loans = breakdown.loans,
    settled = model.state.debts.filter((d) => d.balance === 0 && !d.archived),
    otherDebt =
      breakdown.cards.reduce((n, c) => n + c.summary.purchases, 0) +
      model.state.debts
        .filter((d) => !d.archived && d.balance > 0 && d.type === "revolving")
        .reduce((n, d) => n + d.balance, 0),
    noDateCount = plan.rows.filter((row) => !row.end).length,
    parts = [
      loans.length
        ? `${loans.length} ${loans.length === 1 ? "préstamo" : "préstamos"}`
        : "",
      breakdown.cards.length
        ? `${breakdown.cards.length} ${breakdown.cards.length === 1 ? "tarjeta" : "tarjetas"}`
        : "",
      otherDebt ? `${money(otherDebt)} en compras` : "",
      noDateCount ? `${noDateCount} sin cuota` : "",
      breakdown.archivedCount
        ? `${breakdown.archivedCount} archivada${breakdown.archivedCount === 1 ? "" : "s"}`
        : "",
    ].filter(Boolean);

  return (
    heading +
    tabs +
    `<section class="card debt-summary">
      <small>Deuda total</small>
      <div class="metric">${money(breakdown.total)}</div>
      <p class="note">${parts.length ? parts.join(" · ") : "Sin deudas activas"}</p>
      <div class="hero-split">
        <div><small>Libre de cuotas</small><strong class="free-date">${plan.debtFreeMonth ? mlabel(plan.debtFreeMonth) : "Sin fecha"}</strong></div>
        <div><small>Cuota normal</small><strong>${money(plan.monthlyPayment)}</strong></div>
      </div>
      <div class="debt-summary-actions"><small>${plan.thisMonthRemaining ? `${money(plan.thisMonthRemaining)} resta este mes` : "Sin cuotas pendientes este mes"}</small>${breakdown.total ? `<button data-action="timeline">Ver ruta →</button>` : ""}</div>
    </section>` +
    (plan.latePayment
      ? `<section class="card danger-zone"><div class="row"><div><strong>Cuotas atrasadas</strong><p class="note">${plan.lateCount} ${plan.lateCount === 1 ? "cuota" : "cuotas"} por ${money(plan.latePayment)} de meses anteriores.</p></div><span class="pill bad">Revisar</span></div></section>`
      : "") +
    (breakdown.cards.length
      ? `<div class="section-head"><h2>Tarjetas de crédito</h2><button class="text-action" data-action="creditEdit">Agregar</button></div><section class="card debt-group">${breakdown.cards.map((c) => cardRow(c, plan)).join("")}</section>`
      : "") +
    (loans.length
      ? `<div class="section-head"><h2>Préstamos y otras deudas</h2></div>${loans.map((d) => debtCard(d, plan)).join("")}`
      : "") +
    (settled.length
      ? `<details class="card settled-list"><summary>Deudas liquidadas (${settled.length})</summary>${settled.map((d) => debtCard(d, plan)).join("")}</details>`
      : "") +
    (!breakdown.total
      ? `<section class="card">${empty("Tus deudas, en orden", "Agrega un préstamo o un MSI para ver su saldo y su fecha final.")}</section>`
      : "") +
    `<details class="fine-print"><summary>Cómo se calcula</summary><p>Los MSI de tarjeta se muestran dentro de su tarjeta para no contarlos dos veces. La ruta de cuotas calcula la fecha final con las cuotas registradas; las compras revolventes se ven en el saldo de la tarjeta.</p></details>`
  );
}

const shortDate = (date) => dlabel(date, false);

function cardRow({ card, summary, installments }, plan) {
  const next = C.creditPeriods(model.state, card.id)
    .map((period) => C.creditStatement(model.state, card.id, period))
    .find((item) => !item.paid && item.amount);
  const pct = card.limit ? Math.min(100, (summary.used / card.limit) * 100) : 0,
    msi = plan.rows.filter((row) => row.cardId === card.id),
    overdue = next && next.date < C.today();
  return `<div class="credit-debt-row"><span class="visual-icon debt">${svg("card")}</span><div class="credit-debt-copy"><button class="credit-title-btn" data-action="creditDetails" data-id="${esc(card.id)}">${esc(card.name)}</button><small>${installments.length ? `${installments.length} MSI ${installments.length === 1 ? "vinculado" : "vinculados"}` : "Compras y saldo revolvente"}${next ? ` · ${overdue ? "vencido" : "próximo"} ${shortDate(next.date)}` : ""}</small><div class="bar mini"><span style="--p:${pct}%"></span></div></div><div class="credit-debt-side"><strong>${money(summary.used)}</strong>${next && summary.used > 0 ? `<button class="text-action" data-action="creditPay" data-id="${esc(card.id)}">Pagar</button>` : ""}</div></div>${
    msi.length
      ? `<details class="more-actions msi-details"><summary>${msi.length} MSI: cuotas y fechas</summary>${msi.map((row) => `<div class="msi-row"><span>${esc(row.name)}<small>${money(row.payment)}/mes · termina ${row.end ? mlabel(row.end) : "sin fecha"}${row.partial ? ` · faltan ${money(row.currentRemaining)} de esta cuota` : ""}</small></span><strong>${money(row.balance)}</strong></div>`).join("")}</details>`
      : ""
  }`;
}

function debtCard(d, plan) {
  const paid = d.paidPayments.length,
    pct = d.totalPayments
      ? Math.min(100, (paid / d.totalPayments) * 100)
      : d.originalAmount
        ? Math.max(0, Math.min(100, (1 - d.balance / d.originalAmount) * 100))
        : 0,
    next = nextDebt(d),
    liquidated = d.balance === 0,
    row = plan.rows.find((row) => row.id === d.id),
    creditor =
      model.state.creditCards.find((c) => c.id === d.creditCardId)?.name ||
      model.state.creditors.find((a) => a.id === d.creditorId)?.name ||
      "Sin acreedor";

  if (liquidated)
    return `<section class="card debt-settled"><span class="debt-type-icon success">${svg("checkCircle")}</span><div><h2>${esc(d.name)}</h2><span class="pill good">Liquidada</span></div><button class="btn link-btn" data-action="debtDetails" data-id="${esc(d.id)}">Ver detalles</button>${icon("edit", "Editar deuda", "editDebt", d.id)}</section>`;

  return `<section class="card debt-card"><div class="debt-type-icon">${svg(debtIcon(d.type))}</div><div class="debt-card-content"><div class="debt-card-title"><div><h2>${esc(d.name)}</h2><small>${esc(creditor)} · ${esc(debtType(d.type))}</small></div><span class="pill ${d.archived ? "" : row?.needsReview ? "bad" : "debt-active"}">${d.archived ? "Archivada" : row?.needsReview ? "Revisar" : "Activa"}</span></div><div class="debt-numbers"><div><small>Saldo pendiente</small><div class="metric">${money(d.balance)}</div></div><div><small>Cuota</small><strong>${d.payment ? money(d.payment) : "Sin cuota"}</strong></div></div><div class="bar debt-progress"><span style="--p:${pct}%"></span></div><div class="debt-meta"><small>${d.totalPayments ? `${paid} de ${d.totalPayments} cuotas` : "Sin plazo fijo"}</small><small>${next ? `Próximo: ${dlabel(next.date, false)}` : "Sin próximo pago"}${row?.end ? ` · Termina ${mlabel(row.end)}` : ""}</small></div><div class="debt-card-actions">${
    d.archived
      ? btn("Reactivar", "debtUnarchive", d.id, "primary debt-pay")
      : next
        ? `<button class="btn primary debt-pay" data-action="pay" data-id="${esc(next.key)}" data-period="${next.date.slice(0, 7)}">Registrar pago</button>`
        : ""
  }<button class="btn debt-details" data-action="debtDetails" data-id="${esc(d.id)}">Ver detalles ${svg("chevron")}</button><div class="debt-tools">${icon("edit", "Editar deuda", "editDebt", d.id)}${icon("trash", "Eliminar o archivar deuda", "deleteDebt", d.id)}</div></div></div></section>`;
}

function debtIcon(type) {
  if (type === "loan" || type === "loan-open") return "wallet";
  if (type === "deferred") return "calendarCheck";
  return "card";
}

export function nextDebt(d) {
  if (d.archived || d.balance <= 0) return null;
  let start = d.totalPayments && d.startDate ? C.month(d.startDate) : C.month(),
    count = d.totalPayments || 12;
  for (let n = 0; n < count; n++) {
    const i = C.schedule(d, C.addMonth(start, n));
    if (i && !C.isPaid(model.state, i)) return i;
  }
  return null;
}
