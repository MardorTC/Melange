import C from "../domain/finance.js";
import { model } from "../state/model.js";
import {
  metric,
  money,
  svg,
  btn,
  empty,
  mlabel,
  esc,
  icon,
} from "../ui/components.js";
import { donut, lineChart } from "../ui/charts.js";

export function homePage() {
  const m = C.metrics(model.state),
    items = C.obligations(model.state)
      .filter((i) => !i.paid)
      .sort((a, b) => a.date.localeCompare(b.date)),
    accounts = C.accountSummary(model.state).filter((a) => a.active !== false),
    debts = model.state.debts.filter((d) => !d.archived),
    debtTotal = debts.reduce((sum, d) => sum + d.balance, 0),
    firstGoal = model.state.goals[0],
    goalPct = firstGoal?.target
      ? Math.min(100, (firstGoal.balance / firstGoal.target) * 100)
      : 0,
    hist = model.state.liquidityHistory,
    delta = hist.length > 1 ? hist.at(-1).value - hist[0].value : null;

  return `<div class="home-heading"><div><div class="eyebrow">${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div><h1>Cada grano cuenta.</h1></div></div>
<section class="card hero home-hero">
  <div class="home-hero-top"><div><span>Disponible libre</span>${metric(m.available, "available")}<strong class="home-ready">Sin reservas ni dinero congelado</strong></div>${btn("Ver cuentas", "tab", "accounts", "hero-link")}</div>
  <div class="hero-bottom">
    <div class="hero-account"><span class="visual-icon neutral">${svg("bank")}</span><div><small>En débito</small><strong>${money(m.debit)}</strong></div></div>
    <div class="hero-account"><span class="visual-icon cash">${svg("cash")}</span><div><small>En efectivo</small><strong>${money(m.cash)}</strong></div></div>
  </div>
</section>
<div class="quick home-actions">
  <button data-action="income"><span class="icon">${svg("plus")}</span>Nuevo ingreso</button>
  <button data-action="expense"><span class="icon">${svg("minus")}</span>Nuevo gasto</button>
  <button data-action="transfer"><span class="icon">${svg("transfer")}</span>Transferir</button>
</div>
<div class="grid home-summary">
  <div class="card accent home-summary-card"><span class="visual-icon warning">${svg("calendarCheck")}</span><div><small>Pendiente del mes</small>${metric(m.pending, "pending", "small")}<p class="note">${money(m.paid)} ya pagados</p></div></div>
  <div class="card sage home-summary-card"><span class="visual-icon success">${svg("checkCircle")}</span><div><small>Pagado este mes</small>${metric(m.paid, "paidHome", "small")}<p class="note">${m.fixed + m.debt ? Math.min(100, Math.round((m.paid / (m.fixed + m.debt)) * 100)) : 0}% de tus compromisos</p></div></div>
</div>
<div class="home-two-col">
  <section class="card home-upcoming"><div class="row"><h2>Próximos a vencer</h2>${btn("Ver todos", "tab", "calendar", "link-btn")}</div>${items.length ? items.slice(0, 4).map(paymentRow).join("") : empty("Al día", "No hay compromisos pendientes este mes.")}</section>
  <section class="card home-spending"><div class="row"><h2>En qué se fue tu dinero</h2><small>${mlabel(C.month())}</small></div>${donut(model.state.transactions.filter((t) => C.month(t.date) === C.month() && ["expense", "fixed"].includes(t.kind)))}${btn("Ver más detalles", "tab", "expense", "link-btn")}</section>
</div>
<section class="card home-accounts"><div class="row"><h2>Cuentas</h2>${btn("Ver todas", "tab", "accounts", "link-btn")}</div><div class="account-preview-list">${
    accounts.length
      ? accounts
          .slice(0, 3)
          .map((a) => accountPreview(a))
          .join("")
      : empty("Sin cuentas", "Agrega una cuenta para separar tu dinero.")
  }</div></section>
<div class="grid home-links">
  <section class="card home-link-card"><span class="visual-icon debt">${svg("card")}</span><div><small>Deudas</small><div class="metric small">${money(debtTotal)}</div><p class="note">${debts.filter((d) => d.balance > 0).length} activas</p></div>${btn("Ver", "tab", "debt", "round-link")}</section>
  <section class="card home-link-card"><span class="visual-icon goal">${svg("goal")}</span><div><small>Metas de ahorro</small><div class="metric small">${money(firstGoal?.balance || m.reserved)}</div><p class="note">${firstGoal ? `de ${money(firstGoal.target)}` : `${money(m.reserved)} reservado`}</p>${firstGoal ? `<div class="bar mini"><span style="width:${goalPct}%"></span></div>` : ""}</div>${btn("Ver", "tab", "goal", "round-link")}</section>
</div>
<section class="card home-secondary"><div class="row"><h2>Las huellas de tu dinero</h2><span class="pill">${hist.length} ${model.state.reconstruction ? "saldos calculados" : "observaciones"}</span></div>${lineChart(hist)}<p class="note">${delta === null ? "Aún no hay suficientes puntos históricos." : `${money(delta)} de variación entre el primer y último saldo registrado.`} No equivale a ahorro mensual.</p></section>
<section class="card home-secondary"><h2>Salud financiera</h2><div class="split"><div><small>Deuda / ingreso previsto</small><div class="metric">${m.dti === null ? "—" : m.dti.toFixed(1) + "%"}</div></div><div><small>Libre antes de variables</small>${metric(m.budgetFree, "free", "small")}</div></div><div class="bar"><span style="width:${Math.max(0, Math.min(100, ((m.fixed + m.debt) / Math.max(1, m.income)) * 100))}%"></span></div><p class="note">Compromisos: ${money(m.fixed + m.debt)} · Ingreso previsto: ${money(m.income)}. Pagar una cuota no cambia estos compromisos.</p>${btn("Explorar proyección", "projection", "", "full")}</section>`;
}

function accountPreview(a) {
  const iconName =
    a.type === "cash" ? "cash" : a.type === "restricted" ? "ticket" : "bank";
  const label =
    a.type === "cash"
      ? "Efectivo"
      : a.type === "restricted"
        ? "Uso restringido"
        : "Débito";
  return `<button class="account-preview" data-action="tab" data-id="accounts"><span class="visual-icon ${a.type === "cash" ? "success" : a.type === "restricted" ? "warning" : "neutral"}">${svg(iconName)}</span><span class="account-copy"><strong>${esc(a.name)}</strong><small>${label}</small></span><strong class="account-amount">${money(a.total)}</strong><span class="account-chevron">${svg("chevron")}</span></button>`;
}

export function paymentRow(i) {
  const itemIcon = i.kind === "debt" ? "card" : "receipt";
  return `<div class="item row payment-item"><span class="visual-icon item-icon">${svg(itemIcon)}</span><div class="payment-copy"><div class="item-title">${esc(i.name)}</div><p class="muted">${i.date}${i.n ? " · Cuota " + i.n : ""} ${i.date < C.today() && !i.paid ? '<span class="bad">· Vencido</span>' : ""}</p></div><div class="payment-amount"><div class="amount">${money(i.paid ? i.amount : (i.remaining ?? i.amount))}</div>${i.recorded && !i.paid ? "<small>Abono: " + money(i.recorded) + "</small>" : ""}${i.paid ? '<span class="pill good">Pagado</span>' : icon("pay", "Registrar pago", "pay", i.key, `data-period="${i.date.slice(0, 7)}"`)}</div></div>`;
}
