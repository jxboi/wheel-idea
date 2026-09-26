# Wheel categories

The user chooses which of the eight categories the wheel can land on, and can prevent the same category from coming up twice in a row. The choice persists and is also editable from Settings.

## Sub-features

- `categories-toggle` toggles each category button (`pressed` = enabled); the tuner shows `N of 8 categories`.
- `categories-no-repeat` is the `No repeats in a row` switch.
- `categories-reset` re-enables all eight.
- `categories-persist` keeps the choice after reload, and the Settings row summarizes it (`Wheel N of 8`).

## How to get to it (user POV)

- On the wheel page, `N of 8 categories` in the `Tune the spin` sentence opens the `Categories` dialog.
- Settings → `Wheel N of 8`.

## Driving it with orbit-verify

Preconditions:

- A fresh drive (all eight enabled, no-repeat off).

- **Narrow.** Choose `8 of 8 categories`. In `Categories`, turn off Productivity, Lifestyle, Learning, Creative tools, Community, and Wellness. Turn on `No repeats in a row`. Choose `Done`. The tuner reads `2 of 8 categories`.
- **Persistence.** Reload. It still reads `2 of 8 categories`. Settings → `Wheel 2 of 8` shows `Games` and `Wildcard` pressed, `Wellness` not pressed, and the switch checked.
- **Reset.** Choose `Reset`. `Wellness` is pressed again.
- **All of the above.** Run `node $H drive <run> .claude/skills/verify-orbit/flows/wheel-categories.mjs`, then again with `--viewport desktop`.

## Gotchas

- Category buttons stay in the ARIA tree when disabled. Assert on `pressed`, not on presence.
- `idea-library.mjs` relies on a single enabled category (`Games`) to know where the wheel lands. Use the same trick when a check depends on the category.
- Proving the landing odds or the no-repeat behavior statistically is a unit-test concern (`tests/core.test.ts`), not a browser one.
