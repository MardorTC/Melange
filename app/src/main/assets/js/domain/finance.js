import L from "./legacy-v7.js";
import * as F from "./funds.js";
import * as R from "./recurrence.js";
import * as K from "./credit.js";
const { id, clone, cents, today, month, addMonth, dueDate, validDate } = L;
const balances = F.balances;
function empty() {
  const s = L.empty();
  s.schemaVersion = 10;
  s.creditCards = [];
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
function startLedger(s, { cash = 0, banks = [], income = 0 }) {
  if (
    s.started ||
    s.transactions.length ||
    s.debts.length ||
    s.receivables.length ||
    s.goals.length ||
    s.boxes.length
  )
    throw Error(
      "El libro ya tiene información. Corrige tus cuentas sin volver a iniciar.",
    );
  if (
    !Number.isSafeInteger(cash) ||
    cash < 0 ||
    !Number.isSafeInteger(income) ||
    income < 0 ||
    !banks.length
  )
    throw Error("Revisa el efectivo y las cuentas iniciales.");
  const copy = clone(s),
    names = new Set();
  copy.walletAccounts = [
    {
      id: "cash",
      name: "Efectivo",
      type: "cash",
      opening: cash,
      openingDate: today(),
      active: true,
      allowedCategories: [],
    },
  ];
  for (const [index, bank] of banks.entries()) {
    const name = bank.name.trim() || (index === 0 ? "Débito" : "");
    if (
      !name ||
      name.length > 80 ||
      names.has(name.toLocaleLowerCase("es-MX")) ||
      !Number.isSafeInteger(bank.balance)
    )
      throw Error(
        "Escribe un nombre distinto y un saldo válido para cada cuenta.",
      );
    names.add(name.toLocaleLowerCase("es-MX"));
    copy.walletAccounts.push({
      id: index === 0 ? "debit" : id(),
      name,
      type: "bank",
      opening: bank.balance,
      openingDate: today(),
      active: true,
      allowedCategories: [],
    });
  }
  copy.income = income;
  copy.started = true;
  refreshAllBudgets(copy);
  validate(copy);
  Object.assign(s, copy);
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
  if (raw?.schemaVersion === 10) return validate(clone(raw));
  if (raw?.schemaVersion === 9)
    return validate({ ...clone(raw), schemaVersion: 10 });
  if (raw?.schemaVersion === 8)
    return validate({ ...clone(raw), schemaVersion: 10, creditCards: [] });
  const old = L.migrate(raw),
    s = clone(old);
  s.schemaVersion = 10;
  s.creditCards = [];
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
function migrateEnvelope(saved) {
  if (!saved) return null;
  if (!Array.isArray(saved.history) || !Number.isInteger(saved.revision || 0))
    throw Error("Historial de guardado inválido.");
  return {
    state: migrate(saved.state),
    history: saved.history.map((h) => ({ ...h, state: migrate(h.state) })),
    revision: saved.revision || 0,
  };
}
function validate(s) {
  if (
    !s ||
    s.schemaVersion !== 10 ||
    !s.settings ||
    !s.budgets ||
    !Number.isSafeInteger(s.income) ||
    s.income < 0
  )
    throw Error("Formato del libro inválido.");
  F.validateFunds(s);
  K.validateCredit(s);
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
      if (r.creditCardId && !s.creditCards.some((c) => c.id === r.creditCardId))
        throw Error("Tarjeta del gasto fijo inválida.");
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
    return old && (isPaid(s, old) || obligationRecorded(s, old.key) > 0)
      ? old
      : { ...i, legacyPaid: i.paid };
  });
  for (const i of prev.items)
    if (
      !items.some((x) => x.key === i.key) &&
      (isPaid(s, i) || obligationRecorded(s, i.key) > 0)
    )
      items.push(i);
  s.budgets[m] = { income: s.income, items };
}
function obligationRecorded(s, key) {
  return (
    s.transactions
      .filter((t) => t.obligation === key)
      .reduce((n, t) => n + t.amount, 0) +
    K.allocations(s)
      .filter((a) => a.obligation === key)
      .reduce((n, a) => n + a.amount, 0)
  );
}
function isPaid(s, i) {
  return (
    !!i.legacyPaid ||
    obligationRecorded(s, i.key) >= i.amount ||
    !!(
      i.kind === "debt" &&
      s.debts.find((d) => d.id === i.ref) &&
      (i.n
        ? s.debts.find((d) => d.id === i.ref).paidPayments.includes(i.n)
        : s.debts.find((d) => d.id === i.ref).paidMonths.includes(i.period))
    )
  );
}
function baseObligations(s, m = month()) {
  return (s.budgets[m]?.items || planned(s, m)).map((i) => {
    const recorded = obligationRecorded(s, i.key),
      paid = isPaid(s, i);
    return {
      ...i,
      paid,
      recorded,
      remaining: paid
        ? 0
        : Math.min(
            Math.max(0, i.amount - recorded),
            i.kind === "debt" &&
              s.debts.find((d) => d.id === i.ref)?.balanceMode === "total"
              ? s.debts.find((d) => d.id === i.ref).balance
              : Infinity,
          ),
    };
  });
}
function creditStatement(s, cardId, period = month()) {
  return K.statement(s, cardId, period, baseObligations(s, period));
}
function obligations(s, m = month()) {
  const ordinary = baseObligations(s, m)
    .filter(
      (i) =>
        !(
          i.kind === "debt" && s.debts.find((d) => d.id === i.ref)?.creditCardId
        ),
    )
    .map((i) => {
      // A fixed expense charged to a card is payable through that card, not twice.
      const charged = s.transactions
        .filter((t) => K.isCreditPurchase(t) && t.obligation === i.key)
        .reduce((n, t) => n + t.amount, 0);
      return {
        ...i,
        amount: i.amount - charged,
        recorded: i.recorded - charged,
      };
    })
    .filter((i) => i.amount > 0);
  return [
    ...ordinary,
    ...s.creditCards
      .map((c) => creditStatement(s, c.id, m))
      .filter((i) => i.amount > 0),
  ];
}
function creditPeriods(s, cardId) {
  const card = s.creditCards.find((c) => c.id === cardId),
    periods = new Set([month()]);
  if (card.openingBalance) periods.add(month(card.openingDueDate));
  for (const t of s.transactions)
    if (K.isCreditPurchase(t) && t.creditCardId === cardId)
      periods.add(month(t.cardDueDate));
  for (const d of s.debts.filter((d) => d.creditCardId === cardId))
    for (let i = 0; i < d.totalPayments; i++)
      periods.add(addMonth(month(d.startDate), i));
  return [...periods].sort();
}
function payCard(s, cardId, period, opts) {
  const statement = creditStatement(s, cardId, period),
    card = s.creditCards.find((c) => c.id === cardId);
  if (!card || card.active === false) throw Error("Tarjeta archivada.");
  const amount = opts.amount ?? statement.remaining,
    date = opts.date || today();
  if (
    !validDate(date) ||
    date > today() ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount >
      (opts.unassigned
        ? K.creditSummary(s, cardId).used
        : Math.min(statement.remaining, K.creditSummary(s, cardId).used))
  )
    throw Error("Revisa la fecha y el importe pendiente de la tarjeta.");
  if (!opts.replay) checkAccountDate(s, opts.accountId, date);
  if (!opts.replay) F.requireFunds(s, opts.accountId, amount, "card_payment");
  else F.requireDestination(s, opts.accountId, "card_payment");
  let left = amount;
  const allocations = [];
  for (const line of opts.unassigned ? [] : statement.lines) {
    const part = Math.min(left, line.remaining);
    if (!part) continue;
    const purchase =
      line.kind === "purchase" && s.transactions.find((t) => t.id === line.ref);
    if (purchase && purchase.date > date)
      throw Error("El pago no puede preceder a la compra.");
    allocations.push({
      kind: line.kind,
      ref: line.ref,
      amount: part,
      ...(line.kind === "debt"
        ? { obligation: line.obligation, period, n: line.n }
        : {}),
    });
    left -= part;
  }
  if (opts.unassigned)
    allocations.push({ kind: "unassigned", ref: cardId, amount });
  else if (left) throw Error("No se pudo distribuir el pago.");
  const t = {
    id: id(),
    kind: "card_payment",
    name: "Pago de tarjeta: " + card.name,
    amount,
    date,
    accountId: opts.accountId,
    creditCardId: cardId,
    period,
    allocations,
  };
  ensureBudget(s, period);
  s.transactions.push(t);
  for (const a of allocations.filter((a) => a.kind === "debt")) {
    const d = s.debts.find((d) => d.id === a.ref),
      line = statement.lines.find((i) => i.obligation === a.obligation);
    d.balance -= a.amount;
    if (a.amount === line.remaining && !d.paidPayments.includes(a.n))
      d.paidPayments.push(a.n);
    if (!d.balance) d.active = false;
  }
  return t;
}
function applyCardCredit(s, cardId, period, amount, target = null) {
  const card = s.creditCards.find((c) => c.id === cardId);
  if (!card) throw Error("Tarjeta no encontrada.");
  const statement = creditStatement(s, cardId, period);
  const lines = target
    ? statement.lines.filter(
        (line) =>
          line.kind === target.kind &&
          line.ref === target.ref &&
          (line.obligation || "") === (target.obligation || ""),
      )
    : statement.lines;
  if (
    !lines.length ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > lines.reduce((n, line) => n + line.remaining, 0) ||
    amount > K.allocated(s, "unassigned", cardId)
  )
    throw Error(
      "El importe supera el abono sin asignar o el periodo pendiente.",
    );
  let left = amount;
  for (const payment of s.transactions.filter(
    (t) => t.kind === "card_payment" && t.creditCardId === cardId,
  )) {
    for (const unapplied of [...payment.allocations].filter(
      (a) => a.kind === "unassigned",
    )) {
      let sourceLeft = Math.min(left, unapplied.amount);
      for (const line of lines) {
        const previously = K.allocated(s, line.kind, line.ref);
        const remaining = Math.max(
          0,
          line.remaining - (previously - line.recorded),
        );
        const part = Math.min(sourceLeft, remaining);
        if (!part) continue;
        const purchase =
          line.kind === "purchase" &&
          s.transactions.find((t) => t.id === line.ref);
        if (purchase && purchase.date > payment.date) continue;
        payment.allocations.push({
          kind: line.kind,
          ref: line.ref,
          amount: part,
          ...(line.kind === "debt"
            ? { obligation: line.obligation, period, n: line.n }
            : {}),
        });
        if (line.kind === "debt") {
          const d = s.debts.find((d) => d.id === line.ref);
          d.balance -= part;
          if (part === remaining && !d.paidPayments.includes(line.n))
            d.paidPayments.push(line.n);
          if (!d.balance) d.active = false;
        }
        unapplied.amount -= part;
        sourceLeft -= part;
        left -= part;
        if (!sourceLeft) break;
      }
      if (!unapplied.amount)
        payment.allocations = payment.allocations.filter(
          (a) => a !== unapplied,
        );
      if (!left) return;
    }
  }
  throw Error(
    "No se pudo aplicar todo el abono a cargos existentes antes de su fecha de pago.",
  );
}
function sameAllocationLine(a, b) {
  return (
    a.kind === b.kind &&
    a.ref === b.ref &&
    (a.obligation || "") === (b.obligation || "") &&
    (a.n || 0) === (b.n || 0)
  );
}
function allocationForLine(line, period, amount) {
  return {
    kind: line.kind,
    ref: line.ref,
    amount,
    ...(line.kind === "debt"
      ? { obligation: line.obligation, period, n: line.n }
      : {}),
  };
}
function allocationLabel(s, a) {
  if (a.kind === "unassigned") return "Abono sin asignar";
  if (a.kind === "opening") return "Saldo anterior de la tarjeta";
  if (a.kind === "purchase")
    return (
      s.transactions.find((t) => t.id === a.ref)?.name || "Compra eliminada"
    );
  if (a.kind === "debt") {
    const d = s.debts.find((d) => d.id === a.ref);
    return `${d?.name || "MSI"} · cuota ${a.n}`;
  }
  return "Cargo";
}
function syncCardInstallment(s, d, n) {
  if (!d || !Number.isInteger(n) || n < 1) return;
  const key = `debt:${d.id}:${n}`,
    period = addMonth(month(d.startDate), n - 1),
    planned =
      s.budgets[period]?.items.find((i) => i.key === key)?.amount ?? d.payment,
    grouped = K.allocations(s)
      .filter((a) => a.obligation === key)
      .reduce((total, a) => total + a.amount, 0),
    direct = s.transactions
      .filter((t) => t.obligation === key)
      .reduce((total, t) => total + t.amount, 0),
    historical = (d.historicalPaidPayments || []).includes(n),
    paid =
      historical ||
      grouped + direct >= planned ||
      (d.balance === 0 && grouped + direct > 0);
  d.paidPayments = d.paidPayments.filter((x) => x !== n);
  if (paid) d.paidPayments.push(n);
  d.paidPayments = [...new Set(d.paidPayments)].sort((a, b) => a - b);
  d.active = d.balance > 0;
  for (const budget of Object.values(s.budgets))
    for (const item of budget.items)
      if (item.kind === "debt" && item.ref === d.id && item.n === n)
        item.legacyPaid = paid;
}
function reverseCardPaymentInPlace(s, txId) {
  const index = s.transactions.findIndex((t) => t.id === txId),
    payment = s.transactions[index];
  if (!payment)
    throw Error("Pago de tarjeta no encontrado. Actualiza la pantalla.");
  if (payment.kind !== "card_payment" || payment.historical)
    throw Error("Solo se pueden corregir pagos de tarjeta registrados.");
  const affected = [];
  for (const a of payment.allocations || []) {
    if (a.kind !== "debt") continue;
    const d = s.debts.find((d) => d.id === a.ref);
    if (!d) continue;
    d.balance += a.amount;
    affected.push([d, a.n]);
  }
  s.transactions.splice(index, 1);
  for (const [d, n] of affected) syncCardInstallment(s, d, n);
  return payment;
}
function appendCardAllocation(s, payment, allocation) {
  const amount = allocation.amount;
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw Error("Cada aplicación del pago necesita un importe mayor a cero.");
  const a = {
    kind: allocation.kind,
    ref: allocation.ref,
    amount,
    ...(allocation.kind === "debt"
      ? {
          obligation: allocation.obligation,
          period: allocation.period,
          n: allocation.n,
        }
      : {}),
  };
  if (a.kind === "purchase") {
    const purchase = s.transactions.find(
      (t) => t.id === a.ref && K.isCreditPurchase(t),
    );
    if (!purchase || purchase.creditCardId !== payment.creditCardId)
      throw Error("La compra ya no pertenece a esta tarjeta.");
    if (purchase.date > payment.date)
      throw Error(
        "El pago no puede ser anterior a la compra que intenta cubrir. Corrige la fecha o mueve ese importe a otro cargo.",
      );
    if (K.allocated(s, "purchase", a.ref) + amount > purchase.amount)
      throw Error(
        `La aplicación supera lo pendiente de «${purchase.name}». Reduce el importe o reasígnalo.`,
      );
  } else if (a.kind === "opening") {
    const card = s.creditCards.find((c) => c.id === payment.creditCardId);
    if (a.ref !== payment.creditCardId || !card)
      throw Error("El saldo anterior no pertenece a esta tarjeta.");
    if (K.allocated(s, "opening", a.ref) + amount > card.openingBalance)
      throw Error("La aplicación supera el saldo anterior pendiente.");
  } else if (a.kind === "unassigned") {
    if (a.ref !== payment.creditCardId)
      throw Error("El abono sin asignar no pertenece a esta tarjeta.");
  } else if (a.kind === "debt") {
    const d = s.debts.find(
      (d) => d.id === a.ref && d.creditCardId === payment.creditCardId,
    );
    if (!d || !Number.isInteger(a.n) || a.n < 1 || a.n > d.totalPayments)
      throw Error("La mensualidad indicada no pertenece a esta tarjeta.");
    if (
      !a.period ||
      addMonth(month(d.startDate), a.n - 1) !== a.period ||
      a.obligation !== `debt:${d.id}:${a.n}`
    )
      throw Error(
        "La mensualidad no coincide con el calendario del MSI. Revisa el cargo de destino.",
      );
    const planned =
      s.budgets[a.period]?.items.find((i) => i.key === a.obligation)?.amount ??
      d.payment;
    const direct = s.transactions
      .filter((t) => t.obligation === a.obligation)
      .reduce((total, t) => total + t.amount, 0);
    const grouped = K.allocations(s)
      .filter((x) => x.obligation === a.obligation)
      .reduce((total, x) => total + x.amount, 0);
    if (direct + grouped + amount > planned)
      throw Error(
        "La mensualidad ya está cubierta o el importe supera su cuota. Reasigna a otra cuota pendiente.",
      );
    if (amount > d.balance)
      throw Error(
        `La aplicación supera el saldo pendiente de «${d.name}». Reduce el importe.`,
      );
    d.balance -= amount;
    payment.allocations.push(a);
    syncCardInstallment(s, d, a.n);
    return;
  } else throw Error("Tipo de aplicación de pago desconocido.");
  payment.allocations.push(a);
}
function trimCardAllocations(allocations, amount) {
  const result = allocations.map((a) => ({ ...a }));
  let excess = result.reduce((total, a) => total + a.amount, 0) - amount;
  if (excess <= 0) return result;
  const order = result
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.kind === "unassigned")
    .concat([...result.map((a, i) => ({ a, i }))].reverse())
    .map(({ i }) => i);
  for (const index of order) {
    if (!excess) break;
    const take = Math.min(excess, result[index].amount);
    result[index].amount -= take;
    excess -= take;
  }
  if (excess) throw Error("No se pudo ajustar el desglose del pago.");
  return result.filter((a) => a.amount > 0);
}
function pendingCardAllocationPeriods(s, cardId, fallback) {
  return [...new Set([fallback, ...creditPeriods(s, cardId)])]
    .filter(Boolean)
    .sort();
}

