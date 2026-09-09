import C from "../app/src/main/assets/js/domain/finance.js";
import { build } from "esbuild";
const bundle = (
  await build({
    entryPoints: ["app/src/main/assets/js/bootstrap.js"],
    bundle: true,
    write: false,
    format: "iife",
  })
).outputFiles[0].text;
import assert from "node:assert/strict";
import fs from "node:fs";
const { Window } = await import(process.env.OSP_HAPPY_DOM || "happy-dom");
const w = new Window({
    url: "https://appassets.androidplatform.net/index.html",
  }),
  doc = w.document;
let stored = null,
  failWrite = false;
w.NativeOSP = {
  read: () => (stored ? JSON.stringify(stored) : ""),
  write: (raw) => {
    if (failWrite) return "ERROR:Simulated storage failure";
    stored = JSON.parse(raw);
    return "OK";
  },
  configureReminders: () => {},
  notificationStatus: () => "",
  exportBackup: () => {},
  requestNotifications: () => {},
};
w.NativeOSP.writeAsync = (raw, id) =>
  setTimeout(() => w.nativeSaved(id, w.NativeOSP.write(raw)), 0);
doc.write(
  fs
    .readFileSync("app/src/main/assets/index.html", "utf8")
    .replace(/<script[^>]*>.*?<\/script>/g, ""),
);
w.eval(bundle);
const wait = () => new Promise((r) => setTimeout(r, 5));
await wait();
const click = async (action, id) => {
  let selector = `[data-action="${action}"]`;
  if (id !== undefined) selector += `[data-id="${id}"]`;
  const el = doc.querySelector(selector);
  assert.ok(el, selector);
  el.click();
  await wait();
};
const submit = async (values) => {
  const form = doc.querySelector("#form");
  assert.ok(form);
  for (const [k, v] of Object.entries(values)) {
    const input = form.querySelector(`[name="${k}"]`);
    assert.ok(input, k);
    input.value = String(v);
  }
  form.dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
  await wait();
};
await click("start");
await click("settings");
await click("balances");
await submit({ debit: "10000", cash: "1000" });
assert.equal(stored.state.transactions.length, 2);
await click("expectedIncome");
await submit({ income: "20000" });
await click("tab", "debt");
await click("editDebt");
await submit({
  name: "Equipo de prueba",
  originalAmount: "3000",
  balance: "3000",
  payment: "1000",
  totalPayments: 3,
  financingCost: "0",
});
assert.equal(stored.state.debts.length, 1);
const before = C.metrics(stored.state);
await click("pay");
await submit({ amount: "1000", method: "debit", date: C.today() });
assert.equal(C.metrics(stored.state).debit, before.debit - 100000);
assert.equal(C.metrics(stored.state).budgetFree, before.budgetFree);
await click("undo");
assert.equal(C.metrics(stored.state).debit, before.debit);
await click("tab", "expense");
await click("expenseSub", "fixed");
await click("editFixed");
await submit({ name: "Internet", amount: "500", dueDay: 20 });
assert.equal(stored.state.fixedExpenses.length, 1);
await click("pay");
await submit({ amount: "200", method: "debit", date: C.today() });
assert.equal(
  C.obligations(stored.state).find((i) => i.kind === "fixed").remaining,
  30000,
);
await click("tab", "goal");
await click("editGoal");
await submit({ name: "Una escapada", target: "5000" });
await click("contribute");
await submit({ kind: "add", amount: "1000" });
assert.equal(C.metrics(stored.state).reserved, 100000);
await click("tab", "expense");
await click("expenseSub", "all");
await click("filters");
const kind = doc.querySelector("#filters [name=kind]");
kind.value = "fixed";
kind.dispatchEvent(new w.Event("change", { bubbles: true }));
assert.equal(doc.querySelectorAll(".item-title").length, 1);
const search = doc.querySelector("#search");
search.value = "no existe";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
assert.equal(doc.querySelectorAll(".item-title").length, 0);
await click("settings");
failWrite = true;
await click("editCategory");
const count = stored.state.categories.length;
await submit({ name: "No se debe guardar" });
assert.equal(stored.state.categories.length, count);
assert.match(doc.querySelector(".form-error").textContent, /Simulated/);
failWrite = false;
await click("close");
await w.receiveImport('{"invalid":true}');
assert.equal(stored.state.debts.length, 1);
for (const tab of ["home", "expense", "debt", "calendar", "goal"])
  await click("tab", tab);
