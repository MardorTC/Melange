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
  const fixture = await page.evaluate(async () =>
    JSON.stringify({
      format: "projectosp-backup",
      version: 10,
      state: (await import("/js/state/model.js")).model.state,
    }),
  );
  await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("projectosp-android-preview", 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put("{damaged preview envelope", "current");
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page
    .getByRole("heading", { name: "No se pudieron abrir los datos" })
    .waitFor();
  assert.equal(await page.locator("nav button").count(), 0);
  await page.locator("#importFile").setInputFiles({
    name: "respaldo.json",
    mimeType: "application/json",
    buffer: Buffer.from(fixture),
  });
  await page
    .getByRole("button", { name: "Importar estos datos", exact: true })
    .click();
  await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
  const preserved = await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("projectosp-android-preview", 1);
      request.onsuccess = () => resolve(request.result);
    });
    const result = await new Promise((resolve) => {
      const objects = db.transaction("state").objectStore("state");
      const entries = [];
      const request = objects.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(entries);
        if (String(cursor.key).startsWith("recovery-backup:"))
          entries.push(cursor.value);
        cursor.continue();
      };
    });
    db.close();
    return result;
  });
  assert.deepEqual(preserved, ["{damaged preview envelope"]);
  assert.equal(await page.locator("#toast [data-action=undo]").count(), 0);
  await page.reload();
  await page.getByRole("heading", { name: "Cada grano cuenta." }).waitFor();
  console.log(
    "Recovery UI: explicit import after startup corruption, preserved original and reload passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
