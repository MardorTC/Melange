/* Reconstruction is pure: edits produce a new candidate, never mutate live data. */

import C from "./finance.js";
function checkDate(date, start, end) {
  if (!C.validDate(date) || date < start || date > end)
    throw Error("La fecha debe estar dentro del periodo de reconstrucción.");
}
function create(source, config, revision) {
  const end = C.today();
  checkDate(config.startDate, C.addMonth(C.month(end), -120) + "-01", end);
  config = {
    ...config,
    openings: config.openings || { cash: config.cash, debit: config.debit },
  };
  for (const n of [...Object.values(config.openings), config.income])
    if (!Number.isSafeInteger(n)) throw Error("Revisa los saldos iniciales.");
  if (config.income < 0)
    throw Error("El ingreso previsto no puede ser negativo.");
  return {
    version: 2,
    id: C.id(),
    baseRevision: revision,
    baseId: source.id,
    config: { ...config },
    categories: C.clone(source.categories),
    creditors: C.clone(source.creditors),
    walletAccounts: C.clone(source.walletAccounts),
    settings: C.clone(source.settings),
    debts: [],
    fixedExpenses: [],
    entries: [],
    createdAt: new Date().toISOString(),
  };
}
function build(draft, end = C.today()) {
  draft = C.migrateDraft(draft);
  if (!draft || draft.version !== 2) throw Error("Borrador incompatible.");
  const start = draft.config.startDate;
  checkDate(start, C.addMonth(C.month(end), -120) + "-01", end);
  const s = C.empty();
  Object.assign(s, {
    id: draft.baseId,
    started: true,
    walletAccounts: draft.walletAccounts.map((a) => ({
      ...a,
      opening: draft.config.openings[a.id],
    })),
    income: draft.config.income,
    creditors: C.clone(draft.creditors),
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
          const t = C.pay(s, e.obligation, { ...e, replay: true });
          t.id = e.id;
        } else {
          C.record(s, e, { replay: true });
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
  for (const accountId of s.walletAccounts.map((a) => a.id)) {
    if (!Number.isSafeInteger(actual[accountId]))
      throw Error("Indica los saldos reales de todas las cuentas.");
    differences[accountId] = actual[accountId] - b[accountId];
    if (differences[accountId] && addAdjustments) {
      C.record(s, {
        name: "Conciliación de reconstrucción",
        kind: "adjustment",
        accountId,
        amount: Math.abs(differences[accountId]),
        direction: Math.sign(differences[accountId]),
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
