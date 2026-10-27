import C from "../domain/finance.js";
import { model } from "../state/model.js";
import { commit } from "../state/ledger.js";
import { iconPath, iconViewBox } from "./icons.js";

export function screenHead(title, subtitle = "", opts = {}) {
  const {
    action = "",
    actionLabel = "",
    actionIcon = "plus",
    back = false,
  } = opts;
  return `<header class="screen-head">${
    back
      ? `<button class="icon back-btn" data-action="screenBack" aria-label="Volver">${svg("back")}</button>`
      : "<span></span>"
  }<div class="screen-head-copy"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${
    action
      ? `<button class="icon soft" data-action="${action}" aria-label="${esc(actionLabel)}" title="${esc(actionLabel)}">${svg(actionIcon)}</button>`
      : "<span></span>"
  }</header>`;
}

export function sectionHead(title, trailing = "", note = "") {
  return `<div class="section-head"><div><h2>${title}</h2>${note ? `<small>${note}</small>` : ""}</div>${trailing}</div>`;
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

const moneyWhole = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const moneyCents = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (n) => {
  const value = (n || 0) / 100;
  return (Number.isInteger(value) ? moneyWhole : moneyCents).format(value);
};

export const mlabel = (m) =>
  new Date(m + "-15T12:00:00").toLocaleDateString("es-MX", {
    month: "short",
    year: "numeric",
  });

export const dlabel = (date, year = true) => {
  if (!date) return "";
  return new Date(date + "T12:00:00")
    .toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
    })
    .replace(".", "");
};

export const svg = (k) =>
  `<svg viewBox="${iconViewBox}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPath(k)}</svg>`;

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

export function form(
  title,
  fields,
  onSubmit,
  submitText = "Guardar",
  options = {},
) {
  const cancelLabel = options.cancelLabel || "Cancelar",
    cancelAction = options.cancelAction || "close";
  modal(
    title,
    `<form id="form">${fields}<div class="form-error" role="alert"></div><div class="form-actions"><button type="button" class="btn" data-action="${cancelAction}">${cancelLabel}</button><button class="btn primary" type="submit">${submitText}</button></div></form>`,
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
export function spendingOptions(source = model.state) {
  return [
    ...accountOptions(source),
    ...(source.creditCards || [])
      .filter((c) => c.active !== false)
      .map((c) => ["credit:" + c.id, c.name + " · Crédito"]),
  ];
}
export function accountName(id, source = model.state) {
  return (
    source.walletAccounts.find((a) => a.id === id)?.name ||
    source.creditCards?.find((c) => c.id === id)?.name ||
    "Cuenta archivada"
  );
}

export function paymentFields(a, credit = false, defaultAccount = "debit") {
  return (
    amount("amount", "Importe", a) +
    select(
      "accountId",
      "Pagar desde",
      credit ? spendingOptions() : accountOptions(),
      defaultAccount,
    ) +
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
  "#c76a3b",
  "#e0a24f",
  "#6f9f7b",
  "#6f91a6",
  "#d47e72",
  "#9486ad",
];

export const kindName = (k) =>
  ({
    expense: "Gasto",
    card_payment: "Pago de tarjeta",
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
