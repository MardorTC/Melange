import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { build } from "esbuild";
const bundle = (
  await build({
    stdin: {
      contents: 'export * from "./app/src/main/assets/js/platform/updates.js";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "Updater",
  })
).outputFiles[0].text;
const w = new Window();
w.document.write(
  '<dialog id="dialog"><div id="modal"></div></dialog><div id="toast"></div>',
);
const calls = [];
w.NativeOSP = {
  appInfo: () => JSON.stringify({ version: "7.2.0" }),
  updateState: () => JSON.stringify({ phase: "idle" }),
  checkForUpdates: (manual) => calls.push(["check", manual]),
  downloadUpdate: () => calls.push(["download"]),
  cancelUpdate: () => calls.push(["cancel"]),
  installDownloadedUpdate: () => calls.push(["install"]),
};
w.eval(bundle);
w.Updater.initializeUpdates();
assert.deepEqual(calls, [["check", false]]);
w.Updater.openUpdates();
w.Updater.updateAction("checkUpdates");
assert.deepEqual(calls.at(-1), ["check", true]);
const release = { version: "7.3.0", size: 1048576 };
const emit = (phase, extra = {}) =>
  w.nativeUpdate({
    phase,
    release,
    message: "estado",
    notes: "<img src=x onerror=alert(1)>",
    ...extra,
  });
emit("available");
assert.ok(w.document.querySelector("[data-action=downloadUpdate]"));
assert.equal(w.document.querySelector("#update-content img"), null);
w.Updater.updateAction("downloadUpdate");
assert.deepEqual(calls.at(-1), ["download"]);
emit("downloading", { progress: 42 });
assert.equal(w.document.querySelector("progress").value, 42);
assert.equal(w.document.querySelector("[data-action=downloadUpdate]"), null);
w.Updater.updateAction("cancelUpdate");
assert.deepEqual(calls.at(-1), ["cancel"]);
emit("cancelled");
assert.ok(w.document.querySelector("[data-action=downloadUpdate]"));
emit("error");
assert.ok(w.document.querySelector("[data-action=checkUpdates]"));
emit("ready");
assert.ok(w.document.querySelector("[data-action=installDownloadedUpdate]"));
w.Updater.updateAction("installDownloadedUpdate");
assert.deepEqual(calls.at(-1), ["install"]);
emit("incompatible");
assert.equal(w.document.querySelector("[data-action=downloadUpdate]"), null);
w.document.querySelector("#dialog").close();
w.document.querySelector("#toast").innerHTML = "";
emit("error", { manual: false });
assert.equal(w.document.querySelector("#toast").textContent, "");
await w.happyDOM.abort();
console.log(
  "Updates UI: manual/automatic checks, progress, cancellation, retry, installation, incompatible release and escaped notes passed.",
);
