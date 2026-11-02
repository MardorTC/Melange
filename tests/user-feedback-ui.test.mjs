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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const closed = () => page.locator("dialog").waitFor({ state: "hidden" });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await click("Empezar desde cero");
  await page.locator('[name="debit"]').fill("1000");
  await click("Empezar");
  await closed();
  await page.locator('nav [data-id="goal"]').click();
  await click("Crear mi primera meta");
  await page.locator('[name="name"]').fill("Viaje");
  await page.locator('[name="target"]').fill("500");
  await click("Guardar");
  await closed();
  await page.locator('[data-action="contribute"]').click();
  assert.equal(await page.locator('[name="allocation"]').count(), 0);
  assert.equal(await page.getByText(/Selección anterior/).count(), 0);
  assert.equal(await page.getByText(/Asignar una reserva antigua/).count(), 0);
  await page.locator('[name="amount"]').fill("100");
  await click("Guardar");
  await closed();
  await page.locator('[data-action="contribute"]').click();
  assert.equal(await page.locator('[name="allocation"]').isVisible(), false);
  await page.locator('[name="kind"]').selectOption("remove");
  assert.equal(await page.locator('[name="allocation"]').isVisible(), true);
  assert.equal(await page.locator('[name="accountId"]').isVisible(), false);
  await page.locator('[name="kind"]').selectOption("add");
  await click("Cerrar");
  await closed();
  await page.locator('nav [data-id="home"]').click();
  assert.match(
    await page.locator(".balance-hint").innerText(),
    /Ya excluye reservas/,
  );
  assert.match(
    await page.locator(".home-summaries").innerText(),
    /Reservado en tu meta/,
  );
  await click("Nuevo gasto");
  await page.locator('[name="name"]').fill("Café");
  await page.locator('[name="amount"]').fill("0");
  await click("Guardar");
  await page
    .getByText("El importe debe ser mayor que cero.", { exact: true })
    .waitFor();
  await page.locator('[name="amount"]').fill("5000");
  await click("Guardar");
  await page
    .locator(".form-error")
    .filter({ hasText: /Faltan \$4,100\.00 MXN/ })
    .waitFor();
  await page.locator('[name="amount"]').fill("5");
  await page.locator('[name="categoryId"]').selectOption({ index: 1 });
  const category = await page
    .locator('[name="categoryId"] option:checked')
    .innerText();
  await click("Guardar");
  await closed();
  await page.locator('nav [data-id="expense"]').click();
  assert.match(
    await page.locator(".movement-summary").innerText(),
    /1 movimiento\b/,
  );
  await page
    .locator('[data-action="transactionDetails"]')
    .filter({ hasText: "Café" })
    .click();
  assert.match(await page.locator("#modal").innerText(), new RegExp(category));
  await click("Cerrar");
  await closed();
  // A saved debt must not hide the card-creation route.
  await page.evaluate(async () => {
    const { commit } = await import("/js/state/ledger.js");
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    await commit("Escenario de pago", (s) => {
      s.debts.push({
        id: "open",
        name: "Apoyo",
        type: "loan-open",
        balance: 10000,
        payment: 0,
        totalPayments: 0,
        startDate: null,
        dueDay: 1,
        originalAmount: 10000,
        financingCost: 0,
        annualRate: 0,
        balanceMode: "total",
        paidPayments: [],
        historicalPaidPayments: [],
        paidMonths: [],
        archived: false,
      });
      C.saveCreditCard(
        s,
        null,
        {
          name: "Tarjeta",
          limit: 100000,
          totalBalance: 10000,
          closingDay: 5,
          paymentDay: 20,
          openingDueDate: C.today(),
        },
        [],
      );
      C.payCard(s, s.creditCards[0].id, C.month(), {
        amount: 1000,
        accountId: "debit",
        date: C.today(),
      });
    });
    window.paymentToCheck = model.state.transactions.at(-1).id;
  });
  await page.locator('nav [data-id="debt"]').click();
  assert.equal(
    await page
      .getByRole("button", { name: "Agregar tarjeta", exact: true })
      .isVisible(),
    true,
  );
  assert.match(await page.locator(".debt-summary").innerText(), /ya incluida/i);
  // A first installment after the card's payment day in that same month is a
  // suspicious configuration. Warn, but don't invent a different cycle/date.
  await click("Agregar tarjeta");
  await page.locator('[name="paymentDay"]').fill("5");
  await click("Agregar compra a meses");
  const month = await page.evaluate(async () =>
    (await import("/js/domain/finance.js")).default.month(),
  );
  await page.locator('[name$="_startDate"]').fill(`${month}-25`);
  assert.equal(
    await page
      .locator("#card-date-warning")
      .evaluate((warning) => warning.hidden),
    true,
    "zero-balance MSI draft should not warn about a nonexistent payment",
  );
  await page.locator('[name$="_balance"]').fill("1000");
  await page.locator('[name$="_startDate"]').fill(`${month}-01`);
  assert.equal(
    await page
      .locator("#card-date-warning")
      .evaluate((warning) => warning.hidden),
    true,
  );
  await page.locator('[name$="_startDate"]').fill(`${month}-25`);
  const dateDiagnostics = await page.evaluate(async () => {
    const C = (await import("/js/domain/finance.js")).default;
    const start = document.querySelector('[name$="_startDate"]')?.value;
    try {
      return {
        start,
        valid: C.validDate(start),
        month: C.month(start),
        due: C.dueDate(
          C.month(start),
          Number(document.querySelector('[name="paymentDay"]')?.value),
        ),
        balance: document.querySelector('[name$="_balance"]')?.value,
        payments: document.querySelector('[name$="_totalPayments"]')?.value,
      };
    } catch (error) {
      return { start, error: error.message };
    }
  });
  const dateWarning = await page
    .locator("#card-date-warning")
    .evaluate((warning) => ({
      hidden: warning.hidden,
      text: warning.textContent,
      paymentDay: document.querySelector('[name="paymentDay"]')?.value,
      firstInstallment: document.querySelector('[name$="_startDate"]')?.value,
      preview: document.querySelector("#card-balance-preview")?.textContent,
    }));
  assert.match(
    dateWarning.text,
    /Revisa la fecha de la primera mensualidad.*queda después del día límite de pago/,
    JSON.stringify({ dateWarning, dateDiagnostics }),
  );
  assert.equal(dateWarning.hidden, false, JSON.stringify(dateWarning));
  await page.locator('[name="paymentDay"]').fill("30");
  assert.equal(
    await page
      .locator("#card-date-warning")
      .evaluate((warning) => warning.hidden),
    true,
    "warning should clear when the card due date moves after the first installment",
  );
  await page.locator('[name="paymentDay"]').fill("5");
  assert.equal(
    await page
      .locator("#card-date-warning")
      .evaluate((warning) => warning.hidden),
    false,
  );
  assert.equal(
    await page.evaluate(
      async () =>
        (await import("/js/state/model.js")).model.state.creditCards.length,
    ),
    1,
  );
  await click("Cancelar");
  await closed();
  await page.evaluate(async () =>
    (await import("/js/ui/actions.js")).action(
      "transactionDetails",
      window.paymentToCheck,
    ),
  );
  await click("Editar");
  await page
    .getByRole("heading", { name: "Corregir pago de tarjeta", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Revertir movimiento", exact: true })
      .count(),
    0,
  );
  await page.locator('[name="amount"]').fill("12");
  await click("Guardar corrección");
  await closed();
  assert.equal(
    await page.evaluate(
      async () =>
        (await import("/js/state/model.js")).model.state.transactions.find(
          (entry) => entry.id === window.paymentToCheck,
        ).amount,
    ),
    1200,
  );
  console.log(
    "User feedback UI: reservation copy, singular labels, category detail, money errors, card discovery, direct payment correction and MSI-date warning passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
