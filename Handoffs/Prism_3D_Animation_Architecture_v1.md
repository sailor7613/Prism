# Prism 3D Animation Architecture v1

**Date:** March 13, 2026  
**Authors:** Sailor / Claude  
**Project:** Western Diametrica — Prism  
**Status:** Design document — pre-implementation

---

## 1. Purpose

Prism has four distinct 3D contexts that each use Three.js. Before building any of them individually, this document establishes the shared camera model, transition system, render loop architecture, and choreography patterns that all four contexts will use. The goal is coherence — the same graphmap object should feel like the same object whether it appears in the Parallax overlay, inside a Parallelogram article, on a gallery pedestal, or during the veil-lift transition between them.

---

## 2. The Four Contexts

### 2.1 — Graphmap (Main App / Prism Panel)

The primary analytical graphmap. Lives in the lower center panel. User places their pin, views aggregate dots, enters orbit via the Z-slider. This is the graphmap in its most interactive state — all capabilities enabled.

**Current state:** Built and wired. Factory instance in `analytical` mode. Camera at z=4.8, FOV 36°, orbit via pointer drag with momentum damping, `spinTo()` for programmatic rotation. Beat engine exists in `prism-parallax.js` (the seeing orbit → drift → centroid sequence). Aggregate dots with additive blending. Pin with shimmer animation.

**Camera behavior:** User-driven orbit (drag to rotate, scroll/pinch to zoom). The beat sequence is triggered by a 6-second static hold on a non-zero Z-slider value. Camera focus shifts from user's pin position to weighted aggregate centroid during the drift beat.

**Renderer:** Own `WebGLRenderer` instance, own `rAF` loop, mounted into the `#graphContainer` div via factory `.mount()`.

### 2.2 — Parallax 3D / Orbit Panel

The Z-slider turntable and orbit sequence that lives in the Parallax overlay. This is the "entering the graph" moment — the user rotates the graphmap to see it dimensionally, and if they hold, the choreographed orbit sequence begins.

**Current state:** The orbit engine (beat sequence, drift interruption, centroid computation) is fully implemented in `prism-parallax.js`. The Z-slider drives CSS `rotateY` as a legacy fallback but the Three.js graphmap now handles rotation natively through its orbit state. The floating word layer is designed but not built.

**Camera behavior:** Same graphmap instance as Context 2.1 — the Z-slider manipulates the same factory instance's orbit state. The transition from flat view to orbit is continuous, not a mode switch. When the slider returns to zero, the graph returns to face-on.

**What's new to build:** Floating word layer (highest-weight tags rendered as 3D text sprites near their pin clusters during orbit). This is a graphmap capability, not a per-context feature — any instance with `floatingWords: true` in its capabilities should support it.

### 2.3 — Parallelogram Animated Graphs

Interactive graphmap embeds inside scrollable editorial articles. Each embed is a factory instance configured to a specific analytical state (Diatribe position, visible responses, highlighted quadrant). The reader scrolls through prose; graphmaps appear at analytical turns; the reader can interact with the Diatribe scrub slider on each embed.

**Current state:** Not yet built. Factory infrastructure is ready. The Parallelogram Design Doc specifies graph-state markers in markdown, scroll-linked `activate()`/`deactivate()` lifecycle, and `animateTransition` between consecutive embeds.

**Camera behavior:** Orbit is disabled on article embeds (`orbit: false` in capabilities). The graphmap is presented at a fixed angle — editorial choice, not user-driven. However, beat sequences can play at scroll waypoints (a subtle rotation when the embed enters viewport, settling to the editorial angle). Diatribe scrub slider is reader-operated.

**Renderer:** Multiple instances per article (3–6 typical). Each has its own renderer. Only the viewport-visible instance(s) run their `rAF` loop; off-screen instances are deactivated. `IntersectionObserver` drives the activate/deactivate lifecycle.

### 2.4 — Gallery (Dream Getty)

