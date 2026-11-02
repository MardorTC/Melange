import { accountName } from "../ui/components.js";
import { model } from "../state/model.js";
import {
  esc,
  kindName,
  money,
  empty,
  svg,
  btn,
  screenHead,
  dlabel,
} from "../ui/components.js";
import { donut } from "../ui/charts.js";
import C from "../domain/finance.js";

export function filtered() {
  return model.state.transactions
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
        `<div class="date-group"><div class="date-label">${dayLabel(date)}</div><section class="card expense-group">${items.map(movementRow).join("")}</section></div>`,
    )
    .join("");
}

export function expensesPage() {
  const f = model.filter;
  const filters = [
    f.from && `Desde ${dlabel(f.from)}`,
    f.to && `Hasta ${dlabel(f.to)}`,
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
    screenHead("Movimientos", "Lo que entró y salió.", {
      action: model.sub === "fixed" ? "editFixed" : "newMovement",
      actionLabel:
        model.sub === "fixed" ? "Agregar gasto fijo" : "Agregar movimiento",
    }) +
    `<div class="chips"><button class="chip ${model.sub === "all" ? "selected" : ""}" data-action="expenseSub" data-id="all">Movimientos</button><button class="chip ${model.sub === "fixed" ? "selected" : ""}" data-action="expenseSub" data-id="fixed">Fijos y suscripciones</button></div>` +
    (model.sub === "all"
      ? `<div class="active-filters">${filters.length ? filters.map((text) => `<span class="pill">${esc(text)}</span>`).join("") + '<button class="btn link-btn" data-action="clearFilters">Quitar filtros</button>' : '<span class="note">Todo el historial</span>'}</div>`
      : "") +
    (model.sub === "fixed"
      ? fixedList()
      : `<div class="movement-toolbar"><div class="search-field">${svg("search")}<input id="search" aria-label="Buscar movimientos" placeholder="Buscar movimiento" value="${esc(model.filter.q)}"></div><button class="icon" data-action="filters" aria-label="Mostrar filtros" title="Mostrar filtros">${svg("tune")}</button></div><div class="expenses-layout"><details class="card expense-chart"><summary>Consumo por categoría</summary><div class="expense-chart-body">${donut(tx.filter((t) => ["expense", "fixed"].includes(t.kind)))}</div></details><div class="movement-summary"><span>${tx.length} ${tx.length === 1 ? "movimiento" : "movimientos"}</span><strong>Salidas ${money(out)}</strong></div><p class="note">Salidas suma gastos, gastos fijos, pagos de deuda y pagos de tarjeta. No incluye compras a crédito, transferencias ni ingresos.</p><section class="expense-list">${tx.length ? groupedMovements(tx) : `<section class="card">${empty(noHistory ? "Tu historial empieza aquí" : "Sin coincidencias", noHistory ? "Registra tu primera entrada o salida para verla aquí." : "No hay movimientos con estos filtros.")}<div class="actions">${filters.length && !noHistory ? btn("Quitar filtros", "clearFilters") : ""}${btn("Registrar movimiento", "newMovement", "", "primary")}</div></section>`}</section></div>`)
  );
}

export function fixedList() {
  return `<section class="card">${
    model.state.fixedExpenses.length
      ? model.state.fixedExpenses
          .map((f) => {
            const next = C.obligations(model.state).find(
              (i) => i.ref === f.id && !i.paid,
            );
            const button = (text, label, action, id = f.id, extra = "") =>
              `<button class="btn" aria-label="${label}" data-action="${action}" data-id="${esc(id)}" ${extra}>${text}</button>`;
            return `<div class="item fixed-item"><div class="row"><div class="wallet-title"><span class="row-icon ${f.active !== false ? "blue" : "gray"}">${svg("receipt")}</span><div><strong class="item-title">${esc(f.name)}</strong><small class="section-note">${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"} · ${esc(C.recurrenceLabel(f))}</small></div></div><strong class="amount">${money(f.amount)}</strong></div><p><span class="pill ${f.active !== false ? "good" : ""}">${f.active !== false ? "Activo" : "Archivado"}</span></p><div class="actions">${button("Detalles y pagos", "Ver gasto fijo", "fixedDetails")}${button("Editar", "Editar gasto fijo", "editFixed")}${next ? button("Pagar", "Pagar gasto fijo", "pay", next.key, `data-period="${C.month()}"`) : ""}${f.active !== false ? button("Dejar de usar", "Archivar gasto fijo", "deleteFixed") : ""}</div></div>`;
          })
          .join("")
      : empty(
          "Haz visibles tus compromisos",
          "Renta, internet y suscripciones viven aquí.",
        ) +
        `<div class="actions">${btn("Crear gasto fijo", "editFixed", "", "primary")}</div>`
  }</section>`;
}
