// Feature: journal (features/journal.md). Write, attach photo, share, persist, discard guard, delete.
import { go, toast } from "./_lib.mjs";

// 1x1 PNG, enough for the compressor to accept.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export default async function ({ page, proof, noOverflow, expect }) {
  await page.getByRole("button", { name: "Write a note" }).click();
  const editor = page.getByRole("dialog", { name: "New entry" });
  await expect(editor);
  await editor
    .getByRole("textbox", { name: "Entry title" })
    .fill("Verify garden");
  await editor
    .getByRole("textbox", { name: "Journal entry" })
    .fill("Seedlings sprouting.");
  await editor
    .locator('input[type="file"]')
    .setInputFiles({ name: "sprout.png", mimeType: "image/png", buffer: png });
  await expect(editor.getByRole("button", { name: "Remove sprout.png" }));
  await editor.getByRole("checkbox", { name: /Use in future spins/ }).check();
  await proof("editor");
  await editor.getByRole("button", { name: "Save entry" }).click();
  await expect(toast(page, "Saved."));
  await page.reload();
  await go(page, "Journal");
  await expect(page.getByRole("heading", { name: "Verify garden", level: 2 }));
  await page
    .getByRole("button", { name: /Verify garden/ })
    .first()
    .click();
  const edit = page.getByRole("dialog", { name: "Edit entry" });
  await expect(edit.getByRole("img", { name: "sprout.png" }));
  await expect(edit.locator('input[type="checkbox"]:checked'));
  await edit
    .getByRole("textbox", { name: "Journal entry" })
    .fill("Changed but not saved.");
  await edit.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    edit.getByRole("alert").filter({ hasText: "Discard unsaved changes?" }),
  );
  await proof("discard-guard");
  await edit.getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("button", { name: "Delete Verify garden" }).click();
  await page
    .getByRole("dialog", { name: "Make a little room" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("heading", { name: "Nothing here yet." }));
  await noOverflow();
  await proof("deleted");
}
