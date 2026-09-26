# Verification — 26 September 2026

## Automated

A clean `npm ci` succeeded. `npm run build`, `npm test` (15 passing tests), and `npm run format:check` passed. `npm ci` reported zero known dependency vulnerabilities. Production assets are built in `dist`.

Tests cover repeated wheel landing across all categories; disabled memory; private journal exclusion; shared photos; all eight preview briefs; malformed AI responses; unsafe source links; backup versions; request validation; all three API request shapes with search and effort; provider failures; cross-origin rejection; deployed server-key protection; and local-tool rejection on Vercel.

## Browser checks

Used the Codex in-app browser with native accessibility/DOM inspection and its screenshot API. No fallback browser was needed. Native reference size: **1536×1024**. Mobile checks: **390×844** and **360×800**. Measured document width equals viewport width on the wheel, settings, memory, and library at 360px, and on the desktop wheel at 1536px.

Verified in the browser:

- Spin starts animation and disables repeat submission; completion opens the correct category’s brief.
- Save an idea, react, add feedback, and see the corresponding memory.
- Copy the full Markdown prompt to the clipboard.
- Create a journal entry, attach an image, save, reload, and confirm both text and image persist.
- Journal entries start private (not shared with AI).
- Unsaved journal changes offer keep-writing/discard before closing.
- Choose OpenRouter and medium effort; spin without a key; see a recoverable missing-key error rather than a fake AI response.
- Import a schema-valid backup, review its counts, confirm replacement, and see the restored empty workspace.
- Open journal from the wheel navigates to the journal.
- Empty library, journal, memory, provider settings, and mobile navigation render correctly.

Testing-only records were removed by restoring the original empty workspace. Default provider is back to Offline preview. No user credentials were entered, no paid live model calls were made, and local CLIs were not launched for generation. Live authentication, research quality, vision support, and quota behavior still require provider configuration. Vercel configuration is present; no deployment was performed.

## Visual comparison ledger

Final `view_image` inspection compared `docs/design/concept.png`, `docs/design/desktop.png`, and `docs/design/mobile.png` in the same QA pass. The primary screen faithfully follows the concept’s composition and visual system, with the functional deviations below.

| Area | Concept and final comparison | Action / status |
| --- | --- | --- |
| Copy | Headline, subline, navigation, mood panel, time choices, and capture actions preserved | Above-the-fold copy checked; additions are offline disclosure and category customization |
| Layout | Persistent navigation, open wheel, one context panel, lower journal strip | Matched; mobile stacks wheel and panel with bottom navigation |
| Typography | Editorial serif headings/labels, compact sans-serif chrome | Local Lora and DM Sans; explicit control typography |
| Palette | Warm paper, dark ink, muted blue, eight pastel wedges | Tokens preserved; no stock images or new gradients |
| Wheel | Double rim, dark pointer, cream hub, readable labels | Fixed initial orientation; counter-rotating labels stay upright; exact landing tested |
| Spacing | Open canvas and one framed panel | Desktop hierarchy refined; usable mobile spacing |
| Icons | Fine outline icons and sunburst brand | Cohesive Lucide/native family; wheel nav uses a simplified circle |
| Motion | Tactile deceleration and clear result reveal | 4.8-second easing and reduced-motion alternative |

Intentional differences: native SVG/font rendering instead of raster UI; offline-preview disclosure and category controls; these controls slightly increase desktop page height; simplified outline glyphs from one icon family; “Creative tools” uses two lines for small-screen readability. Secondary pages extend the same visual system. No material clipping, broken controls, missing assets, or horizontal overflow remains in the checked viewports.

Repairs during QA: upright wheel labels, actual exclusion of forgotten feedback from AI context, journal navigation, unsaved-draft protection, image protocol validation, and development-only React root recreation caused by hot-reloading an inline error-boundary class. ErrorBoundary now lives in its own module; final fresh-load workflows completed normally.

The browser’s full-page capture produced incorrect padding immediately after changing viewport size. Final evidence uses viewport screenshots taken after the viewport settled, at the stated sizes.

# Verification — improvements pass, 26 September 2026

## Automated

`npm test` (50 passing tests in 6 files), `npm run build`, and `npm run format:check` passed. `tsc -b` now also type-checks the JavaScript server modules (`// @ts-check`). The API handler was imported under plain Node ESM to confirm the unbundled Vercel import graph resolves. Initial JavaScript dropped from 475 KB to 331 KB (143 KB → 100 KB gzipped) by lazy-loading secondary pages and the Markdown-based idea detail.

## Browser checks

Headless Chromium (Playwright) at **390×844** and **1440×900**, against `npm run dev`, in fresh browser profiles:

- A database-v1 workspace (idea marked `cited`, journal entry with a photo, memory note) migrates on load. The idea now reads as unverified and the photo renders from binary storage.
- Mood, time budget, category choice, and the no-repeat switch persist across reload.
- A second tab shows the “open in another tab” warning.
- A preview spin opens its brief through the lazily loaded detail view.
- A provider spin, using a fixture response via request interception, labels sources “Found by search” / “Not confirmed by search”. It sends complete-JSON context with the shared journal and photo and the saved preferences, and never lands on a disabled category.
- No horizontal overflow, and no console errors.

No live provider calls were made. `pause_turn` continuation, provenance extraction, and abort-on-disconnect are verified with fixtures only; live provider response shapes, quotas, and billing on cancellation were not exercised. QA used throwaway browser profiles, so no workspace data was created or changed.
