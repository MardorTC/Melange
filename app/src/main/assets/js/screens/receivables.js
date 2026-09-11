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
  svg,
} from "../ui/components.js";

export function receivablesPage() {
  const receivable = C.metrics(model.state).receivable,
    open = model.state.receivables.filter(
      (l) => C.loanBalance(model.state, l.id) > 0,
    ).length;
  return `<div class="receivable-toolbar">${btn("Registrar préstamo", "loanCreate", "", "primary")}</div><section class="card hero debt-hero receivable-hero"><small>Dinero por recuperar</small><div class="metric">${money(receivable)}</div><p>${open ? `${open} ${open === 1 ? "préstamo pendiente" : "préstamos pendientes"}` : "No forma parte del disponible."}</p></section><div class="debt-list-heading"><h2>Dinero que me deben</h2></div>${
    model.state.receivables
      .map((l) => {
        const balance = C.loanBalance(model.state, l.id),
          recovered = balance <= 0;
        return `<section class="card receivable-card ${recovered ? "is-paid" : ""}"><div class="debt-type-icon ${recovered ? "success" : "info"}">${svg("wallet")}</div><div class="receivable-content"><div class="row"><div><h2>${esc(l.person)}</h2><small>${esc(l.name)}</small></div>${recovered ? '<span class="pill good">Recuperado</span>' : ""}</div><div class="metric">${money(balance)}</div><p class="note">${l.dueDate ? "Vence: " + l.dueDate : "Sin vencimiento"} · Antecedente: ${money(l.opening)}</p>${model.state.transactions
          .filter((t) => t.ref === l.id)
          .map(
            (t) =>
              `<div class="item row receivable-movement"><span>${t.date} · ${t.kind === "loan_in" ? "Cobro" : "Préstamo"} · ${money(t.amount)}</span>${btn("Revertir", "deleteTransaction", t.id)}</div>`,
          )
          .join(
            "",
          )}</div><div class="receivable-actions">${balance > 0 ? btn("Registrar cobro", "loanCollect", l.id, "primary") : ""}</div></section>`;
      })
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
