# Prism v53 — Z-Axis Debug + Subject Z Discovery Handoff (March 12, 2026)

## Session type: Debug + Architecture Discovery
## Active version: `index-v53.html`, `prism-graphmap.js`

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v53.html`

---

## 1. What Shipped This Session

### Git Save
- Commit `64a1f62` — `v53 — Parallelogram arc article with reparenting graphmap + timeline scrubber`
- 4 files changed, 7,658 insertions

### Graphmap Plane Transparency
- **Base plane** now `transparent: true, opacity: 0.50` — was fully opaque, blocking all negative Z objects from view
- **Quadrant overlays** unchanged (already had `transparent: true, opacity: 0.10`)
- `depthWrite` left at default (Three.js handles transparent sort correctly)

### Parallelogram Orbit Pitch
- Both `mountArcGraphmap` and `mountStaticGraphmap` changed from `setOrbit(12, -18)` to `setOrbit(12, -30)`
- Steeper pitch reveals Z-depth separation — at -18 the plane was too face-on to perceive depth

---

## 2. What We Discovered: The Real Problem

### The Z values were correct all along.

Every pin and orb was positioned at the right Z coordinate in 3D space. Verified by:
- JS probing of Three.js scene: pin group at z = -1.672, all 4 spheres at z = -1.672
- Live test graphmap in Chrome with dots at z = +0.5, 0, -0.3, -0.5, -0.95 — all rendered correctly on both sides of the translucent plane
- Expected math: normZ × Z_EXTENT × 0.8 = -0.95 × 2.2 × 0.8 = -1.672 ✓

### Why everything appeared on the same side:

**Every Z value in the immigration arc is negative.** All 21 events have Z ≤ 0. This is editorially correct — the article is called "Forty Years Below the Surface" because the institutional promise/delivery gap has been negative across all five presidencies. The object has been sinking for forty years.

The pins were all on the same side because the data says they should be.

### The actual gap: Subject Z is missing from the arc data model

The current arc event data structure:
```javascript
{ id: 'e4.1', x: 0.7, y: 0.95, z: -0.95, dia: 80, type: 'event' }
```

One Z value — the Object Z (institutional promise/delivery gap for the political object). The cone pin gets this Z. Then `placeArcDots` gives **all four orbs the same Z**:

```javascript
var oz = arcEvent.z || 0;  // all orbs share the object's Z
```

But the scoring library carries richer data. For e4.1 (Iran-Contra / Gary Webb):
- Iran-Contra Object Z: **-0.95** (institutional promise/delivery gap)
- Gary Webb Diatribe: **10** (lowest in entire library — pure good faith, destroyed)
- Dual X: +0.7 (Iran-Contra) / +0.5 (Webb)
- Dual Diatribe: 80 (Iran-Contra) / 10 (Webb)

Many events have dual Z in the scoring library (e.g., e1.6 Abraham Accords: +0.70/-0.90; e4.7 family separation: +0.85/-0.95). These are **quadrant-relative** — different positions experience different gaps.

### What's needed: per-quadrant Z values in the arc data

The orbs represent quadrant positions displaced by Diatribe. They currently share the object's Z. If each quadrant had its own Z value (or at minimum a subject Z distinct from the object Z), the orbs could separate across the plane — some above, some below — while the cone pin tracks the object's trajectory.

This would make the Parallelogram graphmap look like the Parallax graphmap (dots on both sides of the plane), which is what Sailor was expecting to see.

---

## 3. Architecture for Next Session: Subject Z

### Option A: Dual Z (simple)
Add `subjectZ` to arc events. The cone pin uses `z` (Object Z). All four orbs use `subjectZ`. Simple but doesn't capture per-quadrant variation.

### Option B: Per-quadrant Z (full)
Add `qz: { A: +0.50, B: -0.70, C: -0.95, D: +0.30 }` to arc events. Each orb gets its own Z. Matches the scoring library's quad-relative dual Z model.

### Option C: Derived Z (computed)
Keep single Object Z in data. Derive per-quadrant Z from the event's structural properties — e.g., if an event has dual Z (+0.70/-0.90), map the positive Z to the quadrant that "wins" and the negative to the quadrant that "loses." Requires editorial decisions about which quadrant experiences which side of the gap.

### Recommendation
**Option B** is the most faithful to the scoring library and gives the richest visual result. The data entry work is bounded — 20 events × 4 quadrants = 80 Z values to assign. Many can be derived from the scoring library's existing dual Z scores. The `placeArcDots` function change is small:

```javascript
// Current: all orbs share object Z
var oz = arcEvent.z || 0;

// Proposed: each orb gets its own Z
var oz = (arcEvent.qz && arcEvent.qz[q]) || arcEvent.z || 0;
```

---

## 4. Files Changed This Session

| File | Change |
|------|--------|
| `prism-graphmap.js` | Base plane: `transparent: true, opacity: 0.50` |
| `index-v53.html` | Both Parallelogram mounts: `setOrbit(12, -30)` (was -18) |

No structural code changes. No new functions. No schema changes.

---

## 5. What Was NOT Changed

- `admin.html` — untouched
- `prismdb.js` — untouched  
- All other panels, drawers, interactions — untouched
- Arc event data — untouched (the Subject Z work is next session)
- Gallery — untouched

---

## 6. Priority for Next Session

1. **Add per-quadrant Z values to arc event data** — consult scoring library for each of the 20 plottable events, assign quad-relative Z scores
2. **Update `placeArcDots`** to use per-quadrant Z for orbs
3. **Tune opacity** once dots appear on both sides of the plane (0.50 may need adjustment)
4. **Tune orbit pitch** once depth separation is visible (currently -30, may want -25 or -35)
5. **Editorial pass on arc article prose** — the writing needs more context per section

---

## 7. Files to Drop Into Next Session

| File | Why |
|------|-----|
| This handoff | Full context including Subject Z discovery |
| `prism-graphmap.js` | Updated with plane transparency |
| `index-v53.html` | Updated with steeper orbit |
| g_compilation (project knowledge) | Scoring library with dual Z values per event |

**⚠️ The project knowledge version of `prism-graphmap.js` is OUTDATED (253 lines). Do NOT use it. Always use the uploaded file.**

---

## 8. Git Commit (run after saving files)

```
cd "/Volumes/EP3_B/PARALLELOGRAM PRISM/Code"
git add -A && git commit -m "v53.1 — plane transparency + steeper orbit for negative Z visibility"
```

---

*— Prism v53 Z-Debug Handoff — March 12, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
