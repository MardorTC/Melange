import test from "node:test";
import assert from "node:assert/strict";
import C from "../app/src/main/assets/js/domain/finance.js";
import H from "../app/src/main/assets/js/domain/reconstruction.js";
const date = "2026-01-10",
  period = "2026-02";
function fixture() {
  const s = C.empty();
  s.walletAccounts[1].opening = 500000;
  s.creditCards.push({
    id: "bbva-credit",
    name: "BBVA crédito",
    limit: 1000000,
    openingBalance: 0,
    openingDueDate: "2026-02-05",
    closingDay: 15,
    paymentDay: 5,
    active: true,
  });
  return s;
}
function purchase(s, amount = 50000, extra = {}) {
  return C.record(s, {
    name: "Supermercado",
    kind: "expense",
    amount,
    date,
    accountId: null,
    creditCardId: "bbva-credit",
    categoryId: s.categories[0].id,
    ...extra,
  });
}
function msi(s) {
  s.debts.push({
    id: "msi",
    name: "Laptop",
    type: "msi",
    creditCardId: "bbva-credit",
    creditorId: "",
    balanceMode: "total",
    balance: 700000,
    originalAmount: 1200000,
    payment: 100000,
    totalPayments: 12,
    startDate: "2025-09-05",
    dueDay: 5,
    paidPayments: [1, 2, 3, 4, 5],
    historicalPaidPayments: [1, 2, 3, 4, 5],
    paidMonths: [],
    active: true,
  });
  C.ensureBudget(s, period);
}
const pay = (s, amount) =>
  C.payCard(s, "bbva-credit", period, {
    amount,
    accountId: "debit",
    date: "2026-02-04",
  });
