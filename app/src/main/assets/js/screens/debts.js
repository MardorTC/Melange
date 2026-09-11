import { receivablesPage } from "./receivables.js";
import { model } from "../state/model.js";
import {
  icon,
  metric,
  esc,
  debtType,
  money,
  empty,
  svg,
} from "../ui/components.js";
import C from "../domain/finance.js";

export function debtsPage() {
  const selected = model.debtSub || "owe";
  const tabs = `<div class="debt-segments" role="tablist" aria-label="Tipo de deuda"><button class="debt-segment ${selected === "owe" ? "active" : ""}" role="tab" aria-selected="${selected === "owe"}" data-action="debtSub" data-id="owe">Debo</button><button class="debt-segment ${selected === "owed" ? "active" : ""}" role="tab" aria-selected="${selected === "owed"}" data-action="debtSub" data-id="owed">Me deben</button></div>`;
  const heading = `<div class="debt-page-heading"><div><h1>Deudas</h1><p>Tus préstamos, compras y pagos en un solo lugar.</p></div>${selected === "owe" ? icon("plus", "Agregar deuda", "editDebt") : ""}</div>`;
  if (selected === "owed") return heading + tabs + receivablesPage();

  const visible = model.state.debts.filter((d) => !d.archived),
    total = visible.reduce((a, d) => a + d.balance, 0),
    activeCount = visible.filter((d) => d.balance > 0).length,
    paidCount = visible.filter((d) => d.balance === 0).length;

  return `${heading}${tabs}<section class="card hero debt-hero"><small>Saldo total pendiente</small>${metric(total, "debtTotal")}<p>${visible.length} ${visible.length === 1 ? "deuda" : "deudas"} · ${activeCount} ${activeCount === 1 ? "activa" : "activas"}${paidCount ? `, ${paidCount} ${paidCount === 1 ? "liquidada" : "liquidadas"}` : ""}</p></section><div class="debt-list-heading"><h2>Mis deudas</h2></div>${
    model.state.debts.length
      ? model.state.debts
          .map((d) => ({ d, date: nextDebt(d)?.date || "9999-12-31" }))
          .sort(
            (a, b) =>
              Number(a.d.balance === 0) - Number(b.d.balance === 0) ||
              a.date.localeCompare(b.date) ||
              a.d.name.localeCompare(b.d.name),
          )
          .map(({ d }) => debtCard(d))
          .join("")
      : empty(
          "Tus deudas, en orden",
          "Agrega una deuda para organizar sus cuotas.",
        )
  }`;
}

function debtCard(d) {
  const paid = d.paidPayments.length,
    pct = d.totalPayments
      ? Math.min(100, (paid / d.totalPayments) * 100)
      : d.originalAmount
        ? Math.max(0, Math.min(100, (1 - d.balance / d.originalAmount) * 100))
        : 0,
    next = nextDebt(d),
    liquidated = d.balance === 0,
    creditor =
      model.state.creditors.find((a) => a.id === d.creditorId)?.name ||
      "Sin acreedor";

  if (liquidated)
    return `<section class="card debt-settled"><span class="debt-type-icon success">${svg("checkCircle")}</span><div><h2>${esc(d.name)}</h2><span class="pill good">Liquidada</span></div><button class="btn link-btn" data-action="debtDetails" data-id="${esc(d.id)}">Ver detalles</button>${icon("edit", "Editar deuda", "editDebt", d.id)}</section>`;

  return `<section class="card debt-card ${liquidated ? "is-paid" : ""}"><div class="debt-type-icon ${liquidated ? "success" : ""}">${svg(debtIcon(d.type))}</div><div class="debt-card-content"><div class="debt-card-title"><div><h2>${esc(d.name)}</h2><small>${esc(creditor)} · ${esc(debtType(d.type))}</small></div><span class="pill ${liquidated ? "good" : "debt-active"}">${d.archived ? "Archivada" : liquidated ? "Liquidada" : "Activa"}</span></div><div class="debt-numbers"><div><small>Saldo pendiente</small><div class="metric">${money(d.balance)}</div></div><div><small>Pago habitual</small><strong>${money(d.payment)}</strong></div></div><div class="bar debt-progress"><span style="width:${liquidated ? 100 : pct}%"></span></div><div class="debt-meta"><small>${d.totalPayments ? `${paid} de ${d.totalPayments} cuotas` : "Sin plazo fijo"}</small><small>${next ? "Próximo: " + next.date : liquidated ? "Sin pagos pendientes" : "Sin fecha próxima"}</small></div></div><div class="debt-card-actions">${next ? `<button class="btn primary debt-pay" data-action="pay" data-id="${esc(next.key)}" data-period="${next.date.slice(0, 7)}">Registrar pago</button>` : ""}<button class="btn debt-details" data-action="debtDetails" data-id="${esc(d.id)}">Ver detalles ${svg("chevron")}</button><div class="debt-tools">${icon("edit", "Editar deuda", "editDebt", d.id)}${icon("trash", "Eliminar o archivar deuda", "deleteDebt", d.id)}</div></div></section>`;
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
