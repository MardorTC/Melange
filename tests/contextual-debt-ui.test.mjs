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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const closed = () => page.locator("dialog").waitFor({ state: "hidden" });
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const openAdvanced = () =>
    page.locator("#form details[data-debt-advanced] > summary").click();

  await click("Empezar desde cero");
  await page.locator('[name="cash"]').fill("0");
  await page.locator('[name="bankName"]').fill("Nómina");
  await page.locator('[name="debit"]').fill("10000");
  await click("Empezar");
  await closed();

  // A debt without a known installment should not force numbers the person
  // does not have. Only the fields relevant to its type stay visible and the
  // initial form keeps optional data collapsed.
  await page.locator("nav [data-id=debt]").click();
  await click("Agregar deuda");
  assert.equal(await page.locator("[name=totalPayments]").isVisible(), true);
  assert.equal(
    await page
      .locator("#form details[data-debt-advanced]")
      .evaluate((el) => el.open),
    false,
  );
  assert.equal(await page.locator("[name=originalAmount]").isVisible(), false);
  await page.locator("[name=totalPayments]").fill("1.5");
  await page.locator("[name=type]").selectOption("loan-open");
  assert.equal(await page.locator("[name=totalPayments]").isVisible(), false);
  assert.equal(await page.locator("[name=totalPayments]").isDisabled(), true);
  assert.equal(await page.locator("[name=totalPayments]").inputValue(), "1.5");
  assert.equal(await page.locator("[name=startDate]").isVisible(), false);
  assert.equal(await page.locator("[name=creditCardId]").isVisible(), false);
  assert.equal(await page.locator("[name=payment]").isVisible(), false);
  assert.equal(await page.locator("[name=dueDay]").isVisible(), false);
  await page.locator("[name=name]").fill("Deuda sin cuota");
  await page.locator("[name=balance]").fill("1500");
  await openAdvanced();
  assert.equal(await page.locator("[name=originalAmount]").isVisible(), true);
  await page.locator("[name=originalAmount]").fill("1500");
  await click("Guardar");
  await closed();
  const openDebt = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    const debt = model.state.debts.find((d) => d.name === "Deuda sin cuota");
    return {
      type: debt.type,
      payment: debt.payment,
      totalPayments: debt.totalPayments,
      startDate: debt.startDate,
      dueDay: debt.dueDay,
      creditCardId: debt.creditCardId,
      originalAmount: debt.originalAmount,
      transactions: model.state.transactions.length,
      debit: C.balances(model.state).debit,
    };
  });
  assert.deepEqual(openDebt, {
    type: "loan-open",
    payment: 0,
    totalPayments: 0,
    startDate: null,
    dueDay: 1,
    creditCardId: null,
    originalAmount: 150000,
    transactions: 0,
    debit: 1000000,
  });

  // Hidden controls are disabled so an invalid prior value cannot block the
  // native form submit. Their values still survive a draft round-trip.
  await click("Agregar deuda");
  await page.locator("[name=name]").fill("Borrador con total oculto");
  await page.locator("[name=totalPayments]").fill("6");
  await page.locator("[name=type]").selectOption("loan-open");
  assert.equal(await page.locator("[name=totalPayments]").isDisabled(), true);
  await click("Cerrar");
  await closed();
  await click("Agregar deuda");
  await page.getByRole("button", { name: "Recuperar borrador" }).click();
  assert.equal(await page.locator("[name=type]").inputValue(), "loan-open");
  assert.equal(await page.locator("[name=totalPayments]").isDisabled(), true);
  assert.equal(await page.locator("[name=totalPayments]").inputValue(), "6");
  await page.locator("[name=type]").selectOption("msi");
  assert.equal(await page.locator("[name=totalPayments]").isVisible(), true);
  assert.equal(await page.locator("[name=totalPayments]").inputValue(), "6");
  await click("Cerrar");
  await closed();

  // Editing a debt with prior installments keeps the protected calendar and
  // does not rewrite antecedent payments.
  await click("Agregar deuda");
  await page.locator("[name=name]").fill("Deuda con antecedentes");
  await openAdvanced();
  await page.locator("[name=originalAmount]").fill("600");
  await page.locator("[name=balance]").fill("300");
  await page.locator("[name=payment]").fill("100");
  await page.locator("[name=totalPayments]").fill("3");
  await page.locator("[name=priorPaid]").fill("1");
  await click("Guardar");
  await closed();
  const beforeEdit = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const debt = model.state.debts.find(
      (item) => item.name === "Deuda con antecedentes",
    );
    return {
      id: debt.id,
      startDate: debt.startDate,
      totalPayments: debt.totalPayments,
      historicalPaidPayments: debt.historicalPaidPayments,
    };
  });
  assert.deepEqual(beforeEdit.historicalPaidPayments, [1]);
  await page
    .locator(`[data-action="editDebt"][data-id="${beforeEdit.id}"]`)
    .click();
  assert.equal(
    await page
      .locator("#form details[data-debt-advanced]")
      .evaluate((el) => el.open),
    true,
  );
  assert.equal(await page.locator("[name=totalPayments]").isEditable(), false);
  assert.equal(await page.locator("[name=startDate]").isEditable(), false);
  await page.locator("[name=name]").fill("Deuda con antecedentes corregida");
  await click("Guardar");
  await closed();
  const afterEdit = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const debt = model.state.debts.find(
      (item) => item.name === "Deuda con antecedentes corregida",
    );
    return {
      startDate: debt.startDate,
      totalPayments: debt.totalPayments,
      historicalPaidPayments: debt.historicalPaidPayments,
      paidPayments: debt.paidPayments,
    };
  });
  assert.deepEqual(afterEdit, {
    startDate: beforeEdit.startDate,
    totalPayments: 3,
    historicalPaidPayments: [1],
    paidPayments: [1],
  });

  // A debt with paid history cannot be converted to an open-ended type and
  // lose its calendar.
  await page
    .locator(`[data-action="editDebt"][data-id="${beforeEdit.id}"]`)
    .click();
  await page.locator("[name=type]").selectOption("revolving");
  await click("Guardar");
  assert.match(
    await page.locator(".form-error").innerText(),
    /pagos o antecedentes/,
  );
  const protectedDebt = await page.evaluate(async (id) => {
    const { model } = await import("/js/state/model.js");
    const debt = model.state.debts.find((item) => item.id === id);
    return {
      type: debt.type,
      totalPayments: debt.totalPayments,
      startDate: debt.startDate,
      historicalPaidPayments: debt.historicalPaidPayments,
      paidPayments: debt.paidPayments,
    };
  }, beforeEdit.id);
  assert.deepEqual(protectedDebt, {
    type: "msi",
    totalPayments: 3,
    startDate: beforeEdit.startDate,
    historicalPaidPayments: [1],
    paidPayments: [1],
  });
  await click("Cerrar");
  await closed();

  // Changing from MSI with a card selected to an open debt must not keep a
  // hidden MSI link or send the discarded installment fields.
  const cardId = await page.evaluate(async () => {
    const { commit } = await import("/js/state/ledger.js"),
      { default: C } = await import("/js/domain/finance.js"),
      { model } = await import("/js/state/model.js");
    await commit("Tarjeta de prueba", (state) =>
      C.saveCreditCard(
        state,
        null,
        {
          name: "Tarjeta de prueba",
          limit: 50000,
          closingDay: 5,
          paymentDay: 20,
          openingDueDate: C.today(),
          totalBalance: 0,
        },
        [],
      ),
    );
    return model.state.creditCards.at(-1).id;
  });
  await click("Agregar deuda");
  await page.locator("[name=name]").fill("Cambio de MSI a sin plazo");
  await page.locator("[name=creditCardId]").selectOption(cardId);
  await page.locator("[name=balance]").fill("500");
  await page.locator("[name=payment]").fill("100");
  await page.locator("[name=totalPayments]").fill("3");
  await openAdvanced();
  await page.locator("[name=originalAmount]").fill("1200");
  await page.locator("[name=type]").selectOption("loan-open");
  assert.equal(await page.locator("[name=creditCardId]").isVisible(), false);
  assert.equal(await page.locator("[name=totalPayments]").isVisible(), false);
  assert.equal(await page.locator("[name=startDate]").isVisible(), false);
  assert.equal(await page.locator("[name=payment]").isVisible(), true);
  await click("Guardar");
  await closed();
  const converted = await page.evaluate(async (id) => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    const debt = model.state.debts.find(
      (item) => item.name === "Cambio de MSI a sin plazo",
    );
    return {
      id: debt.id,
      type: debt.type,
      creditCardId: debt.creditCardId,
      totalPayments: debt.totalPayments,
      startDate: debt.startDate,
      priorPaid: debt.historicalPaidPayments.length,
      payment: debt.payment,
      originalAmount: debt.originalAmount,
      cardInstallments: C.creditSummary(model.state, id).installments,
    };
  }, cardId);
  const { id: convertedId, ...convertedData } = converted;
  assert.deepEqual(convertedData, {
    type: "loan-open",
    creditCardId: null,
    totalPayments: 0,
    startDate: null,
    priorPaid: 0,
    payment: 10000,
    originalAmount: 120000,
    cardInstallments: 0,
  });
  await page
    .locator(`[data-action="editDebt"][data-id="${convertedId}"]`)
    .click();
  assert.equal(
    await page
      .locator("#form details[data-debt-advanced]")
      .evaluate((el) => el.open),
    true,
  );
  assert.equal(await page.locator("[name=creditCardId]").isVisible(), false);
  assert.equal(await page.locator("[name=totalPayments]").isVisible(), false);
  assert.equal(await page.locator("[name=payment]").isVisible(), true);
  assert.equal(await page.locator("[name=payment]").inputValue(), "100");
  assert.equal(
    await page.locator("[name=originalAmount]").inputValue(),
    "1200",
  );
  await page.locator("[name=name]").fill("Cambio de MSI corregido");
  await click("Guardar");
  await closed();
  const convertedEdit = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const debt = model.state.debts.find(
      (item) => item.name === "Cambio de MSI corregido",
    );
    return {
      type: debt.type,
      creditCardId: debt.creditCardId,
      totalPayments: debt.totalPayments,
      startDate: debt.startDate,
      payment: debt.payment,
      originalAmount: debt.originalAmount,
    };
  });
  assert.deepEqual(convertedEdit, {
    type: "loan-open",
    creditCardId: null,
    totalPayments: 0,
    startDate: null,
    payment: 10000,
    originalAmount: 120000,
  });

  // Converting an unpaid MSI to revolving clears its hidden installment
  // calendar instead of preserving a schedule the type no longer shows.
  await click("Agregar deuda");
  await page.locator("[name=name]").fill("MSI a revolvente");
  await page.locator("[name=creditCardId]").selectOption(cardId);
  await page.locator("[name=balance]").fill("600");
  await page.locator("[name=payment]").fill("100");
  await page.locator("[name=totalPayments]").fill("6");
  await click("Guardar");
  await closed();
  const msiBefore = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const debt = model.state.debts.find(
      (item) => item.name === "MSI a revolvente",
    );
    return {
      id: debt.id,
      startDate: debt.startDate,
      totalPayments: debt.totalPayments,
    };
  });
  assert.equal(msiBefore.totalPayments, 6);
  await page
    .locator(`[data-action="creditDetails"][data-id="${cardId}"]`)
    .click();
  await page.getByRole("button", { name: /MSI a revolvente/ }).click();
  await page
    .locator(`[data-action="editDebt"][data-id="${msiBefore.id}"]`)
    .click();
  await page.locator("[name=type]").selectOption("revolving");
  assert.equal(await page.locator("[name=totalPayments]").isDisabled(), true);
  assert.equal(await page.locator("[name=startDate]").isDisabled(), true);
  await click("Guardar");
  await closed();
  const revolving = await page.evaluate(async (id) => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    const debt = model.state.debts.find(
      (item) => item.name === "MSI a revolvente",
    );
    return {
      type: debt.type,
      creditCardId: debt.creditCardId,
      totalPayments: debt.totalPayments,
      startDate: debt.startDate,
      priorPaid: debt.historicalPaidPayments.length,
      payment: debt.payment,
      cardInstallments: C.creditSummary(model.state, id).installments,
    };
  }, cardId);
  assert.deepEqual(revolving, {
    type: "revolving",
    creditCardId: null,
    totalPayments: 0,
    startDate: null,
    priorPaid: 0,
    payment: 10000,
    cardInstallments: 0,
  });

  // Inline category creation keeps the unfinished transaction in the draft,
  // including the pending option, and commits category + expense together.
  await page.locator("nav [data-id=home]").click();
  await click("Nuevo gasto");
  await page.locator("[name=name]").fill("Comida mascotas");
  await page.locator("[name=amount]").fill("250");
  await page
    .locator('[data-contextual-kind="category"]')
    .getByRole("button", { name: "+ Nueva categoría", exact: true })
    .click();
  await page
    .locator('[data-contextual-kind="category"] [data-contextual-field="name"]')
    .fill("Mascotas");
  await page
    .locator('[data-contextual-kind="category"]')
    .getByRole("button", { name: "Agregar y seleccionar", exact: true })
    .click();
  assert.match(
    await page.locator("[name=categoryId]").inputValue(),
    /^pending:category:/,
  );
  await click("Cerrar");
  await closed();
  await click("Nuevo gasto");
  await page.getByRole("button", { name: "Recuperar borrador" }).click();
  assert.equal(
    await page.locator("[name=name]").inputValue(),
    "Comida mascotas",
  );
  assert.equal(await page.locator("[name=amount]").inputValue(), "250");
  assert.match(
    await page.locator("[name=categoryId]").inputValue(),
    /^pending:category:/,
  );
  assert.equal(
    await page
      .locator('[name=categoryId] option[data-pending-catalog="1"]')
      .innerText(),
    "Mascotas",
  );
  await click("Guardar");
  await closed();
  const contextualCategory = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    const categories = model.state.categories.filter(
        (category) => category.name === "Mascotas",
      ),
      transaction = model.state.transactions.find(
        (item) => item.name === "Comida mascotas",
      );
    return {
      duplicates: categories.length,
      linked: transaction.categoryId === categories[0]?.id,
      transactions: model.state.transactions.length,
      debit: C.balances(model.state).debit,
    };
  });
  assert.deepEqual(contextualCategory, {
    duplicates: 1,
    linked: true,
    transactions: 1,
    debit: 975000,
  });

  // A new account is created in the same commit as its first movement. Its
  // opening balance is not income, and a failed movement must not create it.
  await click("Nuevo gasto");
  await page.locator("[name=name]").fill("Compra con cuenta nueva");
  await page.locator("[name=amount]").fill("100");
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "+ Nueva cuenta", exact: true })
    .click();
  await page
    .locator('[data-contextual-kind="account"] [data-contextual-field="name"]')
    .fill("Cuenta temporal");
  await page
    .locator(
      '[data-contextual-kind="account"] [data-contextual-field="opening"]',
    )
    .fill("1000");
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "Agregar y seleccionar", exact: true })
    .click();
  assert.match(
    await page.locator("[name=accountId]").inputValue(),
    /^pending:account:/,
  );
  await click("Guardar");
  await closed();
  const contextualAccount = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js"),
      { default: C } = await import("/js/domain/finance.js");
    const account = model.state.walletAccounts.find(
        (item) => item.name === "Cuenta temporal",
      ),
      transaction = model.state.transactions.find(
        (item) => item.name === "Compra con cuenta nueva",
      );
    return {
      opening: account.opening,
      type: account.type,
      linked: transaction.accountId === account.id,
      accountBalance: C.balances(model.state)[account.id],
      transactions: model.state.transactions.length,
      incomes: model.state.transactions.filter((item) => item.kind === "income")
        .length,
    };
  });
  assert.deepEqual(contextualAccount, {
    opening: 100000,
    type: "bank",
    linked: true,
    accountBalance: 90000,
    transactions: 2,
    incomes: 0,
  });

  await click("Nuevo gasto");
  await page.locator("[name=name]").fill("Movimiento que falla");
  await page.locator("[name=amount]").fill("500");
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "+ Nueva cuenta", exact: true })
    .click();
  await page
    .locator('[data-contextual-kind="account"] [data-contextual-field="name"]')
    .fill("Cuenta que no debe existir");
  await page
    .locator(
      '[data-contextual-kind="account"] [data-contextual-field="opening"]',
    )
    .fill("0");
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "Agregar y seleccionar", exact: true })
    .click();
  await click("Guardar");
  assert.match(await page.locator(".form-error").innerText(), /Faltan/);
  const failed = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    return {
      accounts: model.state.walletAccounts.filter(
        (item) => item.name === "Cuenta que no debe existir",
      ).length,
      transactions: model.state.transactions.filter(
        (item) => item.name === "Movimiento que falla",
      ).length,
    };
  });
  assert.deepEqual(failed, { accounts: 0, transactions: 0 });
  await click("Cerrar");
  await closed();
  assert.deepEqual(errors, []);
  console.log(
    "Debt/contextual UI: collapsed optional debt data, hidden invalid control excluded from native validation, disabled draft round-trip, MSI-to-open and MSI-to-revolving conversion without hidden links, protected paid conversion, atomic inline category with draft recovery, inline account opening and rollback passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
