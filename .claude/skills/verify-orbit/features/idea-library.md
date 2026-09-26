# Idea library

The library lists every idea the user has spun. It can be searched by text, filtered by category or by saved status, and each card can be saved, opened, or deleted. Deleting an idea also removes any memory notes created from its feedback.

## Sub-features

- `library-search` narrows cards by text and shows `No matches.` when nothing fits.
- `library-category` filters with the `Filter by category` select.
- `library-saved` toggles `Save idea` / `Unsave idea` on a card; the `Saved N` tab lists saved ideas.
- `library-open` opens a card into the `Idea` dialog.
- `library-delete` confirms in `Make a little room`, removes the idea, and removes its feedback memories.

## How to get to it (user POV)

- `Ideas` in the mobile navigation, or `Idea library` in the desktop sidebar.
- Closing a freshly spun brief keeps the idea in the library.

## Driving it with orbit-verify

Preconditions:

- A drive in which the flow first creates one idea: switch to Offline preview, enable only `Games` in `Categories`, spin, and add feedback. `idea-library.mjs` does this.

- **Counts.** Open the library. `All ideas 1` is shown along with the idea's heading.
- **Search.** Fill `Search ideas` with the first word of the title; the card is visible. Fill `zzzz-no-such-idea`; `No matches.` appears. Then clear the search.
- **Category.** Select `Wellness` in `Filter by category` (`No matches.`), then `Games` (the card returns).
- **Saved.** Choose `Save idea`, then the `Saved 1` tab; the card is listed.
- **Open.** Choose the card heading. The `Idea` dialog shows `Saved`. Close it.
- **Delete.** Choose `Delete <title>`, then `Delete` in `Make a little room`. The toast is `Deleted.`, and `All ideas 0` shows `No ideas yet.`.
- **Side effect.** Settings → `Memory …` shows `0 memories`, and the feedback text is gone.
- **All of the above.** Run `node $H drive <run> .claude/skills/verify-orbit/flows/idea-library.mjs`, then again with `--viewport desktop`.

## Gotchas

- The `All ideas N` and `Saved N` tab names include the count. Match them exactly after each change.
- Search and category filters combine. Clear one before asserting on the other.
- The empty state reads `No ideas yet.` with no ideas at all, and `No matches.` when filters hide every idea.
