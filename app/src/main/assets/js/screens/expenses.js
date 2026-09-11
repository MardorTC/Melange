import { accountName } from "../ui/components.js";
import { model } from "../state/model.js";
import {
  icon,
  esc,
  input,
  select,
  accountOptions,
  kindName,
  btn,
  money,
  empty,
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
          t.toAccountId === model.filter.accountId) &&
        (!model.filter.kind || t.kind === model.filter.kind) &&
        (!model.filter.min || t.amount >= Number(model.filter.min) * 100) &&
        (!model.filter.max || t.amount <= Number(model.filter.max) * 100),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function expensesPage() {
  const tx = filtered(),
    out = tx
      .filter((t) => ["expense", "fixed", "debt"].includes(t.kind))
      .reduce((a, t) => a + t.amount, 0);
  return `<div class="row"><div><div class="eyebrow">Cada movimiento cuenta</div><h1>Movimientos</h1></div>${icon("plus", "Agregar movimiento", "newMovement")}</div><div class="chips"><button class="chip ${model.sub === "all" ? "selected" : ""}" data-action="expenseSub" data-id="all">Movimientos</button><button class="chip ${model.sub === "fixed" ? "selected" : ""}" data-action="expenseSub" data-id="fixed">Fijos y suscripciones</button></div>${model.sub === "fixed" ? fixedList() : `<div class="toolbar"><input id="search" aria-label="Buscar movimientos" placeholder="Buscar movimiento…" value="${esc(model.filter.q)}">${icon("settings", "Mostrar filtros", "filters")}</div>${model.showFilters ? `<div class="card filters" id="filters">${input("from", "Desde", model.filter.from, "date")}${input("to", "Hasta", model.filter.to, "date")}${select("category", "Categoría", [["", "Todas"], ...model.state.categories.map((c) => [c.id, c.name])], model.filter.category)}${select("accountId", "Origen", [["", "Todos"], ...model.state.walletAccounts.map((a) => [a.id, a.name])], model.filter.accountId)}${select("kind", "Tipo", [["", "Todos"], ...["expense", "fixed", "debt", "income", "transfer", "adjustment", "loan_out", "loan_in"].map((k) => [k, kindName(k)])], model.filter.kind)}${input("min", "Importe mínimo", model.filter.min, "number", 'min="0" step="0.01"')}${input("max", "Importe máximo", model.filter.max, "number", 'min="0" step="0.01"')}${btn("Limpiar filtros", "clearFilters")}</div>` : ""}<div class="expenses-layout"><section class="card expense-chart"><h2>Consumo del periodo filtrado</h2>${donut(tx.filter((t) => ["expense", "fixed"].includes(t.kind)))}<p class="note">Mismos filtros que la lista. Pagos de deuda, transferencias y ajustes se muestran en movimientos, no en consumo.</p></section><section class="expense-list"><div class="row"><span class="muted">${tx.length} movimientos</span><strong>Salidas: ${money(out)}</strong></div><section class="card">${tx.length ? tx.map((t) => `<div class="item"><div class="row"><div><div class="item-title">${esc(t.name)}</div><p class="muted">${t.date} · ${kindName(t.kind)} · ${esc(accountName(t.accountId))} ${t.historical ? '<span class="badge">Importado</span>' : ""}</p></div><strong class="amount ${t.kind === "income" ? "good" : ""}">${t.kind === "income" ? "+" : ""}${money(t.amount)}</strong></div><div class="row" style="margin-top:8px"><small>${esc(model.state.categories.find((c) => c.id === t.categoryId)?.name || "Sin categoría")}</small><div class="actions">${icon("eye", "Ver movimiento", "transactionDetails", t.id)}${icon("edit", "Editar movimiento", "editTransaction", t.id)}${icon("trash", "Eliminar o revertir movimiento", "deleteTransaction", t.id)}</div></div></div>`).join("") : empty("Sin coincidencias", "Cambia los filtros o registra un movimiento.")}</section></section></div>`}`;
}

export function fixedList() {
  return `${btn("Agregar gasto fijo", "editFixed", "", "primary full")}<section class="card">${model.state.fixedExpenses.length ? model.state.fixedExpenses.map((f) => `<div class="item"><div class="row"><div><div class="item-title">${esc(f.name)}</div><p class="muted">${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"} · ${esc(C.recurrenceLabel(f))}</p></div><strong>${money(f.amount)}</strong></div><div class="row" style="margin-top:9px"><span class="pill ${f.active !== false ? "good" : ""}">${f.active !== false ? "Activo" : "Archivado"}</span><div class="actions">${icon("eye", "Ver gasto fijo", "fixedDetails", f.id)}${icon("edit", "Editar gasto fijo", "editFixed", f.id)}${C.obligations(model.state).some((i) => i.ref === f.id && !i.paid) ? icon("pay", "Pagar gasto fijo", "pay", C.obligations(model.state).find((i) => i.ref === f.id && !i.paid)?.key || "", `data-period="${C.month()}"`) : ""}${icon("trash", "Archivar gasto fijo", "deleteFixed", f.id)}</div></div></div>`).join("") : empty("Haz visibles tus compromisos", "Renta, internet y suscripciones viven aquí.")}</section>`;
}
