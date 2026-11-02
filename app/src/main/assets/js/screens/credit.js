import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
import {
  accountCreateControl,
  afterSelect,
  applyContextualCreations,
  contextualDraftOptions,
} from "../ui/contextual-create.js";
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
  accountName,
  confirmAction,
  dlabel,
} from "../ui/components.js";

function installmentFields(d = {}, draftKey) {
  const key = d.id || draftKey || C.id(),
    locked =
      d.id &&
      (C.allocations(model.state).some((a) => a.ref === d.id) ||
        model.state.transactions.some((t) => t.ref === d.id)),
    field = (name) => `msi_${key}_${name}`;
  return `<section class="card msi-editor" data-msi-row="${esc(key)}" data-existing="${esc(d.id || "")}">
    <div class="row"><h3>${d.id ? "Editar compra a meses sin intereses" : "Compra a meses sin intereses"}</h3>${!d.id ? `<button type="button" class="btn" data-action="creditMsiRemove">Quitar</button>` : ""}</div>
    ${input(field("name"), "Nombre de la compra", d.name || "", "text", 'required maxlength="120"')}
    ${amount(field("balance"), "Saldo pendiente de esta compra", d.balance || 0)}
    ${amount(field("payment"), "Mensualidad", d.payment || 0)}
    ${input(field("totalPayments"), "Mensualidades en total", d.totalPayments || 12, "number", 'required min="1" max="1200"')}
    ${input(field("priorPaid"), "Mensualidades pagadas antes de usar la app", d.historicalPaidPayments?.length || 0, "number", 'required min="0" max="1200"')}
    ${input(field("startDate"), "Fecha de la primera mensualidad", d.startDate || C.today(), "date", "required")}
    ${input(field("dueDay"), "Día de pago de la mensualidad", d.dueDay || 5, "number", 'required min="1" max="31"')}
    ${locked ? '<p class="note">Esta compra a meses ya tiene pagos: conservamos sus importes y calendario. Puedes corregir el nombre sin alterar esos pagos.</p>' : '<p class="note">El saldo pendiente ya debe descontar lo que pagaste antes. Esas mensualidades no se cobrarán de nuevo.</p>'}
  </section>`;
}

function lockInstallments() {
  for (const row of document.querySelectorAll("[data-msi-row]")) {
    const id = row.dataset.existing;
    if (
      id &&
      (C.allocations(model.state).some((a) => a.ref === id) ||
        model.state.transactions.some((t) => t.ref === id))
    )
      row.querySelectorAll("input").forEach((el) => {
        if (!el.name.endsWith("_name")) el.readOnly = true;
      });
  }
}

