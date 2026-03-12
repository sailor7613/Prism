# Prism v50 — Gallery Integration Handoff

## March 10, 2026

**Active file:** `index-v50.html` (~5,996 lines, self-contained except for external JS)
**Gallery source:** `prism-gallery-v2.html` (standalone reference — scene code now lives inside v50)
**Status:** Step 1 complete. Gallery scene running behind flat app. Step 2 (veil-lift) is next.

**Drop-in for next session:** This handoff, `index-v50.html`, `prism-gallery-v2.html`, `Prism_Diatribe_Aperture_Revision_v1.md`, `Prism_Architecture_Update_v1.md`, `Prism_Roadmap_v1_7.md`

**External dependencies (must be in same directory):** `prismdb.js`, `legislation_data.js`, `politicians_data.js`, plus artwork assets referenced by relative paths (`../Artwork/...`)

---

## 1. What Was Built This Session

### Gallery Integration — Step 1 (Canvas Embed)

The full Three.js gallery scene from `prism-gallery-v2.html` is now running inside `index-v50.html`, behind the flat app. The architecture:

- **`#gallery-container`** — a `position: fixed; inset: 0; z-index: 0; pointer-events: none` div sits as the first child of `<body>`, *outside* the phone shell
- **Three.js canvas** renders the full gallery scene (room, columns, stars, moon, animals, wall frames, pedestal, asterisk, rings, parchment, graphmap) at 60fps
- **Phone shell** (`.phone`) has `z-index: 10` — fully opaque, the gallery is invisible beneath it
- **Gallery code** is wrapped in `const PrismGallery = (function(){ ... })()` IIFE — zero variable leakage into the flat app's scope
- **`PrismGallery` namespace** exposes scene, camera, renderer, all object groups, diatribe state, lights, camera target, and gallery assets config — everything Step 2 needs

### Script execution order
1. `legislation_data.js` + `politicians_data.js` (in `<head>`)
2. `three.min.js` CDN (after phone shell closes)
3. Gallery IIFE (lines ~2469–3631)
4. `prismdb.js`
5. Flat app script (lines ~3634–5934)

### Parallax Drawer (UI tweak)

The parallax controls below the Z slider (ABCD buttons, scatter/heat, Framework chips, Event chips, parallax input) are now in a **collapsible drawer** that starts collapsed. A "Controls ▾" toggle sits under the Z status readout. The Z slider itself stays permanently visible. This gives the graphmap maximum screen space in the parallax view.

---

## 2. What Exists in the Gallery Scene

Everything from the standalone `prism-gallery-v2.html` is present and rendering:

