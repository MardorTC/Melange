import C from "../domain/finance.js";
import { commit } from "../state/ledger.js";
import {
  form,
  input,
  amount,
  signedField,
  moneyValue,
  signedMoney,
  esc,
} from "./components.js";

export function bankFields(key = C.id()) {
  return `<section class="setup-bank card" data-setup-bank="${esc(key)}"><div class="row"><h3>Otra cuenta bancaria</h3><button type="button" class="btn" data-action="setupRemoveBank">Quitar</button></div>${input(`bank_${key}_name`, "Nombre de la cuenta", "", "text", 'required maxlength="80" placeholder="Ej. Mi otra cuenta"')}${signedField(`bank_${key}_balance`, "Saldo actual", "0")}</section>`;
}

export function startSetup() {
  form(
    "¿Dónde tienes tu dinero?",
    '<p class="note">Anota lo que tienes hoy en cada lugar. No es un ingreso ni necesitas reconstruir gastos anteriores.</p>' +
      amount("cash", "Efectivo en tu cartera", 0) +
      `<section class="setup-bank card"><h3>Tu cuenta bancaria</h3>${input("bankName", "Nombre de tu banco o cuenta (opcional)", "", "text", 'maxlength="80" placeholder="Ej. BBVA, nómina"')}${signedField("debit", "Saldo actual en esa cuenta", "0")}</section>` +
      '<div id="setup-banks"></div><button type="button" class="btn full" data-action="setupAddBank">Agregar otra cuenta bancaria</button>' +
      amount("income", "Ingreso mensual previsto (opcional)", 0).replace(
        " required",
        "",
      ) +
      '<p class="note">El ingreso previsto sirve para planear; no aumenta tu dinero. Si no lo sabes, déjalo en cero.</p>',
    async (f) => {
      const banks = [{ name: f.bankName || "", balance: signedMoney(f.debit) }];
      for (const row of document.querySelectorAll("[data-setup-bank]")) {
        const key = row.dataset.setupBank;
        banks.push({
          name: f[`bank_${key}_name`],
          balance: signedMoney(f[`bank_${key}_balance`]),
        });
      }
      return commit("Libro iniciado", (s) =>
        C.startLedger(s, {
          cash: moneyValue(f.cash || "0"),
          banks,
          income: moneyValue(f.income || "0"),
        }),
      );
    },
    "Empezar",
    {
      cancelLabel: "Omitir",
      cancelAction: "startEmpty",
      draftKey: "setup",
      captureStructure: () =>
        [...document.querySelectorAll("[data-setup-bank]")].map(
          (row) => row.dataset.setupBank,
        ),
      restoreStructure: (keys) => {
        document.querySelector("#setup-banks").innerHTML = "";
        for (const key of (Array.isArray(keys) ? keys : []).slice(0, 30))
          if (typeof key === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(key))
            document
              .querySelector("#setup-banks")
              .insertAdjacentHTML("beforeend", bankFields(key));
      },
    },
  );
}
