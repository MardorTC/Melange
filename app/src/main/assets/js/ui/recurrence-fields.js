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
    select(
      "unit",
      "Periodicidad",
      [
        ["days", "Cada N días"],
        ["weeks", "Cada N semanas"],
        ["months", "Cada N meses"],
        ["years", "Cada N años"],
        ["twiceMonthly", "Dos veces al mes"],
      ],
      r.unit,
    ) +
    input(
      "interval",
      "Intervalo N (no aplica a dos veces al mes)",
      r.interval,
      "number",
      'required min="1" max="1200"',
    ) +
    input(
      "day1",
      "Primer día (dos veces al mes)",
      r.days?.[0] || 1,
      "number",
      'min="1" max="31"',
    ) +
    input(
      "day2",
      "Segundo día (dos veces al mes)",
      r.days?.[1] || 15,
      "number",
      'min="1" max="31"',
    ) +
    input(
      "startDate",
      "Fecha de inicio / ancla",
      r.startDate,
      "date",
      "required",
    ) +
    input("endDate", "Fecha final (opcional)", r.endDate || "", "date") +
    input(
      "effectiveFrom",
      editing ? "Aplicar cambios desde" : "Vigente desde",
      editing ? C.today() : r.startDate,
      "date",
      "required",
    ) +
    select(
      "categoryId",
      "Categoría",
      [["", "Sin categoría"], ...source.categories.map((c) => [c.id, c.name])],
      r.categoryId || "",
    ) +
    '<p class="note">Cada 14 días y dos veces al mes tienen calendarios diferentes. Los meses cortos ajustan el día sin desplazar las siguientes fechas.</p>'
  );
}
export function recurrenceValue(v) {
  const r = {
    unit: v.unit,
    interval: Number(v.interval),
    startDate: v.startDate,
    endDate: v.endDate || null,
    effectiveFrom: v.effectiveFrom,
    amount: moneyValue(v.amount),
    categoryId: v.categoryId || "",
    active: v.active !== "no",
    ...(v.unit === "twiceMonthly"
      ? { days: [Number(v.day1), Number(v.day2)] }
      : {}),
  };
  C.validateRule(r);
  return r;
}
