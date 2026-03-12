# Prism v50 — Graphmap Labels, Lifecycle & Index Integration Handoff

## March 11, 2026

**Session type:** Code — factory features + index-v50 integration  
**Predecessor:** `Prism_v50_Graphmap_Factory_Session_Handoff.md` (March 10)  
**Active version:** `index-v50.html`, `prism-graphmap.js` (1,016 lines), `graphmap-factory-test.html`, `admin.html`

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v50.html` + `graphmap-factory-test.html`

---

## 1. What Was Accomplished This Session

Built three factory features (billboard labels, viewport lifecycle, setPin fast path) and wired the factory into `index-v50.html`, replacing the singleton API. Fixed pointer-event isolation for orbit-vs-pin interaction and tuned the Z-slider rotation angle.

### Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Billboard sprite labels | Done | Gallery-matched `THREE.Sprite`, always face camera, `depthTest: false` |
| Quadrant corner letters (A/B/C/D) | Done | Positioned inside graph corners, quadrant-colored at 0.5 alpha |
| Axis endpoint labels | Done | Default: Left/Right/Up/Down. Dim cream, positioned outside graph edges |
| Z·Depth label | Done | Very dim, floating above Z extent |
| `setAxisLabels()` API | Done | Per-event axis text: `{ xPos, xNeg, yPos, yNeg }` |
| `setCornerLabels()` API | Done | Per-event corner text: `{ A, B, C, D }` — e.g. `'Auth · Left'` |
| Viewport lifecycle | Done | `IntersectionObserver` at 5% threshold, pauses/resumes rAF loop |
| `activate()` / `deactivate()` API | Done | Programmatic pause/resume independent of scroll |
| `setPin` fast path | Done | Skips geometry rebuild when quadrant unchanged — safe for continuous Z-slider |
| Index-v50 factory integration | Done | All singleton calls replaced with `graphmapInst` factory instance |
| Pointer-event isolation | Done | CSS `pointer-events: none` on `.quadrant.graphmap-active`, canvas `auto` override |
| Z-slider rotation cap | Done | Capped at ±15° (was ±90°) — subtle depth hint, not full turntable |
| Z-slider pin displacement | Done | Slider drives `setPin` with normZ = `raw / 60` in graphmap mode |
| Pin restoration on re-entry | Done | `enterGraphmapView` restores pin from `pinX/pinY/finalQuadrant` after unmount |

### Files Modified

| File | Lines | What Changed |
|------|-------|--------------|
| `prism-graphmap.js` | 831 → 1,016 | Labels, viewport lifecycle, setPin fast path |
| `index-v50.html` | 4,909 → ~4,930 | Factory instance, CSS isolation, Z-slider wiring |
| `graphmap-factory-test.html` | ~300 → ~418 | Third instance (viewport-gated), label controls |

---

## 2. Updated Factory API Reference

### New Methods (added this session)

```javascript
// Labels — per-event customization
graph.setAxisLabels({ xPos: 'Collective →', xNeg: '← Individual', yPos: 'Authority', yNeg: 'Liberty' })
graph.setCornerLabels({ A: 'Auth · Left', B: 'Auth · Right', C: 'Lib · Left', D: 'Lib · Right' })

