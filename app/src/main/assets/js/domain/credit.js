import L from "./legacy-v7.js";
const sum = (xs, fn) => xs.reduce((n, x) => n + fn(x), 0);
const money = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1e14;
export const isCreditPurchase = (t) =>
  !!t.creditCardId && ["expense", "fixed"].includes(t.kind);
export function allocations(s) {
  return s.transactions
    .filter((t) => t.kind === "card_payment")
    .flatMap((t) => t.allocations || []);
}
export function allocated(s, kind, ref) {
  return sum(
    allocations(s).filter((a) => a.kind === kind && a.ref === ref),
    (a) => a.amount,
  );
}
export function creditDueDate(card, date) {
  let closingMonth = L.month(date);
  if (date > L.dueDate(closingMonth, card.closingDay))
    closingMonth = L.addMonth(closingMonth, 1);
  const closing = L.dueDate(closingMonth, card.closingDay);
  let due = L.dueDate(closingMonth, card.paymentDay);
  if (due <= closing)
    due = L.dueDate(L.addMonth(closingMonth, 1), card.paymentDay);
  return due;
}
export function creditSummary(s, cardId) {
  const card = s.creditCards.find((c) => c.id === cardId);
  if (!card) throw Error("Tarjeta no encontrada.");
  const purchases =
    card.openingBalance -
    allocated(s, "opening", cardId) +
    sum(
      s.transactions.filter(
        (t) => isCreditPurchase(t) && t.creditCardId === cardId,
      ),
      (t) => t.amount - allocated(s, "purchase", t.id),
    );
  const installments = sum(
    s.debts.filter((d) => d.creditCardId === cardId),
    (d) => d.balance,
  );
  const unassigned = allocated(s, "unassigned", cardId);
  return {
    ...card,
    purchases,
    installments,
    unassigned,
    used: purchases + installments - unassigned,
    available: card.limit - purchases - installments + unassigned,
  };
}
export function statement(s, cardId, period, items) {
  const card = creditSummary(s, cardId),
    lines = [];
  if (card.openingBalance && L.month(card.openingDueDate) === period) {
    const recorded = allocated(s, "opening", cardId);
    lines.push({
      kind: "opening",
      ref: cardId,
      name: "Saldo anterior sin MSI",
      date: card.openingDueDate,
      amount: card.openingBalance,
      recorded,
      remaining: card.openingBalance - recorded,
    });
  }
  for (const t of s.transactions.filter(
    (t) =>
      isCreditPurchase(t) &&
      t.creditCardId === cardId &&
      L.month(t.cardDueDate) === period,
  )) {
    const recorded = allocated(s, "purchase", t.id);
    lines.push({
      kind: "purchase",
      ref: t.id,
      name: t.name,
      date: t.cardDueDate,
      amount: t.amount,
      recorded,
      remaining: t.amount - recorded,
    });
  }
  for (const i of items.filter(
    (i) =>
      i.kind === "debt" &&
      s.debts.find((d) => d.id === i.ref)?.creditCardId === cardId,
  )) {
    const d = s.debts.find((d) => d.id === i.ref);
    lines.push({
      ...i,
      obligation: i.key,
      period,
      remaining: Math.min(i.remaining, d.balance),
      amount:
        i.recorded +
        (i.paid
          ? i.legacyPaid
            ? i.amount
            : 0
          : Math.min(i.remaining, d.balance)),
    });
  }
  lines.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.kind === "debt") - Number(a.kind === "debt") ||
      a.ref.localeCompare(b.ref),
  );
  const amount = sum(lines, (i) => i.amount),
    remaining = sum(lines, (i) => i.remaining);
  return {
    key: `card:${cardId}:${period}`,
    kind: "card_payment",
    ref: cardId,
    name: card.name,
    period,
    date: lines[0]?.date || L.dueDate(period, card.paymentDay),
    amount,
    remaining,
    recorded: amount - remaining,
    paid: remaining === 0,
    lines,
  };
}
export function validateCredit(s) {
  if (!Array.isArray(s.creditCards))
    throw Error("Falta el catálogo de tarjetas.");
  const ids = new Set();
  for (const c of s.creditCards) {
    if (
      !c.id ||
      typeof c.id !== "string" ||
      ids.has(c.id) ||
      s.walletAccounts.some((a) => a.id === c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      !money(c.limit) ||
      !c.limit ||
      !money(c.openingBalance) ||
      !L.validDate(c.openingDueDate) ||
      ![c.closingDay, c.paymentDay].every(
        (d) => Number.isInteger(d) && d >= 1 && d <= 31,
      )
    )
      throw Error("Revisa el límite y las fechas de la tarjeta.");
    ids.add(c.id);
  }
  for (const d of s.debts)
    if (
      d.creditCardId &&
      (!ids.has(d.creditCardId) ||
        d.type !== "msi" ||
        d.balanceMode !== "total" ||
        !d.totalPayments)
    )
      throw Error(
        "Solo se pueden vincular MSI con plazo y saldo total a una tarjeta.",
      );
  for (const t of s.transactions) {
    if (
      t.creditCardId &&
      (!ids.has(t.creditCardId) ||
        (!isCreditPurchase(t) && t.kind !== "card_payment"))
    )
      throw Error("Tarjeta o movimiento de crédito inválido.");
    if (
      isCreditPurchase(t) &&
      (t.accountId ||
        t.historical ||
        !L.validDate(t.cardDueDate) ||
        t.cardDueDate < t.date ||
        allocated(s, "purchase", t.id) > t.amount)
    )
      throw Error("Compra de crédito inválida o ya pagada en exceso.");
    if (t.kind !== "card_payment") continue;
    if (
      t.historical ||
      s.walletAccounts.find((a) => a.id === t.accountId)?.type === "restricted"
    )
      throw Error(
        "El pago de tarjeta debe salir de una cuenta libre y no puede ser un antecedente.",
      );
    if (
      !ids.has(t.creditCardId) ||
      !Array.isArray(t.allocations) ||
      !t.allocations.length ||
      sum(t.allocations, (a) => a.amount) !== t.amount
    )
      throw Error("Desglose del pago de tarjeta inválido.");
    for (const a of t.allocations) {
      if (!money(a.amount) || !a.amount)
        throw Error("Importe de aplicación inválido.");
      if (a.kind === "purchase") {
        const purchase = s.transactions.find(
          (x) =>
            x.id === a.ref &&
            isCreditPurchase(x) &&
            x.creditCardId === t.creditCardId,
        );
        if (!purchase || purchase.date > t.date)
          throw Error(
            "El pago no corresponde a una compra anterior de esta tarjeta.",
          );
      } else if (a.kind === "unassigned") {
        if (a.ref !== t.creditCardId)
          throw Error("Abono sin asignar de otra tarjeta.");
      } else if (a.kind === "opening") {
        if (a.ref !== t.creditCardId)
          throw Error("Saldo inicial de otra tarjeta.");
      } else if (a.kind === "debt") {
        const d = s.debts.find(
          (d) => d.id === a.ref && d.creditCardId === t.creditCardId,
        );
        if (
          !d ||
          (d.historicalPaidPayments || []).includes(a.n) ||
          !a.n ||
          a.obligation !== `debt:${d.id}:${a.n}` ||
          !/^\d{4}-\d{2}$/.test(a.period) ||
          a.n > d.totalPayments ||
          !Number.isInteger(a.n) ||
          L.addMonth(L.month(d.startDate), a.n - 1) !== a.period
        )
          throw Error("Mensualidad de tarjeta inválida.");
        const planned =
          s.budgets[a.period]?.items.find((i) => i.key === a.obligation)
            ?.amount ?? d.payment;
        const direct = sum(
          s.transactions.filter((x) => x.obligation === a.obligation),
          (x) => x.amount,
        );
        const grouped = sum(
          allocations(s).filter((x) => x.obligation === a.obligation),
          (x) => x.amount,
        );
        if (direct + grouped > planned)
          throw Error(
            "La mensualidad tiene pagos duplicados o superiores a su importe.",
          );
      } else throw Error("Aplicación de pago desconocida.");
    }
  }
  for (const c of s.creditCards) {
    if (
      allocated(s, "opening", c.id) > c.openingBalance ||
      !money(creditSummary(s, c.id).used)
    )
      throw Error("Saldo de tarjeta inválido.");
  }
}
