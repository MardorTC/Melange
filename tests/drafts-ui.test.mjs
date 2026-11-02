import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const closed = () => page.locator("dialog").waitFor({ state: "hidden" });
  const recover = () => click("Recuperar borrador");
  await click("Empezar desde cero");
  await page.locator('[name="cash"]').fill("700");
  await page.locator('[name="bankName"]').fill("Nómina");
  await page.locator('[name="debit"]').fill("4500");
  await click("Agregar otra cuenta bancaria");
  await page.locator('[name$="_name"]').fill("Otro banco");
  await page.locator('[name$="_balance"]').fill("1200");
  await page.keyboard.press("Escape");
  await closed();
  await page.reload();
  await click("Empezar desde cero");
  await recover();
  assert.equal(await page.locator('[name="bankName"]').inputValue(), "Nómina");
  assert.equal(await page.locator('[name$="_balance"]').inputValue(), "1200");
  await click("Empezar");
  await closed();
  const initial = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    return {
      accounts: model.state.walletAccounts.map((a) => [a.name, a.opening]),
      balance: C.metrics(model.state).available,
      transactions: model.state.transactions.length,
    };
  });
  assert.deepEqual(initial.accounts, [
    ["Efectivo", 70000],
    ["Nómina", 450000],
    ["Otro banco", 120000],
  ]);
  assert.equal(initial.balance, 640000);
  assert.equal(initial.transactions, 0);

  await click("Nuevo gasto");
  await page.locator('[name="name"]').fill("<b>Compra pendiente</b>");
  await page.locator('[name="amount"]').fill("25.50");
  await page.evaluate(() => window.handleBack());
  await closed();
  await page.reload();
  await click("Nuevo ingreso");
  assert.equal(
    await page
      .getByRole("button", { name: "Recuperar borrador", exact: true })
      .count(),
    0,
  );
  await click("Cerrar");
  await closed();
  await click("Nuevo gasto");
  await recover();
  assert.equal(
    await page.locator('[name="name"]').inputValue(),
    "<b>Compra pendiente</b>",
  );
  assert.equal(await page.locator('[name="amount"]').inputValue(), "25.50");
  assert.equal(await page.locator(".draft-status b").count(), 0);
  await click("Cerrar");
  await closed();
  await click("Nuevo ingreso");
  await page.locator('[name="name"]').fill("Ingreso real");
  await page.locator('[name="amount"]').fill("100");
  await click("Guardar");
  await closed();
  await click("Nuevo gasto");
  await page.getByText(/El libro cambió desde este borrador/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Recuperar borrador", exact: true })
      .count(),
    0,
  );
  await click("Descartar borrador");
  await click("Cerrar");
  await closed();

  // Hold a draft deletion's completion while another input event arrives.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (String(key).startsWith("form-draft:"))
        this.transaction.isDraftWrite = true;
      return put.call(this, value, key);
    };
    const del = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key) {
      if (String(key).startsWith("form-draft:")) {
        if (window.failDraftDelete)
          throw Error("Simulated cache cleanup failure");
        this.transaction.isDraftDelete = true;
      }
      return del.call(this, key);
    };
    const desc = Object.getOwnPropertyDescriptor(
      IDBTransaction.prototype,
      "oncomplete",
    );
    Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
      ...desc,
      set(handler) {
        if (this.isDraftDelete && window.holdDraftDelete) {
          const tx = this;
          desc.set.call(this, (event) => {
            window.releaseDraftDelete = () => handler.call(tx, event);
          });
        } else if (this.isDraftWrite && window.holdDraftWrite) {
          const tx = this;
          desc.set.call(this, (event) => {
            window.releaseDraftWrite = () => handler.call(tx, event);
          });
        } else desc.set.call(this, handler);
      },
    });
  });
  await click("Nuevo gasto");
  await page.locator('[name="name"]').fill("Descartar con escritura pendiente");
  await page.locator('[name="amount"]').fill("15");
  await page.evaluate(() => {
    window.holdDraftDelete = true;
  });
  await click("Descartar y cerrar");
  await page.waitForFunction(
    () => typeof window.releaseDraftDelete === "function",
  );
  assert.equal(await page.locator("#form").evaluate((f) => f.inert), true);
  await page.evaluate(() => {
    const field = document.querySelector('[name="name"]');
    field.value = "Evento durante descarte";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    window.holdDraftDelete = false;
    window.releaseDraftDelete();
  });
  await closed();
  await click("Nuevo gasto");
  assert.equal(
    await page
      .getByRole("button", { name: "Recuperar borrador", exact: true })
      .count(),
    0,
  );
  // A close already waiting for an autosave must not override a failed discard.
  await page.locator('[name="name"]').fill("Cierre esperando guardado");
  await page
    .getByRole("button", { name: "Descartar y cerrar", exact: true })
    .waitFor();
  await page.evaluate(() => {
    window.holdDraftWrite = true;
  });
  await page.locator('[name="amount"]').fill("30");
  await page.waitForFunction(
    () => typeof window.releaseDraftWrite === "function",
  );
  await page.evaluate(() => window.handleBack());
  await click("Descartar y cerrar");
  await page.evaluate(() => {
    window.failDraftDelete = true;
    window.holdDraftWrite = false;
    window.releaseDraftWrite();
  });
  await page
    .getByText("Simulated cache cleanup failure", { exact: true })
    .waitFor();
  assert.equal(await page.locator("dialog").isVisible(), true);
  await page.evaluate(() => {
    window.failDraftDelete = false;
  });
  await click("Descartar y cerrar");
  await closed();
  await click("Nuevo gasto");
  assert.equal(
    await page
      .getByRole("button", { name: "Recuperar borrador", exact: true })
      .count(),
    0,
  );
  await page.locator('[name="name"]').fill("Guardado con fallo de caché");
  await page.locator('[name="amount"]').fill("20");
  await page.evaluate(() => {
    window.failDraftDelete = true;
  });
  await click("Guardar");
  await closed();
  assert.equal(
    await page.evaluate(
      async () =>
        (await import("/js/state/model.js")).model.state.transactions.filter(
          (t) => t.name === "Guardado con fallo de caché",
        ).length,
    ),
    1,
  );
  await click("Nuevo gasto");
  await page.getByText(/El libro cambió desde este borrador/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Recuperar borrador", exact: true })
      .count(),
    0,
  );
  await page.evaluate(() => {
    window.failDraftDelete = false;
  });
  await click("Descartar borrador");
  await click("Cerrar");
  await closed();

  // Dynamic MSI fields also survive closing/reloading, without creating debt.
  await page.locator('.hero-account[data-account-sub="credit"]').click();
  await click("Agregar tarjeta");
  await page.locator('[name="name"]').fill("Banco crédito");
  await page.locator('[name="limit"]').fill("20000");
  await page.locator('[name="openingBalance"]').fill("3000");
  await click("Agregar compra a meses");
  for (const [key, value] of Object.entries({
    name: "Laptop",
    balance: "3000",
    payment: "1000",
    totalPayments: "3",
  }))
    await page.locator(`[name$="_${key}"]`).fill(value);
  await page.keyboard.press("Escape");
  await closed();
  await page.reload();
  await page.locator('.hero-account[data-account-sub="credit"]').click();
  await click("Agregar tarjeta");
  await recover();
  assert.equal(await page.locator('[name$="_name"]').inputValue(), "Laptop");
  await click("Guardar");
  await closed();
  assert.equal(
    await page.evaluate(
      async () => (await import("/js/state/model.js")).model.state.debts.length,
    ),
    1,
  );

  // A form with no draft support cannot silently discard modified controls.
  await page.locator('nav [data-id="expense"]').click();
  await click("Mostrar filtros");
  await page.locator('[name="min"]').fill("10");
  await page.keyboard.press("Escape");
  await page.locator(".discard-guard").waitFor();
  await click("Seguir editando");
  assert.equal(await page.locator('[name="min"]').inputValue(), "10");
  await page.keyboard.press("Escape");
  await click("Descartar y cerrar");
  await closed();

  await page.locator('nav [data-id="home"]').click();
  await page.evaluate(async () => {
    const { commit } = await import("/js/state/ledger.js"),
      { default: C } = await import("/js/domain/finance.js");
    await commit("Pendientes de prueba", (s) => {
      C.updateFixed(
        s,
        "rent",
        { name: "Renta", kind: "fixed" },
        {
          unit: "months",
          interval: 1,
          amount: 180000,
          startDate: C.today(),
          effectiveFrom: C.today(),
          active: true,
        },
      );
    });
  });
  const amounts = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    return C.metrics(model.state);
  });
  assert.equal(
    await page.getByTestId("home-pending").innerText(),
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(amounts.pending / 100),
  );
  assert.equal(
    await page
      .locator(".home-summaries")
      .evaluate((e) => getComputedStyle(e).overflowX),
    "visible",
  );
  await page.evaluate(async () => {
    const { commit } = await import("/js/state/ledger.js"),
      { default: C } = await import("/js/domain/finance.js");
    await commit("Abono por conciliar", (s) =>
      C.payCard(s, s.creditCards[0].id, C.month(), {
        amount: 10000,
        accountId: "debit",
        date: C.today(),
        unassigned: true,
      }),
    );
  });
  assert.equal(
    await page.getByTestId("home-margin").innerText(),
    "Revisar pagos de tarjeta",
  );
  assert.equal(await page.locator(".health-outlook").count(), 0);
  mkdirSync("build/previews", { recursive: true });
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `home overflow at ${width}`,
    );
    if (width === 390)
      await page.screenshot({
        path: "build/previews/home-next.png",
        fullPage: true,
      });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Draft UI: multi-bank setup recovery, isolated/stale drafts, discard race, failed cleanup after commit, dynamic MSI, close protection and home outlook passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
