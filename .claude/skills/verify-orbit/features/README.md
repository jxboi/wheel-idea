# Orbit verification map

This directory is the maintained source for verifying Orbit's user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe. `SKILL.md` covers the harness (`launch` / `doctor` / `drive` / `stop`).

## Baseline preconditions

- A run started by `node $H launch` for this verification. Never drive the user's own `npm run dev`.
- `node $H doctor <run>` passes, including `API up and holds no server key`.
- Each drive starts from an empty workspace in a fresh browser profile: no ideas, entries, or memories, and the provider is **OpenRouter** with no key. The flow creates any state it needs through the UI.

## Driving conventions

- Stable handles are ARIA roles and accessible names, scoped to a dialog (`Idea`, `New entry`, `Edit entry`, `Categories`, `Make a little room`) or a region (`Tune the spin`, `Spin your next project`).
- Navigate with `go(page, …)` from `flows/_lib.mjs`. It clicks `Mobile navigation` (`Wheel`, `Ideas`, `Journal`, `Settings`) at 390px and `Main navigation` plus the sidebar `Settings` at desktop.
- Settings sub-pages open from the Settings list rows, whose accessible names include their summary (`AI model OpenRouter`, `Memory On`, `Wheel 8 of 8`, `Backup & restore`, `Privacy This device`).
- Drive every feature at `--viewport mobile` and `--viewport desktop`.

## Proof and skip reporting

- Proof is the evidence directory of a PASSing drive: numbered screenshot and ARIA pairs plus `steps.log`.
- A mutation is proven only after a reload **and** a second surface shows the stored value.
- Offline-preview proof covers the UI path only. Live AI generation, research provenance ("Found by search"), and memory/journal context actually reaching a provider are `verified-unreachable` without a user-supplied API key and consent to spend. Do not substitute mocks and call the result live.
- Report a skipped entry point with the attempted route and the unmet prerequisite. Do not report it as verified through another path.

## Feature entry contract

Each feature file has an H1, one paragraph of user-visible behavior, then exactly four H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with orbit-verify`, `Gotchas`. Keep implementation details out; name user paths, handles, required state, commands, and observable proof.

## Features

- [Spin the wheel](./spin.md): preview spin, tuning (time, mood), the brief dialog (save, react, copy, download, feedback), and the missing-key error.
- [Idea library](./idea-library.md): search, category filter, saved tab, reopen, delete, and the removal of the deleted idea's feedback memory.
- [Journal](./journal.md): write, attach a photo, share with future spins, persist, discard guard, delete.
- [Memory](./memory.md): add, edit, and forget notes; the global memory toggle.
- [Wheel categories](./wheel-categories.md): narrowing categories, no-repeats, reset, persistence.

## Not yet mapped

These are user-facing but have no recipe yet. Add a file before claiming them verified.

- Settings → Backup & restore (export download, import review → `Replace`).
- Settings → AI model for OpenAI / Claude API / local CLIs (local CLIs are disabled by `launch`; API providers need keys).
- Settings → Privacy (static copy plus the `Memory settings` link).
- Live spin progress (`ActivityPanel`) and Cancel during a live request. These only appear for non-preview providers.
