import { model } from "../state/model.js";
import C from "../domain/finance.js";
import { modal, money, esc, btn, toast, closeModal } from "../ui/components.js";
import { writeRecoveryStore } from "./storage.js";

// The bytes of the UTF-8 file are the only measure shared by these paths:
// browser File.size, JSON.stringify + TextEncoder, and the native streams.
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const LAST_BACKUP_KEY = "melange.last-backup";
let recoveryAppliedHandler = null;
let pendingExport = null;
let backupGeneration = C.id();

export function decodeBackupBytes(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw Error("El archivo no es UTF-8 válido. No se modificaron sus datos.");
  }
}

export function setRecoveryAppliedHandler(handler) {
  recoveryAppliedHandler = handler;
}

export function utf8Bytes(value) {
  const text = typeof value === "string" ? value : String(value);
  return typeof TextEncoder === "function"
    ? new TextEncoder().encode(text).length
    : new Blob([text]).size;
}

export function assertBackupSize(text, limit = MAX_BACKUP_BYTES) {
  const bytes = utf8Bytes(text);
  if (bytes > limit)
    throw Error(
      `El respaldo supera el límite de ${formatBytes(limit)} y no podría volver a importarse.`,
    );
  return bytes;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

function serializeBackup(exported) {
  return JSON.stringify(
    {
      format: "projectosp-backup",
      version: 10,
      exportedAt: new Date().toISOString(),
      state: exported,
    },
    null,
    2,
  );
}

function parseCandidate(raw, limit = MAX_BACKUP_BYTES) {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (typeof text !== "string")
    throw Error("El archivo no contiene un respaldo válido.");
  assertBackupSize(text, limit);
  return C.migrate(typeof raw === "string" ? JSON.parse(raw) : raw);
}

export async function importRaw(raw) {
  try {
    const candidate = parseCandidate(raw);
    const recovery = !model.state;
    model.importCandidate = candidate;
    const confirm = recovery
      ? '<button class="btn primary full" data-recovery-action="confirm-import">Importar estos datos</button>'
      : btn("Importar estos datos", "confirmImport", "", "primary full");
    modal(
      recovery ? "Importar respaldo" : "Revisar importación",
      `<p>${recovery ? "Se reemplazarán los datos guardados por este respaldo, solo después de que lo confirmes. La app no ha creado ni guardado un libro vacío." : "Se reemplazarán los datos actuales por este respaldo. El estado anterior quedará en Deshacer."}</p><div class="details"><div><small>Deudas</small>${candidate.debts.length}</div><div><small>Movimientos</small>${candidate.transactions.length}</div><div><small>Cuentas</small>${candidate.walletAccounts.length}</div><div><small>Disponible libre</small>${money(C.metrics(candidate).available)}</div></div><p class="note">${esc(candidate.migration?.note || "Respaldo compatible de Melange / ProjectOSP.")}</p>${confirm}`,
    );
  } catch (e) {
    toast("No se importó: " + e.message);
  }
}

window.receiveImport = importRaw;

export function chooseImport() {
  if (window.NativeOSP?.importBackup) {
    window.NativeOSP.importBackup();
    return;
  }
  const input = document.querySelector("#importFile");
  if (!input) throw Error("No se encontró el selector de archivos.");
  input.click();
}

export async function applyRecoveryImport() {
  if (model.busy) return;
  if (!model.importCandidate)
    throw Error("No hay un respaldo revisado para importar.");
  model.busy = true;
  try {
    const state = C.clone(model.importCandidate);
    C.ensureBudget(state);
    C.validate(state);
    const envelope = { state, history: [], revision: 0 };
    // A confirmed recovery may replace a corrupt vault. When the native bridge
    // exposes writeRecovery, it preserves the damaged original instead of
    // letting the regular save path reject it and leave the user stuck.
    await writeRecoveryStore(envelope);
    backupGeneration = C.id();
    model.importCandidate = null;
    closeModal();
    if (recoveryAppliedHandler) await recoveryAppliedHandler(envelope);
    else window.location.reload();
  } finally {
    model.busy = false;
  }
}

export function doExport() {
  try {
    exportState(model.state);
  } catch (e) {
    toast("No se exportó: " + e.message);
  }
}

export function exportState(exported, filename = "Melange", limit) {
  if (pendingExport)
    throw Error(
      "Ya hay una exportación en curso. Espera a que termine o cancélala.",
    );
  const json = serializeBackup(exported);
  const bytes = assertBackupSize(json, limit);
  // Reimport the exact serialized envelope before offering it as a backup.
  C.migrate(JSON.parse(json));
  if (window.NativeOSP) {
    pendingExport = {
      bookId: exported?.id || model.state?.id || "",
      revision: model.revision,
      generation: backupGeneration,
      token: C.id(),
    };
    try {
      window.NativeOSP.exportBackup(json, pendingExport.token);
    } catch (error) {
      pendingExport = null;
      throw error;
    }
    return { bytes, filename };
  }
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + "-" + C.today() + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Descarga solicitada. Comprueba que el archivo se guardó.");
  return { bytes, filename };
}

function readLastBackup() {
  try {
    const raw = window.localStorage?.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (
      !record ||
      !Number.isFinite(record.at) ||
      !Number.isInteger(record.bytes) ||
      record.bytes <= 0 ||
      record.bytes > MAX_BACKUP_BYTES ||
      typeof record.bookId !== "string" ||
      !record.bookId ||
      !Number.isInteger(record.revision) ||
      record.revision < 0
    )
      return null;
    return record;
  } catch {
    return null;
  }
}

export function lastBackupStatus(current = model.state) {
  const record = readLastBackup();
  if (!record || !current || record.bookId !== current.id)
    return {
      confirmed: false,
      stale: false,
      text: "Sin respaldo confirmado en este dispositivo.",
    };
  const date = new Date(record.at);
  if (!Number.isFinite(date.getTime()))
    return {
      confirmed: false,
      stale: false,
      text: "Sin respaldo confirmado en este dispositivo.",
    };
  const uncertain = record.generation !== backupGeneration;
  const stale = uncertain || record.revision !== model.revision;
  return {
    confirmed: true,
    stale,
    at: record.at,
    bytes: record.bytes,
    text: `${date.toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    })} · ${formatBytes(record.bytes)}${uncertain ? " · vigencia por verificar" : stale ? " · hay cambios posteriores" : " · al día"}`,
  };
}

window.nativeBackupResult = (ok, message, bytes, timestamp, token) => {
  if (!pendingExport || pendingExport.token !== token) return false;
  const exported = pendingExport;
  pendingExport = null;
  if (!ok) {
    toast(message || "No se guardó el respaldo.");
    return false;
  }
  const size = Number(bytes);
  if (
    !exported ||
    !Number.isInteger(size) ||
    size <= 0 ||
    size > MAX_BACKUP_BYTES
  ) {
    toast("El respaldo se guardó, pero la app no pudo confirmar sus datos.");
    return false;
  }
  try {
    window.localStorage?.setItem(
      LAST_BACKUP_KEY,
      JSON.stringify({
        at: Number(timestamp) || Date.now(),
        bytes: size,
        bookId: exported.bookId,
        revision: exported.revision,
        generation: exported.generation,
      }),
    );
  } catch {
    // The file is saved; only the optional local status could not be stored.
  }
  toast("Respaldo guardado.");
  return true;
};
