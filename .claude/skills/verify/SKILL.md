---
name: verify
description: Verify a change to Orbit before calling it done — runs the CI gates (format, tests, typecheck/build, Vercel import check), then drives the real app in headless Chromium at 390px and desktop with provider calls intercepted. Use after any substantive change, before committing or opening a PR, or when asked to "verify", "QA", "check it works", or "test in the browser".
---

# Verify an Orbit change

AGENTS.md requires `npm test`, `npm run build` and `npm run format:check`, plus a real-browser check at 390px and desktop. This skill does both, the same way every time. Report what ran, what passed, and what was **not** verified.

## 1. Gates (mirror `.github/workflows/ci.yml`)

Run from the repo root, in this order, and stop at the first failure:

```sh
npm ci                                  # only if node_modules is missing or the lockfile changed
npm run format:check                    # on failure: npm run format, then re-check
npm test                                # vitest, fixtures only
npm run build                           # tsc -b (also type-checks server JS) + vite build
node -e 'import("./api/generate.js")'   # the Vercel function's unbundled import graph resolves
```

A failing gate is a finding. Don't skip, weaken or delete a test to get green.

## 2. Browser smoke (real app)

Start the full app with **provider keys blanked**, because this container may hold real keys:

```sh
OPENROUTER_API_KEY= OPENAI_API_KEY= ANTHROPIC_API_KEY= ORBIT_ENABLE_LOCAL_CLI=false npm run dev
```

Run it in the background and wait until `http://127.0.0.1:5173` responds. Use `npm run dev`, not `vite preview`, which has no `/api/generate`.

Then run:

```sh
node .claude/skills/verify/smoke.mjs http://127.0.0.1:5173 <scratchpad>/verify-shots
```

The script uses a fresh Chromium profile per viewport (390×844 and 1440×900), so the user's IndexedDB workspace is never touched. It checks:

- `#wheel`, `#library`, `#journal`, `#settings` render with no horizontal overflow.
- A spin disables the button, then surfaces the provider error from an intercepted `401`. It never opens an offline example, and the button re-enables.
- Exactly one `/api/generate` call is made, and it is intercepted, so nothing reaches a provider.
- There are no console or page errors.

It exits non-zero on any failure. **Look at the screenshots** it writes (Read the PNGs). Passing assertions don't prove the layout looks right. Compare against `docs/design/mobile.png` and `docs/design/desktop.png` for the pages you touched.

Stop the dev server when done with `pkill -f "[t]sx server/dev.ts"`. The brackets stop the pattern from matching, and killing, your own shell.

## 3. Exercise the changed flow

The smoke run is a floor. Also drive the specific flow your change touches, with a short ad-hoc Playwright script in the scratchpad that follows the same rules as `smoke.mjs`: fresh context, blanked keys, `page.route("**/api/generate", …)` fulfilled with a fixture. Examples by area:

| Changed area                  | Also check                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Wheel / `src/lib/wheel.ts`    | Landing matches the result's category; disabled categories are never landed on; reduced motion.                    |
| Generation / provenance       | Fixture with sources: "Found by search" / "Not confirmed by search" labels; cited/unverified/uncited status.       |
| Context / memory / journal    | Request body (read it in the route handler) respects the memory toggle, per-entry sharing, and forgotten notes.    |
| Storage / schema / migrations | Seed an older DB version, reload, and confirm it migrates. Data survives reload; backup export→import round-trips. |
| Settings                      | Values persist across reload; API keys are **not** in IndexedDB or exports.                                        |
| Any UI                        | 390px and desktop, no overflow, bottom nav on mobile, keyboard focus visible.                                      |

## Rules

- **No live provider calls.** Always intercept `/api/generate` in the browser. Only exercise a live provider if the user explicitly asks, and say so in the report.
- Never enable local CLI providers for verification.
- QA data stays in throwaway browser contexts. Never write to, clear or import over the user's real workspace.
- Screenshots and scripts go in the scratchpad, not the repo.

## Report

End with a short summary:

- Each gate and its result (test count from vitest).
- Smoke results per viewport, and which screenshots you inspected.
- What you exercised for the changed flow.
- **Not verified**: live provider auth and quotas, real search quality, model availability, Vercel deploy. Fixtures cannot cover these.

If the change is significant, append a dated entry to `docs/QA.md` in its existing style.
