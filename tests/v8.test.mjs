import test from "node:test";
import assert from "node:assert/strict";
import C from "../app/src/main/assets/js/domain/finance.js";
import L from "../app/src/main/assets/js/domain/legacy-v7.js";
import H from "../app/src/main/assets/js/domain/reconstruction.js";
const date = C.today();
function fixture() {
  const s = C.empty();
  s.walletAccounts.find((a) => a.id === "debit").opening = 500000;
  s.walletAccounts.push(
    {
      id: "bbva",
      name: "BBVA",
      type: "bank",
      opening: 0,
      active: true,
      allowedCategories: [],
    },
    {
      id: "vales",
      name: "Vales",
      type: "restricted",
      opening: 100000,
      active: true,
      allowedCategories: [s.categories[0].id],
    },
  );
  s.goals.push({
    id: "g",
    name: "Meta",
    target: 500000,
    balance: 0,
    allocations: [],
  });
  return s;
}
const tx = (kind, amount, extra = {}) => ({
  kind,
  amount,
  name: "Prueba",
  date,
  accountId: "debit",
  ...extra,
});
test("named accounts transfer and income preserve totals; restricted funds cannot bypass categories", () => {
  const s = fixture();
  C.record(s, tx("transfer", 100000, { toAccountId: "bbva" }));
  assert.equal(C.metrics(s).liquidity, 500000);
  C.record(s, tx("income", 20000, { accountId: "bbva" }));
  assert.equal(C.balances(s).bbva, 120000);
  C.record(
    s,
    tx("expense", 10000, {
      accountId: "vales",
      categoryId: s.categories[0].id,
    }),
  );
  for (const t of [
    tx("expense", 1, { accountId: "vales" }),
    tx("transfer", 1, { accountId: "vales", toAccountId: "debit" }),
    tx("transfer", 1, { toAccountId: "vales" }),
    tx("debt", 1, { accountId: "vales" }),
  ])
    assert.throws(() => C.record(s, t));
  assert.equal(C.metrics(s).restricted, 90000);
  C.validate(s);
});
test("5000 with 3000 frozen leaves 2000, goal link overlaps once and partial release keeps reserve", () => {
  const s = fixture();
  const b = C.freeze(s, {
    name: "Cajita",
    amount: 300000,
    accountId: "debit",
    createdDate: date,
    availableDate: date,
  });
  assert.equal(C.available(s), 200000);
  assert.throws(() => C.record(s, tx("expense", 250000)), /Faltan/);
  C.linkBox(s, b.id, "g");
  assert.equal(C.available(s), 200000);
  assert.equal(s.goals[0].balance, 300000);
  C.releaseBox(s, b.id, 100000);
  assert.equal(C.available(s), 200000);
  assert.throws(() => C.releaseReserve(s, "g", 0, 100001));
  C.releaseReserve(s, "g", 0, 100000);
  assert.equal(C.available(s), 300000);
  assert.equal(b.amount, 200000);
  assert.equal(s.transactions.length, 0);
  C.record(s, tx("income", 1000));
  assert.equal(C.available(s), 301000);
  C.validate(s);
});
test("unassigned legacy reserves limit global spending; assigning does not change balance or progress", () => {
  const old = L.empty();
  old.opening.debit = 500000;
  old.goals = [{ id: "g", name: "Meta", target: 500000, balance: 300000 }];
  const s = C.migrate(old);
  assert.equal(C.available(s), 200000);
  assert.throws(() => C.record(s, tx("expense", 250000)));
  const before = C.metrics(s);
  C.assignReserve(s, "g", 0, "debit");
  assert.equal(C.available(s), before.available);
  assert.equal(C.metrics(s).liquidity, before.liquidity);
  assert.equal(s.goals[0].balance, 300000);
});
test("5 of 12 prior installments, sixth payment and reversal do not duplicate antecedents", () => {
  const s = fixture(),
    d = {
      id: "d",
      name: "Equipo",
      balance: 70000,
      originalAmount: 120000,
      payment: 10000,
      totalPayments: 12,
      startDate: C.addMonth(C.month(), -5) + "-01",
      dueDay: 1,
      paidPayments: [],
      historicalPaidPayments: [],
      paidMonths: [],
      balanceMode: "total",
    };
  s.debts.push(d);
  C.setPriorPayments(s, d, 5);
  assert.equal(d.paidPayments.length, 5);
  assert.equal(C.balances(s).debit, 500000);
  C.ensureBudget(s);
  const t = C.pay(s, "debt:d:6", { date, amount: 10000 });
  assert.deepEqual(d.paidPayments, [1, 2, 3, 4, 5, 6]);
  assert.throws(() => C.setPriorPayments(s, d, 6));
  C.reverseTransaction(s, t.id);
  assert.deepEqual(d.paidPayments, [1, 2, 3, 4, 5]);
  assert.equal(d.balance, 70000);
  assert.equal(C.balances(s).debit, 500000);
  C.setPriorPayments(s, d, 4);
  assert.equal(d.balance, 70000);
  C.validate(s);
});
test("new and historical loans, partial collection into another account; principal is not income or spending", () => {
  const s = fixture();
  s.receivables.push(
    { id: "l", name: "Préstamo", person: "Persona", opening: 0 },
    { id: "h", name: "Anterior", person: "Persona", opening: 20000 },
  );
  C.record(s, tx("loan_out", 100000, { ref: "l" }));
  const t = C.record(s, tx("loan_in", 40000, { ref: "l", accountId: "bbva" }));
  assert.equal(C.loanBalance(s, "l"), 60000);
  assert.equal(C.balances(s).bbva, 40000);
  assert.equal(C.metrics(s).receivable, 80000);
  assert.equal(C.metrics(s).received, 0);
  assert.equal(C.metrics(s).outflow, 0);
  assert.throws(() => C.record(s, tx("loan_in", 60001, { ref: "l" })));
  assert.throws(() =>
    C.record(s, tx("loan_in", 1, { ref: "l", accountId: "vales" })),
  );
  C.reverseTransaction(s, t.id);
  assert.equal(C.loanBalance(s, "l"), 100000);
  C.validate(s);
});
function recurring(unit, startDate, extra = {}) {
  return {
    id: "f",
    name: "Servicio",
    rules: [
      {
        id: "r",
        unit,
        interval: 1,
        startDate,
        effectiveFrom: startDate,
        amount: 120000,
        ...extra,
      },
    ],
  };
}
test("monthly and annual dates clamp without drift; annual amount belongs only to due month", () => {
  const f = recurring("months", "2024-01-31");
  assert.equal(C.occurrences(f, "2024-02")[0].date, "2024-02-29");
  assert.equal(C.occurrences(f, "2024-03")[0].date, "2024-03-31");
  const annual = recurring("years", "2024-02-29");
  assert.equal(C.occurrences(annual, "2025-02")[0].date, "2025-02-28");
  assert.equal(C.occurrences(annual, "2028-02")[0].date, "2028-02-29");
  const s = fixture();
  s.fixedExpenses = [annual];
  assert.equal(C.metrics(s, "2025-01").fixed, 0);
  assert.equal(C.metrics(s, "2025-02").fixed, 120000);
  assert.equal(C.metrics(s, "2025-03").fixed, 0);
});
test("14 days differs from twice monthly, even clamped occurrences have distinct identities", () => {
  const f = recurring("days", "2025-01-01", { interval: 14 }),
    twice = recurring("twiceMonthly", "2025-01-01", { days: [1, 15] });
  assert.equal(C.occurrences(f, "2025-01").length, 3);
  assert.equal(C.occurrences(twice, "2025-01").length, 2);
  const short = recurring("twiceMonthly", "2025-01-01", { days: [30, 31] });
  const items = C.occurrences(short, "2025-02");
  assert.equal(items.length, 2);
  assert.equal(items[0].date, "2025-02-28");
  assert.notEqual(items[0].key, items[1].key);
});
test("effective dated recurrence preserves earlier dues and partial payments with undo", () => {
  const s = fixture(),
    f = recurring("twiceMonthly", "2025-01-01", {
      days: [1, 15],
      amount: 10000,
    });
  s.fixedExpenses = [f];
  C.ensureBudget(s, "2025-01");
  const key = C.obligations(s, "2025-01")[0].key;
  const t = C.pay(s, key, {
    period: "2025-01",
    amount: 4000,
    date: "2025-01-01",
  });
  C.setRecurrence(s, f, {
    unit: "years",
    interval: 1,
    startDate: "2025-01-20",
    effectiveFrom: "2025-01-20",
    amount: 120000,
  });
  C.refreshAllBudgets(s);
  const items = C.obligations(s, "2025-01");
  assert.equal(items.length, 3);
  assert.equal(items.find((i) => i.key === key).remaining, 6000);
  C.reverseTransaction(s, t.id);
  assert.equal(
    C.obligations(s, "2025-01").find((i) => i.key === key).remaining,
    10000,
  );
  assert.equal(C.metrics(s, "2025-02").fixed, 0);
  C.validate(s);
});
test("v7 envelope migration is pure, preserves ids, undo, budgets and draft and rejects all before saving", () => {
  const old = L.empty();
  old.opening = { cash: -500, debit: 500000 };
  L.record(old, {
    kind: "income",
    name: "Ingreso",
    method: "debit",
    amount: 10000,
    date,
  });
  L.ensureBudget(old);
  const draft = {
    version: 1,
    id: "draft",
    baseId: old.id,
    baseRevision: 2,
    config: { startDate: date, cash: 0, debit: 10000, income: 0 },
    accounts: old.accounts,
    categories: old.categories,
    settings: old.settings,
    debts: [],
    fixedExpenses: [],
    entries: [],
  };
  const envelope = {
      state: old,
      history: [{ state: L.clone(old), label: "Antes" }],
      draft,
      revision: 2,
    },
    json = JSON.stringify(envelope),
    v = C.migrateEnvelope(envelope);
  assert.equal(JSON.stringify(envelope), json);
  assert.deepEqual(C.balances(v.state), L.balances(old));
  assert.equal(v.history[0].state.transactions[0].id, old.transactions[0].id);
  assert.deepEqual(v.state.budgets, old.budgets);
  assert.equal(H.build(v.draft).schemaVersion, 8);
  assert.throws(() =>
    C.migrateEnvelope({ ...envelope, history: [{ state: { bad: true } }] }),
  );
  assert.equal(JSON.stringify(envelope), json);
  assert.deepEqual(C.migrate(v.state), v.state);
});
test("reminders group debts, loans and boxes, chosen time validates, and maturity never auto releases", () => {
  const s = fixture();
  s.settings.reminderTime = "18:35";
  s.receivables = [
    { id: "l", name: "Cobro", person: "P", opening: 1000, dueDate: date },
  ];
  const b = C.freeze(s, {
    name: "Liberar",
    amount: 10000,
    accountId: "debit",
    createdDate: date,
    availableDate: date,
  });
  const items = C.reminders(s);
  assert.ok(items.some((i) => i.id === "loan:l"));
  assert.ok(items.some((i) => i.id === "box:" + b.id));
  assert.equal(b.amount, 10000);
  C.validate(s);
  s.settings.reminderTime = "25:00";
  assert.throws(() => C.validate(s));
});

test("calendar changes cannot duplicate a due that was paid in advance", () => {
  const s = fixture(),
    f = recurring("months", "2025-01-31", { amount: 10000 });
  s.fixedExpenses = [f];
  C.ensureBudget(s, "2025-01");
  C.pay(s, C.obligations(s, "2025-01")[0].key, {
    period: "2025-01",
    amount: 10000,
    date: "2025-01-02",
  });
  f.rules[0].effectiveFrom = "2025-01-01";
  const before = JSON.stringify(f);
  assert.throws(
    () =>
      C.setRecurrence(s, f, {
        unit: "months",
        interval: 1,
        startDate: "2025-01-31",
        effectiveFrom: "2025-01-20",
        amount: 20000,
      }),
    /pagos/,
  );
  assert.equal(JSON.stringify(f), before);
  C.setRecurrence(s, f, {
    unit: "months",
    interval: 1,
    startDate: "2025-01-31",
    effectiveFrom: "2025-02-01",
    amount: 20000,
  });
  C.refreshAllBudgets(s);
  assert.equal(C.obligations(s, "2025-01").length, 1);
  assert.equal(C.obligations(s, "2025-01")[0].paid, true);
});
