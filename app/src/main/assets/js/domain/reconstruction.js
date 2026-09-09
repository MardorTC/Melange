/* Reconstruction is pure: edits produce a new candidate, never mutate live data. */

import C from "./finance.js";
function checkDate(date, start, end) {
  if (!C.validDate(date) || date < start || date > end)
    throw Error("La fecha debe estar dentro del periodo de reconstrucción.");
}
function create(source, config, revision) {
  const end = C.today();
  checkDate(config.startDate, C.addMonth(C.month(end), -120) + "-01", end);
  for (const n of [config.cash, config.debit, config.income])
    if (!Number.isSafeInteger(n)) throw Error("Revisa los saldos iniciales.");
  if (config.income < 0)
    throw Error("El ingreso previsto no puede ser negativo.");
  return {
    version: 1,
    id: C.id(),
    baseRevision: revision,
    baseId: source.id,
    config: { ...config },
    categories: C.clone(source.categories),
    accounts: C.clone(source.accounts),
    settings: C.clone(source.settings),
    debts: [],
    fixedExpenses: [],
    entries: [],
    createdAt: new Date().toISOString(),
  };
}
function build(draft, end = C.today()) {
  if (!draft || draft.version !== 1) throw Error("Borrador incompatible.");
  const start = draft.config.startDate;
  checkDate(start, C.addMonth(C.month(end), -120) + "-01", end);
  const s = C.empty();
  Object.assign(s, {
    id: draft.baseId,
    started: true,
    opening: { cash: draft.config.cash, debit: draft.config.debit },
    income: draft.config.income,
    accounts: C.clone(draft.accounts),
    categories: C.clone(draft.categories),
    settings: C.clone(draft.settings),
    debts: C.clone(draft.debts),
    fixedExpenses: C.clone(draft.fixedExpenses),
    reconstruction: { startDate: start, basis: "ledger" },
  });
  const sorted = draft.entries
    .map((e, index) => ({ ...e, index }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
  const ids = new Set();
  for (const e of sorted) {
    if (!e.id || ids.has(e.id))
      throw Error("Movimiento repetido en el borrador.");
    ids.add(e.id);
    checkDate(e.date, start, end);
  }
  let pos = 0;
  for (let m = C.month(start); m <= C.month(end); m = C.addMonth(m, 1)) {
    C.ensureBudget(s, m);
    while (pos < sorted.length && C.month(sorted[pos].date) === m) {
      const e = sorted[pos++];
      try {
        if (e.kind === "debt" || e.kind === "fixed") {
          if (
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(e.period) ||
            e.period < C.month(start) ||
            e.period > C.month(end)
          )
            throw Error("El mes del compromiso debe estar dentro del periodo.");
          C.ensureBudget(s, e.period);
          const t = C.pay(s, e.obligation, { ...e });
          t.id = e.id;
        } else {
          C.record(s, e);
          s.transactions.at(-1).id = e.id;
        }
      } catch (error) {
        throw Error(`${e.date} · ${e.name}: ${error.message}`);
      }
    }
  }
  C.validate(s);
  C.snapshot(s);
  return s;
}
function reconcile(draft, actual, addAdjustments = false, end = C.today()) {
  const s = build(draft, end),
    b = C.balances(s);
  const differences = {};
  for (const method of ["cash", "debit"]) {
    if (!Number.isSafeInteger(actual[method]))
      throw Error("Indica ambos saldos reales.");
    differences[method] = actual[method] - b[method];
    if (differences[method] && addAdjustments) {
      C.record(s, {
        name: "Conciliación de reconstrucción",
        kind: "adjustment",
        method,
        amount: Math.abs(differences[method]),
        direction: Math.sign(differences[method]),
        date: end,
      });
    }
  }
  s.reconstruction.confirmedAt = new Date().toISOString();
  s.reconstruction.actual = { ...actual };
  C.validate(s);
  C.snapshot(s);
  return {
    state: s,
    differences,
    matches: Object.values(differences).every((x) => x === 0),
  };
}
const HistoryRebuild = { create, build, reconcile };
export default HistoryRebuild;
