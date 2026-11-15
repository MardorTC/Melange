// Credit card + MSI entry without double counting or mental arithmetic
// (docs/revision-errores-humanos-2026-11.md, phase 0).
import test from "node:test";
import assert from "node:assert/strict";
import C from "../app/src/main/assets/js/domain/finance.js";

const current = C.month();

function book() {
  const s = C.empty();
  s.walletAccounts.find((a) => a.id === "debit").opening = 5000000;
  return s;
}
const card = (total, installments = [], cardId = null, s = book()) => {
  const id = C.saveCreditCard(
    s,
    cardId,
    {
      name: "Visa",
      limit: 5000000,
      closingDay: 15,
      paymentDay: 5,
      totalBalance: total,
      openingDueDate: C.addMonth(current, 1) + "-05",
    },
    installments,
  );
  return { s, id };
};
const row = (extra = {}) => ({
  name: "Laptop",
  balance: 600000,
  payment: 100000,
  totalPayments: 12,
  priorPaid: 6,
  startDate: C.addMonth(current, -6) + "-05",
  ...extra,
});
function linkFromDebts(s, cardId, included) {
  // What the debt wizard stores for a new MSI linked to a card.
  s.debts.push({
    id: "m",
    name: "Laptop",
    creditorId: "",
    creditCardId: cardId,
    type: "msi",
    originalAmount: 1200000,
    balance: 600000,
    payment: 100000,
    totalPayments: 12,
    startDate: C.addMonth(current, -6) + "-05",
    dueDay: 5,
    financingCost: 0,
    annualRate: 0,
    notes: "",
    balanceMode: "total",
    historicalPaidPayments: [],
    active: true,
    archived: false,
    paidPayments: [],
    paidMonths: [],
  });
  C.setPriorPayments(s, s.debts.at(-1), 6);
  if (included) C.absorbIntoCardBalance(s, cardId, 600000);
  C.refreshAllBudgets(s);
  C.validate(s);
}

test("an MSI linked from Debts that the card total already included is not counted twice", () => {
  const { s, id } = card(1200000);
  linkFromDebts(s, id, true);
  assert.equal(C.creditSummary(s, id).used, 1200000);
  const fresh = card(1200000);
  linkFromDebts(fresh.s, fresh.id, false);
  assert.equal(C.creditSummary(fresh.s, fresh.id).used, 1800000);
});

test("absorbing more than the card's previous balance explains both options", () => {
  const { s, id } = card(500000);
  assert.throws(
    () => C.absorbIntoCardBalance(s, id, 600000),
    /No, súmala a la tarjeta/,
  );
  assert.equal(s.creditCards[0].openingBalance, 500000);
});

test("a new MSI added while editing a card is summed unless it was included", () => {
  const { s, id } = card(54000);
  const used = C.creditSummary(s, id).used;
  C.saveCreditCard(
    s,
    id,
    {
      name: "Visa",
      limit: 5000000,
      closingDay: 15,
      paymentDay: 5,
      totalBalance: used,
      openingDueDate: s.creditCards[0].openingDueDate,
    },
    [row({ included: false })],
  );
  assert.equal(C.creditSummary(s, id).used, 654000);
  assert.equal(s.creditCards[0].openingBalance, 54000);
  // Rows at creation (no flag) keep meaning "already in the total".
  const created = card(1200000, [row()]);
  assert.equal(C.creditSummary(created.s, created.id).used, 1200000);
});

test("MSI rows without a due day use the card's payment day", () => {
  const { s } = card(1200000, [row()]);
  assert.equal(s.debts[0].dueDay, 5);
});

test("bank-rounded installments are accepted and the last one settles the cents", () => {
  const { s, id } = card(400000, [
    row({
      name: "Tablet",
      balance: 400000,
      payment: 33333,
      priorPaid: 0,
      startDate: current + "-05",
    }),
  ]);
  const d = s.debts[0];
  const last = C.addMonth(C.month(d.startDate), 11);
  d.paidPayments = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  d.balance = 400000 - 11 * 33333;
  assert.equal(C.schedule(d, last).amount, 33337);
  assert.ok(C.creditSummary(s, id));
  assert.throws(
    () =>
      card(400000, [row({ balance: 400000, payment: 30000, priorPaid: 0 })]),
    /al menos \$333\.34/,
  );
});

test("the previous balance is due on the last closed statement still ahead", () => {
  assert.equal(
    C.lastStatementDueDate({ closingDay: 10, paymentDay: 30 }, "2026-11-15"),
    "2026-11-30",
  );
  // Last closing Oct 28 was due Nov 5, already past: use the current cycle.
  assert.equal(
    C.lastStatementDueDate({ closingDay: 28, paymentDay: 5 }, "2026-11-15"),
    "2026-12-05",
  );
});