- **Room:** 16×16×9, translucent walls, floor tiles, four ceiling panels, skylight opening
- **Ionic columns** at four corners with fluted shafts, Attic bases, volutes
- **Celestial:** 800-star dome, procedural phase-accurate moon (forced full for testing), moon glow, directional moonlight
- **Sun system:** Sun disc + glow + directional light + volumetric shaft (for skylight/daylight mode)
- **Acacia tree** outside the left wall with canopy
- **Animals:** Elephant (behind back wall), giraffe (behind right wall), zebra (behind front wall) — all with idle breathing animations
- **Wall frames:** Four frames with auto-resize on image load, frame spotlights. Configured via `GALLERY_ASSETS.frames` object
- **Skylight:** Video texture + static image layer. Configured via `GALLERY_ASSETS.skylightVideo` and `.skylightImage`
- **Pedestal:** Classical column pedestal at room center (transparent, opacity 0.5)
- **Asterisk:** Multicolored (4 quadrant rays + 4 cream axis rays + white core), gentle pulse/rotation
- **Aperture rings:** Primary ring (user's Diatribe) + ghost ring, with color-shifting logic
- **Parchment on easel:** Dynamic canvas texture showing Diatribe state, easel rotated 180° to face room center
- **Graphmap:** Vertex-colored iridescent plane, 10-division grid, quadrant shades, Z-axis with tick marks — starts hidden (toggle-ready)

The gallery currently **auto-orbits** with no user interaction (pointer-events: none on the container). Camera slowly circles the room, with gentle vertical oscillation.

**Console verification:** "Gallery scene initialized (behind flat app)" logs on load.
**Quick visual check:** Paste `document.getElementById('phone').style.opacity = '0.15'` in DevTools to see the gallery through the phone shell.

---

## 3. Step 2 — The Veil-Lift (Next Session)

This is the big build. The mechanical design is settled (from the gallery v2 handoff):

### 3a. Dwell Trigger
- User stops interacting with the graphmap for ~30 seconds
- Timer resets on any touch/click/scroll in the flat app
- Only triggers when user is on the Prism panel (panel 2) or Parallax view

### 3b. DOM Fade
- Phone shell (`.phone`) fades to `opacity: 0` over 3–4 seconds
- All DOM panels become transparent — the flat app dissolves
- The `#gallery-container` switches from `pointer-events: none` to `pointer-events: auto`

### 3c. Canvas Expansion
- The Three.js canvas is already full-viewport — it just becomes visible as the phone fades
- No actual canvas resize needed; it's been rendering full-screen the whole time

### 3d. Camera Unlock
- Switch from auto-orbit to user-controlled orbit (drag to rotate, scroll to zoom)
- The gallery's orbit controls, art walk (press-hold), and parchment click handlers need to be activated
- These were intentionally omitted from Step 1 — they exist in `prism-gallery-v2.html` and need to be ported into the IIFE with an activation gate

### 3e. The Return Transition
- **The hardest sub-problem.** User taps the Prism nav triangle → camera must interpolate from *wherever they are* in the gallery back to the tight front-lock position
- The approach animation system from the gallery already handles lerp between arbitrary start/end positions
- The challenge: computing the correct "locked" camera position that makes the Three.js Graphmap look like the CSS 3D graph in the flat app
- Once the camera reaches the lock position, the DOM fades back up and pointer-events swap back

### 3f. The Nav Tether
- The Prism nav triangle (SVG at bottom-right of the gallery) must be visible in *both* worlds
- It lives as a DOM element, positioned with CSS, above both the gallery canvas and the phone shell
- In flat-app mode: acts as existing nav
- In gallery mode: acts as the return button

### Open Questions for Step 2
- **Dwell trigger scope:** Should it only fire once per session, or reset after return? (Handoff says "dwell timer resets" — so it can fire repeatedly)
- **Camera lock computation:** What camera position in Three.js corresponds to "looking at the CSS 3D graph from the front"? This needs to be calibrated visually
- **Transition timing:** 3–4 seconds for the fade feels right, but may need tuning against the actual scene reveal
- **Gallery interaction during fade:** Should orbit controls activate as soon as the fade starts, or only after it completes?

---

## 4. The Parallax Graphmap Vision

From this session: Sailor wants the CSS 3D graph in the parallax view to *be* the Three.js Graphmap. This is a stretch goal beyond the basic veil-lift — it means:

- When parallax mode activates, the CSS graph could be replaced by a window into the Three.js scene (camera locked tight on the Graphmap, clipped to the quadrant area)
- This is the intermediate state between "flat app" and "full gallery" — the user is seeing the 3D graph sculpture but still in the phone shell
- The dwell trigger on *this* view then lifts the veil to reveal the full room

This is architecturally clean because the Three.js scene is already rendering. The question is whether to replace the CSS graph with a clipped Three.js viewport, or overlay a transparent window onto it. TBD for the veil-lift session.

---

## 5. File Anatomy of index-v50.html

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| CSS | 1–1902 | All styles including gallery container, parallax drawer |
| External head scripts | 1903–1904 | legislation_data.js, politicians_data.js |
| HTML body | 1906–2466 | Gallery container → phone shell (splash, onboarding, profile setup, beam header, parallax overlay, panels) |
| Three.js CDN | 2468 | CDN import |
| Gallery IIFE | 2469–3631 | Full Three.js scene, auto-orbit, PrismGallery namespace |
| PrismDB | 3633 | External shared data module |
| Flat app JS | 3634–5934 | Event data, state, answers, quadrant, parallax, diatribe, submit, aggregate, voices, init |

---

## 6. Key Decisions

1. **Gallery runs full-viewport behind the phone shell** — not clipped to the triptych. The canvas is already the right size; the veil-lift just reveals it.
2. **Panels dissolve, gallery takes over full viewport** — the phone shell doesn't survive the transition. It fades completely.
3. **Gallery code is IIFE-scoped** with a public namespace (`PrismGallery`) for Step 2 to hook into.
4. **Parallax controls are now in a collapsible drawer** — Z slider stays visible, everything else collapses for maximum graph space.
5. **No interaction handlers in the gallery yet** — orbit controls, art walk, parchment click are deliberately deferred to Step 2 when they get wired with an activation gate.

---

## 7. External Dependencies

| File | Purpose | Required? |
|------|---------|-----------|
| `prismdb.js` | Shared data layer (events, responses) | Yes |
| `legislation_data.js` | Congress.gov legislation data | Yes |
| `politicians_data.js` | DW-NOMINATE politician data | Yes |
| `../Artwork/Font logos/Font_logo_1.png` | Splash wordmark | For splash |
| `../Artwork/Prisms/Logo_1.png` | Prism logo | For splash/onboarding |
| `../Artwork/Prisms/Header_prism_transparent.png` | Beam header image | For beam |
| `../Artwork/Animations/spectral portals.mp4` | Spectral portal video | For splash transition |
| `gallery-coast.jpg`, `gallery-mountains.jpg`, etc. | Wall frame art | For gallery (graceful 404) |
| `parallelogram intro.MP4` | Skylight video | For gallery (graceful 404) |
| `Getty_skylight.PNG` | Skylight frame image | For gallery (graceful 404) |

Gallery assets fail gracefully — the 3D geometry renders regardless of whether textures load.

---

*— Prism v50 Handoff — March 10, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
