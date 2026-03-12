# Prism Gallery v2 — Handoff Document

## March 9, 2026

**File:** `prism-gallery-v2.html` (~2,470 lines, self-contained)
**Status:** Stable standalone asset. Gallery is feature-complete for current scope.
**Drop-in for next session:** This handoff, `prism-gallery-v2.html`, `Prism_Diatribe_Aperture_Revision_v1.md`, `Prism_Architecture_Update_v1.md`, `Prism_Roadmap_v1_7.md`

---

## 1. What the Gallery Is

The gallery is the **ground truth** of Prism. The flat app (index-v49) is the working surface — an overlay, a scrim. The gallery is the contemplative space underneath it, always running. The Graphmap doesn't enter the gallery; it's always in the gallery. The flat app is the veil.

**The Getty Villa framing:** Conceptually, the gallery is Prism's Getty Villa — the place at which the fullness of time and the whole of history can be observed in a pacific understanding. This is not decoration. It is the ontological core.

**The veil-lift transition (designed, not yet built):** When a user dwells on the Graphmap in the flat app for ~30 seconds without interacting, the HTML panels fade out, the Three.js canvas expands to fill the viewport, and the camera pulls back to reveal the gallery room materializing around the Graphmap. The user was always in the room. They just couldn't see it yet. The Prism nav triangle stays visible as the tether — one DOM element that lives in both worlds. Clicking it reverses the transition.

---

## 2. What Exists and Works

### Room & Environment
- 16×16×9 room with translucent walls (stars/moon bleed through in dark mode)
- Floor tiles, four ceiling panels framing a 10-unit skylight opening
- Four Ionic columns at corners with fluted shafts, Attic bases, volutes, beading
- Star dome (800 golden orbs), procedural phase-accurate moon (forced full for testing)
- Sun disc and light shaft for daylight mode, moonbeam directional light
- Acacia tree, elephant, giraffe, zebra outside the translucent walls with idle animations
- Dark/Skylight smooth mode toggle

### Gallery Assets (configurable)
- **Config block** at top of script: `GALLERY_ASSETS` object with paths for four frame images and skylight video/image
- **Wall frames:** Four frames with press-hold art walk. Frames auto-resize to match loaded image aspect ratio (landscape, portrait, panoramic all handled). Currently loaded: coastal sunset (back), snowy mountains (front), Getty panoramic (left), tweet (right)
- **Skylight video:** `parallelogram intro.MP4` — VHS reel loops overhead through the skylight opening via `THREE.VideoTexture`
- **Skylight image:** `Getty_skylight.PNG` — static photo of Getty Villa skylight frame layered at ceiling level, full opacity with depth writing

### Graphmap (ported from v1i)
- Vertex-colored iridescent plane (quadrant colors at 0.25 intensity, metalness 0.08, roughness 0.65)
- 10-division grid with cream axis lines, outer border
- Four quadrant shade overlays at 12% opacity
- Z-axis with tick marks at ±0.5, ±1.0, ±1.5
- Corner labels (Auth·Left, Auth·Right, Lib·Left, Lib·Right), axis labels, Z·Depth label
- 11 aggregate dots (Pretti/2A case study data) with Z-connectors and glow sprites
- User pin (cream cone)
- Starts hidden, toggled via Graphmap button

### Diatribe Objects
- Multicolored asterisk (4 quadrant rays + 4 cream axis rays + white core)
- Two aperture rings (purple at center, blue/red split when active)
- Ring glow sprite
- Parchment on easel (dynamic canvas texture, 1024×768) with demo state at 0.35
- Easel rotated 180° to face room center
- Starts visible, toggled via Diatribe button

### Interaction
- **Free orbit** with auto-resume after 8s idle
- **Art walk:** Press-hold on wall frames walks camera to viewing position. Release smoothly reverses camera back to prior position at same speed
- **Parchment click:** Click parchment to approach reading position (one-shot camera animation)
- **Independent toggles:** Diatribe (rings) and Graphmap are separate buttons. Both can be on simultaneously
- **Approach animation:** Gallery opens with camera descending from high/wide to comfortable orbit

### Pedestal
- Classical column pedestal at room center, transparent (opacity 0.5) so you can see through from below to asterisk and skylight

---

## 3. Asset Inventory

| File | Purpose |
|------|---------|
| `prism-gallery-v2.html` | The gallery (self-contained) |
| `gallery-coast.jpg` | Back wall frame — coastal golden hour |
| `gallery-mountains.jpg` | Front wall frame — snowy mountains, camera rig |
| `gallery-getty.jpg` | Left wall frame — Yosemite panoramic |
| `gallery-tweet.jpg` | Right wall frame — tweet |
| `Getty_skylight.PNG` | Skylight frame image at ceiling |
| `parallelogram intro.MP4` | Skylight video — VHS reel loop |
| `gallery-illustration.jpg` | Available spare (colorful illustration) |

---

## 4. The Veil-Lift Transition (Designed, Not Built)

This is the big architectural move for integration with the flat app.

**Mechanical design (settled in this session):**
1. Three.js canvas always runs, even in flat app mode, clipped to upper triptych panel
2. Camera locked tight on Graphmap in flat mode — looks like the current CSS 3D graph
3. Lower triptych, sidebar, clipboard all normal DOM
4. 30-second dwell trigger: user stops interacting
5. HTML panels fade to transparent over 3-4 seconds
6. Three.js canvas expands from triptych bounds to full viewport
7. Camera pulls back and rises, gallery materializes around the Graphmap
8. Free orbit releases. Art walk available
9. Prism nav triangle stays visible throughout — the tether
10. Tap nav → camera pushes back in, DOM fades up, back to flat app
11. Dwell timer resets

**Not yet addressed:** Camera return from arbitrary orbit angles. The return animation needs to interpolate from wherever the user is back to the front-locked position.

---

## 5. What's Next

### Immediate (gallery polish)
- Fine-tune easel/parchment position after 180° rotation — may need spatial adjustment
- Test skylight image at different orbit angles — depth ordering with video
- Consider whether aggregate dots need animation (gentle drift, pulse)

### Integration (the veil-lift build)
- Replace CSS 3D graph in index-v49 upper triptych with Three.js canvas running the gallery scene
- Build the dwell trigger and DOM fade
- Build the canvas expansion animation
- Wire Prism nav for return transition

### Phase 3A (Graphmap as infrastructure)
- The v1i graph ported here is demo data. Real implementation needs:
  - PrismDB connection for live event data
  - Dynamic dot placement from response aggregation
  - Pin placement interaction in the flat app (not in gallery)
  - Label legibility management during rotation

### Gallery future objects (Sailor has more planned)
- Additional objects to place in the gallery (mentioned but not specified)
- Art will be swapped often — config system handles this

---

## 6. Key Decisions Made This Session

1. **The gallery is the ground truth.** The flat app is the scrim over it.
2. **The Graphmap is always in the gallery.** The veil lifts to reveal it.
3. **The gallery is contemplative, not passive.** Art walk, orbit, observation — but no editing verbs.
4. **Diatribe interaction happens in the flat triptych.** Parchment in gallery reflects state but isn't the input surface.
5. **Independent toggles.** Diatribe and Graphmap can coexist or be shown separately.
6. **Easel and parchment are gallery furniture.** Always visible regardless of toggle state.

---

*— Prism Gallery v2 Handoff — March 9, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
