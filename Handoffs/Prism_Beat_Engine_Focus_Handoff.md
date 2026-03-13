# Prism Beat Engine Focus Extension — Session Handoff

**Date:** March 13, 2026  
**Session:** Beat engine focus/zoom extension + graphmap orbit wiring  
**Result:** `prism-graphmap.js` and `prism-parallax.js` edited, **NOT YET TESTED**

---

## What happened this session

### Conceptual work

1. **3D Animation Architecture v1** — wrote the unified design document covering all four Three.js contexts (Graphmap, Parallax 3D, Parallelogram embeds, Dream Getty gallery). Key decisions: two renderer architectures (standalone vs. scene-child), beat engine in factory, focus as first-class orbit property, veil-lift transition design. File: `Prism_3D_Animation_Architecture_v1.md`.

2. **Discovery: beat engine already existed in the factory.** The graphmap factory (`prism-graphmap.js`) already had `playBeats()`, `stopBeats()`, `isPlaying()`, and a full `tickBeats()` implementation inside the `animate()` loop. The parallax file has a *separate, older* CSS orbit engine that drives `rotateY` transforms on `#q3dWrap`. The CSS orbit only fires when `veilState !== 'graphmap-lock'` — meaning the Three.js graphmap never got the scripted orbit sequence.

3. **Focus as first-class property.** Rather than treating the "drift from user pin to centroid" as a special case, focus became a general orbit property. Any beat can specify a `focus: { x, y }` (normalized 0–1) and the graph smoothly recenters. This unlocks: toggle-board-driven focus migration in Parallax, object-to-object camera transport in the Dream Getty, and editorial focus points in Parallelogram embeds.

### Code changes

#### `prism-graphmap.js` — 6 edits (all complete)

1. **Focus fields in orbit state** (after `pinchDist`): Added `focusX: 0`, `focusY: 0`. Updated `beatState` comment to document new fields.

2. **`tickBeats()` extended**: Focus (X/Y) and zoom are interpolated alongside yaw/pitch in both the transition phase and the beat-advance setup. Uses same cubic ease-in-out. If a beat doesn't specify `focus`, current focus is held. Same for `zoom`.

3. **`animate()` loop**: Added `group.position.x = -orbit.focusX; group.position.y = -orbit.focusY;` — shifts the graph group so the focus point sits at the rotation center. Negative because the group moves opposite to the focus offset.

4. **`playBeats()` extended**: First beat's `focus` and `zoom` fields are read to initialize `beatState.targetFocusX/Y` and `targetZoom`. Normalized coords (0–1) are converted to graph-local coords via `(x - 0.5) * GRAPH_SIZE`.

5. **`setFocus()` / `getFocus()` API**: Immediate (non-animated) focus set/get. Normalized coords in, normalized coords out. Exposed on instance object.

6. **Unmount cleanup**: `orbit.focusX = 0; orbit.focusY = 0;` and `group.position.set(0, 0, 0)` added to `unmount()`.

#### `prism-parallax.js` — 3 edits (all complete)

7. **Beat stop on slider input**: Added block after CSS orbit stop: `if (graphmapInst && graphmapInst.isPlaying()) { graphmapInst.stopBeats(); ... }`.

8. **6-second trigger extended**: Was `if (raw !== 0 && veilState !== 'graphmap-lock')`. Now fires in both modes — routes to `startGraphmapOrbitSequence()` when in graphmap-lock, else `startOrbitSequence()` (existing CSS engine).

9. **`startGraphmapOrbitSequence()` added**: Composes a 5-beat sequence:
   - Beats 1–2: Seeing orbit centered on user's pin (swing ±20°, ±18°)
   - Beat 3: Drift — focus migrates from user pin to weighted centroid (4.5s)
   - Beats 4–5: Centroid oscillation (±12°)
   - `onComplete`: if not interrupted, starts a looping centroid orbit

10. **Focus reset on zero**: When slider returns to 0, calls `graphmapInst.setFocus(0.5, 0.5)`.

---

## Current file inventory

| File | Lines | Status |
|------|-------|--------|
| `prism-graphmap.js` | ~1,854 | **Edited, not tested** |
| `prism-parallax.js` | ~945 | **Edited, not tested** |
| `index-v55.html` | 3,471 | Unchanged |
| `prism-styles.css` | 2,665 | Unchanged |
| `prism-splash.js` | 489 | Unchanged |
| `prismdb.js` | 972 | Unchanged |
| `Prism_3D_Animation_Architecture_v1.md` | New | Design document |

---

## What to do next session

### 1. Test the beat engine focus extension

Drop both edited files into your Code directory, replacing the existing versions. Open Live Server.

**Test path:**
1. Complete the flow through to pin placement + submit (or use `?dev`)
2. Open Parallax overlay → go to Parallax tab (center tab — this enters `graphmap-lock`)
3. Move Z-slider to a non-zero value
4. Wait 6 seconds — the seeing orbit should begin:
   - Graph tilts and oscillates centered on your pin position
   - After ~5.5s, focus drifts smoothly from your pin to the aggregate centroid
   - After drift, slow centroid oscillation loops
5. Move the slider — orbit should stop immediately
6. Return slider to zero — graph should return to center, no lingering offset

**What to watch for:**
- Does the graph visibly shift its rotation center during the drift? (It should — the focus migration means the graph pivots around a different point.)
- Does the beat display text update? ("seeing orbit" → "center of mass")
- Is there any jank when stopping beats mid-sequence?
- Does the graph return cleanly to center when slider hits zero?

### 2. Tune the choreography

The beat durations and angles in `startGraphmapOrbitSequence()` are first-pass values. The seeing orbit might feel too fast/slow, the drift too abrupt, the centroid oscillation too wide. These are pure number tweaks in the beat array — no structural changes needed.

### 3. Wire drift interruption as behavioral metadata

The CSS orbit engine logs `orbitDriftInterruptFrac` when the user taps during drift. The graphmap version doesn't yet log interruption. The factory's `onComplete('interrupted')` fires but doesn't capture *when* in the sequence the interruption happened. Future: add an `onInterrupt(beatIndex, progress)` callback to the beat engine.

### 4. Forward tasks from architecture doc

After the beat engine is tested and tuned:
- **Scene-child mode** (`createSceneChild()`) — extends factory for Gallery pedestals
- **Floating word layer** — sprite-based tags positioned at cluster centroids
- **Veil-lift transition** — gallery canvas beneath flat app, dwell trigger, camera pullback

---

## Key learnings

- **The graphmap factory already had a beat engine** — `playBeats()`, `stopBeats()`, `isPlaying()`, and `tickBeats()` were all implemented. The gap was that the parallax orbit sequence never called them when in graphmap-lock mode.
- **Focus is a group position offset, not a camera move.** `group.position.x = -orbit.focusX` shifts the entire graph so the focus point sits at the rotation center. This is simpler than moving the camera and works identically whether the graphmap is standalone (Architecture A) or a scene child (Architecture B).
- **Normalized → graph-local conversion:** Focus in beat definitions uses normalized coords (0–1, matching pinX/pinY). The factory converts to graph-local internally: `(x - 0.5) * GRAPH_SIZE`.
- **Focus unlocks the Getty camera model.** The same mechanism that drifts orbit focus from user pin to aggregate centroid will transport the gallery camera between room objects. The beat definition is identical; only the coordinate space and scale change.

---

*— End of handoff — March 13, 2026 —*
