# AGENTS.md

Guidance for coding agents working in this repository. Everything under `archive/` is legacy/unused and should be ignored — do not read it for context and do not edit it.

## What this project is

empID is a static, client-side web app for identifying Empidonax flycatchers ("empids"). It has two main tools, both loaded from a single page:

1. **Reference / Questionnaire / Glossary** — browse species field marks, answer optional clues to rank likely species, and read trait definitions. Driven by [js/index.js](js/index.js) and data in [empid_traits.json](empid_traits.json).
2. **Primary Tip Tool ("ptip")** — an in-browser image tool that helps distinguish a small set of tricky Empidonax species by measuring primary feather-tip spacing from a wing photo. The current focus is limited to these comparisons:
   - Acadian Flycatcher vs Yellow-bellied Flycatcher
   - Least Flycatcher vs Alder Flycatcher vs Willow Flycatcher
   Driven by [js/ptip.js](js/ptip.js).

There is no build step, bundler, package manager, or server-side code. Everything runs by opening/serving [index.html](index.html) directly (e.g. a static file server). All image processing happens client-side; nothing is uploaded anywhere.

## Key files

- [index.html](index.html) — the only active HTML entry point. Contains both the reference/quiz/glossary markup and the `#ptipTool` modal markup.
- [js/index.js](js/index.js) — reference view, questionnaire ranking, glossary rendering, dark mode, and the main application state.
- [js/ptip.js](js/ptip.js) — self-contained IIFE powering the Primary Tip Tool (upload, vector placement, pan/zoom, tip placement, ratio ranking, and species-group filtering). Exposes `window.ptipTool` (`open`, `close`, `refreshRatioProfiles`) for the page to call into.
- [css/index.css](css/index.css) — styles for the main reference/quiz/glossary page.
- [css/ptip.css](css/ptip.css) — styles for the Primary Tip Tool modal.
- [empid_traits.json](empid_traits.json) — species trait/category data used by both the questionnaire and the ptip reference data.
- [sample-empid-session.json](sample-empid-session.json) — example session data, not currently wired into the active app.
- `images/` — reference photos/diagrams used by the glossary and species grid.
- `archive/` — old/superseded HTML experiments plus the legacy `app.js`/`styles.css` they depended on. Ignore entirely.

## Primary Tip Tool coordinate system (important when touching `js/ptip.js`)

- `#vectorLayer` (SVG) is nested inside `#imageStage` so the tip/vector overlay always shares the exact same CSS `transform` as the photo — never compute a separate on-screen projection for the overlay.
- `#imageStage` is given a **fixed pixel width/height**, snapshotted from the workspace rect when an image is loaded (in `setImage`). This is the stable "stage-local" coordinate space; it must not be resized responsively, or stored vector/tip coordinates will drift from the photo. Window resizes should only change the *centering* term of the transform (see `renderView`/`applyConfirmedTransform`), not the stage's own size.
- `pointFromEvent` / `visibleImageBounds` convert screen coordinates to stage-local coordinates by inverting the live `getComputedStyle(imageStage).transform` via `DOMMatrix`. Use this helper pattern for any new pointer-driven feature instead of re-deriving pan/zoom/rotation math by hand.
- On "confirm vector", pan/zoom is baked once into stage-local coordinates, then rotation/scale are stored in `confirmRotation`/`confirmFitScale` and reapplied by `applyConfirmedTransform()` (which reads the *live* workspace rect so it stays centered after a resize).
- Feather-tip projection calculations use the component of each tip aligned with the vector itself. Perpendicular distance from the vector should not affect ranking or ratio comparisons.
- The ptip modal compares a small set of species groups rather than the whole North American range. The active comparison is selected in the tool UI and should remain limited to the two current pairings above.

## Conventions

- Plain ES2020+ JavaScript, no frameworks, no TypeScript, no build tooling. Keep new code dependency-free and framework-free to match.
- Each `js/*.js` file for the active app is wrapped in an IIFE (or otherwise scoped) and communicates via small `window.*` handoff objects rather than globals everywhere.
- `"use strict";` at the top of each script file.
- Prefer `querySelector`/`dataset`/native DOM APIs over adding libraries.

## Testing / verification

There is no automated test suite. Verify changes by opening [index.html](index.html) in a browser (or serving the folder with any static file server) and manually exercising the reference view, questionnaire, glossary, and Primary Tip Tool (upload an image, place a vector, rotate it, resize the window, place tips, and switch the species-group filter).
