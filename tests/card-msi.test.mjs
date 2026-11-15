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
