# Prism Parallax Extraction — Session Handoff

**Date:** March 13, 2026  
**Session:** Parallax extraction from monolith (third extraction in split)  
**Result:** `index-v54.html` → `index-v55.html` + `prism-parallax.js`

---

## What happened this session

Extracted the Parallax/Orbit/Panel-swipe block from the monolith into `prism-parallax.js`, following a pre-mapped handoff document. Six contiguous blocks were lifted out:

1. **Shared DOM refs + header positions** — `beamHeader`, `beamHeaderImg`, `phone`, `panelsEl`, `HEADER_POSITIONS`
2. **Parallax + orbit + toggle state, toggle board logic** — all parallax/orbit state vars, `activeToggles` Map, `PERSISTENT_TERMS`, `QUAD_SIGNATURES`, `quadRelevance()`, `initToggleBoard()`, `toggleTbChip()`, `clearAllToggles()`
3. **Parallax drawer + input + header helpers** — `toggleParallaxDrawer()`, `togglePlgQuad()`, `togglePlgView()`, `toggleDensityMode()`, `submitParallaxInput()`, `headerOpenTop()`, `setHeaderPosition()`, `resizeBeam()`
4. **Parallax open/close/nav + aggregate renderer** — `openParallax()`, `closeParallax()`, `gotoParallaxPanel()`, `renderParallaxAggregate()`, `togglePfChip()`
5. **Orbit engine (3.2.3)** — `project3D()`, `computeWeightedCentroid()`, beat duration constants, `handleZSlider()`, `startOrbitSequence()`, `tickOrbit()`, `interruptOrbitDrift()`, canvas tap IIFE
6. **Panel swipe + goToPanel** — `swipeStartX`, `swipeTouchStartedOnQuadrant`, touch listeners on `panelsEl`, `goToPanel()`

### Fixes applied during extraction

- **`currentEventIndex` scoping fix:** Was declared inside the `loadEvent`/`advanceEvent` closure (inaccessible to `closeParallax()`). Moved declaration to module-level global scope (`let currentEventIndex = 0;` at line 693 of v55). The closure now reassigns rather than declaring.
- **`swipeStartX` relocation:** Removed from STATE section in main file, declared in `prism-parallax.js` alongside panel swipe block.
- **`isDraggingBeam` and `dragStartX`:** Confirmed staying in main file — used by beam header gesture handlers that remain in the main script.

---

## Current file inventory

| File | Lines | Role |
|------|-------|------|
| `index-v55.html` | 3,471 | Main app — HTML + core JS |
| `prism-parallax.js` | 900 | Parallax overlay, orbit engine, toggle board, panel swipe |
| `prism-styles.css` | 2,665 | All CSS |
| `prism-splash.js` | 489 | Splash, onboarding, profile setup |
| `prismdb.js` | 972 | Shared data layer |
| `prism-graphmap.js` | 631 | Three.js graphmap factory |

Cumulative reduction: original v53 monolith → v55 main file is ~54%.