// Correct a real card payment without reverting unrelated payments. The amount can
// change; existing distributions are preserved where possible, and any extra is
// applied to pending charges (or recorded as unassigned) so cash and debt stay
// consistent. `allocations` allows an explicit guided redistribution.
function correctCardPayment(s, txId, value = {}) {
  const copy = clone(s),
    original = copy.transactions.find((t) => t.id === txId);
  if (!original) throw Error("Pago de tarjeta no encontrado.");
  if (original.kind !== "card_payment" || original.historical)
    throw Error("Solo se pueden corregir pagos de tarjeta registrados.");
  const card = copy.creditCards.find((c) => c.id === original.creditCardId);
  if (!card) throw Error("Tarjeta no encontrada.");
  const amount = value.amount ?? original.amount,
    date = value.date ?? original.date,
    accountId = value.accountId ?? original.accountId;
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !validDate(date) ||
    date > today()
  )
    throw Error("Revisa la fecha y el importe del pago.");
  if (
    !copy.walletAccounts.some(
      (a) => a.id === accountId && a.active !== false,
    ) ||
    copy.walletAccounts.find((a) => a.id === accountId)?.type === "restricted"
  )
    throw Error("Elige una cuenta libre y activa para el pago.");
  let desired;
  if (value.allocations !== undefined) {
    if (!Array.isArray(value.allocations))
      throw Error("El desglose corregido no es válido.");
    desired = value.allocations.map((a) => ({ ...a }));
    if (
      desired.reduce((total, a) => total + (a.amount || 0), 0) !== amount ||
      desired.some(
        (a) =>
          !a ||
          !Number.isSafeInteger(a.amount) ||
          a.amount <= 0 ||
          !["purchase", "opening", "unassigned", "debt"].includes(a.kind),
      )
    )
      throw Error(
        "El desglose corregido debe sumar exactamente el importe del pago.",
      );
  } else if (amount <= original.amount) {
    desired = trimCardAllocations(original.allocations || [], amount);
  } else {
    desired = (original.allocations || []).map((a) => ({ ...a }));
  }
  for (const a of desired.filter((a) => a.kind === "purchase")) {
    const purchase = copy.transactions.find((t) => t.id === a.ref);
    if (purchase && purchase.date > date)
      throw Error(
        "La nueva fecha es anterior a una compra cubierta por este pago. Reasigna ese importe antes de cambiar la fecha.",
      );
  }

  const index = copy.transactions.findIndex((t) => t.id === txId);
  reverseCardPaymentInPlace(copy, txId);
  const payment = {
    ...original,
    amount,
    date,
    accountId,
    allocations: [],
  };
  copy.transactions.splice(
    Math.min(index, copy.transactions.length),
    0,
    payment,
  );
  for (const a of desired) appendCardAllocation(copy, payment, a);

  let left = amount - payment.allocations.reduce((n, a) => n + a.amount, 0);
  if (left > 0) {
    for (const period of pendingCardAllocationPeriods(
      copy,
      card.id,
      original.period,
    )) {
      while (left > 0) {
        const statement = creditStatement(copy, card.id, period),
          line = statement.lines.find((i) => {
            if (!i.remaining) return false;
            if (i.kind !== "purchase") return true;
            const purchase = copy.transactions.find((t) => t.id === i.ref);
            return !purchase || purchase.date <= date;
          });
        if (!line) break;
        const part = Math.min(left, line.remaining);
        appendCardAllocation(
          copy,
          payment,
          allocationForLine(line, period, part),
        );
        left -= part;
      }
      if (!left) break;
    }
  }
  if (left > 0) {
    const used = K.creditSummary(copy, card.id).used;
    if (left > used)
      throw Error(
        "El importe supera la deuda usada de la tarjeta. Revisa el total del estado de cuenta.",
      );
    appendCardAllocation(copy, payment, {
      kind: "unassigned",
      ref: card.id,
      amount: left,
    });
    left = 0;
  }
  if (left) throw Error("No se pudo distribuir el pago corregido.");
  checkAccountDate(copy, accountId, date);
  F.requireFunds(copy, accountId, amount, "card_payment");
  validate(copy);
  Object.assign(s, copy);
  return s.transactions.find((t) => t.id === txId);
}
function cardPaymentInfo(s, txId) {
  const payment = s.transactions.find((t) => t.id === txId);
  if (!payment || payment.kind !== "card_payment")
    throw Error("Pago de tarjeta no encontrado.");
  return {
    ...payment,
    allocations: payment.allocations.map((a, index) => ({
      ...a,
      index,
      label: allocationLabel(s, a),
    })),
  };
}
function cardPaymentTargets(s, txId) {
  const payment = s.transactions.find((t) => t.id === txId);
  if (!payment || payment.kind !== "card_payment")
    throw Error("Pago de tarjeta no encontrado.");
  const copy = clone(s);
  reverseCardPaymentInPlace(copy, txId);
  const targets = [];
  for (const period of pendingCardAllocationPeriods(
    copy,
    payment.creditCardId,
    payment.period,
  )) {
    const statement = creditStatement(copy, payment.creditCardId, period);
    for (const line of statement.lines) {
      if (!line.remaining) continue;
      if (
        line.kind === "purchase" &&
        copy.transactions.find((t) => t.id === line.ref)?.date > payment.date
      )
        continue;
      const already = payment.allocations
          .filter((a) => sameAllocationLine(a, line))
          .reduce((total, a) => total + a.amount, 0),
        remaining = line.remaining - already;
      if (remaining <= 0) continue;
      targets.push({
        ...allocationForLine(line, period, 0),
        label: `${allocationLabel(copy, line)}${line.kind === "debt" ? ` · ${period}` : ""}`,
        remaining,
        period,
      });
    }
  }
  const used = K.creditSummary(copy, payment.creditCardId).used,
    alreadyUnassigned = payment.allocations
      .filter((a) => a.kind === "unassigned")
      .reduce((total, a) => total + a.amount, 0);
  if (used - alreadyUnassigned > 0)
    targets.push({
      kind: "unassigned",
      ref: payment.creditCardId,
      label: "Dejar como abono sin asignar",
      remaining: used - alreadyUnassigned,
    });
  return targets;
}
function reassignCardPayment(s, txId, { from, to, amount }) {
  const payment = s.transactions.find((t) => t.id === txId);
  if (!payment || payment.kind !== "card_payment")
    throw Error("Pago de tarjeta no encontrado.");
  const source = payment.allocations[Number(from)];
  if (!source || !Number.isSafeInteger(amount) || amount <= 0)
    throw Error("Elige el importe y el cargo de origen.");
  if (amount > source.amount)
    throw Error("No puedes mover más de lo que este pago tiene en ese cargo.");
  if (!to || sameAllocationLine(source, to))
    throw Error("Elige un cargo de destino distinto.");
  const allocations = payment.allocations.map((a) => ({ ...a }));
  if (allocations[Number(from)].amount === amount)
    allocations.splice(Number(from), 1);
  else allocations[Number(from)].amount -= amount;
  const existing = allocations.find((a) => sameAllocationLine(a, to));
  if (existing) existing.amount += amount;
  else
    allocations.push({
      kind: to.kind,
      ref: to.ref,
      amount,
      ...(to.kind === "debt"
        ? { obligation: to.obligation, period: to.period, n: to.n }
        : {}),
    });
  return correctCardPayment(s, txId, {
    amount: payment.amount,
    date: payment.date,
    accountId: payment.accountId,
    allocations,
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
      items.filter((i) => ["debt", "card_payment"].includes(i.kind)),
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
      tx.filter(
        (t) =>
          ["expense", "fixed", "debt", "card_payment"].includes(t.kind) &&
          !K.isCreditPurchase(t),
      ),
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
    item = baseObligations(s, m).find((i) => i.key === key);
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
  if (d?.creditCardId)
    throw Error("Paga esta mensualidad junto con su tarjeta.");
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
    accountId: opts.creditCardId ? null : opts.accountId || "debit",
    ...(opts.creditCardId ? { creditCardId: opts.creditCardId } : {}),
    categoryId: item.categoryId || opts.categoryId || "",
    obligation: key,
    ref: item.ref,
    period: m,
    principal: reduction,
  };
  checkMovement(s, t, opts.replay);
  ensureBudget(s, m);
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
function checkAccountDate(s, accountId, date) {
  const account = s.walletAccounts.find((a) => a.id === accountId);
  if (account?.openingDate && date < account.openingDate)
    throw Error(
      `La fecha es anterior al saldo inicial de ${account.name} (${account.openingDate}). Ese saldo ya incluye lo anterior; no vuelvas a descontarlo.`,
    );
}
function checkMovement(s, t, replay = false) {
  if (Number.isSafeInteger(t.amount) && t.amount <= 0)
    throw Error("El importe debe ser mayor que cero.");
  if (
    !t.name?.trim() ||
    !Number.isSafeInteger(t.amount) ||
    t.amount <= 0 ||
    !validDate(t.date) ||
    t.date > today()
  )
    throw Error("Revisa concepto, importe y fecha real.");
  if (!replay && !t.historical) {
    for (const accountId of [t.accountId, t.toAccountId].filter(Boolean)) {
      checkAccountDate(s, accountId, t.date);
    }
  }
  if (K.isCreditPurchase(t)) {
    const c = K.creditSummary(s, t.creditCardId);
    if (c.active === false || t.accountId || t.historical)
      throw Error("Elige una tarjeta activa sin cuenta de débito como origen.");
    if (!replay && t.amount > c.available)
      throw Error("La compra supera el crédito disponible.");
    t.cardDueDate = t.cardDueDate || K.creditDueDate(c, t.date);
    if (!validDate(t.cardDueDate) || t.cardDueDate < t.date)
      throw Error("Vencimiento de tarjeta inválido.");
    return;
  }
  if (t.kind === "debt" && s.debts.find((d) => d.id === t.ref)?.creditCardId)
    throw Error(
      "Paga las compras a meses desde el pago agrupado de su tarjeta.",
    );
  if (t.creditCardId || t.kind === "card_payment")
    throw Error("Usa el pago agrupado de tarjeta.");
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
    if (!destination) throw Error("Destino de transferencia no permitido.");
    if (!replay) F.requireDestination(s, t.toAccountId, "transfer");
  }
  if (["loan_out", "loan_in"].includes(t.kind)) {
    const l = s.receivables.find((l) => l.id === t.ref);
    if (!l || l.archived) throw Error("Préstamo no disponible.");
    if (t.kind === "loan_in" && t.amount > F.loanBalance(s, l.id))
      throw Error("El cobro supera el saldo pendiente.");
    if (!replay) assertLoanTimeline(s, l.id, t);
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
// Correct the receivable itself without inventing or deleting cash. The opening
// amount is an antecedent already reflected in the account, so editing it only
// changes what is still owed. A collection or loan movement is corrected in place
// and checked against the remaining balance and the real account.
function loanTimeline(s, loanId, candidate) {
  const loan = s.receivables.find((entry) => entry.id === loanId);
  const byDate = new Map();
  for (const movement of [
    ...s.transactions,
    ...(candidate ? [candidate] : []),
  ]) {
    if (
      movement.ref !== loanId ||
      !["loan_in", "loan_out"].includes(movement.kind)
    )
      continue;
    byDate.set(
      movement.date,
      (byDate.get(movement.date) || 0) +
        (movement.kind === "loan_out" ? movement.amount : -movement.amount),
    );
  }
  return { opening: loan.opening, byDate };
}

function chronologyError(date) {
  return Error(
    `El cobro del ${date} quedaría antes del dinero prestado o superaría lo pendiente en esa fecha. Corrige la fecha o el movimiento correspondiente.`,
  );
}

function assertLoanTimeline(s, loanId, candidate) {
  const timeline = loanTimeline(s, loanId, candidate);
  // No time-of-day is recorded, so same-day movements are grouped.
  let pending = timeline.opening;
  for (const date of [...timeline.byDate.keys()].sort()) {
    pending += timeline.byDate.get(date);
    if (pending < 0) throw chronologyError(date);
  }
}

function assertLoanTimelineChange(before, after, loanId) {
  const old = loanTimeline(before, loanId),
    next = loanTimeline(after, loanId);
  let oldBalance = old.opening,
    nextBalance = next.opening;
  for (const date of [
    ...new Set([...old.byDate.keys(), ...next.byDate.keys()]),
  ].sort()) {
    oldBalance += old.byDate.get(date) || 0;
    nextBalance += next.byDate.get(date) || 0;
    // Legacy defects can be repaired one at a time. Never introduce a new
    // negative interval or increase an existing deficit at any date.
    if (Math.min(0, nextBalance) < Math.min(0, oldBalance))
      throw chronologyError(date);
  }
}

function loanTimelineIssue(s, loanId) {
  try {
    assertLoanTimeline(s, loanId);
    return "";
  } catch (error) {
    return error.message;
  }
}

function editLoan(s, loanId, value = {}) {
  const copy = clone(s),
    loan = copy.receivables.find((l) => l.id === loanId);
  if (!loan) throw Error("Préstamo no encontrado.");
  const person = String(value.person ?? loan.person).trim(),
    name = String(value.name ?? loan.name).trim(),
    dueDate =
      value.dueDate === undefined ? loan.dueDate : value.dueDate || null,
    opening =
      value.opening === undefined ? loan.opening : Number(value.opening);
  if (!person || person.length > 100 || !name || name.length > 120)
    throw Error("Escribe la persona y un concepto de hasta 120 caracteres.");
  if (dueDate && !validDate(dueDate))
    throw Error("Revisa la fecha de vencimiento del préstamo.");
  if (!Number.isSafeInteger(opening) || opening < 0)
    throw Error("El antecedente del préstamo debe ser un importe válido.");
  const other = F.loanBalance(copy, loanId) - loan.opening;
  if (other + opening < 0)
    throw Error(
      "Ese antecedente es menor que los cobros ya registrados. El préstamo quedaría con saldo negativo; corrige primero el cobro que corresponda.",
    );
  Object.assign(loan, { person, name, dueDate, opening });
  assertLoanTimelineChange(s, copy, loanId);
  validate(copy);
  Object.assign(s, copy);
  return s.receivables.find((l) => l.id === loanId);
}
function editLoanMovement(s, txId, value = {}) {
  const copy = clone(s),
    index = copy.transactions.findIndex((t) => t.id === txId),
    original = copy.transactions[index];
  if (!original) throw Error("Movimiento de préstamo no encontrado.");
  if (!["loan_in", "loan_out"].includes(original.kind) || original.historical)
    throw Error("Solo se pueden corregir préstamos y cobros registrados.");
  const loan = copy.receivables.find((l) => l.id === original.ref);
  if (!loan) throw Error("Préstamo no encontrado.");
  const amount = value.amount ?? original.amount,
    date = value.date ?? original.date,
    accountId = value.accountId ?? original.accountId,
    name = String(value.name ?? original.name).trim();
  if (!name || !Number.isSafeInteger(amount) || amount <= 0)
    throw Error("Revisa el concepto y el importe del movimiento.");
  if (!validDate(date) || date > today())
    throw Error("La fecha real del movimiento no puede ser futura.");
  const account = copy.walletAccounts.find(
    (a) => a.id === accountId && a.active !== false,
  );
  if (!account) throw Error("Elige una cuenta activa.");
  checkAccountDate(copy, accountId, date);
  copy.transactions.splice(index, 1);
  if (original.kind === "loan_in") {
    if (amount > F.loanBalance(copy, loan.id))
      throw Error(
        "El cobro corregido supera el saldo pendiente del préstamo. Revisa el importe o corrige otro cobro primero.",
      );
    F.requireDestination(copy, accountId, "loan_in");
  } else F.requireFunds(copy, accountId, amount, "loan_out");
  const projected =
    F.loanBalance(copy, loan.id) +
    (original.kind === "loan_out" ? amount : -amount);
  if (projected < 0)
    throw Error(
      "La corrección dejaría el préstamo con saldo negativo porque ya hay cobros mayores que el dinero prestado. Corrige primero el cobro que corresponda.",
    );
  const next = {
    ...original,
    name,
    amount,
    date,
    accountId,
  };
  copy.transactions.splice(Math.min(index, copy.transactions.length), 0, next);
  assertLoanTimelineChange(s, copy, loan.id);
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
      "La corrección dejaría saldo insuficiente o usaría dinero reservado. Ajusta la cuenta antes de corregir este movimiento.",
    );
  validate(copy);
  Object.assign(s, copy);
  return s.transactions.find((t) => t.id === txId);
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
    F.requireFunds(
      s,
      t.toAccountId,
      t.amount,
      s.walletAccounts.find((a) => a.id === t.toAccountId)?.type ===
        "restricted"
        ? "reversal"
        : "transfer",
    );
  if (t.kind === "loan_out" && F.loanBalance(s, t.ref) < t.amount)
    throw Error("Revierte primero los cobros asociados.");
  if (K.isCreditPurchase(t) && K.allocated(s, "purchase", t.id))
    throw Error(
      "Revierte primero los pagos de tarjeta que cubren esta compra.",
    );
  if (t.kind === "card_payment") {
    for (const a of t.allocations.filter((a) => a.kind === "debt")) {
      const d = s.debts.find((d) => d.id === a.ref);
      d.balance += a.amount;
      d.active = true;
      d.paidPayments = d.paidPayments.filter(
        (n) => n !== a.n || d.historicalPaidPayments.includes(n),
      );
    }
  }
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
  if (K.isCreditPurchase(original) && K.allocated(s, "purchase", original.id))
    throw Error("Revierte primero los pagos que cubren esta compra.");
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
  K.validateCredit(copy);
  s.transactions = s.transactions.map((t) =>
    t.id === idTx ? copy.transactions.find((x) => x.id === idTx) : t,
  );
}
function editFixedPayment(s, idTx, value) {
  const old = s.transactions.find((t) => t.id === idTx);
  if (!old || old.kind !== "fixed") throw Error("Pago fijo no encontrado.");
  const copy = clone(s);
  const paidByCard = K.allocated(copy, "purchase", idTx);
  if (
    paidByCard &&
    (value.creditCardId !== old.creditCardId || value.amount < paidByCard)
  )
    throw Error(
      "Este cargo ya tiene pagos de tarjeta. Conserva la tarjeta y un importe no menor a lo pagado, o corrige primero ese pago desde Movimientos.",
    );
  const due = ensureBudget(copy, old.period).items.find(
    (i) => i.key === old.obligation,
  );
  if (!due) throw Error("No se encontró el vencimiento de este pago.");
  copy.transactions = copy.transactions.filter((t) => t.id !== idTx);
  due.amount = Math.max(
    due.amount,
    value.amount + obligationRecorded(copy, due.key),
  );
  const next = {
    ...old,
    ...value,
    kind: "fixed",
    id: idTx,
    ref: old.ref,
    obligation: old.obligation,
    period: old.period,
  };
  if (next.creditCardId !== old.creditCardId) delete next.cardDueDate;
  if (!next.creditCardId) delete next.creditCardId;
  checkMovement(copy, next);
  copy.transactions.push(next);
  const before = F.accountSummary(s);
  if (
    F.accountSummary(copy).some(
      (a) =>
        a.available < Math.min(0, before.find((b) => b.id === a.id).available),
    ) ||
    F.available(copy) < Math.min(0, F.available(s))
  )
    throw Error(
      "La corrección dejaría saldo insuficiente o utilizaría reservas.",
    );
  validate(copy);
  s.transactions = s.transactions.map((t) => (t.id === idTx ? next : t));
  s.budgets = copy.budgets;
}
function setPriorPayments(s, d, count) {
  if (!Number.isInteger(count) || count < 0 || count > d.totalPayments)
    throw Error("Revisa las cuotas pagadas antes del registro.");
  if (d.creditCardId && K.allocations(s).some((a) => a.ref === d.id))
    throw Error(
      "No cambies antecedentes mientras existan pagos de tarjeta asociados.",
    );
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

// Edit the plan, not the money that has already changed hands. Paid occurrences
// stay in budget snapshots, including payments made ahead of their due date.
function updateFixed(s, idFixed, value, rule) {
  const copy = clone(s);
  let f = copy.fixedExpenses.find((x) => x.id === idFixed);
  if (!f) {
    f = { id: idFixed || id(), rules: [] };
    copy.fixedExpenses.push(f);
  }
  if (!value.name?.trim()) throw Error("Escribe un nombre.");
  // Old books and direct domain callers may have paid without persisting the
  // month's schedule. Capture it before replacing any recurrence rules.
  for (const t of copy.transactions.filter(
    (t) => t.ref === f.id && t.obligation,
  ))
    ensureBudget(copy, t.period || month(t.date));
  const requested = rule.effectiveFrom;
  const previous = R.rulesFor(f);
  let effectiveFrom = requested;
  if (rule.active !== false) {
    const paidDates = Object.values(copy.budgets)
      .flatMap((budget) => budget.items)
      .filter(
        (i) =>
          i.kind === "fixed" &&
          i.ref === f.id &&
          (isPaid(copy, i) || obligationRecorded(copy, i.key) > 0),
      )
      .map((i) => i.date);
    for (const t of copy.transactions.filter(
      (t) => t.ref === f.id && t.obligation,
    )) {
      const due = (
        copy.budgets[t.period]?.items ||
        R.occurrences(f, t.period || month(t.date))
      ).find((i) => i.key === t.obligation);
      paidDates.push(due?.date || t.date);
    }
    for (const date of paidDates) {
      if (date >= effectiveFrom) {
        const next = new Date(date + "T12:00:00Z");
        next.setUTCDate(next.getUTCDate() + 1);
        effectiveFrom = next.toISOString().slice(0, 10);
      }
    }
  }
  const nextRule = { ...rule, effectiveFrom, id: id() };
  R.validateRule(nextRule);
  f.rules = [
    ...previous.filter((r) => r.effectiveFrom < effectiveFrom),
    nextRule,
  ];
  Object.assign(f, value, {
    amount: rule.amount,
    categoryId: rule.categoryId || "",
    creditCardId: rule.creditCardId || "",
    active: rule.active !== false,
  });
  refreshAllBudgets(copy);
  validate(copy);
  Object.assign(s, copy);
  return effectiveFrom;
}

function saveCreditCard(s, cardId, value, installments = []) {
  const copy = clone(s),
    existing = copy.creditCards.find((c) => c.id === cardId),
    targetId = existing?.id || id();
  if (cardId && !existing) throw Error("Tarjeta no encontrada.");
  const card = existing || { id: targetId, openingBalance: 0, active: true };
  if (!existing) copy.creditCards.push(card);
  Object.assign(card, {
    name: value.name.trim(),
    limit: value.limit,
    closingDay: value.closingDay,
    paymentDay: value.paymentDay,
    openingDueDate: value.openingDueDate,
  });
  const seen = new Set();
  for (const input of installments) {
    if (input.id && seen.has(input.id)) throw Error("MSI duplicado.");
    seen.add(input.id);
    let d = input.id && copy.debts.find((d) => d.id === input.id);
    if (input.id && (!d || d.creditCardId !== targetId))
      throw Error("El MSI no pertenece a esta tarjeta.");
    const fields = {
      name: input.name.trim(),
      balance: input.balance,
      payment: input.payment,
      totalPayments: input.totalPayments,
      startDate: input.startDate,
      dueDay: input.dueDay,
    };
    if (!fields.name || fields.payment <= 0 || fields.totalPayments <= 0)
      throw Error("Completa el nombre, mensualidad y plazo de cada MSI.");
    const paid =
      d &&
      (copy.transactions.some((t) => t.ref === d.id) ||
        K.allocations(copy).some((a) => a.ref === d.id));
    const scheduleChanged =
      !d ||
      ["balance", "payment", "totalPayments"].some((k) => fields[k] !== d[k]) ||
      input.priorPaid !== (d.historicalPaidPayments || []).length;
    if (scheduleChanged) {
      const actualPaid = (d?.paidPayments || []).filter(
        (n) => !(d.historicalPaidPayments || []).includes(n),
      ).length;
      K.validateInstallmentPlan(fields, input.priorPaid, actualPaid);
    }
    if (
      paid &&
      (Object.keys(fields)
        .filter((k) => k !== "name")
        .some((k) => fields[k] !== d[k]) ||
        input.priorPaid !== (d.historicalPaidPayments || []).length)
    )
      throw Error(
        `El MSI «${d.name}» tiene pagos registrados. Sus importes y calendario se conservan; puedes cambiar su nombre.`,
      );
    if (!d) {
      d = {
        id: id(),
        creditorId: "",
        type: "msi",
        creditCardId: targetId,
        balanceMode: "total",
        originalAmount: Math.max(
          input.balance,
          input.payment * input.totalPayments,
        ),
        financingCost: 0,
        annualRate: 0,
        notes: "",
        historicalPaidPayments: [],
        paidPayments: [],
        paidMonths: [],
        active: true,
        archived: false,
      };
      copy.debts.push(d);
    }
    Object.assign(d, fields, { active: fields.balance > 0 });
    if (!paid) setPriorPayments(copy, d, input.priorPaid);
  }
  const summary = K.creditSummary(copy, targetId),
    openingPaid = K.allocated(copy, "opening", targetId),
    purchases = summary.purchases - card.openingBalance + openingPaid;
  const opening =
    value.totalBalance - summary.installments - purchases + summary.unassigned;
  if (!Number.isSafeInteger(opening) || opening < 0)
    throw Error(
      "El saldo total no puede ser menor que los MSI y las compras pendientes, descontando los abonos. Revisa el saldo total de tu banco.",
    );
  card.openingBalance = opening + openingPaid;
  refreshAllBudgets(copy);
  validate(copy);
  Object.assign(s, copy);
  return targetId;
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
  for (const c of s.creditCards)
    for (const m of creditPeriods(s, c.id)) months.add(m);
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
  startLedger,
  validate,
  migrate,
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
  editFixedPayment,
  updateFixed,
  saveCreditCard,
  setPriorPayments,
  snapshot,
  ledgerEntries,
  ledgerHistory,
  reminders,
  ...K,
  creditStatement,
  creditPeriods,
  payCard,
  applyCardCredit,
  correctCardPayment,
  cardPaymentInfo,
  cardPaymentTargets,
  reassignCardPayment,
  editLoan,
  loanTimelineIssue,
  editLoanMovement,
  baseObligations,
  ...F,
  ...R,
};
