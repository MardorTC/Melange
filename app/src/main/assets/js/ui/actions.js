import { creditAction } from "../screens/credit.js";
import { accountAction } from "../screens/accounts.js";
import { loanAction } from "../screens/receivables.js";
import { updateAction } from "../platform/updates.js";
import { backPage, openPage, render } from "./navigation.js";
import { model } from "../state/model.js";
import C from "../domain/finance.js";
import {
  closeModal,
  modal,
  money,
  form,
  amount,
  input,
  moneyValue,
  $,
  btn,
  select,
  esc,
  empty,
  confirmAction,
} from "./components.js";
import { commit, undo } from "../state/ledger.js";
import {
  transactionForm,
  newMovement,
  choosePayment,
  payForm,
  editDebt,
  editFixed,
  editGoal,
  contribute,
  editCatalog,
  deleteEntity,
  transactionDetails,
  deleteTransaction,
  debtDetails,
  extraPayment,
} from "./forms.js";
import { showProjection, timeline } from "../screens/calendar.js";
import { doExport } from "../platform/backups.js";

export async function action(a, id, el) {
  if (
    creditAction(a, id, el) ||
    updateAction(a) ||
    accountAction(a, id) ||
    loanAction(a, id)
  )
    return;
  if (a === "debtSub") {
    model.debtSub = id;
    render();
    return;
  }
  if (a === "accountSub") {
    model.accountSub = id;
    render();
    return;
  }
  if (a === "screenBack") {
    backPage();
    return;
  }
  if (a === "timelineYear") {
    model.period = C.addMonth(model.period, 12 * Number(id));
    render();
    return;
  }
  if (a === "tab") {
    model.tab = id;
    model.period = C.month();
    model.calendarDay = "";
    closeModal();
    render();
    window.scrollTo(0, 0);
  } else if (a === "close") closeModal();
  else if (a === "settings") openPage("settings");
  else if (a === "start") startSetup();
  else if (a === "startEmpty")
    await commit("Libro iniciado", (s) => {
      s.started = true;
      C.ensureBudget(s);
    });
  else if (a === "calendarDay") {
    model.calendarDay = id && id !== model.calendarDay ? String(id) : "";
    render();
  } else if (a === "undo") await undo();
  else if (a === "expense" || a === "income" || a === "transfer")
    transactionForm(a);
  else if (a === "newMovement") newMovement();
  else if (a === "choosePayment") choosePayment();
  else if (a === "pay") payForm(id, el.dataset.period || C.month());
  else if (a === "editDebt") editDebt(id);
  else if (a === "debtUnarchive")
    confirmAction(
      "Reactivar deuda",
      "Volverá a generar sus compromisos pendientes.",
      "Deuda reactivada",
      (s) => {
        s.debts.find((d) => d.id === id).archived = false;
        C.refreshAllBudgets(s);
      },
    );
  else if (a === "editFixed") editFixed(id);
  else if (a === "editGoal") editGoal(id);
  else if (a === "contribute") contribute(id);
  else if (a === "editAccount" || a === "editCategory")
    editCatalog(a.slice(4), id);
  else if (
    [
      "deleteDebt",
      "deleteFixed",
      "deleteGoal",
      "deleteAccount",
      "deleteCategory",
    ].includes(a)
  )
    deleteEntity(a.slice(6), id);
  else if (a === "transactionDetails") transactionDetails(id);
  else if (a === "editTransaction") {
    const t = model.state.transactions.find((t) => t.id === id);
    transactionForm(t.kind, t);
  } else if (a === "deleteTransaction") deleteTransaction(id);
  else if (a === "debtDetails") debtDetails(id);
  else if (a === "extraPayment") extraPayment(id);
  else if (a === "fixedDetails") {
    const f = model.state.fixedExpenses.find((f) => f.id === id);
    modal(
      f.name,
      `<p>${money(f.amount)} por vencimiento · ${esc(C.recurrenceLabel(f))}</p><p>${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"}</p><p class="note">Cada pago se vincula a su vencimiento individual.</p>`,
    );
  } else if (a === "expenseSub") {
    model.sub = id;
    render();
  } else if (a === "filters") openFilters();
  else if (a === "clearFilters") {
    model.filter = {
      q: "",
      from: "",
      to: "",
      category: "",
      accountId: "",
      kind: "",
      min: "",
      max: "",
    };
    closeModal();
    render();
  } else if (a === "prev" || a === "next") {
    model.period = C.addMonth(model.period, a === "prev" ? -1 : 1);
    model.calendarDay = "";
    render();
  } else if (a === "projection") showProjection();
  else if (a === "timeline") timeline();
  else if (a === "balances") {
    const b = C.balances(model.state);
    form(
      "Ajustar saldos",
      model.state.walletAccounts
        .filter((a) => a.active !== false)
        .map((a) => amount(a.id, a.name + " real", b[a.id]))
        .join("") +
        '<p class="note">La diferencia queda registrada como ajuste, no como ingreso ni gasto.</p>',
      async (f) =>
        commit("Saldos ajustados", (s) => {
          const current = C.balances(s);
          for (const accountId of s.walletAccounts
            .filter((a) => a.active !== false)
            .map((a) => a.id)) {
            const diff = moneyValue(f[accountId]) - current[accountId];
            if (diff)
              C.record(s, {
                kind: "adjustment",
                name: "Ajuste de saldo",
                accountId,
                amount: Math.abs(diff),
                direction: diff < 0 ? -1 : 1,
                date: C.today(),
              });
          }
        }),
    );
  } else if (a === "expectedIncome")
    form(
      "Ingreso mensual previsto",
      amount("income", "Ingreso previsto", model.state.income) +
        '<p class="note">No aumenta tu saldo. Registra cada ingreso recibido desde Inicio.</p>',
      async (f) =>
        commit("Ingreso previsto actualizado", (s) => {
          s.income = moneyValue(f.income);
          C.refreshBudget(s);
        }),
    );
  else if (a === "import") {
    if (window.NativeOSP) window.NativeOSP.importBackup();
    else $("#importFile").click();
  } else if (a === "confirmImport") {
    const incoming = C.clone(model.importCandidate);
    await commit("Respaldo importado", (s) => {
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, incoming, { started: true });
      C.ensureBudget(s);
    });
  } else if (a === "export") doExport();
  else if (a === "pickApk") window.NativeOSP.installUpdate();
  else if (a === "reminders") {
    form(
      "Recordatorios de pago",
      select(
        "enabled",
        "Avisos",
        [
          ["yes", "Activados"],
          ["no", "Desactivados"],
        ],
        model.state.settings.reminders ? "yes" : "no",
      ) +
        select(
          "days",
          "Anticipación",
          [
            ["0", "El día del vencimiento"],
            ["1", "Un día antes"],
            ["2", "Dos días antes"],
            ["3", "Tres días antes"],
            ["7", "Una semana antes"],
          ],
          String(model.state.settings.reminderDays),
        ) +
        input(
          "time",
          "Hora común de los avisos",
          model.state.settings.reminderTime,
          "time",
          "required",
        ) +
        '<p class="note">Incluye pagos, cobros pendientes y cajitas por liberar. Android puede retrasar el aviso.</p>',
      async (f) => {
        const ok = await commit("Recordatorios actualizados", (s) => {
          s.settings.reminders = f.enabled === "yes";
          s.settings.reminderDays = Number(f.days);
          s.settings.reminderTime = f.time;
        });
        if (ok && model.state.settings.reminders && window.NativeOSP)
          window.NativeOSP.requestNotifications();
      },
    );
  } else if (a === "history")
    modal(
      "Cambios recientes",
      `<p class="note">Se conservan los últimos 15 cambios, incluso al cerrar la app. Deshacer revierte el último cambio completo.</p>${model.history.length ? btn("Deshacer: " + esc(model.history.at(-1).label), "undo", "", "primary full") : ""}${
        [...model.history]
          .reverse()
          .map(
            (h) =>
              `<div class="item"><strong>${esc(h.label)}</strong><p class="muted">${new Date(h.date).toLocaleString("es-MX")}</p></div>`,
          )
          .join("") ||
        empty("Sin cambios", "Tus próximas acciones aparecerán aquí.")
      }`,
    );
}

