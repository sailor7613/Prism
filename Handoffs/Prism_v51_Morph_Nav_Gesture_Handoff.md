# Prism v51 — Prism Morph System, Nav Gesture, Asset Swap Handoff

## March 11, 2026

**Session type:** Code — Prism nav tool, free-drag gesture, Parallelogram hold, continuous 2D↔3D morph  
**Predecessor:** `Prism_v51_UI_Polish_Asset_Swap_Word_Clouds_Handoff.md` (March 11, earlier session)  
**Active version:** `index-v51.html` (~5,823 lines), `prism-graphmap.js` (~257 lines)

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v51.html`

---

## 1. What Was Accomplished This Session

New Procreate artwork extracted (prism nav with color-filled triangle). Beam header image swapped from old `Header_prism_transparent.png` to new `prism_nav_full.png`. Free 2D drag system built for the prism — it lifts off the header and floats anywhere on screen. Parallelogram 4-second center-hold gesture implemented with progressive feedback ring, geometric ripple, and prism mirror/reverse. Continuous 2D↔3D morph system built — dragging the prism down over the graph drives a real-time crossfade between the flat 2D graph and the 3D graphmap. Graphmap factory updated to use alpha-transparent renderer with `setClearAlpha()` API. 3D group rotation driven by morph value (flat face-on at t=0, tilted at t=1). Dev skip updated to show answer cards immediately.

### Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Nav artwork extraction | Done | `prism_nav_full.png` — white bg removed, color-filled triangle preserved |
| Beam header image swap | Done | `Header_prism_transparent.png` → `prism_nav_full.png` |
| Free 2D drag | Done | Prism lifts off header, follows cursor/finger on both axes |
| Text selection suppression | Done | `user-select: none` during drag via `.prism-dragging` |
| Parallelogram center-hold | Done | 4s hold in ±12% bullseye → trigger |
| Progressive hold ring | Done | Conic gradient progress ring at phone center |
| Geometric ripple | Done | 4 concentric rings (blue/amber/green/red) expand from trigger point |
| Prism mirror/reverse | Done | `scaleX(-1)` on trigger, tap to exit |
| Continuous 2D↔3D morph | Done | `applyPrismMorph(t)` drives all elements proportionally |
| 3D rotation morph | Done | Group rotates from flat (0°) to tilted (-16° X, 7° Y) with morph |
| Transparent renderer | Done | Factory uses `alpha: true`, `setClearAlpha()` API exposed |
| 2D element fade | Done | Grid, axes, shades, corner labels, pin all fade with morph |
| Outer label drift | Done | Y-axis labels drift up/down 6px, side labels drift out 4px |
| Prism glow morph | Done | Glow intensity scales with morph value |
| Snap completion | Done | Release > 0.4 → complete to 3D; < 0.4 → complete to flat |
| Reverse morph | Done | Drag prism up from graphmap → drives morph backward |
| Dev skip fix | Done | `?dev` now auto-commits aperture, shows answer cards |

### Files Modified

| File | What Changed |
|------|--------------|
| `index-v51.html` | Beam img src swap, free-drag system, Parallelogram hold gesture, morph system, graphmap-active label drift CSS, prism-active glow, center target/ring elements, dev skip fix |
| `prism-graphmap.js` | `alpha: true` on renderer, `setClearAlpha(a)` API method |

### Files Created

| File | Purpose |
|------|---------|
| `prism_nav_full.png` | Transparent nav bar with color-filled triangle (Artwork 4) |

---

## 2. ⚠️ KNOWN BUG — Init Flow Broken

**The splash screen is not dismissing properly.** Pressing BEAM does not advance to the event prompt. The `?dev` skip was also landing at an incomplete state (no answer cards visible — fixed this session to auto-commit aperture).

**Likely cause:** The `playPortalThenApp()` flow may have been disrupted. The function chain is: splash BEAM button → `enterApp()` → `showOnboarding()` → onboarding slides → `playPortalThenApp()` → `loadEvent()`. Something in this chain is failing or not triggering the transition.

**What to investigate first:**
1. Check `playPortalThenApp()` at line ~3253 — does it successfully hide splash/onboarding?
2. Check if `appEntered` flag is being set
3. Look at CSS `.dev-skip` rules (lines 14-17) — they hide by `display: none` which is correct
4. The splash BEAM button's onclick handler — is it wired to `enterApp()`?
5. Console errors on load — there may be a JS error that halts execution before init

**This was NOT caused by session changes.** The morph system, gesture code, and CSS additions are all downstream of the init flow. However, the session did modify the `?dev` skip block (removed `openDiatribeForEvent()` call, now just auto-commits aperture). If `?dev` also broke, reverting that block would fix it:

```javascript
// Old (this session):
apertureCommitted = true;
apertureBand = 'goodFaith';
// ... shows cards

