import { selectHistoryPoint } from "./ui/charts.js";
import { initializeUpdates } from "./platform/updates.js";
import C from "./domain/finance.js";
import { model } from "./state/model.js";
import {
  showError,
  $,
  toast,
  dialog,
  closeModal,
  requestCloseModal,
  view,
  esc,
} from "./ui/components.js";
import { action } from "./ui/actions.js";
import { render, fullScreens, backPage } from "./ui/navigation.js";
import {
  importRaw,
  decodeBackupBytes,
  chooseImport,
  applyRecoveryImport,
  setRecoveryAppliedHandler,
  MAX_BACKUP_BYTES,
} from "./platform/backups.js";
import { openStore, readStore, writeStore } from "./platform/storage.js";
import { syncReminders } from "./state/ledger.js";
import { updateCardPreview } from "./screens/credit.js";
import { syncReserveFields } from "./ui/forms.js";

document.addEventListener("change", (e) => {
  if (e.target.matches("[data-reserve-kind]")) syncReserveFields();
  if (e.target.name === "unit") {
    const twice = e.target.value === "twiceMonthly";
    const interval = document.querySelector("[data-recurrence-interval]");
    const days = document.querySelector("[data-recurrence-days]");
    if (interval && days) {
      interval.hidden = twice;
      days.hidden = !twice;
      interval.querySelector('[name="interval"]').required = !twice;
    }
  }
  if (
    e.target.name === "accountId" &&
    document.querySelector("#credit-purchase-fields")
  )
    document.querySelector("#credit-purchase-fields").hidden =
      !e.target.value.startsWith("credit:");
  if (
    e.target.name === "type" &&
    document.querySelector("#wallet-restrictions")
  )
    document.querySelector("#wallet-restrictions").hidden =
      e.target.value !== "restricted";
});

("use strict");

document.addEventListener("click", (e) => {
  const point = e.target.closest("[data-chart-point]");
  if (point) {
    selectHistoryPoint(point);
    return;
  }
  const el = e.target.closest("[data-action]");
  if (el)
    Promise.resolve(action(el.dataset.action, el.dataset.id || "", el)).catch(
      (e) => showError(e.message),
    );
});

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form") return;
  e.preventDefault();
  const callback = model.formSubmit;
  if (!callback || model.busy) return;
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  try {
    await callback(Object.fromEntries(new FormData(e.target)));
  } catch (err) {
    showError(err.message);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});

document.addEventListener("input", (e) => {
  if (
    e.target.closest("#card-installments") ||
    e.target.name === "openingBalance" ||
    e.target.name === "paymentDay"
  )
    updateCardPreview();
  if (e.target.matches("[data-chart-slider]")) {
    selectHistoryPoint(
      e.target.closest(".history-chart").querySelectorAll("[data-chart-point]")[
        Number(e.target.value)
      ],
    );
    return;
  }
  if (e.target.id === "search") {
    const pos = e.target.selectionStart;
    model.filter.q = e.target.value;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  }
});

$("#importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (f) {
    if (f.size > MAX_BACKUP_BYTES)
      toast(`El respaldo supera ${MAX_BACKUP_BYTES / 1024 / 1024} MB.`);
    else {
      try {
        await importRaw(decodeBackupBytes(await f.arrayBuffer()));
      } catch (error) {
        toast("No se pudo leer el archivo: " + error.message);
      }
    }
  }
  e.target.value = "";
});

dialog.addEventListener("click", (e) => {
  if (e.target === dialog && e.clientY < dialog.getBoundingClientRect().top)
    void requestCloseModal();
});

dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  void requestCloseModal();
});

window.handleBack = () => {
  if (dialog.open) {
    void requestCloseModal();
    return true;
  }
  if (fullScreens.includes(model.tab)) {
    backPage();
    return true;
  }
  if (model.tab !== "home") {
    model.tab = "home";
    render();
    return true;
  }
  return false;
};

let starting = false;
let updatesReady = false;

function startUpdates() {
  if (updatesReady) return;
  updatesReady = true;
  initializeUpdates();
}

setRecoveryAppliedHandler(async (envelope) => {
  model.state = envelope.state;
  model.history = envelope.history;
  model.revision = envelope.revision;
  model.tab = "home";
  model.period = C.month();
  C.ensureBudget(model.state);
  render();
  syncReminders();
  startUpdates();
  toast("Respaldo importado");
});

function showStartupError(error, stage) {
  $("#nav").innerHTML = "";
  $("#topbar").innerHTML = "";
  $("#topbar").setAttribute("aria-hidden", "true");
  const title =
    stage === "write"
      ? "No se pudo confirmar el guardado"
      : stage === "render"
        ? "Los datos se abrieron, pero la pantalla falló"
        : "No se pudieron abrir los datos";
  const detail =
    stage === "render"
      ? "El libro guardado no se ha borrado. Reintenta abrir la app."
      : "El libro guardado no se ha reemplazado ni borrado, y la app no ha creado un libro vacío.";
  view.innerHTML = `<div class="card danger-zone" role="alert"><h1>${esc(title)}</h1><p>${esc(error?.message || "Error desconocido")}</p><p>${detail} Reintenta o importa un respaldo revisado.</p><div class="toolbar wrap"><button class="btn primary" data-recovery-action="retry">Reintentar</button><button class="btn" data-recovery-action="import">Importar respaldo</button></div><p class="note">Importar reemplaza el libro guardado solo después de una confirmación. Si el problema continúa, no desinstales la app: podrías perder los datos locales.</p></div>`;
}

async function start() {
  if (starting) return;
  starting = true;
  model.state = undefined;
  model.history = [];
  model.revision = 0;
  let stage = "read";
  try {
    await openStore();
    const saved = C.migrateEnvelope(await readStore());
    model.state = saved ? C.validate(saved.state) : C.empty();
    model.history = saved?.history || [];
    model.revision = saved?.revision || 0;
    C.ensureBudget(model.state);
    if (saved && model.state.started) C.snapshot(model.state);
    // Persist the identity of an empty book too: onboarding drafts must still
    // belong to the same book after a process restart, before its first commit.
    stage = "write";
    await writeStore({
      state: model.state,
      history: model.history,
      revision: model.revision,
    });
    stage = "render";
    render();
    syncReminders();
    startUpdates();
  } catch (e) {
    // Recovery never keeps a partial in-memory book: importing from here uses
    // the explicit replace path, and retry rereads the untouched vault.
    model.state = undefined;
    model.history = [];
    model.revision = 0;
    showStartupError(e, stage);
  } finally {
    starting = false;
  }
}

document.addEventListener("click", async (event) => {
  const control = event.target.closest("[data-recovery-action]");
  if (!control) return;
  try {
    if (control.dataset.recoveryAction === "retry") await start();
    else if (control.dataset.recoveryAction === "import") chooseImport();
    else if (control.dataset.recoveryAction === "confirm-import")
      await applyRecoveryImport();
  } catch (error) {
    toast("No se pudo continuar: " + error.message);
  }
});

void start();
