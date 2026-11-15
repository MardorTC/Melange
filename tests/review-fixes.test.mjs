// Regressions for the November 2026 general review (docs/revision-general-2026-11.md).
import test from "node:test";
import assert from "node:assert/strict";
import C from "../app/src/main/assets/js/domain/finance.js";

globalThis.window ??= {};
const { boundEnvelope } = await import(
  "../app/src/main/assets/js/platform/storage.js"
);

const today = C.today();
const current = C.month();

function book(debit = 1000000) {
  const s = C.empty();
  s.walletAccounts.find((a) => a.id === "debit").opening = debit;
  return s;
}
function withCard(s) {
  s.creditCards.push({
    id: "cc",
    name: "Tarjeta",
    limit: 10000000,
    openingBalance: 0,
    openingDueDate: C.addMonth(current, 1) + "-05",
    closingDay: 15,
    paymentDay: 5,
    active: true,
  });
}
function withMsi(s, extra = {}) {
  const d = {
    id: "m",
    name: "MSI",
    creditorId: "",
    type: "msi",
    creditCardId: "cc",
    balanceMode: "total",
    originalAmount: 30000,
    balance: 30000,
    payment: 10000,
    totalPayments: 3,
    startDate: current + "-01",
    dueDay: 5,
    historicalPaidPayments: [],
    paidPayments: [],
    paidMonths: [],
    active: true,
    archived: false,
    financingCost: 0,
    annualRate: 0,
    notes: "",
    ...extra,
  };
  s.debts.push(d);
  return d;
}
function withLoan(s, extra = {}) {
  const d = {
    id: "loan",
    name: "Préstamo",
    creditorId: "",
    type: "loan-open",
    creditCardId: null,
    balanceMode: "total",
    originalAmount: 0,
    balance: 1200000,
    payment: 100000,
    totalPayments: 0,
    startDate: current + "-01",
    dueDay: 1,
    historicalPaidPayments: [],
    paidPayments: [],
    paidMonths: [],
    active: true,
    archived: false,
    financingCost: 0,
    annualRate: 0,
    notes: "",
    ...extra,
  };
  s.debts.push(d);
  return d;
}

test("large envelopes drop the oldest undo copies first and stay saveable", () => {
  const state = { notes: "x".repeat(1000) };
  const history = [1, 2, 3].map((n) => ({
    label: "c" + n,
    state: { notes: String(n).repeat(1000) },
  }));
  const small = boundEnvelope({ state, history, revision: 1 }, 10_000);
  assert.equal(small.envelope.history.length, 3);
  const trimmed = boundEnvelope({ state, history, revision: 1 }, 2_500);
  assert.deepEqual(
    trimmed.envelope.history.map((h) => h.label),
    ["c3"],
  );
  assert.ok(trimmed.json.length <= 2_500);
  assert.throws(
    () => boundEnvelope({ state, history, revision: 1 }, 500),
    /demasiado grande/,
  );
});

test("an overdraft can be covered by a transfer between free accounts", () => {
  const s = book(500000);
  C.record(s, {
    kind: "adjustment",
    name: "Sobregiro",
    accountId: "cash",
    amount: 300000,
    direction: -1,
    date: today,
  });
  // Cash -3,000 and debit 5,000: free total 2,000, but moving 3,000 is internal.
  C.record(s, {
    kind: "transfer",
    name: "Cubrir",
    amount: 300000,
    date: today,
    accountId: "debit",
    toAccountId: "cash",
  });
  assert.equal(C.balances(s).cash, 0);
  assert.equal(C.balances(s).debit, 200000);
});

test("spending shortfall reports the real gap of an overdrawn account", () => {
  const s = book(0);
  C.record(s, {
    kind: "adjustment",
    name: "Sobregiro",
    accountId: "debit",
    amount: 25050,
    direction: -1,
    date: today,
  });
  assert.throws(
    () =>
      C.record(s, {
        kind: "expense",
        name: "Café",
        amount: 1000,
        date: today,
        accountId: "debit",
        categoryId: "",
      }),
    /Faltan \$260\.50/,
  );
});

test("a balance correction cannot go below goal reserves and boxes", () => {
  const s = book(900000);
  s.goals.push({
    id: "g",
    name: "Viaje",
    target: 2000000,
    balance: 490000,
    allocations: [{ accountId: "debit", amount: 490000 }],
  });
  const down = (amount) =>
    C.record(s, {
      kind: "adjustment",
      name: "Corrección de saldo",
      accountId: "debit",
      amount,
      direction: -1,
      date: today,
    });
  assert.throws(() => down(800000), /reservados en metas/);
  down(400000); // 5,000 left, exactly the reserve.
  assert.equal(C.balances(s).debit, 500000);
  // Without reserves a correction may still record a real overdraft.
  const free = book(100000);
  C.record(free, {
    kind: "adjustment",
    name: "Corrección de saldo",
    accountId: "debit",
    amount: 300000,
    direction: -1,
    date: today,
  });
  assert.equal(C.balances(free).debit, -200000);
});

