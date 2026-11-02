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
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("button", { name: "Empezar desde cero", exact: true })
    .click();
  await page.locator('[name="debit"]').fill("10000");
  await page.locator('[name="income"]').fill("");
  await page.getByRole("button", { name: "Empezar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });

  const ids = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    const { render } = await import("/js/ui/navigation.js");
    const s = model.state;
    s.creditCards.push({
      id: "card",
      name: "Banco",
      limit: 1000000,
      openingBalance: 0,
      openingDueDate: C.today(),
      closingDay: 15,
      paymentDay: 5,
      active: true,
    });
    C.record(s, {
      kind: "expense",
      name: "Compra",
      amount: 50000,
      date: C.today(),
      accountId: null,
      creditCardId: "card",
      cardDueDate: C.today(),
      categoryId: s.categories[0].id,
    });
    C.ensureBudget(s, C.month());
    const payment = C.payCard(s, "card", C.month(), {
      amount: 40000,
      accountId: "debit",
      date: C.today(),
    });
    s.receivables.push({
      id: "loan",
      name: "Viaje",
      person: "Ana",
      opening: 500000,
      dueDate: null,
      createdDate: C.today(),
    });
    render();
    return { payment: payment.id };
  });

  const openCreditDetails = () =>
    page.evaluate(async () => {
      const { action } = await import("/js/ui/actions.js");
      await action("creditDetails", "card");
    });
  const openPaymentHistory = async () => {
    await page.getByText("Pagos registrados: 1", { exact: false }).click();
  };

  await openCreditDetails();
  await openPaymentHistory();
  await page
    .getByRole("button", { name: "Corregir pago", exact: true })
    .click();
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "+ Nueva cuenta", exact: true })
    .click();
  await page
    .locator('[data-contextual-kind="account"] [data-contextual-field="name"]')
    .fill("Cuenta para pago");
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
  await page
    .getByRole("button", { name: "Guardar corrección", exact: true })
    .click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const paidFromNewAccount = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    const account = model.state.walletAccounts.find(
        (item) => item.name === "Cuenta para pago",
      ),
      payment = model.state.transactions.find(
        (item) => item.kind === "card_payment",
      );
    return {
      account: account && {
        opening: account.opening,
        type: account.type,
        balance: C.balances(model.state)[account.id],
      },
      linked: payment.accountId === account?.id,
      debit: C.balances(model.state).debit,
      amount: payment.amount,
    };
  });
  assert.deepEqual(paidFromNewAccount, {
    account: { opening: 100000, type: "bank", balance: 60000 },
    linked: true,
    debit: 1000000,
    amount: 40000,
  });

  await openCreditDetails();
  await openPaymentHistory();
  await page.getByRole("button", { name: "Reasignar", exact: true }).click();
  await page.locator('[name="amount"]').fill("100");
  await page.getByRole("button", { name: "Reasignar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const reassigned = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    const payment = model.state.transactions.find(
      (item) => item.kind === "card_payment",
    );
    return {
      amount: payment.amount,
      total: payment.allocations.reduce((n, item) => n + item.amount, 0),
      unassigned: payment.allocations
        .filter((item) => item.kind === "unassigned")
        .reduce((n, item) => n + item.amount, 0),
      debit: C.balances(model.state).debit,
    };
  });
  assert.deepEqual(reassigned, {
    amount: 40000,
    total: 40000,
    unassigned: 10000,
    debit: 1000000,
  });

  await page.evaluate(async () => {
    const { action } = await import("/js/ui/actions.js");
    await action("loanCollect", "loan");
  });
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "+ Nueva cuenta", exact: true })
    .click();
  await page
    .locator('[data-contextual-kind="account"] [data-contextual-field="name"]')
    .fill("Cuenta de cobro");
  await page
    .locator(
      '[data-contextual-kind="account"] [data-contextual-field="opening"]',
    )
    .fill("0");
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "Agregar y seleccionar", exact: true })
    .click();
  await page.locator('[name="amount"]').fill("1000");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const collected = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    const account = model.state.walletAccounts.find(
        (item) => item.name === "Cuenta de cobro",
      ),
      collection = model.state.transactions.find(
        (item) => item.kind === "loan_in",
      );
    return {
      linked: collection.accountId === account?.id,
      balance: C.balances(model.state)[account.id],
      pending: C.loanBalance(model.state, "loan"),
      duplicate: model.state.walletAccounts.filter(
        (item) => item.name === "Cuenta de cobro",
      ).length,
    };
  });
  assert.deepEqual(collected, {
    linked: true,
    balance: 100000,
    pending: 400000,
    duplicate: 1,
  });

  await page.evaluate(async () => {
    const { action } = await import("/js/ui/actions.js");
    await action("loanEdit", "loan");
  });
  await page.locator('[name="name"]').fill("Viaje corregido");
  await page
    .getByRole("button", { name: "Guardar corrección", exact: true })
    .click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      return model.state.receivables[0].name;
    }),
    "Viaje corregido",
  );
  await page.evaluate(async () => {
    const { action } = await import("/js/ui/actions.js");
    await action("tab", "debt");
    await action("debtSub", "owed");
  });
  assert.equal(
    await page.getByText("Entrada de dinero · Cobro", { exact: false }).count(),
    1,
  );
  assert.match(
    await page.locator(".receivable-movement").innerText(),
    /Recibido en: Cuenta de cobro/,
  );
  await page.getByRole("button", { name: "Corregir préstamo" }).waitFor();

  await page.evaluate(async () => {
    const { action } = await import("/js/ui/actions.js");
    await action("loanCreate");
  });
  await page.locator('[name="person"]').fill("Luis");
  await page.locator('[name="name"]').fill("Anticipo");
  await page.locator('[name="amount"]').fill("200");
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "+ Nueva cuenta", exact: true })
    .click();
  await page
    .locator('[data-contextual-kind="account"] [data-contextual-field="name"]')
    .fill("Cuenta de préstamo");
  await page
    .locator(
      '[data-contextual-kind="account"] [data-contextual-field="opening"]',
    )
    .fill("500");
  await page
    .locator('[data-contextual-kind="account"]')
    .getByRole("button", { name: "Agregar y seleccionar", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  const newLoan = await page.evaluate(async () => {
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    const account = model.state.walletAccounts.find(
        (item) => item.name === "Cuenta de préstamo",
      ),
      loan = model.state.receivables.find((item) => item.person === "Luis"),
      movement = model.state.transactions.find(
        (item) => item.kind === "loan_out" && item.ref === loan.id,
      );
    return {
      opening: account.opening,
      balance: C.balances(model.state)[account.id],
      linked: movement.accountId === account.id,
      pending: C.loanBalance(model.state, loan.id),
      duplicate: model.state.walletAccounts.filter(
        (item) => item.name === "Cuenta de préstamo",
      ).length,
    };
  });
  assert.deepEqual(newLoan, {
    opening: 50000,
    balance: 30000,
    linked: true,
    pending: 20000,
    duplicate: 1,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Corrections UI: contextual account in card payment, guided reassignment, collection into a new account and loan edit passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
