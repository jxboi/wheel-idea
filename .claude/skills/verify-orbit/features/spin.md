# Spin the wheel

The user sets how much time they have and a mood, spins the wheel, and gets a brief for a project idea in the landed category. The brief can be saved, reacted to, copied, downloaded, and given feedback, which becomes a memory. Without a working provider, a spin shows a recoverable error instead of a made-up idea.

## Sub-features

- `spin-tune` sets time to build (`A few hours`, `A weekend`, `Go big`) and a free-text mood.
- `spin-preview` produces a labeled Offline preview brief.
- `spin-brief-actions` covers Save, `Love it` / `Not quite`, `Copy prompt`, `Download build prompt`, and the `Build prompt` tab with `Edit prompt`.
- `spin-feedback` adds feedback to the idea and creates a matching memory note.
- `spin-missing-key` shows `Connect an API key in Settings, then spin again.` and saves no idea.
- `spin-live` is a real provider spin with progress and cancel (unreachable without a key).

## How to get to it (user POV)

- On the wheel page, choose `Spin the wheel`.
- `Find an idea` in the library and `Spin the wheel` in the empty library both lead to the wheel.
- The provider is chosen in Settings → AI model, or from the provider button in the `Tune the spin` sentence.

## Driving it with orbit-verify

Preconditions:

- A fresh drive (the default workspace uses OpenRouter with no key).
- `doctor` shows `API up and holds no server key`.

- **Missing key.** Spin on the default provider. Run `node $H drive <run> .claude/skills/verify-orbit/flows/spin-missing-key.mjs`. An alert reads `Connect an API key in Settings, then spin again.`, no `Idea` dialog opens, and the library shows `No ideas yet.`.
- **Switch to preview.** Choose `OpenRouter` in `Tune the spin`, select `Offline preview` in `AI provider`, and choose `Save settings`. The `Settings saved.` toast appears and the wheel shows `Offline preview · sample ideas`.
- **Tune.** Choose `Time to build: A few hours`, then `A weekend`. Choose `Mood: anything. Edit`, type `cozy puzzles`, and press Enter. The buttons now read `Time to build: A weekend` and `Mood: cozy puzzles. Edit`.
- **Spin.** Choose `Spin the wheel`. The button shows `Spinning…` and is disabled. The dialog `Idea` then opens showing the category, `A weekend`, `Offline preview`, and the heading `A starting point`.
- **Act on the brief.** Choose `Save` (it becomes `Saved`), `Love it` (pressed), and `Copy prompt` (toast `Prompt copied.`; the clipboard holds the Markdown prompt). `Download build prompt` saves `<title>.md`.
- **Feedback.** Open the `Feedback` tab, fill `Your feedback`, and choose `Add feedback`. The toast `Feedback saved.` appears and the tab reads `Feedback (1)`.
- **Persistence.** Reload, go to `Idea library`, and check that `Saved 1` and the title heading are present. Settings → `Memory …` lists the feedback text.
- **All of the above.** Run `node $H drive <run> .claude/skills/verify-orbit/flows/spin-preview.mjs`, then again with `--viewport desktop`.

## Gotchas

- The default provider is OpenRouter, not preview. Switch first, or you are testing the missing-key path.
- Preview briefs come from a fixed catalog per category (the Games one is `Tiny Worlds`). Do not treat a repeated title as a bug.
- Preview makes no `/api/generate` call. It proves nothing about providers, sources, or context.
- The idea title has no unique role handle inside the dialog. Read it from `h2.detail-title`.
- The `Save` button's accessible name becomes `Saved`. Match with `exact: true`.
