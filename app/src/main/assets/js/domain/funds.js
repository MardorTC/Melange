import L from "./legacy-v7.js";
const integer = (n) => Number.isSafeInteger(n) && Math.abs(n) <= 1e14;
export const cashKinds = ["expense", "fixed", "debt", "loan_out"];
export function balances(s) {
  const out = Object.fromEntries(
    s.walletAccounts.map((a) => [a.id, a.opening]),
  );
  for (const t of s.transactions) {
    if (t.historical) continue;
    if (cashKinds.includes(t.kind)) out[t.accountId] -= t.amount;
    else if (["income", "loan_in"].includes(t.kind))
      out[t.accountId] += t.amount;
    else if (t.kind === "adjustment")
      out[t.accountId] += t.direction * t.amount;
    else if (t.kind === "transfer") {
      out[t.accountId] -= t.amount;
      out[t.toAccountId] += t.amount;
    }
  }
  return out;
}
export function goalBalance(g) {
  return g.allocations.reduce((sum, a) => sum + a.amount, 0);
}
export function accountSummary(s) {
  const b = balances(s);
  return s.walletAccounts.map((a) => {
    const reserved = s.goals
      .flatMap((g) => g.allocations)
      .filter((r) => r.accountId === a.id)
      .reduce((n, r) => n + r.amount, 0);
    const boxes = s.boxes.filter((x) => x.accountId === a.id);
    const frozen = boxes.reduce((n, x) => n + x.amount, 0);
    const overlap = boxes.reduce(
      (n, x) =>
        n +
        (x.goalId
          ? Math.min(
              x.amount,
              s.goals
                .find((g) => g.id === x.goalId)
                ?.allocations.find((r) => r.boxId === x.id)?.amount || 0,
            )
          : 0),
      0,
    );
    return {
      ...a,
      total: b[a.id],
      reserved,
      frozen,
      available: b[a.id] - reserved - frozen + overlap,
    };
  });
}
export function unassigned(s) {
  return s.goals
    .flatMap((g) => g.allocations)
    .filter((r) => !r.accountId)
    .reduce((n, r) => n + r.amount, 0);
}
export function available(s) {
  return (
    accountSummary(s)
      .filter((a) => a.type !== "restricted")
      .reduce((n, a) => n + a.available, 0) - unassigned(s)
  );
}
export function requireFunds(
  s,
  accountId,
  amount,
  kind = "reserve",
  categoryId = "",
) {
  const a = accountSummary(s).find((a) => a.id === accountId);
  if (!a || a.active === false) throw Error("Elige una cuenta activa.");
  if (!integer(amount) || amount <= 0)
    throw Error("Introduce un importe válido.");
  if (
    a.type === "restricted" &&
    (!["expense", "fixed", "reversal"].includes(kind) ||
      (kind !== "reversal" && !a.allowedCategories.includes(categoryId)))
  )
    throw Error("Esta cuenta de vales no permite esta operación o categoría.");
  const usable =
    a.type === "restricted" ? a.available : Math.min(a.available, available(s));
  if (amount > usable)
    throw Error(
      `Faltan ${((amount - Math.max(0, usable)) / 100).toFixed(2)} MXN disponibles. Abre Cuentas para liberar reservas o cajitas, o corregir el saldo.`,
    );
}
export function requireDestination(s, id, kind) {
  const a = s.walletAccounts.find((a) => a.id === id && a.active !== false);
  if (!a) throw Error("Elige una cuenta de destino activa.");
  if (a.type === "restricted" && !["income", "transfer"].includes(kind))
    throw Error(
      "Los vales solo admiten ingresos y gastos de sus categorías permitidas.",
    );
}
export function reserve(s, goalId, accountId, amount) {
  requireFunds(s, accountId, amount);
  const g = s.goals.find((g) => g.id === goalId);
  if (!g) throw Error("Meta no encontrada.");
  g.allocations.push({ accountId, amount });
  g.balance = goalBalance(g);
}
export function releaseReserve(s, goalId, index, amount) {
  const g = s.goals.find((g) => g.id === goalId),
    r = g?.allocations[index];
  if (!r || !integer(amount) || amount <= 0 || amount > r.amount)
    throw Error("Reserva inválida.");
  const box = s.boxes.find((b) => b.id === r.boxId);
  if (box && r.amount - amount < box.amount)
    throw Error("Libera primero el dinero congelado en la cajita.");
  r.amount -= amount;
  g.allocations = g.allocations.filter((x) => x.amount > 0);
  g.balance = goalBalance(g);
}
export function assignReserve(s, goalId, index, accountId) {
  const g = s.goals.find((g) => g.id === goalId),
    r = g?.allocations[index];
  if (!r || r.accountId) throw Error("Esta reserva ya está asignada.");
  const a = accountSummary(s).find(
    (a) => a.id === accountId && a.active !== false && a.type !== "restricted",
  );
  if (!a || a.available < r.amount)
    throw Error(
      "La cuenta no dispone de dinero suficiente para asignar esta reserva.",
    );
  r.accountId = accountId;
}
export function freeze(s, data) {
  requireFunds(s, data.accountId, data.amount);
  if (
    !data.name?.trim() ||
    !L.validDate(data.createdDate) ||
    data.createdDate > L.today() ||
    !L.validDate(data.availableDate) ||
    data.availableDate < data.createdDate
  )
    throw Error("Revisa el nombre y las fechas de la cajita.");
  const box = {
    ...data,
    id: L.id(),
    events: [{ date: data.createdDate, amount: data.amount, kind: "freeze" }],
  };
  if (box.goalId) {
    const g = s.goals.find((g) => g.id === box.goalId);
    if (!g) throw Error("Meta no encontrada.");
    g.allocations.push({
      accountId: box.accountId,
      boxId: box.id,
      amount: box.amount,
    });
    g.balance = goalBalance(g);
  }
  s.boxes.push(box);
  return box;
}
export function linkBox(s, id, goalId) {
  const b = s.boxes.find((b) => b.id === id),
    g = s.goals.find((g) => g.id === goalId);
  if (!b || b.goalId || !g || b.amount <= 0)
    throw Error("Elige una cajita sin vínculo y una meta.");
  b.goalId = goalId;
  g.allocations.push({ accountId: b.accountId, boxId: b.id, amount: b.amount });
  g.balance = goalBalance(g);
}
export function releaseBox(s, id, amount, date = L.today()) {
  const b = s.boxes.find((b) => b.id === id);
  if (
    !b ||
    !integer(amount) ||
    amount <= 0 ||
    amount > b.amount ||
    !L.validDate(date) ||
    date > L.today() ||
    date < b.createdDate
  )
    throw Error("Revisa la liberación de la cajita.");
  b.amount -= amount;
  b.events.push({ date, amount, kind: "release" });
}
export function loanBalance(s, id) {
  const l = s.receivables.find((l) => l.id === id);
  if (!l) throw Error("Préstamo no encontrado.");
  return (
    l.opening +
    s.transactions
      .filter((t) => t.ref === id)
      .reduce(
        (n, t) =>
          n +
          (t.kind === "loan_out"
            ? t.amount
            : t.kind === "loan_in"
              ? -t.amount
              : 0),
        0,
      )
  );
}
export function validateFunds(s) {
  const collections = [
    "walletAccounts",
    "creditors",
    "boxes",
    "receivables",
    "categories",
    "goals",
    "transactions",
    "debts",
    "fixedExpenses",
    "liquidityHistory",
  ];
  for (const key of collections) {
    if (!Array.isArray(s[key])) throw Error("Falta la colección " + key);
    const ids = new Set();
    for (const x of s[key]) {
      if (key === "liquidityHistory") continue;
      if (
        !x ||
        typeof x.id !== "string" ||
        !x.id ||
        ids.has(x.id) ||
        typeof x.name !== "string" ||
        !x.name.trim()
      )
        throw Error("Identificador o nombre inválido en " + key);
      ids.add(x.id);
    }
  }
  const wallet = (id) => s.walletAccounts.some((a) => a.id === id),
    goal = (id) => s.goals.some((g) => g.id === id);
  for (const a of s.walletAccounts)
    if (
      !["cash", "bank", "restricted"].includes(a.type) ||
      !integer(a.opening) ||
      !Array.isArray(a.allowedCategories) ||
      a.allowedCategories.some((id) => !s.categories.some((c) => c.id === id))
    )
      throw Error("Cuenta inválida.");
  for (const g of s.goals) {
    if (!Array.isArray(g.allocations) || !integer(g.target) || g.target < 0)
      throw Error("Meta inválida.");
    for (const r of g.allocations)
      if (
        !integer(r.amount) ||
        r.amount <= 0 ||
        (r.accountId && !wallet(r.accountId)) ||
        (r.boxId &&
          !s.boxes.some(
            (b) =>
              b.id === r.boxId &&
              b.goalId === g.id &&
              b.accountId === r.accountId,
          ))
      )
        throw Error("Reserva inválida.");
    if (g.balance !== goalBalance(g))
      throw Error("El saldo de la meta no coincide con sus reservas.");
  }
  for (const b of s.boxes) {
    if (
      !wallet(b.accountId) ||
      !integer(b.amount) ||
      b.amount < 0 ||
      !L.validDate(b.createdDate) ||
      !L.validDate(b.availableDate) ||
      b.availableDate < b.createdDate ||
      !Array.isArray(b.events) ||
      (b.goalId && !goal(b.goalId))
    )
      throw Error("Cajita inválida.");
    if (
      b.events.some(
        (e) =>
          !integer(e.amount) ||
          e.amount <= 0 ||
          !L.validDate(e.date) ||
          e.date < b.createdDate ||
          !["freeze", "release"].includes(e.kind),
      ) ||
      b.events.reduce(
        (n, e) => n + (e.kind === "freeze" ? e.amount : -e.amount),
        0,
      ) !== b.amount
    )
      throw Error("Historial de cajita inválido.");
    if (
      b.goalId &&
      s.goals
        .find((g) => g.id === b.goalId)
        .allocations.filter((r) => r.boxId === b.id)
        .reduce((n, r) => n + r.amount, 0) < b.amount
    )
      throw Error("La reserva de la cajita está incompleta.");
  }
  for (const l of s.receivables)
    if (
      !integer(l.opening) ||
      l.opening < 0 ||
      (l.dueDate && !L.validDate(l.dueDate)) ||
      loanBalance(s, l.id) < 0
    )
      throw Error("Préstamo inválido.");
  for (const t of s.transactions) {
    if (
      !integer(t.amount) ||
      t.amount < 0 ||
      !wallet(t.accountId) ||
      !L.validDate(t.date) ||
      ![
        "expense",
        "fixed",
        "debt",
        "income",
        "transfer",
        "adjustment",
        "loan_out",
        "loan_in",
      ].includes(t.kind)
    )
      throw Error("Movimiento inválido.");
    if (
      t.kind === "transfer" &&
      (!wallet(t.toAccountId) || t.toAccountId === t.accountId)
    )
      throw Error("Destino inválido.");
    if (t.kind === "adjustment" && ![-1, 1].includes(t.direction))
      throw Error("Ajuste inválido.");
    if (
      ["loan_out", "loan_in"].includes(t.kind) &&
      !s.receivables.some((l) => l.id === t.ref)
    )
      throw Error("Préstamo asociado inexistente.");
    if (
      t.kind === "debt" &&
      (!integer(t.principal) ||
        t.principal < 0 ||
        t.principal > t.amount ||
        !s.debts.some((d) => d.id === t.ref))
    )
      throw Error("Pago de deuda inválido.");
  }
  for (const n of Object.values(balances(s)))
    if (!integer(n)) throw Error("Saldo fuera del rango admitido.");
}
