# Journal

The journal holds dated entries with a title, body, up to four photos, and an explicit opt-in (`Use in future spins`) to share the entry with the AI provider when memory is on. Closing an editor with unsaved changes asks before discarding.

## Sub-features

- `journal-create` writes and saves a new entry.
- `journal-photo` attaches a PNG, JPEG, or WebP (compressed; at most 4 per entry) and removes it with `Remove <name>`.
- `journal-share` uses the `Use in future spins` checkbox, which is off by default.
- `journal-edit` reopens an entry and keeps its photo and share state after reload.
- `journal-discard` shows `Discard unsaved changes?` with `Keep writing` and `Discard changes`.
- `journal-delete` removes an entry after confirmation.

## How to get to it (user POV)

- On the wheel page, `Write a note` or `Add a photo` under `Capture a thought`.
- `Journal` → `New entry`.
- The `Journal` link beside `Capture a thought` opens the journal list.

## Driving it with orbit-verify

Preconditions:

- A fresh drive with no entries.

- **Write.** Choose `Write a note`. In the `New entry` dialog, fill `Entry title` with `Verify garden` and `Journal entry` with `Seedlings sprouting.`.
- **Photo.** Call `setInputFiles` on the dialog's `input[type=file]` with a PNG named `sprout.png`. A `Remove sprout.png` button appears.
- **Share.** Check `Use in future spins`.
- **Save.** Choose `Save entry`. The toast reads `Saved.`.
- **Persistence.** Reload and open `Journal`. The heading `Verify garden` is listed. Open it: the `Edit entry` dialog shows the `sprout.png` image and the checkbox is still checked.
- **Discard guard.** Change the body, then choose `Close dialog`. The alert `Discard unsaved changes?` appears. Choose `Discard changes`.
- **Delete.** Choose `Delete Verify garden`, then `Delete`. The page shows `Nothing here yet.`.
- **All of the above.** Run `node $H drive <run> .claude/skills/verify-orbit/flows/journal.mjs`, then again with `--viewport desktop`.

## Gotchas

- `Add a photo` (both the spark button and the upload zone) opens a native file picker. Drive the hidden file input directly.
- New entries are private (`Use in future spins` unchecked). Sharing is an explicit user choice, so assert it rather than assume it.
- `Save entry` stays disabled until the entry has a title, body, or photo.
- Whether a shared entry actually reaches a provider can only be observed on a live spin, which is unreachable without a key.
