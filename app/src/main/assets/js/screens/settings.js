import { icon, esc, svg, money, screenHead } from "../ui/components.js";
import { model } from "../state/model.js";

export function settingsPage() {
  const version = window.NativeOSP?.appInfo
    ? JSON.parse(window.NativeOSP.appInfo()).version
    : "Vista previa";
  const reminders = model.state.settings.reminders;
  return (
    screenHead("Ajustes", "Tu información y tus respaldos.", { back: true }) +
    `<div class="settings-section-title">Tu base</div>
    <section class="card settings-group">
      ${row("Ajustar saldos", "Corrige el saldo real de tus cuentas.", "balances", "", svg("wallet"))}
      ${row("Ingreso previsto", "Presupuesto mensual, no dinero recibido.", "expectedIncome", money(model.state.income), svg("trending"))}
    </section>
    <div class="settings-section-title">Preferencias</div>
    <section class="card settings-group">
      ${row("Recordatorios", reminders ? "Avisos locales activados." : "Sin avisos de pago.", "reminders", reminders ? "Activos" : "Inactivos", svg("notifications"))}
    </section>
    <div class="settings-section-title">Catálogos</div>
    <details class="card catalog-details">
      <summary>Acreedores<span>${model.state.creditors.length}</span></summary>
      <div class="catalog-list">${model.state.creditors.map((a) => `<div class="catalog-row"><span>${esc(a.name)}</span><div class="actions">${icon("edit", "Editar acreedor", "editAccount", a.id)}${icon("trash", "Eliminar acreedor", "deleteAccount", a.id)}</div></div>`).join("") || '<p class="muted">Sin acreedores.</p>'}</div>
      <button class="btn full" data-action="editAccount">${svg("plus")} Agregar acreedor</button>
    </details>
    <details class="card catalog-details">
      <summary>Categorías<span>${model.state.categories.length}</span></summary>
      <div class="catalog-list">${model.state.categories.map((a) => `<div class="catalog-row"><span>${esc(a.name)}</span><div class="actions">${icon("edit", "Editar categoría", "editCategory", a.id)}${icon("trash", "Eliminar categoría", "deleteCategory", a.id)}</div></div>`).join("")}</div>
      <button class="btn full" data-action="editCategory">${svg("plus")} Agregar categoría</button>
    </details>
    <div class="settings-section-title">Datos</div>
    <section class="card settings-group">
      ${row("Exportar respaldo", "Copia manual de todo tu libro.", "export", "", svg("download"))}
      ${row("Importar respaldo", "Reemplaza los datos con un archivo.", "import", "", svg("upload"))}
      ${row("Historial y deshacer", "Últimos 15 cambios guardados.", "history", "", svg("history"))}
      ${row("Buscar actualizaciones", "Revisa si hay una versión nueva.", "update", "", svg("update"))}
    </section>
    <section class="card about-card">
      <div class="row"><div><h2>Melange</h2><small>Finanzas personales, sin cuenta ni servidor.</small></div><span class="visual-icon goal">${svg("goal")}</span></div>
      <p class="note">Versión ${esc(version)} · Android · Base local SQLite. Sin sincronización automática: tus respaldos son copias manuales.</p>
      ${model.state.migration ? '<p class="note">Migración v6: los gastos anteriores ya están incluidos en el saldo inicial. No se descontaron otra vez.</p>' : ""}
    </section>`
  );
}

function row(title, subtitle, action, value, iconSvg) {
  return `<button class="settings-row" data-action="${action}" aria-label="${esc(title)}"><span class="row-icon gray">${iconSvg}</span><span class="settings-copy"><strong>${title}</strong><small>${subtitle}</small></span><span class="settings-value">${value}</span><span class="row-chevron">${svg("chevron")}</span></button>`;
}
