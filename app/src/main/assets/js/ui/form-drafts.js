import { model } from "../state/model.js";
import { readFormDraft, writeFormDraft } from "../platform/storage.js";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let active;
const writes = new Map();
const controls = (form) =>
  [...form.elements].filter(
    (e) => e.name && ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName),
  );
function snapshot(session) {
  return {
    fields: controls(session.form).map((e) => ({
      name: e.name,
      value: e.value,
      ...(e.type === "checkbox" || e.type === "radio"
        ? { checked: e.checked }
        : {}),
      label:
        [...(e.closest("label")?.childNodes || [])]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent)
          .join("")
          .trim()
          .slice(0, 120) || e.name,
    })),
    structure: session.options.captureStructure?.() || null,
  };
}
function queue(key, value) {
  const task = (writes.get(key) || Promise.resolve())
    .catch(() => {})
    .then(() => writeFormDraft(key, value));
  writes.set(key, task);
  task
    .finally(() => {
      if (writes.get(key) === task) writes.delete(key);
    })
    .catch(() => {});
  return task;
}
function validDraft(value, session) {
  return (
    value?.version === (session.options.draftVersion || 1) &&
    value.bookId === session.bookId &&
    Number.isInteger(value.revision) &&
    Array.isArray(value.fields) &&
    value.fields.length <= 2000 &&
    value.fields.every(
      (f) =>
        typeof f.name === "string" &&
        f.name.length <= 240 &&
        typeof f.value === "string" &&
        f.value.length <= 20000 &&
        typeof f.label === "string",
    )
  );
}
function banner(session) {
  if (active !== session) return;
  const el = session.form.querySelector(".draft-status");
  if (!el) return;
  const saved = session.candidate;
  if (saved) {
    const stale = saved.revision !== model.revision;
    el.innerHTML = `<p>${stale ? "El libro cambió desde este borrador. No se aplicará sobre datos nuevos; puedes consultar lo que escribiste." : "Tienes un borrador sin registrar. Recuperarlo no guarda ningún movimiento."}</p><div class="actions">${stale ? "" : '<button type="button" class="btn" data-action="draftRestore">Recuperar borrador</button>'}<button type="button" class="btn" data-action="draftDiscard">Descartar borrador</button></div><details><summary>Ver datos del borrador</summary><dl>${saved.fields
      .filter((f) => f.value && f.checked !== false)
      .map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`)
      .join("")}</dl></details>`;
  } else
    el.innerHTML = session.error
      ? `<p role="alert">${esc(session.error)}</p>`
      : session.dirty
        ? '<p>Borrador guardado solo en este dispositivo. Aún no se ha registrado.</p><button type="button" class="btn link-btn" data-action="draftDiscardExit">Descartar y cerrar</button>'
        : "";
  el.hidden = !el.innerHTML;
}
async function persist(session) {
  if (
    !session.initial ||
    session.restoring ||
    session.discarding ||
    !session.form.isConnected
  )
    return;
  const data = snapshot(session);
  session.dirty = JSON.stringify(data) !== session.initial;
  if (!session.key) return;
  if (!session.dirty && !session.owned) return;
  session.owned = true;
  session.candidate = null;
  try {
    await queue(
      session.key,
      session.dirty
        ? {
            version: session.options.draftVersion || 1,
            bookId: session.bookId,
            revision: session.revision,
            date: Date.now(),
            ...data,
          }
        : null,
    );
    session.error = null;
  } catch (error) {
    session.error = error.message;
  }
  banner(session);
}
export function beginFormDraft(form, options, notify) {
  const session = {
    form,
    options,
    notify,
    bookId: model.state.id,
    revision: model.revision,
    key: options.draftKey ? `${model.state.id}:${options.draftKey}` : null,
    dirty: false,
    epoch: 0,
    initial: null,
  };
  active = session;
  queueMicrotask(async () => {
    if (active !== session || !form.isConnected) return;
    session.initial = JSON.stringify(snapshot(session));
    if (!session.key) return;
    try {
      const saved = await readFormDraft(session.key);
      if (active === session && !session.dirty && validDraft(saved, session)) {
        session.candidate = saved;
        banner(session);
      }
    } catch (error) {
      if (active === session) {
        session.error = error.message;
        banner(session);
      }
    }
  });
}

export function checkpointFormDraft() {
  return active ? persist(active) : Promise.resolve();
}

export async function canCloseForm() {
  const session = active;
  if (!session) return true;
  if (session.discarding) return false;
  const epoch = session.epoch;
  await persist(session);
  if (active !== session || session.discarding || session.epoch !== epoch)
    return false;
  if (!session.dirty) return true;
  if (session.key && !session.error) {
    session.notify(
      "Borrador guardado. Puedes recuperarlo al abrir este formulario.",
    );
    return true;
  }
  if (!session.form.querySelector(".discard-guard")) {
    session.form.insertAdjacentHTML(
      "beforeend",
      '<section class="discard-guard card" role="alert"><h3>Hay cambios sin guardar</h3><p>Si cierras ahora, perderás lo que escribiste.</p><div class="actions"><button type="button" class="btn primary" data-action="draftKeep">Seguir editando</button><button type="button" class="btn" data-action="draftDiscardExit">Descartar y cerrar</button></div></section>',
    );
  }
  session.form
    .querySelector(".discard-guard")
    .scrollIntoView?.({ block: "center" });
  session.form.querySelector('[data-action="draftKeep"]').focus();
  return false;
}

export async function finishFormDraft(saved = false) {
  const session = active;
  active = null;
  if (saved && session?.key) {
    // A failed cache cleanup must not roll back a committed financial write.
    // The revision guard also prevents replaying a draft after a crash here.
    try {
      await queue(session.key, null);
    } catch {
      session.notify(
        "El registro se guardó. No se pudo limpiar el borrador anterior; no se aplicará sobre los datos nuevos.",
      );
    }
  }
}

export async function draftAction(action) {
  const session = active;
  if (!session) return false;
  if (action === "draftKeep") {
    session.form.querySelector(".discard-guard")?.remove();
    return true;
  }
  if (action === "draftDiscard" || action === "draftDiscardExit") {
    if (session.discarding) return true;
    session.epoch++;
    session.discarding = true;
    session.form.inert = true;
    try {
      // Set the barrier before waiting: all previously queued writes precede
      // this deletion, and no new autosave may overtake it.
      if (session.key) await queue(session.key, null);
      session.candidate = null;
      session.owned = false;
      session.dirty = false;
      session.error = null;
      session.initial = JSON.stringify(snapshot(session));
      banner(session);
    } finally {
      session.discarding = false;
      session.form.inert = false;
    }
    return true;
  }
  if (action !== "draftRestore" || !session.candidate) return false;
  if (session.candidate.revision !== model.revision)
    throw Error(
      "El libro cambió. Consulta el borrador sin aplicarlo sobre datos nuevos.",
    );
  const saved = session.candidate;
  session.epoch++;
  session.restoring = true;
  try {
    session.options.restoreStructure?.(saved.structure);
    const elements = controls(session.form);
    for (const field of saved.fields) {
      const el = elements.find(
        (e) =>
          e.name === field.name &&
          (field.checked === undefined || e.value === field.value),
      );
      if (!el || el.disabled || el.readOnly) continue;
      if (field.checked !== undefined) el.checked = field.checked;
      else if (
        el.tagName !== "SELECT" ||
        [...el.options].some((o) => o.value === field.value)
      )
        el.value = field.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    session.options.onDraftRestore?.();
  } finally {
    session.restoring = false;
  }
  await persist(session);
  return true;
}

for (const name of ["input", "change", "formstructurechange"])
  document.addEventListener(name, (event) => {
    if (
      active &&
      (event.type === "formstructurechange" ||
        active.form.contains(event.target))
    ) {
      const session = active;
      queueMicrotask(() => {
        if (active === session) void persist(session);
      });
    }
  });
