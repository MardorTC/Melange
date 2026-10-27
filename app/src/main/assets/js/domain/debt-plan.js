import C from "./finance.js";

const sum = (list, fn) => list.reduce((n, item) => n + fn(item), 0);
const maxMonth = (a, b) => (a > b ? a : b);

function monthsBetween(from, to) {
  const years = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  const months = Number(to.slice(5, 7)) - Number(from.slice(5, 7));
  return years * 12 + months;
}

export function debtBreakdown(s) {
  const active = s.debts.filter((d) => d.balance > 0);
  const loans = active.filter((d) => !d.creditCardId);
  const cards = s.creditCards
    .map((card) => {
      const summary = C.creditSummary(s, card.id);
      const installments = active.filter((d) => d.creditCardId === card.id);
      return { card, summary, installments, total: summary.used };
    })
    .filter(({ total }) => total > 0);
  const loansTotal = sum(loans, (d) => d.balance);
  const cardsTotal = sum(cards, (c) => c.total);
  return {
    active,
    loans,
    cards,
    loansTotal,
    cardsTotal,
    total: loansTotal + cardsTotal,
    activeCount:
      loans.filter((d) => !d.archived).length +
      cards.filter((c) => c.card.active !== false).length,
    archivedCount:
      loans.filter((d) => d.archived).length +
      cards.filter((c) => c.card.active === false).length,
  };
}

function paidMonthsFor(d) {
  const paid = new Set(d.paidMonths || []);
  if (!d.totalPayments || !d.startDate) return paid;
  const start = C.month(d.startDate);
  const installments = new Set(d.paidPayments || []);
  for (let n = 1; n <= d.totalPayments; n++)
    if (installments.has(n)) paid.add(C.addMonth(start, n - 1));
  return paid;
}

function scheduleFor(d, current, paidMonths) {
  const payment = Math.max(0, d.payment || 0);
  if (d.totalPayments && d.startDate) {
    const start = C.month(d.startDate);
    const contractEnd = C.addMonth(start, d.totalPayments - 1);
    const installments = new Set(d.paidPayments || []);
    let firstPending = "";
    const lateMonths = [];
    for (let n = 1; n <= d.totalPayments; n++) {
      const period = C.addMonth(start, n - 1);
      if (installments.has(n) || paidMonths.has(period)) continue;
      if (!firstPending) firstPending = period;
      if (period < current) lateMonths.push(period);
    }
    if (!firstPending) firstPending = current;
    const lateCount = lateMonths.length;
    const passedEnd = contractEnd < current;
    const overdue = lateCount > 0 || passedEnd;
    const noDate = payment <= 0;
    const estimatedEnd =
      passedEnd && payment > 0
        ? C.addMonth(current, Math.max(0, Math.ceil(d.balance / payment) - 1))
        : contractEnd;
    const end = noDate ? null : estimatedEnd;
    return {
      start,
      end,
      contractEnd,
      firstPending: maxMonth(firstPending, current),
      estimated: overdue || noDate || end !== contractEnd,
      overdue,
      needsReview: overdue || noDate,
      noDate,
      lateCount,
      lateAmount: lateCount * payment,
    };
  }
  if (payment <= 0)
    return {
      start: d.startDate ? maxMonth(current, C.month(d.startDate)) : current,
      end: null,
      contractEnd: null,
      firstPending: current,
      estimated: true,
      overdue: false,
      needsReview: true,
      noDate: true,
      lateCount: 0,
      lateAmount: 0,
    };
  const start = d.startDate ? maxMonth(current, C.month(d.startDate)) : current;
  const months = Math.ceil(d.balance / payment);
  return {
    start,
    end: C.addMonth(start, months - 1),
    contractEnd: null,
    firstPending: start,
    estimated: true,
    overdue: false,
    needsReview: false,
    noDate: false,
    lateCount: 0,
    lateAmount: 0,
  };
}