test("«Pago 4 de 12» becomes prior installments, balance and first date", () => {
  assert.deepEqual(
    C.installmentProgress({
      payment: 50000,
      totalPayments: 12,
      current: 4,
      nextDue: "2026-12-05",
    }),
    { priorPaid: 3, balance: 450000, startDate: "2026-09-05" },
  );
  // Month-end payment days clamp without drifting.
  assert.equal(
    C.installmentProgress({
      payment: 50000,
      totalPayments: 12,
      current: 2,
      nextDue: "2026-03-31",
    }).startDate,
    "2026-02-28",
  );
  assert.throws(
    () =>
      C.installmentProgress({
        payment: 50000,
        totalPayments: 12,
        current: 13,
        nextDue: "2026-12-05",
      }),
    /entre 1 y el plazo/,
  );
});

test("an MSI linked from Debts is built like one added on the card", () => {
  const { s, id } = card(0);
  const plan = C.installmentProgress({
    payment: 50000,
    totalPayments: 12,
    current: 4,
    nextDue: C.creditDueDate(s.creditCards[0], C.today()),
  });
  const d = C.linkCardInstallment(
    s,
    id,
    { name: "Tele", payment: 50000, totalPayments: 12, ...plan },
    false,
    { notes: "Liverpool", originalAmount: undefined },
  );
  assert.equal(d.dueDay, 5);
  assert.equal(d.notes, "Liverpool");
  assert.equal(d.originalAmount, 600000);
  assert.deepEqual(d.historicalPaidPayments, [1, 2, 3]);
  assert.equal(C.creditSummary(s, id).used, 450000);
  // The next installment is not reported as overdue.
  C.refreshAllBudgets(s);
  assert.deepEqual(C.overdueObligations(s), []);
  assert.throws(
    () =>
      C.linkCardInstallment(
        s,
        id,
        { name: "Sin plazo", payment: 50000, totalPayments: 0 },
        false,
      ),
    /mensualidad y plazo/,
  );
});

const cardWithNext = (total, nextPayment, installments = []) => {
  const s = book();
  const id = C.saveCreditCard(
    s,
    null,
    {
      name: "Visa",
      limit: 5000000,
      closingDay: 15,
      paymentDay: 5,
      totalBalance: total,
      nextPayment,
      openingDueDate: C.addMonth(current, 1) + "-05",
    },
    installments,
  );
  return { s, id };
};

test("the next statement payment separates MSI still to be associated", () => {
  const { s, id } = cardWithNext(1200000, 700000);
  const summary = C.creditSummary(s, id);
  assert.equal(summary.used, 1200000);
  assert.equal(summary.pendingInstallments, 500000);
  assert.equal(
    C.creditStatement(s, id, C.addMonth(current, 1)).remaining,
    700000,
  );
  assert.throws(() => cardWithNext(500000, 700000), /no puede ser mayor/);
});

test("associating an MSI takes it from the pending amount first", () => {
  // Total $12,000, next payment $7,000: $5,000 of MSI not detailed.
  const fromCard = cardWithNext(1200000, 700000);
  const plan = C.installmentProgress({
    payment: 100000,
    totalPayments: 12,
    current: 7,
    nextDue: C.addMonth(current, 1) + "-05",
  });
  C.saveCreditCard(
    fromCard.s,
    fromCard.id,
    {
      name: "Visa",
      limit: 5000000,
      closingDay: 15,
      paymentDay: 5,
      totalBalance: C.creditSummary(fromCard.s, fromCard.id).used,
      openingDueDate: C.addMonth(current, 1) + "-05",
    },
    [
      {
        name: "Laptop",
        payment: 100000,
        totalPayments: 12,
        included: true,
        ...plan,
      },
    ],
  );
  const after = C.creditSummary(fromCard.s, fromCard.id);
  assert.equal(after.used, 1200000);
  assert.equal(after.pendingInstallments, 0);
  assert.equal(
    C.creditStatement(fromCard.s, fromCard.id, C.addMonth(current, 1))
      .remaining,
    700000,
  );
  // Same result linking it from Debts as "ya incluida".
  const fromDebts = cardWithNext(1200000, 700000);
  C.linkCardInstallment(
    fromDebts.s,
    fromDebts.id,
    { name: "Laptop", payment: 100000, totalPayments: 12, ...plan },
    true,
  );
  assert.equal(C.creditSummary(fromDebts.s, fromDebts.id).used, 1200000);
  assert.equal(fromDebts.s.creditCards[0].pendingInstallments, 0);
  assert.equal(fromDebts.s.creditCards[0].openingBalance, 600000);
});

test("schema 11 migrates v10 books and refuses data from newer versions", () => {
  const v10 = { ...C.empty(), schemaVersion: 10 };
  assert.equal(C.migrate(v10).schemaVersion, 11);
  assert.throws(
    () => C.migrate({ ...C.empty(), schemaVersion: 12 }),
    /versión más nueva/,
  );
});
