import test from "node:test";
import assert from "node:assert/strict";
import C from "../app/src/main/assets/js/domain/finance.js";
import {
  debtBreakdown,
  debtCellState,
  debtPlan,
  planInYear,
} from "../app/src/main/assets/js/domain/debt-plan.js";

const current = C.month();
const at = (n) => C.addMonth(current, n);

function fixture() {
  const s = C.empty();
  s.walletAccounts[1].opening = 1000000;
  s.creditCards.push({
    id: "card",
    name: "BBVA Crédito",
    limit: 3000000,
    closingDay: 15,
    paymentDay: 31,
    openingBalance: 0,
    openingDueDate: C.today(),
    active: true,
  });
  s.debts.push(
    {
      id: "msi",
      name: "Laptop MSI",
      type: "msi",
      creditorId: "",
      creditCardId: "card",
      dueDay: 31,
      originalAmount: 600000,
      balance: 400000,
      payment: 100000,
      totalPayments: 6,
      paidPayments: [1, 2],
      paidMonths: [],
      startDate: at(-2) + "-01",
      balanceMode: "total",
      archived: false,
    },
    {
      id: "loan",
      name: "Préstamo auto",
      type: "loan",
      creditorId: "",
      dueDay: 31,
      originalAmount: 7200000,
      balance: 3600000,
      payment: 300000,
      totalPayments: 24,
      paidPayments: Array.from({ length: 12 }, (_, i) => i + 1),
      paidMonths: [],
      startDate: at(-12) + "-01",
      balanceMode: "total",
      archived: false,
    },
    {
      id: "open",
      name: "Moto sin plazo",
      type: "loan-open",
      creditorId: "",
      dueDay: 31,
      originalAmount: 800000,
      balance: 320000,
      payment: 50000,
      totalPayments: 0,
      paidPayments: [],
      paidMonths: [],
      startDate: "",
      balanceMode: "total",
      archived: false,
    },
  );
  s.fixedExpenses.push({
    id: "rent",
    name: "Renta",
    amount: 800000,
    kind: "fixed",
    rules: [
      {
        id: "r1",
        unit: "months",
        interval: 1,
        startDate: at(-6) + "-01",
        endDate: null,
        effectiveFrom: at(-6) + "-01",
        amount: 800000,
        categoryId: "",
        creditCardId: "",
        active: true,
        anchorDay: 1,
      },
    ],
  });
  s.transactions.push({
    id: "purchase",
    kind: "expense",
    name: "Supermercado",
    amount: 50000,
    date: C.today(),
    accountId: null,
    creditCardId: "card",
    cardDueDate: at(1) + "-05",
    categoryId: "",
  });
  return s;
}

test("debt plan includes every MSI and loan separately and excludes fixed expenses", () => {
  const s = fixture();
  const plan = debtPlan(s);
  assert.equal(plan.rows.length, 3);
  assert.ok(!plan.rows.some((row) => row.name === "Renta"));
  const msi = plan.rows.find((row) => row.id === "msi");
  assert.equal(msi.cardName, "BBVA Crédito");
  assert.equal(msi.start, at(-2));
  assert.equal(msi.end, at(3));
  assert.equal(msi.status, "active");
  const loan = plan.rows.find((row) => row.id === "loan");
  assert.equal(loan.end, at(11));
  const open = plan.rows.find((row) => row.id === "open");
  assert.equal(open.end, at(6));
  assert.equal(open.estimated, true);
  assert.equal(plan.debtFreeMonth, at(11));
  assert.equal(plan.monthsRemaining, 12);
  assert.equal(plan.monthlyPayment, 450000);
  assert.equal(plan.totalBalance, 4320000);
  assert.deepEqual(
    planInYear(plan, current.slice(0, 4))
      .map((row) => row.id)
      .sort(),
    ["loan", "msi", "open"],
  );
});

test("debt breakdown counts card MSI and revolving purchases once", () => {
  const s = fixture();
  const breakdown = debtBreakdown(s);
  assert.equal(breakdown.cards.length, 1);
  assert.equal(breakdown.cards[0].total, 450000);
  assert.equal(breakdown.loansTotal, 3920000);
  assert.equal(breakdown.total, 4370000);
  assert.equal(
    breakdown.total,
    s.debts.reduce((n, d) => n + d.balance, 0) +
      C.creditSummary(s, "card").purchases -
      C.creditSummary(s, "card").unassigned,
  );
  assert.equal(breakdown.activeCount, 3);
});

