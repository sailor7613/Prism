# Prism Monolith Split — Session Handoff

**Date:** March 13, 2026  
**Session goal:** Break the 7,514-line `index-v53.html` monolith into separate files to reduce per-session context pressure  
**Status:** Two extractions complete, tested and confirmed working

---

## What was done

### 1. CSS extraction → `prism-styles.css` (2,665 lines)
All CSS (`:root` variables, dark/light mode tokens, every component style) extracted from the `<style>` block into a standalone file. HTML now loads it via `<link rel="stylesheet" href="prism-styles.css">` on line 10.

### 2. Splash/onboarding extraction → `prism-splash.js` (489 lines)
Everything from splash screen through app entry pulled into a standalone script:
- `AVATAR_CONFIG` array and helix animation constants
- `initAvatars()`, `startHelix()` — splash avatar float
- `showOnboarding()`, `goObSlide()` — onboarding slides + swipe
- `launchApp()` — transition from onboarding to profile setup
- `showProfileSetup()`, `buildAvatarGrid()`, `psSelectAvatar()`, `checkStep1Ready()`, `goProfileStep2()`, `psSetTab()` — profile setup step 1 & 2
- `buildPoliticiansList()`, `buildLegislationList()`, `renderList()`, `psToggleFollow()`, `psFilterList()` — politician/legislation follow UI
- `buildTopicGrid()`, `psToggleTopic()`, `psFilterTopics()` — topic selection
- `finishProfileSetup()`, `renderRefractionSubs()` — save profile + populate Refraction panel
- `playPortalThenApp()`, `skipToApp()`, `enterApp()` — spectral portal video + app entry
- `AVATARS` array, `TOPICS_DATA` array, profile state variables
- `appEntered` flag (moved here; also set by dev-skip in main script — works because both share global scope)

HTML loads it via `<script src="prism-splash.js"></script>` on line 593, after `prismdb.js` and before the main `<script>` block.

### Result: `index-v54.html`
- **Before:** 7,514 lines (v53)
- **After:** 4,363 lines (v54) — 42% reduction
- Both extractions confirmed working in Safari via Live Server

---

## Current file inventory (Code folder)

| File | Lines | Role |
|------|-------|------|
| `index-v54.html` | 4,363 | Main app — HTML skeleton + core JS |
| `prism-styles.css` | 2,665 | All CSS |
| `prism-splash.js` | 489 | Splash, onboarding, profile setup, portal entry |
| `prismdb.js` | 972 | Shared data layer (localStorage) |
| `prism-graphmap.js` | 631 | Three.js graphmap factory |
| `legislation_data.js` | — | Congress legislation seed data |
| `politicians_data.js` | — | Congress members seed data |
| `admin.html` | 5,211 | Admin portal (separate app) |

---

## Next extractions (proposed order)

### 3. `prism-parallax.js` (~800 lines)
The entire Beam panel interactive layer — highest line count remaining in a self-contained cluster:
- Beam header image pan + navigation
- Parallax overlay open/close, shade state
- Toggle board (quadrant chips, view modes, density mode)
- Parallax drawer
- Parallax input (Operation A/B routing)
- Z-slider handling, orbit animation (beat sequence, azimuth drift)
- 3D projection math (`project3D`, `computeWeightedCentroid`)
- `renderParallaxAggregate()`, `togglePfChip()`
- Panel swipe + `goToPanel()`

**Shared state concern:** This block reads and writes several module-level variables (`shadeOpen`, `touchIntent`, `orbitAngle`, `plgQuadrants`, `plgViewMode`, `densityMode`, etc.) that are currently declared at the top of the parallax section. These should stay as globals or move to a `window.Prism` namespace object.

### 4. `prism-parallelogram.js` (~600 lines)
Parallelogram reading surface — arc articles, case study articles, timeline scrubbing, graphmap reparenting, intersection observers.

**Dependency:** Uses `graphmapInst` from the main script and `PrismGraphmap.create()` for per-article graphmaps.

### 5. `prism-morph.js` (~400 lines)
Flat-to-graphmap morph transition: `preMountGraphmap()`, `applyPrismMorph()`, `snapMorphTo()`, `enterGraphmapView()`, `exitGraphmapView()`, and all the morph math.

### 6. `prism-core.js` (~1,500 lines) — what remains
Event loading, Diatribe aperture, response cards, answer selection, quadrant reveal, pin dragging, Z-analysis, response submission, aggregate rendering, voices panel, graphmap sync, dev-skip init. This is the irreducible core that ties everything together.

---

## Architecture notes

**Load order matters.** All extracted `.js` files use `<script src>` tags in the `<head>` (after Three.js, prism-graphmap.js, prismdb.js). They share the global scope with the main `<script>` block in the body. Functions defined in extracted files are available to the main script because they're hoisted, and the main script's inline `<script>` runs after DOMContentLoaded-equivalent timing (it's at the bottom of `<body>`).

**Shared state pattern:** Currently all state is module-level `let`/`const` in global scope. This works fine with the `<script src>` approach since everything shares the same global context. No namespace object needed yet — that's a future refactor if/when you move to ES modules.

**The one cross-file call to watch:** `playPortalThenApp()` (in splash) calls `openDiatribeForEvent()` (in main script) after a 900ms timeout. This works because the main script is fully parsed before any user interaction triggers the splash flow. Same pattern for `renderRefractionSubs()` which references `POLITICIANS_DATA` and `LEGISLATION_DATA` from the external data files.

---

## Session hygiene note

The whole point of this split is to reduce context pressure. When working on a specific module in future sessions:
- **CSS work:** Only need to read `prism-styles.css` — never load `index-v54.html`
- **Splash/onboarding work:** Only need `prism-splash.js` (~489 lines)
- **Core app work:** Load `index-v54.html` (~4,363 lines) — still large but manageable
- **After parallax extraction:** Core drops to ~3,500 lines, well within comfortable session range

Drop only the relevant file(s) into the session context. The project knowledge docs (J encoding, roadmap, spec, etc.) should also be curated per-session — only include what's needed for the task at hand.