### Script load order (in `<body>`, after all HTML)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="prism-graphmap.js"></script>
<script src="prismdb.js"></script>
<script src="prism-splash.js"></script>
<script src="prism-parallax.js"></script>
<!-- main <script> block follows -->
```

All extracted functions are globally scoped. The parallax file loads before the main `<script>` block, so all functions are hoisted and available.

---

## Cross-file dependency map

### Parallax file → Main file (globals it reads/calls)

| Symbol | Type | Location in main |
|--------|------|-----------------|
| `currentPanel` | state var | STATE section |
| `submitted` | state var | STATE section |
| `currentPinZ` | state var | STATE section |
| `pinX`, `pinY`, `pinPlaced`, `finalQuadrant` | state vars | STATE section |
| `currentEventIndex` | state var | after graphmapInst (global) |
| `apertureCommitted`, `apertureBand`, `currentBand` | state vars | Diatribe section |
| `veilState` | state var | Morph section |
| `paraIsMirrored` | state var | Parallelogram section |
| `graphmapInst` | object | STATE section |
| `exitGraphmapView()` | function | Morph section |
| `enterGraphmapView()` | function | Morph section |
| `advanceEvent` | function | exposed via `window.advanceEvent` |
| `getCanvasPalette()` | function | top of main script |
| `PrismDB` | module | prismdb.js (separate file) |
| `PrismGraphmap` | module | prism-graphmap.js (separate file) |

### Main file → Parallax file (globals it reads/calls)

| Symbol | Type | Usage in main |
|--------|------|--------------|
| `beamHeader` | DOM ref | gesture handlers, morph, init |
| `beamHeaderImg` | DOM ref | gesture handlers |
| `phone` | DOM ref | gesture handlers, resize, morph |
| `panelsEl` | DOM ref | resize, init |
| `HEADER_POSITIONS` | const array | gesture handlers, init |
| `shadeOpen` | state var | gesture handlers, morph |
| `openParallax()` | function | gesture handlers, morph |
| `closeParallax()` | function | gesture handlers, morph |
| `gotoParallaxPanel()` | function | morph |
| `setHeaderPosition()` | function | gesture handlers, parallelogram, init |
| `resizeBeam()` | function | resize listener, init |
| `renderParallaxAggregate()` | function | (all callers moved to parallax — no remaining refs in main) |
| `handleZSlider()` | function | HTML `oninput` on Z-slider |
| `goToPanel()` | function | gesture handlers |
| `headerOpenTop()` | function | gesture handlers |

### HTML `onclick`/`oninput` → Parallax functions

- `gotoParallaxPanel(0)`, `gotoParallaxPanel(1)`, `gotoParallaxPanel(2)` — parallax nav buttons
- `handleZSlider(this.value)` — Z-slider `oninput`
- `toggleParallaxDrawer()` — drawer chevron
- `submitParallaxInput()` — parallax input submit

---

## What remains in `index-v55.html` main `<script>` block (~3,471 lines total including HTML)

The main script now contains:

1. **Event data + constants** — `ANSWERS`, diatribe responses, Z rules, band resolution, colors, canvas palette, pin images
2. **Core STATE** — `currentPanel`, `initialChoice`, `finalQuadrant`, pin state, `submitted`, `aggView`, `zValue`, `graphmapInst`, `currentEventIndex` (now global)
3. **Beam header variables** — `isDraggingBeam`, `dragStartX` (gesture state only)
4. **Diatribe section** — slider, aperture, band logic, threshold crossing
5. **Beam header gesture / float mode / Parallelogram hold** — mouse + touch handlers for beam drag, prism float, parallelogram 4-second hold
6. **Parallelogram reading surface** — article reader, mirror flip, scroll tracking
7. **Build answer buttons + loadEvent + advanceEvent** — event lifecycle
8. **Corner labels, word clouds, answer selection, quadrant reveal** — main interaction flow
9. **Focus mode, quadrant interaction, Z-axis detection** — pin placement, Z badge
10. **Submit + aggregate canvas + other voices** — response recording
11. **Graphmap view + morph system** — veil-lift, CSS↔Three.js transitions
12. **Init** — resize, build, load, dev-skip

---

## What's next (from roadmap)

The monolith split is now three extractions deep. Remaining main-file content (~2,775 lines of JS) could potentially be further split, but the biggest wins are done. Likely next steps from the roadmap:

- **Test v55 in Safari via Live Server** — verify no regressions from the extraction
- **Veil-lift transition** — build into flat app (Three.js canvas beneath, dwell trigger, camera pullback)
- **Parallelogram editor panel** — admin panel for article + refinement content types
- **3D animation architecture** — unified design document across all four 3D contexts
- **Parallax 3D / Parallax panel** — Z-slider turntable, orbit after static hold, floating word layer
- **Production backend** — Supabase migration, Cloudflare Worker

---

## Session notes

- The extraction was pre-mapped in a handoff document with exact line ranges. All six blocks were contiguous except Block 6 (panel swipe at lines 3268–3295), which was separated from the rest by ~1,700 lines of intervening code.
- `renderParallaxAggregate()` had 14 call sites in v54 — all 14 were within the extracted blocks. Zero orphaned references remain in v55.
- The `panelsEl.addEventListener('touchstart/touchend')` calls in Block 6 execute at parse time when `prism-parallax.js` loads. This is safe because the script tag appears after all HTML in `<body>`, so `#panels` is already in the DOM.
- No namespace object pattern — all functions are plain globals, matching the established extraction pattern from `prism-splash.js`.
