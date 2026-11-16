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
import { lineChart, strata } from "../ui/charts.js";
import { homeScene } from "../ui/scene.js";
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
    goals = model.state.goals,
    fundedGoals = goals.filter((goal) => goal.balance > 0).length,
    goalTarget = goals.reduce((n, g) => n + (g.target || 0), 0),
    plan = debtPlan(model.state),
    hist = model.state.liquidityHistory,
    delta = hist.length > 1 ? hist.at(-1).value - hist[0].value : null,
    cards = model.state.creditCards.filter((c) => c.active !== false),
    creditAvailable = cards.reduce(
      (n, c) => n + C.creditSummary(model.state, c.id).available,
      0,
    ),
    creditLimit = cards.reduce((n, c) => n + c.limit, 0),
    saved = m.reserved + m.frozen,
    overdue = C.overdueObligations(model.state),
    overdueTotal = overdue.reduce((n, i) => n + i.remaining, 0),
    margin = m.available - m.pending - overdueTotal,
    pendingTotal = items.reduce((n, i) => n + (i.remaining ?? i.amount), 0),
    ownMoney = accounts
      .filter((a) => a.type !== "restricted")
      .reduce((n, a) => n + a.total, 0),
    monthSpend = [
      ...model.state.transactions,
      ...C.installmentPurchases(model.state),
    ].filter(
      (t) =>
        C.month(t.date) === C.month() &&
        ["expense", "fixed", "msi_purchase"].includes(t.kind),
    ),
    spent = monthSpend.reduce((n, t) => n + t.amount, 0),
    justStarted =
      !model.state.transactions.length &&
      !model.state.debts.length &&
      !model.state.fixedExpenses.length;

  const panorama = [
    pano(
      "tab",
      "accounts",
      "Tu dinero",
      money(ownMoney),
      `${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"}${m.restricted ? ` · vales ${money(m.restricted)} aparte` : ""}`,
      `<span class="pebble water">${svg("wallet")}</span>`,
      'data-account-sub="wallet"',
    ),
    breakdown.total
      ? pano(
          "tab",
          "debt",
          "Deudas",
          money(breakdown.total),
          plan.debtFreeMonth
            ? `Libre de cuotas en <strong>${mlabel(plan.debtFreeMonth)}</strong>`
            : `${breakdown.activeCount} ${breakdown.activeCount === 1 ? "deuda activa" : "deudas activas"}`,
          slopeMini(),
        )
      : "",
    m.reserved || goals.length
      ? pano(
          "tab",
          "goal",
          "Metas",
          money(m.reserved),
          fundedGoals === 1
            ? "Reservado en tu meta."
            : goals.length
              ? `Reservado en ${fundedGoals || goals.length} metas${goalTarget ? ` · ${Math.round((m.reserved / goalTarget) * 100)}% de ${money(goalTarget)}` : ""}`
              : "Crea una meta",
          dropMini(goalTarget ? m.reserved / goalTarget : 0),
        )
      : "",
    pano(
      "tab",
      "accounts",
      cards.length
        ? creditAvailable < 0
          ? "Crédito excedido"
          : "Crédito disponible"
        : "Tarjetas de crédito",
      cards.length ? money(creditAvailable) : "Sin tarjetas",
      cards.length
        ? "Es dinero prestado; no forma parte de tu disponible."
        : "Agrégalas para separar tu crédito de tu dinero.",
      `<span class="card-mini" aria-hidden="true"><i style="width:${creditLimit ? Math.min(100, Math.max(0, 100 - (creditAvailable / creditLimit) * 100)) : 0}%"></i></span>`,
      'data-account-sub="credit"',
    ),
    m.receivable
      ? pano(
          "debtSub",
          "owed",
          "Te deben",
          money(m.receivable),
          "No suma a tu disponible hasta que cobres.",
          `<span class="pebble water">${svg("southWest")}</span>`,
        )
      : "",
  ].join("");

  return `<section class="home-scene">
  ${homeScene(model.state)}
  <div class="home-sky">
    <div class="home-top">
      <div class="home-wordmark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 23c5 0 8-8 13-8s8 8 13 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path><circle cx="21" cy="9.5" r="4" class="wordmark-sun"></circle></svg><span>Melange</span></div>
      <div class="home-tools"><button class="icon ghost-sky" data-action="searchMovements" aria-label="Buscar movimientos" title="Buscar movimientos">${svg("search")}</button><button class="icon ghost-sky" data-action="settings" aria-label="Ajustes" title="Ajustes">${svg("settings")}</button></div>
    </div>
    <p class="home-date">${todayLong()}</p>
    <div class="balance">
      <span class="balance-label">Disponible para gastar</span>
      <div class="balance-value" data-metric="available" data-value="${m.available}">${money(m.available)}</div>
      <p class="balance-hint">${saved ? "Ya excluye reservas y dinero congelado." : "Dinero propio, no crédito."}</p>
    </div>
    <div class="home-outlook">
      <div><span>Por pagar este mes</span><strong data-testid="home-pending">${money(m.pending)}</strong></div>
      ${overdueTotal ? `<div><span>Atrasado</span><strong class="bad" data-testid="home-overdue">${money(overdueTotal)}</strong></div>` : ""}
      <div class="outlook-margin"><span>Te quedarían</span><strong class="${margin < 0 && !plan.unassigned ? "bad" : ""}" data-testid="home-margin">${plan.unassigned ? "Revisar pagos de tarjeta" : money(margin)}</strong></div>
    </div>
  </div>
</section>
<div class="home-body">
  <p class="horizon-legend"><span><i class="paid"></i>Pagado</span><span><i class="due"></i>Por pagar · el tamaño es el importe</span></p>
  ${plan.unassigned ? `<p class="note home-note">Hay ${money(plan.unassigned)} en pagos de tarjeta sin desglose. Indica qué cargos cubrió el banco para calcular lo que te quedaría.</p>` : ""}
  <div class="quick" aria-label="Acciones rápidas">
    <button data-action="expense" aria-label="Nuevo gasto"><span class="pebble">${svg("northEast")}</span>Gasto</button>
    <button data-action="income" aria-label="Nuevo ingreso"><span class="pebble water">${svg("southWest")}</span>Ingreso</button>
    <button data-action="transfer" aria-label="Transferir"><span class="pebble alt">${svg("transfer")}</span>Transferir</button>
    <button data-action="choosePayment" aria-label="Pagar un compromiso"><span class="pebble spice">${svg("pay")}</span>Pagar</button>
  </div>
  ${justStarted ? `<section class="first-steps"><h2 class="serif-head">Empieza con algo <em>de hoy</em></h2><p class="note">Registra una compra para ver cómo cambia tu dinero. Después puedes añadir renta, servicios o deudas.</p>${btn("Registrar primer gasto", "expense", "", "primary full")}</section>` : ""}
  ${overdue.length ? alertLine(`Tienes pagos atrasados`, `${overdue.length} ${overdue.length === 1 ? "pago" : "pagos"} por ${money(overdueTotal)} de meses anteriores. Ya se restan de lo que te quedaría.`, "Ver y pagar", "choosePayment") : plan.latePayment ? alertLine("Tienes cuotas atrasadas", `${plan.lateCount} ${plan.lateCount === 1 ? "cuota" : "cuotas"} por ${money(plan.latePayment)} de meses anteriores.`, "Ver deudas", "tab", "debt") : ""}
  <section class="home-section">
    <div class="section-head"><h2 class="serif-head">Por pagar</h2><button class="text-action" data-action="tab" data-id="calendar">Calendario</button></div>
    ${items.length ? `<p class="section-sub">Lo más cercano primero</p><div class="list">${items.slice(0, 4).map(paymentRow).join("")}</div>${items.length > 4 ? `<button class="more-link" data-action="tab" data-id="calendar">Ver los ${items.length} pagos · ${money(pendingTotal)}${svg("chevron")}</button>` : ""}` : `<div class="list">${empty("Sin pagos pendientes este mes", "Agrega renta, servicios o suscripciones desde Registrar › Más.")}</div>`}
  </section>
  <section class="home-section">
    <div class="section-head"><h2 class="serif-head">Tu <em>panorama</em></h2></div>
    <div class="home-summaries">${panorama}</div>
  </section>
  <section class="home-section home-spending">
    <div class="section-head"><h2 class="serif-head">En qué se fue <em>${monthLong(C.month())}</em></h2><button class="text-action" data-action="tab" data-id="expense">Movimientos</button></div>
    ${spent ? `<p class="section-sub">Llevas <strong>${money(spent)}</strong> en gastos. Cada capa es una categoría.</p>` : ""}
    ${strata(monthSpend)}
  </section>
  <details class="analysis"><summary>Ver análisis del mes</summary><div class="home-analysis-body"><div class="row"><h2>Las huellas de tu dinero</h2><span class="pill">${hist.length} observaciones</span></div>${lineChart(hist)}<p class="note">${delta === null ? "Aún no hay suficientes puntos históricos." : `${money(delta)} de variación entre el primer y último saldo registrado.`} No equivale a ahorro mensual.</p><div class="health-grid"><div><small>Ingresos recibidos</small><strong class="good">${money(m.received)}</strong></div><div><small>Pagos y gastos desde tus cuentas</small><strong>${money(m.outflow)}</strong></div><div><small>Diferencia del mes</small><strong class="${m.received - m.outflow < 0 ? "bad" : "good"}">${money(m.received - m.outflow)}</strong></div><div><small>Compromisos ya pagados</small><strong>${money(m.paid)}</strong></div></div><p class="note">Los pagos de tarjeta salen de tus cuentas. Las compras a crédito cuentan en consumo, pero no son salidas hasta pagarlas. Transferencias, ajustes y capital prestado o recuperado no cuentan como ingresos ni gastos.</p>${btn("Revisar pendientes", "tab", "calendar", "full")}</div></details>
  <button class="projection-link" data-action="projection"><svg viewBox="0 0 64 40" aria-hidden="true"><rect width="64" height="40" class="pl-sky"></rect><path d="M0 30 C 16 24 30 28 64 20 V40 H0Z" class="pl-dune"></path><path d="M4 32 L18 26 L30 28 L44 18 L58 12" fill="none" class="pl-line"></path></svg><span><strong>Proyección</strong><small>Lo que te quedaría los próximos 12 meses</small></span>${svg("chevron")}</button>
  <footer class="sign-off"><svg viewBox="0 0 60 16" aria-hidden="true"><path d="M2 13c10 0 14-9 28-9s18 9 28 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path><circle cx="40" cy="4" r="2.4"></circle></svg><h2>Cada grano cuenta.</h2></footer>
</div>`;
}

