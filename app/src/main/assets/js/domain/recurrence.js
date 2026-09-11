import L from "./legacy-v7.js";
const monthIndex = (m) =>
  Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const dayNumber = (d) => Date.parse(d + "T12:00:00Z") / 86400000;
export function validateRule(r) {
  if (
    !r ||
    !L.validDate(r.startDate) ||
    (r.endDate && (!L.validDate(r.endDate) || r.endDate < r.startDate)) ||
    !L.validDate(r.effectiveFrom) ||
    !["days", "weeks", "months", "years", "twiceMonthly"].includes(r.unit) ||
    !Number.isInteger(r.interval) ||
    r.interval < 1 ||
    r.interval > 1200 ||
    !Number.isSafeInteger(r.amount) ||
    r.amount < 0
  )
    throw Error("Periodicidad inválida.");
  if (
    r.unit === "twiceMonthly" &&
    (!Array.isArray(r.days) ||
      r.days.length !== 2 ||
      r.days.some((d) => !Number.isInteger(d) || d < 1 || d > 31) ||
      r.days[0] >= r.days[1])
  )
    throw Error("Elige dos días distintos y ordenados del mes.");
}
export function rulesFor(f) {
  return (
    f.rules || [
      {
        id: "legacy",
        unit: "months",
        interval: 1,
        startDate: L.dueDate(f.startMonth || "1900-01", f.dueDay || 1),
        endDate: f.endMonth ? L.dueDate(f.endMonth, 31) : null,
        effectiveFrom: (f.startMonth || "1900-01") + "-01",
        amount: f.amount,
        categoryId: f.categoryId || "",
        active: f.active !== false,
        legacy: true,
        anchorDay: f.dueDay || 1,
      },
    ]
  );
}
export function occurrences(f, m) {
  const rules = rulesFor(f);
  const result = [];
  for (let index = 0; index < rules.length; index++) {
    const r = rules[index];
    validateRule(r);
    if (r.active === false) continue;
    const from = m + "-01",
      to = L.dueDate(m, 31),
      until = rules[index + 1]?.effectiveFrom;
    let dates = [];
    if (r.unit === "days" || r.unit === "weeks") {
      const step = r.interval * (r.unit === "weeks" ? 7 : 1),
        first = Math.max(
          0,
          Math.ceil((dayNumber(from) - dayNumber(r.startDate)) / step),
        );
      for (let n = first; n < first + 32; n++) {
        const date = new Date((dayNumber(r.startDate) + n * step) * 86400000)
          .toISOString()
          .slice(0, 10);
        if (date > to) break;
        dates.push(date);
      }
    } else if (r.unit === "twiceMonthly")
      dates = r.days.map((d) => L.dueDate(m, d));
    else {
      const delta = monthIndex(m) - monthIndex(L.month(r.startDate)),
        step = r.interval * (r.unit === "years" ? 12 : 1);
      if (delta >= 0 && delta % step === 0)
        dates = [L.dueDate(m, r.anchorDay || Number(r.startDate.slice(8)))];
    }
    for (const [slot, date] of dates.entries())
      if (
        date >= r.startDate &&
        date >= r.effectiveFrom &&
        (!r.endDate || date <= r.endDate) &&
        (!until || date < until)
      )
        result.push({
          key: r.legacy
            ? `fixed:${f.id}:${m}`
            : `fixed:${f.id}:${r.id}:${date}${r.unit === "twiceMonthly" ? ":" + slot : ""}`,
          ref: f.id,
          period: m,
          kind: "fixed",
          name: f.name,
          amount: r.amount,
          categoryId: r.categoryId || "",
          date,
          paid: false,
        });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function setRecurrence(s, f, rule) {
  validateRule(rule);
  const rules = rulesFor(f).map(L.clone);
  const last = rules.at(-1);
  if (last && rule.effectiveFrom < last.effectiveFrom)
    throw Error("La vigencia debe ser posterior a la última configuración.");
  for (const t of s.transactions.filter((t) => t.ref === f.id)) {
    const m = t.period || L.month(t.date);
    const due = (s.budgets?.[m]?.items || occurrences(f, m)).find(
      (i) => i.key === t.obligation,
    );
    if ((due?.date || t.date) >= rule.effectiveFrom)
      throw Error(
        "Hay vencimientos con pagos desde esa fecha; elige una vigencia posterior para conservarlos.",
      );
  }
  const id = L.id();
  if (last && last.effectiveFrom === rule.effectiveFrom) {
    if (
      s.transactions.some((t) => t.ref === f.id && t.date >= rule.effectiveFrom)
    )
      throw Error(
        "Esta configuración tiene pagos; elige una vigencia posterior.",
      );
    rules.pop();
  }
  f.rules = [...rules, { ...rule, id }];
}
export function recurrenceLabel(f) {
  const r = rulesFor(f).at(-1);
  return r.unit === "twiceMonthly"
    ? `Días ${r.days.join(" y ")} de cada mes`
    : `Cada ${r.interval} ${{ days: "día(s)", weeks: "semana(s)", months: "mes(es)", years: "año(s)" }[r.unit]}`;
}
