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
    plan = debtPlan(model.state),
    noDateCount = plan.rows.filter((row) => !row.end).length,
    firstGoal = model.state.goals[0],
    goalPct = firstGoal?.target
      ? Math.min(100, (firstGoal.balance / firstGoal.target) * 100)
      : 0,
    hist = model.state.liquidityHistory,
    delta = hist.length > 1 ? hist.at(-1).value - hist[0].value : null,
    creditAvailable = model.state.creditCards
      .filter((c) => c.active !== false)
      .reduce((n, c) => n + C.creditSummary(model.state, c.id).available, 0),
    monthTotal = m.paid + m.pending,
    monthPct = monthTotal ? Math.min(100, (m.paid / monthTotal) * 100) : 0,
    saved = m.reserved + m.frozen;

  return `<section class="home-hero">
  <img class="hero-art" src="art/dunes.svg" alt="" aria-hidden="true">
  <div class="home-top">
    <div class="home-wordmark"><img src="logo.png" alt=""><span>Melange</span></div>
    <button class="icon glass" data-action="settings" aria-label="Ajustes" title="Ajustes">${svg("settings")}</button>
  </div>
  <div class="home-intro">
    <div class="eyebrow">${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div>
    <h1>Cada grano cuenta.</h1>
  </div>
  <div class="balance">
    <span class="balance-label">Disponible libre</span>
    <div class="balance-value" data-metric="available" data-value="${m.available}">${money(m.available)}</div>
    <p class="balance-hint">${saved ? "Sin contar lo reservado ni lo congelado." : "Todo tu dinero, sin reservas."}</p>
  </div>
  <div class="hero-accounts">
    <button class="hero-account" data-action="tab" data-id="accounts"><span class="hero-mini-icon">${svg("bank")}</span><small>Débito</small><strong>${money(m.debit)}</strong></button>
    <button class="hero-account" data-action="tab" data-id="accounts"><span class="hero-mini-icon">${svg("cash")}</span><small>Efectivo</small><strong>${money(m.cash)}</strong></button>
    <button class="hero-account" data-action="tab" data-id="accounts"><span class="hero-mini-icon">${svg("card")}</span><small>${creditAvailable < 0 ? "Crédito excedido" : "Crédito"}</small><strong class="${creditAvailable < 0 ? "bad" : ""}">${money(creditAvailable)}</strong></button>
  </div>
</section>
<div class="home-body">
  <div class="quick card" aria-label="Acciones rápidas">
    <button data-action="income" aria-label="Nuevo ingreso"><span class="icon">${svg("plus")}</span>Ingreso</button>
    <button data-action="expense" aria-label="Nuevo gasto"><span class="icon">${svg("minus")}</span>Gasto</button>
    <button data-action="transfer" aria-label="Transferir"><span class="icon">${svg("transfer")}</span>Transferir</button>
    <button data-action="choosePayment" aria-label="Pagar un compromiso"><span class="icon">${svg("pay")}</span>Pagar</button>
  </div>
  <div class="section-head"><h2>Este mes</h2><button class="text-action" data-action="tab" data-id="calendar">Calendario</button></div>
  <section class="card month-card">
    <div class="month-top"><div><div class="eyebrow">Compromisos</div><h2>${monthLong(C.month())}</h2></div><span class="month-badge">${Math.round(monthPct)}% pagado</span></div>
    <div class="month-figures"><div><small>Pendiente</small><strong>${money(m.pending)}</strong></div><div><small>Pagado</small><strong>${money(m.paid)}</strong></div></div>
    <div class="month-progress"><div class="bar"><span style="--p:${monthPct}%"></span></div><small>${monthTotal ? `${money(m.paid)} pagado de ${money(monthTotal)}` : "Sin compromisos registrados"}</small>${plan.unassigned ? `<small class="note">${money(plan.unassigned)} abonados sin asignar; no cuentan como pagado hasta aplicarlos.</small>` : ""}</div>
  </section>
  ${plan.latePayment ? `<section class="card danger-zone"><div class="row"><div><strong>Tienes cuotas atrasadas</strong><p class="note">${plan.lateCount} ${plan.lateCount === 1 ? "cuota" : "cuotas"} por ${money(plan.latePayment)} de meses anteriores.</p></div><span class="pill bad">Revisar</span></div>${btn("Ver deudas", "tab", "debt", "full")}</section>` : ""}
  <div class="section-head"><h2>Próximos a vencer</h2><button class="text-action" data-action="tab" data-id="calendar">Ver todos</button></div>
  <section class="card list">${items.length ? items.slice(0, 3).map(paymentRow).join("") : empty("Al día", "No hay compromisos pendientes este mes.")}</section>
  <div class="section-head"><h2>Tu panorama</h2><small>Desliza para ver más</small></div>
  <div class="snap-rail">
    <section class="card rail-card debt-snapshot">
      <span class="rail-label">Deuda total</span>
      <div class="metric">${money(breakdown.total)}</div>
      <p class="note">${breakdown.total ? `${breakdown.activeCount} ${breakdown.activeCount === 1 ? "deuda activa" : "deudas activas"}${breakdown.archivedCount ? ` · ${breakdown.archivedCount} archivada${breakdown.archivedCount === 1 ? "" : "s"}` : ""}${noDateCount ? ` · ${noDateCount} sin cuota` : ""}` : "Sin deudas registradas"}</p>
      <div class="rail-footer"><div><small>Libre de cuotas</small><strong>${plan.debtFreeMonth ? mlabel(plan.debtFreeMonth) : "Sin fecha planificada"}</strong></div>${breakdown.total ? `<button class="rail-link" data-action="timeline">Ver ruta →</button>` : ""}</div>
    </section>
    <section class="card rail-card goal-snapshot">
      <span class="rail-label">Metas de ahorro</span>
      <div class="metric">${money(firstGoal?.balance || m.reserved)}</div>
      <p class="note">${firstGoal ? `de ${money(firstGoal.target)} · ${Math.round(goalPct)}%` : `${money(m.reserved)} reservado`}</p>
      ${firstGoal ? `<div class="bar mini"><span style="--p:${goalPct}%"></span></div>` : ""}
      <div class="rail-footer"><div><small>${firstGoal ? esc(firstGoal.name) : "Sin metas"}</small><strong>${firstGoal?.date ? "Objetivo " + dlabel(firstGoal.date) : "A tu ritmo"}</strong></div><button class="rail-link" data-action="tab" data-id="goal">Ver metas →</button></div>
    </section>
  </div>
  <div class="section-head"><h2>En qué se fue tu dinero</h2><small>${mlabel(C.month())}</small></div>
  <section class="card home-spending">${donut(model.state.transactions.filter((t) => C.month(t.date) === C.month() && ["expense", "fixed"].includes(t.kind)))}${btn("Ver más detalles", "tab", "expense", "link-btn")}</section>
  <div class="section-head"><h2>Cuentas</h2><button class="text-action" data-action="tab" data-id="accounts">Ver todas</button></div>
  <section class="card account-list">${
    accounts.length
      ? accounts
          .slice(0, 3)
          .map((a) => accountPreview(a))
          .join("")
      : empty("Sin cuentas", "Agrega una cuenta para separar tu dinero.")
  }</section>
  <details class="card analysis"><summary>Ver análisis del mes</summary><div class="home-analysis-body"><div class="row"><h2>Las huellas de tu dinero</h2><span class="pill">${hist.length} ${model.state.reconstruction ? "saldos calculados" : "observaciones"}</span></div>${lineChart(hist)}<p class="note">${delta === null ? "Aún no hay suficientes puntos históricos." : `${money(delta)} de variación entre el primer y último saldo registrado.`} No equivale a ahorro mensual.</p><div class="health-grid"><div><small>Ingresos recibidos</small><strong class="good">${money(m.received)}</strong></div><div><small>Salidas registradas</small><strong>${money(m.outflow)}</strong></div><div><small>Diferencia del mes</small><strong class="${m.received - m.outflow < 0 ? "bad" : "good"}">${money(m.received - m.outflow)}</strong></div><div><small>Compromisos pendientes</small><strong>${money(m.pending)}</strong></div></div><div class="health-outlook"><small>Disponible libre después de cubrir pendientes</small><strong class="${m.available - m.pending < 0 ? "bad" : ""}">${money(m.available - m.pending)}</strong><p class="note">${m.available - m.pending < 0 ? "Los pendientes superan tu disponible libre." : "Este margen aún debe cubrir tus gastos variables."} Estimación con saldos actuales; no incluye ingresos futuros.</p></div><p class="note">Las salidas incluyen pagos desde tus cuentas y pagos de tarjetas. Las compras a crédito cuentan en consumo, pero no son salidas hasta pagarlas. Transferencias, ajustes y capital prestado o recuperado no cuentan como ingresos ni gastos.${plan.unassigned ? ` Abonos sin asignar: ${money(plan.unassigned)}; reducen el saldo de la tarjeta, pero no se cuentan como pagado hasta aplicarlos.` : ""}</p>${btn("Revisar pendientes", "tab", "calendar", "full")}</div></details>
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
  return `<button class="account-row" data-action="tab" data-id="accounts"><span class="row-icon ${a.type === "cash" ? "green" : a.type === "restricted" ? "gray" : "gray"}">${svg(iconName)}</span><span class="account-copy"><strong>${esc(a.name)}</strong><small>${label}</small></span><strong class="account-amount">${money(a.total)}</strong><span class="account-chevron">${svg("chevron")}</span></button>`;
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
