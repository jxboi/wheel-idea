# Orbit design system
Reference: concept.png, generated with the built-in image tool. Brief: an editorial developer idea studio, tactile eight-sector wheel, personal context panel, persistent navigation, journal capture strip. Native UI, no stock imagery.

Paper #f7f6f2; surface #fcfbf8; ink #202a3f; secondary #777d88; blue #45699f; border #dfdcd4. Lora serif for headings and wheel labels; DM Sans for interface. Sidebar 218px at desktop, content max-width 1320px. Heading 44px, section heading 26px, body 14px, metadata 11px. Mobile heading 32px and bottom navigation. Borders 1px; panel radius 14px; button radius 9px. Wheel is native SVG with pastel sectors, double ink rim, stationary hub and pointer. Lucide outline icons 1.6px strokes.

Primary composition: workspace header, heading/subtitle, unboxed wheel on left, mood/time/provider panel on right, journal capture strip below. Mobile stacks wheel then panel, with sticky compact bottom navigation. Spinning uses a 4.8s decelerating transform, reduced-motion uses 120ms. AI work begins with the spin and result waits for both; errors remain recoverable.

Component families: sidebar / mobile navigation; primary and outline buttons; context panel; filter chips; journal sheet; detail dialog; form controls. Secondary states extend this system: idea list, notebook entries, editable memory list, provider settings, generated brief and feedback drawer.

Allowed first-screen copy follows concept: Orbit; The wheel; Idea library; Journal; Memory; Settings; Your next thing starts here.; Your creative workspace; Local workspace; A little chance. A great next idea.; Get out of your head. Find something worth building.; let's make something; Spin the wheel; A little serendipity goes a long way.; Make it yours; What are you in the mood for?; Give chance a little direction.; Time to build; A few hours; A weekend; Go big; Your creative copilot; Configure AI; Connect your favorite model in Settings.; Your journal and feedback help shape every idea.; Room for a spark; Open journal; Capture a thought; Drop an inspiration; Make it personal.

Intentional functional additions: visible Offline preview label when no model is connected; category editing; status and error messages; optional session credentials. The wheel SVG is functional UI, not a raster asset.
