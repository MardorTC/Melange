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
  btn,
  esc,
  money,
  form,
  input,
  amount,
  select,
  moneyValue,
  accountOptions,
  accountName,
  empty,
  svg,
  dlabel,
} from "../ui/components.js";

export function receivablesPage() {
  const receivable = C.metrics(model.state).receivable,
    open = model.state.receivables.filter(
      (l) => C.loanBalance(model.state, l.id) > 0,
    ).length;
  return `<section class="card hero receivable-hero"><small>Dinero por recuperar</small><div class="metric">${money(receivable)}</div><p>${open ? `${open} ${open === 1 ? "préstamo pendiente" : "préstamos pendientes"}` : "No forma parte del disponible."}</p></section><div class="section-head"><h2>Dinero que me deben</h2></div><p class="note">Cada cobro aparece como <strong>Entrada de dinero</strong> y muestra la cuenta donde se recibió. Cada préstamo nuevo aparece como <strong>Salida de dinero</strong> y la cuenta de origen. Lo pendiente por cobrar no forma parte de tu disponible hasta que lo recibas.</p>${
    model.state.receivables
      .map((l) => {
        const balance = C.loanBalance(model.state, l.id),
          recovered = balance <= 0,
          chronology = C.loanTimelineIssue(model.state, l.id);
        return `<section class="card receivable-card ${recovered ? "is-paid" : ""}"><div class="debt-type-icon ${recovered ? "success" : "info"}">${svg("wallet")}</div><div class="receivable-content"><div class="row"><div><h2>${esc(l.person)}</h2><small>${esc(l.name)}</small></div>${recovered ? '<span class="pill good">Recuperado</span>' : ""}</div><div class="metric">${money(balance)}</div><p class="note">${l.dueDate ? "Vence: " + dlabel(l.dueDate) : "Sin vencimiento"} · Antecedente: ${money(l.opening)}</p>${chronology ? `<p class="note warning" role="alert"><strong>Revisa las fechas de este préstamo.</strong> ${esc(chronology)} Se conservó el registro original; usa Corregir en el movimiento para revisarlo.</p>` : ""}${model.state.transactions
          .filter((t) => t.ref === l.id)
          .map((t) => {
            const incoming = t.kind === "loan_in";
            return `<div class="item receivable-movement"><div class="row"><span class="row-icon ${incoming ? "green" : "gray"}">${svg(incoming ? "plus" : "minus")}</span><div><strong>${incoming ? "Entrada de dinero" : "Salida de dinero"} · ${incoming ? "Cobro" : "Préstamo"} · ${money(t.amount)}</strong><p class="muted">${dlabel(t.date, false)} · ${incoming ? "Recibido en" : "Salió de"}: ${esc(accountName(t.accountId))}</p></div></div><div class="toolbar wrap">${btn("Corregir", "loanMovementEdit", t.id)}${btn("Revertir", "deleteTransaction", t.id, "danger")}</div></div>`;
          })
          .join(
            "",
          )}</div><div class="receivable-actions">${balance > 0 ? btn("Registrar cobro", "loanCollect", l.id, "primary") : ""}${btn("Corregir préstamo", "loanEdit", l.id)}</div></section>`;
      })
      .join("") || empty("Sin préstamos", "Registra dinero que te deben.")
  }`;
}

