import { model } from "./model.js";
import C from "../domain/finance.js";
import { writeStore } from "../platform/storage.js";
import { closeModal, toast, showError } from "../ui/components.js";
import { render } from "../ui/navigation.js";

export function syncReminders() {
  if (window.NativeOSP)
    window.NativeOSP.configureReminders(
      JSON.stringify({
        enabled: model.state.settings.reminders,
        days: model.state.settings.reminderDays,
        items: C.reminders(model.state),
      }),
    );
}

export async function commit(label, fn) {
  if (model.busy) return;
  model.busy = true;
  const old = C.clone(model.state),
    oldHistory = model.history;
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
      draft: model.rebuildDraft,
      revision: model.revision + 1,
    });
    model.revision++;
    model.history = nextHistory;
    syncReminders();
    closeModal();
    render();
    toast(label, true);
    return true;
  } catch (e) {
    model.state = old;
    model.history = oldHistory;
    showError(e.message);
    return false;
  } finally {
    model.busy = false;
  }
}

export async function undo() {
  if (!model.history.length || model.busy) return;
  model.busy = true;
  try {
    const entry = model.history[model.history.length - 1],
      next = C.clone(entry.state);
    C.validate(next);
    await writeStore({
      state: next,
      history: model.history.slice(0, -1),
      draft: model.rebuildDraft,
      revision: model.revision + 1,
    });
    model.revision++;
    model.state = next;
    model.history = model.history.slice(0, -1);
    syncReminders();
    closeModal();
    render();
    toast("Se deshizo: " + entry.label);
  } catch (e) {
    toast("No se pudo deshacer: " + e.message);
  } finally {
    model.busy = false;
  }
}
