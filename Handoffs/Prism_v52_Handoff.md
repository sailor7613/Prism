# Prism v52 — Parallelogram + Timeline Scrubber Handoff (March 12, 2026)

## Session type: Code — Parallelogram reading surface, live graphmaps, timeline scrubber architecture
## Active version: `index-v52.html` (~6,900 lines), `prism-graphmap.js` (~1,447 lines)

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v52.html`

---

## 1. What Shipped This Session

### Parallelogram Reading Surface
- **Article index:** "Shifted Observations" header with cards for CS01 (Pretti/2A) and CS02 (Metro Surge)
- **Entry/exit:** 4-second hold on prism nav → prism mirrors → `para-view` fades in at z-index 95. Tap mirrored prism → reverses. Full cleanup chain on exit
- **Article reader:** Slides in from right with editorial prose in EB Garamond 15.5px at 1.7 line-height. Markdown parser splits headings, prose, and `<!-- graph-state -->` markers
- **Font imports:** Added EB Garamond and DM Sans to Google Fonts link

### Live Graphmap Embeds
- Each `<!-- graph-state -->` block gets a real `PrismGraphmap.create()` instance in `embed` mode
- **Viewport lifecycle:** `activateOnViewport: true`, `deactivateOnExit: true` — only the visible graphmap runs its rAF loop
- **Z rendering enabled** on embeds (`zRender: true`)
- **Orbit enabled** — readers can drag to rotate; instances start at 8° yaw, -12° pitch
- **Getty skylight background** — `../Artwork/Getty/Getty skylight.png` as CSS `background` on `.para-graph-slot-canvas-wrap`, composites behind Three.js transparent canvas

### Diatribe Scrub Slider (Current — To Be Replaced)
- Per-embed slider with green→amber→red gradient track
- Dot positions derived from scoring library coordinates (`scoring.x`, `scoring.y`, `scoring.z`)
- Convergence math: at dia=0, positions 75% toward center; at dia=1, full scored coordinates
- Z displacement: `z = scoring.z × diaValue`
- Band pill and numeric readout update live

### Response Cards
- 2×2 grid below each graphmap: B (top-left), A (top-right), C (bottom-left), D (bottom-right)
- Each card has quadrant color left border, letter, position label, response text
- Text swaps at band thresholds (0.33, 0.66): goodFaith → coalition → badFaith
- Tap to expand (removes 4-line clamp)
- All 12 responses per event embedded in `PARA_ARTICLES` data

### Graphmap Instance Lifecycle
- `paraGraphmapInstances` array stores `{ inst, slotId, config, articleId }`
- `destroyParaGraphmaps()` called on article close and Parallelogram exit
- No orphaned WebGL contexts

---

## 2. What Needs to Be Built: Timeline Scrubber

### The Concept

The current per-embed Diatribe slider is wrong. The graphmaps should not show Diatribe temperature — they should show **displacement over time through the event arc**.

Each case study sits at the end of a scored event arc from the scoring library. CS02 (Metro Surge) is the terminal event of the 📓e4 arc — 10 scored events + 11 satellites spanning 1986–2026, each with X, Y, Z, and Diatribe coordinates.

The Parallelogram's graphmap instrument should be a **time machine through the scoring library**. The scrubber moves through events chronologically. The dot on the graphmap shows where the political object landed at each scored moment. As you scrub forward, you watch forty years of displacement: X-axis capture, Y-axis suppression, Z sinking below the surface.

### Architecture: One Graphmap Per Article, Timeline Scrubber

Replace the current three-graphmaps-per-article + per-embed Diatribe slider with:

- **One graphmap per article** (not three) — mounted at the first `<!-- graph-state -->` position
- **One timeline scrubber** below the graphmap — horizontal slider whose waypoints are the scored events in the arc
- **The dot** represents the political object's position at the current waypoint — a single dot that moves across the graph as the reader scrubs through time
- **Z displacement** is visible — the dot sinks below the plane as institutional translation fails over the arc
- **Auto-play on scroll:** When the graphmap scrolls into view at a particular point in the article, it starts at the previous event's position and gently animates forward to the current event. If the article prose is discussing event 5, the graphmap begins at event 4 and scrubs to event 5 over ~2 seconds
- **Manual scrub:** After auto-play completes, the reader can grab the scrubber and explore the entire arc — scrubbing back to Iran-Contra (1986) or forward to Metro Surge (2026)

### Graph-State Markers Become Waypoint Anchors

The `<!-- graph-state -->` markers in the article prose still serve a purpose: they tell the renderer **which event in the arc the prose is discussing at this scroll position**. When that marker scrolls into view, the graphmap auto-plays from the previous event to this one.

New marker format (augment existing):
```markdown
<!-- graph-state: baseline
arcEvent: e4.1
-->
```

The `arcEvent` field references the scoring library entry. The graphmap looks up the coordinates from the arc data.

### Interpolation Between Events

The scrubber should interpolate smoothly between waypoints. When the slider is between event 4 and event 5, the dot should be at a position interpolated between those two scored coordinates. This makes the displacement drift visible as continuous motion, not jumps.

### Response Cards Update

Response cards should still show below the graphmap, but they update based on which event is currently displayed — showing the relevant case study response text for the nearest event. For events in the arc that don't have authored response text (most of the 📓e4 entries), the cards could show the event description and scoring data instead.

---

## 3. 📓e4 Arc Data — Complete Scoring Library

### Events (10)

| # | Event | Date | X | Y | Z | Dia | Flags |
|---|-------|------|---|---|---|-----|-------|
| e4.1 | Iran-Contra / Gary Webb | 1986/1996 | +0.7/+0.5 | +0.95 | -0.95 | 80/10 | Webb=10 calibration |
| e4.2 | IRCA + IIRIRA | 1986/1996 | bipartisan | +0.90 | -0.90 | 70/75 | Z-gap by design |
| e4.3 | Pat Buchanan | 1992 | +0.8 | -0.9 | -0.40 | 50 | Good faith in nativist vehicle |
| e4.4 | Three/ten-year bars | 1996 | n/a | +0.95 | -0.95 | 75 | Statutory architecture |
| e4.5 | Rubio — Gang of Eight | 2013 | +0.4 | +0.5 | -0.35 | 25 | Genuine engagement |
| e4.6 | Rubio — 2016 reversal | 2016 | +0.7 | -0.6 | -0.70 | 60 | X-axis capture |
| e4.7 | Family separation | 2018 | +0.8 | +0.85/-0.85 | -0.95 | 65 | Widest spread (0–90) |
| e4.8 | Progressive non-response | 2009–16 | -0.7 | +0.6 | -0.85 | 70 | Scorable absence |
| e4.9 | "Not sending their best" | Jun 2015 | +0.9 | -0.85/+0.7 | -0.90 | 75 | Denomination catastrophe |
| e4.10 | Progressive totalization | 2015 | -0.8 | +0.6 | -0.70 | 60 | Response mirrors e4.9 |

### Satellites (11)

| # | Entry | Date | X | Y | Z | Dia | Type |
|---|-------|------|---|---|---|-----|------|
| e4.s1 | AOC at Tornillo | 2018 | -0.9 | -0.85 | -0.75 | 35 | Individual |
| e4.s2 | Melania jacket | 2018 | +0.7 | +0.9 | -0.95 | 85–90 | Object/performance |
| e4.s3 | Silence-to-outrage differential | structural | — | — | — | 65–70 | Structural measurement |
| e4.s4 | Biden DOJ Title 42 | 2022 | -0.6 | +0.95 | -0.95 | 75 | Institutional action |
| e4.s5 | ACLU cross-administration | 2009–23 | n/a | -0.5 | n/a | 15 | Organizational benchmark |
| e4.s6 | Abbott busing | 2022 | +0.85 | -0.7/+0.6 | -0.80 | 75 | Institutional action |
| e4.s7 | DeSantis Martha's Vineyard | 2022 | +0.9 | -0.85/+0.8 | -0.95 | 88 | Institutional action |
| e4.s8 | Rand Paul — Venezuela | 2026 | +0.7 | -0.95 | -0.85 | 10 | Cross-session benchmark |
| e4.s9 | Rubio — stated priorities | 2026 | +0.8 | +0.95 | -0.90 | 80 | Longitudinal terminal |
| e4.s10 | Democratic reversals | 2026 | -0.7 | +0.7 | -0.85 | 70 | Aggregate pattern |
| e4.s11 | White House fact sheet | 2026 | +0.8 | +0.9 | -0.70 | 72 | Document |

### Notes on Dual Values

Several entries have dual X or Y values (e.g., `+0.85/-0.85`). These represent dual positional scoring — the event impacts both positions. For the timeline scrubber, render the **primary position value** (first number) for the dot, with the secondary available on inspect/hover.

Entries with `bipartisan` or `n/a` X values are mechanism entries — their X position should be at 0 (center) since the mechanism operates across the partisan axis.

The `e4.s3` entry (silence-to-outrage differential) has no X/Y/Z coordinates — it's a structural measurement. Skip it as a graphmap waypoint but keep it in the timeline as a label-only marker.

### Chronological Sort for Timeline

For the scrubber, events need to be sorted chronologically (some overlap — e4.8 covers 2009–16, e4.9 is Jun 2015, e4.10 is 2015). Suggested ordering:

1. e4.1 — 1986 (Iran-Contra)
2. e4.2 — 1986/1996 (IRCA + IIRIRA)
3. e4.3 — 1992 (Buchanan)
4. e4.4 — 1996 (Three/ten-year bars)
5. e4.s5 — 2009–23 (ACLU benchmark)
6. e4.8 — 2009–16 (Progressive non-response)
7. e4.5 — 2013 (Rubio Gang of Eight)
8. e4.9 — Jun 2015 (Escalator speech)
9. e4.10 — 2015 (Progressive totalization)
10. e4.6 — 2016 (Rubio reversal)
11. e4.7 — 2018 (Family separation)
12. e4.s1 — 2018 (AOC at Tornillo)
13. e4.s2 — 2018 (Melania jacket)
14. e4.s3 — structural (Silence-to-outrage differential) — label only
15. e4.s4 — 2022 (Biden DOJ Title 42)
16. e4.s6 — 2022 (Abbott busing)
17. e4.s7 — 2022 (DeSantis Martha's Vineyard)
18. e4.s8 — 2026 (Rand Paul)
19. e4.s9 — 2026 (Rubio stated priorities)
20. e4.s10 — 2026 (Democratic reversals)
21. e4.s11 — 2026 (White House fact sheet)

---

## 4. Implementation Plan

### Data Structure

```javascript
// Each article carries its arc data
PARA_ARTICLES[n].arc = {
  id: 'e4',
  label: 'Immigration Arc (1986–2026)',
  events: [
    { id: 'e4.1', label: 'Iran-Contra / Gary Webb', date: '1986',
      x: 0.7, y: 0.95, z: -0.95, dia: 80,
      type: 'event', flags: 'Webb=10 calibration' },
    { id: 'e4.2', label: 'IRCA + IIRIRA', date: '1986/1996',
      x: 0, y: 0.90, z: -0.90, dia: 72,
      type: 'event', flags: 'Z-gap by design' },
    // ... all 21 entries
  ]
};
```

### Coordinate Conversion

Scoring library format: X[-1..+1] (left/right), Y[-1..+1] (populist/institutional), Z[-1..+1]

Graphmap normalized format: x[0..1] (0=left, 1=right), y[0..1] (0=top, 1=bottom)

```javascript
function scoringToNorm(sx, sy) {
  return {
    x: (sx + 1) / 2,      // -1→0, 0→0.5, +1→1
    y: (1 - sy) / 2,      // +1→0 (top), -1→1 (bottom)
  };
}
```

This function already exists in v52.

### HTML Structure (replace current per-embed pattern)

```html
<div class="para-graph-slot para-graph-slot-live" id="para-gm-0">
  <div class="para-graph-slot-canvas-wrap" id="para-gm-0-wrap"></div>
  <div class="para-graph-slot-bar">
    <!-- Timeline scrubber -->
    <div class="para-timeline-row">
      <span class="para-timeline-date" id="para-gm-0-date">1986</span>
      <div class="para-timeline-track">
        <input type="range" class="para-timeline-slider" id="para-gm-0-slider"
          min="0" max="20" value="0" step="1"
          oninput="onParaTimeline('para-gm-0', this.value)">
        <!-- Waypoint ticks rendered as CSS pseudo-elements or SVG -->
      </div>
      <span class="para-timeline-date" id="para-gm-0-date-end">2026</span>
    </div>
    <!-- Event info -->
    <div class="para-timeline-info" id="para-gm-0-info">
      <span class="para-graph-slot-pill">e4.1</span>
      <span class="para-timeline-event-label">Iran-Contra / Gary Webb</span>
    </div>
    <!-- Scoring readout -->
    <div class="para-timeline-scores" id="para-gm-0-scores">
      <span class="para-score-pill">X +0.70</span>
      <span class="para-score-pill">Y +0.95</span>
      <span class="para-score-pill para-score-z">Z -0.95</span>
      <span class="para-score-pill para-score-dia">Dia 80</span>
    </div>
    <!-- Response cards (if applicable) -->
    <div class="para-resp-grid" id="para-gm-0-resp"></div>
  </div>
