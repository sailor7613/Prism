# Prism v50 — Aggregate Dots, Transparent Compositing & Diatribe→Z Handoff

## March 11, 2026

**Session type:** Code — factory visual tuning, data wiring, density features  
**Predecessor:** `Prism_v50_Graphmap_Labels_Lifecycle_Integration_Handoff.md` (March 11, earlier session)  
**Active version:** `index-v50.html`, `prism-graphmap.js` (1,060 lines), `graphmap-factory-test.html`, `admin.html`

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v50.html`

---

## 1. What Was Accomplished This Session

Transformed the graphmap from a dark-background gallery-style rendering into a transparent layer that composites over the Prism paper UI. Wired PrismDB aggregate data into 3D dots with Z displacement. Connected the Diatribe score to initial pin Z position. Built proximity-aware density visualization with two switchable modes (pulse shimmer and logarithmic cluster shrink).

### Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Aggregate dots → PrismDB wiring | Done | `syncGraphmapDots()` pulls from `PrismDB.getAggregateForEvent()` |
| Transparent compositing | Done | `alpha: true`, no scene background, clear color transparent |
| Light-mode materials | Done | Grid/border ink-dark, ambient warm, tone mapping 0.95 |
| Vivid aggregate dots | Done | `MeshBasicMaterial` with `offsetHSL(0, 0.35, 0.1)` — no lighting interaction |
| Bright user pin | Done | `offsetHSL(0, 0.3, 0.08)`, emissive 0.5, roughness 0.2 |
| Aggregate Z displacement | Done | Index-alternating ±, intensity-driven magnitude, 0.2–1.0 range |
| Diatribe → initial pin Z | Done | `diaScore / 100` maps to normZ on first pin placement |
| `currentPinZ` state tracking | Done | Persists across drag, Z-slider, graphmap remount, event cycling |
| Z-slider sync to diatribe | Done | Slider position matches `currentPinZ` on graphmap entry |
| Z-slider decoupled from orbit | Done | Slider only moves pin Z, no `setOrbit()` call |
| Full 360° yaw orbit | Done | Yaw unclamped, pitch ±50° |
| Proximity pulse mode | Done | Glow shimmer, speed scales with neighbor count |
| Logarithmic cluster shrink mode | Done | `1 / (1 + 0.5 * ln(1 + neighbors))`, floor ~45% |
| `computeProximity(threshold, mode)` API | Done | Accepts `'pulse'` or `'cluster'` mode parameter |
| Density mode toggle UI | Done | Pulse/Cluster buttons in Controls drawer |
| Dev skip (`?dev`) | Done | CSS + JS bypass of splash/onboarding/profile, lands at Diatribe |
| Solid graph plane | Done | Removed transparency from base plane material |
| Quadrant tint boost | Done | Overlay opacity 0.12 → 0.22, vertex colors 0.55 multiplier |
| Grid/border visibility | Done | Axis 0.35, subdivisions 0.12, border 0.25 |
| Pin halo boost | Done | Opacity 0.55, emissive 0.3 |
| Axis label sync | Done | `syncGraphmapLabels()` pushes event Y-axis + standard corners |

### Files Modified

| File | Lines | What Changed |
|------|-------|--------------|
| `prism-graphmap.js` | 1,016 → ~1,060 | Transparent renderer, MeshBasicMaterial dots, proximity system, orbit clamps |
| `index-v50.html` | ~4,930 → ~4,990 | Dot wiring, diatribe→Z, Z-slider sync, density toggle, dev skip |

---

## 2. Updated Factory API Reference

### New/Changed Methods (this session)

```javascript
// Proximity density computation — call after batch-adding dots
// mode: 'pulse' (full size, shimmer) or 'cluster' (log shrink, faint shimmer)
graph.computeProximity(0.55, 'pulse')
graph.computeProximity(0.55, 'cluster')
```

### Renderer Changes

```javascript
// Was: alpha: false, bg: 0x0c0b09, toneMappingExposure: 0.9
// Now:
alpha: true
setClearColor(0x000000, 0)  // fully transparent
toneMappingExposure: 0.95
// No scene.background — composites over parent element
```

### Material Changes

| Element | Before | After |
|---------|--------|-------|
| Base plane | `MeshStandard, transparent, opacity: 0.88` | `MeshStandard, opaque` |
| Aggregate dots | `MeshStandard, emissive: 0.5` | `MeshBasic` (no lighting) |
| User pin | `MeshStandard, emissive: 0.5` | `MeshStandard, emissive: 0.5, offsetHSL saturation boost` |
| Grid/border | `color: cream` | `color: 0x1a1a2e` (dark ink) |
| Labels | `cream rgba` | `dark ink rgba` |
| Ambient light | `0x0c0b09, 0.7` | `0xf5f0e8, 0.9` |

---

## 3. How Diatribe → Z Works

### Flow
1. User sets Diatribe slider → `diaScore` (-100 to +100)
2. User commits aperture → sees response cards
3. User taps a response → `selectAnswer(k)` fires
4. Pin placed at default X/Y → `currentPinZ = diaScore / 100`
5. `graphmapInst.setPin(px, py, chosenKey, diaZ)` — pin enters 3D space at diatribe-derived depth
6. Z-slider initial position matches `currentPinZ` via `zSlider.value = Math.round(currentPinZ * 60)`
7. Z-slider adjustments update `currentPinZ` and call `setPin` with new Z
8. Pin drag preserves Z: `setPin(pinX, pinY, finalQuadrant, currentPinZ)`
9. Graphmap remount restores Z: `setPin(pinX, pinY, finalQuadrant, currentPinZ)`
10. Event cycling resets `currentPinZ = 0`

### Key Variable
```javascript
let currentPinZ = 0; // -1 to +1, set by diatribe, adjustable via Z-slider
```

Referenced at 7 locations: declaration, Z-slider update, initial pin placement, pin drag, graphmap entry, parallax close, event reset.

---

## 4. How Aggregate Dot Sync Works

### syncGraphmapDots()
```javascript
function syncGraphmapDots() {
  if (veilState !== 'graphmap-lock') return;
  graphmapInst.clearDots();
  const evt = PrismDB.getActiveEvent();
  const agg = PrismDB.getAggregateForEvent(evt.id);
  agg.forEach((d, i) => {
    // Z: alternating sign, intensity + positional hash drives magnitude
    const zSign = (i % 2 === 0) ? 1 : -1;
    const spread = Math.sin(d.x * 127.1 + d.y * 311.7) * 0.5 + 0.5;
    const zMag = 0.2 + intensity * 0.5 + spread * 0.3; // 0.2–1.0
    graphmapInst.addDot(d.x, d.y, d.quadrant, zSign * zMag, { radius });
  });
  graphmapInst.computeProximity(0.55, densityMode);
}
```

### Call Sites
- `enterGraphmapView()` — after mount + pin restore
- `loadEvent()` — if graphmap is mounted, refreshes for new event

### syncGraphmapLabels()
Pushes event-specific Y-axis labels (`evt.axes.y.pos`/`.neg`) and standard corner labels to the factory. Same call sites as dots.

---

## 5. Density Mode System

### Two Modes

**Pulse** (default)
- Dot mesh scale: 1.0 (full size)
- Glow sprite: additive blend, opacity modulated by `sin(t * speed + phase)`
- Speed: `1.0 + neighbors * 0.8`, capped at 8
- Max glow opacity: `min(0.22, speed * 0.03)`
- Visual: isolated dots are still, clusters shimmer visibly

**Cluster**
- Dot mesh scale: `1 / (1 + 0.5 * ln(1 + neighbors))`
  - 0 neighbors: 1.0
  - 3 neighbors: ~0.59
  - 10 neighbors: ~0.45
- Glow sprite: same system but much slower/fainter
- Speed: `0.6 + neighbors * 0.3`, capped at 4
- Visual: clusters nest tight, faint whisper of life

### UI
Two toggle buttons in Controls drawer: `Pulse` | `Cluster`
Clicking either re-runs `computeProximity(0.55, mode)` — no remount needed.

### State
```javascript
let densityMode = 'pulse'; // persists across session, used in syncGraphmapDots
```

---

## 6. Dev Skip

Two-pronged approach to bypass splash/onboarding/profile:

1. **Head script:** `<script>` in `<head>` adds `dev-skip` class to `<html>` before first paint
2. **CSS rule:** `.dev-skip #splash, .dev-skip #onboarding, .dev-skip #profileSetup, .dev-skip #spectralVideo { display: none !important; }`
3. **JS at init:** Sets `appEntered = true`, `helixActive = false`, fires `openDiatribeForEvent()` after 300ms settle

