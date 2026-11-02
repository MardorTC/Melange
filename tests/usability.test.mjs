import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import C from "../app/src/main/assets/js/domain/finance.js";
import { parseMoney } from "../app/src/main/assets/js/domain/money-input.js";

const state = () => {
  const s = C.empty();
  s.started = true;
  s.walletAccounts[1].opening = 1000000;
  return s;
};
const card = (totalBalance = 200000) => ({
  name: "Banco",
  limit: 1000000,
  closingDay: 15,
  paymentDay: 5,
  totalBalance,
  openingDueDate: C.today(),
});
const msi = () => ({
  name: "Laptop",
  balance: 120000,
  payment: 10000,
  totalPayments: 12,
  priorPaid: 0,
  startDate: C.month() + "-01",
  dueDay: 5,
});
const rule = (extra = {}) => ({
  unit: "months",
  interval: 1,
  startDate: "2025-01-05",
  effectiveFrom: "2025-01-01",
  amount: 10000,
  active: true,
  ...extra,
});

test("money accepts explicit formats without silently dropping signs or precision", () => {
  for (const [raw, cents] of [
    ["12,50", 1250],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["0", 0],
  ])
    assert.equal(parseMoney(raw), cents);
  for (const raw of ["-500", "123.456", "1.234", "12.3.4", "", "abc500"])
    assert.throws(() => parseMoney(raw));
  assert.equal(parseMoney("-500", true), -50000);
});

test("one inclusive card total creates several MSI atomically without changing cash", () => {
  const s = state(),
    before = C.balances(s);
  const id = C.saveCreditCard(s, null, card(250000), [
    msi(),
    {
      ...msi(),
      name: "Teléfono",
      balance: 30000,
      payment: 5000,
      totalPayments: 6,
    },
  ]);
  assert.equal(s.creditCards[0].openingBalance, 100000);
  assert.equal(C.creditSummary(s, id).used, 250000);
  assert.equal(C.creditSummary(s, id).installments, 150000);
  assert.equal(s.transactions.length, 0);
  assert.deepEqual(C.balances(s), before);
  C.validate(s);
});

test("invalid total or MSI leaves the entire card and ledger unchanged", () => {
  const s = state(),
    before = JSON.stringify(s);
  assert.throws(() => C.saveCreditCard(s, null, card(5000), [msi()]));
  assert.equal(JSON.stringify(s), before);
  assert.throws(() =>
    C.saveCreditCard(s, null, card(), [{ ...msi(), priorPaid: 13 }]),
  );
  assert.equal(JSON.stringify(s), before);
});

test("editing inclusive card balance preserves purchases, payments and paid MSI", () => {
  const s = state(),
    id = C.saveCreditCard(s, null, card(), [msi()]);
  C.payCard(s, id, C.month(), {
    amount: 10000,
    accountId: "debit",
    date: C.today(),
  });
  const d = s.debts[0],
    transactions = C.clone(s.transactions),
    balance = C.balances(s).debit;
  const input = {
    ...msi(),
    id: d.id,
    balance: d.balance,
    name: "Laptop corregida",
  };
  C.saveCreditCard(s, id, card(195000), [input]);
  assert.equal(C.creditSummary(s, id).used, 195000);
  assert.equal(s.debts[0].name, "Laptop corregida");
  assert.deepEqual(s.transactions, transactions);
  assert.equal(C.balances(s).debit, balance);
  const before = JSON.stringify(s);
  assert.throws(() =>
    C.saveCreditCard(s, id, card(), [{ ...input, payment: 9000 }]),
  );
  assert.equal(JSON.stringify(s), before);
});

test("fixed edit automatically protects advance payments; archive stops unpaid dues, not history", () => {
  const s = state();
  C.updateFixed(s, "f", { name: "Internet", kind: "subscription" }, rule());
  C.ensureBudget(s, "2025-03");
  const item = C.obligations(s, "2025-03")[0];
  C.pay(s, item.key, {
    period: "2025-03",
    amount: 10000,
    date: "2025-02-01",
    accountId: "debit",
  });
  const payment = C.clone(s.transactions[0]);
  const effective = C.updateFixed(
    s,
    "f",
    { name: "Internet nuevo", kind: "subscription" },
    rule({ amount: 15000, effectiveFrom: "2025-02-01" }),
  );
  assert.equal(effective, "2025-03-06");
  assert.equal(
    C.obligations(s, "2025-03").filter((i) => i.ref === "f").length,
    1,
  );
  assert.equal(C.obligations(s, "2025-04")[0].amount, 15000);
  const f = s.fixedExpenses[0];
  C.updateFixed(
    s,
    "f",
    { name: f.name, kind: f.kind },
    rule({ active: false, effectiveFrom: "2025-02-01" }),
  );
  assert.equal(C.obligations(s, "2025-02").length, 0);
  assert.equal(C.obligations(s, "2025-03")[0].paid, true);
  assert.equal(C.obligations(s, "2025-04").length, 0);
  assert.deepEqual(s.transactions[0], payment);
  C.validate(s);
});