</div>
```

### Auto-Play on Scroll

Use IntersectionObserver on each `<!-- graph-state -->` marker's DOM element. When it enters viewport:

1. Look up the `arcEvent` from the marker (e.g., `e4.7`)
2. Find that event's index in the arc array
3. Set the graphmap dot to the *previous* event's position
4. Animate from previous → current over ~2 seconds (lerp)
5. Update the scrubber slider position to match
6. Reader can then grab the scrubber and explore freely

### The Dot

One dot per graphmap (not four). It represents the **object** — the political phenomenon being tracked through the arc. Its color could be neutral (cream/white) or shift based on Diatribe value (green at low Dia, red at high Dia).

When the dot has a Z value, it sinks below the plane with a connector line (factory already supports this via `addDot` with `normZ`).

### What Happens to the Diatribe Slider

Removed. The Diatribe value is a *property of each event*, not a user-controlled variable. It displays as a readout below the graphmap, not as a slider.

### What Happens to Response Cards

For events that have authored response text (the Pretti and Metro Surge case studies), response cards still show. For arc events without response text, show the event description, flags, and scoring data instead.

### What Happens to Multiple Graphmaps

Current: three graphmap instances per article (one per `<!-- graph-state -->`).
New: one graphmap instance per article, mounted at the first graph-state position. Subsequent graph-state markers become scroll-triggered waypoints that auto-play the timeline to their associated arc event.

---

## 5. What Was NOT Changed This Session

- `prism-graphmap.js` — untouched, factory API is sufficient
- `admin.html` — untouched
- `prismdb.js` — untouched
- Parallax drawer / Diatribe panel / Comparison panel — untouched
- Splash, onboarding, profile, main Prism interaction — all untouched

---

## 6. Known Issues

- **Dead code:** `PARA_BAND_SHIFT` and `PARA_BAND_RADIUS` constants are unused after the scoring-library rewrite — can be removed
- **PARA_QUAD_POSITIONS** constant is still present as fallback but no longer drives positioning — can be removed once timeline scrubber is built
- **Response card text** was shortened from the full case study responses for card display — the full text lives in the case study markdown files if needed

---

## 7. Files to Drop Into Next Session

| File | Lines | Why |
|------|-------|-----|
| This handoff | — | Full context including arc data |
| `prism-graphmap.js` (~1,447 lines) | Factory with Z render, orbit, dots, viewport lifecycle |
| `index-v52.html` (~6,900 lines) | Parallelogram surface with live graphmaps |

**⚠️ The project knowledge version of `prism-graphmap.js` is OUTDATED (253 lines). Do NOT use it. Always use the uploaded file.**

---

## 8. Git State

Commit before starting next session:
```
cd "/Volumes/EP3_B/PARALLELOGRAM PRISM/Code"
git add -u && git commit -m "v52 — Parallelogram reading surface with live graphmaps"
```

Previous commits (v51):
```
08305af  3D rotation morph
86aaac8  darker graphmap — Getty gallery tone
ce2875d  dots — jewel-tone orbs with emissive glow
dc55424  fix diatribe thumb, richer graphmap palette
9b1e57c  dark mode design tokens
f904834  v51 stable — pre-dark-mode baseline
```

---

*— Prism v52 Parallelogram Handoff — March 12, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
