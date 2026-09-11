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
    hist = model.state.liquidityHistory,
    delta = hist.length > 1 ? hist.at(-1).value - hist[0].value : null;
  return `<div class="row"><div><div class="eyebrow">${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div><h1>Cada grano cuenta.</h1></div></div><section class="card hero"><div class="row"><span>Dinero en cuentas libres</span><span class="pill good">En este dispositivo</span></div>${metric(m.liquidity, "liquidity")}<div class="hero-bottom"><div><small>Débito</small><strong>${money(m.debit)}</strong></div><div><small>Efectivo</small><strong>${money(m.cash)}</strong></div></div></section><section class="card"><div class="row"><h2>Tu dinero</h2>${btn("Cuentas", "tab", "accounts")}</div><div class="details">${[
    ["Disponible libre", m.available],
    ["Vales", m.restricted],
    ["Congelado", m.frozen],
    ["Por recuperar", m.receivable],
  ]
    .map(
      ([k, v]) => `<div><small>${k}</small><strong>${money(v)}</strong></div>`,
    )
    .join(
      "",
    )}</div></section><div class="quick"><button data-action="income"><span class="icon">${svg("plus")}</span>Ingreso</button><button data-action="expense"><span class="icon">${svg("minus")}</span>Gasto</button><button data-action="transfer"><span class="icon">${svg("transfer")}</span>Transferir</button></div><div class="grid"><div class="card accent"><small>Pendiente este mes</small>${metric(m.pending, "pending", "small")}<p class="note">${money(m.paid)} ya pagados</p></div><div class="card sage"><small>Disponible sin reservas</small>${metric(m.available, "available", "small")}<p class="note">${money(m.reserved)} para metas</p></div></div><section class="card"><div class="row"><h2>Lo que viene</h2>${btn("Ver mes", "tab", "calendar")}</div>${items.length ? items.slice(0, 3).map(paymentRow).join("") : empty("Al día", "No hay compromisos pendientes este mes.")}</section><section class="card"><div class="row"><h2>En qué se fue</h2><small>${mlabel(C.month())}</small></div>${donut(model.state.transactions.filter((t) => C.month(t.date) === C.month() && ["expense", "fixed"].includes(t.kind)))}<p class="note">Consumo registrado. Los pagos de deuda se muestran aparte para evitar duplicar compras.</p></section><section class="card"><div class="row"><h2>Las huellas de tu dinero</h2><span class="pill">${hist.length} ${model.state.reconstruction ? "saldos calculados" : "observaciones"}</span></div>${lineChart(hist)}<p class="note">${delta === null ? "Aún no hay suficientes puntos históricos." : `${money(delta)} de variación entre el primer y último saldo registrado.`} No equivale a ahorro mensual.</p></section><section class="card"><h2>Salud financiera</h2><div class="split"><div><small>Deuda / ingreso previsto</small><div class="metric">${m.dti === null ? "—" : m.dti.toFixed(1) + "%"}</div></div><div><small>Libre antes de variables</small>${metric(m.budgetFree, "free", "small")}</div></div><div class="bar"><span style="width:${Math.max(0, Math.min(100, ((m.fixed + m.debt) / Math.max(1, m.income)) * 100))}%"></span></div><p class="note">Compromisos: ${money(m.fixed + m.debt)} · Ingreso previsto: ${money(m.income)}. Pagar una cuota no cambia estos compromisos.</p>${btn("Explorar proyección", "projection", "", "full")}</section>`;
}

export function paymentRow(i) {
  return `<div class="item row"><div><div class="item-title">${esc(i.name)}</div><p class="muted">${i.date}${i.n ? " · Cuota " + i.n : ""} ${i.date < C.today() && !i.paid ? '<span class="bad">· Vencido</span>' : ""}</p></div><div style="text-align:right"><div class="amount">${money(i.paid ? i.amount : (i.remaining ?? i.amount))}</div>${i.recorded && !i.paid ? "<small>Abono: " + money(i.recorded) + "</small>" : ""}${i.paid ? '<span class="pill good">Pagado</span>' : icon("pay", "Registrar pago", "pay", i.key, `data-period="${i.date.slice(0, 7)}"`)}</div></div>`;
}
