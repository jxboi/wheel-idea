# Memory

Memory is the set of notes Orbit may send with future spins. The user adds notes directly, and feedback on ideas adds them automatically. Notes can be edited or forgotten, and one global toggle turns off all personal context.

## Sub-features

- `memory-add` adds a note with `Remember this`.
- `memory-edit` edits a note in place (`Edit memory` → `Save`).
- `memory-forget` removes a note with `Forget memory`.
- `memory-toggle` is the `Use memory in my spins` switch; its caption changes and the setting persists.
- `memory-summary` shows the `Shaping your ideas` counts (notes, reactions, feedback, shared entries).

## How to get to it (user POV)

- On the wheel page, `Add a memory`.
- Settings → `Memory On` / `Memory Off`.
- Settings → `Privacy` → `Memory settings`.
- The old `#memory` link redirects to Settings → Memory.

## Driving it with orbit-verify

Preconditions:

- A fresh drive with no memories and memory on.

- **Add.** Choose `Add a memory`. The heading reads `Memory`. Fill `What should Orbit remember?` with `I build with Svelte.` and choose `Remember this`. The count reads `1 memory`.
- **Edit.** Choose `Edit memory`, change `Edit memory` to `I build with React.`, and choose `Save`. The new text is shown.
- **Toggle.** Choose the `Use memory in my spins` switch. The caption reads `Nothing personal is sent. Notes stay saved.`.
- **Persistence.** Reload. The note text is still there and the switch is unchecked. The Settings list shows `Memory Off`.
- **Forget.** Choose `Forget memory`. The count reads `0 memories`.
- **All of the above.** Run `node $H drive <run> .claude/skills/verify-orbit/flows/memory.mjs`, then again with `--viewport desktop`.

## Gotchas

- The switch is a native checkbox with `role=switch`. Use `getByRole("switch", { checked })`, not `aria-checked`.
- `Edit memory` names both the pencil button and, while editing, the textarea. Scope by role.
- The UI can prove that a forgotten note is gone and that the toggle is off. It cannot prove what the provider receives; that needs a live spin.
