import { receivablesPage } from "./receivables.js";
import { btn } from "../ui/components.js";
import { model } from "../state/model.js";
import { icon, metric, esc, debtType, money, empty } from "../ui/components.js";
import C from "../domain/finance.js";

export function debtsPage() {
  const tabs = `<div class="toolbar">${btn("Debo", "debtSub", "owe")}${btn("Me deben", "debtSub", "owed")}</div>`;
  if (model.debtSub === "owed") return tabs + receivablesPage();
  const total = model.state.debts
    .filter((d) => !d.archived)
    .reduce((a, d) => a + d.balance, 0);
  return (
    tabs +
    `<div class="row"><div><div class="eyebrow">Un pago más cerca</div><h1>Debo</h1></div>${icon("plus", "Agregar deuda", "editDebt")}</div><div class="card hero"><small>Saldo registrado pendiente</small>${metric(total, "debtTotal")}<small>Consulta en cada deuda si incluye financiamiento.</small></div>${
      model.state.debts.length
        ? model.state.debts
            .map((d) => {
              const paid = d.paidPayments.length,
                pct = d.totalPayments
                  ? Math.min(100, (paid / d.totalPayments) * 100)
                  : d.originalAmount
                    ? Math.max(
                        0,
                        Math.min(100, (1 - d.balance / d.originalAmount) * 100),
                      )
                    : 0;
              const next = nextDebt(d);
              return `<section class="card"><div class="row"><div><h2>${esc(d.name)}</h2><small>${esc(model.state.creditors.find((a) => a.id === d.creditorId)?.name || "Sin acreedor")} · ${esc(debtType(d.type))}</small></div><span class="pill ${d.balance === 0 ? "good" : ""}">${d.archived ? "Archivada" : d.balance === 0 ? "Liquidada" : "Activa"}</span></div><div class="row" style="margin-top:16px"><div><small>Saldo</small><div class="metric">${money(d.balance)}</div></div><div style="text-align:right"><small>Pago habitual</small><strong style="display:block">${money(d.payment)}</strong></div></div><div class="bar"><span style="width:${pct}%"></span></div><div class="row"><small>${d.totalPayments ? `${paid} / ${d.totalPayments} cuotas` : "Sin plazo fijo"}<br>${next ? "Próximo: " + next.date : "Sin pagos pendientes"}</small><div class="actions">${icon("eye", "Detalles de deuda", "debtDetails", d.id)}${icon("edit", "Editar deuda", "editDebt", d.id)}${next ? icon("pay", "Pagar deuda", "pay", next.key, `data-period="${next.date.slice(0, 7)}"`) : ""}${icon("trash", "Eliminar o archivar deuda", "deleteDebt", d.id)}</div></div></section>`;
            })
            .join("")
        : empty(
            "Tus deudas, en orden",
            "Agrega una deuda para organizar sus cuotas.",
          )
    }`
  );
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
