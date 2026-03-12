# Prism v50 — Z Three-Job Separation, Beat Engine, Zoom & Viewport Fix

## March 11, 2026

**Session type:** Code — factory architecture, interaction features, data persistence fix  
**Predecessor:** `Prism_v50_Aggregate_Dots_Transparent_Compositing_Diatribe_Z_Handoff.md` (March 11, earlier session)  
**Active version:** `index-v50.html` (~5,049 lines), `prism-graphmap.js` (1,274 lines)

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v50.html`

---

## 1. What Was Accomplished This Session

Separated the factory's Z responsibilities into three independently gated capabilities. Built a beat engine for scripted orbit choreography. Added scroll-wheel and pinch-to-zoom. Fixed the 3D clipping issue where the rotated graph plane was cut off at container edges. Persisted `pinZ` in the response record to close the data gap between diatribe score and final user Z position.

### Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| `zInput` capability gate | Done | `setPin()` and `addDot()` clamp normZ to 0 when disabled |
| `zRender` capability gate | Done | Z connector lines and Z depth label hidden when disabled |
| Orbit drag vs. rotation separation | Done | `group.rotation` always applies; `orbit` capability only gates pointer-drag input |
| Beat engine (`playBeats`) | Done | Sequence of `{ yaw, pitch, duration, hold }` driven by main animate loop |
| `stopBeats` / `isPlaying` | Done | Manual stop and state query API |
| User drag interrupts beats | Done | Fires `onComplete('interrupted')` callback |
| `spinTo` cancels beats | Done | Manual override takes priority |
| Beat cleanup on unmount/deactivate | Done | Prevents stale timing jumps on reactivation |
| Scroll-wheel zoom | Done | `deltaY * 0.003`, camera Z clamped 3.2–9.0 |
| Pinch-to-zoom | Done | Two-finger touch, single-finger still orbits |
| `setZoom` / `getZoom` API | Done | Programmatic zoom control |
| Canvas viewport expansion | Done | `inset:-12%; width:124%; height:124%` prevents 3D edge clipping |
| `overflow: visible` on graphmap containers | Done | `.quadrant` and `.quadrant-3d-wrap` when graphmap-active |
| Default camera pullback | Done | z=4.8 → z=5.4, graph renders ~12% smaller at rest |
| `pinZ` persisted in saveResponse | Done | Three distinct Z fields: `diatribeScore`, `pinZ`, `zValue` |
| Touch event refactor | Done | Named functions replace anonymous lambdas for clean unbind |

### Files Modified

| File | Lines | What Changed |
|------|-------|--------------|
| `prism-graphmap.js` | 1,069 → 1,274 | Z gating, beat engine, zoom, canvas expansion, touch refactor |
| `index-v50.html` | ~5,046 → ~5,049 | `overflow: visible` on graphmap containers, `pinZ` in save |

---

## 2. Updated Factory API Reference

### New Methods (this session)

```javascript
// Beat engine — scripted orbit choreography
// Each beat: { yaw: degrees, pitch: degrees, duration: ms, hold: ms }
// Options: { loop: bool, onComplete: fn(reason) }
// reason: 'complete' | 'interrupted' (user drag) | 'stopped' (manual)
graph.playBeats([
  { yaw: 0, pitch: 0, duration: 0, hold: 500 },
  { yaw: 15, pitch: 5, duration: 2000, hold: 4000 },
  { yaw: -10, pitch: -3, duration: 3000, hold: 2000 },
  { yaw: 0, pitch: 0, duration: 1500 }
], { loop: false, onComplete: (reason) => {} });

// Infinite gentle breathe for pedestals
graph.playBeats([
  { yaw: 8, pitch: 3, duration: 4000, hold: 1000 },
  { yaw: -8, pitch: -3, duration: 4000, hold: 1000 },
], { loop: true });

graph.stopBeats();   // fires onComplete('stopped')
graph.isPlaying();   // true/false