function loanEditForm(id) {
  const l = model.state.receivables.find((x) => x.id === id);
  if (!l) throw Error("Préstamo no encontrado.");
  const balance = C.loanBalance(model.state, id),
    lent = model.state.transactions
      .filter((t) => t.ref === id && t.kind === "loan_out")
      .reduce((n, t) => n + t.amount, 0),
    collected = model.state.transactions
      .filter((t) => t.ref === id && t.kind === "loan_in")
      .reduce((n, t) => n + t.amount, 0);
  form(
    "Corregir préstamo: " + l.person,
    `<p class="note">Saldo pendiente: ${money(balance)} · Prestado con movimientos: ${money(lent)} · Cobrado: ${money(collected)}.</p><p class="note">El antecedente es dinero que ya habías prestado y que no volverá a descontarse de tus cuentas. Corregirlo cambia lo que te deben, no mueve saldo. No puede quedar por debajo de los cobros ya registrados.</p>` +
      input("person", "Persona", l.person, "text", 'required maxlength="100"') +
      input("name", "Concepto", l.name, "text", 'required maxlength="120"') +
      amount("opening", "Antecedente ya descontado", l.opening) +
      input("dueDate", "Vencimiento (opcional)", l.dueDate || "", "date") +
      '<p class="note">Para corregir un cobro o el dinero prestado, usa «Corregir» en el movimiento correspondiente. Esos cambios sí ajustan la cuenta.</p>',
    async (f) =>
      commit("Préstamo corregido", (s) =>
        C.editLoan(s, id, {
          person: f.person,
          name: f.name,
          opening: moneyValue(f.opening),
          dueDate: f.dueDate || null,
        }),
      ),
    "Guardar corrección",
    { draftKey: `loan:${id}` },
  );
}
function loanMovementEditForm(txId) {
  const t = model.state.transactions.find((x) => x.id === txId);
  if (!t) throw Error("Movimiento no encontrado.");
  if (!["loan_in", "loan_out"].includes(t.kind))
    throw Error("Este movimiento no pertenece a un préstamo.");
  const l = model.state.receivables.find((x) => x.id === t.ref);
  if (!l) throw Error("Préstamo no encontrado.");
  const incoming = t.kind === "loan_in",
    balanceWithout =
      C.loanBalance(model.state, l.id) + (incoming ? t.amount : -t.amount);
  form(
    incoming ? "Corregir cobro: " + l.person : "Corregir préstamo: " + l.person,
    `<p class="note">${incoming ? `Este cobro es una <strong>entrada de dinero</strong> a la cuenta que elijas.` : `Este préstamo es una <strong>salida de dinero</strong> de la cuenta que elijas.`} Se corrige solo este movimiento; los demás cobros y préstamos no se revierten.</p>` +
      (incoming
        ? `<p class="note">Saldo sin este cobro: ${money(balanceWithout)}. El nuevo importe no puede superarlo. Si el dinero ya se gastó, la corrección puede requerir ajustar la cuenta; no se deshacen otros cobros.</p>`
        : '<p class="note">El nuevo importe debe caber en el disponible de la cuenta de origen. Si aumentas el préstamo, se descontará más dinero.</p>') +
      amount(
        "amount",
        incoming ? "Importe recibido" : "Importe prestado",
        t.amount,
      ) +
      afterSelect(
        select(
          "accountId",
          incoming ? "Recibir en" : "Pagar desde",
          accountOptions(model.state, true),
          t.accountId,
        ),
        "accountId",
        accountCreateControl("accountId"),
      ) +
      input(
        "date",
        "Fecha real",
        t.date,
        "date",
        `required max="${C.today()}"`,
      ) +
      `<p class="note">${dlabel(t.date, false)} · ${incoming ? "Recibido en" : "Salió de"}: ${esc(accountName(t.accountId))}. Para eliminar por completo este movimiento, usa «Revertir».</p>`,
    async (f) =>
      commit(incoming ? "Cobro corregido" : "Préstamo corregido", (s) => {
        const value = applyContextualCreations(s, f);
        C.editLoanMovement(s, txId, {
          amount: moneyValue(value.amount),
          accountId: value.accountId,
          date: value.date,
        });
      }),
    "Guardar corrección",
    { draftKey: `loan-movement:${txId}`, ...contextualDraftOptions() },
  );
}
export function loanAction(action, id) {
  if (action === "loanCreate")
    form(
      "Dinero que me deben",
      input("person", "Persona", "", "text", 'required maxlength="100"') +
        input("name", "Concepto", "", "text", 'required maxlength="120"') +
        amount("amount", "Importe pendiente / prestado") +
        select(
          "origin",
          "Cuándo se prestó",
          [
            ["new", "Préstamo nuevo: descontar de la cuenta"],
            ["old", "Préstamo anterior: ya está descontado"],
          ],
          "new",
        ) +
        afterSelect(
          select(
            "accountId",
            "Cuenta de origen",
            accountOptions(model.state, true),
            "debit",
          ),
          "accountId",
          accountCreateControl("accountId"),
        ) +
        input(
          "date",
          "Fecha del préstamo",
          C.today(),
          "date",
          `required max="${C.today()}"`,
        ) +
        input("dueDate", "Vencimiento (opcional)", "", "date"),
      async (f) =>
        commit("Préstamo registrado", (s) => {
          const value = applyContextualCreations(s, {
              ...f,
              accountId: f.origin === "new" ? f.accountId : "",
            }),
            n = moneyValue(value.amount);
          if (n <= 0) throw Error("Introduce un importe mayor a cero.");
          const l = {
            id: C.id(),
            name: value.name.trim(),
            person: value.person.trim(),
            opening: value.origin === "old" ? n : 0,
            dueDate: value.dueDate || null,
            createdDate: value.date,
          };
          s.receivables.push(l);
          if (value.origin === "new")
            C.record(s, {
              kind: "loan_out",
              ref: l.id,
              name: l.name,
              amount: n,
              accountId: value.accountId,
              date: value.date,
            });
        }),
      "Guardar",
      { draftKey: "loan:new", ...contextualDraftOptions() },
    );
  else if (action === "loanCollect") {
    const l = model.state.receivables.find((l) => l.id === id);
    form(
      "Cobro: " + l.person,
      amount("amount", "Importe recibido", C.loanBalance(model.state, id)) +
        afterSelect(
          select(
            "accountId",
            "Recibir en",
            accountOptions(model.state, true),
            "debit",
          ),
          "accountId",
          accountCreateControl("accountId"),
        ) +
        input(
          "date",
          "Fecha real",
          C.today(),
          "date",
          `required max="${C.today()}"`,
        ) +
        `<p class="note">El cobro se registrará como <strong>Entrada de dinero</strong> en la cuenta elegida y aumentará su saldo. Saldo pendiente: ${money(C.loanBalance(model.state, id))}. No puedes cobrar más que ese saldo.</p>`,
      async (f) => {
        const pending = C.loanBalance(model.state, id);
        return commit("Cobro registrado", (s) => {
          const value = applyContextualCreations(s, f),
            amount = moneyValue(value.amount);
          if (amount <= 0) throw Error("Introduce un importe mayor a cero.");
          if (amount > pending)
            throw Error(
              `El cobro supera el saldo pendiente (${money(pending)}). Corrige el importe o el préstamo.`,
            );
          C.record(s, {
            kind: "loan_in",
            ref: id,
            name: l.name,
            amount,
            accountId: value.accountId,
            date: value.date,
          });
        });
      },
      "Guardar",
      { draftKey: `loan-collect:${id}`, ...contextualDraftOptions() },
    );
  } else if (action === "loanEdit") loanEditForm(id);
  else if (action === "loanMovementEdit") loanMovementEditForm(id);
  else return false;
  return true;
}
