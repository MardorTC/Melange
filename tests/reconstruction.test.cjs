const test = require("node:test"),
  assert = require("node:assert/strict");
const C = require("../app/src/main/assets/core.js");
const H = require("../app/src/main/assets/history-core.js");
const start = C.addMonth(C.month(), -1) + "-01",
  m = C.month(start);
function fixture() {
  return H.create(
    C.empty(),
    { startDate: start, cash: 10000, debit: 100000, income: 200000 },
    4,
  );
}
function entry(id, kind, amount, day, extra = {}) {
  return {
    id,
    name: id,
    kind,
    amount,
    date: m + "-" + String(day).padStart(2, "0"),
    method: "debit",
    ...extra,
  };
}
test("chronological reconstruction leaves source and draft untouched", () => {
  const source = C.empty(),
    before = JSON.stringify(source),
    d = H.create(
      source,
      { startDate: start, cash: 10000, debit: 100000, income: 200000 },
      4,
    );
  d.entries = [
    entry("expense", "expense", 20000, 4),
    entry("income", "income", 50000, 2),
    entry("transfer", "transfer", 5000, 3, { to: "cash" }),
  ];
  const copy = JSON.stringify(d),
    s = H.build(d);
  assert.equal(JSON.stringify(source), before);
  assert.equal(JSON.stringify(d), copy);
  assert.deepEqual(
    s.transactions.map((t) => t.id),
    ["income", "transfer", "expense"],
  );
  assert.deepEqual(C.balances(s), { cash: 15000, debit: 125000 });
  assert.deepEqual(
    C.ledgerEntries(s).map((t) => t.value),
    [160000, 160000, 140000],
  );
  assert.equal(s.liquidityHistory.at(-1).value, 140000);
  assert.equal(s.liquidityHistory[0].value, 110000);
});
test("historical debt and fixed payments count once and keep monthly commitments", () => {
  const d = fixture();
  d.debts = [
    {
      id: "d",
      name: "Deuda",
      originalAmount: 40000,
      balance: 20000,
      payment: 20000,
      totalPayments: 2,
      startDate: C.addMonth(m, -1) + "-01",
      dueDay: 2,
      paidPayments: [1],
      paidMonths: [],
      balanceMode: "total",
      active: true,
    },
  ];
  d.fixedExpenses = [
    {
      id: "f",
      name: "Internet",
      amount: 5000,
      startMonth: m,
      dueDay: 3,
      active: true,
    },
  ];
  d.entries = [
    entry("pay", "debt", 20000, 2, {
      obligation: "debt:d:2",
      ref: "d",
      period: m,
    }),
    entry("fixed", "fixed", 5000, 3, {
      obligation: "fixed:f:" + m,
      ref: "f",
      period: m,
    }),
  ];
  const s = H.build(d),
    v = C.metrics(s, m);
  assert.equal(s.debts[0].balance, 0);
  assert.deepEqual(s.debts[0].paidPayments, [1, 2]);
  assert.equal(v.debit, 75000);
  assert.equal(v.debt, 20000);
  assert.equal(v.fixed, 5000);
  assert.equal(v.budgetFree, 175000);
  assert.equal(v.consumption, 5000);
  assert.equal(v.outflow, 25000);
  assert.equal(C.metrics(s).debt, 0);
  C.reverseTransaction(s, "pay");
  C.snapshot(s);
  assert.equal(C.balances(s).debit, 95000);
  assert.equal(s.liquidityHistory.at(-1).value, 105000);
});
test("partial payments and capital-only mode preserve both cash and debt arithmetic", () => {
  const d = fixture();
  d.debts = [
    {
      id: "d",
      name: "Capital",
      originalAmount: 50000,
      balance: 50000,
      payment: 10000,
      totalPayments: 0,
      startDate: start,
      dueDay: 1,
      paidPayments: [],
      paidMonths: [],
      balanceMode: "principal",
      active: true,
    },
  ];
  d.entries = [
    entry("p1", "debt", 4000, 2, {
      obligation: "debt:d:" + m,
      period: m,
      principal: 3000,
    }),
    entry("p2", "debt", 6000, 3, {
      obligation: "debt:d:" + m,
      period: m,
      principal: 4000,
    }),
  ];
  const s = H.build(d);
  assert.equal(s.debts[0].balance, 43000);
  assert.equal(C.balances(s).debit, 90000);
  assert.ok(C.obligations(s, m)[0].paid);
});
test("reconciliation adds visible adjustments only when explicitly requested", () => {
  const d = fixture(),
    actual = { cash: 9000, debit: 102000 };
  const preview = H.reconcile(d, actual);
  assert.equal(preview.matches, false);
  assert.equal(preview.state.transactions.length, 0);
  const final = H.reconcile(d, actual, true);
  assert.deepEqual(C.balances(final.state), actual);
  assert.equal(final.state.transactions.length, 2);
  assert.ok(final.state.transactions.every((t) => t.kind === "adjustment"));
  assert.equal(d.entries.length, 0);
  assert.deepEqual(C.migrate(final.state), final.state);
});
test("invalid dates, duplicate entries, overpayments, and invalid metadata are rejected", () => {
  const d = fixture();
  d.entries = [entry("e", "expense", 1000, 2), entry("e", "income", 1000, 3)];
  assert.throws(() => H.build(d), /repetido/);
  d.entries = [
    entry("x", "expense", 1000, 2, { date: C.addMonth(m, -1) + "-01" }),
  ];
  assert.throws(() => H.build(d), /periodo/);
  d.entries = [];
  d.fixedExpenses = [
    { id: "f", name: "Internet", amount: 5000, startMonth: m, active: true },
  ];
  d.entries = [
    entry("f", "fixed", 6000, 2, { period: m, obligation: "fixed:f:" + m }),
  ];
  assert.throws(() => H.build(d), /supera/);
  const s = C.empty();
  s.reconstruction = { basis: "ledger", startDate: "not-a-date" };
  assert.throws(() => C.validate(s));
});
test("editing or removing backdated movement recomputes all subsequent snapshots", () => {
  const d = fixture();
  d.entries = [entry("e", "expense", 1000, 2), entry("i", "income", 2000, 3)];
  const s = H.build(d);
  s.transactions[0].amount = 3000;
  C.snapshot(s);
  assert.equal(
    s.liquidityHistory.find((h) => h.date === m + "-03").value,
    109000,
  );
  C.reverseTransaction(s, "e");
  C.snapshot(s);
  assert.equal(s.liquidityHistory.at(-1).value, 112000);
  assert.ok(!s.liquidityHistory.some((h) => h.date === m + "-02"));
});
