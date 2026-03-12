# Prism v50 — Gallery & Graphmap Handoff

## March 10, 2026

**Active files:**
- `index-v50.html` (~5,160 lines) — main app, loads graphmap as external module
- `prism-graphmap.js` (~250 lines) — standalone 3D graphmap asset extracted from gallery
- `prism-gallery-v2.html` (2,472 lines) — full Dream Getty scene (standalone reference)

**Drop-in for next session:** This handoff, `index-v50.html`, `prism-graphmap.js`, `prism-gallery-v2.html`, `Prism_Diatribe_Aperture_Revision_v1.md`, `Prism_Architecture_Update_v1.md`, `Prism_Roadmap_v1_7.md`

**External dependencies:** `prismdb.js`, `legislation_data.js`, `politicians_data.js`, Three.js r128 CDN, artwork assets at `../Artwork/...`

---

## 1. What Was Built This Session

### Gallery Integration Attempt → Pivot to Standalone Graphmap

The session began with the gallery scene from `prism-gallery-v2.html` running behind the phone shell inside `index-v50.html`. The plan was a "veil-lift" — the phone dissolves to reveal the gallery room. After building the full dissolve machinery, Sailor redirected: **forget the veil-lift, just get the 3D graphmap working as a UI element in parallax.**

Multiple approaches were tried and abandoned:
- **Clip-path overlay:** Clipping the full-viewport gallery canvas to the quadrant bounds — showed wrong part of scene
- **Resize container:** Positioning the gallery container over the quadrant — worked but required hiding all room objects, managing scene backgrounds, fighting the gallery's dark aesthetic against the cream UI
- **Oversized plane + fog:** Trying to make the graph seamlessly fill the quadrant — overcomplicated, wrong approach entirely

### The Breakthrough: Extract, Don't Embed

The key realization: **the graphmap that looked good was the one in the gallery, lit by the gallery's lights against the gallery's dark background.** Trying to make it look good against cream paper was fighting the asset's nature.

The solution: extract the graphmap as a **standalone module** (`prism-graphmap.js`) that carries its own dark scene, its own gallery-matched lighting, and its own renderer. It's not "the gallery's graphmap transplanted into the flat app" — it's an independent 3D asset that happens to share the gallery's visual DNA.

### What Exists Now

**`prism-graphmap.js`** — Standalone IIFE module:
- Dark scene background (`0x0c0b09`)
- ACES filmic tone mapping at 0.9 exposure
- Three warm spotlights aimed at graph center (gallery replica)
- Dark ambient light, PCF soft shadow maps
- SIZE 2.8 graph plane with vertex-colored quadrants
- 10-division grid, border, quadrant shading overlays
- Z-axis with tick marks (hidden by default)
- Sprite labels (quadrant names + axis names)
- 3D pin (orb + cone, quadrant-colored, shimmer animation)
- API: `mount(container)`, `unmount()`, `setPin(x, y, quad)`, `clearPin()`, `resize()`

**`index-v50.html`** changes from v49:
- Gallery IIFE removed (~1,200 lines cut)
- `#gallery-container` div removed
- Loads `prism-graphmap.js` as external script
- Parallax tab mounts graphmap into `#quadrant` element
- Z slider moved into parallax overlay bottom bar
- Z slider rotates `PrismGraphmap.group.rotation.y` (max ±90°)
- CSS hides flat graph elements when graphmap-active
- 3D pin placed on initial answer selection and updated during drag
- Parallax controls (ABCD toggles, scatter/heat, word chips, input) consolidated into overlay z-bar
- `parallax-ctrl` div removed from panel entirely

### Bug Fixed: Elephant Eyes Crash

`Object.assign(mesh, {position: new THREE.Vector3(...)})` crashed the gallery IIFE in Three.js r128 because `position` is a readonly getter. This silently killed the entire gallery scene in all previous v50 builds. Fixed to `mesh.position.set(x, y, z)`.

### Bug Fixed: Aperture Hidden on Load

`loadEvent()` was adding `aperture-hidden` to the answer grid on initial load, making response cards invisible. Fixed — cards show immediately; aperture gating only activates when the parallax overlay is explicitly opened.

---

## 2. The Ontological Gap — What Needs Resolution

This session revealed that the architectural relationships between Prism's layers are not fully specified. The following components exist but their connections are unclear:

### The Layers

| Layer | What it is | Where it lives |
|-------|-----------|---------------|
| **Prism** (flat UI) | Event cards, response selection, quadrant pin, diatribe, submit flow | `index-v50.html` panels |
| **Diatribe** | Perceptual calibration instrument — aperture setting before engagement | Parallax overlay panel 0 |
| **Graphmap** | 3D quadrant sculpture — aggregate visualization | `prism-graphmap.js`, mounted in parallax |
| **Dream Getty** | Gallery room with graphmap on pedestal, art, animals, celestial elements | `prism-gallery-v2.html` (standalone) |
| **Parallelogram** | Multi-event comparison view — side-by-side graphmaps | Not yet built |

