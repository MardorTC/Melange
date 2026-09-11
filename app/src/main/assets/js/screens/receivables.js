import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
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
  empty,
} from "../ui/components.js";
export function receivablesPage() {
  return `<div class="row"><h2>Me deben</h2>${btn("Registrar préstamo", "loanCreate")}</div><section class="card hero"><small>Dinero por recuperar</small><div class="metric">${money(C.metrics(model.state).receivable)}</div><p>No forma parte del disponible.</p></section>${
    model.state.receivables
      .map(
        (l) =>
          `<section class="card"><h2>${esc(l.person)}</h2><p>${esc(l.name)}</p><div class="metric">${money(C.loanBalance(model.state, l.id))}</div><p>${l.dueDate ? "Vence: " + l.dueDate : "Sin vencimiento"} · Antecedente: ${money(l.opening)}</p>${C.loanBalance(model.state, l.id) > 0 ? btn("Registrar cobro", "loanCollect", l.id) : '<span class="pill good">Recuperado</span>'}${model.state.transactions
            .filter((t) => t.ref === l.id)
            .map(
              (t) =>
                `<div class="item row"><span>${t.date} · ${t.kind === "loan_in" ? "Cobro" : "Préstamo"} · ${money(t.amount)}</span>${btn("Revertir", "deleteTransaction", t.id)}</div>`,
            )
            .join("")}</section>`,
      )
      .join("") || empty("Sin préstamos", "Registra dinero que te deben.")
  }`;
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
        select(
          "accountId",
          "Cuenta de origen",
          accountOptions(model.state, true),
          "debit",
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
          const n = moneyValue(f.amount);
          if (n <= 0) throw Error("Introduce un importe mayor a cero.");
          const l = {
            id: C.id(),
            name: f.name.trim(),
            person: f.person.trim(),
            opening: f.origin === "old" ? n : 0,
            dueDate: f.dueDate || null,
            createdDate: f.date,
          };
          s.receivables.push(l);
          if (f.origin === "new")
            C.record(s, {
              kind: "loan_out",
              ref: l.id,
              name: l.name,
              amount: n,
              accountId: f.accountId,
              date: f.date,
            });
        }),
    );
  else if (action === "loanCollect") {
    const l = model.state.receivables.find((l) => l.id === id);
    form(
      "Cobro: " + l.person,
      amount("amount", "Importe recibido", C.loanBalance(model.state, id)) +
        select(
          "accountId",
          "Recibir en",
          accountOptions(model.state, true),
          "debit",
        ) +
        input(
          "date",
          "Fecha real",
          C.today(),
          "date",
          `required max="${C.today()}"`,
        ),
      async (f) =>
        commit("Cobro registrado", (s) =>
          C.record(s, {
            kind: "loan_in",
            ref: id,
            name: l.name,
            amount: moneyValue(f.amount),
            accountId: f.accountId,
            date: f.date,
          }),
        ),
    );
  } else return false;
  return true;
}
