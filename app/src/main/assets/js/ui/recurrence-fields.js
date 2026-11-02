import C from "../domain/finance.js";
import { occurrences } from "../domain/recurrence.js";
import { input, amount, select, moneyValue, dlabel } from "./components.js";

function previewRule(values) {
  const unit = values.unit || "months",
    rawAmount = String(values.amount ?? "").trim(),
    rule = {
      id: "preview",
      unit,
      interval: unit === "twiceMonthly" ? 1 : Number(values.interval || 1),
      startDate: values.startDate,
      endDate: values.endDate || null,
      effectiveFrom: values.effectiveFrom || values.startDate,
      amount: rawAmount ? moneyValue(rawAmount) : 0,
      active: true,
      ...(unit === "twiceMonthly"
        ? { days: [Number(values.day1), Number(values.day2)] }
        : {}),
    };
  C.validateRule(rule);
  return rule;
}

function previewDates(values) {
  let rule;
  try {
    rule = previewRule(values);
  } catch {
    return [];
  }
  if (!C.validDate(rule.startDate) || !C.validDate(rule.effectiveFrom))
    return [];
  const from = rule.effectiveFrom > C.today() ? rule.effectiveFrom : C.today(),
    first = rule.startDate > from ? rule.startDate : from,
    startMonth = C.month(first),
    dates = [];
  for (let n = 0; n < 120 && dates.length < 4; n++) {
    const found = occurrences(
      { id: "preview", name: "", rules: [rule] },
      C.addMonth(startMonth, n),
    );
    for (const item of found)
      if (item.date >= first && !dates.includes(item.date))
        dates.push(item.date);
  }
  return dates;
}

function previewMarkup(values) {
  const dates = previewDates(values);
  return dates.length
    ? `<strong>Próximos vencimientos</strong><span>${dates
        .slice(0, 4)
        .map((date) => dlabel(date))
        .join(
          " · ",
        )}</span><p class="note">Fechas según esta periodicidad. Los pagos ya registrados no cambian; los pagos anticipados pueden posponer la aplicación del cambio.</p>`
    : `<strong>Vista previa del calendario</strong><p class="note">Completa la periodicidad, el primer vencimiento y las fechas para ver los próximos cobros.</p>`;
}

function updatePreview(form) {
  const box = form.querySelector("[data-recurrence-preview]");
  if (!box) return;
  box.innerHTML = previewMarkup(Object.fromEntries(new FormData(form)));
}

export function recurrenceFields(f, source, editing = false) {
  const r = f.rules?.at(-1) || {
      unit: "months",
      interval: 1,
      startDate: C.today(),
      amount: f.amount || 0,
      days: [1, 15],
    },
    initial = {
      unit: r.unit,
      interval: r.interval,
      startDate: r.startDate,
      endDate: r.endDate || "",
      effectiveFrom: editing ? C.today() : r.startDate,
      amount: String(r.amount / 100),
      day1: r.days?.[0] || 1,
      day2: r.days?.[1] || 15,
    };
  return (
    amount("amount", "Importe por vencimiento", r.amount) +
    '<p class="note">Se cobrará una vez por cada vencimiento.</p>' +
    select(
      "unit",
      "Periodicidad",
      [
        ["days", "Cada … días"],
        ["weeks", "Cada … semanas"],
        ["months", "Cada … meses"],
        ["years", "Cada … años"],
        ["twiceMonthly", "Dos veces al mes"],
      ],
      r.unit,
    ) +
    `<div data-recurrence-interval ${r.unit === "twiceMonthly" ? "hidden" : ""}>` +
    input(
      "interval",
      "Cada cuántos",
      r.interval,
      "number",
      `min="1" max="1200" ${r.unit === "twiceMonthly" ? "" : "required"}`,
    ) +
    "</div>" +
    `<div data-recurrence-days ${r.unit === "twiceMonthly" ? "" : "hidden"}>` +
    input(
      "day1",
      "Primer día del mes",
      r.days?.[0] || 1,
      "number",
      'min="1" max="31"',
    ) +
    input(
      "day2",
      "Segundo día del mes",
      r.days?.[1] || 15,
      "number",
      'min="1" max="31"',
    ) +
    "</div>" +
    input("startDate", "Primer vencimiento", r.startDate, "date", "required") +
    input("endDate", "Fecha final (opcional)", r.endDate || "", "date") +
    (editing
      ? input(
          "effectiveFrom",
          "Aplicar cambios desde",
          C.today(),
          "date",
          "required",
        )
      : "") +
    `<div class="note recurrence-preview" data-recurrence-preview aria-live="polite">${previewMarkup(initial)}</div>` +
    select(
      "categoryId",
      "Categoría",
      [["", "Sin categoría"], ...source.categories.map((c) => [c.id, c.name])],
      r.categoryId || "",
    ) +
    select(
      "creditCardId",
      "Cargo a tarjeta (opcional)",
      [
        ["", "Pagar desde una cuenta"],
        ...(source.creditCards || [])
          .filter((c) => c.active !== false || c.id === r.creditCardId)
          .map((c) => [c.id, c.name + " · Crédito"]),
      ],
      r.creditCardId || "",
    ) +
    '<p class="note">El primer vencimiento fija el calendario, también al editar. Para reiniciar las fechas, cambia ese primer vencimiento. Cada 14 días y dos veces al mes son calendarios diferentes. Los meses cortos ajustan el día sin desplazar las siguientes fechas.</p>'
  );
}

if (typeof document !== "undefined")
  for (const type of ["input", "change"])
    document.addEventListener(type, (event) => {
      const form = event.target.closest?.("#form");
      if (form?.querySelector("[data-recurrence-preview]")) updatePreview(form);
    });

export function recurrenceValue(v) {
  const r = {
    unit: v.unit,
    interval: v.unit === "twiceMonthly" ? 1 : Number(v.interval),
    startDate: v.startDate,
    endDate: v.endDate || null,
    effectiveFrom: v.effectiveFrom || v.startDate,
    amount: moneyValue(v.amount),
    categoryId: v.categoryId || "",
    creditCardId: v.creditCardId || "",
    active: v.active !== "no",
    ...(v.unit === "twiceMonthly"
      ? { days: [Number(v.day1), Number(v.day2)] }
      : {}),
  };
  C.validateRule(r);
  return r;
}
