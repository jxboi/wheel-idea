---
name: verify-orbit
description: Drive the Orbit web app (React + Vite personal idea studio: wheel spin, idea library, journal, memory, settings) in a real headless Chromium at 390px and desktop, and capture screenshot + ARIA proof. Use when you need to prove a UI change works in the real app, reproduce a UI bug, or do the browser check AGENTS.md requires — not for unit tests (use `npm test`).
---

# Verify Orbit

Orbit is one browser surface: a SPA served by `server/dev.ts` (Vite middleware + the `/api/generate` handler). All user data lives in the browser's IndexedDB, so **every drive gets a fresh Chromium profile**: the user's real workspace is never touched, and each flow must create the state it needs.

Everything goes through one helper, run from the repo root:

```sh
H=.claude/skills/verify-orbit/scripts/orbit-verify.mjs
node $H launch                                   # prints RUN=<id> URL=<url> PID=<pid>
node $H doctor <run>
node $H drive  <run> .claude/skills/verify-orbit/flows/<flow>.mjs [--viewport mobile|desktop] [--label name]
node $H stop   <run>
node $H list                                     # runs and whether they are still up
```

Prerequisites: `npm ci` (needs `node_modules/.bin/tsx`) and Playwright with Chromium. The helper loads `playwright` from the repo if present, otherwise from the global npm root. It is deliberately **not** a project dependency; if it is missing, install it globally (`npm i -g playwright && npx playwright install chromium`). Do not add it to `package.json` for a verification run.

## Launch

`node $H launch` picks a free port, starts `node_modules/.bin/tsx server/dev.ts` as its own process group, and waits (up to 60 s) for the log line `Orbit is ready at http://127.0.0.1:<port>`. It records the PID, port, and git commit in `.verify-orbit/<run>/state.json`, and sends the server log to `.verify-orbit/<run>/server.log`.

