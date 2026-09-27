import C from "../domain/finance.js";
import { input, amount, select, moneyValue } from "./components.js";
export function recurrenceFields(f, source, editing = false) {
  const r = f.rules?.at(-1) || {
    unit: "months",
    interval: 1,
    startDate: C.today(),
    amount: f.amount || 0,
    days: [1, 15],
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
    input(
      "startDate",
      "Fecha de inicio / ancla",
      r.startDate,
      "date",
      "required",
    ) +
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
    '<p class="note">Cada 14 días y dos veces al mes tienen calendarios diferentes. Los meses cortos ajustan el día sin desplazar las siguientes fechas.</p>'
  );
}
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
