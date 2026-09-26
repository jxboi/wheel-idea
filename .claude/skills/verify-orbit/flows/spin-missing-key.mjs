// Feature: spin (features/spin.md). Default OpenRouter with no key -> recoverable error, no fake idea.
import { go } from "./_lib.mjs";

// The browser logs the API's 401 as a failed resource; that is the expected outcome.
export const allowConsole = [/status of 401/];

export default async function ({ page, proof, expect }) {
  await expect(
    page
      .getByRole("region", { name: "Tune the spin" })
      .getByRole("button", { name: "OpenRouter" }),
  );
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Connect an API key in Settings, then spin again." });
  await expect(alert, "visible", 30_000);
  await expect(page.getByRole("dialog", { name: "Idea" }), "absent");
  await proof("error");
  await go(page, "Idea library");
  await expect(page.getByRole("heading", { name: "No ideas yet." }));
  await proof("library-empty");
}
