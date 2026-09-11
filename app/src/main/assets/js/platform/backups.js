import { model } from "../state/model.js";
import C from "../domain/finance.js";
import { modal, money, esc, btn, toast } from "../ui/components.js";

export async function importRaw(raw) {
  try {
    model.importCandidate = C.migrate(
      typeof raw === "string" ? JSON.parse(raw) : raw,
    );
    const s = model.importCandidate;
    modal(
      "Revisar importación",
      `<p>Se reemplazarán los datos actuales por este respaldo. El estado anterior quedará en Deshacer.</p><div class="details"><div><small>Deudas</small>${s.debts.length}</div><div><small>Movimientos</small>${s.transactions.length}</div><div><small>Cuentas</small>${s.walletAccounts.length}</div><div><small>Disponible libre</small>${money(C.metrics(s).available)}</div></div><p class="note">${esc(s.migration?.note || "Respaldo compatible de Melange / ProjectOSP.")}</p>${btn("Importar estos datos", "confirmImport", "", "primary full")}`,
    );
  } catch (e) {
    toast("No se importó: " + e.message);
  }
}

window.receiveImport = importRaw;

export function doExport() {
  exportState(model.state);
}

export function exportState(exported, filename = "Melange") {
  const json = JSON.stringify(
    {
      format: "projectosp-backup",
      version: 8,
      exportedAt: new Date().toISOString(),
      state: exported,
    },
    null,
    2,
  );
  if (window.NativeOSP) window.NativeOSP.exportBackup(json);
  else {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + "-" + C.today() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
