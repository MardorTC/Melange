import { btn, esc, modal, toast } from "../ui/components.js";
let status = { phase: "idle", message: "" };
let opened = false;
const active = new Set(["checking", "downloading", "verifying"]);
function contents() {
  const native = window.NativeOSP;
  if (!native?.checkForUpdates)
    return "<p>Las actualizaciones están disponibles en la app Android.</p>";
  const installed =
    status.installedVersion || JSON.parse(native.appInfo()).version;
  const release = status.phase === "current" ? null : status.release;
  return `<p>Versión instalada: ${esc(installed)}</p><p role="status">${esc(status.message || "Consulta si hay una nueva versión.")}</p>
 ${release ? `<p>Disponible: ${esc(release.version)} · ${(release.size / 1024 / 1024).toFixed(1)} MB</p><pre class="release-notes">${esc(status.notes || "Sin notas de versión.")}</pre>` : ""}
 ${status.phase === "downloading" ? `<progress max="100" value="${status.progress}" aria-label="Descarga">${status.progress}%</progress><p>${status.progress}%</p>` : ""}
 <div class="toolbar">
 ${!active.has(status.phase) ? btn("Buscar actualizaciones", "checkUpdates") : ""}
 ${release && ["available", "cancelled", "error"].includes(status.phase) ? btn("Descargar actualización", "downloadUpdate", "", "primary") : ""}
 ${["downloading", "verifying"].includes(status.phase) ? btn("Cancelar descarga", "cancelUpdate") : ""}
 ${status.phase === "ready" ? btn("Instalar actualización", "installDownloadedUpdate", "", "primary") : ""}
 </div><p class="note">La descarga es voluntaria. Android pedirá confirmar la instalación y conservará tus datos.</p>
 ${btn("Seleccionar APK", "pickApk")}`;
}
function draw() {
  const el = document.querySelector("#update-content");
  if (el) el.innerHTML = contents();
}
export function openUpdates() {
  opened = true;
  if (window.NativeOSP?.updateState)
    status = JSON.parse(window.NativeOSP.updateState());
  modal("Actualizaciones", '<div id="update-content">' + contents() + "</div>");
}
export function updateAction(action) {
  const native = window.NativeOSP;
  if (action === "update") {
    openUpdates();
    return true;
  }
  const methods = {
    checkUpdates: () => native?.checkForUpdates(true),
    downloadUpdate: () => native?.downloadUpdate(),
    cancelUpdate: () => native?.cancelUpdate(),
    installDownloadedUpdate: () => native?.installDownloadedUpdate(),
  };
  if (methods[action]) {
    methods[action]();
    return true;
  }
  return false;
}
export function initializeUpdates() {
  window.nativeUpdate = (next) => {
    const previous = status.phase;
    status = next;
    const visible =
      opened &&
      document.querySelector("#dialog")?.open &&
      document.querySelector("#update-content");
    if (visible) draw();
    else if (next.phase === "available" && previous !== "available")
      toast(
        "Hay una actualización disponible. Puedes descargarla desde Ajustes.",
      );
  };
  if (window.NativeOSP?.updateState)
    window.nativeUpdate(JSON.parse(window.NativeOSP.updateState()));
  window.NativeOSP?.checkForUpdates?.(false);
}