test("debt cells mark paid, due, future and overdue months", () => {
  const s = fixture();
  const plan = debtPlan(s);
  const msi = plan.rows.find((row) => row.id === "msi");
  assert.equal(debtCellState(msi, at(-2)), "paid");
  assert.equal(debtCellState(msi, at(-1)), "paid");
  assert.equal(debtCellState(msi, current), "due");
  assert.equal(debtCellState(msi, at(1)), "future");
  assert.equal(debtCellState(msi, at(-3)), "outside");
});

test("unpaid months before today are flagged as overdue even if the contract still runs", () => {
  const s = fixture();
  s.debts[1] = {
    ...s.debts[1],
    startDate: at(-6) + "-01",
    totalPayments: 12,
    paidPayments: [1, 2],
    balance: 600000,
    payment: 100000,
  };
  const plan = debtPlan(s);
  const loan = plan.rows.find((row) => row.id === "loan");
  assert.equal(loan.lateCount, 4);
  assert.equal(loan.lateAmount, 400000);
  assert.equal(loan.status, "overdue");
  assert.equal(loan.end, at(5));
  assert.equal(plan.latePayment, 400000);
  assert.equal(plan.lateCount, 4);
});

test("an overdue term debt estimates a future end instead of claiming it is paid", () => {
  const s = fixture();
  s.debts[1] = {
    ...s.debts[1],
    startDate: at(-12) + "-01",
    totalPayments: 6,
    paidPayments: [1, 2, 3, 4, 5, 6],
    balance: 200000,
    payment: 100000,
  };
  const plan = debtPlan(s);
  const loan = plan.rows.find((row) => row.id === "loan");
  assert.equal(loan.overdue, true);
  assert.equal(loan.status, "overdue");
  assert.equal(loan.end, at(1));
  assert.equal(loan.monthsRemaining, 2);
});

test("an open debt without payment needs review and does not invent a payoff date", () => {
  const s = fixture();
  s.debts[2].payment = 0;
  const plan = debtPlan(s);
  const open = plan.rows.find((row) => row.id === "open");
  assert.equal(open.needsReview, true);
  assert.equal(open.status, "review");
  assert.equal(open.end, null);
  assert.equal(open.noDate, true);
  assert.equal(
    plan.rows.some((row) => row.end === null),
    true,
  );
  assert.equal(plan.debtFreeMonth, at(11));
  assert.equal(plan.monthsRemaining, 12);
  assert.equal(debtCellState(open, current), "outside");
});

test("a term debt without a payment is not presented as a payoff promise", () => {
  const s = fixture();
  s.debts[1].payment = 0;
  const plan = debtPlan(s);
  const loan = plan.rows.find((row) => row.id === "loan");
  assert.equal(loan.noDate, true);
  assert.equal(loan.end, null);
  assert.equal(loan.status, "review");
  assert.equal(plan.debtFreeMonth, at(6));
});

test("an open debt with a future start is not charged before its first installment", () => {
  const s = fixture();
  s.debts[2].startDate = at(2) + "-01";
  const plan = debtPlan(s);
  const open = plan.rows.find((row) => row.id === "open");
  assert.equal(open.start, at(2));
  assert.equal(open.end, at(8));
  assert.equal(plan.monthlyPayment, 400000);
});

test("a current installment whose date already passed is marked overdue", () => {
  const s = fixture();
  s.creditCards[0].paymentDay = 1;
  const plan = debtPlan(s);
  const msi = plan.rows.find((row) => row.id === "msi");
  assert.equal(msi.currentOverdue, true);
  assert.equal(msi.status, "overdue");
  assert.equal(debtCellState(msi, current), "overdue");
  assert.equal(plan.thisMonthRemaining, 450000);
});

test("an archived debt with balance is not hidden from totals or the plan", () => {
  const s = fixture();
  s.debts[2].archived = true;
  const breakdown = debtBreakdown(s);
  const plan = debtPlan(s);
  assert.equal(breakdown.total, 4370000);
  assert.ok(breakdown.loans.some((debt) => debt.id === "open"));
  assert.ok(plan.rows.some((row) => row.id === "open" && row.archived));
});
