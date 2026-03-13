# Prism v53.1 — Subject Z + Didion Article Handoff (March 12, 2026)

## Session type: Architecture + Editorial + Implementation
## Active version: `index-v53.html` (updated), `prism-graphmap.js` (unchanged)

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v53.html`

---

## 1. What Shipped This Session

### Conceptual Discovery: Object Z vs. Subject Z

The arc event data was conflating Object Z (institutional promise/delivery gap from the ethical observer's view) with what the Object Z should actually measure: **whether the determining force is getting its way.**

**The correction:** Object Z = is the Empire winning? Positive = apparatus succeeding. Negative = apparatus constrained or defeated. Subject Z (per-quadrant `qz`) = each position's experience of the gap.

**The unified object:** "The Empire" — the U.S. institutional apparatus that manages Latin American relations and resulting displacement. Covert war, enforcement architecture, deportation machinery, bilateral consensus. It transcends party and grows in autonomy over time.

**The visual inversion:** The cone pin now rides *above* the plane for 18 of 20 events. Only Buchanan (defeated) and Rand Paul (marginalized) push it below. The subjects scatter below while the object floats above. "Forty Years Below the Surface" = the subjects' experience, not the object's.

### e4.1 Article Rewrite: Didion Opens the Arc

The e4.1 section was rewritten with Joan Didion's *Salvador* (1982) as the opening witness, followed by the Iran-Contra exposure (1986), followed by Gary Webb's investigation (1996). Three witnesses across fourteen years — perception → exposure → investigation.

**Why Didion:** She doesn't make a claim. She describes a body dump and an embassy briefing and puts them next to each other. The reader's own perception opens the gate. No conspiracy gate to pass through. The Z-axis opens by itself.

**Why Webb stays:** His Diatribe is 10. The encoding doesn't forget that. He's essential to the article — he traces the domestic pipeline — but the reader has already seen the gap through Didion's eyes before they're asked to follow the causal chain.

**Ambivalence note (from Sailor):** Do not denominate the vessel. The Getty is the Getty. Didion is Didion. A white literary figure in a war zone for two weeks — and what she wrote down is what was happening. The second ledger stays open.

### Per-Quadrant Z Values (qz) — All 20 Events

Every plottable arc event now carries a `qz` property with A/B/C/D subject Z values. The `placeArcDots` function reads per-quadrant Z for each orb. Both lerp paths (animation tick and slider-driven scrubbing) interpolate qz smoothly between events.

**Key e4.1 correction:** A (Auth Right) at +0.85 mirrors C (Lib Left) at −0.90. The apparatus wasn't passively benefiting — it was burning unauthorized political capital. "Political larceny."

**Values are 80-85% there** per Sailor's assessment. Admin portal will enable refinement once built.

### Orb Size Increase

Arc mode orbs increased from `0.035 + dia01 * 0.015` to `0.10 + dia01 * 0.04` — roughly 3x larger. Single subject per quadrant needs larger dots for legibility.

---

## 2. Data Model Change

### Arc Event Schema (updated)

```javascript
{
  id: 'e4.1',
  label: 'Iran-Contra / Didion / Webb',
  date: '1982',
  x: 0.7,
  y: 0.95,
  z: 0.85,          // Object Z: is the Empire winning? (was -0.95)
  dia: 80,
  type: 'event',
  qz: {             // NEW: per-quadrant Subject Z
    A: 0.85,        // Auth Right experience
    B: 0.40,        // Auth Left experience
    C: -0.90,       // Lib Left experience
    D: -0.60         // Lib Right experience
  }
}
```

### placeArcDots Change (one line)

```javascript
// Was: var oz = arcEvent.z || 0;
// Now:
var oz = (arcEvent.qz && arcEvent.qz[q] !== undefined) ? arcEvent.qz[q] : (arcEvent.z || 0);
```

Falls back to Object Z if no qz provided — backward compatible with any arc that doesn't have per-quadrant data yet.

### Lerp Changes (both paths)

Both the animation tick (click-to-event transitions) and the slider-driven interpolation now lerp qz per quadrant. Falls back to Object Z interpolation if either endpoint lacks qz.

---

## 3. Arc Label Change

- Arc label: `Immigration Arc (1982–2026)` (was 1986–2026)
- e4.1 date: `1982` (was 1986) — arc starts with Didion, not with the scandal
- e4.1 label: `Iran-Contra / Didion / Webb` (was `Iran-Contra / Gary Webb`)

---

## 4. Files Changed This Session

| File | Change |
|------|--------|
| `index-v53.html` | e4.1 article prose rewritten (Didion opening); all 20 arc events updated with new Object Z + qz values; `placeArcDots` reads per-quadrant Z; both lerp paths interpolate qz; arc orb radius ~3x larger; arc label/date updated |
| `prism-graphmap.js` | **NOT CHANGED** (not uploaded this session) |

---

## 5. What Was NOT Changed

- `admin.html` — untouched
- `prismdb.js` — untouched
- `prism-graphmap.js` — untouched (needs current file for boundary planes)
- All other panels, drawers, interactions — untouched
- All other article sections (e4.2 through e4.s11 prose) — untouched
- Gallery — untouched

---

## 6. Priority for Next Session

### Immediate (graphmap visual)
1. **Z boundary planes** — two translucent quads at z = ±Z_EXTENT × 0.8, cream-tinted, opacity 0.06–0.08, DoubleSide. Requires `prism-graphmap.js`.
2. **Boundary plane labels** — "Winner" / "Loser" or equivalent editorial language as sprite text on the boundary planes.
3. **Tune orb size + opacity** once boundary planes provide visual context for the Z separation.

### Near-term (admin portal)
4. **Parallelogram editor panel** — dedicated admin panel for article authoring, the tool that manages what's currently hardwired in the index.
5. **Keyword clouds around subject orbs** — per-event editorial content, needs data model + authoring UI in admin portal.
6. **Subject pictures on boundary planes** — per-event images communicating the meaning of Z positions, needs authoring UI.

### Architecture
7. **Admin portal as next major task** — Sailor confirmed this is the priority after the current visual work lands.

---

## 7. Reference Document

`Prism_e4_Arc_Subject_Z_Draft.md` — full editorial reasoning for all 20 events' Object Z and per-quadrant Subject Z values, written for park reading. 80-85% accurate per Sailor.

---

## 8. Files to Drop Into Next Session

| File | Why |
|------|-----|
| This handoff | Full context including Subject Z architecture + Didion + boundary plane spec |
| `prism-graphmap.js` | **CRITICAL — upload the current file, not the project knowledge version** |
| `index-v53.html` | Updated with all changes from this session |
| `Prism_e4_Arc_Subject_Z_Draft.md` | Reference for Z value refinement |

---

## 9. Key Concepts Established This Session

- **Object Z measures whether the determining force is winning**, not the ethical assessment of the gap
- **The tell sign of an object**: it's determining the event. If it's getting its way, its Z is positive.
- **The unified object for e4**: The Empire — U.S. institutional apparatus managing Latin American relations and displacement
- **Political larceny (e4.1)**: Auth Right wasn't passively benefiting — they were spending political capital without democratic authorization. A mirrors C.
- **Didion as the Getty**: the vessel is the vessel. What she wrote down is what was happening. Don't denominate.
- **Ambivalence**: don't let criticism cut so early that everything frays. The second ledger stays open.

---

*— Prism v53.1 Subject Z + Didion Handoff — March 12, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