test("correcting a fixed payment keeps its identity, account balance and obligation in sync", () => {
  const s = state();
  C.updateFixed(s, "f", { name: "Internet", kind: "fixed" }, rule());
  C.ensureBudget(s, "2025-01");
  const item = C.obligations(s, "2025-01")[0];
  const t = C.pay(s, item.key, {
    period: "2025-01",
    amount: 10000,
    date: "2025-01-05",
    accountId: "debit",
  });
  C.editFixedPayment(s, t.id, {
    name: t.name,
    amount: 15000,
    date: "2025-01-06",
    accountId: "debit",
    creditCardId: null,
  });
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].id, t.id);
  assert.equal(C.balances(s).debit, 985000);
  assert.equal(C.obligations(s, "2025-01")[0].paid, true);
  assert.equal(C.obligations(s, "2025-01")[0].amount, 15000);
  assert.equal(C.obligations(s, "2025-02")[0].amount, 10000);
  C.reverseTransaction(s, t.id);
  assert.equal(C.balances(s).debit, 1000000);
  assert.equal(C.obligations(s, "2025-01")[0].remaining, 15000);
});

test("editing interval keeps the explicit original calendar phase", () => {
  const s = state();
  C.updateFixed(
    s,
    "f",
    { name: "Servicio", kind: "fixed" },
    rule({ startDate: "2025-01-01" }),
  );
  C.ensureBudget(s, "2025-07");
  C.pay(s, C.obligations(s, "2025-07")[0].key, {
    period: "2025-07",
    amount: 10000,
    date: "2025-07-01",
    accountId: "debit",
  });
  C.updateFixed(
    s,
    "f",
    { name: "Servicio", kind: "fixed" },
    rule({ startDate: "2025-01-01", interval: 2, effectiveFrom: "2025-07-02" }),
  );
  assert.equal(C.obligations(s, "2025-08").length, 0);
  assert.equal(C.obligations(s, "2025-09")[0].date, "2025-09-01");
});

test("editing imported historical fixed dues does not create a duplicate pending charge", () => {
  const s = state();
  C.updateFixed(s, "f", { name: "Servicio", kind: "fixed" }, rule());
  C.ensureBudget(s, "2025-01");
  s.budgets["2025-01"].items[0].legacyPaid = true;
  C.updateFixed(
    s,
    "f",
    { name: "Servicio", kind: "fixed" },
    rule({ amount: 15000, effectiveFrom: "2025-01-01" }),
  );
  assert.equal(C.obligations(s, "2025-01").length, 1);
  assert.equal(C.obligations(s, "2025-01")[0].paid, true);
  assert.equal(C.obligations(s, "2025-02")[0].amount, 15000);
});

test("fixed credit payment correction preserves covered charges and rejects unsafe changes atomically", () => {
  const s = state(),
    id = C.saveCreditCard(s, null, card(0));
  C.updateFixed(s, "f", { name: "Internet", kind: "fixed" }, rule());
  C.ensureBudget(s, C.month());
  const item = C.obligations(s).find((i) => i.ref === "f");
  const t = C.pay(s, item.key, {
    amount: 10000,
    date: C.today(),
    creditCardId: id,
  });
  C.payCard(s, id, C.month(t.cardDueDate), {
    amount: 10000,
    accountId: "debit",
    date: C.today(),
  });
  const copy = JSON.stringify(s);
  assert.throws(() => C.editFixedPayment(s, t.id, { ...t, amount: 5000 }));
  assert.equal(JSON.stringify(s), copy);
  C.editFixedPayment(s, t.id, { ...t, name: "Internet corregido" });
  assert.equal(
    s.transactions.find((x) => x.id === t.id).name,
    "Internet corregido",
  );
  assert.equal(C.creditSummary(s, id).used, 0);
  C.validate(s);
});

