// Feature: spin (features/spin.md). Offline preview spin -> brief -> save/react/feedback.
import { usePreview, spin, toast, go } from "./_lib.mjs";

export default async function ({ page, out, log, proof, noOverflow, expect }) {
  await usePreview(page, expect);
  await page.getByRole("button", { name: "Time to build: A few hours" }).click();
  await page.getByRole("group", { name: "Time to build" }).getByRole("button", { name: "A weekend" }).click();
  await page.getByRole("button", { name: "Mood: anything. Edit" }).click();
  await page.getByRole("textbox", { name: "What are you in the mood for?" }).fill("cozy puzzles");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Mood: cozy puzzles. Edit" }));
  await proof("tuned");
  const title = await spin(page, expect);
  log(`brief opened: "${title}"`);
  const dialog = page.getByRole("dialog", { name: "Idea" });
  await expect(dialog.getByText("A weekend"));
  await expect(dialog.getByText("Offline preview"));
  await expect(dialog.getByRole("heading", { name: "A starting point" }));
  await proof("brief");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Saved", exact: true }));
  await dialog.getByRole("button", { name: "Love it" }).click();
  await expect(dialog.locator('button[aria-pressed="true"]', { hasText: "Love it" }));
  await dialog.getByRole("button", { name: "Copy prompt" }).click();
  await expect(toast(page, "Prompt copied."));
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  if (copied.length < 100) throw new Error(`clipboard holds ${copied.length} chars`);
  log(`clipboard: ${copied.length} chars`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download build prompt" }).click(),
  ]);
  await download.saveAs(`${out}/${download.suggestedFilename()}`);
  log(`downloaded ${download.suggestedFilename()}`);
  await dialog.getByRole("tab", { name: "Build prompt" }).click();
  await expect(dialog.getByRole("button", { name: "Edit prompt" }));
  await dialog.getByRole("tab", { name: /^Feedback/ }).click();
  await dialog.getByRole("textbox", { name: "Your feedback" }).fill("Make it single-player only.");
  await dialog.getByRole("button", { name: "Add feedback" }).click();
  await expect(toast(page, "Feedback saved."));
  await expect(dialog.getByRole("tab", { name: "Feedback (1)" }));
  await proof("feedback");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  // Second view: the stored idea after a reload, from the library.
  await page.reload();
  await go(page, "Idea library");
  await expect(page.getByRole("button", { name: "Saved 1" }));
  await expect(page.getByRole("heading", { name: title, level: 2 }));
  await go(page, "Settings");
  await page.getByRole("button", { name: /^Memory/ }).click();
  await expect(page.getByText("Make it single-player only."));
  await noOverflow();
  await proof("persisted");
}
