import assert from "node:assert/strict";
import test from "node:test";

const { Window } = await import(process.env.OSP_HAPPY_DOM || "happy-dom");
const window = new Window({
  url: "https://appassets.androidplatform.net/index.html",
});
globalThis.window = window;
globalThis.document = window.document;
globalThis.FormData = window.FormData;
document.body.innerHTML =
  '<main id="view"></main><nav id="nav"></nav><dialog id="dialog"><div id="modal"></div></dialog><div id="toast"></div>';
window.NativeOSP = {
  read: () => "",
  write: () => "OK",
  readFormDraft: () => "",
  writeFormDraft: () => "OK",
};

const C = (await import("../app/src/main/assets/js/domain/finance.js")).default;
const { model } = await import("../app/src/main/assets/js/state/model.js");
const { recurrenceFields } = await import(
  "../app/src/main/assets/js/ui/recurrence-fields.js"
);
const { expensesPage, fixedList } = await import(
  "../app/src/main/assets/js/screens/expenses.js"
);
const { calendarPage, projectionPage, setCalendarPeriod } = await import(
  "../app/src/main/assets/js/screens/calendar.js"
);
const { debtsPage } = await import(
  "../app/src/main/assets/js/screens/debts.js"
);
const { goalsPage } = await import(
  "../app/src/main/assets/js/screens/goals.js"
);
const { receivablesPage } = await import(
  "../app/src/main/assets/js/screens/receivables.js"
);

test("legacy receivable chronology is visibly flagged without rewriting its dates", () => {
  const previous = model.state;
  const legacy = C.empty();
  legacy.receivables.push({
    id: "legacy",
    name: "Anterior",
    person: "Ana",
    opening: 0,
    dueDate: null,
    createdDate: "2020-01-01",
  });
  legacy.transactions.push(
    {
      id: "in",
      kind: "loan_in",
      ref: "legacy",
      name: "Cobro",
      amount: 2000,
      accountId: "debit",
      date: "2020-01-01",
    },
    {
      id: "out",
      kind: "loan_out",
      ref: "legacy",
      name: "Entrega",
      amount: 5000,
      accountId: "debit",
      date: "2020-01-02",
    },
  );
  model.state = legacy;
  try {
    const markup = receivablesPage();
    assert.match(markup, /Revisa las fechas de este préstamo/);
    assert.match(markup, /Se conservó el registro original/);
    assert.equal(legacy.transactions[0].date, "2020-01-01");
  } finally {
    model.state = previous;
  }
});

const state = C.empty();
state.started = true;
model.state = state;
model.sub = "all";
model.debtSub = "owe";
model.period = C.month();
model.calendarDay = "";
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

test("empty expense history offers a contextual registration action", () => {
  model.filter.from = C.month() + "-01";
  model.filter.to = C.today();
  const html = expensesPage();
  assert.match(html, /Tu historial empieza aquí/);
  assert.match(html, /data-action="newMovement"[^>]*>Registrar movimiento/);
  assert.equal((html.match(/Quitar filtros/g) || []).length, 1);
  model.filter.from = "";
  model.filter.to = "";
});

test("transfer rows show origin and destination", () => {
  state.transactions.push({
    id: "transfer-1",
    kind: "transfer",
    name: "Ahorro del mes",
    amount: 50000,
    date: C.today(),
    accountId: "debit",
    toAccountId: "cash",
  });
  const html = expensesPage();
  assert.match(html, /Transferencia · De Débito → Efectivo/);
  assert.match(
    html,
    /Salidas suma gastos, gastos fijos, pagos de deuda y pagos de tarjeta/,
  );
  assert.match(
    html,
    /No incluye compras a crédito, transferencias ni ingresos/,
  );
});

test("filtered empty results offer removing filters and adding a movement", () => {
  model.filter.kind = "income";
  const html = expensesPage();
  assert.match(html, /Sin coincidencias/);
  assert.match(html, /data-action="clearFilters"[^>]*>Quitar filtros/);
  assert.match(html, /data-action="newMovement"[^>]*>Registrar movimiento/);
  model.filter.kind = "";
});

test("calendar and debit screens offer contextual empty actions", () => {
  const calendar = calendarPage();
  assert.match(calendar, /Un mes despejado/);
  assert.match(calendar, /data-action="editFixed"[^>]*>Crear gasto fijo/);
  assert.match(calendar, /data-action="editDebt"[^>]*>Registrar deuda/);
  assert.match(
    calendar,
    /data-calendar-period[^>]*aria-label="Elegir mes y año del calendario"/,
  );

  const debts = debtsPage();
  assert.match(debts, /data-action="editDebt"[^>]*>Registrar deuda/);
  assert.match(debts, /data-action="creditEdit"[^>]*>Agregar tarjeta/);

  const goals = goalsPage();
  assert.match(goals, /data-action="editGoal"[^>]*>Crear mi primera meta/);
  assert.match(fixedList(), /data-action="editFixed"[^>]*>Crear gasto fijo/);
});

test("calendar month selector validates and changes the visible period", () => {
  assert.equal(setCalendarPeriod("2030-02"), true);
  assert.equal(model.period, "2030-02");
  assert.equal(model.calendarDay, "");
  assert.equal(setCalendarPeriod("2030-13"), false);
  assert.equal(setCalendarPeriod(""), false);
  assert.equal(model.period, "2030-02");
  model.period = C.month();
});

test("projection uses everyday language and keeps its limits visible", () => {
  const html = projectionPage();
  assert.match(html, /Lo que quedaría cada mes/);
  assert.match(html, /ingreso previsto menos los pagos fijos y las cuotas/);
  assert.match(html, /Pagos fijos/);
  assert.match(html, /Cuotas de deuda/);
  assert.match(html, /No incluye compras del día a día/);
  assert.match(html, /No es el saldo que tendrás en el banco/);
  assert.doesNotMatch(html, /<details/);
});

test("recurring fields preview upcoming dates without changing the saved rule", () => {
  const startDate = C.addMonth(C.month(), 2) + "-05",
    fixed = {
      id: "fixed-preview",
      name: "Renta",
      amount: 250000,
      rules: [
        {
          id: "rule-preview",
          unit: "months",
          interval: 1,
          startDate,
          effectiveFrom: startDate,
          amount: 250000,
          active: true,
        },
      ],
    };
  document.body.insertAdjacentHTML(
    "beforeend",
    `<form id="form">${recurrenceFields(fixed, { categories: [], creditCards: [] })}</form>`,
  );
  const form = document.querySelector("#form"),
    box = form.querySelector("[data-recurrence-preview]");
  assert.match(box.textContent, /Próximos vencimientos/);
  assert.match(box.textContent, new RegExp(startDate.slice(0, 4)));
  assert.equal(form.querySelectorAll("[data-recurrence-preview]").length, 1);

  const start = form.querySelector('[name="startDate"]');
  start.value = "2031-01-05";
  start.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.match(box.textContent, /5 ene 2031/);
  assert.match(box.textContent, /Los pagos ya registrados no cambian/);
  assert.equal(form.querySelector('[name="startDate"]').value, "2031-01-05");
  form.remove();
});
