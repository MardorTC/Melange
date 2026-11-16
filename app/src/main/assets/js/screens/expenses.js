import { accountName } from "../ui/components.js";
import { model } from "../state/model.js";
import {
  esc,
  kindName,
  money,
  empty,
  svg,
  btn,
  dlabel,
} from "../ui/components.js";
import { activityHeader } from "../ui/scene.js";
import { strata } from "../ui/charts.js";
import C from "../domain/finance.js";

export function filtered() {
  // Installment purchases are debts, but the person made a purchase that day:
  // list it with the movements (it does not move money until it is paid).
  return [...model.state.transactions, ...C.installmentPurchases(model.state)]
    .filter(
      (t) =>
        (!model.filter.q ||
          t.name.toLowerCase().includes(model.filter.q.toLowerCase())) &&
        (!model.filter.from || t.date >= model.filter.from) &&
        (!model.filter.to || t.date <= model.filter.to) &&
        (!model.filter.category || t.categoryId === model.filter.category) &&
        (!model.filter.accountId ||
          t.accountId === model.filter.accountId ||
          t.toAccountId === model.filter.accountId ||
          t.creditCardId === model.filter.accountId) &&
        (!model.filter.kind || t.kind === model.filter.kind) &&
        (!model.filter.min || t.amount >= Number(model.filter.min) * 100) &&
        (!model.filter.max || t.amount <= Number(model.filter.max) * 100),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

const dayLabel = (date) => {
  const today = C.today();
  const d = new Date(today + "T12:00:00");
  d.setDate(d.getDate() - 1);
  const yesterday = d.toLocaleDateString("en-CA");
  if (date === today) return "Hoy";
  if (date === yesterday) return "Ayer";
  return new Date(date + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
  });
};

function movementRow(t) {
  const iconName =
    t.kind === "income"
      ? "plus"
      : ["debt", "card_payment"].includes(t.kind)
        ? "card"
        : t.kind === "transfer"
          ? "transfer"
          : "receipt";
  const tone =
    t.kind === "income"
      ? "green"
      : ["debt", "card_payment"].includes(t.kind)
        ? "blue"
        : t.kind === "transfer"
          ? "gray"
          : "";
  const detail =
    t.kind === "transfer"
      ? `${esc(kindName(t.kind))} · De ${esc(accountName(t.accountId))} → ${esc(accountName(t.toAccountId))}`
      : `${esc(kindName(t.kind))} · ${esc(accountName(t.creditCardId || t.accountId))}`;
  if (t.kind === "msi_purchase")
    return `<button class="movement-row" data-action="debtDetails" data-id="${esc(t.debtId)}"><span class="row-icon blue">${svg("card")}</span><span class="movement-copy"><strong class="item-title">${esc(t.name)}</strong><small>Compra a ${t.totalPayments} meses · ${esc(accountName(t.creditCardId))}</small></span><span class="movement-amount">${money(t.amount)}</span><span class="row-chevron">${svg("chevron")}</span></button>`;
  return `<button class="movement-row" data-action="transactionDetails" data-id="${esc(t.id)}"><span class="row-icon ${tone}">${svg(iconName)}</span><span class="movement-copy"><strong class="item-title">${esc(t.name)}</strong><small>${detail}${t.historical ? " · Importado" : ""}</small></span><span class="movement-amount ${t.kind === "income" ? "good" : ""}">${t.kind === "income" ? "+" : ""}${money(t.amount)}</span><span class="row-chevron">${svg("chevron")}</span></button>`;
}

function groupedMovements(tx) {
  const groups = new Map();
  for (const t of tx) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  return [...groups.entries()]
    .map(
      ([date, items]) =>
        `<div class="date-group"><div class="date-label">${dayLabel(date)}</div><section class="expense-group">${items.map(movementRow).join("")}</section></div>`,
    )
    .join("");
}

export function expensesPage() {
  const f = model.filter;
  const monthStart = C.month() + "-01",
    period =
      f.from === monthStart && f.to === C.today()
        ? "Este mes"
        : f.from && f.to
          ? `${dlabel(f.from)} – ${dlabel(f.to)}`
          : "";
  const filters = [
    period,
    !period && f.from && `Desde ${dlabel(f.from)}`,
    !period && f.to && `Hasta ${dlabel(f.to)}`,
    f.category && model.state.categories.find((c) => c.id === f.category)?.name,
    f.accountId && accountName(f.accountId),
    f.kind && kindName(f.kind),
    f.min && `Mín. ${money(Math.round(Number(f.min) * 100))}`,
    f.max && `Máx. ${money(Math.round(Number(f.max) * 100))}`,
  ].filter(Boolean);
  const tx = filtered(),
    noHistory = !model.state.transactions.length,
    out = tx
      .filter(
        (t) =>
          ["expense", "fixed", "debt", "card_payment"].includes(t.kind) &&
          !C.isCreditPurchase(t),
      )
      .reduce((a, t) => a + t.amount, 0);
  return (
    activityHeader(
      model.state,
      C.metrics(model.state),
      model.sub === "fixed" ? "fixed" : "all",
    ) +
    (model.sub === "all"
      ? `<div class="active-filters">${filters.length ? filters.map((text) => `<span class="pill">${esc(text)}</span>`).join("") + '<button class="btn link-btn" data-action="clearFilters">Quitar filtros</button>' : '<span class="note">Todo el historial</span>'}</div>`
      : "") +
    (model.sub === "fixed"
      ? fixedList()
      : `<div class="movement-toolbar"><div class="search-field">${svg("search")}<input id="search" aria-label="Buscar movimientos" placeholder="Buscar movimiento" value="${esc(model.filter.q)}"></div><button class="icon" data-action="filters" aria-label="Mostrar filtros" title="Mostrar filtros">${svg("tune")}</button></div><div class="expenses-layout"><details class="expense-chart"><summary>Consumo por categoría</summary><div class="expense-chart-body">${strata(tx.filter((t) => ["expense", "fixed", "msi_purchase"].includes(t.kind)))}</div></details><div class="movement-summary"><span>${tx.length} ${tx.length === 1 ? "movimiento" : "movimientos"}</span><strong>Salidas ${money(out)}</strong></div><p class="note">Salidas suma gastos, gastos fijos, pagos de deuda y pagos de tarjeta. No incluye compras a crédito ni a meses, transferencias ni ingresos.</p><section class="expense-list">${tx.length ? groupedMovements(tx) : `<section class="card">${empty(noHistory ? "Tu historial empieza aquí" : "Sin coincidencias", noHistory ? "Registra tu primera entrada o salida para verla aquí." : "No hay movimientos con estos filtros.")}<div class="actions">${filters.length && !noHistory ? btn("Quitar filtros", "clearFilters") : ""}${btn("Registrar movimiento", "newMovement", "", "primary")}</div></section>`}</section></div>`)
  );
}

export function fixedList() {
  const list = model.state.fixedExpenses,
    active = list.filter((f) => f.active !== false),
    archived = list.filter((f) => f.active === false),
    obligations = C.obligations(model.state),
    monthTotal = obligations
      .filter((i) => i.kind === "fixed")
      .reduce((n, i) => n + i.amount, 0),
    monthPaid = obligations
      .filter((i) => i.kind === "fixed" && i.paid)
      .reduce((n, i) => n + i.amount, 0);
  const row = (f) => {
    const next = obligations.find((i) => i.ref === f.id && !i.paid);
    return `<div class="fixed-row"><button class="fixed-main" data-action="fixedDetails" data-id="${esc(f.id)}" aria-label="Ver gasto fijo"><span class="row-icon ${f.active !== false ? "blue" : "gray"}">${svg(f.kind === "subscription" ? "history" : "receipt")}</span><span class="fixed-copy"><strong class="item-title">${esc(f.name)}</strong><small>${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"} · ${esc(C.recurrenceLabel(f))}${next ? ` · próximo ${dlabel(next.date, false)}` : ""}</small></span><strong class="fixed-amount">${money(f.amount)}</strong></button><div class="fixed-actions">${next ? `<button class="chip-btn spice" data-action="pay" data-id="${esc(next.key)}" data-period="${C.month()}" aria-label="Pagar gasto fijo">Pagar</button>` : `<span class="pill ${f.active !== false ? "good" : ""}">${f.active !== false ? "Al día" : "Archivado"}</span>`}<button class="icon ghost small" data-action="editFixed" data-id="${esc(f.id)}" aria-label="Editar gasto fijo" title="Editar gasto fijo">${svg("edit")}</button>${f.active !== false ? `<button class="icon ghost small" data-action="deleteFixed" data-id="${esc(f.id)}" aria-label="Archivar gasto fijo" title="Dejar de usar">${svg("archive")}</button>` : ""}</div></div>`;
  };
  if (!list.length)
    return `<section class="empty-scene">${empty(
      "Haz visibles tus compromisos",
      "Renta, internet y suscripciones viven aquí.",
    )}<div class="actions">${btn("Crear gasto fijo", "editFixed", "", "primary")}</div></section>`;
  return `<section class="fixed-summary"><div><small>Este mes</small><strong>${money(monthTotal)}</strong><span>${active.length} ${active.length === 1 ? "compromiso activo" : "compromisos activos"}</span></div><div class="split-bar" aria-hidden="true"><i class="paid" style="flex:${monthPaid}"></i><i class="due" style="flex:${Math.max(0, monthTotal - monthPaid)}"></i></div><p class="note">${money(monthPaid)} pagado · ${money(Math.max(0, monthTotal - monthPaid))} por pagar</p></section><section class="fixed-list">${active.map(row).join("")}</section>${archived.length ? `<details class="settled-list"><summary>Ya no los usas (${archived.length})</summary>${archived.map(row).join("")}</details>` : ""}`;
}
