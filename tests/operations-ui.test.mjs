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
  // Repeated save/undo cycles, including reload, with phase diagnostics on failure.
  try {
    for (let n = 0; n < 12; n++) {
      await page.evaluate(async () => {
        const { commit } = await import("/js/state/ledger.js");
        await commit("Prueba de deshacer", (s) => {
          s.income = 12300;
        });
      });
      await page.waitForFunction(
        () => !!document.querySelector("#toast [data-action=undo]"),
      );
      // Click the current node synchronously: Playwright's auto-wait locator can
      // retain a toast button that a quick re-render has already replaced.
      await page.evaluate(() => {
        const button = document.querySelector("#toast [data-action=undo]");
        if (!button) throw Error("Undo button is not visible yet");
        button.click();
      });
      await page.waitForFunction(async () => {
        const { model } = await import("/js/state/model.js");
        return !model.busy && model.state.income === 0;
      });
      if (n % 3 === 0) {
        await page.reload();
        await page
          .getByRole("heading", { name: "Cada grano cuenta." })
          .waitFor();
        assert.equal(
          await page.evaluate(
            async () => (await import("/js/state/model.js")).model.state.income,
          ),
          0,
        );
      }
    }
    // Persistence failures leave history/state intact; retry remains possible.
    const result = await page.evaluate(async () => {
      const { model } = await import("/js/state/model.js");
      const { commit, undo } = await import("/js/state/ledger.js");
      const old = JSON.stringify({
        state: model.state,
        history: model.history,
        revision: model.revision,
      });
      window.NativeOSP = {
        writeAsync: (_, id) =>
          queueMicrotask(() =>
            window.nativeSaved(id, "ERROR:Injected save failure"),
          ),
      };
      const ok = await commit("No guardado", (s) => {
        s.income = 500;
      });
      const unchanged =
        old ===
        JSON.stringify({
          state: model.state,
          history: model.history,
          revision: model.revision,
        });
      delete window.NativeOSP;
      await commit("Guardar antes del fallo", (s) => {
        s.income = 700;
      });
      window.NativeOSP = {
        writeAsync: (_, id) =>
          queueMicrotask(() =>
            window.nativeSaved(id, "ERROR:Injected undo failure"),
          ),
      };
      await undo();
      const retained = model.state.income === 700;
      delete window.NativeOSP;
      await undo();
      return { ok, unchanged, retained, retried: model.state.income === 0 };
    });
    assert.deepEqual(result, {
      ok: false,
      unchanged: true,
      retained: true,
      retried: true,
    });
    // Failure after durable save must not roll the in-memory book backwards.
    await page.evaluate(async () => {
      const { commit } = await import("/js/state/ledger.js");
      const storage = await import("/js/platform/storage.js");
      window.NativeOSP = {
        writeAsync: (raw, id) => {
          delete window.NativeOSP;
          storage.writeStore(JSON.parse(raw)).then(() => {
            window.NativeOSP = {
              configureReminders: () => {
                throw Error("Injected reminder failure");
              },
            };
            window.nativeSaved(id, "OK");
          });
        },
      };
      await commit("Guardado confirmado", (s) => {
        s.income = 900;
      });
      delete window.NativeOSP;
    });
    assert.equal(
      await page.evaluate(
        async () => (await import("/js/state/model.js")).model.state.income,
      ),
      900,
    );
    const undone = await page.evaluate(async () => {
      const { undo } = await import("/js/state/ledger.js");
      const { model } = await import("/js/state/model.js");
      const storage = await import("/js/platform/storage.js");
      const before = model.history.length;
      window.NativeOSP = {
        writeAsync: (raw, id) => {
          delete window.NativeOSP;
          storage.writeStore(JSON.parse(raw)).then(() => {
            window.NativeOSP = {
              configureReminders: () => {
                throw Error("Injected post-undo failure");
              },
            };
            window.nativeSaved(id, "OK");
          });
        },
      };
      await undo();
      delete window.NativeOSP;
      return {
        value: model.state.income,
        removed: before - model.history.length,
        message: document.querySelector("#toast").textContent,
      };
    });
    assert.equal(undone.value, 0);
    assert.equal(undone.removed, 1);
    assert.match(undone.message, /El cambio se deshizo/);
    assert.doesNotMatch(undone.message, /No se pudo deshacer/);
    await page.reload();
    await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
    assert.equal(
      await page.evaluate(
        async () => (await import("/js/state/model.js")).model.state.income,
      ),
      0,
    );
  } catch (error) {
    console.error(
      "Operation phase trace (no financial content):",
      await page.evaluate(async () =>
        (await import("/js/state/operation-trace.js")).operationTrace(),
      ),
    );
    throw error;
  }
  console.log(
    "Operations UI: repeated undo/reload, failed save/undo retries and post-save reminder failure passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
