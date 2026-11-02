import test from "node:test";
import assert from "node:assert/strict";
import C from "../app/src/main/assets/js/domain/finance.js";

const today = C.today(),
  future = (() => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

function fixture() {
  const s = C.empty();
  s.started = true;
  s.walletAccounts[1].opening = 100000;
  s.receivables.push({
    id: "loan",
    name: "Viaje",
    person: "Ana",
    opening: 50000,
    dueDate: null,
    createdDate: today,
  });
  const loanOut = C.record(s, {
      kind: "loan_out",
      ref: "loan",
      name: "Viaje",
      amount: 30000,
      accountId: "debit",
      date: today,
    }),
    collection = C.record(s, {
      kind: "loan_in",
      ref: "loan",
      name: "Viaje",
      amount: 20000,
      accountId: "debit",
      date: today,
    });
  return { s, loanOut, collection };
}

test("editing a receivable changes what is owed without moving money", () => {
  const { s } = fixture(),
    cash = C.balances(s).debit;
  C.editLoan(s, "loan", {
    person: "Ana María",
    name: "Viaje compartido",
    opening: 60000,
    dueDate: today,
  });
  assert.equal(s.receivables[0].person, "Ana María");
  assert.equal(s.receivables[0].name, "Viaje compartido");
  assert.equal(s.receivables[0].dueDate, today);
  assert.equal(C.loanBalance(s, "loan"), 70000);
  assert.equal(C.balances(s).debit, cash);
  C.validate(s);
});

test("editing a collection adjusts only that collection and validates the remaining balance", () => {
  const { s, loanOut, collection } = fixture(),
    other = C.clone(loanOut);
  C.editLoanMovement(s, collection.id, {
    amount: 25000,
    accountId: "debit",
    date: today,
  });
  const edited = s.transactions.find((t) => t.id === collection.id);
  assert.equal(edited.amount, 25000);
  assert.equal(C.loanBalance(s, "loan"), 55000);
  assert.equal(C.balances(s).debit, 95000);
  assert.deepEqual(
    s.transactions.find((t) => t.id === loanOut.id),
    other,
  );
  C.validate(s);

  const before = C.clone(s);
  assert.throws(
    () =>
      C.editLoanMovement(s, collection.id, {
        amount: 80001,
        accountId: "debit",
        date: today,
      }),
    /supera el saldo pendiente/i,
  );
  assert.deepEqual(C.clone(s), before);
});

test("editing the destination account of a collection keeps total cash and uses the right direction", () => {
  const { s, collection } = fixture();
  s.walletAccounts.push({
    id: "savings",
    name: "Ahorros",
    type: "bank",
    opening: 30000,
    active: true,
    allowedCategories: [],
  });
  const totalBefore = C.balances(s).debit + C.balances(s).savings;
  C.editLoanMovement(s, collection.id, {
    amount: collection.amount,
    accountId: "savings",
    date: today,
  });
  assert.equal(
    s.transactions.find((t) => t.id === collection.id).accountId,
    "savings",
  );
  assert.equal(C.balances(s).debit, 70000);
  assert.equal(C.balances(s).savings, 50000);
  assert.equal(C.balances(s).debit + C.balances(s).savings, totalBefore);
  assert.equal(C.loanBalance(s, "loan"), 60000);
  C.validate(s);
});

test("editing a loan movement validates funds and future dates atomically", () => {
  const { s, loanOut } = fixture(),
    before = C.clone(s);
  assert.throws(
    () =>
      C.editLoanMovement(s, loanOut.id, {
        amount: 10000000,
        accountId: "debit",
        date: today,
      }),
    /Faltan|disponibles/i,
  );
  assert.deepEqual(C.clone(s), before);
  assert.throws(
    () =>
      C.editLoanMovement(s, loanOut.id, {
        amount: loanOut.amount,
        accountId: "debit",
        date: future,
      }),
    /futura/i,
  );
  assert.deepEqual(C.clone(s), before);
  C.validate(s);
});

test("an antecedent cannot be reduced below money already collected", () => {
  const s = C.empty();
  s.walletAccounts[1].opening = 100000;
  s.receivables.push({
    id: "loan",
    name: "Anticipo",
    person: "Luis",
    opening: 30000,
    dueDate: null,
    createdDate: today,
  });
  C.record(s, {
    kind: "loan_in",
    ref: "loan",
    name: "Anticipo",
    amount: 20000,
    accountId: "debit",
    date: today,
  });
  assert.equal(C.loanBalance(s, "loan"), 10000);
  const before = C.clone(s);
  assert.throws(() => C.editLoan(s, "loan", { opening: 0 }), /saldo negativo/i);
  assert.deepEqual(C.clone(s), before);
  C.editLoan(s, "loan", { opening: 40000 });
  assert.equal(C.loanBalance(s, "loan"), 20000);
  C.validate(s);
});

test("a collection decrease that would use reserved money is rejected without touching other movements", () => {
  const { s, collection } = fixture();
  s.goals.push({
    id: "goal",
    name: "Reserva",
    target: 90000,
    date: null,
    balance: 90000,
    allocations: [{ accountId: "debit", amount: 90000 }],
  });
  const before = C.clone(s);
  assert.throws(
    () =>
      C.editLoanMovement(s, collection.id, {
        amount: 1000,
        accountId: "debit",
        date: today,
      }),
    /reservado|insuficiente/i,
  );
  assert.deepEqual(C.clone(s), before);
  assert.equal(s.transactions.length, 2);
});

test("loan corrections cannot move a collection before enough money was lent", () => {
  const shift = (days) => {
    const value = new Date(today + "T12:00:00Z");
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const s = C.empty();
  s.walletAccounts[1].opening = 100000;
  s.receivables.push({
    id: "chronology",
    name: "Apoyo",
    person: "Ana",
    opening: 0,
    dueDate: null,
    createdDate: shift(-3),
  });
  const lent = C.record(s, {
    kind: "loan_out",
    ref: "chronology",
    name: "Apoyo",
    amount: 50000,
    accountId: "debit",
    date: shift(-2),
  });
  const collected = C.record(s, {
    kind: "loan_in",
    ref: "chronology",
    name: "Abono",
    amount: 20000,
    accountId: "debit",
    date: shift(-1),
  });
  const before = C.clone(s);
  assert.throws(
    () => C.editLoanMovement(s, lent.id, { date: today }),
    /antes del dinero prestado/,
  );
  assert.deepEqual(s, before);
  assert.throws(
    () => C.editLoanMovement(s, collected.id, { date: shift(-3) }),
    /antes del dinero prestado/,
  );
  assert.deepEqual(s, before);
  C.editLoanMovement(s, lent.id, { date: shift(-1) });
  assert.equal(C.loanBalance(s, "chronology"), 30000);
});

test("reducing an antecedent cannot leave historical collections funded only by later loans", () => {
  const s = C.empty();
  s.walletAccounts[1].opening = 100000;
  s.receivables.push({
    id: "chronology",
    name: "Apoyo",
    person: "Ana",
    opening: 50000,
    dueDate: null,
    createdDate: "2020-01-01",
  });
  C.record(s, {
    kind: "loan_in",
    ref: "chronology",
    name: "Cobro",
    amount: 30000,
    accountId: "debit",
    date: "2020-01-01",
  });
  C.record(s, {
    kind: "loan_out",
    ref: "chronology",
    name: "Otra entrega",
    amount: 50000,
    accountId: "debit",
    date: today,
  });
  const before = C.clone(s);
  assert.throws(
    () => C.editLoan(s, "chronology", { opening: 0 }),
    /antes del dinero prestado/,
  );
  assert.deepEqual(s, before);
});

test("legacy chronology is preserved on load, flagged for review and can be corrected explicitly", () => {
  const s = C.empty();
  s.walletAccounts[1].opening = 100000;
  s.receivables.push({
    id: "legacy",
    name: "Anterior",
    person: "Ana",
    opening: 0,
    dueDate: null,
    createdDate: "2020-01-01",
  });
  s.transactions.push(
    {
      id: "old-in",
      kind: "loan_in",
      ref: "legacy",
      name: "Cobro",
      amount: 20000,
      accountId: "debit",
      date: "2020-01-01",
    },
    {
      id: "old-out",
      kind: "loan_out",
      ref: "legacy",
      name: "Entrega",
      amount: 50000,
      accountId: "debit",
      date: "2020-01-02",
    },
  );
  const loaded = C.migrate({
    format: "projectosp-backup",
    state: s,
    version: 10,
  });
  assert.equal(C.loanBalance(loaded, "legacy"), 30000);
  assert.equal(
    loaded.transactions.find((movement) => movement.id === "old-in").date,
    "2020-01-01",
  );
  assert.match(
    C.loanTimelineIssue(loaded, "legacy"),
    /antes del dinero prestado/,
  );
  C.editLoanMovement(loaded, "old-out", { date: "2020-01-01" });
  assert.equal(C.loanTimelineIssue(loaded, "legacy"), "");
  assert.equal(C.loanBalance(loaded, "legacy"), 30000);
});

test("several legacy date inconsistencies can be repaired separately without worsening any deficit", () => {
  const s = C.empty();
  s.walletAccounts[1].opening = 200000;
  s.receivables.push({
    id: "legacy",
    name: "Anterior",
    person: "Ana",
    opening: 0,
    dueDate: null,
    createdDate: "2020-01-01",
  });
  s.transactions.push(
    {
      id: "in1",
      kind: "loan_in",
      ref: "legacy",
      name: "Cobro 1",
      amount: 20000,
      accountId: "debit",
      date: "2020-01-01",
    },
    {
      id: "out1",
      kind: "loan_out",
      ref: "legacy",
      name: "Entrega 1",
      amount: 50000,
      accountId: "debit",
      date: "2020-01-02",
    },
    {
      id: "in2",
      kind: "loan_in",
      ref: "legacy",
      name: "Cobro 2",
      amount: 40000,
      accountId: "debit",
      date: "2020-01-03",
    },
    {
      id: "out2",
      kind: "loan_out",
      ref: "legacy",
      name: "Entrega 2",
      amount: 50000,
      accountId: "debit",
      date: "2020-01-04",
    },
  );
  const before = C.clone(s),
    cash = C.balances(s).debit;
  assert.throws(
    () => C.editLoanMovement(s, "in1", { amount: 21000 }),
    /antes del dinero prestado/,
  );
  assert.deepEqual(s, before);
  C.editLoanMovement(s, "out1", { date: "2020-01-01" });
  assert.match(C.loanTimelineIssue(s, "legacy"), /2020-01-03/);
  C.editLoanMovement(s, "in2", { date: "2020-01-04" });
  assert.equal(C.loanTimelineIssue(s, "legacy"), "");
  assert.equal(C.loanBalance(s, "legacy"), 40000);
  assert.equal(C.balances(s).debit, cash);
});
