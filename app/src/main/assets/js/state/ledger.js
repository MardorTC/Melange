import { model } from "./model.js";
import C from "../domain/finance.js";
import { writeStore } from "../platform/storage.js";
import { closeModal, toast, showError } from "../ui/components.js";
import { render } from "../ui/navigation.js";
import { finishFormDraft } from "../ui/form-drafts.js";
import { traceOperation } from "./operation-trace.js";

export function syncReminders() {
  if (window.NativeOSP)
    window.NativeOSP.configureReminders(
      JSON.stringify({
        enabled: model.state.settings.reminders,
        days: model.state.settings.reminderDays,
        time: model.state.settings.reminderTime,
        items: C.reminders(model.state),
      }),
    );
}

export async function commit(label, fn) {
  if (model.busy) {
    traceOperation("commit", "ignored-busy", model.revision);
    return;
  }
  const trace = traceOperation("commit", "start", model.revision);
  model.busy = true;
  const old = C.clone(model.state),
    oldHistory = model.history;
  let persisted = false;
  try {
    fn(model.state);
    C.validate(model.state);
    C.snapshot(model.state);
    const nextHistory = [
      ...model.history,
      { label, date: new Date().toISOString(), state: old },
    ].slice(-15);
    await writeStore({
      state: model.state,
      history: nextHistory,
      revision: model.revision + 1,
    });
    model.revision++;
    model.history = nextHistory;
    persisted = true;
    traceOperation("commit", "persisted", model.revision, trace);
    await finishFormDraft(true);
    syncReminders();
    closeModal();
    render();
    toast(label, true);
    return true;
  } catch (e) {
    traceOperation("commit", "failed", model.revision, trace);
    if (!persisted) {
      model.state = old;
      model.history = oldHistory;
      showError(e.message);
      return false;
    }
    // A notification/render failure must not undo an already durable write in
    // memory or invite the user to submit the same financial operation again.
    closeModal();
    toast(
      "El cambio se guardó. No se pudo actualizar la vista; vuelve a abrir la aplicación.",
    );
    return true;
  } finally {
    model.busy = false;
    traceOperation("commit", "idle", model.revision, trace);
  }
}

export async function undo() {
  if (!model.history.length || model.busy) {
    traceOperation(
      "undo",
      model.busy ? "ignored-busy" : "ignored-empty",
      model.revision,
    );
    return;
  }
  const trace = traceOperation("undo", "start", model.revision);
  model.busy = true;
  let persisted = false;
  try {
    const entry = model.history[model.history.length - 1],
      next = C.clone(entry.state);
    C.validate(next);
    await writeStore({
      state: next,
      history: model.history.slice(0, -1),
      revision: model.revision + 1,
    });
    model.revision++;
    model.state = next;
    model.history = model.history.slice(0, -1);
    persisted = true;
    traceOperation("undo", "persisted", model.revision, trace);
    await finishFormDraft();
    syncReminders();
    closeModal();
    render();
    toast("Se deshizo: " + entry.label);
  } catch (e) {
    traceOperation("undo", "failed", model.revision, trace);
    if (persisted) {
      closeModal();
      toast(
        "El cambio se deshizo. No se pudo actualizar la vista; vuelve a abrir la aplicación.",
      );
    } else toast("No se pudo deshacer: " + e.message);
  } finally {
    model.busy = false;
    traceOperation("undo", "idle", model.revision, trace);
  }
}