test("an extra payment reduces a total-balance debt by its whole amount", () => {
  const s = book();
  const d = withLoan(s);
  C.extraPayment(s, d.id, {
    amount: 10000,
    date: today,
    accountId: "debit",
  });
  assert.equal(d.balance, 1190000);
  assert.equal(C.balances(s).debit, 990000);
  assert.throws(
    () =>
      C.extraPayment(s, d.id, {
        amount: 2000000,
        date: today,
        accountId: "debit",
      }),
    /supera el saldo pendiente/,
  );
  const principal = withLoan(s, { id: "p", balanceMode: "principal" });
  C.extraPayment(s, "p", {
    amount: 10000,
    principal: 6000,
    date: today,
    accountId: "debit",
  });
  assert.equal(principal.balance, 1194000);
  C.extraPayment(s, "p", { amount: 4000, date: today, accountId: "debit" });
  assert.equal(principal.balance, 1190000);
  C.reverseTransaction(s, s.transactions.at(-1).id);
  assert.equal(principal.balance, 1194000);
});

test("reverting a corrected card payment reopens its MSI installment", () => {
  const s = book();
  withCard(s);
  withMsi(s);
  C.refreshAllBudgets(s);
  const payment = C.payCard(s, "cc", current, {
    accountId: "debit",
    amount: 10000,
  });
  C.correctCardPayment(s, payment.id, { amount: 10000 });
  C.reverseTransaction(s, payment.id);
  const statement = C.creditStatement(s, "cc", current);
  assert.equal(statement.remaining, 10000);
  assert.equal(statement.paid, false);
  assert.deepEqual(s.debts[0].paidPayments, []);
});

test("reverting a card payment tolerates debts without historical installments", () => {
  const s = book();
  withCard(s);
  const d = withMsi(s);
  C.refreshAllBudgets(s);
  const payment = C.payCard(s, "cc", current, {
    accountId: "debit",
    amount: 10000,
  });
  delete d.historicalPaidPayments;
  C.reverseTransaction(s, payment.id);
  assert.equal(d.balance, 30000);
});

test("an unassigned card credit can be applied to the second MSI installment", () => {
  const s = book();
  withCard(s);
  const previous = C.addMonth(current, -1);
  withMsi(s, { startDate: previous + "-01" });
  C.refreshAllBudgets(s);
  C.ensureBudget(s, previous);
  C.payCard(s, "cc", previous, {
    accountId: "debit",
    amount: 10000,
    date: previous + "-20",
  });
  C.payCard(s, "cc", current, {
    accountId: "debit",
    amount: 10000,
    unassigned: true,
  });
  C.applyCardCredit(s, "cc", current, 10000);
  assert.deepEqual(s.debts[0].paidPayments, [1, 2]);
  assert.equal(s.debts[0].balance, 10000);
});

test("unpaid commitments of earlier months stay visible, without invented arrears", () => {
  const s = book();
  const previous = C.addMonth(current, -1);
  s.fixedExpenses.push({
    id: "f",
    name: "Renta",
    rules: [
      {
        id: "r",
        unit: "months",
        interval: 1,
        startDate: previous + "-01",
        endDate: null,
        effectiveFrom: previous + "-01",
        amount: 900000,
        active: true,
      },
    ],
  });
  // No snapshot for last month: the app was not in use, nothing is overdue.
  assert.deepEqual(C.overdueObligations(s), []);
  C.ensureBudget(s, previous);
  const overdue = C.overdueObligations(s);
  assert.deepEqual(
    overdue.map((i) => [i.name, i.remaining]),
    [["Renta", 900000]],
  );
  assert.ok(C.reminders(s).some((r) => r.date === previous + "-01"));
  // A bill registered today does not create arrears before its registration.
  s.fixedExpenses[0].createdDate = today;
  assert.deepEqual(C.overdueObligations(s), []);
});

test("reminders cover a bounded window, not every month since an old start", () => {
  const s = book();
  s.fixedExpenses.push({
    id: "f",
    name: "Renta",
    createdDate: today,
    rules: [
      {
        id: "r",
        unit: "months",
        interval: 1,
        startDate: "2020-01-01",
        endDate: null,
        effectiveFrom: "2020-01-01",
        amount: 900000,
        active: true,
      },
    ],
  });
  const dates = C.reminders(s).map((r) => r.date);
  assert.ok(dates.length <= 13, `got ${dates.length}`);
  assert.ok(dates.every((d) => d >= current + "-01"));
});

test("removed or archived debts leave no unpaid commitments in other months", () => {
  const s = book();
  const d = withLoan(s);
  const next = C.addMonth(current, 1);
  C.ensureBudget(s, current);
  C.ensureBudget(s, next);
  s.debts = s.debts.filter((x) => x.id !== d.id);
  assert.deepEqual(C.obligations(s, next), []);
  const archived = withLoan(s, { id: "a", balance: 0 });
  archived.archived = true;
  C.refreshAllBudgets(s);
  assert.deepEqual(C.obligations(s, next), []);
  assert.deepEqual(C.reminders(s), []);
});