// Zoom — camera Z distance
graph.setZoom(4.0);  // closer (larger graph)
graph.setZoom(7.0);  // farther (smaller graph)
graph.getZoom();     // current value (default 5.4)
```

### Capability Gating (now enforced)

```javascript
// All four capabilities are now functional gates:
const g = PrismGraphmap.create({
  container: el,
  mode: 'embed',
  capabilities: {
    orbit: false,         // disables user drag, spinTo/playBeats still work
    zInput: false,        // clamps normZ to 0 in setPin/addDot
    zRender: false,       // hides Z connectors and Z depth label
    diatribeSlider: false, // future: in-canvas slider
  }
});
```

### Capability Matrix (planned consumers)

| Context | orbit | zInput | zRender | diatribeSlider |
|---------|-------|--------|---------|----------------|
| Analytical (main app) | ✓ | ✓ | ✓ | future |
| Parallelogram embed | ✗ | ✓ | ✓ | ✗ |
| Getty pedestal | ✗ | ✓ | ✓ | ✗ |
| Readonly/thumbnail | ✗ | ✗ | ✗ | ✗ |

### Zoom Constants

| Property | Value | Notes |
|----------|-------|-------|
| Default camera Z | 5.4 | Was 4.8 |
| Zoom min | 3.2 | Closest (large graph) |
| Zoom max | 9.0 | Farthest (small graph) |
| Wheel sensitivity | 0.003 | deltaY multiplier |
| Pinch sensitivity | 0.015 | distance-delta multiplier |

---

## 3. Three Z Values in the Data Model

The response record now carries three distinct Z-related fields, each measuring something different:

| Field | Range | Source | What It Measures |
|-------|-------|--------|-----------------|
| `diatribeScore` | -100 to +100 | User's aperture slider | Perceptual: how the user reads discourse quality |
| `pinZ` | -1 to +1 | User's graphmap position (seeded by diatribe, adjustable via Z slider) | Positional: where the user placed themselves in depth |
| `zValue` | varies | Statement Scorer AI | Structural: promise-delivery gap of the statement itself |

### Flow

1. User sets diatribe → `diaScore` (-100 to +100)
2. User selects response → `currentPinZ = diaScore / 100` (seeded)
3. User adjusts Z slider on graphmap → `currentPinZ` updates
4. User submits → record saves `diatribeScore: diaScore`, `pinZ: currentPinZ`, `zValue: zValue`

---

## 4. Beat Engine Architecture

### How It Works

The beat engine runs inside the main `animate()` rAF loop — no competing animation frame. When `beatState` is non-null, `tickBeats()` runs each frame and drives `orbit.yaw` / `orbit.pitch` directly. Momentum is zeroed while beats are active.

Each beat has two phases:
1. **Transition** — cubic ease in-out from current rotation to target `{ yaw, pitch }` over `duration` ms
2. **Hold** — maintain target rotation for `hold` ms

When the sequence ends, it either loops (restarting from beat 0) or fires `onComplete('complete')`.

### Interruption Rules

| Event | Result |
|-------|--------|
| User starts dragging | Beat sequence cancelled, `onComplete('interrupted')` |
| `stopBeats()` called | Beat sequence cancelled, `onComplete('stopped')` |
| `spinTo()` called | Beat sequence cancelled silently (spinTo is manual override) |
| Instance deactivated | Beat state nulled (prevents stale timing on reactivate) |
| Instance unmounted | Beat state nulled |

---

## 5. Canvas Viewport Expansion

### Problem
The Three.js canvas was sized to match the container (`inset:0; width:100%; height:100%`). When the graph rotated in 3D, edges extended past the container and the GPU clipped them at canvas bounds. CSS `overflow` had no effect because the clip happened at the renderer level.

### Solution (two-pronged)

**Factory:** Canvas extends 12% past container on each side:
```css
position: absolute; inset: -12%; width: 124%; height: 124%;
```
`resize()` reads `canvas.clientWidth/Height` instead of container dimensions, so the renderer matches the actual canvas.

**Index CSS:** Both `.quadrant.graphmap-active` and `.quadrant-3d-wrap.graphmap-active` get `overflow: visible` so the expanded canvas renders past container edges.

### Tuning
12% overshoot covers normal tilt range (±50° pitch, full yaw). If extreme zoom + rotation reveals clipping, increase the percentage. The trade-off is GPU pixels — 124% is ~54% more pixels than 100%.

---

## 6. Key Decisions Made This Session

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Rotation always applies, only gate drag input | Embeds need `spinTo`/`playBeats` without user drag; gating rotation broke programmatic control |
| 2 | `zInput` clamps at entry, `zRender` hides visuals | Clean separation: data vs. presentation. An embed can have Z-displaced dots with no connector lines |
| 3 | Beat engine in main animate loop | Single rAF per instance; no timing conflicts; zoom/pin/dots still animate during beats |
| 4 | User drag interrupts beats | User agency > scripted sequence; feels natural |
| 5 | Zoom via camera Z, not FOV | FOV changes distort perspective; camera Z preserves the graph's visual proportions |
| 6 | Canvas oversized by 12% | Cheapest fix for 3D clipping; alternatives (scissor rect, render target) add complexity |
| 7 | Three distinct Z fields in save | Diatribe (perceptual), pinZ (positional), zValue (structural) measure different things; merging loses data |
| 8 | Named touch handlers | Anonymous lambdas can't be removed by `removeEventListener`; refactored for clean unbind |
| 9 | Default camera at 5.4 | 4.8 filled the container tightly; 5.4 gives breathing room at rest, zoom lets users go closer if they want |
| 10 | Pinch zoom on 2-finger, orbit on 1-finger | Natural mobile convention; no ambiguity between rotate and zoom |

---

## 7. What's NOT Done Yet

### Factory-level features remaining
- **Diatribe slider integration in factory** — config accepts flag but nothing renders inside canvas
- **Timeline mode** — thematic article state sequencing (dot/label/pin state changes at scroll waypoints)
- **CSS orbit path cleanup** — `handleZSlider` still has CSS `rotateY` fallback branch for non-graphmap mode (functional, but old approach)

### Integration remaining
- **Parallelogram embeds** — 3–6 viewport-gated instances per article, YAML data, beat sequences at waypoints
- **Dream Getty pedestals** — 2 instances with different capability sets, looping beat breathe
- **Veil-lift transition** — Three.js canvas always running beneath flat app; dwell trigger fades HTML panels

### Data / Admin
- **Admin word tag pass** (6 events)
- **Case studies** (5 planned events)
- **Roadmap v1.8** (should reflect all factory + aggregate + beat + zoom work)

### Production
- **Supabase** migration from localStorage
- **Cloudflare Worker** for API proxy
- **Vercel** static hosting

---

## 8. Files to Drop Into Next Session

| File | Why |
|------|-----|
| This handoff | Session context, API reference, architecture decisions |
| `prism-graphmap.js` | Factory module (1,274 lines) |
| `index-v50.html` | Main app with all wiring |

**Also useful if needed:**
- Previous handoff (`Prism_v50_Aggregate_Dots_Transparent_Compositing_Diatribe_Z_Handoff.md`) — aggregate dot system, density modes, diatribe→Z flow
- `Prism_Architecture_Update_v2.md` — §9 factory spec and capability matrix

**Do NOT load:** Case study files, `admin.html`, `prismdb.js`, older handoffs, `g_compilation`, `J_encoding` — none needed for continued factory/integration work.

---

*— Prism v50 Z Separation + Beat Engine + Zoom + Viewport Fix Handoff — March 11, 2026 —*  
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
