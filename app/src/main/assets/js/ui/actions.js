import { reconstructionAction } from "../screens/reconstruction.js";
import { backPage, render } from "./navigation.js";
import { model } from "../state/model.js";
import C from "../domain/finance.js";
import {
  closeModal,
  modal,
  money,
  form,
  amount,
  moneyValue,
  $,
  btn,
  select,
  esc,
  empty,
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
  if (a.startsWith("rebuild")) {
    await reconstructionAction(a, id, el);
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
    closeModal();
    render();
    window.scrollTo(0, 0);
  } else if (a === "close") closeModal();
  else if (a === "settings") {
    model.tab = "settings";
    render();
    window.scrollTo(0, 0);
  } else if (a === "start")
    await commit("App preparada", (s) => {
      s.started = true;
      C.ensureBudget(s);
    });
  else if (a === "undo") await undo();
  else if (a === "expense" || a === "income" || a === "transfer")
    transactionForm(a);
  else if (a === "newMovement") newMovement();
  else if (a === "choosePayment") choosePayment();
  else if (a === "pay") payForm(id, el.dataset.period || C.month());
  else if (a === "editDebt") editDebt(id);
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
      `<p>${money(f.amount)} al mes · Día ${f.dueDay}</p><p>${f.kind === "subscription" ? "Suscripción" : "Gasto fijo"}</p><p class="note">Cada pago se vincula al mes que corresponde.</p>`,
    );
  } else if (a === "expenseSub") {
    model.sub = id;
    render();
  } else if (a === "filters") {
    model.showFilters = !model.showFilters;
    render();
  } else if (a === "clearFilters") {
    model.filter = {
      q: "",
      from: "",
      to: "",
      category: "",
      method: "",
      kind: "",
      min: "",
      max: "",
    };
    render();
  } else if (a === "prev" || a === "next") {
    model.period = C.addMonth(model.period, a === "prev" ? -1 : 1);
    render();
  } else if (a === "projection") showProjection();
  else if (a === "timeline") timeline();
  else if (a === "balances") {
    const b = C.balances(model.state);
    form(
      "Ajustar saldos",
      amount("debit", "Débito real", b.debit) +
        amount("cash", "Efectivo real", b.cash) +
        '<p class="note">La diferencia queda registrada como ajuste, no como ingreso ni gasto.</p>',
      async (f) =>
        commit("Saldos ajustados", (s) => {
          const current = C.balances(s);
          for (const method of ["cash", "debit"]) {
            const diff = moneyValue(f[method]) - current[method];
            if (diff)
              C.record(s, {
                kind: "adjustment",
                name: "Ajuste de saldo",
                method,
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
    if (window.window.NativeOSP) window.NativeOSP.importBackup();
    else $("#importFile").click();
  } else if (a === "confirmImport") {
    const incoming = C.clone(model.importCandidate);
    await commit("Respaldo importado", (s) => {
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, incoming, { started: true });
      C.ensureBudget(s);
    });
  } else if (a === "export") doExport();
  else if (a === "update") {
    modal(
      "Actualizar Melange",
      `<p>Selecciona un APK nuevo de Melange. Android verificará la firma y conservará los datos al actualizar.</p><p class="note">No desinstales la versión actual. Puedes exportar un respaldo antes de continuar.</p>${btn("Exportar respaldo", "export", "", "full")}${window.window.NativeOSP ? btn("Seleccionar APK", "pickApk", "", "primary full") : "<p>Disponible en Android.</p>"}`,
    );
  } else if (a === "pickApk") window.NativeOSP.installUpdate();
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
        ),
      async (f) => {
        const ok = await commit("Recordatorios actualizados", (s) => {
          s.settings.reminders = f.enabled === "yes";
          s.settings.reminderDays = Number(f.days);
        });
        if (ok && model.state.settings.reminders && window.window.NativeOSP)
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
