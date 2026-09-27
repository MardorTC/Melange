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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("button", { name: "Empezar desde cero", exact: true })
    .waitFor();
  const old = C.empty();
  old.started = true;
  old.schemaVersion = 8;
  delete old.creditCards;
  old.walletAccounts[1].opening = 500000;
  await page.evaluate(async (state) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("projectosp-android-preview", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put(
        {
          state,
          history: [{ state, label: "Anterior" }],
          draft: null,
          revision: 1,
        },
        "current",
      );
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, old);
  await page.reload();
  await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
  const migrated = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const db = await new Promise((resolve) => {
      const r = indexedDB.open("projectosp-android-preview", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const original = await new Promise((resolve) => {
      const r = db
        .transaction("state")
        .objectStore("state")
        .get("migration-v8");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return {
      schema: model.state.schemaVersion,
      history: model.history[0].state.schemaVersion,
      original: original.state,
    };
  });
  assert.equal(migrated.schema, 10);
  assert.equal(migrated.history, 10);
  assert.deepEqual(migrated.original, old);
  await page.locator('[data-action="tab"][data-id="accounts"]').first().click();
  await page.locator('[data-action="accountSub"][data-id="credit"]').click();
  await page
    .getByRole("button", { name: "Agregar tarjeta", exact: true })
    .click();
  await page.locator('[name="name"]').fill("BBVA crédito");
  await page.locator('[name="limit"]').fill("20000");
  await page.locator('#form [type="submit"]').click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const cardId = await page.evaluate(
    async () =>
      (await import("/js/state/model.js")).model.state.creditCards[0].id,
  );
  await page.locator('nav [data-id="home"]').click();
  await page.getByRole("button", { name: "Nuevo gasto", exact: true }).click();
  await page.locator('[name="name"]').fill("Despensa a crédito");
  await page.locator('[name="amount"]').fill("500");
  await page.locator('[name="accountId"]').selectOption("credit:" + cardId);
  assert.equal(await page.locator("#credit-purchase-fields").isVisible(), true);
  await page.locator('[name="cardDueDate"]').fill(C.today());
  await page.locator('#form [type="submit"]').click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
  assert.equal(
    await page.locator('[data-metric="available"]').getAttribute("data-value"),
    "500000",
  );
  await page.locator('[data-action="tab"][data-id="accounts"]').first().click();
  await page.locator('[data-action="accountSub"][data-id="credit"]').click();
  mkdirSync("build/previews", { recursive: true });
  for (const width of [360, 390, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `build/previews/credit-accounts-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Pagar tarjeta", exact: true })
    .click();
  await page.screenshot({
    path: "build/previews/credit-payment.png",
    fullPage: true,
  });
  await page.locator('#form [type="submit"]').click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
  assert.equal(
    await page.locator('[data-metric="available"]').getAttribute("data-value"),
    "450000",
  );
  await page.getByRole("button", { name: "Nuevo gasto", exact: true }).click();
  await page.locator('[name="name"]').fill("Compra por conciliar");
  await page.locator('[name="amount"]').fill("300");
  await page.locator('[name="accountId"]').selectOption("credit:" + cardId);
  await page.locator('[name="cardDueDate"]').fill(C.today());
  await page.locator('#form [type="submit"]').click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page.locator('[data-action="tab"][data-id="accounts"]').first().click();
  await page.locator('[data-action="accountSub"][data-id="credit"]').click();
  await page
    .locator(`[data-action="creditDetails"][data-id="${cardId}"]`)
    .click();
  assert.match(
    await page.locator("dialog").innerText(),
    /Compra por conciliar/,
  );
  await page.locator('dialog [data-action="close"]').click();
  await page
    .locator(`[data-action="creditUnassigned"][data-id="${cardId}"]`)
    .click();
  await page.locator('[name="amount"]').fill("100");
  await page.locator('#form [type="submit"]').click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  let reconciled = await page.evaluate(async (cardId) => {
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    return {
      summary: C.creditSummary(model.state, cardId),
      remaining: C.creditStatement(model.state, cardId, C.month()).remaining,
      debit: C.balances(model.state).debit,
    };
  }, cardId);
  assert.equal(reconciled.summary.used, 20000);
  assert.equal(reconciled.summary.unassigned, 10000);
  assert.equal(reconciled.remaining, 30000);
  assert.equal(reconciled.debit, 440000);
  await page
    .locator(`[data-action="creditApply"][data-id="${cardId}"]`)
    .click();
  await page.locator('[name="amount"]').fill("100");
  await page.locator('#form [type="submit"]').click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  reconciled = await page.evaluate(async (cardId) => {
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    return {
      summary: C.creditSummary(model.state, cardId),
      remaining: C.creditStatement(model.state, cardId, C.month()).remaining,
      debit: C.balances(model.state).debit,
    };
  }, cardId);
  assert.equal(reconciled.summary.used, 20000);
  assert.equal(reconciled.summary.unassigned, 0);
  assert.equal(reconciled.remaining, 20000);
  assert.equal(reconciled.debit, 440000);
  await page.locator('nav [data-id="expense"]').click();
  await page.locator('[data-action="expenseSub"][data-id="fixed"]').click();
  await page.locator('[data-action="editFixed"]').first().click();
  assert.equal(await page.locator("[data-recurrence-days]").isVisible(), false);
  await page.locator('[name="unit"]').selectOption("twiceMonthly");
  assert.equal(await page.locator("[data-recurrence-days]").isVisible(), true);
  assert.equal(
    await page.locator("[data-recurrence-interval]").isVisible(),
    false,
  );
  await page.locator('[name="unit"]').selectOption("months");
  assert.equal(
    await page.locator("[data-recurrence-interval]").isVisible(),
    true,
  );
  await page.locator('[name="name"]').fill("Suscripción en tarjeta");
  await page.locator('[name="amount"]').fill("120");
  await page.locator('[name="creditCardId"]').selectOption(cardId);
  await page.locator('#form [type="submit"]').click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      async () =>
        (await import("/js/state/model.js")).model.state.fixedExpenses
          .at(-1)
          .rules.at(-1).creditCardId,
    ),
    cardId,
  );
  await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const { render } = await import("/js/ui/navigation.js");
    const { default: C } = await import("/js/domain/finance.js");
    model.state.categories = Array.from({ length: 7 }, (_, i) => ({
      id: `synthetic-${i}`,
      name: i === 0 ? "Otros" : `Categoría ${i}`,
    }));
    model.state.transactions = Array.from({ length: 7 }, (_, i) => ({
      id: `synthetic-${i}`,
      kind: "expense",
      name: "Prueba",
      amount: 10000 - i * 100,
      date: C.today(),
      categoryId: `synthetic-${i}`,
      accountId: "debit",
    }));
    model.tab = "home";
    render();
  });
  assert.equal(
    await page
      .locator(".home-spending .legend")
      .getByText("Otros", { exact: true })
      .count(),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Credit UI: v8 migration and original backup, card creation, purchase, reload, payment and mobile/landscape layout passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