### Open Questions for Architecture Review

1. **Where does the graphmap live in the user flow?** Currently it appears in the parallax tab. But is it the right visualization there? The flat CSS graph with aggregate dots was doing specific analytical work (scatter, heat map, word chips). The 3D graphmap is a different kind of object — more contemplative, less analytical.

2. **What role does the Z slider play?** Three different things have been called "Z rotation":
   - CSS `rotateY` on `q3dWrap` — the original turntable that revealed the 3D quality of the flat graph
   - Three.js `group.rotation.y` on the graphmap — rotating the 3D sculpture
   - The Z-axis data dimension (promise-delivery gap) — a completely different concept that maps to depth, not rotation
   
   These need to be disambiguated. Rotation and depth are separate user gestures.

3. **How does the Parallelogram consume graphmaps?** If it shows multiple events side by side, does each get its own `PrismGraphmap.mount()`? That's multiple Three.js renderers — expensive. Or does one renderer draw multiple graph planes? The module architecture affects this.

4. **When does the user reach the Dream Getty?** Is it:
   - A reward after completing events?
   - An ambient background always running?
   - A separate mode the user enters deliberately?
   - The "home" of the graphmap where it makes most visual sense?

5. **What data feeds the graphmap?** Currently it's geometry-only — no aggregate data is rendered on the 3D plane. The flat CSS graph overlay (`pAggCanvas`) draws scatter/heat dots in 2D. How do aggregate responses map onto the 3D graphmap? Are they the 3D dot-spheres from the gallery demo, or something else?

6. **The Diatribe's relationship to the graphmap:** The Diatribe sets the aperture (good-faith/bad-faith), which determines which response band the user sees. The graphmap shows aggregate positions. Does the Diatribe affect what the graphmap displays? Does aperture filter the aggregate?

---

## 3. Proposed Next Session: Architecture Consolidation

Before building more features, update these documents:

### Update the Roadmap (v1.8)
- Add the Dream Getty as a named milestone
- Add the Graphmap module as a named asset
- Clarify the Parallelogram's dependencies on the graphmap
- Sequence: what gets built before what

### Update the Spec (v06)
- Define the relationship between flat graph (CSS) and graphmap (3D)
- Define when each visualization appears in the user flow
- Specify what data the graphmap renders (aggregate dots, Z-axis positions, connectors)
- Specify the Z slider's function: rotation vs. depth vs. both
- Define the Parallelogram's layout and data requirements

### Potentially: Architecture Decision Record
- Should the graphmap replace the flat graph entirely, or are they separate tools for separate purposes?
- Should the gallery scene be rebuilt as a modular system (room + graphmap + diatribe objects) or stay monolithic?
- One renderer vs. many: how do multiple graphmaps coexist for the Parallelogram?

---

## 4. File Anatomy of index-v50.html

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| CSS | 1–1900 | All styles including graphmap-active, parallax z-bar |
| External head scripts | 1901–1902 | legislation_data.js, politicians_data.js |
| HTML body | 1904–2532 | Phone shell (splash, onboarding, profile setup, beam header, parallax overlay with z-bar, panels) |
| Three.js CDN | 2534 | CDN import |
| PrismGraphmap | 2535 | External module (`prism-graphmap.js`) |
| PrismDB | 2537 | External shared data module |
| Flat app JS | 2538–5160 | Event data, state, answers, quadrant, parallax, diatribe, submit, aggregate, voices, graphmap view, init |

---

## 5. Key Decisions Made This Session

1. **Gallery scene removed from index.html.** The Dream Getty lives in its own file. The main app doesn't carry that weight.
2. **Graphmap is a standalone module.** `prism-graphmap.js` is an independent asset with its own scene/camera/renderer. Mount it anywhere.
3. **Graphmap uses gallery aesthetics.** Dark background, warm spots, ACES tone mapping. It looks like the gallery because it IS from the gallery.
4. **Z slider controls graphmap rotation** in parallax mode and CSS rotation in normal mode. Max ±90° for 3D, ±25° for CSS.
5. **Parallax controls consolidated into overlay z-bar.** Z slider + drawer toggle + all drawer contents live in one bottom-pinned bar inside the parallax overlay.
6. **The ontological framework needs updating before more building.** The relationships between Prism, Diatribe, Graphmap, Gallery, and Parallelogram aren't fully specified.

---

## 6. What's NOT in v50 (Deferred)

- Aggregate data rendered on the 3D graphmap (dots, connectors)
- Z-axis depth data mapped to graphmap
- Parallelogram view
- Gallery veil-lift / Dream Getty entrance
- Graphmap interaction (orbit controls, click-on-dot info)
- Multiple graphmap instances for comparison
- Admin portal AI autosuggest updates
- Case studies (Pretti/2A, Metro Surge, etc.)

---

*— Prism v50 Gallery & Graphmap Handoff — March 10, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
