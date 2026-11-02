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
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).click();
  await click("Empezar desde cero");
  await page.locator('[name="debit"]').fill("1000");
  await click("Empezar");
  await page.locator("dialog").waitFor({ state: "hidden" });
  await click("Nuevo gasto");
  await page.locator('[name="name"]').fill("Gasto sin categoría nueva");
  await page.locator('[name="amount"]').fill("10");
  await click("+ Nueva categoría");
  await page
    .locator('[name="__ctx_categoryId_name"]')
    .fill("Mascotas sin usar");
  await click("Agregar y seleccionar");
  await page.locator('[name="categoryId"]').selectOption("");
  await click("Guardar");
  await page.locator("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(async () =>
      (await import("/js/state/model.js")).model.state.categories.some(
        (category) => category.name === "Mascotas sin usar",
      ),
    ),
    false,
  );
  await click("Nuevo gasto");
  const checks = await page.evaluate(async () => {
    const { restoreContextualStructure } = await import(
      "/js/ui/contextual-create.js"
    );
    const { model } = await import("/js/state/model.js");
    const { default: C } = await import("/js/domain/finance.js");
    const before = JSON.stringify(model.state);
    const base = {
      id: "pending:account:forged",
      name: "Nueva",
      type: "bank",
      opening: 100,
      openingDate: C.today(),
    };
    const cases = [
      { ...base, name: "Débito", opening: 500000000 },
      { ...base, type: "unknown" },
      { ...base, opening: 0.5 },
      { ...base, opening: 1e15 },
      { ...base, openingDate: "2999-01-01" },
      { ...base, name: "" },
    ];
    return {
      rejected: cases.map((account) => {
        try {
          restoreContextualStructure({
            categories: [],
            accounts: [account],
            selects: [],
          });
          return false;
        } catch {
          return true;
        }
      }),
      unchanged: before === JSON.stringify(model.state),
    };
  });
  assert.ok(checks.rejected.every(Boolean));
  assert.equal(checks.unchanged, true);
  await click("+ Nueva categoría");
  await page
    .locator('[name="__ctx_categoryId_name"]')
    .fill("Borrador que se conserva");
  await click("Agregar y seleccionar");
  const intact = await page.evaluate(async () => {
    const { captureContextualStructure, restoreContextualStructure } =
      await import("/js/ui/contextual-create.js");
    const before = JSON.stringify(captureContextualStructure());
    const select = document.querySelector('[name="categoryId"]');
    const previous = select.value;
    let rejected = false;
    try {
      restoreContextualStructure({
        categories: [],
        accounts: [],
        selects: [
          {
            name: "categoryId",
            pending: [{ value: "pending:category:missing" }],
          },
        ],
      });
    } catch {
      rejected = true;
    }
    return (
      rejected &&
      before === JSON.stringify(captureContextualStructure()) &&
      previous === select.value
    );
  });
  assert.equal(intact, true);
  await page.locator('[name="name"]').fill("Conservar creación activa");
  await page.locator('[name="amount"]').fill("10");
  await click("Guardar");
  await page.locator("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(async () =>
      (await import("/js/state/model.js")).model.state.categories.some(
        (category) => category.name === "Borrador que se conserva",
      ),
    ),
    true,
  );
  console.log(
    "Contextual integrity UI: unused category not created; malformed/duplicate draft accounts rejected without ledger changes.",
  );
} finally {
  await browser?.close();
  server.close();
}
