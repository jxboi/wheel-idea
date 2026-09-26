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
