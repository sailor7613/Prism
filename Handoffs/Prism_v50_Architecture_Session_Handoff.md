# Prism v50 — Architecture Resolution Handoff

## March 10, 2026

**Session type:** Conceptual / architectural — no code written  
**Predecessor:** `Prism_v50_Gallery_Graphmap_Handoff.md` (earlier today)  
**Active files unchanged:** `index-v50.html`, `prism-graphmap.js`, `prism-gallery-v2.html`

**Drop-in for next session:** This handoff + the v50 Gallery & Graphmap Handoff + `Prism_Diatribe_Aperture_Revision_v1.md` + `Prism_Architecture_Update_v1.md` + `Prism_Roadmap_v1_7.md`

---

## 1. Z Slider — Fully Disambiguated

The v50 handoff identified three concepts sharing one control. This session separated them cleanly:

### Job 1: Viewing Angle (Rotation)
- **What it is:** Rotating the graphmap to see it as a dimensional object.
- **Gesture:** Direct manipulation — click-drag on the graphmap itself.
- **Initial tilt:** Graphmap mounts at 10–15° rotation as an invitation to touch. Communicates dimensionality without requiring user action.
- **Scope:** Purely presentational. No data written, no data changed.
- **Applies to:** 3D graphmap only. The old CSS `rotateY` turntable on `#q3dWrap` is superseded.

### Job 2: User Z Input ("Back / Over")
- **What it is:** The user's perceptual read on whether their position has institutional momentum.
- **Gesture:** Slider in the response flow — after the user selects a quadrant card, Prism asks "how's it going?"
- **Scope:** Data input. Writes User Z value. Quadrant-relative, volatile, event-specific.
- **Where it lives:** Response phase of the main Prism flow. NOT in Parallax.
- **Design language:** Back/over — the native language of political affect online.

### Job 3: Object Z Display (Promise-Delivery Depth)
- **What it is:** The scored institutional promise-delivery gap rendered as the third dimension of the graphmap.
- **Gesture:** None — this is data displayed as geometry. Dots sit at different depths on the graphmap plane based on their Object Z score.
- **Scope:** Data display in Parallax. Read-only. The user sees it by rotating the graphmap (Job 1).
- **Three bands visible as depth:** 0–.33 shallow (discursive only), .34–.66 mid (institutional traction), .67–1.00 deep (full translation).

### The Earned Reveal (Preserved)
The original design's insight — that the 3D rotation is *earned by the gap* — survives as an animation, not a slider position. When the system detects a significant divergence between a user's User Z (back/over) and the Object Z for their quadrant, the graphmap gently self-rotates to reveal the depth dimension. The mirror moment happens *to* the user, unprompted.

**Key principle:** Rotation and depth are separate. The user never accidentally expresses a political opinion by spinning the sculpture.

---

## 2. Diatribe-to-Graphmap Relationship — Defined

### Core Decision
The Diatribe aperture is the **perceptual lens** on the aggregate graphmap. It does not filter data out of existence — it determines which layer of the aggregate the user is viewing.

### How It Works
- User sets Diatribe aperture before engaging with responses (per the Aperture Revision).
- Binary threshold at 0.50: good-faith band below, bad-faith band above.
- In Parallax, the graphmap shows the aggregate — all users' positions rendered as dots with depth.
- The **toggle board** controls which aperture band is visible on the graphmap:
  - Good-faith only: dots from users who set Diatribe below 0.50
  - Bad-faith only: dots from users who set Diatribe above 0.50
  - Both: full aggregate field
  - By quadrant + aperture: e.g., "Auth-Right good-faith seers" vs. "Lib-Left bad-faith seers"

### Visual Coexistence
The Diatribe rings and the graphmap can coexist visually as a combined object (confirmed by gallery screenshot showing graphmap as vertical plane with diatribe arc at its base). The aggregate asterisk rings show collective Diatribe distribution; individual dots carry their own concentric rings. A legibility toggle lets the user view them separately or together. The combined view is the *real* view — separated is training wheels.

---

## 3. Toggle Board — Core Function Identified

The Parallax toggle board is **not** a scatter/heat mode switcher. Its core function is **editorial curation of which relationships are visible** on the combined Diatribe+Graphmap object.

### Architecture
- The graphmap is the substrate holding all relationships.
- Every dot is a complete political object: X position, Y position, Z depth, Diatribe aperture ring.
- All relationships are wirable — every combination is theoretically renderable.
- Showing everything at once is noise. The toggle board selects which dimensions are visible.

