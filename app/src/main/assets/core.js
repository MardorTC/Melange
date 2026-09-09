/* ProjectOSP — amounts are integer MXN cents. No network dependencies. */
(function (root) {
  "use strict";
  const id = () =>
    globalThis.crypto?.randomUUID?.() ||
    "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const cents = (x) => {
    const n = Number(x);
    if (!Number.isFinite(n) || Math.abs(n) > 1e12)
      throw Error("Importe inválido");
    return Math.round(n * 100);
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const month = (date = today()) => date.slice(0, 7);
  const addMonth = (m, n) => {
    let [y, k] = m.split("-").map(Number);
    const d = new Date(y, k - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const dueDate = (m, day) => {
    const [y, k] = m.split("-").map(Number),
      last = new Date(y, k, 0).getDate();
    return `${m}-${String(Math.max(1, Math.min(Number(day) || 1, last))).padStart(2, "0")}`;
  };
  const validDate = (s) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number(s.slice(0, 4)) >= 1900 &&
    Number(s.slice(5, 7)) >= 1 &&
    Number(s.slice(5, 7)) <= 12 &&
    dueDate(s.slice(0, 7), Number(s.slice(8))) === s;
  function empty() {
    return {
      schemaVersion: 7,
      id: id(),
      created: today(),
      opening: { cash: 0, debit: 0 },
      income: 0,
      accounts: [],
      categories: [
        "Alimentación",
        "Transporte",
        "Hogar",
        "Salud",
        "Ocio",
        "Compras",
        "Trabajo",
        "Otros",
      ].map((name) => ({ id: id(), name })),
      fixedExpenses: [],
      debts: [],
      transactions: [],
      goals: [],
      liquidityHistory: [],
      budgets: {},
      settings: { reminders: false, reminderDays: 2 },
      migration: null,
    };
  }
  function validate(s) {
    if (!s || s.schemaVersion !== 7 || !s.opening || !s.settings || !s.budgets)
      throw Error("El respaldo no tiene un formato compatible.");
    if (
      s.reconstruction &&
      (s.reconstruction.basis !== "ledger" ||
        !validDate(s.reconstruction.startDate) ||
        s.reconstruction.startDate > today())
    )
      throw Error("El punto de partida de la reconstrucción es inválido.");
    for (const k of [
      "accounts",
      "categories",
      "fixedExpenses",
      "debts",
      "transactions",
      "goals",
      "liquidityHistory",
    ])
      if (!Array.isArray(s[k])) throw Error("Falta la colección " + k);
    const integer = (n) => Number.isSafeInteger(n) && Math.abs(n) <= 1e14;
    if (
      !integer(s.opening.cash) ||
      !integer(s.opening.debit) ||
      !integer(s.income) ||
      s.income < 0
    )
      throw Error("Saldos o ingreso inválidos.");
    for (const k of [
      "accounts",
      "categories",
      "fixedExpenses",
      "debts",
      "transactions",
      "goals",
    ]) {
      const ids = new Set();
      for (const x of s[k]) {
        if (
          !x ||
          typeof x.id !== "string" ||
          typeof x.name !== "string" ||
          !x.name.trim() ||
          ids.has(x.id)
        )
          throw Error("Identificadores inválidos o repetidos en " + k);
        ids.add(x.id);
      }
    }
    for (const x of s.transactions) {
      if (
        s.reconstruction &&
        !x.historical &&
        (!validDate(s.reconstruction.startDate) ||
          x.date < s.reconstruction.startDate ||
          x.date > today())
      )
        throw Error("El movimiento queda fuera del periodo reconstruido.");
      if (
        !integer(x.amount) ||
        x.amount < 0 ||
        !validDate(x.date) ||
        ![
          "expense",
          "debt",
          "fixed",
          "income",
          "transfer",
          "adjustment",
        ].includes(x.kind) ||
        !["cash", "debit"].includes(x.method)
      )
        throw Error("Movimiento inválido.");
      if (
        x.kind === "transfer" &&
        (!["cash", "debit"].includes(x.to) || x.to === x.method)
      )
        throw Error("Destino inválido.");
      if (x.kind === "adjustment" && ![1, -1].includes(x.direction))
        throw Error("Ajuste inválido.");
      if (
        x.kind === "debt" &&
        (!integer(x.principal) || x.principal < 0 || x.principal > x.amount)
      )
        throw Error("Reducción de saldo inválida.");
    }
    for (const d of s.debts) {
      if (
        !integer(d.balance) ||
        d.balance < 0 ||
        !integer(d.payment) ||
        d.payment < 0 ||
        !integer(d.originalAmount) ||
        !Number.isInteger(d.totalPayments) ||
        d.totalPayments < 0 ||
        d.totalPayments > 1200 ||
        !Array.isArray(d.paidPayments) ||
        d.paidPayments.some((n) => !Number.isInteger(n) || n < 1) ||
        new Set(d.paidPayments).size !== d.paidPayments.length ||
        !Array.isArray(d.paidMonths) ||
        (d.startDate && !validDate(d.startDate))
      )
        throw Error("Deuda inválida.");
    }
    for (const f of s.fixedExpenses)
      if (!integer(f.amount) || f.amount < 0)
        throw Error("Gasto fijo inválido.");
    for (const g of s.goals)
      if (
        !integer(g.balance) ||
        !integer(g.target) ||
        g.balance < 0 ||
        g.target < 0
      )
        throw Error("Meta inválida.");
    for (const h of s.liquidityHistory)
      if (!validDate(h.date) || !integer(h.value))
        throw Error("Histórico inválido.");
    for (const b of Object.values(s.budgets)) {
      if (
        !b ||
        !Array.isArray(b.items) ||
        !integer(b.income) ||
        b.items.some(
          (i) => !integer(i.amount) || i.amount < 0 || !validDate(i.date),
        )
      )
        throw Error("Presupuesto inválido.");
    }
    return s;
  }
  function migrate(raw) {
    if (raw?.format === "projectosp-backup" && raw.state) raw = raw.state;
    if (raw?.schemaVersion === 7) return validate(clone(raw));
    if (
      !raw ||
      !Array.isArray(raw.debts) ||
      !Array.isArray(raw.expenses) ||
      !raw.balances ||
      !Array.isArray(raw.accounts) ||
      !Array.isArray(raw.categories)
    )
      throw Error("No es un respaldo de ProjectOSP.");
    const s = empty();
    s.opening = {
      cash: cents(raw.balances.cash || 0),
      debit: cents(raw.balances.debit || 0),
    };
    s.income = cents(raw.income || 0);
    s.accounts = clone(raw.accounts);
    s.categories = clone(raw.categories);
    s.fixedExpenses = (raw.fixedExpenses || []).map((f) => ({
      ...f,
      amount: cents(f.amount),
      startMonth: month(),
      active: f.active !== false,
    }));
    s.debts = raw.debts.map((d) => ({
      ...d,
      originalAmount: cents(d.originalAmount || 0),
      balance: cents(d.balance || 0),
      payment: cents(d.payment || d.monthlyPayment || 0),
      financingCost: cents(d.financingCost || 0),
      totalPayments: Number(d.totalPayments) || 0,
      paidPayments: [...(d.paidPayments || [])],
      paidMonths: [],
      balanceMode: "total",
      archived: d.active === false && Number(d.balance) > 0,
      active: d.active !== false,
      startDate: d.startDate || null,
    }));
    s.transactions = raw.expenses.map((e) => ({
      ...e,
      kind: "expense",
      amount: cents(e.amount),
      method: e.method === "Efectivo" ? "cash" : "debit",
      historical: true,
      legacy: true,
    }));
    s.liquidityHistory = (raw.liquidityHistory || []).map((h) => ({
      ...h,
      value: cents(h.value),
      observed: true,
    }));
    if (raw.emergencyFund)
      s.goals.push({
        id: id(),
        name: "Fondo de emergencia",
        balance: cents(raw.emergencyFund.balance || 0),
        target: cents(raw.emergencyFund.target || 0),
        emergency: true,
        date: null,
        legacy: true,
      });
    s.migration = {
      from: 6,
      date: today(),
      paidInstallments: s.debts.reduce((a, d) => a + d.paidPayments.length, 0),
      note: "Los saldos importados son el punto de partida. Los gastos anteriores y las cuotas históricas no vuelven a descontarse.",
    };
    ensureBudget(s, month());
    return validate(s);
  }
  function balances(s) {
    const out = { ...s.opening };
    for (const t of s.transactions) {
      if (t.historical) continue;
      const a = t.amount;
      if (["expense", "debt", "fixed"].includes(t.kind)) out[t.method] -= a;
      else if (t.kind === "income") out[t.method] += a;
      else if (t.kind === "adjustment")
        out[t.method] += t.direction === -1 ? -a : a;
      else if (t.kind === "transfer") {
        out[t.method] -= a;
        out[t.to] += a;
      }
    }
    return out;
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
    let items = s.debts.map((d) => schedule(d, m)).filter(Boolean);
    for (const f of s.fixedExpenses)
      if (
        f.active !== false &&
        (!f.startMonth || m >= f.startMonth) &&
        (!f.endMonth || m <= f.endMonth)
      )
        items.push({
          key: `fixed:${f.id}:${m}`,
          ref: f.id,
          period: m,
          kind: "fixed",
          name: f.name,
          amount: f.amount,
          date: dueDate(m, f.dueDay),
          paid: false,
        });
    return items;
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
    const b = balances(s),
      items = obligations(s, m),
      income = s.budgets[m]?.income ?? s.income,
      tx = s.transactions.filter((t) => month(t.date) === m);
    const fixed = items
        .filter((i) => i.kind === "fixed")
        .reduce((a, i) => a + i.amount, 0),
      debt = items
        .filter((i) => i.kind === "debt")
        .reduce((a, i) => a + i.amount, 0),
      pending = items.reduce((a, i) => a + i.remaining, 0);
    const paid = items.reduce(
      (a, i) =>
        a + (i.legacyPaid ? i.amount : i.recorded || (i.paid ? i.amount : 0)),
      0,
    );
    const consumption = tx
        .filter((t) => ["expense", "fixed"].includes(t.kind))
        .reduce((a, t) => a + t.amount, 0),
      outflow = tx
        .filter((t) => ["expense", "fixed", "debt"].includes(t.kind))
        .reduce((a, t) => a + t.amount, 0);
    const received = tx
        .filter((t) => t.kind === "income")
        .reduce((a, t) => a + t.amount, 0),
      reserved = s.goals.reduce((a, g) => a + g.balance, 0);
    return {
      cash: b.cash,
      debit: b.debit,
      liquidity: b.cash + b.debit,
      reserved,
      available: b.cash + b.debit - reserved,
      income,
      fixed,
      debt,
      pending,
      paid,
      budgetFree: income - fixed - debt,
      consumption,
      outflow,
      received,
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
      method: opts.method || "debit",
      categoryId: opts.categoryId || "",
      obligation: key,
      ref: item.ref,
      period: m,
      principal: reduction,
    };
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
  function record(s, t) {
    if (
      !t.name?.trim() ||
      !Number.isSafeInteger(t.amount) ||
      t.amount <= 0 ||
      !validDate(t.date)
    )
      throw Error("Revisa concepto, importe y fecha.");
    if (t.date > today())
      throw Error(
        "Registra movimientos realizados hasta hoy. Los futuros van en compromisos.",
      );
    s.transactions.push({ ...t, id: id() });
  }
  function reverseTransaction(s, idTx) {
    const t = s.transactions.find((t) => t.id === idTx);
    if (!t) throw Error("Movimiento no encontrado");
    if (t.historical)
      throw Error(
        "Este movimiento precede al saldo inicial. Puedes corregirlo sin afectar el saldo desde Editar.",
      );
    if (t.kind === "debt") {
      const d = s.debts.find((d) => d.id === t.ref);
      if (!d) throw Error("Restaura primero la deuda asociada.");
      d.balance += t.principal || 0;
      d.active = true;
      if (t.obligation) {
        const i = (s.budgets[t.period]?.items || []).find(
          (i) => i.key === t.obligation,
        );
        if (i?.n) d.paidPayments = d.paidPayments.filter((n) => n !== i.n);
        else d.paidMonths = d.paidMonths.filter((m) => m !== t.period);
      }
    }
    s.transactions = s.transactions.filter((x) => x.id !== idTx);
  }
  function ledgerEntries(s) {
    let b = { ...s.opening };
    return s.transactions
      .filter((t) => !t.historical)
      .map((t, index) => ({ ...t, index }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
      .map((t) => {
        b = balances({ opening: b, transactions: [t] });
        return { ...t, cash: b.cash, debit: b.debit, value: b.cash + b.debit };
      });
  }
  function ledgerHistory(s) {
    const byDay = new Map([
      [
        s.reconstruction.startDate,
        {
          date: s.reconstruction.startDate,
          value: s.opening.cash + s.opening.debit,
          reconstructed: true,
        },
      ],
    ]);
    for (const t of ledgerEntries(s))
      byDay.set(t.date, { date: t.date, value: t.value, reconstructed: true });
    const b = balances(s);
    byDay.set(today(), {
      date: today(),
      value: b.cash + b.debit,
      reconstructed: true,
    });
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
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
    const dates = [];
    for (let n = 0; n < 12; n++)
      for (const i of obligations(s, addMonth(month(), n)))
        if (!i.paid) dates.push({ id: i.key, name: i.name, date: i.date });
    return dates;
  }
  root.OSP = {
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
    balances,
    schedule,
    planned,
    ensureBudget,
    refreshBudget,
    isPaid,
    obligations,
    metrics,
    pay,
    record,
    reverseTransaction,
    snapshot,
    ledgerEntries,
    ledgerHistory,
    reminders,
  };
  if (typeof module !== "undefined") module.exports = root.OSP;
})(globalThis);