export function updateCardPreview() {
  const target = document.querySelector("#card-balance-preview");
  if (!target) return;
  const dateWarning = document.querySelector("#card-date-warning");
  try {
    const total = moneyValue(
      document.querySelector('[name="openingBalance"]').value || "0",
    );
    const installments = [
      ...document.querySelectorAll("[data-msi-row]"),
    ].reduce(
      (sum, row) =>
        sum + moneyValue(row.querySelector('[name$="_balance"]').value || "0"),
      0,
    );
    target.textContent = `Saldo total: ${money(total)} · Compras a meses pendientes: ${money(installments)}. La app separa las mensualidades automáticamente; no las restes del saldo total.`;
    const paymentDay = Number(
      document.querySelector('[name="paymentDay"]')?.value,
    );
    const mismatch = [...document.querySelectorAll("[data-msi-row]")]
      .map((row) => ({
        startDate: row.querySelector('[name$="_startDate"]')?.value || "",
        balance: moneyValue(
          row.querySelector('[name$="_balance"]')?.value || "0",
        ),
        payments: Number(
          row.querySelector('[name$="_totalPayments"]')?.value || 0,
        ),
      }))
      .find(({ startDate, balance, payments }) => {
        if (
          !C.validDate(startDate) ||
          balance <= 0 ||
          payments <= 0 ||
          !Number.isInteger(paymentDay) ||
          paymentDay < 1 ||
          paymentDay > 31
        )
          return false;
        return C.dueDate(C.month(startDate), paymentDay) < startDate;
      });
    if (dateWarning) {
      if (mismatch) {
        const firstInstallment = mismatch.startDate,
          cardDue = C.dueDate(C.month(firstInstallment), paymentDay);
        dateWarning.textContent = `Revisa la fecha de la primera mensualidad (${dlabel(firstInstallment)}): queda después del día límite de pago de ese mes (${dlabel(cardDue)}). El pago agrupado podría aparecer antes; verifica en tu estado de cuenta si debe empezar el siguiente ciclo.`;
        dateWarning.hidden = false;
      } else {
        dateWarning.textContent = "";
        dateWarning.hidden = true;
      }
    }
  } catch {
    target.textContent = "Revisa los importes para ver el desglose.";
    if (dateWarning) {
      dateWarning.textContent = "";
      dateWarning.hidden = true;
    }
  }
}

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
          ${v.used > c.limit ? '<p class="note warning">El saldo usado supera el límite. Revisa si registraste la misma compra como gasto y como mensualidades a meses.</p>' : ""}
          ${v.unassigned ? `<p class="note">${money(v.unassigned)} de pagos todavía sin desglose: reducen el saldo, pero no marcan compras o cuotas como pagadas.</p>` : ""}
          ${msi.length ? `<p class="note">${msi.length} ${msi.length === 1 ? "compra" : "compras"} a meses sin intereses (MSI) · ${money(v.installments)} pendiente.</p>` : ""}
          <div class="toolbar wrap"><button class="btn" data-action="creditDetails" data-id="${esc(c.id)}">Ver desglose</button></div>
           <details class="more-actions"><summary>Opciones de la tarjeta</summary><div class="toolbar wrap">${v.used > 0 ? btn("Registrar pago sin desglose", "creditUnassigned", c.id) : ""}${v.unassigned ? btn("Indicar a qué cargos van los pagos", "creditApply", c.id) : ""}${btn("Editar", "creditEdit", c.id)}${c.active !== false ? btn("Archivar", "creditArchive", c.id, "danger") : btn("Reactivar", "creditActivate", c.id)}</div></details>
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
    `<p>Fecha límite: ${dlabel(item.date)} · Total del estado de cuenta: <strong>${money(item.remaining)}</strong></p>${statementLines(item)}<p class="note warning">Esta app no calcula el pago mínimo ni los intereses. Un pago parcial puede generar intereses; verifica en tu estado de cuenta cuánto necesitas pagar para no generarlos.</p><p class="note">El pago se aplica a los cargos en el orden mostrado. Una mensualidad de compra a meses solo se marca pagada cuando recibe el importe completo. Si tu banco no indica qué cargos cubriste, registra un pago sin desglose desde las opciones de la tarjeta.</p>` +
      amount(
        "amount",
        "Importe pagado",
        Math.min(item.remaining, C.creditSummary(model.state, id).used),
      ) +
      afterSelect(
        select(
          "accountId",
          "Pagar desde",
          accountOptions(model.state, true),
          "debit",
        ),
        "accountId",
        accountCreateControl("accountId"),
      ) +
      input(
        "date",
        "Fecha real de pago",
        C.today(),
        "date",
        `required max="${C.today()}"`,
      ),
    async (f) =>
      commit("Pago de tarjeta registrado", (s) => {
        const value = applyContextualCreations(s, f);
        C.payCard(s, id, next, {
          amount: moneyValue(value.amount),
          accountId: value.accountId,
          date: value.date,
        });
      }),
    "Registrar pago",
    { draftKey: `credit-pay:${id}:${next}`, ...contextualDraftOptions() },
  );
}
function creditUnassignedForm(id) {
  const card = C.creditSummary(model.state, id);
  form(
    "Registrar pago sin desglose: " + card.name,
    `<p class="note warning">Esta app no calcula el pago mínimo ni los intereses. Un pago parcial puede generar intereses; verifica en tu estado de cuenta cuánto necesitas pagar para no generarlos.</p><p class="note">El dinero saldrá de tu cuenta y reducirá el saldo usado de la tarjeta. No se marcará ninguna compra o mensualidad como pagada hasta que indiques a qué cargos aplicó el banco.</p>` +
      amount("amount", "Importe del abono", card.used) +
      afterSelect(
        select(
          "accountId",
          "Pagar desde",
          accountOptions(model.state, true),
          "debit",
        ),
        "accountId",
        accountCreateControl("accountId"),
      ) +
      input(
        "date",
        "Fecha real de pago",
        C.today(),
        "date",
        `required max="${C.today()}"`,
      ),
    async (f) =>
      commit("Abono de tarjeta registrado", (s) => {
        const value = applyContextualCreations(s, f);
        C.payCard(s, id, C.month(value.date), {
          amount: moneyValue(value.amount),
          accountId: value.accountId,
          date: value.date,
          unassigned: true,
        });
      }),
    "Registrar abono",
    { draftKey: `credit-deposit:${id}`, ...contextualDraftOptions() },
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
    "Indicar a qué cargos van los pagos: " + card.name,
    `<p class="note">Pago todavía sin desglose: ${money(card.unassigned)}. Indica qué compra o mensualidad cubrió según tu estado de cuenta. Esta operación no vuelve a descontar dinero de tus cuentas.</p>` +
      select(
        "line",
        "Cargo al que se aplica",
        lines.map(({ period, line }, index) => [
          String(index),
          `${period} · ${line.name}${line.kind === "debt" ? ` · Mensualidad ${line.n}` : ""} · ${money(line.remaining)}`,
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
function paymentDistribution(info) {
  return `<div class="credit-lines">${info.allocations.map((a) => `<div class="item row"><span>${esc(a.label)}${a.kind === "debt" ? ` · ${esc(a.period || "")}` : ""}</span><strong>${money(a.amount)}</strong></div>`).join("")}</div>`;
}
function creditPaymentEditForm(txId) {
  const info = C.cardPaymentInfo(model.state, txId),
    card = C.creditSummary(model.state, info.creditCardId);
  form(
    "Corregir pago de tarjeta",
    `<p class="note">Este formulario corrige solo este pago. No revierte otros pagos ni cambia su reparto.</p><p class="note">Importe actual: ${money(info.amount)} · ${dlabel(info.date)} · ${esc(accountName(info.accountId))}. Si lo disminuyes, se liberan primero los abonos sin asignar y después los cargos cubiertos al final. Si lo aumentas, el excedente se aplica a cargos pendientes y, si ya no alcanza, queda como abono sin asignar.</p>${paymentDistribution(info)}` +
      amount("amount", "Importe real del pago", info.amount) +
      afterSelect(
        select(
          "accountId",
          "Pagar desde",
          accountOptions(model.state, true),
          info.accountId,
        ),
        "accountId",
        accountCreateControl("accountId"),
      ) +
      input(
        "date",
        "Fecha real de pago",
        info.date,
        "date",
        `required max="${C.today()}"`,
      ) +
      '<p class="note">No puedes fechar el pago antes de una compra que ya cubre. En ese caso reasigna primero ese importe a otro cargo.</p>',
    async (f) =>
      commit("Pago de tarjeta corregido", (s) => {
        const value = applyContextualCreations(s, f);
        C.correctCardPayment(s, txId, {
          amount: moneyValue(value.amount),
          accountId: value.accountId,
          date: value.date,
        });
      }),
    "Guardar corrección",
    { draftKey: `credit-payment:${txId}`, ...contextualDraftOptions() },
  );
  if (card.active === false)
    document
      .querySelector("#form")
      ?.insertAdjacentHTML(
        "afterbegin",
        '<p class="note warning">La tarjeta está archivada, pero puedes corregir este pago existente.</p>',
      );
}
function samePaymentLine(a, b) {
  return (
    a.kind === b.kind &&
    a.ref === b.ref &&
    (a.obligation || "") === (b.obligation || "") &&
    (a.n || 0) === (b.n || 0)
  );
}
function creditPaymentReassignForm(txId) {
  const info = C.cardPaymentInfo(model.state, txId),
    targets = C.cardPaymentTargets(model.state, txId),
    sources = info.allocations.filter((a) => a.amount > 0);
  if (!sources.length) {
    modal(
      "Reasignar pago",
      `<p>Este pago no tiene aplicaciones que se puedan mover.</p>${btn("Entendido", "close", "", "full")}`,
    );
    return;
  }
  if (!targets.length) {
    modal(
      "Reasignar pago",
      `<p>No hay otros cargos pendientes a los que mover este importe. Corrige el importe o el estado de cuenta antes de reasignar.</p>${btn("Entendido", "close", "", "full")}`,
    );
    return;
  }
  const defaultTarget = Math.max(
    0,
    targets.findIndex((target) => !samePaymentLine(target, sources[0])),
  );
  form(
    "Reasignar pago de tarjeta",
    `<p class="note">Mover un importe no cambia el dinero que salió de tu cuenta, la fecha ni los demás pagos. Solo cambia qué cargos quedan cubiertos.</p><p class="note">Puedes mover hasta lo que este pago tiene en el cargo de origen y hasta lo pendiente del cargo de destino. El destino debe ser un cargo distinto del origen.</p>${paymentDistribution(info)}` +
      select(
        "source",
        "Quitar de este cargo",
        sources.map((a) => [
          String(a.index),
          `${a.label}${a.kind === "debt" ? ` · ${a.period || ""}` : ""} · ${money(a.amount)}`,
        ]),
        String(sources[0].index),
      ) +
      select(
        "target",
        "Aplicar a este cargo",
        targets.map((target, index) => [
          String(index),
          `${target.label} · ${money(target.remaining)} disponible`,
        ]),
        String(defaultTarget),
      ) +
      amount(
        "amount",
        "Importe a mover",
        Math.min(sources[0].amount, targets[defaultTarget].remaining),
      ),
    async (f) => {
      const source = info.allocations[Number(f.source)],
        target = targets[Number(f.target)],
        moved = moneyValue(f.amount);
      if (!source || !target) throw Error("Elige el origen y el destino.");
      if (samePaymentLine(source, target))
        throw Error("Elige un cargo de destino distinto del cargo de origen.");
      if (moved > source.amount)
        throw Error(
          `Solo puedes mover ${money(source.amount)} de ese cargo de origen.`,
        );
      if (moved > target.remaining)
        throw Error(
          `Ese cargo de destino solo admite ${money(target.remaining)}.`,
        );
      return commit("Pago de tarjeta reasignado", (s) =>
        C.reassignCardPayment(s, txId, {
          from: Number(f.source),
          to: target,
          amount: moved,
        }),
      );
    },
    "Reasignar",
    { draftKey: `credit-reassign:${txId}` },
  );
}
function statementLines(item, history = false) {
  const lines = item.lines.filter((i) => history || i.remaining > 0);
  return `<div class="credit-lines">${lines.map((i) => `<div class="item row"><div><strong>${esc(i.name)}</strong><p class="muted">${i.kind === "debt" ? `Compra a meses · Cuota ${i.n}` : i.kind === "opening" ? "Saldo anterior" : "Compra"}${i.paid || !i.remaining ? " · Pagado" : ""}</p></div><strong>${money(history && !i.remaining ? i.amount : i.remaining)}</strong></div>`).join("")}</div>`;
}
function creditDetails(id) {
  const c = model.state.creditCards.find((c) => c.id === id);
  const periods = C.creditPeriods(model.state, id)
    .map((period) => ({
      period,
      statement: C.creditStatement(model.state, id, period),
    }))
    .filter(({ statement }) => statement.amount);
  const pending = periods.filter(({ statement }) => !statement.paid);
  const paid = periods.filter(({ statement }) => statement.paid);
  const renderPeriod = ({ period, statement: i }, history = false) =>
    `<section class="item"><h3>${dlabel(i.date)} · ${history ? "Pagado" : money(i.remaining) + " pendiente"}</h3>${statementLines(i, history)}${!history && C.creditSummary(model.state, id).used > 0 ? `<button class="btn primary" data-action="creditPay" data-id="${esc(id)}" data-period="${period}">Pagar este periodo</button>` : ""}${!history && i.lines.some((line) => !line.remaining) ? `<details><summary>Cargos pagados de este periodo</summary>${statementLines({ ...i, lines: i.lines.filter((line) => !line.remaining) }, true)}</details>` : ""}</section>`;
  const msi = model.state.debts.filter(
      (d) => d.creditCardId === id && !d.archived,
    ),
    payments = model.state.transactions
      .filter((t) => t.kind === "card_payment" && t.creditCardId === id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const paymentRows = payments
    .map(
      (t) =>
        `<section class="item"><div class="row"><div><strong>${dlabel(t.date)} · ${money(t.amount)}</strong><p class="muted">${esc(accountName(t.accountId))} · ${t.allocations.length} ${t.allocations.length === 1 ? "cargo cubierto" : "cargos cubiertos"}</p></div></div>${t.historical ? '<p class="note">Pago importado: se conserva como antecedente y no se corrige desde aquí.</p>' : `<div class="toolbar wrap">${btn("Corregir pago", "creditPaymentEdit", t.id)}${btn("Reasignar", "creditPaymentReassign", t.id)}</div>`}</section>`,
    )
    .join("");
  modal(
    c.name,
    `<p class="note">Las fechas se estiman con el día de corte y la fecha límite de pago que registraste. Puedes corregir la fecha de una compra con tu estado de cuenta. Las compras a meses conservan su calendario.</p>${C.creditSummary(model.state, id).unassigned ? `<p class="note">Pagos todavía sin desglose: ${money(C.creditSummary(model.state, id).unassigned)}. Reducen lo que debes, pero las compras y mensualidades seguirán pendientes hasta que indiques a qué cargos van.</p>${btn("Indicar a qué cargos van los pagos", "creditApply", id)}` : ""}${
      pending.map((p) => renderPeriod(p)).join("") ||
      "<p>No tienes cargos pendientes.</p>"
    }${paid.length ? `<details class="paid-periods"><summary>Historial: ${paid.length} periodos pagados</summary>${paid.map((p) => renderPeriod(p, true)).join("")}</details>` : ""}${payments.length ? `<details class="more-actions"><summary>Pagos registrados: ${payments.length}</summary><p class="note">Corregir un pago no revierte los demás pagos. Puedes cambiar su importe, fecha u origen, o mover un importe entre cargos sin alterar el dinero que ya salió de tu cuenta.</p>${paymentRows}</details>` : ""}${msi.length ? `<h3>Compras a meses</h3>${msi.map((d) => `<button class="list-row" data-action="debtDetails" data-id="${esc(d.id)}"><span>${esc(d.name)} · ${money(d.balance)} pendiente</span>${svg("chevron")}</button>`).join("")}` : ""}<div class="toolbar wrap">${btn("Editar tarjeta y compras a meses", "creditEdit", id)}</div>`,
  );
}
export function creditAction(action, id, el) {
  if (!action.startsWith("credit")) return false;
  const c = model.state.creditCards.find((c) => c.id === id);
  if (action === "creditDetails") creditDetails(id);
  else if (action === "creditMsiAdd") {
    document
      .querySelector("#card-installments")
      .insertAdjacentHTML("beforeend", installmentFields());
    document
      .querySelector("#card-installments [data-msi-row]:last-child input")
      .focus();
    updateCardPreview();
    document.dispatchEvent(new Event("formstructurechange"));
  } else if (action === "creditMsiRemove") {
    el.closest("[data-msi-row]").remove();
    updateCardPreview();
    document.dispatchEvent(new Event("formstructurechange"));
  } else if (action === "creditPay") creditPayForm(id, el?.dataset.period);
  else if (action === "creditPaymentEdit") creditPaymentEditForm(id);
  else if (action === "creditPaymentReassign") creditPaymentReassignForm(id);
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
        amount(
          "openingBalance",
          "Saldo total que debes hoy (incluye compras a meses)",
          c ? C.creditSummary(model.state, id).used : 0,
        ) +
        '<p class="note">Copia el saldo total de tu banco, incluyendo lo que falta de tus compras a meses sin intereses. No restes esas compras.</p>' +
        input(
          "openingDueDate",
          "Fecha límite de compras y saldo anterior (sin mensualidades)",
          c?.openingDueDate || C.today(),
          "date",
          "required",
        ) +
        '<h3>Compras a meses sin intereses</h3><p class="note">Agrega aquí las compras que ya están incluidas en el saldo total. Se guardará todo junto, sin crear gastos ni retirar dinero.</p>' +
        `<div id="card-installments">${model.state.debts
          .filter((d) => d.creditCardId === id && !d.archived)
          .map(installmentFields)
          .join(
            "",
          )}</div><button type="button" class="btn" data-action="creditMsiAdd">Agregar compra a meses</button><p id="card-balance-preview" class="note" aria-live="polite"></p><p id="card-date-warning" class="note warning" role="status" hidden></p>` +
        (c
          ? '<p class="note">Cambiar corte y día límite afecta nuevas compras; los cargos existentes conservan su vencimiento. Corregir el saldo total ajusta solo el saldo anterior y compras (no mensualidades), sin cambiar pagos ni compras registrados.</p>'
          : ""),
      async (f) => {
        const installments = [
          ...document.querySelectorAll("[data-msi-row]"),
        ].map((row) => {
          const field = (name) => f[`msi_${row.dataset.msiRow}_${name}`];
          return {
            id: row.dataset.existing || undefined,
            name: field("name"),
            balance: moneyValue(field("balance")),
            payment: moneyValue(field("payment")),
            totalPayments: Number(field("totalPayments")),
            priorPaid: Number(field("priorPaid")),
            startDate: field("startDate"),
            dueDay: Number(field("dueDay")),
          };
        });
        return commit("Tarjeta guardada", (s) =>
          C.saveCreditCard(
            s,
            id || null,
            {
              name: f.name,
              limit: moneyValue(f.limit),
              closingDay: Number(f.closingDay),
              paymentDay: Number(f.paymentDay),
              totalBalance: moneyValue(f.openingBalance),
              openingDueDate: f.openingDueDate,
            },
            installments,
          ),
        );
      },
      "Guardar",
      {
        draftKey: `credit:${id || "new"}`,
        captureStructure: () =>
          [...document.querySelectorAll("[data-msi-row]")]
            .filter((row) => !row.dataset.existing)
            .map((row) => row.dataset.msiRow),
        restoreStructure: (keys) => {
          for (const row of document.querySelectorAll("[data-msi-row]"))
            if (!row.dataset.existing) row.remove();
          for (const key of (Array.isArray(keys) ? keys : []).slice(0, 100))
            if (typeof key === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(key))
              document
                .querySelector("#card-installments")
                .insertAdjacentHTML("beforeend", installmentFields({}, key));
        },
        onDraftRestore: () => {
          lockInstallments();
          updateCardPreview();
        },
      },
    );
  if (action === "creditEdit") {
    lockInstallments();
    updateCardPreview();
  }
  return true;
}