test("opening dates protect new accounts without inventing dates for old backups", () => {
  const s = state();
  s.walletAccounts[1].openingDate = C.today();
  const expense = {
    kind: "expense",
    name: "Anterior",
    amount: 5000,
    date: C.addMonth(C.month(), -1) + "-01",
    accountId: "debit",
  };
  assert.throws(() => C.record(s, expense), /anterior al saldo inicial/);
  delete s.walletAccounts[1].openingDate;
  C.record(s, expense);
  C.validate(s);
});

test("advance fixed payments without a budget survive archiving and remain editable", () => {
  const s = state(),
    period = C.addMonth(C.month(), 1);
  C.updateFixed(s, "f", { name: "Servicio", kind: "fixed" }, rule());
  assert.equal(s.budgets[period], undefined);
  const item = C.obligations(s, period)[0];
  const t = C.pay(s, item.key, {
    period,
    amount: 10000,
    date: C.today(),
    accountId: "debit",
  });
  assert.ok(s.budgets[period]);
  // Also cover books saved by older versions before payment snapshots existed.
  delete s.budgets[period];
  C.updateFixed(
    s,
    "f",
    { name: "Servicio", kind: "fixed" },
    rule({ active: false, effectiveFrom: C.today() }),
  );
  assert.equal(C.obligations(s, period)[0].paid, true);
  assert.equal(C.metrics(s, period).paid, 10000);
  C.editFixedPayment(s, t.id, { ...t, name: "Servicio corregido" });
  assert.equal(C.obligations(s, period)[0].paid, true);
  C.validate(s);
});

test("MSI schedule must cover its outstanding balance after historical installments", () => {
  const s = state(),
    before = JSON.stringify(s);
  assert.throws(
    () => C.saveCreditCard(s, null, card(), [{ ...msi(), balance: 200000 }]),
    /no alcanzan/,
  );
  assert.equal(JSON.stringify(s), before);
  assert.throws(
    () => C.saveCreditCard(s, null, card(), [{ ...msi(), priorPaid: 6 }]),
    /no alcanzan/,
  );
  assert.equal(JSON.stringify(s), before);
  const id = C.saveCreditCard(s, null, card(), [
    { ...msi(), balance: 60000, priorPaid: 6 },
  ]);
  assert.equal(C.creditSummary(s, id).installments, 60000);
});

test("onboarding records each bank once without income or artificial transfers", () => {
  const s = C.empty();
  C.startLedger(s, {
    cash: 70000,
    banks: [
      { name: "Nómina", balance: 450000 },
      { name: "Otro banco", balance: 120000 },
    ],
    income: 2000000,
  });
  assert.equal(s.walletAccounts.length, 3);
  assert.equal(C.metrics(s).available, 640000);
  assert.equal(s.income, 2000000);
  assert.equal(s.transactions.length, 0);
  assert.equal(s.walletAccounts[1].id, "debit");
  assert.ok(s.walletAccounts.every((a) => a.openingDate === C.today()));
  const before = JSON.stringify(s);
  assert.throws(() =>
    C.startLedger(s, { banks: [{ name: "Otra", balance: 100 }] }),
  );
  assert.equal(JSON.stringify(s), before);
});

test("invalid bank setup is atomic, accepts overdrafts and rejects duplicate names", () => {
  const s = C.empty(),
    before = JSON.stringify(s);
  assert.throws(() =>
    C.startLedger(s, {
      cash: 100,
      banks: [
        { name: "Banco", balance: 200 },
        { name: "banco", balance: 300 },
      ],
    }),
  );
  assert.equal(JSON.stringify(s), before);
  assert.throws(() =>
    C.startLedger(s, { banks: [{ name: "Banco", balance: 1.5 }] }),
  );
  assert.equal(JSON.stringify(s), before);
  C.startLedger(s, { cash: 0, banks: [{ name: "Banco", balance: -5000 }] });
  assert.equal(C.metrics(s).available, -5000);
});

test("core small-text color pairs retain at least 4.5:1 contrast", () => {
  const theme = readFileSync(
    new URL("../app/src/main/assets/css/theme.css", import.meta.url),
    "utf8",
  );
  const colors = Object.fromEntries(
    [...theme.matchAll(/--([\w-]+):\s*#([a-fA-F0-9]{6});/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  const luminance = (hex) => {
    const rgb = hex
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const [foreground, background] of [
    [colors.muted, colors.bg],
    [colors.brand, "fffaf6"],
    [colors.green, colors.mint],
    [colors.warning, colors["warning-soft"]],
    [colors.info, colors["info-soft"]],
  ]) {
    const a = luminance(foreground),
      b = luminance(background);
    assert.ok(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
      `${foreground} on ${background}`,
    );
  }
});