The contemplative display space. A Three.js room with two graphmap instances on pedestals, avatar cluster, translucent wall, and room-level camera orbit. The gallery has its own scene graph that contains the graphmap instances as objects within the room.

**Current state:** `prism-gallery-v2.html` exists as a standalone reference file with room geometry, translucent wall, avatar cluster, and camera orbit. Graphmap factory instances are not yet wired into the gallery. The veil-lift transition (flat app → gallery) is designed but not built.

**Camera behavior:** Room-level orbit — the camera orbits around the room, not around the graphmap. The graphmap is an object within the room, like a sculpture on a pedestal. The public pedestal has a looping beat breathe (gentle continuous rotation). The working pedestal is manipulable (connected to admin).

**Renderer:** Single `WebGLRenderer` for the entire gallery scene. The graphmap instances are not separately rendered — their scene contents (plane, grid, dots, pin, labels) are added as children of pedestal groups within the gallery scene graph. This is the critical architectural difference from all other contexts.

---

## 3. Two Renderer Architectures

The four contexts use two fundamentally different rendering approaches, and getting this distinction right prevents the most likely architectural mistakes.

### Architecture A — Standalone Graphmap Instance

Used by: Contexts 2.1, 2.2, 2.3

The graphmap factory creates an independent Three.js scene, camera, and renderer. The factory instance owns its render loop. The canvas is appended to a container div. The graphmap is the entire 3D world.

This is what `PrismGraphmap.create()` does today. No changes needed to this architecture.

### Architecture B — Graphmap as Scene Child

Used by: Context 2.4 (Gallery)

The gallery has its own scene, camera, and renderer. The graphmap's *geometry* (plane, grid, dots, pin, labels) is added to the gallery scene as a child of a pedestal group — but the graphmap does not have its own renderer or camera. The gallery's camera sees the graphmap from the room's perspective.

**This requires a new factory method.** The current `create()` always builds a renderer and camera. The gallery needs a way to get the graphmap's `group` (the Three.js Group containing all graphmap geometry) without the renderer/camera/rAF overhead. Something like:

```javascript
const graphGeometry = PrismGraphmap.createSceneChild({
  mode: 'readonly',
  capabilities: { orbit: false, zInput: false, zRender: true }
});
// Returns: { group, setPin, clearPin, setDots, ... }
// Does NOT return: renderer, camera, canvas, mount/unmount
```

The gallery's render loop calls its own `renderer.render(galleryScene, galleryCamera)` once per frame, and the graphmap geometry participates naturally because it's part of the scene graph.

**Beat engine for scene children:** The public pedestal's looping beat breathe is not orbit in the usual sense (camera doesn't move). Instead, the *pedestal group itself rotates* — `pedestalGroup.rotation.y` is animated by a beat sequence. The beat engine needs to support rotating a group, not just setting orbit state on a camera. This is a targeted extension to the existing beat API:

```javascript
graphGeometry.playGroupBeats([
  { yaw: 15, pitch: 5, duration: 4000, hold: 2000 },
  { yaw: -15, pitch: -3, duration: 4000, hold: 2000 },
], { loop: true });
```

---

## 4. Shared Camera Model

Despite the two architectures, all contexts share a conceptual camera model with consistent parameters.

### 4.1 — Camera Constants

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| FOV | 36° | Telephoto feel — flattens the graph plane slightly, feels more "observed" than immersive |
| Near clip | 0.1 | Standard |
| Far clip | 200 | Gallery room needs depth; graphmap alone could use ~50 |
| Default Z position | 4.8 | Graphmap fills ~80% of viewport at this distance |
| Zoom range | 3.2–9.0 | Scroll/pinch zoom bounds |

The gallery camera uses different values (wider FOV for room perspective, further back, different aspect ratio management) but the graphmap geometry itself is built to the same scale (`GRAPH_SIZE = 2.8`) in all contexts.

### 4.2 — Orbit State

All orbit is expressed as two values: yaw (rotation around Y axis) and pitch (rotation around X axis, clamped). This is true whether it's camera orbit (Architecture A) or group rotation (Architecture B).