// Viewport lifecycle
graph.activate()       // Resume rAF loop
graph.deactivate()     // Pause rAF loop, kill momentum, render final frame
```

### Config (lifecycle addition)

```javascript
lifecycle: {
  activateOnViewport: true,   // IntersectionObserver gates animation
  deactivateOnExit: true,     // Pause when scrolled offscreen
}
```

### setPin Fast Path

`setPin(normX, normY, quadrant, normZ)` now skips the full `rebuildPin` geometry teardown/rebuild when the quadrant hasn't changed. Only position, cone rotation (for negative Z flip), and Z connector are updated. Safe for continuous input like Z-slider dragging.

---

## 3. Key Decisions Made This Session

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Billboard sprites (Option B) over surface-painted planes (Option A) for labels | Gallery visual match. Always readable during orbit. User preferred seeing labels at all angles. |
| 2 | A = upper-left, B = upper-right (corrected) | Matched admin portal convention. Original code had A/B swapped. |
| 3 | CSS `pointer-events: none` on quadrant for event isolation | Cleanest approach after three failed attempts with `stopPropagation`. CSS inheritance lets canvas child override parent. No JS event juggling. |
| 4 | Z-slider capped at ±15° rotation | Z-slider's primary job is Z-input (back/over), not turntable. ±15° is a subtle depth hint. Old code went to ±90° (way too aggressive). |
| 5 | Z-slider drives pin Z via `setPin` with `raw / 60` | Pin lifts off graph surface proportionally. Z connector line grows beneath it. |
| 6 | Grid fade punted (not needed) | Audit §5.2 was about CSS grid compression — Three.js geometry foreshortens naturally. Not an actual problem. |
| 7 | Viewport lifecycle starts deactivated, one frame rendered on mount | Prevents blank canvas flash. Observer fires immediately if element is already visible. |

---

## 4. How the Index Integration Works

### Creation
```javascript
const graphmapInst = PrismGraphmap.create({
  mode: 'analytical',
  capabilities: { orbit: true, zInput: true, zRender: true, diatribeSlider: true },
});
```
Created at module scope after state variables, before any code calls it.

### Mount/Unmount (veil system)
- `enterGraphmapView()` → `graphmapInst.mount(quadrant)` + restores pin if placed
- `exitGraphmapView()` → `graphmapInst.unmount()`
- CSS `.graphmap-active` hides CSS graph elements, adds `pointer-events: none` to quadrant

### Pin Sync
- Answer selection scatter → `graphmapInst.setPin(px, py, chosenKey)`
- Pin drag update → `graphmapInst.setPin(pinX, pinY, finalQuadrant)`
- Z-slider in graphmap mode → `graphmapInst.setPin(pinX, pinY, finalQuadrant, raw / 60)`

### Z-Slider Rotation
- `graphmapInst.setOrbit(rotDeg3D, 0)` where `rotDeg3D = t² × 15 × sign`
- Quadratic easing, max ±15°

---

## 5. What's NOT Done Yet

### Factory-level features remaining
- **Diatribe slider integration** — config accepts `diatribeSlider` and `diatribePosition` but nothing reads them yet
- **Z three-job separation** — orbit, Z-data input, Z-depth rendering as distinct gated capabilities (Architecture Update v2 §9.3)
- **Logarithmic clustering** — auto-merge dots when count exceeds ~50 (§9.4)
- **Timeline mode** — thematic article state sequencing (§9.5)

### Integration remaining
- **Aggregate dots in index-v50** — factory has the `addDot` API, not yet wired to PrismDB aggregate data
- **Parallelogram embeds** — 3–6 instances per article, viewport-gated, YAML data
- **Dream Getty pedestals** — 2 instances with different capability sets
- **Orbit engine beats** — the old CSS orbit sequence (beats 2/3/4) is skipped in graphmap mode. The factory's drag-to-orbit replaces manual orbit for now, but the scripted documentary drift sequence could be rebuilt using `spinTo`
- **CSS orbit path** — `handleZSlider` still has the CSS fallback branch for non-graphmap mode. Works, but that path is legacy.

### Broader roadmap (unchanged)
- Case studies (5 planned events)
- Admin portal: autosuggest length cap, YAML import, word tag pass
- Production backend: Supabase, Cloudflare Worker, Vercel
- GitHub Pages beta deploy

---

## 6. Files to Drop Into Next Session

| File | Why |
|------|-----|
| This handoff | Session context, API reference, integration map |
| `prism-graphmap.js` | The factory module (1,016 lines) |
| `index-v50.html` | Main app with factory wired in |
| `graphmap-factory-test.html` | Test harness — 3 instances with all controls |

**Also useful if needed:**
- `Prism_Architecture_Update_v2.md` — §9 factory spec and capability matrix
- `Prism_3D_Graph_Audit_v49.md` — rendering pipeline reference

**Do NOT load:** Case study files, `admin.html`, `prismdb.js`, older handoffs, `g_compilation`, `J_encoding` — none needed for continued factory/integration work.

---

*— Prism v50 Labels + Lifecycle + Integration Handoff — March 11, 2026 —*  
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