test("credit purchases consume a separate limit, recognized once as consumption and never as cash", () => {
  const s = fixture(),
    p = purchase(s);
  assert.equal(p.cardDueDate, "2026-02-05");
  assert.equal(C.metrics(s, "2026-01").available, 500000);
  assert.equal(C.metrics(s, "2026-01").consumption, 50000);
  assert.equal(C.metrics(s, "2026-01").outflow, 0);
  assert.equal(C.creditSummary(s, "bbva-credit").available, 950000);
  assert.equal(C.metrics(s, period).pending, 50000);
  pay(s, 50000);
  assert.equal(C.balances(s).debit, 450000);
  assert.equal(C.metrics(s, period).outflow, 50000);
  assert.equal(C.metrics(s, period).consumption, 0);
  assert.equal(C.creditSummary(s, "bbva-credit").used, 0);
  assert.throws(() => pay(s, 1));
  assert.throws(() => C.reverseTransaction(s, p.id));
  assert.throws(() => C.editTransaction(s, p.id, { ...p, amount: 10 }));
  C.validate(s);
});
test("MSI principal occupies limit, one combined payment covers sixth installment and purchases; undo restores both", () => {
  const s = fixture();
  msi(s);
  purchase(s);
  assert.equal(C.creditSummary(s, "bbva-credit").available, 250000);
  assert.equal(C.obligations(s, period).length, 1);
  assert.equal(C.metrics(s, period).pending, 150000);
  const p = pay(s, 150000);
  assert.equal(s.transactions.length, 2);
  assert.equal(p.allocations.length, 2);
  assert.equal(C.balances(s).debit, 350000);
  assert.equal(s.debts[0].balance, 600000);
  assert.deepEqual(s.debts[0].paidPayments, [1, 2, 3, 4, 5, 6]);
  assert.equal(C.metrics(s, period).pending, 0);
  assert.equal(C.metrics(s, period).debt, 150000);
  C.validate(s);
  C.reverseTransaction(s, p.id);
  assert.equal(C.balances(s).debit, 500000);
  assert.equal(s.debts[0].balance, 700000);
  assert.deepEqual(s.debts[0].paidPayments, [1, 2, 3, 4, 5]);
  assert.equal(C.creditStatement(s, "bbva-credit", period).remaining, 150000);
  C.validate(s);
});
test("partial card payments are distributed, cannot overpay, and can be reversed separately", () => {
  const s = fixture();
  msi(s);
  purchase(s);
  const first = pay(s, 40000);
  assert.equal(s.debts[0].paidPayments.length, 5);
  const second = pay(s, 90000);
  assert.equal(s.debts[0].paidPayments.length, 6);
  assert.equal(C.creditStatement(s, "bbva-credit", period).remaining, 20000);
  assert.throws(() => pay(s, 20001));
  C.reverseTransaction(s, first.id);
  assert.equal(C.creditStatement(s, "bbva-credit", period).remaining, 60000);
  assert.equal(s.debts[0].paidPayments.length, 5);
  C.reverseTransaction(s, second.id);
  assert.equal(C.creditStatement(s, "bbva-credit", period).remaining, 150000);
  C.validate(s);
});
test("limits, reserves, vouchers, invalid dates and card operations are guarded", () => {
  const s = fixture();
  msi(s);
  assert.throws(() => purchase(s, 300001));
  purchase(s);
  s.walletAccounts[1].opening = 1000;
  assert.throws(() => pay(s, 150000));
  assert.throws(() =>
    C.payCard(s, "bbva-credit", period, {
      amount: 1,
      accountId: "debit",
      date: "invalid",
    }),
  );
  s.walletAccounts.push({
    id: "vales",
    name: "Vales",
    type: "restricted",
    opening: 500000,
    active: true,
    allowedCategories: [],
  });
  assert.throws(() =>
    C.payCard(s, "bbva-credit", period, {
      amount: 150000,
      accountId: "vales",
      date: "2026-02-04",
    }),
  );
  assert.throws(() =>
    C.record(s, {
      kind: "income",
      creditCardId: "bbva-credit",
      accountId: "debit",
      amount: 1,
      name: "Invalid",
      date,
    }),
  );
});
test("closing dates include closing day, clamp February and cross years without drift", () => {
  const c = fixture().creditCards[0];
  assert.equal(C.creditDueDate(c, "2026-01-15"), "2026-02-05");
  assert.equal(C.creditDueDate(c, "2026-01-16"), "2026-03-05");
  assert.equal(C.creditDueDate(c, "2026-12-16"), "2027-02-05");
  assert.equal(
    C.creditDueDate({ ...c, closingDay: 31, paymentDay: 10 }, "2024-02-29"),
    "2024-03-10",
  );
  assert.equal(
    C.creditDueDate({ ...c, paymentDay: 25 }, "2026-01-15"),
    "2026-01-25",
  );
});
test("fixed expense charged to credit is not counted twice in cash commitments", () => {
  const s = fixture();
  s.fixedExpenses.push({
    id: "internet",
    name: "Internet",
    amount: 20000,
    kind: "fixed",
    startMonth: "2026-01",
    dueDay: 10,
    active: true,
    categoryId: "",
  });
  const i = C.obligations(s, "2026-01")[0];
  C.pay(s, i.key, {
    period: "2026-01",
    amount: 20000,
    date,
    creditCardId: "bbva-credit",
  });
  assert.equal(C.metrics(s, "2026-01").consumption, 20000);
  assert.equal(C.metrics(s, "2026-01").outflow, 0);
  assert.equal(C.obligations(s, "2026-01").length, 0);
  assert.equal(C.metrics(s, period).pending, 40000); // February fixed + January card charge
  pay(s, 20000);
  assert.equal(C.metrics(s, period).pending, 20000);
  C.validate(s);
});
test("opening balances are liabilities without invented spending and migrations preserve original", () => {
  const s = fixture();
  s.creditCards[0].openingBalance = 10000;
  assert.equal(C.metrics(s, period).consumption, 0);
  pay(s, 10000);
  C.validate(s);
  const old = C.empty();
  old.schemaVersion = 8;
  delete old.creditCards;
  const before = JSON.stringify(old);
  const migrated = C.migrateEnvelope({
    state: old,
    history: [{ state: old }],
    draft: null,
    revision: 5,
  });
  assert.equal(migrated.state.schemaVersion, 9);
  assert.equal(migrated.history[0].state.schemaVersion, 9);
  assert.deepEqual(migrated.state.creditCards, []);
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(C.migrate(JSON.parse(JSON.stringify(s))), s);
});
test("malformed payment allocations and missing cards are rejected", () => {
  const s = fixture();
  purchase(s);
  const p = pay(s, 50000);
  p.allocations[0].amount++;
  assert.throws(() => C.validate(s));
  p.allocations[0].amount--;
  s.creditCards = [];
  assert.throws(() => C.validate(s));
});

test("reconstruction replays credit purchases and a grouped installment payment without changing source", () => {
  const s = fixture();
  msi(s);
  const before = JSON.stringify(s);
  const draft = H.create(
    s,
    {
      startDate: "2026-01-01",
      openings: { cash: 0, debit: 500000 },
      income: 0,
    },
    0,
  );
  draft.debts = C.clone(s.debts);
  draft.entries = [
    {
      id: "purchase",
      name: "Super",
      kind: "expense",
      amount: 50000,
      date,
      accountId: null,
      creditCardId: "bbva-credit",
    },
    {
      id: "payment",
      name: "Tarjeta",
      kind: "card_payment",
      creditCardId: "bbva-credit",
      period,
      amount: 150000,
      date: "2026-02-04",
      accountId: "debit",
    },
  ];
  const built = H.build(draft);
  assert.equal(JSON.stringify(s), before);
  assert.equal(C.balances(built).debit, 350000);
  assert.equal(C.creditSummary(built, "bbva-credit").used, 600000);
  assert.equal(built.transactions[1].id, "payment");
  assert.deepEqual(built.debts[0].paidPayments, [1, 2, 3, 4, 5, 6]);
  assert.equal(
    C.migrateEnvelope({ state: built, history: [], draft, revision: 0 }).draft
      .creditCards.length,
    1,
  );
});