```
yaw   : radians, unbounded (wraps naturally)
pitch : radians, clamped to ±pitchClamp (default 0.65 rad ≈ 37°)
```

The orbit state is applied in the render loop as:

```javascript
// Architecture A (standalone): rotate the group
group.rotation.set(orbit.pitch, orbit.yaw, 0);

// Architecture B (scene child): rotate the pedestal group
pedestalGroup.rotation.set(orbit.pitch, orbit.yaw, 0);
```

Both paths produce identical visual results from the graphmap's perspective.

### 4.3 — Momentum and Damping

After user drag release, velocity decays by `damping` per frame (currently 0.92). This should be consistent across all interactive contexts. The damping value is a factory config option with a sensible default, not a per-context override.

---

## 5. Transition System

The transitions between contexts are the highest-impact moments in the product. There are three transitions to design.

### 5.1 — Flat → Orbit (Contexts 2.1 ↔ 2.2)

**Trigger:** Z-slider moved to non-zero value.  
**Behavior:** Continuous — the graphmap tilts in response to slider position. No mode switch, no separate rendering context. The same factory instance's orbit state is updated by `handleZSlider()`.

**6-second hold trigger:** After 6 seconds at a non-zero slider position, the beat sequence begins. This is a choreography trigger, not a rendering transition.

**Already built.** No architectural changes needed.

### 5.2 — Veil-Lift (Main App ↔ Gallery) (Contexts 2.1 ↔ 2.4)

**Trigger:** ~30 seconds of user dwell in the main app.  
**Behavior:** The flat app UI fades, revealing the gallery beneath. The graphmap transitions from Architecture A to Architecture B — from a standalone instance filling its container to a scene-child object on a pedestal in a room.

This is the hardest transition. Here's the architecture:

**Phase 0 — Pre-transition (always running):**
The gallery renderer runs continuously behind the flat app, but its canvas is clipped to the upper triptych region (where the graphmap container lives). The gallery camera is positioned so the public pedestal's graphmap aligns with the standalone graphmap's screen position. The gallery canvas is `z-index: -1` beneath the HTML panels.

**Phase 1 — Dwell trigger fires (t=0):**
HTML panels begin fading (opacity 1→0, ~1.2s ease). The flat graphmap canvas also fades. The gallery canvas remains visible — as the HTML fades, the gallery "shows through." The Prism nav triangle stays visible as a tether.

**Phase 2 — Canvas expansion (t=0.8s, overlapping with Phase 1):**
The gallery canvas clip region animates from the upper triptych bounds to full viewport (~0.8s). The gallery camera pulls back smoothly (from tight-on-pedestal to room-view, ~1.5s). The avatar cluster fades in.

**Phase 3 — Gallery active (t=2s):**
Gallery is now full viewport. Room-level orbit enabled. The graphmap on the public pedestal is playing its beat breathe. The Prism nav triangle is a floating tether — tapping it reverses the transition.

**Reverse:** Tap nav triangle → camera pushes forward toward pedestal → gallery canvas clips back to upper triptych → HTML panels fade in → standalone graphmap canvas fades in → gallery canvas returns to background.

**Key architectural requirement:** The graphmap data (dots, pin, Diatribe state) must be mirrored between the standalone instance and the gallery's scene-child instance. On transition, the gallery pedestal should show the same data the user was just looking at. This is a data sync, not a geometry transfer — both instances read from the same source (PrismDB / current event state).

### 5.3 — Article Embed Scroll (Context 2.3)

**Trigger:** Graphmap embed scrolls into viewport.  
**Behavior:** `IntersectionObserver` fires → factory instance `.activate()` → render loop starts → optional entry beat plays (subtle rotation settling to editorial angle, ~800ms).

**Between consecutive embeds:** If `animateTransition: true` in the graph-state marker, the Diatribe position and visible responses interpolate smoothly from the previous embed's state to the new embed's state as the user scrolls between them. This requires the outgoing embed to remain active briefly during the transition.

