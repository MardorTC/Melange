// Accept explicit decimal formats, never strip a sign or truncate precision.
export function parseMoney(value, signed = false) {
  let raw = String(value ?? "")
    .trim()
    .replace(/^(?:MX)?\$\s*/i, "")
    .replace(/\s/g, "");
  let sign = 1;
  if (signed && raw.startsWith("-")) {
    sign = -1;
    raw = raw.slice(1);
  }
  if (/^\d{1,3}(,\d{3})+(\.\d{0,2})?$/.test(raw)) raw = raw.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(raw)) raw = raw.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw))
    raw = raw.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(raw))
    throw Error(
      "Escribe un importe válido con hasta dos decimales. Ejemplo: 1234.50. No se cambió tu importe.",
    );
  const amount = Math.round(Number(raw) * 100) * sign;
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 1e14)
    throw Error("El importe es demasiado grande.");
  return amount;
}
