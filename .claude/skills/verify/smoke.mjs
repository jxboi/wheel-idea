// Browser smoke check for Orbit. Run against `npm run dev` (not `vite preview`).
// Uses a throwaway Chromium profile per viewport, so no real workspace data is
// read or changed. `/api/generate` is intercepted in the browser, so no provider
// is ever called even when the server holds real keys.
//
//   node .claude/skills/verify/smoke.mjs [baseUrl] [outDir]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  const globalRoot = execSync("npm root -g").toString().trim();
  ({ chromium } = require(`${globalRoot}/playwright`));
}

const base = process.argv[2] || "http://127.0.0.1:5173";
const out = process.argv[3] || "verify-shots";
mkdirSync(out, { recursive: true });

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

const executablePath = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? undefined
  : "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath });
for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const tag = `[${vp.name} ${vp.width}px]`;
  let generateCalls = 0;
  await page.route("**/api/generate", async (route) => {
    generateCalls++;
    await new Promise((r) => setTimeout(r, 2_000)); // let the busy state show
    // Same shape the server returns for a missing key (api/generate.js).
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Connect an API key in Settings, then spin again.",
      }),
    });
  });

  for (const route of ["wheel", "library", "journal", "settings"]) {
    await page.goto(`${base}/#${route}`, { waitUntil: "networkidle" });
    await page.waitForSelector("#main-content, main", { timeout: 10_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(overflow <= 0, `${tag} #${route} has no horizontal overflow`);
    await page.screenshot({ path: `${out}/${vp.name}-${route}.png` });
  }

  // Default provider is OpenRouter. A failed request must surface a
  // recoverable error, never an offline example in its place.
  await page.goto(`${base}/#wheel`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Spin the wheel/ }).click();
  check(
    await page
      .getByRole("button", { name: /Spinning|Creating/ })
      .isDisabled({ timeout: 2_000 })
      .catch(() => false),
    `${tag} spin button disables while spinning`,
  );
  const shown = await page
    .getByText(/Connect an API key in Settings/)
    .first()
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  check(shown, `${tag} failed spin shows the provider error`);
  check(
    !(await page.locator("body").innerText()).includes("curated template"),
    `${tag} failed spin does not open an offline example`,
  );
  check(generateCalls === 1, `${tag} exactly one intercepted generate call`);
  check(
    await page
      .getByRole("button", { name: /Spin the wheel/ })
      .isEnabled({ timeout: 10_000 })
      .catch(() => false),
    `${tag} spin button re-enabled after the error`,
  );
  await page.screenshot({ path: `${out}/${vp.name}-spin-error.png` });

  // The browser logs the fixture's 401 itself; anything else is a real error.
  const real = errors.filter((e) => !/status of 401/.test(e));
  check(real.length === 0, `${tag} no console errors ${real.join(" | ")}`);
  await ctx.close();
}
await browser.close();
console.log(
  failures.length
    ? `\n${failures.length} check(s) failed.`
    : "\nAll smoke checks passed.",
);
process.exit(failures.length ? 1 : 0);
