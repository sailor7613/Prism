# Prism v53.2 — Z Boundary Planes + Keywords + Two-Phase Handoff (March 12, 2026)

## Session type: Implementation + Architecture Planning
## Active version: `index-v53.html` (updated), `prism-graphmap.js` (updated)

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v53.html` + `admin.html`

---

## 1. What Shipped This Session (v53.1 → v53.2)

### Z Boundary Planes — graphmap.js

Two translucent cream quads at `z = ±Z_EXTENT × 0.8` (±1.76 world units), marking the ceiling and floor of the Z-axis. Each boundary plane has:

- **Text label sprite** ("Winner" / "Loser" by default) at the upper edge, replaceable per event
- **Photo surface mesh** — full plane size, canvas texture with contain-fit drawing (no crop, no stretch), configurable alpha, transparent letterbox/pillarbox where aspect doesn't match

`loadBoundaryPhoto()` handles URL or base64 data URI input. Photos composited at draw-time alpha (currently 0.37), with the mesh set to full opacity since transparency is baked into the canvas.

Gated by `zRender` capability — hidden when Z-axis is disabled.

### Keyword Sprites on Subject Orbs — graphmap.js

`addDot()` now accepts `opts.keywords` — array of strings or `{ text, weight }` objects. Keywords render as word sprites in a ring around the dot mesh, positioned as children so they travel with the orb through Z-space automatically. Gentle breathe pulse in the animation loop, independent of the existing quadrant word cloud system.

`clearDots()` disposes keyword sprite materials and textures.

### Boundary + Keyword Wiring — index.html

New per-event data fields in the arc event schema:

```javascript
{
  id: 'e4.1',
  // ... x, y, z, dia, qz as before ...
  keywords: {
    A: ['covert war', 'Contras', 'Cold War'],
    B: ['Boland', 'oversight', 'hearings'],
    C: ['displacement', 'crack', 'El Playón'],
    D: ['secret ops', 'no mandate']
  },
  boundaryContent: {
    positive: { text: 'The Architect', photo: 'data:image/webp;base64,...', photoAlpha: 0.37 },
    negative: { text: 'The Witness', photo: 'data:image/jpeg;base64,...', photoAlpha: 0.37 }
  }
}
```

`updateArcBoundary(inst, arcEvent)` — updates boundary planes, deduped by event ID (doesn't reload textures when scrubbing between the same event). Wired into all three arc code paths: initial snap, animation completion, and slider scrub (nearest real event).

Keywords passed through `placeArcDots` into `addDot`. During slider scrub, keywords snap to the nearest event (editorial content doesn't interpolate).

### Photos Embedded (4 total, ~594KB base64)

| Event | +Z Boundary | −Z Boundary |
|-------|-------------|-------------|
| e4.1 Iran-Contra | Reagan staff laughing — "The Architect" | Central American crowd — "The Witness" |
| e4.5 Gang of Eight | Boehner smoking — "The Drawer" | Rubio water bottle — "The Reformer" |

### Keywords Seeded (4 events)

- e4.1 (Iran-Contra/Didion/Webb)
- e4.5 (Rubio — Gang of Eight)
- e4.7 (Family separation)
- e4.s8 (Rand Paul — Venezuela)

---

## 2. New graphmap.js API Surface

```javascript
// Z Boundary Planes
inst.setBoundaryContent({
  positive: { text: 'Winner', photo: 'url-or-base64', photoAlpha: 0.37 },
  negative: { text: 'Loser', photo: 'url-or-base64', photoAlpha: 0.37 }
});
inst.clearBoundaryPhotos();
inst.setBoundaryVisible(true/false);

// Keywords on dots (via addDot opts)
inst.addDot(normX, normY, quadrant, normZ, {
  radius: 0.12,
  keywords: ['word1', 'word2', { text: 'weighted', weight: 0.8 }]
});

