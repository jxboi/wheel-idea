# Orbit design system
Reference: concept.png, generated with the built-in image tool. Brief: an editorial developer idea studio, tactile eight-sector wheel, personal context panel, persistent navigation, journal capture strip. Native UI, no stock imagery.

Paper #f7f6f2; surface #fcfbf8; ink #202a3f; secondary #777d88; blue #45699f; border #dfdcd4. Lora serif for headings and wheel labels; DM Sans for interface. Sidebar 218px at desktop, content max-width 1320px. Heading 44px, section heading 26px, body 14px, metadata 11px. Mobile heading 32px and bottom navigation. Borders 1px; panel radius 14px; button radius 9px. Wheel is native SVG with pastel sectors, double ink rim, stationary hub and pointer. Lucide outline icons 1.6px strokes.

Primary composition: workspace header, heading/subtitle, unboxed wheel on left, mood/time/provider panel on right, journal capture strip below. Mobile stacks wheel then panel, with sticky compact bottom navigation. Spinning uses a 4.8s decelerating transform, reduced-motion uses 120ms. AI work begins with the spin and result waits for both; errors remain recoverable.

Component families: sidebar / mobile navigation; primary and outline buttons; context panel; filter chips; journal sheet; detail dialog; form controls. Secondary states extend this system: idea list, notebook entries, editable memory list, provider settings, generated brief and feedback drawer.

Allowed first-screen copy follows concept, kept deliberately short: Orbit; The wheel; Idea library; Journal; Memory; Settings; Your creative workspace; Local workspace; A little chance. A great next idea.; Get out of your head. Find something worth building. (desktop only); let's make something; Spin the wheel; What are you in the mood for?; Time to build; A few hours; A weekend; Go big; Your creative copilot; Configure AI; Capture a thought; Write a note; Add a photo; Add a memory.

Copy rule: one short line beats two. Mobile shows no subtitles on the wheel, no idle captions, and no decorative helper text; every secondary label is 11px or larger and form fields are 16px to avoid iOS focus zoom.

Intentional functional additions: visible Offline preview label when no model is connected; category editing; status and error messages; optional session credentials. The wheel SVG is functional UI, not a raster asset.