export function debtPlan(s) {
  const current = C.month();
  const rows = s.debts
    .filter((d) => d.balance > 0 && d.type !== "revolving")
    .map((d) => {
      const card = s.creditCards.find((c) => c.id === d.creditCardId);
      const paidMonths = paidMonthsFor(d);
      const schedule = scheduleFor(d, current, paidMonths);
      const monthsRemaining = !schedule.end
        ? 0
        : schedule.end < current
          ? 0
          : monthsBetween(current, schedule.end) + 1;
      return {
        id: d.id,
        name: d.name,
        kind: d.type,
        balance: d.balance,
        payment: d.payment || 0,
        balanceMode: d.balanceMode,
        capitalOnly: d.balanceMode === "principal",
        archived: !!d.archived,
        cardId: card?.id || "",
        cardName: card?.name || "",
        start: schedule.start,
        end: schedule.end,
        contractEnd: schedule.contractEnd,
        firstPending: schedule.firstPending,
        estimated: schedule.estimated,
        overdue: schedule.overdue,
        needsReview: schedule.needsReview,
        noDate: schedule.noDate,
        lateCount: schedule.lateCount,
        lateAmount: schedule.lateAmount,
        paidMonths,
        paidInstallments: (d.paidPayments || []).length,
        totalInstallments: d.totalPayments || 0,
        monthsRemaining,
        status: schedule.noDate
          ? "review"
          : schedule.overdue
            ? "overdue"
            : schedule.estimated
              ? "estimated"
              : "active",
      };
    })
    .sort(
      (a, b) =>
        (a.end || "9999-12").localeCompare(b.end || "9999-12") ||
        a.name.localeCompare(b.name),
    );
  for (const row of rows) {
    if (row.archived) {
      row.currentRemaining = 0;
      row.currentRecorded = 0;
      row.partial = false;
      row.currentOverdue = false;
      row.lateCount = 0;
      row.lateAmount = 0;
      continue;
    }
    const currentItem = C.baseObligations(s, current).find(
      (item) => item.kind === "debt" && item.ref === row.id,
    );
    row.currentRemaining = currentItem
      ? currentItem.remaining
      : row.start <= current && row.end && row.end >= current
        ? row.payment
        : 0;
    row.currentRecorded = currentItem?.recorded || 0;
    row.partial = (currentItem?.recorded || 0) > 0 && !currentItem?.paid;
    const cardPaymentDay = row.cardId
      ? s.creditCards.find((card) => card.id === row.cardId)?.paymentDay
      : null;
    const currentDate = cardPaymentDay
      ? C.dueDate(current, cardPaymentDay)
      : currentItem?.date;
    row.currentOverdue = Boolean(
      currentItem &&
        currentDate < C.today() &&
        !currentItem.paid &&
        currentItem.remaining > 0,
    );
    if (row.currentOverdue) {
      row.overdue = true;
      row.needsReview = true;
      row.status = "overdue";
    }
    let lateCount = 0,
      lateAmount = 0;
    if (row.start < current) {
      for (
        let month = row.start;
        month < current;
        month = C.addMonth(month, 1)
      ) {
        const item = C.baseObligations(s, month).find(
          (entry) => entry.kind === "debt" && entry.ref === row.id,
        );
        if (item && !item.paid && item.remaining > 0) {
          lateCount++;
          lateAmount += item.remaining;
        }
      }
    }
    row.lateCount = lateCount;
    row.lateAmount = lateAmount;
    if (lateCount) {
      row.overdue = true;
      row.needsReview = true;
      row.status = "overdue";
    }
  }
  const dated = rows.filter((row) => row.end && !row.archived);
  const debtFreeMonth = dated.length
    ? dated.reduce((last, row) => maxMonth(last, row.end), dated[0].end)
    : "";
  const activeNow = rows.filter(
    (row) =>
      !row.archived && row.end && row.start <= current && row.end >= current,
  );
  const archived = rows.filter((row) => row.archived);
  return {
    rows,
    debtFreeMonth,
    monthlyPayment: sum(activeNow, (row) => row.payment),
    thisMonthRemaining: sum(activeNow, (row) => row.currentRemaining),
    latePayment: sum(activeNow, (row) => row.lateAmount),
    lateCount: sum(activeNow, (row) => row.lateCount),
    unassigned: sum(s.creditCards, (c) => C.creditSummary(s, c.id).unassigned),
    totalBalance: sum(rows, (row) => row.balance),
    archivedCount: archived.length,
    archivedBalance: sum(archived, (row) => row.balance),
    monthsRemaining: debtFreeMonth
      ? Math.max(1, monthsBetween(current, debtFreeMonth) + 1)
      : 0,
    capitalOnly: rows.some((row) => row.capitalOnly),
  };
}

export function debtCellState(row, month, current = C.month()) {
  if (!row.end || month < row.start || month > row.end) return "outside";
  if (row.paidMonths.has(month)) return "paid";
  if (month < current) return "overdue";
  if (month === current)
    return row.overdue || row.lateCount > 0 || row.currentOverdue
      ? "overdue"
      : "due";
  return row.estimated ? "estimated" : "future";
}

export function planInYear(plan, year) {
  return plan.rows.filter(
    (row) =>
      !row.archived &&
      row.end &&
      row.start.slice(0, 4) <= year &&
      row.end.slice(0, 4) >= year,
  );
}

export default { debtBreakdown, debtPlan, debtCellState, planInYear };