await click("tab", "calendar");
await click("projection");
assert.equal(doc.querySelectorAll("#view tbody tr").length, 12);
assert.ok(doc.body.classList.contains("full-screen"));
await click("screenBack");
await click("timeline");
assert.ok(doc.querySelector("table.timeline"));
await click("screenBack");
assert.ok(!doc.body.classList.contains("full-screen"));
await click("settings");
await click("history");
assert.ok(doc.querySelector("#modal").textContent.includes("Deshacer"));
await click("close");
const b = C.balances(stored.state);
await w.receiveImport(
  JSON.stringify({ format: "projectosp-backup", state: stored.state }),
);
await click("confirmImport");
assert.deepEqual(C.balances(stored.state), b);
// A draft survives navigation and native reload without replacing the live ledger.
console.log("DOM: original flows passed; checking reconstruction.");
await click("settings");
const live = JSON.stringify(stored.state),
  start = C.addMonth(C.month(), -1) + "-01";
await click("rebuildStart");
await submit({ startDate: start, debit: "1000", cash: "100", income: "2000" });
assert.ok(stored.draft);
assert.equal(JSON.stringify(stored.state), live);
await click("rebuildEntry", "expense");
await submit({
  name: "Compra histórica",
  amount: "100",
  date: start,
  method: "debit",
});
assert.equal(stored.draft.entries.length, 1);
assert.equal(JSON.stringify(stored.state), live);
await click("rebuildEntry", "income");
failWrite = true;
await submit({
  name: "Falla simulada",
  amount: "200",
  date: start,
  method: "debit",
});
assert.equal(stored.draft.entries.length, 1);
assert.match(doc.querySelector(".form-error").textContent, /Simulated/);
failWrite = false;
await click("close");
await click("screenBack");
await click("rebuildStart");
assert.match(doc.querySelector("#view").textContent, /Compra histórica/);
console.log("DOM: draft creation, navigation and failed save passed.");
const reload = new Window({
  url: "https://appassets.androidplatform.net/index.html",
  settings: {
    enableFileSystemHttpRequests: false,
    disableCSSFileLoading: true,
  },
});
reload.NativeOSP = { ...w.NativeOSP };
reload.NativeOSP.writeAsync = (raw, id) =>
  setTimeout(() => reload.nativeSaved(id, reload.NativeOSP.write(raw)), 0);
reload.document.write(
  fs
    .readFileSync("app/src/main/assets/index.html", "utf8")
    .replace(/<script[^>]*>.*?<\/script>/g, ""),
);
reload.eval(bundle);
await wait();
reload.document.querySelector("[data-action=settings]").click();
await wait();
assert.match(
  reload.document.querySelector("#view").textContent,
  /Continuar borrador/,
);
assert.equal(stored.draft.entries.length, 1);
await reload.happyDOM.abort();
console.log("DOM: draft persisted after reload.");
await click("rebuildReview");
await submit({ debit: "900", cash: "100" });
assert.match(doc.querySelector("#modal").textContent, /Los saldos coinciden/);
await submit({});
assert.equal(stored.draft, null);
assert.equal(stored.state.reconstruction.basis, "ledger");
assert.equal(stored.state.transactions.length, 1);
assert.equal(stored.state.opening.debit, 100000);
assert.equal(C.balances(stored.state).debit, 90000);
await click("undo");
assert.equal(JSON.stringify(stored.state), live);
console.log("DOM: confirmation and undo passed.");
// A live change makes the draft stale; it must never overwrite newer work.
await click("settings");
await click("rebuildStart");
await submit({ startDate: start, debit: "0", cash: "0", income: "0" });
await click("screenBack");
await click("expectedIncome");
await submit({ income: "25000" });
await click("rebuildStart");
assert.match(doc.querySelector("#view").textContent, /no puede confirmarse/);
await click("rebuildReview");
assert.equal(doc.querySelector("#dialog").open, false);
assert.ok(stored.draft);
await click("rebuildDiscard");
await submit({});
assert.equal(stored.draft, null);
console.log("DOM: stale-draft protection passed.");
if (process.env.OSP_BACKUP) {
  const raw = JSON.parse(fs.readFileSync(process.env.OSP_BACKUP, "utf8"));
  await w.receiveImport(JSON.stringify(raw));
  await click("confirmImport");
  assert.equal(C.balances(stored.state).debit, C.cents(raw.balances.debit));
  assert.equal(C.balances(stored.state).cash, C.cents(raw.balances.cash));
  for (const name of ["home", "expense", "debt", "calendar", "goal"])
    await click("tab", name);
  await click("settings");
}
await w.happyDOM.abort();
console.log(
  "DOM integration passed: event handlers, save rollback, payment/undo, partial fixed payment, goals, filters, invalid import, projection, timeline, backup round trip. Not visual or Android runtime QA.",
);
