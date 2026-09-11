/* Run: NODE_PATH=... node tests/ui.test.cjs. Requires Playwright + local Chromium.
   OSP_CHROME and OSP_URL can override the executable and test server. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
(async () => {
  const { startPreview } = await import("../scripts/preview.mjs");
  const server = await startPreview(0);
  const testUrl = "http://127.0.0.1:" + server.address().port;
  try {
    const browser = await chromium.launch({
      ...(process.env.OSP_CHROME
        ? { executablePath: process.env.OSP_CHROME }
        : {}),
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", () => {
      throw Error("Unexpected native browser dialog");
    });
    await page.goto(testUrl);
    await page
      .getByRole("button", { name: "Empezar desde cero", exact: true })
      .click();
    await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page
      .getByRole("button", { name: "Ajustar saldos", exact: true })
      .click();
    await page.locator("[name=debit]").fill("10000");
    await page.locator("[name=cash]").fill("1000");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("button", { name: "Ingreso previsto", exact: true })
      .click();
    await page.locator("[name=income]").fill("20000");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.locator("nav [data-id=debt]").click();
    await page
      .getByRole("button", { name: "Agregar deuda", exact: true })
      .click();
    await page.locator("[name=name]").fill("Equipo de trabajo");
    await page.locator("[name=originalAmount]").fill("3000");
    await page.locator("[name=balance]").fill("3000");
    await page.locator("[name=payment]").fill("1000");
    await page.locator("[name=totalPayments]").fill("3");
    await page.locator("[name=financingCost]").fill("0");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("heading", { name: "Equipo de trabajo", exact: true })
      .waitFor();
    const before = await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      const state = model.state;
      const { default: OSP } = await import("/js/domain/finance.js");
      const { commit } = await import("/js/state/ledger.js");
      const { render } = await import("/js/ui/navigation.js");
      return OSP.metrics(state);
    });
    await page
      .getByRole("button", { name: "Pagar deuda", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Registrar pago", exact: true })
      .click();
    const after = await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      const state = model.state;
      const { default: OSP } = await import("/js/domain/finance.js");
      const { commit } = await import("/js/state/ledger.js");
      const { render } = await import("/js/ui/navigation.js");
      return OSP.metrics(state);
    });
    assert.equal(after.debit, before.debit - 100000);
    assert.equal(after.budgetFree, before.budgetFree);
    await page.locator("#toast [data-action=undo]").click();
    await page.waitForFunction(async () => {
      const { model } = await import("/js/state/model.js");
      return (
        !model.busy &&
        document.querySelector("#toast").textContent.includes("Se deshizo")
      );
    });
    const restored = await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      const state = model.state;
      const { default: OSP } = await import("/js/domain/finance.js");
      const { commit } = await import("/js/state/ledger.js");
      const { render } = await import("/js/ui/navigation.js");
      return OSP.metrics(state);
    });
    assert.equal(restored.debit, before.debit);
    await page.reload();
    await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
    assert.equal(
      await page.evaluate(async () => {
        const { model } = await import("/js/state/model.js");
        const state = model.state;
        const { default: OSP } = await import("/js/domain/finance.js");
        const { commit } = await import("/js/state/ledger.js");
        const { render } = await import("/js/ui/navigation.js");
        return OSP.metrics(state).debit;
      }),
      before.debit,
    );
    await page.locator("nav [data-id=expense]").click();
    await page
      .getByRole("button", { name: "Fijos y suscripciones", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Agregar gasto fijo", exact: true })
      .click();
    await page.locator("[name=name]").fill("Internet");
    await page.locator("[name=amount]").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("button", { name: "Pagar gasto fijo", exact: true })
      .click();
    await page.locator("[name=amount]").fill("200");
    await page
      .getByRole("button", { name: "Registrar pago", exact: true })
      .click();
    assert.equal(
      await page.evaluate(async () => {
        const { model } = await import("/js/state/model.js");
        const state = model.state;
        const { default: OSP } = await import("/js/domain/finance.js");
        const { commit } = await import("/js/state/ledger.js");
        const { render } = await import("/js/ui/navigation.js");
        return OSP.obligations(state).find((i) => i.kind === "fixed").remaining;
      }),
      30000,
    );
    await page.locator("nav [data-id=goal]").click();
    await page.getByRole("button", { name: "Crear meta", exact: true }).click();
    await page.locator("[name=name]").fill("Una escapada");
    await page.locator("[name=target]").fill("5000");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("button", { name: "Aportar o liberar reserva", exact: true })
      .click();
    await page.locator("[name=amount]").fill("1000");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    assert.equal(
      await page.evaluate(async () => {
        const { model } = await import("/js/state/model.js");
        const state = model.state;
        const { default: OSP } = await import("/js/domain/finance.js");
        const { commit } = await import("/js/state/ledger.js");
        const { render } = await import("/js/ui/navigation.js");
        return OSP.metrics(state).reserved;
      }),
      100000,
    );
    await page.locator("nav [data-id=expense]").click();
    await page.locator("#view [data-action=expenseSub][data-id=all]").click();
    await page
      .getByRole("button", { name: "Mostrar filtros", exact: true })
      .click();
    await page.locator("#filters [name=kind]").selectOption("fixed");
    assert.equal(await page.locator(".item-title").count(), 1);
    await page.locator("#search").fill("no existe");
    assert.equal(await page.locator(".item-title").count(), 0);
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page
      .getByRole("button", { name: "Importar respaldo", exact: true })
      .click();
    await page.locator("#importFile").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"no":"data"}'),
    });
    assert.equal(
      await page.evaluate(async () => {
        const { model } = await import("/js/state/model.js");
        const state = model.state;
        const { default: OSP } = await import("/js/domain/finance.js");
        const { commit } = await import("/js/state/ledger.js");
        const { render } = await import("/js/ui/navigation.js");
        return state.debts.length;
      }),
      1,
    );
    // Reference screenshots contain fabricated demo data only.
    await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      const state = model.state;
      const { default: OSP } = await import("/js/domain/finance.js");
      const { commit } = await import("/js/state/ledger.js");
      const { render } = await import("/js/ui/navigation.js");
      await commit("Datos de muestra", (s) => {
        s.transactions.push({
          id: "demo1",
          kind: "expense",
          name: "Despensa",
          amount: 85000,
          date: OSP.today(),
          accountId: "debit",
          categoryId: s.categories[0].id,
        });
        s.transactions.push({
          id: "demo2",
          kind: "expense",
          name: "Transporte",
          amount: 24000,
          date: OSP.today(),
          accountId: "debit",
          categoryId: s.categories[1].id,
        });
        s.liquidityHistory = [
          { date: OSP.month() + "-01", value: 950000 },
          { date: OSP.month() + "-03", value: 1020000 },
          { date: OSP.month() + "-05", value: 970000 },
          { date: OSP.month() + "-07", value: 1100000 },
        ];
      });
      model.tab = "home";
      render();
      document.querySelector("#toast").classList.remove("visible");
    });
    fs.mkdirSync("build/previews", { recursive: true });
    await page.screenshot({
      path: "build/previews/Melange-inicio.png",
      fullPage: true,
    });
    await page.locator("nav [data-id=goal]").click();
    await page.screenshot({
      path: "build/previews/Melange-metas.png",
      fullPage: true,
    });
    for (const width of [360, 390, 430, 1000]) {
      await page.setViewportSize({ width, height: 844 });
      for (const name of ["home", "expense", "debt", "calendar", "goal"]) {
        await page.locator(`nav [data-id=${name}]`).click();
        const overflow = await page.evaluate(async () => {
          const { model } = await import("/js/state/model.js");
          const state = model.state;
          const { default: OSP } = await import("/js/domain/finance.js");
          const { commit } = await import("/js/state/ledger.js");
          const { render } = await import("/js/ui/navigation.js");
          return document.documentElement.scrollWidth > innerWidth;
        });
        assert.equal(overflow, false, `${name} overflow at ${width}`);
      }
    }
    await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      const { default: C } = await import("/js/domain/finance.js");
      const { commit } = await import("/js/state/ledger.js");
      await commit("Muestras v8", (s) => {
        s.walletAccounts.find((a) => a.id === "debit").name = "BBVA";
        s.walletAccounts.push({
          id: "banamex",
          name: "Banamex",
          type: "bank",
          opening: 0,
          active: true,
          allowedCategories: [],
        });
        s.receivables.push({
          id: "demo-loan",
          name: "Viaje compartido",
          person: "Ana",
          opening: 50000,
          dueDate: C.today(),
        });
        C.freeze(s, {
          name: "Ahorro a plazo",
          amount: 300000,
          accountId: "debit",
          createdDate: C.today(),
          availableDate: C.today(),
        });
      });
    });
    for (const width of [360, 390, 430, 844]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      for (const screen of ["accounts", "owed"]) {
        await page.evaluate(async (screen) => {
          const { model } = await import("/js/state/model.js");
          const { render } = await import("/js/ui/navigation.js");
          model.tab = screen === "owed" ? "debt" : screen;
          model.debtSub = "owed";
          render();
        }, screen);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          screen + " overflow " + width,
        );
        if (width === 390)
          await page.screenshot({
            path: "build/previews/Melange-" + screen + ".png",
            fullPage: true,
          });
      }
    }

    // Exercise the actual IndexedDB upgrade, including the non-rotating original.
    const originalEnvelope = await page.evaluate(async () => {
      const { default: L } = await import("/js/domain/legacy-v7.js");
      const s = L.empty();
      s.started = true;
      s.opening = { cash: 12300, debit: 500000 };
      s.goals = [
        {
          id: "legacy-goal",
          name: "Reserva antigua",
          balance: 300000,
          target: 600000,
        },
      ];
      L.ensureBudget(s);
      const draft = {
        version: 1,
        id: "draft",
        baseId: s.id,
        baseRevision: 3,
        config: { startDate: L.today(), cash: 100, debit: 200, income: 0 },
        categories: s.categories,
        accounts: s.accounts,
        settings: s.settings,
        debts: [],
        fixedExpenses: [],
        entries: [],
      };
      const v = {
        state: s,
        history: [
          { label: "Antes", state: L.clone(s), date: new Date().toISOString() },
        ],
        draft,
        revision: 3,
      };
      await new Promise((resolve, reject) => {
        const r = indexedDB.open("projectosp-android-preview", 1);
        r.onsuccess = () => {
          const db = r.result,
            t = db.transaction("state", "readwrite");
          t.objectStore("state").put(v, "current");
          t.oncomplete = () => {
            db.close();
            resolve();
          };
          t.onerror = () => reject(t.error);
        };
      });
      return v;
    });
    await page.reload();
    await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
    const migrated = await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      const { default: C } = await import("/js/domain/finance.js");
      return {
        schema: model.state.schemaVersion,
        balances: C.balances(model.state),
        draft: model.rebuildDraft.version,
        history: model.history[0].state.schemaVersion,
        available: C.available(model.state),
      };
    });
    assert.deepEqual(migrated, {
      schema: 8,
      balances: { cash: 12300, debit: 500000 },
      draft: 2,
      history: 8,
      available: 212300,
    });
    const backup = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const r = indexedDB.open("projectosp-android-preview", 1);
          r.onsuccess = () => {
            const db = r.result,
              g = db
                .transaction("state")
                .objectStore("state")
                .get("migration-v7");
            g.onsuccess = () => {
              resolve(g.result);
              db.close();
            };
          };
        }),
    );
    assert.deepEqual(backup, originalEnvelope);
    await page.evaluate(async () => {
      const { commit } = await import("/js/state/ledger.js");
      for (let n = 0; n < 17; n++)
        await commit("Rotar historial", (s) => {
          s.income = n;
        });
    });
    const afterRotation = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const r = indexedDB.open("projectosp-android-preview", 1);
          r.onsuccess = () => {
            const db = r.result,
              g = db
                .transaction("state")
                .objectStore("state")
                .get("migration-v7");
            g.onsuccess = () => {
              resolve(g.result);
              db.close();
            };
          };
        }),
    );
    assert.deepEqual(afterRotation, originalEnvelope);
    await page.evaluate(async (v) => {
      v.history[0].state = { invalid: true };
      await new Promise((resolve) => {
        const r = indexedDB.open("projectosp-android-preview", 1);
        r.onsuccess = () => {
          const db = r.result,
            t = db.transaction("state", "readwrite");
          t.objectStore("state").put(v, "current");
          t.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      });
    }, originalEnvelope);
    await page.reload();
    await page
      .getByRole("heading", { name: "No se pudieron abrir los datos" })
      .waitFor();
    const unmodified = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const r = indexedDB.open("projectosp-android-preview", 1);
          r.onsuccess = () => {
            const db = r.result,
              g = db.transaction("state").objectStore("state").get("current");
            g.onsuccess = () => {
              resolve(g.result);
              db.close();
            };
          };
        }),
    );
    assert.equal(unmodified.state.schemaVersion, 7);
    assert.deepEqual(unmodified.history[0].state, { invalid: true });

    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      "UI checks passed: onboarding, balances, debt payment + undo + reload, partial fixed payment, goals, filters, invalid import, 3 mobile widths and landscape.",
    );
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
