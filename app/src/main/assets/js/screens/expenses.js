import { accountName } from "../ui/components.js";
import { model } from "../state/model.js";
import {
  icon,
  esc,
  kindName,
  money,
  empty,
  svg,
  screenHead,
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
  return `<button class="movement-row" data-action="transactionDetails" data-id="${esc(t.id)}"><span class="row-icon ${tone}">${svg(iconName)}</span><span class="movement-copy"><strong class="item-title">${esc(t.name)}</strong><small>${esc(kindName(t.kind))} · ${esc(accountName(t.creditCardId || t.accountId))}${t.historical ? " · Importado" : ""}</small></span><span class="movement-amount ${t.kind === "income" ? "good" : ""}">${t.kind === "income" ? "+" : ""}${money(t.amount)}</span><span class="row-chevron">${svg("chevron")}</span></button>`;
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
  const tx = filtered(),
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
    (model.sub === "fixed"
      ? fixedList()
      : `<div class="movement-toolbar"><div class="search-field">${svg("search")}<input id="search" aria-label="Buscar movimientos" placeholder="Buscar movimiento" value="${esc(model.filter.q)}"></div><button class="icon" data-action="filters" aria-label="Mostrar filtros" title="Mostrar filtros">${svg("tune")}</button></div><div class="expenses-layout"><details class="card expense-chart"><summary>Consumo por categoría</summary><div class="expense-chart-body">${donut(tx.filter((t) => ["expense", "fixed"].includes(t.kind)))}</div></details><div class="movement-summary"><span>${tx.length} movimientos</span><strong>Salidas ${money(out)}</strong></div><section class="expense-list">${tx.length ? groupedMovements(tx) : `<section class="card">${empty("Sin coincidencias", "Cambia los filtros o registra un movimiento.")}</section>`}</section></div>`)
  );
}

export function fixedList() {
  return `<section class="card">${
    model.state.fixedExpenses.length
      ? model.state.fixedExpenses
          .map(
            (f) =>
              `<div class="item fixed-item"><div class="row"><div class="wallet-title"><span class="row-icon ${f.active !== false ? "blue" : "gray"}">${svg("receipt")}</span><div><strong class="item-title">${esc(f.name)}</strong><small class="section-note">${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"} · ${esc(C.recurrenceLabel(f))}</small></div></div><strong class="amount">${money(f.amount)}</strong></div><div class="row" style="margin-top:9px"><span class="pill ${f.active !== false ? "good" : ""}">${f.active !== false ? "Activo" : "Archivado"}</span><div class="actions">${icon("eye", "Ver gasto fijo", "fixedDetails", f.id)}${icon("edit", "Editar gasto fijo", "editFixed", f.id)}${C.obligations(model.state).some((i) => i.ref === f.id && !i.paid) ? icon("pay", "Pagar gasto fijo", "pay", C.obligations(model.state).find((i) => i.ref === f.id && !i.paid)?.key || "", `data-period="${C.month()}"`) : ""}${icon("trash", "Archivar gasto fijo", "deleteFixed", f.id)}</div></div></div>`,
          )
          .join("")
      : empty(
          "Haz visibles tus compromisos",
          "Renta, internet y suscripciones viven aquí.",
        )
  }</section>`;
}
