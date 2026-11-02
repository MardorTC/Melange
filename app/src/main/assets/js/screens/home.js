import C from "../domain/finance.js";
import { model } from "../state/model.js";
import {
  money,
  svg,
  btn,
  empty,
  mlabel,
  esc,
  kindName,
  dlabel,
} from "../ui/components.js";
import { donut, lineChart } from "../ui/charts.js";
import { debtBreakdown, debtPlan } from "../domain/debt-plan.js";

const monthLong = (month) =>
  new Date(month + "-15T12:00:00").toLocaleDateString("es-MX", {
    month: "long",
  });

const shortDate = (date) => dlabel(date, false);

export function homePage() {
  const m = C.metrics(model.state),
    items = C.obligations(model.state)
      .filter((i) => !i.paid)
      .sort((a, b) => a.date.localeCompare(b.date)),
    accounts = C.accountSummary(model.state).filter((a) => a.active !== false),
    breakdown = debtBreakdown(model.state),
    fundedGoals = model.state.goals.filter((goal) => goal.balance > 0).length,
    plan = debtPlan(model.state),
    hist = model.state.liquidityHistory,
    delta = hist.length > 1 ? hist.at(-1).value - hist[0].value : null,
    creditAvailable = model.state.creditCards
      .filter((c) => c.active !== false)
      .reduce((n, c) => n + C.creditSummary(model.state, c.id).available, 0),
    saved = m.reserved + m.frozen,
    margin = m.available - m.pending,
    justStarted =
      !model.state.transactions.length &&
      !model.state.debts.length &&
      !model.state.fixedExpenses.length;

  return `<section class="home-hero">
  <img class="hero-art" src="art/dunes.svg" alt="" aria-hidden="true">
  <div class="home-top">
    <div class="home-wordmark"><img src="logo.png" alt=""><span>Melange</span></div>
    <button class="icon glass" data-action="settings" aria-label="Ajustes" title="Ajustes">${svg("settings")}</button>
  </div>
  <div class="home-intro">
    <h1>Cada grano cuenta.</h1>
  </div>
  <div class="balance">
    <span class="balance-label">Tu dinero disponible</span>
    <div class="balance-value" data-metric="available" data-value="${m.available}">${money(m.available)}</div>
    <p class="balance-hint">${saved ? "Ya excluye reservas y dinero congelado." : "Dinero propio, no crédito."}</p>
  </div>
  <div class="home-outlook">
    <div><span>Pagos pendientes de ${monthLong(C.month())}</span><strong data-testid="home-pending">${money(m.pending)}</strong></div>
    <div class="outlook-margin"><span>Tras cubrir esos pagos</span><strong class="${margin < 0 && !plan.unassigned ? "bad" : ""}" data-testid="home-margin">${plan.unassigned ? "Revisar pagos de tarjeta" : money(margin)}</strong></div>
    <p>${plan.unassigned ? `Hay ${money(plan.unassigned)} en pagos de tarjeta sin desglose. Indica qué cargos cubrió el banco para calcular el margen.` : "Estimación con lo que tienes hoy. Aún faltan tus compras futuras y pagos de otros meses; no incluye ingresos previstos."}</p>
  </div>
</section>
<div class="home-body">
  <div class="quick card" aria-label="Acciones rápidas">
    <button data-action="income" aria-label="Nuevo ingreso"><span class="icon">${svg("plus")}</span>Ingreso</button>
    <button data-action="expense" aria-label="Nuevo gasto"><span class="icon">${svg("minus")}</span>Gasto</button>
    <button data-action="transfer" aria-label="Transferir"><span class="icon">${svg("transfer")}</span>Transferir</button>
    <button data-action="choosePayment" aria-label="Pagar un compromiso"><span class="icon">${svg("pay")}</span>Pagar</button>
  </div>
   ${justStarted ? `<section class="card first-steps"><h2>Empieza con algo de hoy</h2><p class="note">Registra una compra para ver cómo cambia tu dinero. Después puedes añadir renta, servicios o deudas.</p>${btn("Registrar primer gasto", "expense", "", "primary full")}</section>` : ""}
  ${plan.latePayment ? `<section class="card danger-zone"><div class="row"><div><strong>Tienes cuotas atrasadas</strong><p class="note">${plan.lateCount} ${plan.lateCount === 1 ? "cuota" : "cuotas"} por ${money(plan.latePayment)} de meses anteriores.</p></div><span class="pill bad">Revisar</span></div>${btn("Ver deudas", "tab", "debt", "full")}</section>` : ""}
  <div class="section-head"><h2>Pagos de este mes</h2><button class="text-action" data-action="tab" data-id="calendar">Calendario</button></div>
  <section class="card list">${items.length ? items.slice(0, 3).map(paymentRow).join("") : empty("Sin pagos pendientes registrados este mes", "Puedes agregar servicios y suscripciones desde Movimientos.")}</section>
  ${breakdown.total || m.reserved ? '<div class="section-head"><h2>Deudas y metas</h2></div>' : ""}
  <div class="home-summaries">
    ${
      breakdown.total
        ? `
    <section class="card rail-card debt-snapshot">
      <span class="rail-label">Deuda total</span>
      <div class="metric">${money(breakdown.total)}</div>
      <p class="note">${breakdown.activeCount} ${breakdown.activeCount === 1 ? "deuda activa" : "deudas activas"}</p>
      <div class="rail-footer"><div><small>Libre de cuotas</small><strong>${plan.debtFreeMonth ? mlabel(plan.debtFreeMonth) : "Sin fecha planificada"}</strong></div>${breakdown.total ? `<button class="rail-link" data-action="timeline">Ver ruta →</button>` : ""}</div>
    </section>`
        : ""
    }
    ${
      m.reserved
        ? `
    <section class="card rail-card goal-snapshot">
      <span class="rail-label">Metas de ahorro</span>
      <div class="metric">${money(m.reserved)}</div>
      <p class="note">${fundedGoals === 1 ? "Reservado en tu meta." : `Repartido entre ${fundedGoals} metas.`}</p>
      <div class="rail-footer"><button class="rail-link" data-action="tab" data-id="goal">Ver metas →</button></div>
    </section>`
        : ""
    }
  </div>
  <details class="card home-spending"><summary>En qué se fue tu dinero · ${mlabel(C.month())}</summary>${donut(model.state.transactions.filter((t) => C.month(t.date) === C.month() && ["expense", "fixed"].includes(t.kind)))}${btn("Ver movimientos", "tab", "expense", "link-btn")}</details>
  <div class="section-head"><h2>Cuentas</h2><button class="text-action" data-action="tab" data-id="accounts" data-account-sub="wallet">Ver todas</button></div>
  <section class="card account-list">${
    accounts.length
      ? accounts
          .slice(0, 3)
          .map((a) => accountPreview(a))
          .join("")
      : empty("Sin cuentas", "Agrega una cuenta para separar tu dinero.")
  }</section>
  <button class="card hero-account credit-access" data-action="tab" data-id="accounts" data-account-sub="credit"><span>${svg("card")}</span><span><strong>${creditAvailable < 0 ? "Crédito excedido" : "Crédito disponible"}: ${money(creditAvailable)}</strong><small>Es dinero prestado; no forma parte de tu disponible.</small></span>${svg("chevron")}</button>
  <details class="card analysis"><summary>Ver análisis del mes</summary><div class="home-analysis-body"><div class="row"><h2>Las huellas de tu dinero</h2><span class="pill">${hist.length} observaciones</span></div>${lineChart(hist)}<p class="note">${delta === null ? "Aún no hay suficientes puntos históricos." : `${money(delta)} de variación entre el primer y último saldo registrado.`} No equivale a ahorro mensual.</p><div class="health-grid"><div><small>Ingresos recibidos</small><strong class="good">${money(m.received)}</strong></div><div><small>Pagos y gastos desde tus cuentas</small><strong>${money(m.outflow)}</strong></div><div><small>Diferencia del mes</small><strong class="${m.received - m.outflow < 0 ? "bad" : "good"}">${money(m.received - m.outflow)}</strong></div><div><small>Compromisos ya pagados</small><strong>${money(m.paid)}</strong></div></div><p class="note">Los pagos de tarjeta salen de tus cuentas. Las compras a crédito cuentan en consumo, pero no son salidas hasta pagarlas. Transferencias, ajustes y capital prestado o recuperado no cuentan como ingresos ni gastos.</p>${btn("Revisar pendientes", "tab", "calendar", "full")}</div></details>
</div>`;
}

