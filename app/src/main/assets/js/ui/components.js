import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";

export function pageHeading(title, subtitle = "") {
  return `<div class="full-heading"><button class="btn back-btn" data-action="screenBack">${svg("back")} Volver</button><div><div class="eyebrow">${subtitle}</div><h1>${title}</h1></div></div>`;
}

export function signedMoney(value) {
  const raw = String(value ?? "").replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{0,2})?$/.test(raw))
    throw Error("Escribe un saldo con hasta dos decimales.");
  return C.cents(raw);
}

export function signedField(name, label, value = "") {
  return input(
    name,
    label,
    value,
    "text",
    'inputmode="decimal" required placeholder="0.00"',
  );
}

export const $ = (s) => document.querySelector(s);

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

export const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    (n || 0) / 100,
  );

export const mlabel = (m) =>
  new Date(m + "-15T12:00:00").toLocaleDateString("es-MX", {
    month: "short",
    year: "numeric",
  });

export const icons = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  expense: "M5 3h14v18l-3-2-4 2-4-2-3 2ZM8 8h8M8 12h5",
  debt: "M3 6h18v14H3ZM3 10h18M6 16h4",
  calendar: "M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2",
  goal: "M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12l8-8M16 4h4v4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  transfer: "M3 7h17l-4-4M21 17H4l4 4",
  edit: "m4 16 12-12 4 4L8 20H4ZM13 7l4 4",
  trash: "M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6",
  eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  pay: "M4 6h16v14H4ZM8 13l3 3 5-6",
  close: "m6 6 12 12M6 18 18 6",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  back: "m15 5-7 7 7 7",
};

export const svg = (k) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[k] || icons.plus}"/></svg>`;

export const icon = (k, title, action, id = "", extra = "") =>
  `<button class="icon ${k === "trash" ? "danger" : ""}" aria-label="${esc(title)}" title="${esc(title)}" data-action="${action}" data-id="${esc(id)}" ${extra}>${svg(k)}</button>`;

export const btn = (text, action, id = "", cls = "") =>
  `<button class="btn ${cls}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;

export const view = $("#view");

export const dialog = $("#dialog");

export function toast(text, undoable = false) {
  clearTimeout(model.toastTimer);
  $("#toast").innerHTML =
    `<span>${esc(text)}</span>${undoable ? '<button data-action="undo">Deshacer</button>' : ""}`;
  $("#toast").classList.add("visible");
  model.toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    8000,
  );
}

export function showError(message) {
  const el = $(".form-error");
  if (el) el.textContent = message;
  else toast(message);
}

export function modal(title, html, submit) {
  model.formSubmit = submit || null;
  $("#modal").innerHTML =
    `<div class="row"><h2>${esc(title)}</h2>${icon("close", "Cerrar", "close")}</div>${html}`;
  if (!dialog.open) dialog.showModal();
}

export function closeModal() {
  dialog.close();
  model.formSubmit = null;
}

export function form(title, fields, onSubmit, submitText = "Guardar") {
  modal(
    title,
    `<form id="form">${fields}<div class="form-error" role="alert"></div><div class="form-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn primary" type="submit">${submitText}</button></div></form>`,
    onSubmit,
  );
}

export const input = (name, label, value = "", type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;

export const amount = (name, label, value = 0) =>
  input(
    name,
    label,
    value ? String(value / 100) : "",
    "text",
    'inputmode="decimal" data-money="1" placeholder="0.00" required',
  );

export const select = (name, label, options, value) =>
  `<label>${label}<select name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;

export const moneyValue = (f) => {
  const v = String(f || "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(v))
    throw Error("Introduce un importe con hasta dos decimales.");
  return C.cents(v);
};

export function accountOptions(source = model.state, freeOnly = false) {
  return source.walletAccounts
    .filter((a) => a.active !== false && (!freeOnly || a.type !== "restricted"))
    .map((a) => [a.id, a.name]);
}
export function accountName(id, source = model.state) {
  return (
    source.walletAccounts.find((a) => a.id === id)?.name || "Cuenta archivada"
  );
}

export function paymentFields(a) {
  return (
    amount("amount", "Importe", a) +
    select("accountId", "Pagar desde", accountOptions(), "debit") +
    input(
      "date",
      "Fecha real de pago",
      C.today(),
      "date",
      `required max="${C.today()}"`,
    )
  );
}

export const empty = (title, note) =>
  `<div class="empty"><strong>${title}</strong>${note}</div>`;

export function metric(n, key, cls = "") {
  return `<div class="metric ${cls}" data-metric="${key}" data-value="${n}">${money(n)}</div>`;
}

export const colors = [
  "#986437",
  "#c78b44",
  "#ba7856",
  "#79655e",
  "#b8a081",
  "#dac49f",
];

export const kindName = (k) =>
  ({
    expense: "Gasto",
    fixed: "Gasto fijo",
    debt: "Pago de deuda",
    income: "Ingreso",
    transfer: "Transferencia",
    adjustment: "Ajuste",
    loan_out: "Dinero prestado",
    loan_in: "Cobro de préstamo",
  })[k] || k;

export const debtType = (t) =>
  ({
    msi: "Meses sin intereses",
    deferred: "Diferimiento",
    loan: "Préstamo",
    revolving: "Crédito revolvente",
    "loan-open": "Préstamo sin plazo",
  })[t] || t;

export function confirmAction(title, message, label, fn) {
  form(
    title,
    `<p>${esc(message)}</p>`,
    async () => commit(label, fn),
    "Confirmar",
  );
}

window.nativeMessage = (message) => toast(message);
