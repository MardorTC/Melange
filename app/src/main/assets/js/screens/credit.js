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
  svg,
  empty,
  accountOptions,
  confirmAction,
  dlabel,
} from "../ui/components.js";

export function creditCardsSection() {
  if (!model.state.creditCards.length)
    return `<section class="card">${empty("Sin tarjetas de crédito", "Agrega una tarjeta para separar tu crédito de tu dinero disponible.")}</section>`;
  return `<div class="section-head"><h2>Tus tarjetas</h2><button class="text-action" data-action="creditEdit">Agregar</button></div><div class="credit-stack">${model.state.creditCards
    .map((c) => {
      const v = C.creditSummary(model.state, c.id),
        next = C.creditPeriods(model.state, c.id)
          .map((m) => C.creditStatement(model.state, c.id, m))
          .find((i) => !i.paid),
        pct = c.limit ? Math.min(100, (v.used / c.limit) * 100) : 0,
        overdue = next && next.date < C.today(),
        msi = model.state.debts.filter(
          (d) => d.creditCardId === c.id && d.balance > 0 && !d.archived,
        );
      return `<section class="credit-ticket ${c.active === false ? "archived" : ""}">
        <div class="credit-ticket-top">
          <div class="credit-topline"><span class="credit-brand">${svg("card")}Tarjeta de crédito</span><span class="credit-status">${c.active === false ? "Archivada" : "Activa"}</span></div>
          <div class="credit-name">${esc(c.name)}</div>
          <div class="credit-used"><small>Saldo usado</small><strong class="${v.used > c.limit ? "bad" : ""}">${money(v.used)}</strong></div>
          <div class="credit-meter"><span style="width:${pct}%"></span></div>
          <div class="credit-meta"><span>Corte ${c.closingDay}</span><span>Pago ${c.paymentDay}</span><span>Límite ${money(c.limit)}</span></div>
        </div>
        <div class="credit-ticket-bottom">
          ${next ? `<div class="next-payment"><div><small class="${overdue ? "bad" : ""}">${overdue ? "Pago vencido" : "Próximo pago"}</small><strong>${money(next.remaining)}</strong><span class="${overdue ? "bad" : "muted"}">${dlabel(next.date)}${overdue ? " · Vencido" : ""}</span></div>${v.used > 0 ? `<button class="btn primary" data-action="creditPay" data-id="${esc(c.id)}" aria-label="Pagar tarjeta">Pagar</button>` : ""}</div>` : '<p class="note">Sin pagos pendientes.</p>'}
          ${v.used > c.limit ? '<p class="note warning">El saldo usado supera el límite. Revisa si registraste la misma compra como gasto y como MSI.</p>' : ""}
          ${v.unassigned ? `<p class="note">${money(v.unassigned)} abonados sin asignar: reducen el saldo, pero no marcan cuotas hasta aplicarlos.</p>` : ""}
          ${msi.length ? `<p class="note">${msi.length} MSI con saldo · ${money(v.installments)} pendiente en cuotas.</p>` : ""}
          <div class="toolbar wrap"><button class="btn" data-action="creditDetails" data-id="${esc(c.id)}">Ver desglose</button></div>
          <details class="more-actions"><summary>Opciones de la tarjeta</summary><div class="toolbar wrap">${v.used > 0 ? btn("Abonar sin asignar", "creditUnassigned", c.id) : ""}${v.unassigned ? btn("Aplicar abonos", "creditApply", c.id) : ""}${btn("Editar", "creditEdit", c.id)}${c.active !== false ? btn("Archivar", "creditArchive", c.id, "danger") : btn("Reactivar", "creditActivate", c.id)}</div></details>
        </div>
      </section>`;
    })
    .join("")}</div>`;
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
    `<p>Vencimiento: ${dlabel(item.date)} · Cargos pendientes de asignar: <strong>${money(item.remaining)}</strong></p>${statementLines(item)}<p class="note warning">Esta app no calcula el pago mínimo ni los intereses. Un pago parcial puede generar intereses; verifica en tu estado de cuenta el importe para no generar intereses.</p><p class="note">Este pago se asigna en el orden mostrado. Una cuota MSI solo se marca pagada cuando recibe su importe completo. Si no conoces la asignación del banco, usa «Abonar sin asignar» desde la tarjeta; ese abono reduce la deuda total sin marcar cuotas.</p>` +
      amount(
        "amount",
        "Importe pagado",
        Math.min(item.remaining, C.creditSummary(model.state, id).used),
      ) +
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
function creditUnassignedForm(id) {
  const card = C.creditSummary(model.state, id);
  form(
    "Abonar sin asignar: " + card.name,
    `<p class="note warning">Esta app no calcula el pago mínimo ni los intereses. Un abono parcial puede generar intereses; verifica el importe para no generar intereses en tu estado de cuenta.</p><p class="note">El dinero saldrá de tu cuenta y reducirá el saldo usado de la tarjeta. Ninguna compra o mensualidad MSI se marcará pagada hasta que apliques el abono según tu estado de cuenta.</p>` +
      amount("amount", "Importe del abono", card.used) +
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
      commit("Abono de tarjeta registrado", (s) =>
        C.payCard(s, id, C.month(f.date), {
          amount: moneyValue(f.amount),
          accountId: f.accountId,
          date: f.date,
          unassigned: true,
        }),
      ),
    "Registrar abono",
  );
}
function creditApplyForm(id) {
  const card = C.creditSummary(model.state, id);
  const lines = C.creditPeriods(model.state, id).flatMap((period) =>
    C.creditStatement(model.state, id, period)
      .lines.filter((line) => line.remaining > 0)
      .map((line) => ({ period, line })),
  );
  form(
    "Aplicar abonos: " + card.name,
    `<p class="note">Disponible para aplicar: ${money(card.unassigned)}. Elige el cargo concreto según tu estado de cuenta. Esta operación no vuelve a descontar dinero de tus cuentas.</p>` +
      select(
        "line",
        "Cargo al que se aplica",
        lines.map(({ period, line }, index) => [
          String(index),
          `${period} · ${line.name}${line.kind === "debt" ? ` · MSI ${line.n}` : ""} · ${money(line.remaining)}`,
        ]),
        "0",
      ) +
      amount(
        "amount",
        "Importe a aplicar",
        Math.min(card.unassigned, lines[0]?.line.remaining || 0),
      ),
    async (f) => {
      const selected = lines[Number(f.line)];
      if (!selected) throw Error("Elige un cargo válido.");
      return commit("Abono aplicado", (s) =>
        C.applyCardCredit(
          s,
          id,
          selected.period,
          moneyValue(f.amount),
          selected.line,
        ),
      );
    },
    "Aplicar abono",
  );
}
function statementLines(item) {
  return `<div class="credit-lines">${item.lines.map((i) => `<div class="item row"><div><strong>${esc(i.name)}</strong><p class="muted">${i.kind === "debt" ? `MSI · Cuota ${i.n}` : i.kind === "opening" ? "Antecedente" : "Compra"}${i.paid || !i.remaining ? " · Pagado" : ""}</p></div><strong>${money(i.remaining)}</strong></div>`).join("")}</div>`;
}
function creditDetails(id) {
  const c = model.state.creditCards.find((c) => c.id === id);
  modal(
    c.name,
    `<p class="note">Los vencimientos se estiman con el corte y día de pago que registraste. Puedes indicar la fecha real del estado de cuenta al capturar una compra. Los MSI conservan su calendario.</p>${C.creditSummary(model.state, id).unassigned ? `<p class="note">Abonos sin asignar: ${money(C.creditSummary(model.state, id).unassigned)}. Reducen la deuda total, pero los cargos siguientes seguirán visibles hasta que los apliques.</p>${btn("Aplicar abonos", "creditApply", id)}` : ""}${
      C.creditPeriods(model.state, id)
        .map((period) => ({
          period,
          statement: C.creditStatement(model.state, id, period),
        }))
        .filter(({ statement }) => statement.amount)
        .map(
          ({ period, statement: i }) =>
            `<section class="item"><h3>${dlabel(i.date)} · ${money(i.remaining)} en cargos</h3>${statementLines(i)}${!i.paid && C.creditSummary(model.state, id).used > 0 ? `<button class="btn primary" data-action="creditPay" data-id="${esc(id)}" data-period="${period}">Pagar este periodo</button>` : i.paid ? '<span class="pill good">Pagado</span>' : '<span class="pill">Cubierto por abonos sin asignar</span>'}</section>`,
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
  else if (action === "creditUnassigned") creditUnassignedForm(id);
  else if (action === "creditApply") creditApplyForm(id);
  else if (action === "creditActivate")
    confirmAction(
      "Reactivar tarjeta",
      "Volverá a aparecer para nuevas compras y pagos agrupados.",
      "Tarjeta reactivada",
      (s) => {
        const card = s.creditCards.find((c) => c.id === id);
        if (!card) throw Error("Tarjeta no encontrada.");
        card.active = true;
      },
    );
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
            active: c ? c.active !== false : true,
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
