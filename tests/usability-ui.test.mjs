import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { startPreview } from "../scripts/preview.mjs";
import C from "../app/src/main/assets/js/domain/finance.js";

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
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("button", { name: "Empezar desde cero", exact: true })
    .click();
  await page.locator('[name="debit"]').fill("10000");
  await page.locator('[name="income"]').fill("");
  await page.getByRole("button", { name: "Empezar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page.locator('.hero-account[data-account-sub="credit"]').click();
  assert.equal(
    await page
      .locator('[data-action="accountSub"][data-id="credit"]')
      .getAttribute("aria-selected"),
    "true",
  );
  await page
    .getByRole("button", { name: "Agregar tarjeta", exact: true })
    .click();
  const commonFields = await page
    .locator("#form > label input")
    .evaluateAll((es) => es.map((e) => e.name).sort());
  await page.locator('[name="name"]').fill("Banco familiar");
  await page.locator('[name="limit"]').fill("15000");
  await page.locator('[name="openingBalance"]').fill("5000");
  await page
    .getByRole("button", { name: "Agregar compra a meses", exact: true })
    .click();
  const row = page.locator("[data-msi-row]").first();
  for (const [name, value] of Object.entries({
    name: "Laptop",
    balance: "3000",
    payment: "1000",
    totalPayments: "4",
    priorPaid: "1",
    startDate: C.addMonth(C.month(), -1) + "-01",
    dueDay: "5",
  }))
    await row.locator(`[name$="_${name}"]`).fill(value);
  assert.match(
    await page.locator("#card-balance-preview").innerText(),
    /Compras a meses pendientes: \$3,000/,
  );
  await page.locator('[name="openingBalance"]').fill("2500");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  assert.match(
    await page.locator(".form-error").innerText(),
    /saldo total no puede ser menor/,
  );
  const errorVisible = await page.locator(".form-error").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (
      r.top >= 0 && r.bottom <= innerHeight && document.activeElement === el
    );
  });
  assert.equal(errorVisible, true);
  assert.equal(
    await page.evaluate(
      async () =>
        (await import("/js/state/model.js")).model.state.creditCards.length,
    ),
    0,
  );
  await page.locator('[name="openingBalance"]').fill("5000");
  mkdirSync("build/previews", { recursive: true });
  await page.screenshot({
    path: "build/previews/inclusive-card.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const created = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    return {
      id: model.state.creditCards[0].id,
      opening: model.state.creditCards[0].openingBalance,
      used: C.creditSummary(model.state, model.state.creditCards[0].id).used,
      debit: C.balances(model.state).debit,
      transactions: model.state.transactions.length,
    };
  });
  assert.equal(created.opening, 200000);
  assert.equal(created.used, 500000);
  assert.equal(created.debit, 1000000);
  assert.equal(created.transactions, 0);
  await page.locator('[data-action="creditDetails"]').first().click();
  await page
    .getByRole("button", {
      name: "Editar tarjeta y compras a meses",
      exact: true,
    })
    .click();
  assert.deepEqual(
    await page
      .locator("#form > label input")
      .evaluateAll((es) => es.map((e) => e.name).sort()),
    commonFields,
  );
  assert.equal(
    await page.locator('[name="openingBalance"]').inputValue(),
    "5000",
  );
  assert.equal(await page.locator('[name$="_balance"]').inputValue(), "3000");
  await page.locator('[name="openingBalance"]').fill("4500");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.locator('.hero-account[data-account-sub="credit"]').click();
  await page.evaluate(async (cardId) => {
    const { commit } = await import("/js/state/ledger.js"),
      { default: C } = await import("/js/domain/finance.js");
    await commit("Historial de prueba", (s) => {
      const prior = C.addMonth(C.month(), -1);
      C.record(s, {
        kind: "expense",
        name: "Compra antigua liquidada",
        amount: 10000,
        date: prior + "-01",
        creditCardId: cardId,
        cardDueDate: prior + "-20",
        categoryId: "",
      });
      C.payCard(s, cardId, prior, {
        amount: 10000,
        accountId: "debit",
        date: C.today(),
      });
    });
  }, created.id);
  await page.locator('[data-action="creditDetails"]').first().click();
  assert.equal(
    await page
      .getByText("Compra antigua liquidada", { exact: true })
      .isVisible(),
    false,
  );
  await page.locator(".paid-periods > summary").click();
  assert.equal(
    await page
      .getByText("Compra antigua liquidada", { exact: true })
      .isVisible(),
    true,
  );
  await page
    .getByRole("button", { name: "Laptop · $3,000 pendiente", exact: true })
    .click();
  await page.getByRole("button", { name: "Editar deuda", exact: true }).click();
  assert.equal(await page.locator('[name="name"]').inputValue(), "Laptop");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.locator('nav [data-id="expense"]').click();
  await page
    .getByRole("button", { name: "Fijos y suscripciones", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agregar gasto fijo", exact: true })
    .click();
  await page.locator('[name="name"]').fill("Streaming");
  await page.locator('[name="kind"]').selectOption("subscription");
  await page.locator('[name="amount"]').fill("500");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Pagar gasto fijo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar pago", exact: true })
    .click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Ver gasto fijo", exact: true })
    .click();
  await page.getByRole("button", { name: /Ver o corregir/ }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator('[name="amount"]').fill("550");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Editar gasto fijo", exact: true })
    .click();
  await page.locator('[name="amount"]').fill("600");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Archivar gasto fijo", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const fixed = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    return {
      active: model.state.fixedExpenses[0].active,
      payments: model.state.transactions
        .filter((t) => t.kind === "fixed")
        .map((t) => t.amount),
    };
  });
  assert.equal(fixed.active, false);
  assert.deepEqual(fixed.payments, [55000]);
  await page.locator('nav [data-id="calendar"]').click();
  await page.locator('[data-action="calendarDay"][data-id="2"]').click();
  assert.doesNotMatch(await page.locator("#view").innerText(), /Invalid Date/);
  await page
    .getByRole("button", { name: "Mes siguiente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver a este mes", exact: true })
    .click();
  await page.locator('nav [data-id="home"]').click();
  await page.getByRole("button", { name: "Nuevo gasto", exact: true }).click();
  await page.locator('[name="name"]').fill("Formato decimal");
  await page.locator('[name="amount"]').fill("12,50");
  assert.equal(await page.locator('[name="amount"]').inputValue(), "12,50");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      async () =>
        (await import("/js/state/model.js")).model.state.transactions.find(
          (t) => t.name === "Formato decimal",
        ).amount,
    ),
    1250,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Usability UI: inclusive TDC + MSI, edit parity, paid history, linked MSI editing, fixed payment correction and subscription archive passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