**Implementation:** Each embed's `IntersectionObserver` uses a threshold array (`[0, 0.25, 0.5, 0.75, 1.0]`) to provide scroll progress. At threshold 0.25 (embed 25% visible), activate and begin entry animation. At threshold 0 (fully scrolled out), deactivate. The scroll progress value can drive interpolation between consecutive graph states.

---

## 6. Choreography: The Beat Engine

The beat engine is the shared language for scripted 3D animation across all contexts. It already exists in `prism-parallax.js` as a procedural state machine. This section formalizes it as a reusable system.

### 6.1 — Beat Definition

A beat is a single animated rotation segment:

```javascript
{
  yaw: 25,           // target yaw in degrees
  pitch: 8,          // target pitch in degrees
  duration: 3000,    // animation duration in ms
  hold: 1500,        // pause at target before next beat (ms)
  easing: 'inOutCubic'  // easing function (default: inOutCubic)
}
```

### 6.2 — Sequence Types

| Sequence | Contexts | Behavior |
|----------|----------|----------|
| **Seeing orbit** | 2.1/2.2 | Two beats orbiting around user's pin. Focus: pin position. Triggered by Z-slider hold. |
| **Documentary drift** | 2.1/2.2 | Eased pan from pin focus to aggregate centroid. Not a beat — a continuous interpolation of both yaw *and* focus point over ~4.5s. |
| **Centroid orbit** | 2.1/2.2 | Slow continuous oscillation around centroid. Loops until interrupted. |
| **Beat breathe** | 2.4 | Gentle looping rotation on gallery pedestal. Low amplitude (±12° yaw, ±4° pitch). Contemplative tempo. Plays indefinitely. |
| **Entry settle** | 2.3 | Single beat from a slightly offset angle to the editorial target angle. Quick (~800ms), subtle. |
| **Diatribe scrub** | 2.3 | Not orbit — animates the response data (which dots are visible, how they're positioned) while the graphmap angle stays fixed. Driven by slider, not beat engine. |

### 6.3 — Interruption Model

User interaction (drag, tap, slider change) interrupts any active beat sequence. The interruption point is logged as behavioral metadata (how far the user let the drift go before stopping).

**Architecture A:** User drag sets `orbit.dragging = true`, which causes the beat engine to yield. On drag release, momentum takes over. The beat engine does not resume.

**Architecture B:** Gallery room orbit can be interrupted by touch. Pedestal beat breathe is *not* interrupted by room orbit — they operate on different rotation targets (room camera vs. pedestal group).

### 6.4 — Where the Beat Engine Lives

Currently the beat sequence logic is in `prism-parallax.js` and operates on CSS transforms / orbit state variables. It needs to be refactored into the graphmap factory itself so any instance can play beats.

**Target API on factory instances:**

```javascript
instance.playBeats(beatArray, { loop: false, onComplete: fn });
instance.stopBeats();
instance.isPlaying();
```

**Target API on scene-child instances:**

```javascript
sceneChild.playGroupBeats(beatArray, { loop: true });
sceneChild.stopGroupBeats();
```

The beat engine tick function lives inside the factory's `animate()` loop (Architecture A) or is called by the gallery's render loop (Architecture B).

---

## 7. Floating Word Layer

The floating word layer is a graphmap capability, not a per-context feature. When enabled, highest-weight word tags (≥0.61) from each quadrant are rendered as 3D text sprites positioned near their pin clusters.

### 7.1 — Rendering

Three.js `Sprite` with `SpriteMaterial` using a dynamically generated canvas texture for each word. Sprites face the camera (billboard behavior), which means they remain readable at any orbit angle — this is the correct behavior, not a limitation.

### 7.2 — Positioning

Each word sprite is positioned at the centroid of its associated pin cluster, offset slightly in Z (toward the camera) to prevent z-fighting with the graph plane. Cross-axis tags (words with significant load on both axes) are positioned between their relevant quadrants — spatial position reflects dialectical ambiguity.

### 7.3 — Interaction with Toggle Board

Active toggle board selections brighten their corresponding word sprites and recede non-selected words. This is an opacity/emissive change on the sprite material, driven by the toggle board state.

### 7.4 — Capability Gate

```javascript
PrismGraphmap.create({
  capabilities: {
    floatingWords: true,  // default: false
    // ...
  }
});
```

When `floatingWords` is false, no sprites are created. When true, the instance exposes:

```javascript
instance.setWordTags(tagArray);  // array of { word, quadrant, weight, axisLoads }
instance.clearWordTags();
```

---

## 8. Render Loop Management

### 8.1 — Performance Budget

Mobile is the constraint. Target: 60fps on iPhone 12-era hardware. Budget per frame: ~16ms.

| Context | Max simultaneous renderers | Expected load |
|---------|---------------------------|---------------|
| Main app (2.1 + 2.2) | 1 | Low — single graphmap, simple scene |
| Parallelogram (2.3) | 2 (viewport-visible) | Medium — two renderers, simpler scenes (no pin animation, no orbit) |
| Gallery (2.4) | 1 | High — room geometry, two graphmaps, avatar cluster, translucent wall, lighting |
| Veil-lift transition | 2 briefly | High — both main graphmap and gallery rendering simultaneously during crossfade |

### 8.2 — Activation Lifecycle

Every factory instance supports `activate()` and `deactivate()`:

- **Active:** `rAF` loop running, pointer events bound, renderer rendering.
- **Inactive:** `rAF` cancelled, pointer events unbound, renderer idle. Geometry and state preserved in memory.

The main app graphmap is active when its container is visible (not during splash, onboarding, or when another overlay covers it). Parallelogram embeds activate on viewport entry. Gallery activates on veil-lift trigger.

### 8.3 — The Veil-Lift Double-Render Window

During the veil-lift transition, both the standalone graphmap and the gallery renderer are active simultaneously (~2 seconds). This is the only moment where two independent renderers run concurrently on the main app page. The transition should be designed to minimize this window — the standalone graphmap canvas fades out early (Phase 1), and its `rAF` loop is cancelled as soon as its opacity reaches 0.

---

## 9. Atmosphere and Aesthetic Continuity

The graphmap should feel like the same physical object across all four contexts. Different lighting and environment, same materiality.

### 9.1 — Graphmap Materiality (Consistent Across All Contexts)

- Iridescent gradient plane (existing — warm cream with quadrant color tinting)
- Animated grid lines (existing — subtle pulse)
- Aggregate dots with additive blending (existing — translucent, glow on overlap)
- Pin with shimmer and halo (existing)
- Warm overhead spot + fill lights (existing in factory's `buildLighting()`)

### 9.2 — Context-Specific Atmosphere

| Context | Background | Fog | Exposure | Mood |
|---------|-----------|-----|----------|------|
| Main app (2.1/2.2) | `#0c0b09` (near-black) | None | 0.9 | Focused, analytical |
| Parallelogram (2.3) | Transparent or article background | None | 0.85 | Embedded, editorial — slightly dimmer to not overpower prose |
| Gallery (2.4) | Room geometry | Yes — exponential, subtle | 0.7 | Contemplative, museum — darker, more atmospheric |

### 9.3 — Depth Cues (Not Yet Built)

The 3D graph audit identified that the graphmap currently lacks atmospheric depth cues. These should be added as factory capabilities, not per-context hacks:

- **Depth fog on dots:** Dots further from the camera (during orbit) are slightly more transparent and desaturated. This is a per-dot material adjustment in the render loop, driven by dot Z-position relative to camera.
- **Vignette:** Subtle darkening at canvas edges. Implemented as a post-processing pass or a screen-space overlay plane. Enabled only on main app and gallery, not on article embeds.
- **Depth-of-field:** Deferred. Three.js r128 doesn't include post-processing passes on CDN. If needed, implement as a screen-space blur approximation.

---

## 10. Factory Extensions Required

Summarizing the new factory capabilities this architecture requires, in build priority order:

### 10.1 — Scene-Child Mode (Priority: High — blocks Gallery)

New factory method `createSceneChild()` that returns graphmap geometry without renderer/camera/canvas. The group is added to an external scene. Beat engine operates on group rotation.

### 10.2 — Beat Engine in Factory (Priority: High — blocks Gallery + Parallax cleanup)

Migrate the beat sequence logic from `prism-parallax.js` into the factory. Every instance gets `playBeats()` / `stopBeats()`. Scene-child instances get `playGroupBeats()`. The parallax file's orbit engine becomes a thin wrapper that calls factory beat methods.

### 10.3 — Floating Word Layer (Priority: Medium — blocks Parallax 3D completion)

New capability gate `floatingWords`. Sprite-based text rendering positioned at tag cluster centroids. Toggle board integration for brightness/recede.

### 10.4 — Scroll-Linked Lifecycle (Priority: Medium — blocks Parallelogram)

`IntersectionObserver` integration in the factory for `activateOnViewport` / `deactivateOnExit` lifecycle config. Threshold-based scroll progress exposed for inter-embed interpolation.

### 10.5 — Depth Atmosphere (Priority: Low — polish)

Per-dot depth fog, vignette overlay, configurable exposure per context.

---

## 11. Implementation Sequencing

The builds enabled by this architecture, in dependency order:

1. **Scene-child mode + gallery pedestals** — Extend factory with `createSceneChild()`. Wire two instances into gallery: public pedestal (readonly, looping beat breathe) and working pedestal (analytical). Validates Architecture B.

2. **Beat engine migration** — Move beat sequence from `prism-parallax.js` into factory. The parallax orbit engine calls factory methods. The gallery's beat breathe uses the same system. Validates shared choreography.

3. **Veil-lift transition** — Build the three-phase transition (dwell trigger → HTML fade → canvas expansion → camera pullback). Requires both Architecture A (main graphmap) and Architecture B (gallery) to be working. Highest product-identity impact.

4. **Floating word layer** — Add sprite-based word rendering as a factory capability. Wire to toggle board state. Completes the Parallax 3D vision.

5. **Parallelogram embeds** — Factory instances in `embed` mode with scroll-linked lifecycle. Graph-state markers parsed from article markdown. Entry settle beats. Diatribe scrub slider.

6. **Depth atmosphere** — Per-dot fog, vignette, exposure tuning. Polish pass across all contexts.

---

## 12. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Two renderer architectures (standalone vs. scene-child) | Gallery needs room-level scene graph; forcing all contexts into one model would over-complicate the common case or under-serve the gallery |
| 2 | Beat engine lives in factory, not in parallax file | Choreography is a graphmap capability, not a Parallax UI feature; gallery pedestal breathe uses the same system |
| 3 | Floating words as factory capability, not per-context | Any instance might need them (Parallax, gallery working pedestal, article embeds with showWordTags) |
| 4 | Veil-lift uses data sync, not geometry transfer | Simpler than transplanting Three.js objects between scenes; both instances read same PrismDB state |
| 5 | Gallery canvas always running behind flat app | Eliminates cold-start lag on veil-lift; the gallery is always there, the flat app is the scrim |
| 6 | IntersectionObserver for Parallelogram lifecycle | Standard, efficient, no scroll listener overhead; threshold array provides interpolation progress |
| 7 | Consistent camera FOV (36°) across standalone contexts | Same object should feel the same; gallery uses different FOV because it's a room, not a graphmap |
| 8 | Orbit expressed as yaw/pitch everywhere | Simple, consistent, works for both camera orbit and group rotation |
| 9 | Double-render window minimized during veil-lift | Performance constraint; standalone graphmap's rAF killed as soon as its canvas is invisible |
| 10 | Depth atmosphere as factory capability, not post-processing | r128 CDN doesn't include EffectComposer; per-dot material adjustment is simpler and more portable |

---

*— Prism 3D Animation Architecture v1 — March 13, 2026 —*  
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
