import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
import {
  form,
  modal,
  input,
  amount,
  select,
  moneyValue,
  money,
  esc,
  btn,
  icon,
  accountOptions,
  confirmAction,
} from "../ui/components.js";

export function creditCardsSection() {
  return `<div class="row"><h2>Tarjetas de crédito</h2>${btn("Agregar tarjeta", "creditEdit")}</div><p class="note">El crédito es una deuda, no dinero disponible. No necesitas una cuenta de débito del mismo banco.</p>${model.state.creditCards
    .map((c) => {
      const v = C.creditSummary(model.state, c.id),
        next = C.creditPeriods(model.state, c.id)
          .map((m) => C.creditStatement(model.state, c.id, m))
          .find((i) => !i.paid);
      return `<section class="card credit-card"><div class="row"><h2>${esc(c.name)}</h2><span class="pill">${c.active === false ? "Archivada" : "Crédito"}</span></div><small>Crédito disponible</small><div class="metric ${v.available < 0 ? "bad" : ""}">${money(v.available)}</div><div class="details"><div><small>Límite</small><strong>${money(c.limit)}</strong></div><div><small>Saldo total por pagar</small><strong>${money(v.used)}</strong></div><div><small>Compras / saldo anterior</small><strong>${money(v.purchases)}</strong></div><div><small>MSI pendientes, todas las cuotas</small><strong>${money(v.installments)}</strong></div></div><p class="note">Corte: día ${c.closingDay} · Pago: día ${c.paymentDay}</p>${next ? `<p>Próximo pendiente: <strong>${money(next.remaining)}</strong> · ${next.date}</p>${btn("Pagar tarjeta", "creditPay", c.id, "primary")}` : '<p class="note">Sin pagos pendientes.</p>'}<div class="toolbar wrap">${btn("Ver desglose", "creditDetails", c.id)}${icon("edit", "Editar tarjeta", "creditEdit", c.id)}${c.active !== false ? icon("trash", "Archivar tarjeta", "creditArchive", c.id) : ""}</div></section>`;
    })
    .join("")}`;
}
export function creditPayForm(id, period) {
  const next =
    period ||
    C.creditPeriods(model.state, id).find(
      (m) => !C.creditStatement(model.state, id, m).paid,
    );
  if (!next) return creditDetails(id);
  const item = C.creditStatement(model.state, id, next);
  form(
    "Pagar tarjeta: " + item.name,
    `<p>Vencimiento: ${item.date} · Pendiente: <strong>${money(item.remaining)}</strong></p>${statementLines(item)}<p class="note">Una sola salida de tu cuenta. Un abono parcial se aplica en el orden mostrado: primero por vencimiento y, en la misma fecha, MSI antes que compras. Comprueba el desglose con tu banco; no calculamos intereses ni comisiones automáticamente.</p>` +
      amount("amount", "Importe pagado", item.remaining) +
      select(
        "accountId",
        "Pagar desde",
        accountOptions(model.state, true),
        "debit",
      ) +
      input(
        "date",
        "Fecha real de pago",
        C.today(),
        "date",
        `required max="${C.today()}"`,
      ),
    async (f) =>
      commit("Pago de tarjeta registrado", (s) =>
        C.payCard(s, id, next, {
          amount: moneyValue(f.amount),
          accountId: f.accountId,
          date: f.date,
        }),
      ),
    "Registrar pago",
  );
}
function statementLines(item) {
  return `<div class="credit-lines">${item.lines.map((i) => `<div class="item row"><div><strong>${esc(i.name)}</strong><p class="muted">${i.kind === "debt" ? `MSI · Cuota ${i.n}` : i.kind === "opening" ? "Antecedente" : "Compra"}${i.paid || !i.remaining ? " · Pagado" : ""}</p></div><strong>${money(i.remaining)}</strong></div>`).join("")}</div>`;
}
function creditDetails(id) {
  const c = model.state.creditCards.find((c) => c.id === id);
  modal(
    c.name,
    `<p class="note">Los vencimientos se estiman con el corte y día de pago que registraste. Puedes indicar la fecha real del estado de cuenta al capturar una compra. Los MSI conservan su calendario.</p>${
      C.creditPeriods(model.state, id)
        .map((m) => C.creditStatement(model.state, id, m))
        .filter((i) => i.amount)
        .map(
          (i) =>
            `<section class="item"><h3>${i.date} · ${money(i.remaining)} pendientes</h3>${statementLines(i)}${!i.paid ? `<button class="btn primary" data-action="creditPay" data-id="${esc(id)}" data-period="${m}">Pagar este periodo</button>` : '<span class="pill good">Pagado</span>'}</section>`,
        )
        .join("") || "<p>Sin cargos registrados.</p>"
    }`,
  );
}
export function creditAction(action, id, el) {
  if (!action.startsWith("credit")) return false;
  const c = model.state.creditCards.find((c) => c.id === id);
  if (action === "creditDetails") creditDetails(id);
  else if (action === "creditPay") creditPayForm(id, el?.dataset.period);
  else if (action === "creditArchive")
    confirmAction(
      "Archivar tarjeta",
      "Se conservan compras y pagos. Su saldo debe estar en cero.",
      "Tarjeta archivada",
      (s) => {
        if (C.creditSummary(s, id).used)
          throw Error("Liquida el saldo antes de archivar.");
        s.creditCards.find((c) => c.id === id).active = false;
      },
    );
  else if (action === "creditEdit")
    form(
      c ? "Editar tarjeta de crédito" : "Nueva tarjeta de crédito",
      input(
        "name",
        "Nombre de la tarjeta",
        c?.name || "",
        "text",
        'required maxlength="80"',
      ) +
        amount("limit", "Límite de crédito", c?.limit || 0) +
        input(
          "closingDay",
          "Día de corte",
          c?.closingDay || 15,
          "number",
          'required min="1" max="31"',
        ) +
        input(
          "paymentDay",
          "Día límite de pago",
          c?.paymentDay || 5,
          "number",
          'required min="1" max="31"',
        ) +
        (c
          ? '<p class="note">Los cambios de corte y pago se aplican a nuevas compras. Los cargos y MSI existentes conservan sus vencimientos.</p>'
          : amount(
              "openingBalance",
              "Saldo anterior sin MSI (opcional)",
              0,
            ).replace(" required", "") +
            input(
              "openingDueDate",
              "Vencimiento de ese saldo anterior",
              C.today(),
              "date",
              "required",
            ) +
            '<p class="note">No incluyas MSI en el saldo anterior: vincúlalos desde Editar deuda. Registrar la tarjeta no cambia el dinero de tus cuentas.</p>'),
      async (f) =>
        commit("Tarjeta guardada", (s) => {
          const value = {
            name: f.name.trim(),
            limit: moneyValue(f.limit),
            closingDay: Number(f.closingDay),
            paymentDay: Number(f.paymentDay),
            active: true,
          };
          if (c)
            Object.assign(
              s.creditCards.find((x) => x.id === id),
              value,
            );
          else
            s.creditCards.push({
              ...value,
              id: C.id(),
              openingBalance: moneyValue(f.openingBalance || "0"),
              openingDueDate: f.openingDueDate,
            });
        }),
    );
  return true;
}
