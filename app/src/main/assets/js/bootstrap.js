import { selectHistoryPoint } from "./ui/charts.js";
import H from "./domain/reconstruction.js";
import { initializeUpdates } from "./platform/updates.js";
import C from "./domain/finance.js";
import { model } from "./state/model.js";
import { chooseRebuildPayment } from "./screens/reconstruction.js";
import {
  showError,
  $,
  toast,
  dialog,
  closeModal,
  view,
  esc,
} from "./ui/components.js";
import { action } from "./ui/actions.js";
import { render, fullScreens, backPage } from "./ui/navigation.js";
import { importRaw } from "./platform/backups.js";
import { openStore, readStore, writeStore } from "./platform/storage.js";
import { syncReminders } from "./state/ledger.js";

document.addEventListener("change", (e) => {
  if (
    e.target.name === "type" &&
    document.querySelector("#wallet-restrictions")
  )
    document.querySelector("#wallet-restrictions").hidden =
      e.target.value !== "restricted";
  if (e.target.name === "rebuildMonth") {
    const m = e.target.value;
    if (m < C.month(model.rebuildDraft.config.startDate) || m > C.month())
      return;
    try {
      chooseRebuildPayment(m);
    } catch (error) {
      showError(error.message);
    }
  }
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
  } else if (e.target.dataset.money) {
    const el = e.target,
      raw = el.value.replace(/[^\d.]/g, ""),
      parts = raw.split(".");
    if (parts.length > 2) parts.splice(2);
    const whole = parts[0]
      .replace(/^0+(?=\d)/, "")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    el.value = whole + (parts.length > 1 ? "." + parts[1].slice(0, 2) : "");
  }
});

document.addEventListener("change", (e) => {
  if (e.target.closest("#filters")) {
    model.filter[e.target.name] = e.target.value;
    render();
  }
});

$("#importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (f) {
    if (f.size > 20 * 1024 * 1024) toast("El respaldo supera 20 MB.");
    else await importRaw(await f.text());
  }
  e.target.value = "";
});

dialog.addEventListener("click", (e) => {
  if (e.target === dialog && e.clientY < dialog.getBoundingClientRect().top)
    closeModal();
});

window.handleBack = () => {
  if (dialog.open) {
    closeModal();
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

(async () => {
  try {
    await openStore();
    const saved = C.migrateEnvelope(await readStore());
    if (saved?.draft) H.build(saved.draft);
    model.state = saved ? C.validate(saved.state) : C.empty();
    model.history = saved?.history || [];
    model.rebuildDraft = saved?.draft || null;
    model.revision = saved?.revision || 0;
    C.ensureBudget(model.state);
    if (saved) {
      C.snapshot(model.state);
      await writeStore({
        state: model.state,
        history: model.history,
        draft: model.rebuildDraft,
        revision: model.revision,
      });
    }
    render();
    syncReminders();
    initializeUpdates();
  } catch (e) {
    view.innerHTML = `<div class="card danger-zone"><h1>No se pudieron abrir los datos</h1><p>${esc(e.message)}</p><p>No se han reemplazado ni borrado. Cierra la app y vuelve a intentarlo.</p></div>`;
  }
})();