function openFilters() {
  form(
    "Filtrar movimientos",
    `<p class="note">Los filtros se aplican a la lista y al consumo del periodo.</p><div class="filters">${input("from", "Desde", model.filter.from, "date")}${input("to", "Hasta", model.filter.to, "date")}${select("category", "Categoría", [["", "Todas"], ...model.state.categories.map((c) => [c.id, c.name])], model.filter.category)}${select("accountId", "Origen", [["", "Todos"], ...[...model.state.walletAccounts, ...model.state.creditCards].map((a) => [a.id, a.name])], model.filter.accountId)}${select("kind", "Tipo", [["", "Todos"], ...["expense", "fixed", "debt", "income", "transfer", "adjustment", "loan_out", "loan_in", "card_payment"].map((k) => [k, kindLabel(k)])], model.filter.kind)}${input("min", "Importe mínimo", model.filter.min, "number", 'min="0" step="0.01"')}${input("max", "Importe máximo", model.filter.max, "number", 'min="0" step="0.01"')}</div><button type="button" class="btn" data-action="clearFilters">Limpiar filtros</button>`,
    async (f) => {
      model.filter = { ...model.filter, ...f };
      closeModal();
      render();
    },
    "Aplicar filtros",
  );
}

function kindLabel(k) {
  return (
    {
      expense: "Gasto",
      card_payment: "Pago de tarjeta",
      fixed: "Gasto fijo",
      debt: "Pago de deuda",
      income: "Ingreso",
      transfer: "Transferencia",
      adjustment: "Ajuste",
      loan_out: "Dinero prestado",
      loan_in: "Cobro de préstamo",
    }[k] || k
  );
}

function startSetup() {
  form(
    "Tu punto de partida",
    `<p class="note">Saldos de hoy, no un historial. Puedes corregirlos después.</p><div class="start-fields">${amount("cash", "Efectivo actual", 0)}${amount("debit", "Débito actual", 0)}${amount("income", "Ingreso mensual previsto", 0)}</div>`,
    async (f) =>
      commit("Libro iniciado", (s) => {
        s.started = true;
        const cash = s.walletAccounts.find((a) => a.id === "cash"),
          debit = s.walletAccounts.find((a) => a.id === "debit");
        if (cash) cash.opening = moneyValue(f.cash || "0");
        if (debit) debit.opening = moneyValue(f.debit || "0");
        s.income = moneyValue(f.income || "0");
        C.ensureBudget(s);
      }),
    "Empezar",
    { cancelLabel: "Omitir", cancelAction: "startEmpty" },
  );
}