**Usage:** `http://localhost:5500/index-v50.html?dev`

---

## 7. Key Decisions Made This Session

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Transparent renderer over dark background | Graphmap must composite over Prism's cream/paper UI, not live in its own dark window |
| 2 | `MeshBasicMaterial` for aggregate dots | `MeshStandardMaterial` + ACES tone mapping washed colors to pastels. Basic ignores lighting = pure vivid flat color |
| 3 | `offsetHSL` saturation boost over emissive cranking | High emissive (1.2) blew out to white. HSL shift keeps hue integrity |
| 4 | Glow sprites removed from aggregate dots | At density, the billboarded quads created square artifacts drowning the spheres |
| 5 | Diatribe score as initial Z | The diatribe IS the Z-axis conceptually — good/bad faith read maps to over/back depth |
| 6 | Z-slider decoupled from orbit | Slider was calling `setOrbit()` which reset user's drag rotation — clunky |
| 7 | Full 360° yaw, ±50° pitch | User wants to spin the graph around fully; pitch limit prevents upside-down |
| 8 | Index-based Z sign alternation (`i % 2`) | Hash-based split clustered positive. Alternation guarantees 50/50 above/below |
| 9 | Two density modes as toggle | Both pulse and cluster have value; toggle lets user choose rather than us picking |
| 10 | `computeProximity` runs once, not per-frame | O(n²) scan is fine at <200 dots when called once after batch add |

