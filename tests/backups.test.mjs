import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { Window } from "happy-dom";
import C from "../app/src/main/assets/js/domain/finance.js";

const html = fs
  .readFileSync("app/src/main/assets/index.html", "utf8")
  .replace(/<script[^>]*>.*?<\/script>/g, "");
const bootBundle = (
  await build({
    entryPoints: ["app/src/main/assets/js/bootstrap.js"],
    bundle: true,
    write: false,
    format: "iife",
  })
).outputFiles[0].text;
const backupsBundle = (
  await build({
    stdin: {
      contents: 'export * from "./app/src/main/assets/js/platform/backups.js";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "Backups",
  })
).outputFiles[0].text;

function makeWindow() {
  const window = new Window({
    url: "https://appassets.androidplatform.net/index.html",
  });
  window.TextDecoder = TextDecoder;
  return window;
}

function nativeStub(overrides = {}) {
  return {
    read: () => "",
    write: () => "OK",
    readFormDraft: () => "",
    writeFormDraft: () => "OK",
    configureReminders: () => {},
    notificationStatus: () => "",
    exportBackup: () => {},
    importBackup: () => {},
    requestNotifications: () => {},
    appInfo: () => JSON.stringify({ version: "8.5.0" }),
    updateState: () => JSON.stringify({ phase: "idle" }),
    checkForUpdates: () => {},
    ...overrides,
  };
}

function waitFor(predicate) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (predicate()) return resolve();
      if (++attempts >= 200) return reject(Error("Timed out"));
      setTimeout(check, 5);
    };
    check();
  });
}

function validState() {
  const state = C.empty();
  C.startLedger(state, {
    banks: [{ name: "Banco", balance: 1000 }],
    income: 2000,
  });
  return state;
}

test("backup limits count UTF-8 bytes, not UTF-16 characters", async () => {
  const w = makeWindow();
  w.document.write(html);
  w.NativeOSP = nativeStub();
  w.eval(backupsBundle);
  assert.equal(w.Backups.MAX_BACKUP_BYTES, 20 * 1024 * 1024);
  assert.equal(w.Backups.utf8Bytes("ñ"), 2);
  assert.equal(w.Backups.assertBackupSize("ñ", 2), 2);
  assert.throws(() => w.Backups.assertBackupSize("ñ", 1), /límite/);
  assert.equal(w.Backups.decodeBackupBytes(new Uint8Array([0xc3, 0xb1])), "ñ");
  assert.equal(
    w.Backups.decodeBackupBytes(new Uint8Array([0xef, 0xbb, 0xbf, 123, 125])),
    "{}",
  );
  assert.throws(
    () => w.Backups.decodeBackupBytes(new Uint8Array([0xff])),
    /UTF-8/,
  );
  await w.happyDOM.abort();
});

test("export refuses files over the import limit and only confirms native writes", async () => {
  const w = makeWindow();
  w.document.write(html);
  let exported = null;
  let token = null;
  w.NativeOSP = nativeStub({
    exportBackup: (json, requestToken) => {
      exported = json;
      token = requestToken;
    },
  });
  w.eval(backupsBundle);
  const state = validState();
  assert.throws(() => w.Backups.exportState(state, "Melange", 10), /límite/);
  assert.equal(exported, null);
  assert.equal(w.Backups.lastBackupStatus(state).confirmed, false);

  const result = w.Backups.exportState(state);
  assert.ok(exported);
  assert.ok(result.bytes > 0);
  assert.equal(w.Backups.lastBackupStatus(state).confirmed, false);

  assert.throws(() => w.Backups.exportState(state), /exportación en curso/);
  w.nativeBackupResult(false, "Exportación cancelada.", 0, Date.now(), token);
  assert.equal(w.Backups.lastBackupStatus(state).confirmed, false);

  w.Backups.exportState(state);
  assert.equal(
    w.nativeBackupResult(
      true,
      "Respuesta antigua",
      result.bytes,
      Date.now(),
      "old-token",
    ),
    false,
  );
  assert.equal(w.Backups.lastBackupStatus(state).confirmed, false);
  w.nativeBackupResult(
    true,
    "Respaldo guardado.",
    result.bytes,
    Date.now(),
    token,
  );
  const status = w.Backups.lastBackupStatus(state);
  assert.equal(status.confirmed, true);
  assert.match(status.text, /al día/);
  const record = w.localStorage.getItem("melange.last-backup");
  const nextWindow = makeWindow();
  nextWindow.document.write(html);
  nextWindow.NativeOSP = nativeStub();
  nextWindow.localStorage.setItem("melange.last-backup", record);
  nextWindow.eval(backupsBundle);
  const afterRestart = nextWindow.Backups.lastBackupStatus(state);
  assert.equal(afterRestart.stale, true);
  assert.match(afterRestart.text, /vigencia por verificar/);
  await nextWindow.happyDOM.abort();
  await w.happyDOM.abort();
});

