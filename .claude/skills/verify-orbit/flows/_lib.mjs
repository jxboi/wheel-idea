// Shared user-level moves for Orbit flows. Import from a flow; not a flow itself.

/** Click a destination in whichever navigation this viewport shows. */
export async function go(page, name) {
  await page.locator("#main-content").waitFor();
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  const names = { "Idea library": "Ideas", "The wheel": "Wheel" };
  if (await mobile.isVisible())
    await mobile.getByRole("button", { name: names[name] || name, exact: true }).click();
  else
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .or(page.locator(".sidebar-bottom"))
      .getByRole("button", { name, exact: true })
      .click();
}

export const toast = (page, text) =>
  page.getByRole("status").filter({ hasText: text });

/** Switch the workspace to Offline preview through Settings -> AI model. */
export async function usePreview(page, expect) {
  await page.getByRole("region", { name: "Tune the spin" }).getByRole("button", { name: "OpenRouter" }).click();
  await expect(page.getByRole("heading", { name: "AI model", level: 1 }));
  await page.getByRole("combobox", { name: "AI provider" }).selectOption({ label: "Offline preview" });
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(toast(page, "Settings saved."));
  await go(page, "The wheel");
  await expect(page.getByText("Offline preview · sample ideas"));
}

/** Spin and wait for the brief dialog. Returns the idea title. */
export async function spin(page, expect) {
  await page.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(page.getByRole("button", { name: /Spinning…|Creating your idea…/ }));
  const dialog = page.getByRole("dialog", { name: "Idea" });
  await expect(dialog, "visible", 30_000);
  return (await dialog.locator("h2.detail-title").textContent()).trim();
}
