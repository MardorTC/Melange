import test from "node:test";
import assert from "node:assert/strict";
import C from "../app/src/main/assets/js/domain/finance.js";

const today = C.today(),
  period = C.month(),
  previousDay = (() => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

function fixture() {
  const s = C.empty();
  s.started = true;
  s.walletAccounts[1].opening = 500000;
  s.creditCards.push({
    id: "card",
    name: "Banco",
    limit: 2000000,
    openingBalance: 0,
    openingDueDate: today,
    closingDay: 15,
    paymentDay: 5,
    active: true,
  });
  C.record(s, {
    kind: "expense",
    name: "Supermercado",
    amount: 50000,
    date: today,
    accountId: null,
    creditCardId: "card",
    cardDueDate: today,
    categoryId: s.categories[0].id,
  });
  s.debts.push({
    id: "msi",
    name: "Laptop",
    type: "msi",
    creditCardId: "card",
    creditorId: "",
    balanceMode: "total",
    balance: 700000,
    originalAmount: 700000,
    payment: 100000,
    totalPayments: 7,
    startDate: period + "-01",
    dueDay: 5,
    paidPayments: [],
    historicalPaidPayments: [],
    paidMonths: [],
    active: true,
  });
  C.ensureBudget(s, period);
  const first = C.payCard(s, "card", period, {
      amount: 40000,
      accountId: "debit",
      date: today,
    }),
    second = C.payCard(s, "card", period, {
      amount: 100000,
      accountId: "debit",
      date: today,
    });
  return { s, first, second };
}

test("correcting a distributed card payment keeps other payments and adjusts cash", () => {
  const { s, first, second } = fixture(),
    other = C.clone(second);
  const corrected = C.correctCardPayment(s, first.id, {
    amount: 50000,
    date: today,
    accountId: "debit",
  });
  assert.equal(corrected.id, first.id);
  assert.equal(corrected.amount, 50000);
  assert.deepEqual(
    s.transactions.find((t) => t.id === second.id),
    other,
  );
  assert.equal(
    corrected.allocations.reduce((n, a) => n + a.amount, 0),
    50000,
  );
  assert.equal(C.balances(s).debit, 350000);
  assert.equal(C.creditStatement(s, "card", period).remaining, 0);
  assert.deepEqual(s.debts[0].paidPayments, [1]);
  C.validate(s);
});

test("decreasing a card payment releases its allocations without deleting other payments", () => {
  const { s, first, second } = fixture(),
    other = C.clone(second);
  const staleBudget = s.budgets[period].items.find(
    (item) => item.key === "debt:msi:1",
  );
  staleBudget.legacyPaid = true;
  C.correctCardPayment(s, first.id, {
    amount: 10000,
    date: today,
    accountId: "debit",
  });
  const corrected = s.transactions.find((t) => t.id === first.id);
  assert.equal(corrected.amount, 10000);
  assert.equal(
    corrected.allocations.reduce((n, a) => n + a.amount, 0),
    10000,
  );
  assert.deepEqual(
    s.transactions.find((t) => t.id === second.id),
    other,
  );
  assert.equal(C.balances(s).debit, 390000);
  assert.equal(C.creditStatement(s, "card", period).remaining, 40000);
  assert.equal(s.debts[0].paidPayments.includes(1), false);
  assert.equal(
    s.budgets[period].items.find((item) => item.key === "debt:msi:1")
      .legacyPaid,
    false,
  );
  C.validate(s);
});

test("moving the account of a card payment conserves total cash and payment identity", () => {
  const { s, first, second } = fixture();
  s.walletAccounts.push({
    id: "savings",
    name: "Ahorros",
    type: "bank",
    opening: 200000,
    active: true,
    allowedCategories: [],
  });
  const totalBefore = C.balances(s).debit + C.balances(s).savings;
  C.correctCardPayment(s, second.id, {
    amount: second.amount,
    date: today,
    accountId: "savings",
  });
  assert.equal(C.balances(s).debit, 460000);
  assert.equal(C.balances(s).savings, 100000);
  assert.equal(C.balances(s).debit + C.balances(s).savings, totalBefore);
  assert.equal(
    s.transactions.find((t) => t.id === second.id).accountId,
    "savings",
  );
  assert.equal(
    s.transactions.find((t) => t.id === first.id).accountId,
    "debit",
  );
  C.validate(s);
});

test("guided reassignment moves money between charges without changing cash or other payments", () => {
  const { s, first, second } = fixture(),
    firstBefore = C.clone(first),
    cash = C.balances(s).debit,
    targets = C.cardPaymentTargets(s, second.id),
    target = targets.find((t) => t.kind === "debt" && t.n === 2);
  assert.ok(target, "future MSI installment should be a valid destination");
  const purchaseIndex = second.allocations.findIndex(
    (a) => a.kind === "purchase",
  );
  assert.ok(purchaseIndex >= 0);
  C.reassignCardPayment(s, second.id, {
    from: purchaseIndex,
    to: target,
    amount: 10000,
  });
  const updated = s.transactions.find((t) => t.id === second.id);
  assert.equal(updated.amount, second.amount);
  assert.equal(
    updated.allocations.reduce((n, a) => n + a.amount, 0),
    second.amount,
  );
  assert.ok(
    updated.allocations.some(
      (a) => a.kind === "debt" && a.n === 2 && a.amount === 10000,
    ),
  );
  assert.deepEqual(
    s.transactions.find((t) => t.id === first.id),
    firstBefore,
  );
  assert.equal(C.balances(s).debit, cash);
  C.validate(s);
});

test("invalid card payment corrections are atomic and explain the safe path", () => {
  const { s, first, second } = fixture(),
    before = C.clone(s);
  assert.throws(
    () =>
      C.correctCardPayment(s, second.id, {
        amount: second.amount,
        date: previousDay,
        accountId: "debit",
      }),
    /anterior a una compra/i,
  );
  assert.deepEqual(C.clone(s), before);
  assert.throws(
    () =>
      C.correctCardPayment(s, first.id, {
        amount: 10000000,
        date: today,
        accountId: "debit",
      }),
    /supera la deuda usada/i,
  );
  assert.deepEqual(C.clone(s), before);
  assert.throws(
    () =>
      C.correctCardPayment(s, first.id, {
        amount: first.amount,
        date: today,
        accountId: "debit",
        allocations: [{ kind: "purchase", ref: "missing", amount: 1 }],
      }),
    /sumar exactamente/i,
  );
  assert.deepEqual(C.clone(s), before);
  C.validate(s);
});

test("card payment targets describe pending charges without pretending the current payment is pending", () => {
  const { s, second } = fixture();
  const targets = C.cardPaymentTargets(s, second.id);
  assert.ok(targets.some((t) => t.kind === "debt" && t.n === 2));
  assert.ok(targets.some((t) => t.kind === "unassigned" && t.remaining > 0));
  assert.ok(
    targets.every(
      (t) =>
        Number.isSafeInteger(t.remaining) &&
        t.remaining > 0 &&
        typeof t.label === "string" &&
        t.label.length > 0,
    ),
  );
  assert.equal(
    targets.some((t) => t.kind === "debt" && t.obligation === "debt:msi:1"),
    false,
  );
});