// Previous (may need to restore):
setTimeout(() => { openDiatribeForEvent(); }, 300);
```

---

## 3. Prism Morph Architecture

### Concept

The prism nav tool is the *instrument of transformation*. Dragging it down over the graph physically refracts the 2D surface into the 3D graphmap in real time. The graph morphs under the prism as it passes.

### Trigger Chain

| Stage | Trigger | What Happens |
|-------|---------|-------------|
| T0 | Resting | Prism in header. 2D flat graph. `morphValue = 0` |
| T1 | dy > 20px | `preMountGraphmap()` — mounts 3D canvas at opacity 0, syncs data, auto-scrolls panel to graph |
| T1→T4 | Continuous | `applyPrismMorph(t)` — all elements driven by prism Y position mapped to 0→1 |
| T4 | Center zone | Full 3D. Hold timer starts. Words breathing. |
| T5 | Hold complete | Parallelogram trigger: ripple + mirror + snap to top |

### Morph Function: `applyPrismMorph(t)`

Driven by `computeMorphFromPrismY()` which maps prism Y between header bottom (72px) and phone center into 0→1.

| Property | t=0 (2D flat) | t=1 (3D graphmap) |
|----------|---------------|-------------------|
| 3D canvas opacity | 0 | 1 |
| 3D group.rotation.x | 0 | -0.28 rad (-16°) |
| 3D group.rotation.y | 0 | 0.12 rad (7°) |
| 3D setClearAlpha | 0 (transparent) | 1 (opaque dark bg) |
| 2D grid/axes/pin | opacity 1 | opacity 0 |
| 2D corner labels | opacity 1 | opacity 0 |
| Quadrant border | 0.12 alpha | 0 alpha |
| Outer Y labels | normal position | drift ±6px, opacity 0 |
| Outer side labels | normal position | drift ±4px, opacity 0 |
| Prism glow | none | full blue/amber glow |

### Snap Completion

On drag release, morph snaps to nearest state:
- `morphValue > 0.4` → `completeMorphToGraphmap()` — animates to t=1 (400ms ease-out cubic), applies CSS classes, opens parallax in graph-mode
- `morphValue ≤ 0.4` → `completeMorphToFlat()` — animates to t=0, unmounts graphmap, closes parallax

### Reverse Morph

When in `graphmap-lock` state and dragging prism UP:
1. CSS classes stripped, morph set to t=1 inline
2. Prism Y drives morph backward
3. On release: same snap logic — below 0.4 completes to flat + closes parallax

### Key Functions

| Function | Purpose |
|----------|---------|
| `preMountGraphmap()` | Mount 3D canvas at opacity 0, sync data, set flat rotation |
| `applyPrismMorph(t)` | Drive all elements proportionally by morph value |
| `clearMorphStyles()` | Strip all inline morph styles so CSS classes can take over |
| `computeMorphFromPrismY()` | Map prism Y position to 0→1 morph value |
| `snapMorphTo(target, cb)` | Animate morph value to target with ease-out cubic |
| `completeMorphToGraphmap()` | Snap to 1, apply CSS classes, open parallax |
| `completeMorphToFlat()` | Snap to 0, unmount, close parallax |
| `unmountMorph()` | Reset rotation, unmount factory, clear state |

---

## 4. Free Drag System

### Architecture

The beam header image uses `transform: translateY()` for vertical movement and `style.left` for horizontal. This means:
- Horizontal: preserves panel-switch feel (same left-position model as before)
- Vertical: lifts the prism freely off the 72px header bar

### Classes Applied During Drag

| Class | Applied To | Effect |
|-------|-----------|--------|
| `.beam-pressed` | beamHeader | overflow visible, z-index 500 |
| `.prism-floating` | beamHeader | overflow visible, z-index 500, shadow |
| `.prism-dragging` | phone | `user-select: none !important` on all children |

### Gesture Results

| Gesture | Result |
|---------|--------|
| Tap (no movement) | Toggle parallax open/close |
| Horizontal drag > 28% | Panel switch (Beam/Prism/Refraction) |
| Drag down > 25% of phone | Open parallax |
| Drag up > 15% (parallax open) | Close parallax |
| Hold in center 4s | Parallelogram trigger |
| Release during morph | Snap to nearest state (flat or 3D) |

---

## 5. Parallelogram Hold Gesture

### Parameters

| Constant | Value | Meaning |
|----------|-------|---------|
| `PARA_HOLD_DURATION` | 4000ms | Hold time to trigger |
| `PARA_CENTER_ZONE` | 0.12 | ±12% of phone dimensions = ~24% bullseye |
| `PARA_TRIANGLE_OFFSET_X` | 323px | From image left to triangle center in CSS space |

### Trigger Sequence

1. Prism enters center zone during drag → timer starts
2. Progress ring appears at phone center (conic gradient, 3px stroke)
3. Prism glow intensifies via `--hold-progress` CSS variable
4. At 4s: prism snaps to top center, transform cleared
5. 420ms later: ripple fires from phone center (4 rings, staggered 120ms)
6. Prism mirrors (`scaleX(-1)`) + header locked to top
7. `paraIsMirrored = true` — all panel switches and position updates suppressed

### Exit

Tap mirrored prism → reverse ripple + un-mirror + slide back to panel position.

---

## 6. Factory Changes (`prism-graphmap.js`)

| Change | Before | After |
|--------|--------|-------|
| Renderer alpha | `alpha: false` | `alpha: true` |
| Clear color | `setClearColor(bg, 1)` always | Controlled via `setClearAlpha(a)` |
| New API method | — | `setClearAlpha(a)` — sets background opacity 0→1 |
| Public exports | `mount, unmount, resize, setPin, clearPin` | Added `setClearAlpha` |

---

## 7. Asset Inventory

### New: `Artwork/Prisms/prism_nav_full.png`
- Dimensions: 2000×232 px (renders at 621×72 in CSS)
- Source: `Untitled_Artwork_4.jpg` — Procreate JPEG with white background
- Extraction: luminance-based alpha (white → transparent, threshold 25)
- Features: blue horizontal lines + triangle with quadrant color fill (refraction)
- Triangle center: ~1042px from left in source = ~323px in CSS space

### Referenced in code:
```
<img src="../Artwork/Prisms/prism_nav_full.png" alt="">
```

---

## 8. What's NOT Done Yet

### Deferred / Blocked
- **Init flow bug** — splash BEAM button not advancing; must fix before other work
- **Parallelogram surface** — gesture is built, `triggerParallelogram()` has TODO
- **Drag down for parallax open** — works but feels stiff; vertical shade-pull (old behavior) was removed in favor of free drag; may want to restore shade-tracking proportional opacity
- **Morph zone tuning** — `computeMorphFromPrismY()` math assumes graph at `quadrantSection.offsetTop` after auto-scroll; needs testing across events
- **Reverse morph from graphmap** — works conceptually but the vertical drag detection from graphmap-lock state needs more testing
- **Design tokens pass** — still deferred
- **Word cloud on 2D graph** — only 3D has word sprites

### Factory-level remaining
- Floating word layer during orbit
- Diatribe slider in canvas
- Timeline mode
- Logarithmic clustering
- CSS orbit fallback cleanup

---

## 9. Files to Drop Into Next Session

| File | Why |
|------|-----|
| This handoff | Full context for morph system, gesture architecture, known bugs |
| `prism-graphmap.js` | Factory with alpha renderer and setClearAlpha API |
| `index-v51.html` | Main app with morph system, gesture code, all wiring |

**Priority for next session:** Fix the init flow bug (splash → event prompt transition). Once that's resolved, test the full morph chain end-to-end.

---

*— Prism v51 Morph System + Nav Gesture Handoff — March 11, 2026 —*  
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
