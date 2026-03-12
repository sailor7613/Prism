# Prism v53 — Timeline Scrubber + Reparenting Graphmap Handoff (March 12, 2026)

## Session type: Code — Parallelogram per-event arc article, reparenting graphmap, timeline scrubber
## Active version: `index-v53.html` (~7,394 lines), `prism-graphmap.js` (~1,512 lines)

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v53.html`

---

## 1. What Shipped This Session

### Parallelogram Arc Article — "Forty Years Below the Surface"
- **New article type: Scoring Arc (📓e4)** — a dedicated Parallelogram article walking through the immigration arc event by event from Iran-Contra (1986) to Metro Surge (2026)
- **Twenty per-event sections** with editorial prose, each ending with a `<!-- event: e4.1 -->` marker
- **Three articles now in Parallelogram index:** CS01 (Pretti), Arc·📓e4 (Immigration), CS02 (Metro Surge)
- Card meta shows "21 arc events" for arc articles, "3 graph states" for case studies

### Reparenting Graphmap Architecture
- **One WebGL context** for the entire arc article — single `PrismGraphmap.create()` instance
- **Twenty graphmap slots** in the article DOM (one per event section), each with canvas wrapper + timeline bar
- **IntersectionObserver** on each slot (threshold 0.3, root = paraReader scroll container)
- When a slot enters viewport → `inst.reparent(newWrap)` moves the canvas into that slot
- `reparent()` method added to factory: moves canvas DOM element, switches ResizeObserver + IntersectionObserver, triggers resize. Zero context destruction/creation.

### Pin (Cone) + Orbs (Spheres) Dot System
- **Cone pin** = the political object, placed at the arc event's scored X/Y/Z position
- **Four sphere orbs** = displaced subjects (A/B/C/D), scattered from pin toward quadrant home corners by Diatribe
  - At Dia 0: orbs sit at the pin position (object visible from all positions)
  - At Dia 100: orbs at their quadrant home corners (object lost)
  - Z shared between pin and orbs (they sink together)
- `PIN_COLORS` in factory extended with `T: C.cream` for neutral/timeline pin color
- Pin uses existing `setPin()` (cone geometry), orbs use `addDot()` (sphere geometry)

### Continuous Timeline Scrubber with Snap
- Slider is `step="0.01"` — tracks continuously during drag
- `oninput` → `onParaTimeline()`: interpolates directly between bounding events (no animation frames, follows finger)
- `onchange` → `onParaTimelineSnap()`: snaps slider to nearest integer, animates 300ms to exact event position
- Each slot's scrubber `max` = that slot's index (grows as you scroll forward through the article)
- Scrub backwards through the arc; can't peek forward past current event

### Animation System
- `animateToEvent(targetEvent, duration, onDone)` — lerps pin + all four orbs from `paraLastPlacedEvent` to target
- Ease-in-out quad, configurable duration
- Used on: scroll-triggered reparent (800ms), scrubber snap-on-release (300ms)
- State tracked via `paraLastPlacedEvent`, `paraAnimFrame`
- Animation cancels cleanly on: manual scrub input, article close, new reparent trigger

### Z-Axis Visual Infrastructure (in prism-graphmap.js)
- **Z-axis reference line** from +Z_EXTENT to −Z_EXTENT through the graph plane origin
- **Tick marks** every 0.25 along the Z-axis (normalized space) for visual scale
- **"Z · Below Surface" label** in purple at −70% Z extent
- All gated behind `zRender` capability flag

### Markdown Parser Extension
- Now handles `<!-- event: e4.1 -->` single-line markers as `{ type: 'event-slot', eventId: 'e4.1' }`
- Also handles multi-line `<!-- graph-state: ... arcEvent: e4.1 -->` with `config.arcEvent` field
- Both types coexist — case study articles use graph-state markers, arc articles use event markers

---

## 2. Critical Open Bug: Negative Z Not Rendering

### Symptom
Pin and orbs appear ON the graph plane surface, not below it. The Z-axis line, tick marks, and labels render correctly. Connector lines from plane to dot/pin are not visible. The cone and sphere geometries are present but their Z positions appear to be zero.

### What We Verified
- `zInput: true` is set on both embed configs (arc graphmap and static graphmap)
- `zRender: true` is set on both
- The scoring data has negative Z values (e.g., e4.1: z = -0.95)
- `placeArcDots()` passes `arcEvent.z` directly to both `setPin()` and `addDot()` as the `normZ` parameter
- The factory's `setPin()` computes world Z as `normZ * Z_EXTENT * 0.8` — at normZ = -0.95, that should be −1.67 world units

### Likely Root Cause
The factory's `setPin()` positions the pin group at `pinGroup.position.set(x, y, z || 0.02)`. The `z || 0.02` fallback evaluates `-1.67 || 0.02` which is `-1.67` (correct in JS since -1.67 is truthy). So that's not the issue.

For `addDot()`, the mesh position is `mesh.position.set(x, y, z)` — also correct.

**Suspected issue: the `pinGroup.position.z` is set in the animation loop.** Lines 540-542 of the factory:
```javascript
const baseZ = (pinData && pinData.normZ) ? (pinData.normZ * Z_EXTENT * 0.8) : 0.02;
pinGroup.position.z = baseZ + bob;
```
This should work for negative normZ. But the pin hover animation runs every frame and *overwrites* the pin Z position. If `pinData.normZ` is `0` (not set), it falls back to `0.02` — on the surface.

**Check in next session:** After `setPin()` is called, is `pinData.normZ` actually being stored as the negative value? The `setPin()` function sets `pinData = { normX, normY, quadrant, normZ: normZ || 0 }`. The `normZ || 0` — if `normZ` is `-0.95`, that evaluates to `-0.95` (truthy), so it should store correctly.

**Alternative theory:** The `placeArcDots()` function calls `inst.clearDots()` then `inst.clearPin()` then `inst.setPin(...)` then four `inst.addDot(...)`. The `clearPin()` sets `pinData = null`. Then `setPin()` rebuilds. Check if `setPin()` is getting the normZ parameter correctly from the calling code.

**Debug approach for next session:**
1. Add `console.log('setPin Z:', normZ, 'world Z:', z)` inside `setPin()` in the factory
2. Add `console.log('addDot Z:', normZ, 'world Z:', z)` inside `addDot()`
3. Check if the values are reaching the factory as expected
4. Check the animation loop's `pinGroup.position.z` — does it get the right value?

---

## 3. Other Known Issues

- **Orbit angle and zoom**: Currently `setOrbit(12, -18)` + `setZoom(7.2)`. This gives a readable angle but may need tuning once Z is rendering. A steeper pitch reveals more Z depth; a shallower pitch shows more of the plane surface. User can always drag-rotate.
- **Response cards**: Arc article has `responses: null`, so response card grids are empty. Case study articles (CS01, CS02) still render their authored response cards.
- **Getty skylight background**: The canvas wrapper uses `background: url('../Artwork/Getty/Getty skylight.png')` — this path is relative to the Code directory. If the image isn't present, background falls back to `var(--surface-inset)`.
- **Tick marks on scrubber**: Each slot renders ticks from 0 to its own index. The structural entry (e4.s3, silence-to-outrage differential) is filtered out of plottable events (null coordinates), so it doesn't get a slot.

---

## 4. Architecture Reference

### Parallelogram Article Types

| Type | Example | Graphmap | Dots | Scrubber |
|------|---------|----------|------|----------|
| Case Study | CS01, CS02 | Static, one instance | 4 orbs at scored positions | None |
| Scoring Arc | 📓e4 | Reparenting, one instance | Cone pin + 4 orbs per event | Continuous + snap, grows per slot |

### Key Functions (index-v53.html)

| Function | Purpose |
|----------|---------|
| `openParaArticle(id)` | Parses markdown, builds slots, mounts graphmap |
| `mountArcGraphmap(article, plottable)` | Creates single graphmap, mounts in first slot, sets up observers |
| `mountStaticGraphmap(article)` | Creates graphmap for case study articles |
| `reparentToSlot(idx)` | Moves canvas to slot, animates dots to new event |
| `placeArcDots(inst, arcEvent)` | Clears + places cone pin + 4 displaced orbs |
| `onParaTimeline(slotIdx, val)` | Continuous scrub — interpolates between events |
| `onParaTimelineSnap(slotIdx, slider)` | Snap on release — rounds to nearest event |
| `animateToEvent(ev, ms, cb)` | Lerp animation from current to target positions |
| `destroyParaGraphmaps()` | Full cleanup — observers, animation, instance |

### Key Data

| Variable | Type | Purpose |
|----------|------|---------|
| `paraGM` | PrismGraphmap instance | The single graphmap for the current article |
| `paraGMData` | Object | `{ articleId, arc, plottable, currentIndex, observers }` |
| `paraSlots` | Array[Element] | DOM slot elements in order |
| `paraActiveSlotIdx` | Number | Which slot currently holds the canvas |
| `paraLastPlacedEvent` | Object | Last displayed event (for lerp origin) |
| `paraAnimFrame` | Number | Active rAF id (null when idle) |

### Factory API Used

| Method | Called By |
|--------|----------|
| `PrismGraphmap.create(config)` | `mountArcGraphmap`, `mountStaticGraphmap` |
| `inst.mount(container)` | Initial mount |
| `inst.reparent(newContainer)` | `reparentToSlot` — **NEW in this session** |
| `inst.setPin(x, y, quad, normZ)` | `placeArcDots` — cone for object |
| `inst.addDot(x, y, quad, normZ, opts)` | `placeArcDots` — orbs for subjects |
| `inst.clearPin()` | `placeArcDots` (before placing new pin) |
| `inst.clearDots()` | `placeArcDots` (before placing new dots) |
| `inst.setOrbit(yaw, pitch)` | Initial mount |
| `inst.setZoom(z)` | Initial mount |
| `inst.setCornerLabels(cfg)` | Initial mount |
| `inst.destroy()` | `destroyParaGraphmaps` |

---

## 5. What Was NOT Changed This Session

- `admin.html` — untouched
- `prismdb.js` — untouched
- Parallax drawer / Diatribe panel / Comparison panel — untouched
- Splash, onboarding, profile, main Prism interaction — all untouched
- Gallery (`prism-gallery-v2.html`) — untouched

---

## 6. Priority for Next Session

1. **Fix negative Z rendering** — debug the factory to find where Z is being lost (see section 2)
2. **Tune orbit/zoom** once Z is visible — the angle needs to reveal depth without losing the plane
3. Optionally: add response cards to arc events that correspond to CS01/CS02 terminal events

---

## 7. Files to Drop Into Next Session

| File | Lines | Why |
|------|-------|-----|
| This handoff | — | Full context including Z debug notes |
| `prism-graphmap.js` (~1,512 lines) | Factory with reparent, Z-axis visuals, T pin color |
| `index-v53.html` (~7,394 lines) | Arc article + reparenting renderer + continuous scrubber |

**⚠️ The project knowledge version of `prism-graphmap.js` is OUTDATED (253 lines). Do NOT use it. Always use the uploaded file.**

---

## 8. Git Commit

```
cd "/Volumes/EP3_B/PARALLELOGRAM PRISM/Code"
git add -A && git commit -m "v53 — Parallelogram arc article with reparenting graphmap + timeline scrubber"
```

---

*— Prism v53 Handoff — March 12, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