The launch **blanks `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `ORBIT_ACCESS_TOKEN`, and forces `ORBIT_ENABLE_LOCAL_CLI=false`**. Shell env overrides `.env` in Vite's `loadEnv`, so this holds even when the user has real keys in `.env`. As a result, no drive can make a paid provider call or run a local CLI.

Instances are isolated by port and browser profile, so several runs can coexist, and one can sit next to the user's own `npm run dev`. Never drive the user's own dev server: you cannot guarantee its keys are blank.

Teardown is `node $H stop <run>`.

## Doctor

Run `node $H doctor <run>` before the first drive, and again after any failed drive. It is read-only and exits non-zero on any `FAIL`:

- the server process we started is alive
- the log has the ready line for *our* port
- HEAD is the same commit as at launch (if not, relaunch: the server may be serving mixed code)
- `/` serves the Orbit shell (`id="root"`)
- a schema-valid OpenRouter request with no key returns `401 Connect an API key…`, which proves the API is up **and** holds no server credential

A `note HMR socket shared…` line is informational (see Gotchas).

## Drive

A flow is an ES module whose default export receives `{ page, context, url, out, log, proof, noOverflow, expect }`. Before the flow runs, `drive` opens a fresh context (390×844 by default, or 1440×900 with `--viewport desktop`), loads `/`, and waits for the `Spin the wheel` button.

- `expect(locator, "visible" | "hidden" | "absent", timeoutMs?)`: minimal assertions, with no test runner.
- `proof(name)`: writes `NN-name.png` and `NN-name.aria.txt` (ARIA snapshot of `body`).
- `noOverflow()`: fails if `scrollWidth > innerWidth` (the repo's no-horizontal-scroll rule).
- `log(text)`: appends to `steps.log`.
- The drive fails on a thrown error **or** on any console error or page error. Vite HMR socket noise is the only thing ignored. A flow that expects a console error exports `allowConsole = [/regex/]` (for example `spin-missing-key.mjs` allows the expected 401).
- On failure, the helper captures a `failure` proof automatically.

Shipped flows (in `flows/`; each passed at both viewports when this skill was generated):

| Flow                   | Feature file                     |
| ---------------------- | -------------------------------- |
| `spin-preview.mjs`     | `features/spin.md`               |
| `spin-missing-key.mjs` | `features/spin.md`               |
| `idea-library.mjs`     | `features/idea-library.md`       |
| `journal.mjs`          | `features/journal.md`            |
| `memory.mjs`           | `features/memory.md`             |
| `wheel-categories.mjs` | `features/wheel-categories.md`   |

`flows/_lib.mjs` holds the shared user moves: `go(page, "Idea library" | "Journal" | "Settings" | "The wheel")` clicks whichever navigation the viewport shows, `usePreview` switches to Offline preview through Settings, `spin` spins and waits for the `Idea` dialog, and `toast` finds a `role=status` toast.

To verify something new, copy the closest flow into your scratchpad (or add it to `flows/` if it should be kept), change it, and drive it. Selector rules:

- Use roles and accessible names (`getByRole("button", { name: "Save entry" })`) and scope them to a dialog or region. `Journal` and `Settings` appear more than once on a page.
- Take names from the ARIA snapshots in the evidence, not from CSS classes. The one exception is `h2.detail-title` for the idea title, which has no role-unique handle.
- AGENTS.md requires checking both 390px and desktop. Run each flow twice, with and without `--viewport desktop`.

## Evidence

Evidence goes to `.verify-orbit/<run>/evidence/<flow>-<viewport>/` (or the `--label` name): numbered screenshot + ARIA pairs and `steps.log`, which records the actions, proof paths, console output, and the PASS/FAIL line. `.verify-orbit/` is gitignored. Never commit it, and never copy its contents into `docs/QA.md` or anywhere else in the product workspace (AGENTS.md: keep QA data out of the delivered workspace).

Proof standards:

- Drive the real user path: clicks and typing through the UI. Do not seed IndexedDB, call app internals, or jump by `location.hash` unless the hash route itself is what you are testing.
- Capture the action and the resulting state, and show that the state persisted with a second view: reload, then reopen from a different surface (library, journal list, Settings summary rows).
- Check side effects, not only what is on screen. Examples: deleting an idea also removes the memory made from its feedback, and a save survives reload.
- Offline preview is a real product mode that makes no network call. It is the correct path for proving the spin UI. It does **not** prove live AI generation, research provenance, or context sending. Say so when reporting. Never mock `/api/generate` and then report the result as a live provider check.
- Live providers need a key the user provides and cost money. Treat them as `verified-unreachable` (prerequisite: provider API key and consent to spend) unless the user supplies a key for this purpose. Never read keys from `.env` into a drive.

## Cleanup

`node $H stop <run>` kills the process group the helper started, identified by the PID recorded in `state.json`, and marks the run as stopped. It never kills by process name, so the user's own `npm run dev` is safe. Browsers close at the end of every drive. Evidence stays where it is. Run `stop` after every failed iteration as well as at the end, then run `node $H list` to confirm nothing you launched is still `RUNNING`. Delete an old `.verify-orbit/<run>/` directory only when its evidence is no longer needed.

## Gotchas

- **Vite HMR port 24678 is fixed by `server/dev.ts`.** When a second Orbit or Vite dev server is running, only the first one gets HMR. The others log `WebSocket server error: Port 24678 is already in use`, and their pages log socket errors, which the helper filters out. Verification does not rely on HMR: after editing code, reload the page in the flow, or relaunch for server-side changes (`api/`, `server/`, `shared/`).
- The default workspace provider is **OpenRouter**. A spin without switching to preview gives the missing-key error. That is correct behavior, and `spin-missing-key.mjs` checks it.
- A spin takes about 5 s (a 4.8 s animation, run alongside the request). `spin()` waits up to 30 s for the dialog.
- The mobile layout hides the sidebar (`display:none`), so `Main navigation` is only in the ARIA tree at desktop width. `go()` handles this.
- The journal photo input is a hidden `input[type=file]`. Use `setInputFiles` on it, not the `Add a photo` button (that opens a native picker).
- The multi-tab warning (`Orbit is open in another tab`) appears if a flow opens a second page in the same context. Open one page per context unless that warning is what you are testing.
- The clipboard is granted per context (`clipboard-read`/`clipboard-write`). `Copy prompt` shows `Prompt copied.` in headless Chromium.
