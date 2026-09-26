// Feature: wheel categories (features/wheel-categories.md). Narrow categories, no-repeat, persistence.
import { go } from "./_lib.mjs";

export default async function ({ page, proof, expect }) {
  await page.getByRole("button", { name: "8 of 8 categories" }).click();
  const dialog = page.getByRole("dialog", { name: "Categories" });
  for (const name of [
    "Productivity",
    "Lifestyle",
    "Learning",
    "Creative tools",
    "Community",
    "Wellness",
  ])
    await dialog.getByRole("button", { name, exact: true }).click();
  await dialog.getByRole("switch", { name: "No repeats in a row" }).click();
  await proof("dialog");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "2 of 8 categories" }));
  await page.reload();
  await expect(page.getByRole("button", { name: "2 of 8 categories" }));
  await go(page, "Settings");
  await page.getByRole("button", { name: "Wheel 2 of 8" }).click();
  await expect(page.getByRole("button", { name: "Games", pressed: true }));
  await expect(page.getByRole("button", { name: "Wildcard", pressed: true }));
  await expect(page.getByRole("button", { name: "Wellness", pressed: false }));
  await expect(
    page.getByRole("switch", { name: "No repeats in a row", checked: true }),
  );
  await proof("settings-persisted");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("button", { name: "Wellness", pressed: true }));
}
