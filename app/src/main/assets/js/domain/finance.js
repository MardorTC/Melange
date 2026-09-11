import L from "./legacy-v7.js";
import * as F from "./funds.js";
import * as R from "./recurrence.js";
const { id, clone, cents, today, month, addMonth, dueDate, validDate } = L;
const balances = F.balances;
function empty() {
  const s = L.empty();
  s.schemaVersion = 8;
  s.creditors = s.accounts;
  delete s.accounts;
  delete s.opening;
  s.walletAccounts = [
    {
      id: "cash",
      name: "Efectivo",
      type: "cash",
      opening: 0,
      active: true,
      allowedCategories: [],
    },
    {
      id: "debit",
      name: "Débito",
      type: "bank",
      opening: 0,
      active: true,
      allowedCategories: [],
    },
  ];
  s.boxes = [];
  s.receivables = [];
  s.settings.reminderTime = "09:00";
  return s;
}
function convertTransaction(t) {
  const v = { ...t, accountId: t.method };
  delete v.method;
  if (t.to) {
    v.toAccountId = t.to;
    delete v.to;
  }
  return v;
}
function migrate(raw) {
  if (raw?.format === "projectosp-backup") raw = raw.state;
  if (raw?.schemaVersion === 8) return validate(clone(raw));
  const old = L.migrate(raw),
    s = clone(old);
  s.schemaVersion = 8;
  s.creditors = s.accounts;
  delete s.accounts;
  s.walletAccounts = empty().walletAccounts.map((a) => ({
    ...a,
    opening: old.opening[a.id],
  }));
  delete s.opening;
  s.transactions = old.transactions.map(convertTransaction);
  s.boxes = [];
  s.receivables = [];
  s.goals = s.goals.map((g) => ({
    ...g,
    allocations: g.balance ? [{ accountId: null, amount: g.balance }] : [],
  }));
  s.debts = s.debts.map((d) => {
    const x = {
      ...d,
      creditorId: d.accountId || "",
      dueDay: Number(d.dueDay || 1),
      historicalPaidPayments: d.paidPayments.filter(
        (n) =>
          !s.transactions.some(
            (t) => t.ref === d.id && t.obligation === `debt:${d.id}:${n}`,
          ),
      ),
    };
    delete x.accountId;
    return x;
  });
  s.fixedExpenses = s.fixedExpenses.map((f) => ({
    ...f,
    categoryId: f.categoryId || "",
    rules: R.rulesFor(f),
  }));
  s.settings.reminderTime = "09:00";
  s.migration8 = { from: old.schemaVersion, date: today() };
  return validate(s);
}
function migrateDraft(d) {
  if (!d) return null;
  if (d.version === 2) return clone(d);
  if (d.version !== 1) throw Error("Borrador incompatible.");
  const base = empty(),
    v = clone(d);
  v.version = 2;
  v.walletAccounts = base.walletAccounts.map((a) => ({
    ...a,
    opening: d.config[a.id],
  }));
  v.creditors = d.accounts;
  delete v.accounts;
  v.entries = d.entries.map(convertTransaction);
  v.debts = d.debts.map((x) => {
    const r = {
      ...x,
      creditorId: x.accountId || "",
      dueDay: Number(x.dueDay || 1),
      historicalPaidPayments: [...x.paidPayments],
    };
    delete r.accountId;
    return r;
  });
  v.fixedExpenses = d.fixedExpenses.map((f) => ({
    ...f,
    categoryId: "",
    rules: R.rulesFor(f),
  }));
  v.settings.reminderTime = v.settings.reminderTime || "09:00";
  v.config.openings = Object.fromEntries(
    v.walletAccounts.map((a) => [a.id, a.opening]),
  );
  delete v.config.cash;
  delete v.config.debit;
  return v;
}
function migrateEnvelope(saved) {
  if (!saved) return null;
  if (!Array.isArray(saved.history) || !Number.isInteger(saved.revision || 0))
    throw Error("Historial de guardado inválido.");
  return {
    ...clone(saved),
    state: migrate(saved.state),
    history: saved.history.map((h) => ({ ...h, state: migrate(h.state) })),
    draft: migrateDraft(saved.draft),
    revision: saved.revision || 0,
  };
}
function validate(s) {
  if (
    !s ||
    s.schemaVersion !== 8 ||
    !s.settings ||
    !s.budgets ||
    !Number.isSafeInteger(s.income) ||
    s.income < 0
  )
    throw Error("Formato de Melange 8 inválido.");
  F.validateFunds(s);
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.settings.reminderTime) ||
    !Number.isInteger(s.settings.reminderDays) ||
    s.settings.reminderDays < 0 ||
    s.settings.reminderDays > 7
  )
    throw Error("Horario de recordatorios inválido.");
  for (const d of s.debts) {
    if (
      !Number.isInteger(d.dueDay) ||
      d.dueDay < 1 ||
      d.dueDay > 31 ||
      (d.creditorId && !s.creditors.some((c) => c.id === d.creditorId)) ||
      !Number.isSafeInteger(d.balance) ||
      d.balance < 0 ||
      !Number.isSafeInteger(d.originalAmount) ||
      d.originalAmount < 0 ||
      !Number.isSafeInteger(d.payment) ||
      d.payment < 0 ||
      !Number.isInteger(d.totalPayments) ||
      d.totalPayments < 0 ||
      d.totalPayments > 1200 ||
      !Array.isArray(d.paidPayments) ||
      !Array.isArray(d.paidMonths) ||
      new Set(d.paidPayments).size !== d.paidPayments.length ||
      d.paidPayments.some(
        (n) => !Number.isInteger(n) || n < 1 || n > d.totalPayments,
      ) ||
      (d.startDate && !validDate(d.startDate))
    )
      throw Error("Deuda inválida.");
    if (d.historicalPaidPayments?.some((n) => !d.paidPayments.includes(n)))
      throw Error("Antecedentes de deuda inválidos.");
  }
  for (const f of s.fixedExpenses) {
    for (const r of R.rulesFor(f)) {
      R.validateRule(r);
      if (r.categoryId && !s.categories.some((c) => c.id === r.categoryId))
        throw Error("Categoría de compromiso inválida.");
    }
    const rules = R.rulesFor(f);
    if (
      rules.some((r, i) => i && r.effectiveFrom <= rules[i - 1].effectiveFrom)
    )
      throw Error("Vigencias de periodicidad desordenadas.");
  }
  for (const b of Object.values(s.budgets))
    if (
      !b ||
      !Array.isArray(b.items) ||
      !Number.isSafeInteger(b.income) ||
      b.items.some(
        (i) =>
          !Number.isSafeInteger(i.amount) || i.amount < 0 || !validDate(i.date),
      )
    )
      throw Error("Presupuesto inválido.");
  for (const h of s.liquidityHistory)
    if (!validDate(h.date) || !Number.isSafeInteger(h.value))
      throw Error("Histórico inválido.");
  if (
    s.reconstruction &&
    (!validDate(s.reconstruction.startDate) ||
      s.reconstruction.startDate > today())
  )
    throw Error("Reconstrucción inválida.");
  return s;
}
function schedule(d, m) {
  if (d.archived) return null;
  if (d.totalPayments && d.startDate) {
    let n = 0;
    for (let i = 0; i < d.totalPayments; i++)
      if (addMonth(month(d.startDate), i) === m) {
        n = i + 1;
        break;
      }
    if (!n) return null;
    if (d.balance <= 0 && !d.paidPayments.includes(n)) return null;
    return {
      key: `debt:${d.id}:${n}`,
      ref: d.id,
      n,
      kind: "debt",
      name: d.name,
      amount: d.payment,
      date: dueDate(m, d.dueDay),
      paid: d.paidPayments.includes(n),
    };
  }
  if (
    d.active === false ||
    !d.payment ||
    d.balance <= 0 ||
    (d.startDate && m < month(d.startDate))
  )
    return null;
  return {
    key: `debt:${d.id}:${m}`,
    ref: d.id,
    period: m,
    kind: "debt",
    name: d.name,
    amount: Math.min(d.payment, d.balance),
    date: dueDate(m, d.dueDay),
    paid: d.paidMonths.includes(m),
  };
}
function planned(s, m) {
  return [
    ...s.debts.map((d) => schedule(d, m)).filter(Boolean),
    ...s.fixedExpenses.flatMap((f) => R.occurrences(f, m)),
  ];
}
function ensureBudget(s, m = month()) {
  if (!s.budgets[m])
    s.budgets[m] = {
      income: s.income,
      items: planned(s, m).map((x) => ({ ...x, legacyPaid: x.paid })),
    };
  return s.budgets[m];
}
function refreshBudget(s, m = month()) {
  const prev = ensureBudget(s, m),
    existing = new Map(prev.items.map((i) => [i.key, i]));
  const items = planned(s, m).map((i) => {
    const old = existing.get(i.key);
    return old &&
      (isPaid(s, old) || s.transactions.some((t) => t.obligation === old.key))
      ? old
      : { ...i, legacyPaid: i.paid };
  });
  for (const i of prev.items)
    if (
      !items.some((x) => x.key === i.key) &&
      (isPaid(s, i) || s.transactions.some((t) => t.obligation === i.key))
    )
      items.push(i);
  s.budgets[m] = { income: s.income, items };
}
function isPaid(s, i) {
  return (
    !!i.legacyPaid ||
    s.transactions
      .filter((t) => t.obligation === i.key)
      .reduce((a, t) => a + t.amount, 0) >= i.amount ||
    !!(
      i.kind === "debt" &&
      s.debts.find((d) => d.id === i.ref) &&
      (i.n
        ? s.debts.find((d) => d.id === i.ref).paidPayments.includes(i.n)
        : s.debts.find((d) => d.id === i.ref).paidMonths.includes(i.period))
    )
  );
}
function obligations(s, m = month()) {
  return (s.budgets[m]?.items || planned(s, m)).map((i) => {
    const recorded = s.transactions
        .filter((t) => t.obligation === i.key)
        .reduce((a, t) => a + t.amount, 0),
      paid = isPaid(s, i);
    return {
      ...i,
      paid,
      recorded,
      remaining: paid ? 0 : Math.max(0, i.amount - recorded),
    };
  });
}
function metrics(s, m = month()) {
  const accounts = F.accountSummary(s),
    items = obligations(s, m),
    income = s.budgets[m]?.income ?? s.income,
    tx = s.transactions.filter((t) => month(t.date) === m);
  const sum = (list, fn) => list.reduce((n, x) => n + fn(x), 0),
    fixed = sum(
      items.filter((i) => i.kind === "fixed"),
      (i) => i.amount,
    ),
    debt = sum(
      items.filter((i) => i.kind === "debt"),
      (i) => i.amount,
    );
  return {
    cash: sum(
      accounts.filter((a) => a.type === "cash"),
      (a) => a.total,
    ),
    debit: sum(
      accounts.filter((a) => a.type === "bank"),
      (a) => a.total,
    ),
    liquidity: sum(
      accounts.filter((a) => a.type !== "restricted"),
      (a) => a.total,
    ),
    restricted: sum(
      accounts.filter((a) => a.type === "restricted"),
      (a) => a.total,
    ),
    frozen: sum(accounts, (a) => a.frozen),
    reserved: sum(s.goals, F.goalBalance),
    unassigned: F.unassigned(s),
    available: F.available(s),
    receivable: sum(s.receivables, (l) => F.loanBalance(s, l.id)),
    accounts,
    income,
    fixed,
    debt,
    pending: sum(items, (i) => i.remaining),
    paid: sum(items, (i) =>
      i.legacyPaid ? i.amount : i.recorded || (i.paid ? i.amount : 0),
    ),
    budgetFree: income - fixed - debt,
    consumption: sum(
      tx.filter((t) => ["expense", "fixed"].includes(t.kind)),
      (t) => t.amount,
    ),
    outflow: sum(
      tx.filter((t) => ["expense", "fixed", "debt"].includes(t.kind)),
      (t) => t.amount,
    ),
    received: sum(
      tx.filter((t) => t.kind === "income"),
      (t) => t.amount,
    ),
    dti: income > 0 ? (debt / income) * 100 : null,
  };
}
function pay(s, key, opts) {
  const m = opts.period || month(),
    item = obligations(s, m).find((i) => i.key === key);
  if (!item) throw Error("No se encontró el vencimiento.");
  if (item.paid) throw Error("Este pago ya fue registrado.");
  const amount = opts.amount ?? item.amount;
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw Error("Introduce un importe válido.");
  if (amount > item.remaining)
    throw Error(
      "El importe supera lo pendiente de esta cuota. Usa Abono adicional para el excedente.",
    );
  const complete = amount >= item.remaining;
  const d =
    item.kind === "debt" ? s.debts.find((x) => x.id === item.ref) : null;
  const reduction = d
    ? d.balanceMode === "principal"
      ? opts.principal
      : amount
    : 0;
  if (
    d &&
    (!Number.isSafeInteger(reduction) ||
      reduction < 0 ||
      reduction > amount ||
      reduction > d.balance)
  )
    throw Error(
      "La reducción de saldo debe estar entre cero y el saldo pendiente, sin superar el pago.",
    );
  const t = {
    id: id(),
    kind: item.kind,
    name: item.name,
    amount,
    date: opts.date || today(),
    accountId: opts.accountId || "debit",
    categoryId: item.categoryId || opts.categoryId || "",
    obligation: key,
    ref: item.ref,
    period: m,
    principal: reduction,
  };
  checkMovement(s, t, opts.replay);
  s.transactions.push(t);
  if (d) {
    d.balance -= reduction;
    if (complete || d.balance === 0) {
      if (item.n) d.paidPayments.push(item.n);
      else d.paidMonths.push(item.period);
    }
    if (d.balance === 0) d.active = false;
  }
  return t;
}
function checkMovement(s, t, replay = false) {
  if (
    !t.name?.trim() ||
    !Number.isSafeInteger(t.amount) ||
    t.amount <= 0 ||
    !validDate(t.date) ||
    t.date > today()
  )
    throw Error("Revisa concepto, importe y fecha real.");
  const a = s.walletAccounts.find((a) => a.id === t.accountId);
  if (!a || (!replay && a.active === false))
    throw Error("Elige una cuenta activa.");
  if (
    ![
      "income",
      "expense",
      "fixed",
      "debt",
      "transfer",
      "adjustment",
      "loan_in",
      "loan_out",
    ].includes(t.kind)
  )
    throw Error("Tipo de movimiento inválido.");
  if (
    a.type === "restricted" &&
    !["income", "adjustment"].includes(t.kind) &&
    (!["expense", "fixed"].includes(t.kind) ||
      !a.allowedCategories.includes(t.categoryId))
  )
    throw Error("Los vales no permiten esta operación o categoría.");
  if (t.kind === "transfer") {
    if (t.toAccountId === t.accountId)
      throw Error("El origen y destino deben ser diferentes.");
    const destination = s.walletAccounts.find((x) => x.id === t.toAccountId);
    if (!destination || destination.type === "restricted")
      throw Error("Destino de transferencia no permitido.");
    if (!replay) F.requireDestination(s, t.toAccountId, "transfer");
  }
  if (["loan_out", "loan_in"].includes(t.kind)) {
    const l = s.receivables.find((l) => l.id === t.ref);
    if (!l || l.archived) throw Error("Préstamo no disponible.");
    if (t.kind === "loan_in" && t.amount > F.loanBalance(s, l.id))
      throw Error("El cobro supera el saldo pendiente.");
  }
  if (t.kind === "adjustment" && ![-1, 1].includes(t.direction))
    throw Error("Dirección inválida.");
  if (!replay) {
    if ([...F.cashKinds, "transfer"].includes(t.kind))
      F.requireFunds(s, t.accountId, t.amount, t.kind, t.categoryId);
    else if (["income", "loan_in"].includes(t.kind))
      F.requireDestination(s, t.accountId, t.kind);
  }
}
function record(s, t, options = {}) {
  checkMovement(s, t, options.replay);
  const value = { ...t, id: id() };
  s.transactions.push(value);
  return value;
}
function reverseTransaction(s, idTx) {
  const t = s.transactions.find((t) => t.id === idTx);
  if (!t) throw Error("Movimiento no encontrado.");
  if (t.historical)
    throw Error("Este movimiento es un antecedente; corrígelo desde Editar.");
  if (
    ["income", "loan_in"].includes(t.kind) ||
    (t.kind === "adjustment" && t.direction === 1)
  )
    F.requireFunds(s, t.accountId, t.amount, "reversal", t.categoryId);
  if (t.kind === "transfer")
    F.requireFunds(s, t.toAccountId, t.amount, "transfer");
  if (t.kind === "loan_out" && F.loanBalance(s, t.ref) < t.amount)
    throw Error("Revierte primero los cobros asociados.");
  if (t.kind === "debt") {
    const d = s.debts.find((d) => d.id === t.ref);
    d.balance += t.principal;
    d.active = true;
    if (t.obligation) {
      const i = (s.budgets[t.period]?.items || planned(s, t.period)).find(
        (i) => i.key === t.obligation,
      );
      if (i?.n)
        d.paidPayments = d.paidPayments.filter(
          (n) => n !== i.n || (d.historicalPaidPayments || []).includes(n),
        );
      else d.paidMonths = d.paidMonths.filter((m) => m !== t.period);
    }
  }
  s.transactions = s.transactions.filter((x) => x.id !== idTx);
}
function editTransaction(s, idTx, value) {
  const original = s.transactions.find((t) => t.id === idTx);
  if (!original) throw Error("Movimiento no encontrado.");
  if (!["income", "expense", "transfer"].includes(original.kind))
    throw Error("Revierte y vuelve a registrar el movimiento vinculado.");
  if (original.historical) {
    Object.assign(original, value);
    return;
  }
  const copy = clone(s);
  copy.transactions = copy.transactions.filter((t) => t.id !== idTx);
  checkMovement(copy, value);
  copy.transactions.push({ ...value, id: idTx });
  const before = F.accountSummary(s),
    after = F.accountSummary(copy);
  if (
    after.some(
      (a) =>
        a.available < Math.min(0, before.find((b) => b.id === a.id).available),
    ) ||
    F.available(copy) < Math.min(0, F.available(s))
  )
    throw Error(
      "El cambio utilizaría dinero reservado o dejaría un saldo insuficiente.",
    );
  s.transactions = s.transactions.map((t) =>
    t.id === idTx ? { ...value, id: idTx } : t,
  );
}
function setPriorPayments(s, d, count) {
  if (!Number.isInteger(count) || count < 0 || count > d.totalPayments)
    throw Error("Revisa las cuotas pagadas antes del registro.");
  const prior = Array.from({ length: count }, (_, i) => i + 1);
  if (
    prior.some((n) =>
      s.transactions.some(
        (t) => t.ref === d.id && t.obligation === `debt:${d.id}:${n}`,
      ),
    )
  )
    throw Error(
      "No marques como antecedente una cuota que tiene pagos registrados.",
    );
  const actual = d.paidPayments.filter(
    (n) => !(d.historicalPaidPayments || []).includes(n),
  );
  d.historicalPaidPayments = prior;
  d.paidPayments = [...new Set([...prior, ...actual])].sort((a, b) => a - b);
  for (const b of Object.values(s.budgets))
    for (const i of b.items)
      if (i.kind === "debt" && i.ref === d.id && i.n)
        i.legacyPaid = prior.includes(i.n);
}
function refreshAllBudgets(s) {
  for (const m of new Set([...Object.keys(s.budgets), month()]))
    refreshBudget(s, m);
}
function ledgerEntries(s) {
  let b = Object.fromEntries(s.walletAccounts.map((a) => [a.id, a.opening]));
  return s.transactions
    .filter((t) => !t.historical)
    .map((t, index) => ({ ...t, index }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
    .map((t) => {
      b = balances({
        ...s,
        walletAccounts: s.walletAccounts.map((a) => ({
          ...a,
          opening: b[a.id],
        })),
        transactions: [t],
      });
      const value = s.walletAccounts
        .filter((a) => a.type !== "restricted")
        .reduce((n, a) => n + b[a.id], 0);
      return {
        ...t,
        balances: { ...b },
        cash: b.cash || 0,
        debit: b.debit || 0,
        value,
      };
    });
}
function ledgerHistory(s) {
  const start = s.walletAccounts
      .filter((a) => a.type !== "restricted")
      .reduce((n, a) => n + a.opening, 0),
    points = new Map([
      [
        s.reconstruction.startDate,
        { date: s.reconstruction.startDate, value: start, reconstructed: true },
      ],
    ]);
  for (const t of ledgerEntries(s))
    points.set(t.date, { date: t.date, value: t.value, reconstructed: true });
  points.set(today(), {
    date: today(),
    value: metrics(s).liquidity,
    reconstructed: true,
  });
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function snapshot(s) {
  if (s.reconstruction?.basis === "ledger") {
    s.liquidityHistory = ledgerHistory(s);
    return;
  }
  const value = metrics(s).liquidity,
    date = today(),
    h = s.liquidityHistory.find((h) => h.date === date);
  if (h) h.value = value;
  else s.liquidityHistory.push({ date, value, observed: true });
  s.liquidityHistory.sort((a, b) => a.date.localeCompare(b.date));
}
function reminders(s) {
  const dates = [],
    months = new Set(Object.keys(s.budgets));
  let earliest = month();
  for (const d of s.debts)
    if (d.startDate && month(d.startDate) < earliest)
      earliest = month(d.startDate);
  for (const f of s.fixedExpenses)
    for (const r of R.rulesFor(f))
      if (!r.legacy && month(r.effectiveFrom) < earliest)
        earliest = month(r.effectiveFrom);
  earliest =
    earliest < addMonth(month(), -1200) ? addMonth(month(), -1200) : earliest;
  for (let m = earliest; m <= addMonth(month(), 11); m = addMonth(m, 1))
    months.add(m);
  for (const m of months)
    for (const i of obligations(s, m))
      if (!i.paid) dates.push({ id: i.key, name: i.name, date: i.date });
  for (const l of s.receivables)
    if (!l.archived && l.dueDate && F.loanBalance(s, l.id) > 0)
      dates.push({ id: "loan:" + l.id, name: l.name, date: l.dueDate });
  for (const b of s.boxes)
    if (b.amount > 0)
      dates.push({ id: "box:" + b.id, name: b.name, date: b.availableDate });
  return dates;
}
export default {
  id,
  clone,
  cents,
  today,
  month,
  addMonth,
  dueDate,
  validDate,
  empty,
  validate,
  migrate,
  migrateDraft,
  migrateEnvelope,
  balances,
  schedule,
  planned,
  ensureBudget,
  refreshBudget,
  refreshAllBudgets,
  isPaid,
  obligations,
  metrics,
  pay,
  record,
  reverseTransaction,
  editTransaction,
  setPriorPayments,
  snapshot,
  ledgerEntries,
  ledgerHistory,
  reminders,
  ...F,
  ...R,
};
