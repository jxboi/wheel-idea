// Feature: memory (features/memory.md). Add, edit, forget a note; toggle memory off.
import { go } from "./_lib.mjs";

export default async function ({ page, proof, noOverflow, expect }) {
  await page.getByRole("button", { name: "Add a memory" }).click();
  await expect(page.getByRole("heading", { name: "Memory", level: 1 }));
  await page.getByRole("textbox", { name: "What should Orbit remember?" }).fill("I build with Svelte.");
  await page.getByRole("button", { name: "Remember this" }).click();
  await expect(page.getByText("1 memory"));
  await page.getByRole("button", { name: "Edit memory" }).click();
  await page.getByRole("textbox", { name: "Edit memory" }).fill("I build with React.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("I build with React."));
  await page.getByRole("switch", { name: "Use memory in my spins" }).click();
  await expect(page.getByText("Nothing personal is sent. Notes stay saved."));
  await page.reload();
  await expect(page.getByText("I build with React."));
  await expect(page.getByRole("switch", { name: "Use memory in my spins", checked: false }));
  await go(page, "Settings");
  await expect(page.getByRole("button", { name: "Memory Off" }));
  await page.getByRole("button", { name: "Memory Off" }).click();
  await proof("off-persisted");
  await page.getByRole("button", { name: "Forget memory" }).click();
  await expect(page.getByText("0 memories"));
  await noOverflow();
  await proof("forgotten");
}
