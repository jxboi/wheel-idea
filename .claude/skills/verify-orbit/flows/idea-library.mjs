// Feature: idea library (features/idea-library.md). Search, filter, save, open, delete (+ its feedback memory).
import { usePreview, spin, toast, go } from "./_lib.mjs";

export default async function ({ page, log, proof, noOverflow, expect }) {
  await usePreview(page, expect);
  // Only Games enabled, so the category of the one idea is known.
  await page.getByRole("button", { name: "8 of 8 categories" }).click();
  const cats = page.getByRole("dialog", { name: "Categories" });
  for (const name of [
    "Productivity",
    "Lifestyle",
    "Learning",
    "Creative tools",
    "Community",
    "Wellness",
    "Wildcard",
  ])
    await cats.getByRole("button", { name, exact: true }).click();
  await cats.getByRole("button", { name: "Done" }).click();
  const title = await spin(page, expect);
  log(`idea: "${title}"`);
  const dialog = page.getByRole("dialog", { name: "Idea" });
  await dialog.getByRole("tab", { name: /^Feedback/ }).click();
  await dialog
    .getByRole("textbox", { name: "Your feedback" })
    .fill("Library flow feedback.");
  await dialog.getByRole("button", { name: "Add feedback" }).click();
  await expect(toast(page, "Feedback saved."));
  await dialog.getByRole("button", { name: "Close dialog" }).click();

  await go(page, "Idea library");
  const card = page.getByRole("heading", { name: title, level: 2 });
  await expect(page.getByRole("button", { name: "All ideas 1" }));
  await page
    .getByRole("textbox", { name: "Search ideas" })
    .fill(title.split(" ")[0]);
  await expect(card);
  await page
    .getByRole("textbox", { name: "Search ideas" })
    .fill("zzzz-no-such-idea");
  await expect(page.getByRole("heading", { name: "No matches." }));
  await page.getByRole("textbox", { name: "Search ideas" }).fill("");
  await page
    .getByRole("combobox", { name: "Filter by category" })
    .selectOption("Wellness");
  await expect(page.getByRole("heading", { name: "No matches." }));
  await page
    .getByRole("combobox", { name: "Filter by category" })
    .selectOption("Games");
  await expect(card);
  await page.getByRole("button", { name: "Save idea" }).click();
  await page.getByRole("button", { name: "Saved 1" }).click();
  await expect(card);
  await proof("saved-filter");
  await card.click();
  await expect(
    page
      .getByRole("dialog", { name: "Idea" })
      .getByRole("button", { name: "Saved", exact: true }),
  );
  await page
    .getByRole("dialog", { name: "Idea" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await page
    .getByRole("dialog", { name: "Make a little room" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(toast(page, "Deleted."));
  await page.getByRole("button", { name: "All ideas 0" }).click();
  await expect(page.getByRole("heading", { name: "No ideas yet." }));
  await noOverflow();
  await proof("deleted");
  // Side effect: the feedback memory goes with the idea.
  await go(page, "Settings");
  await page.getByRole("button", { name: /^Memory/ }).click();
  await expect(page.getByText("0 memories"));
  await expect(page.getByText("Library flow feedback."), "absent");
  await proof("memory-removed");
}
