import { chromium } from "playwright";
import assert from "node:assert/strict";
import { startPreview } from "../scripts/preview.mjs";
const server = await startPreview(0);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.OSP_CHROME
      ? { executablePath: process.env.OSP_CHROME }
      : {}),
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("button", { name: "Empezar desde cero", exact: true })
    .click();
  await page.getByRole("button", { name: "Omitir", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const ids = await page.evaluate(async () => {
    const { commit } = await import("/js/state/ledger.js");
    const { default: C } = await import("/js/domain/finance.js");
    const { model } = await import("/js/state/model.js");
    let cardPayment, collection;
    await commit("Prueba cuenta archivada", (s) => {
      s.walletAccounts[1].opening = 100000;
      C.saveCreditCard(
        s,
        null,
        {
          name: "Tarjeta",
          limit: 100000,
          totalBalance: 10000,
          openingDueDate: C.today(),
          closingDay: 5,
          paymentDay: 20,
        },
        [],
      );
      C.payCard(s, s.creditCards[0].id, C.month(), {
        amount: 5000,
        accountId: "debit",
        date: C.today(),
      });
      cardPayment = s.transactions.at(-1).id;
      s.receivables.push({
        id: "loan",
        name: "Préstamo",
        person: "Ana",
        opening: 10000,
        createdDate: C.today(),
        dueDate: null,
      });
      collection = C.record(s, {
        kind: "loan_in",
        name: "Cobro",
        ref: "loan",
        amount: 1000,
        accountId: "debit",
        date: C.today(),
      }).id;
      s.walletAccounts[1].active = false;
    });
    return {
      cardPayment,
      collection,
      transactions: JSON.stringify(model.state.transactions),
    };
  });
  for (const [action, id] of [
    ["creditPaymentEdit", ids.cardPayment],
    ["loanMovementEdit", ids.collection],
  ]) {
    await page.evaluate(
      async ({ action, id }) =>
        (await import("/js/ui/actions.js")).action(action, id),
      { action, id },
    );
    assert.equal(
      await page.locator('[name="accountId"]').inputValue(),
      "debit",
    );
    assert.match(
      await page.locator('[name="accountId"] option:checked').innerText(),
      /no disponible/,
    );
    await page.locator('#form [type="submit"]').click();
    await page
      .locator(".form-error")
      .filter({ hasText: /activa/ })
      .waitFor();
    assert.equal(
      await page.evaluate(async () =>
        JSON.stringify(
          (await import("/js/state/model.js")).model.state.transactions,
        ),
      ),
      ids.transactions,
    );
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.locator("dialog").waitFor({ state: "hidden" });
  }
  console.log(
    "Archived correction UI: missing account remains explicit and unchanged; no silent reassignment on save.",
  );
} finally {
  await browser?.close();
  server.close();
}