const todayLong = () => {
  const text = new Date(C.today() + "T12:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function pano(action, id, label, figure, note, art, extra = "") {
  return `<button class="pano" data-action="${action}" data-id="${id}" ${extra}><span class="pano-copy"><span class="eyebrow">${label}</span><span class="pano-figure">${figure}</span><small>${note}</small></span><span class="pano-art">${art}</span><span class="row-chevron">${svg("chevron")}</span></button>`;
}

const slopeMini = () =>
  `<svg viewBox="0 0 84 46" aria-hidden="true" class="slope-mini"><path d="M2 6 C 26 8 44 18 58 30 S 76 42 82 43 L82 46 L2 46 Z" class="slope-fill"></path><path d="M2 6 C 26 8 44 18 58 30 S 76 42 82 43" fill="none" class="slope-line"></path><circle cx="2" cy="6" r="3" class="slope-dot"></circle><path d="M78 40v-12l8 3-8 3" class="slope-flag"></path></svg>`;

function dropMini(ratio) {
  const level = 58 - Math.max(0, Math.min(1, ratio)) * 54;
  return `<svg viewBox="0 0 48 60" aria-hidden="true" class="drop-mini"><defs><clipPath id="home-drop"><path d="M24 2s20 21 20 36a20 20 0 0 1-40 0C4 23 24 2 24 2z"></path></clipPath></defs><path d="M24 2s20 21 20 36a20 20 0 0 1-40 0C4 23 24 2 24 2z" class="drop-shell"></path><path d="M0 ${level} Q 12 ${level - 4} 24 ${level} T 48 ${level} V60 H0Z" class="drop-water" clip-path="url(#home-drop)"></path></svg>`;
}

const alertLine = (title, note, label, action, id = "") =>
  `<section class="alert-line" role="status"><span class="pebble rust">${svg("warning")}</span><div><strong>${title}</strong><p class="note">${note}</p>${btn(label, action, id, "link-btn")}</div></section>`;

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
