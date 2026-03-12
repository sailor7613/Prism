# Prism v51 — Dark Mode + Rotation Morph Handoff (March 11, 2026 — Late Night)

## Session type: Code — Design tokens, dark mode, graphmap tuning, 3D rotation morph
## Active version: `index-v51.html` (~5,896 lines), `prism-graphmap.js` (~1,447 lines)

**Drop-in for next session:** This handoff + `prism-graphmap.js` + `index-v51.html`

---

## 1. What Shipped This Session

### Git Safety Net
- Initialized git in `/Volumes/EP3_B/PARALLELOGRAM PRISM/Code`
- Tracking: `index-v51.html`, `prism-graphmap.js`, `prismdb.js`, `admin.html`
- Pre-session ritual: `cd "/Volumes/EP3_B/PARALLELOGRAM PRISM/Code" && git add -u && git commit -m "pre-session snapshot"`
- Emergency revert: `git checkout .`

### Full Dark Mode — Design Token Architecture
Dark is now the primary skin. Light mode is defined and ready — adding `class="light-mode"` to `<html>` flips everything back to cream.

**Token layers on `:root`:**
- `--surface` (4 tiers): `--surface` / `--surface-raised` / `--surface-overlay` / `--surface-inset`
- `--text` (5 tiers): `--text` / `--text-strong` / `--text-secondary` / `--text-muted` / `--text-ghost`
- `--divider` (2 tiers): `--divider` / `--divider-strong`
- `--btn-surface` / `--btn-text`: inverted button system (cream buttons on dark surface)
- `--grid-line` / `--axis-line` / `--axis-tick`: quadrant canvas tokens
- `--art-blend`: `screen` in dark, `multiply` in light — for Procreate PNGs
- `--quad-shade-alpha`: quadrant shade intensity

**What was converted (~200+ color values):**
- Phone shell: `#181825` surface, adjusted shadow model
- Outer page: `#0e0e18` near-black
- All panels (splash, onboarding, profile, P1/P2/P3): `var(--surface)`
- All text: mapped to `--text` tiers
- Buttons: inverted system via `--btn-surface` / `--btn-text`
- Blend modes: `mix-blend-mode: var(--art-blend)`
- Canvas drawing: `getCanvasPalette()` JS helper reads CSS tokens
- Parallax drawer: already dark — 89 `rgba(245,240,232,*)` values left as-is (correct)

### Graphmap Palette — Getty Gallery Tone
- Base plane vertex colors at 0.38 multiplier (deep, near-black)
- Overlay opacity at 0.10 (minimal haze)
- Metalness 0.45, roughness 0.35 (richer reflections)
- Emissive `0x050510` at 0.08 intensity (dark ambient)
- Quadrant hex: `authLeft: 0x3868a8`, `authRight: 0xb83a3a`, `libLeft: 0x3a8a52`, `libRight: 0xb87828`
- Grid lines: cream `0xf5f0e8` at low opacity
- All labels: cream-on-dark palette

### Jewel-Tone Orbs
- Dots switched from `MeshBasicMaterial` (flat, always-bright) to `MeshStandardMaterial`
- `offsetHSL(0, 0.2, -0.05)` — saturated but darkened
- Emissive inner glow at 0.4 intensity
- Roughness 0.3, metalness 0.2

### Diatribe Slider Fix
- Thumb was `var(--surface-raised)` — invisible dark-on-dark
- Now `var(--cream)` with deeper shadow

### 3D Rotation Morph
**Factory** (`prism-graphmap.js`):
- Added `morphOffset = {x: 0, y: 0}` state
- Animation loop: `group.rotation = orbit + morphOffset` (composed)
- New API: `setMorphRotation(x, y)` — sets the offset
- Resets to zero on unmount

**Morph function** (`index-v51.html`):
- `applyPrismMorph(t)` calls `graphmapInst.setMorphRotation(pitch * ease, yaw * ease)`
- Smoothstep easing: `ease = t * t * (3 - 2 * t)` — accelerates into the tilt
- Target at t=1: pitch -0.22 rad (~12° top tilts away), yaw 0.10 rad (~6° rightward)
- Reverse morph (drag up) smoothly unwinds rotation
- Orbit adds on top during graphmap-lock

---

## 2. Key Architecture — Design Token System

```
:root {                           ← Dark mode (primary)
  --surface:         #181825;
  --surface-raised:  #1e1e32;
  --surface-overlay: #24243e;
  --surface-inset:   #141420;
  --text:            rgba(245,240,232,0.88);
  --art-blend:       screen;
  ...
}

:root.light-mode {                ← Light mode (override)
  --surface:         #f2ead8;
  --surface-raised:  #f5f0e8;
  --text:            rgba(26,26,46,0.88);
  --art-blend:       multiply;
  ...
}
```

### Canvas Color Helper
```javascript
function getCanvasPalette() {
  const isDark = !document.documentElement.classList.contains('light-mode');
  return {
    grid, axis, tick, dotShadow, orbitPin, orbitCenter, orbitCross,
    shadeAlpha, borderBase
  };
}
```

### Morph Rotation API
```javascript
// Factory exposes:
graphmapInst.setMorphRotation(pitchRad, yawRad);

// Composed in animation loop:
group.rotation.y = orbit.yaw + morphOffset.y;
group.rotation.x = orbit.pitch + morphOffset.x;
```

---

## 3. What Was NOT Changed

- `admin.html` — untouched, still uses light palette
- `prismdb.js` — untouched
- Parallax drawer cream text (89 instances) — already correct for dark mode, tokenization deferred
- Procreate artwork files — unchanged, blend mode swap handles display

---

## 4. Known Issues / Future Polish

- **Admin portal needs its own dark pass** if desired
- **Parallax drawer** could be tokenized (currently uses raw `rgba(245,240,232,*)` — functional but not systematic)
- **Light mode toggle** — tokens are defined but no UI toggle exists yet; one `classList.add('light-mode')` away
- **Quadrant shade CSS** has hardcoded light-mode overrides (`:root.light-mode .q-quad-shade.*`) — works but verbose

---

## 5. Suggested Next Steps

1. **Parallelogram surface** — `triggerParallelogram()` has a TODO; needs the article/editorial view
2. **Admin word tag pass** — word cloud quality depends on tagged data
3. **Design tokens for admin** — bring admin.html into the token system
4. **Light mode toggle** — add a UI switch (settings or gesture)
5. **Veil-lift transition** — Three.js canvas beneath phone shell, dwell trigger

---

## 6. Files to Drop Into Next Session

| File | Lines | Why |
|------|-------|-----|
| This handoff | — | Full context |
| `prism-graphmap.js` (~1,447 lines) | Factory with morph rotation API |
| `index-v51.html` (~5,896 lines) | Dark mode tokens + rotation morph |

**⚠️ The project knowledge version of `prism-graphmap.js` is OUTDATED (253 lines). Do NOT use it. Always use the uploaded file.**

---

## 7. Git State

```
08305af  3D rotation morph — group tilts with smoothstep as prism drags down
86aaac8  darker graphmap — Getty gallery tone
ce2875d  dots — jewel-tone orbs with emissive glow, darker pin
dc55424  fix diatribe thumb visibility, richer graphmap palette
9b1e57c  dark mode design tokens — full CSS conversion
f904834  v51 stable — pre-dark-mode baseline
```

---

*— Prism v51 Dark Mode Handoff — March 11, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