// Existing API unchanged
inst.boundaries  // exposed on instance internals
```

---

## 3. Files Changed This Session

| File | Change |
|------|--------|
| `prism-graphmap.js` | `buildBoundaryPlanes()`, `loadBoundaryPhoto()`, `setBoundaryContent()`, `clearBoundaryPhotos()`, `setBoundaryVisible()`; keyword sprites in `addDot()` with ring positioning + breathe pulse; `clearDots()` keyword disposal; `boundaries` exposed on instance |
| `index-v53.html` | `boundaryContent` + `keywords` on e4.1, e4.5, e4.7, e4.s8; `updateArcBoundary()` function; boundary update wired into all three arc code paths; keyword passthrough in `placeArcDots()`; 4 photos embedded as base64; `photoAlpha: 0.37` |

---

## 4. What Was NOT Changed

- `admin.html` — untouched
- `prismdb.js` — untouched
- All other panels, drawers, interactions — untouched
- All other article sections — untouched
- Gallery — untouched

---

## PHASE 1: Admin Portal Completion

### Current State

`admin.html` (5,211 lines) has:
- ✅ 12-response event creation form (3 bands × 4 quadrants)
- ✅ AI autosuggest (Anthropic API, J encoding as system prompt)
- ✅ Statement Scorer with Object Z axis
- ✅ Micro-form word tagging system (tagged tokens = short-form response)
- ✅ Dialectics chat drawer with `PRISM_DRAFT` JSON apply-to-form
- ✅ Screencap input mode for scorer
- ✅ Review document panel for saved scored statements

### What Needs to Be Built

#### 1A. Parallelogram Editor Panel (Primary)

A dedicated admin panel for authoring and managing Parallelogram articles. This is the tool that manages what's currently hardwired in the index.

**Two content types:**
- `article` — full editorial prose with graph-state waypoints
- `refinement` — Z value tuning, keyword editing, boundary photo assignment

**Core features:**
- Markdown editor with live preview for Projection 2 (article prose)
- Graph-state waypoint insertion (`<!-- graph-state: ... -->` HTML comments)
- Preview mode: renders the article with embedded graphmap at specified states
- Per-event Z value editor (Object Z + per-quadrant Subject Z with A/B/C/D sliders)
- Per-event keyword editor (A/B/C/D keyword lists, wired to `keywords` field)
- Per-event boundary content editor (text labels + photo upload for ±Z planes)

**Data model:** Articles stored in `PrismDB` (localStorage now, Supabase later). Schema:

```javascript
{
  id: 'para-e4',
  articleId: 'cs04-immigration-arc',
  type: 'article',
  title: 'Forty Years Below the Surface',
  content: '## [markdown prose with graph-state comments]',
  arc: { /* arc event array as currently in index */ },
  created: '2026-03-12T...',
  updated: '2026-03-12T...'
}
```

**Why this is first:** Every visual feature shipped this session (boundary planes, keywords, photos, Z values) is hardcoded in the index. The admin portal is what makes them authorable. Without it, adding a new arc event or refining Z values means hand-editing a 900KB HTML file.

#### 1B. Arc Event Authoring

Extend the existing event creation form to support arc events (multi-event longitudinal sequences). Currently the form creates single prompt events. Arc events need:

- Arc container: label, date range, unified object description
- Ordered event list within the arc (drag to reorder)
- Per-event fields: id, label, date, X, Y, Object Z, Diatribe, type (event/satellite/structural)
- Per-event Subject Z editor (qz: A/B/C/D sliders, −1 to +1)
- Per-event keyword editor (A/B/C/D keyword arrays)
- Per-event boundary content (text + photo for ±Z planes)
- Arc event preview: embedded graphmap with scrub slider showing the full arc

#### 1C. Three-Projection Import Pipeline

Parse a single case study markdown file into three destinations:

1. **Event prompt data** (YAML frontmatter → event creation form / PrismDB)
2. **Parallelogram article** (Projection 2 prose → Parallelogram editor)
3. **Scoring library entry** (Projection 3 → scoring reference)

The three-projection format is defined in `Prism_Architecture_Update_v1.md` §4. Six case studies already exist in this format. Import is a rendering task, not an authoring task.

#### 1D. AI Autosuggest Length Cap

Hard limit 1–2 sentences on AI-generated responses. Identified in roadmap v1.7 as remaining admin work.

#### 1E. Response Data Viewer

Visual browser for all seeded response data across events. Shows the 72 short-form responses (6 events × 4 quadrants × 3 bands) in a scannable format. Part of the pre-launch bundle (with shared `prismdb.js` and Parallelogram toggles).

### Admin Portal Session Plan

**Session A (1–2 sessions):** Parallelogram editor panel — markdown editor, graph-state waypoints, preview mode. This is the largest piece.

**Session B (1 session):** Arc event authoring — extend event form for multi-event arcs with Z/keyword/boundary editing.

**Session C (1 session):** Import pipeline + response viewer + autosuggest cap. Smaller pieces that close out the admin portal.

### Files to Drop for Phase 1

| File | Why |
|------|-----|
| This handoff | Full context for both phases |
| `admin.html` | Current admin portal (5,211 lines) |
| `prism-graphmap.js` | Updated with boundary + keyword API |
| `index-v53.html` | Reference for arc data model + hardcoded article prose |
| `prismdb.js` | Shared data layer |
| `Prism_Architecture_Update_v1.md` | Three-projection format spec |
| `Prism_Parallelogram_Design_Doc_v1.md` | Parallelogram platform spec |
| `J_encoding_v0.md` | System prompt for AI autosuggest |

---

## PHASE 2: Desktop App

### Rationale

Prism is a ~900KB monolithic HTML file with embedded base64 assets, a Three.js gallery running under a veil, and an article reader with scrubbing 3D graphs. Browser chrome fights the experience. A desktop wrapper gives Prism its own window — critical for the veil-lift transition (flat app → full gallery) and the Getty contemplative experience.

### Recommendation: Tauri

Tauri over Electron. Reasons:
- **Bundle size:** Tauri ships ~5MB vs Electron's ~150MB. Prism is a single-page app, not a complex Node backend.
- **System webview:** Uses the OS webview (WebKit on macOS), which is what Safari/Live Server already uses for development. What you see in dev is what you get.
- **Rust backend:** If you ever need a local API proxy (e.g., Anthropic API calls without exposing keys in the client), Rust is a better fit than Node.
- **Frameless window:** Native support for `decorations: false`, which enables the veil-lift transition to use the full window.

### Scope

The desktop app is a thin shell, not a rewrite. Three files:

1. **`src-tauri/tauri.conf.json`** — window config (frameless, size, title)
2. **`src-tauri/src/main.rs`** — minimal Rust entry point
3. **Web root** — existing Prism files served from a local directory

### Build Steps

| Step | Task | Estimate |
|------|------|----------|
| 2.1 | Scaffold Tauri project (`npm create tauri-app`) | 10 min |
| 2.2 | Configure frameless window, size, title bar area | 30 min |
| 2.3 | Extract base64 assets to files (photos, Procreate art) | 1 hour |
| 2.4 | File structure: `index.html`, `prism-graphmap.js`, `admin.html`, `prismdb.js`, `assets/` | 30 min |
| 2.5 | Local asset loading (file:// or Tauri's asset protocol) | 30 min |
| 2.6 | Build + test macOS .app bundle | 30 min |
| 2.7 | (Optional) Veil-lift transition: frameless window → full gallery canvas | Future session |

**Total estimate:** One focused session for the basic wrapper. The veil-lift integration is a separate session after the gallery is wired into the flat app.

### Asset Extraction Plan

The index currently embeds ~594KB of photos as base64. The desktop wrapper is the right moment to extract these:

```
prism-app/
├── src-tauri/
│   ├── tauri.conf.json
│   └── src/main.rs
├── web/
│   ├── index.html          (v53+ with file:// photo references)
│   ├── prism-graphmap.js
│   ├── prismdb.js
│   ├── admin.html
│   └── assets/
│       ├── photos/
│       │   ├── e4-1-negative.jpg    (Didion field)
│       │   ├── e4-1-positive.webp   (Reagan staff)
│       │   ├── e4-5-negative.webp   (Rubio water)
│       │   └── e4-5-positive.jpg    (Boehner smoking)
│       ├── avatars/
│       ├── logos/
│       └── backgrounds/
└── package.json
```

### Veil-Lift Opportunity

A frameless Tauri window is the ideal container for the veil-lift transition:

1. Three.js canvas always running beneath, clipped to upper triptych
2. Dwell trigger (30s) fades HTML panels
3. Canvas expands to full **frameless window** (no browser chrome to fight)
4. Camera pulls back into gallery space
5. Prism nav triangle stays as tether back to flat app
6. Tap nav reverses the transition

This can't work properly in a browser tab. The desktop wrapper makes it real.

### Files to Drop for Phase 2

| File | Why |
|------|-----|
| This handoff (Phase 2 section) | Desktop wrapper spec |
| `index-v53.html` | Source for asset extraction |
| `prism-graphmap.js` | Unchanged, just needs to be in the web root |
| `prismdb.js` | Shared data layer |
| `admin.html` | Include in the app bundle |
| All 4 boundary photos as separate files | Extracted from base64 |

---

## 5. Key Concepts Established This Session

- **Boundary planes are infrastructure, not decoration:** they define the Z-axis range visually and carry editorial content (text + photos) that changes per event
- **Photos on boundaries tell the story:** The Witness isn't Didion's face — it's what Didion saw. The Drawer isn't Boehner's title — it's Boehner with a cigarette, not doing anything.
- **Keywords travel with orbs:** Unlike the existing `setQuadrantWords` system (fixed in XY space), keyword sprites are children of the dot mesh and move through Z-space with their subject
- **Admin portal before desktop:** The admin portal is the capability gate. Every visual feature shipped this session (boundary planes, keywords, photos, Z values) needs an authoring tool before it can scale.
- **Desktop wrapper is distribution, not capability:** It doesn't unlock new features — it unlocks the right *frame* for the features that already exist.

---

*— Prism v53.2 Handoff — March 12, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