---

## 8. What's NOT Done Yet

### Factory-level features remaining
- **Diatribe slider integration in factory** — config accepts flag but nothing renders it inside canvas
- **Z three-job separation** — orbit, Z-data input, Z-depth rendering as distinct gated capabilities
- **Timeline mode** — thematic article state sequencing
- **Orbit engine beats** — scripted documentary drift (the old CSS beats 2/3/4)

### Integration remaining
- **Parallelogram embeds** — 3–6 viewport-gated instances per article, YAML data
- **Dream Getty pedestals** — 2 instances with different capability sets
- **CSS orbit path** — `handleZSlider` still has CSS fallback branch for non-graphmap mode

### Broader roadmap (unchanged)
- Roadmap v1.8 (should reflect all factory + aggregate work)
- Admin word tag pass (6 events)
- Case studies (5 planned events)
- Production backend: Supabase, Cloudflare Worker, Vercel

---

## 9. Files to Drop Into Next Session

| File | Why |
|------|-----|
| This handoff | Session context, API reference, architecture decisions |
| `prism-graphmap.js` | Factory module (~1,060 lines) |
| `index-v50.html` | Main app with all wiring |

**Also useful if needed:**
- Previous handoff (`Prism_v50_Graphmap_Labels_Lifecycle_Integration_Handoff.md`) — factory API reference, test harness context
- `Prism_Architecture_Update_v2.md` — §9 factory spec and capability matrix
- `graphmap-factory-test.html` — test harness (note: dark bg, transparent renderer composites dark there)

**Do NOT load:** Case study files, `admin.html`, `prismdb.js`, older handoffs, `g_compilation`, `J_encoding` — none needed for continued factory/integration work.

---

## 10. Test Harness Note

`graphmap-factory-test.html` has a dark `body` background (`#0c0b09`). With the transparent renderer, the three test instances will composite over dark — they'll look gallery-style, which is correct for that context. The light-mode tuning (dark ink grid lines, warm ambient) was designed for compositing over both light and dark backgrounds. If the test harness looks washed out, it's because the ink-colored grid is low contrast on the dark body — this is expected and correct behavior. The test harness is a development tool, not the target aesthetic.

---

*— Prism v50 Aggregate Dots + Transparent Compositing + Diatribe→Z Handoff — March 11, 2026 —*  
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
