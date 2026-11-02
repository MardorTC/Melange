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
  const page = await browser.newPage({ viewport: { width: 320, height: 780 } });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("button", { name: "Empezar desde cero", exact: true })
    .click();
  await page.getByRole("button", { name: "Omitir", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator('nav [data-id="accounts"]').count(), 1);
  const navigationTargets = await page
    .locator("nav button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
  assert.ok(
    navigationTargets.every((box) => box.width >= 44 && box.height >= 44),
  );
  const inspect = async (label) => {
    const problems = await page.evaluate(() => {
      const root = document.querySelector("dialog[open]") || document;
      const visible = (e) =>
        e.getClientRects().length &&
        getComputedStyle(e).visibility !== "hidden";
      const named = (e) =>
        e.getAttribute("aria-label")?.trim() ||
        e
          .getAttribute("aria-labelledby")
          ?.split(/\s+/)
          .some((id) => document.getElementById(id)?.textContent.trim()) ||
        e.textContent.trim() ||
        e.title;
      const errors = [];
      for (const b of root.querySelectorAll("button"))
        if (visible(b) && !named(b)) errors.push("Unnamed button");
      for (const el of root.querySelectorAll("input,select,textarea")) {
        if (!visible(el) || ["hidden", "submit", "button"].includes(el.type))
          continue;
        if (
          !el.labels?.length &&
          !el.getAttribute("aria-label") &&
          !el.getAttribute("aria-labelledby")
        )
          errors.push(`Unlabelled ${el.name || el.type}`);
      }
      const dialog = document.querySelector("dialog[open]");
      if (
        dialog &&
        !document.getElementById(dialog.getAttribute("aria-labelledby"))
          ?.textContent
      )
        errors.push("Unnamed dialog");
      if (document.documentElement.scrollWidth > innerWidth)
        errors.push("Horizontal page overflow");
      return errors;
    });
    assert.deepEqual(problems, [], label);
  };
  for (const tab of [
    "home",
    "accounts",
    "expense",
    "debt",
    "calendar",
    "goal",
  ]) {
    // Some screens are reached through labeled buttons rather than a nav slot.
    if (await page.locator(`nav [data-id="${tab}"]`).count())
      await page.locator(`nav [data-id="${tab}"]`).click();
    else
      await page.evaluate(
        async (id) => (await import("/js/ui/actions.js")).action("tab", id),
        tab,
      );
    await inspect(tab);
  }
  await page.evaluate(async () =>
    (await import("/js/ui/actions.js")).action("expense"),
  );
  await inspect("expense dialog");
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator("dialog")
      .evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "hidden" });
  await page.evaluate(async () =>
    (await import("/js/ui/actions.js")).action("editFixed"),
  );
  if (await page.locator("dialog[open]").count()) {
    await inspect("fixed dialog");
    await page.keyboard.press("Escape");
  }
  console.log(
    "Accessibility smoke: named visible controls/dialogs, keyboard dialog containment and no page overflow at 320px. Not a TalkBack/contrast audit.",
  );
} finally {
  await browser?.close();
  server.close();
}