function accountPreview(a) {
  const iconName =
    a.type === "cash" ? "cash" : a.type === "restricted" ? "ticket" : "bank";
  const label =
    a.type === "cash"
      ? "Cuenta de efectivo"
      : a.type === "restricted"
        ? "Uso restringido"
        : "Cuenta bancaria";
  return `<button class="account-row" data-action="tab" data-id="accounts" data-account-sub="wallet"><span class="row-icon ${a.type === "cash" ? "green" : a.type === "restricted" ? "gray" : "gray"}">${svg(iconName)}</span><span class="account-copy"><strong>${esc(a.name)}</strong><small>${label}</small></span><strong class="account-amount">${money(a.total)}</strong><span class="account-chevron">${svg("chevron")}</span></button>`;
}

export function paymentRow(i) {
  const kindIcon =
      i.kind === "debt" || i.kind === "card_payment" ? "card" : "receipt",
    overdue = i.date < C.today() && !i.paid,
    sub = `${shortDate(i.date)} · ${i.kind === "card_payment" ? "Pago de tarjeta" : kindName(i.kind)}${i.n ? " · Cuota " + i.n : ""}`,
    content = `<span class="row-icon ${i.kind === "income" ? "green" : i.kind === "card_payment" ? "blue" : ""}">${svg(kindIcon)}</span><span class="payment-copy"><strong>${esc(i.name)}</strong><small class="${overdue ? "bad" : ""}">${sub}${overdue ? " · Vencido" : ""}</small></span><span class="payment-amount"><strong>${money(i.paid ? i.amount : (i.remaining ?? i.amount))}</strong><small class="${overdue ? "bad" : ""}">${i.paid ? "Pagado" : i.recorded ? "Abono " + money(i.recorded) : "Pagar"}</small></span><span class="row-chevron">${i.paid ? "" : svg("chevron")}</span>`;
  return i.paid
    ? `<div class="payment-row">${content}</div>`
    : `<button class="payment-row" data-action="pay" data-id="${esc(i.key)}" data-period="${i.date.slice(0, 7)}" aria-label="Registrar pago de ${esc(i.name)}">${content}</button>`;
}