test("startup read errors show recovery, write nothing and import only after confirmation", async () => {
  const w = makeWindow();
  w.document.write(html);
  let normalWrites = 0;
  let recoveryWrites = 0;
  let recovered = null;
  w.NativeOSP = nativeStub({
    read: () => "ERROR:No se pudo leer la base local.",
    write: () => {
      normalWrites++;
      return "OK";
    },
    writeRecovery: (json) => {
      recoveryWrites++;
      recovered = json;
      return "OK";
    },
  });
  w.eval(bootBundle);
  await waitFor(() =>
    w.document.querySelector('[data-recovery-action="retry"]'),
  );

  const view = w.document.querySelector("#view");
  assert.match(view.textContent, /No se pudieron abrir los datos/);
  assert.match(view.textContent, /no ha creado un libro vacío/);
  assert.ok(w.document.querySelector('[data-recovery-action="import"]'));
  assert.equal(normalWrites, 0);

  const state = validState();
  w.receiveImport(JSON.stringify({ format: "projectosp-backup", state }));
  await waitFor(() =>
    w.document.querySelector('[data-recovery-action="confirm-import"]'),
  );
  assert.match(
    w.document.querySelector("#modal").textContent,
    /no ha creado ni guardado un libro vacío/,
  );
  w.document.querySelector('[data-recovery-action="confirm-import"]').click();
  await waitFor(
    () =>
      recovered !== null &&
      !w.document.querySelector('[data-recovery-action="retry"]'),
  );

  assert.equal(normalWrites, 0);
  assert.equal(recoveryWrites, 1);
  const envelope = JSON.parse(recovered);
  assert.equal(envelope.state.id, state.id);
  assert.deepEqual(envelope.history, []);
  assert.equal(envelope.revision, 0);
  assert.doesNotMatch(
    w.document.querySelector("#toast").textContent,
    /No se pudo continuar/,
  );
  await w.happyDOM.abort();
});

test("a rejected recovery write stays on the recovery screen without claiming success", async () => {
  const w = makeWindow();
  w.document.write(html);
  w.NativeOSP = nativeStub({
    read: () => "ERROR:No se pudo leer la base local.",
    write: () =>
      "ERROR:No se guardó el cambio: Estado anterior incompatible; no se reemplazó",
  });
  w.eval(bootBundle);
  await waitFor(() =>
    w.document.querySelector('[data-recovery-action="retry"]'),
  );
  const state = validState();
  const before = w.document.querySelector("#view").textContent;
  w.receiveImport(JSON.stringify({ format: "projectosp-backup", state }));
  await waitFor(() =>
    w.document.querySelector('[data-recovery-action="confirm-import"]'),
  );
  w.document.querySelector('[data-recovery-action="confirm-import"]').click();
  await waitFor(() =>
    /No se pudo continuar/.test(w.document.querySelector("#toast").textContent),
  );
  assert.match(w.document.querySelector("#view").textContent, /Reintentar/);
  assert.doesNotMatch(
    w.document.querySelector("#toast").textContent,
    /importado/,
  );
  assert.match(before, /No se pudieron abrir los datos/);
  await w.happyDOM.abort();
});