### Candidate Toggles (for beta curation)
- Show/hide aggregate Diatribe rings
- Show/hide individual dot rings (concentric at each dot)
- Filter by aperture band (good-faith / bad-faith / both)
- Filter by quadrant
- Show/hide Z depth dimension
- Aperture gap overlay (distance between a user's ring and the aggregate ring)

Beta ships with 3–4 of the most revealing combinations, not every permutation.

---

## 4. Dots as Complete Political Objects

Each dot on the graphmap carries four dimensions rendered as geometry:

| Dimension | Encoding | Visual |
|-----------|----------|--------|
| X (economic) | Horizontal position on graph plane | Left–right placement |
| Y (institutional) | Vertical position on graph plane | Up–down placement |
| Z (promise-delivery) | Depth from graph surface | Distance into/out of plane |
| Diatribe (aperture) | Concentric ring at dot | Ring size/color around dot |

### Hold-to-Inspect
Long press on any dot reveals a tooltip/overlay displaying all four axis values. Consistent with direct manipulation philosophy — you touch the object, the object tells you about itself.

---

## 5. Parallelogram — Defined as Editorial Layer

### What It Is
The Parallelogram is Prism's **published analysis layer** — its editorial voice. Not a comparison view. Not a dashboard. A place where dialectical case studies and event arc analyses are published as readable, interactive articles.

### Entry Gesture
Hold the Prism nav tool (center of screen) for 4 seconds → ripple transition → Parallelogram. The hold earns the mode shift. A mirrored nav tool signals the user they've left Prism's response environment.

### Triptych Layout

| Panel | Function | Status |
|-------|----------|--------|
| **Left (or right)** | User panel — pin Parallelograms, pin graphmaps, calibrate personal Parallax | Named, deferred |
| **Center** | Article space — published case studies and event arc analyses | Core feature |
| **Right (or left)** | Query interface — user inputs events and asks questions through Prism's schema | Blank for v1, target for v2 |

### Center Panel: Article Graphmaps with Scrub Slider
- Each case study (📓e series) contains multiple events in sequence.
- After each event's text, an embedded graphmap renders the event's aggregate in summary.
- A **scrub slider** beneath the graphmap lets the user slide backward through previous events in the case study, watching the displacement pin trace its path through political space over time.
- Example: User reads the 4th event in Pretti/2A case study. Graphmap shows event 4 aggregate. User scrubs back through events 3, 2, 1, watching how the political object moved.

### Cold Start Solution
The 📓e case studies (Pretti/2A, Metro Surge, housing affordability, Rubio/Iran, Israel TBD) solve the cold application problem. New users arrive to a library of deeply worked analytical content that teaches them how Prism thinks, even before aggregate user data exists.

### Ongoing Editorial Pulse
Not every event gets a Parallelogram article. Events that warrant deeper investigation — event arcs, dialectical inflection points, cases where the parameters reveal something structurally interesting — get published. This is editorial judgment, not automation.

---

## 6. `prism-graphmap.js` — Required Refactors

The Parallelogram's needs and the Parallax architecture together require three additions to the graphmap module:

### 6.1 Factory Pattern
Current: `PrismGraphmap` is a singleton (one scene, one renderer, one camera).  
Required: `PrismGraphmap.create(container)` returns independent instances. Each instance owns its own renderer, pin state, ring data. The triptych center panel may embed multiple graphmaps in a single article. Parallax needs one instance. The Parallelogram needs N instances (one per event in a case study, or a single instance that swaps data on scrub).

### 6.2 Timeline Mode
For the Parallelogram scrub slider. The graphmap accepts an array of pin positions (one per event in a case study sequence) and interpolates between them as the user scrubs. The displacement pin traces a path through X/Y/Z space.

### 6.3 Read-Only Mode
Parallelogram article graphmaps are controlled by the article, not by the user. No direct rotation manipulation. The article's editorial framing determines the viewing angle. May still allow hold-to-inspect on dots.

---

## 7. Dreampolitik Note

Didion's "Notes Towards a Dreampolitik" — the invisible city whose residents' political existence doesn't register on the visible ledger — maps onto what the Diatribe instruments. The aperture measures how users are *seeing*, not where they *are*. The Dream Getty as literal dreamspace where the graphmap lives as contemplative object (not analytical tool) is the Dreampolitik made architectural. The gallery isn't a dashboard. It's where the political sculpture lives when it's not being interrogated.

---

## 8. What's Next

### Immediate: Dream Getty Session (New Chat)
- When does the user reach the Dream Getty?
- What is it in the user flow — reward, deliberate mode, home of the graphmap?
- Relationship to the Parallelogram (both are "beyond Prism" spaces)
- Graphmap legibility at scale (density ceiling for dots with concentric rings)

### After Getty Resolution: Document Update Pass
All documents updated in one pass while decisions are fresh:

| Document | Update Needed |
|----------|--------------|
| **Roadmap v1.8** | Add Dream Getty milestone, Parallelogram as editorial layer, graphmap factory refactor, Z slider separation |
| **Spec v06** | Z slider three-job separation, Diatribe-graphmap relationship, toggle board function, Parallelogram triptych architecture, dot-as-complete-object schema |
| **Architecture Update v2** | `prism-graphmap.js` factory pattern, timeline mode, read-only mode, multiple-instance rendering strategy |
| **Parallelogram Design Doc (new)** | Triptych layout, article graphmap specs, scrub slider behavior, cold start content strategy, editorial criteria for publication |

---

## 9. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Z slider is User Z input only | Separates data input from viewing gesture and data display |
| 2 | Graphmap rotation via direct manipulation | Touch the object to turn it — consistent with physical object metaphor |
| 3 | Initial 10–15° tilt on graphmap mount | Invites touch, communicates dimensionality |
| 4 | Earned reveal preserved as system animation | Gap between User Z and Object Z triggers self-rotation, not slider-driven |
| 5 | Diatribe aperture is perceptual lens on aggregate | Toggle board controls which aperture band is visible |
| 6 | Toggle board = editorial curation of visible relationships | Not a mode switcher — selects which dimensions of the combined object are shown |
| 7 | Diatribe rings + graphmap coexist visually | Combined view is the real view; separated is legibility fallback |
| 8 | Dots are complete political objects (X, Y, Z, Diatribe ring) | Concentric rings at each dot, hold-to-inspect reveals all four values |
| 9 | Parallelogram is Prism's editorial/publication layer | Triptych: user panel, article center, query panel (v2) |
| 10 | Article graphmaps with scrub slider | Temporal instrument embedded in text — user scrubs through event sequence |
| 11 | 📓e case studies solve cold start | Published content teaches Prism's analytical framework to new users |
| 12 | `prism-graphmap.js` needs factory, timeline, read-only modes | Required by Parallelogram and multi-instance Parallax |
| 13 | Dreampolitik as design philosophy | Didion's invisible city maps onto Diatribe's perceptual instrumentation |

---

*— Prism v50 Architecture Resolution Handoff — March 10, 2026 —*  
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
