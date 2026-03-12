# Prism v50 — Dream Getty Ontology Handoff

## March 10, 2026

**Session type:** Conceptual / architectural — no code written  
**Predecessor:** `Prism_v50_Architecture_Resolution_Handoff.md` (earlier today)  
**Active files unchanged:** `index-v50.html`, `prism-graphmap.js`, `prism-gallery-v2.html`

**Drop-in for next session:** This handoff + v50 Architecture Resolution Handoff + `Prism_Diatribe_Aperture_Revision_v1.md` + `Prism_Architecture_Update_v1.md` + `Prism_Roadmap_v1_7.md`

---

## 1. The Dream Getty Is a Library

### The Core Decision

The Dream Getty is not a museum, not an atelier, not a contemplative viewing space. It is a **library** — the room where Prism's dialectical framework lives as a living collection.

The distinction is load-bearing. A museum displays finished objects. An atelier produces objects. A library **holds the framework from which objects are derived**. The dialectical parameters, the 26-pattern bad faith library, the scoring entries, the axis derivation protocols, the denomination grammar, the compilation documents — all of this is a *collection*. Maintained, indexed, consulted. Everything Prism shows users downstream is generated from what's on these shelves.

### What Lives in the Library

- The complete dialectical parameter set (📓e scoring library, bad faith patterns, axis derivation protocols)
- The denomination grammar and degradation rules
- The dual ledgers (formal and informal political capital) as physical objects
- The compilation documents (📓g and future versions)
- The working graphmap on a pedestal, wired to the Macintosh
- An old Macintosh computer serving as the admin portal
- The theological ground documents (📓b zero point, ⛪ F welcoming principle)

---

## 2. Two-Room Architecture

### The Library (Private)

The librarian's working space. This is where the editorial and dialectical work happens. Contains:

- **Working pedestal + graphmap projection:** The analytical graphmap, connected to the Macintosh. Used for testing, projecting, and crystallizing aggregate data before publication.
- **Old Macintosh:** The admin portal interface. Event cards are created here. Scoring happens here. The dialectical library is maintained from here.
- **Dual ledgers:** The formal and informal political capital ledgers rendered as physical objects. Aggregate user-generated data is logged here after users respond to event cards in Prism proper.
- **The stacks:** The dialectical collection — pattern libraries, scoring entries, compilation documents, case study working papers.

### The Gallery (Semi-Public)

The display space, adjacent to the library. Contains:

- **Public pedestal + graphmap:** The graphmap as finished sculpture, presented for contemplation. The landing graphmap is set editorially.
- **Book on easel:** An interactive selection interface for choosing which graphmap is displayed, with toggles. (Deferred to a later build phase.)
- **Avatar cluster:** The character objects floating in the dark void (per existing gallery screenshot).

### The Translucent Wall

The library and gallery share a wall. The wall is translucent — visitors in the gallery can *see* the library space, observe that there's a working environment, see the librarian's presence — but cannot enter or interact. This makes the editorial process legible without making it accessible. The authority is visible and bounded.

---

## 3. The Circulation Flow

The library holds the dialectical framework → that framework generates the event cards and response sets users encounter in Prism → users respond → aggregate data returns to the library and is logged on the dual ledgers → the librarian studies the aggregate against the collection → crystallizes findings on the working pedestal → publishes selected findings to the Parallelogram.

### Relationship to the Parallelogram: Manuscript to Printed Edition

The library is the living collection. The Parallelogram is where selected findings get published for readers. Not everything in the library becomes a Parallelogram article — that's editorial judgment, the librarian deciding what's ripe for publication. The 📓e case studies, the pattern library, the compilation documents are the stacks. The Parallelogram articles are what gets pulled from the stacks and formatted for an audience.

### Two Pedestals, Two Modes

| Pedestal | Location | Mode | Function |
|----------|----------|------|----------|
| Working | Library | Analytical | Wired to Macintosh, used for testing and crystallizing. The graphmap as work-in-progress. |
| Public | Gallery | Contemplative | The graphmap as finished sculpture. Landing state set editorially. Visitors view, not manipulate. |

Same object, different mode. One is being interrogated; the other is being presented.

---

## 4. Access Model: Invitation, Not Unlock

The Dream Getty exists whether or not anyone visits. The librarian is there working regardless. This is not a feature to be unlocked or a reward to be earned — it's a place that is already occupied.

### Beta Access

A direct button for beta testers (friends) to enter and see the space. Practical, ungated, explicit invitation.

### Future Access

The vision is that eventually users are invited to see the Dream Getty — to visit the gallery, to observe the library through the translucent wall. The invitation model means the space has gravity and presence before anyone arrives. Users arrive to a place, not a feature.

### What the Dream Getty Is NOT

- Not a user reward for engagement
- Not a mode the user unlocks through Prism usage
- Not a dashboard or analytics view
- Not accessible to the general public at launch
- Not a feature — it's a place

---

## 5. Graphmap Legibility at Scale

### Individual Dot Rendering (Below Threshold)

Each dot is a complete political object carrying four dimensions: X position, Y position, Z depth, and concentric Diatribe ring. Below the density threshold, every dot renders individually with its full ring.

### Logarithmic Clustering (Above Threshold)

Above threshold N, dots in proximity merge into density clusters:

- Cluster position = centroid of member dots
- Cluster ring = averaged Diatribe of members (shared halo)
- Hold-to-inspect on cluster could expand it temporarily, revealing individual members
- Clustering is logarithmic — the more dots, the more aggressively they merge

### Threshold

- Estimated tolerance: ~30–60 individual dots per quadrant before ring overlap creates illegibility (~50 full graph)
- Exact N to be determined through visual testing with synthetic data at various densities
- The threshold is a design parameter, not a hard constant — it may vary by device/screen size

### Parallax Toggle

Clustering is a **Parallax toggle**, not a permanent state. At low density (early beta, small user base), every individual dot should be visible — sparseness is part of the honesty. Clustering only kicks in when the data earns it.

---

## 6. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Dream Getty is a library, not a museum or atelier | The dialectical framework is a living collection to be maintained and consulted, not a finished display or a production space |
| 2 | Two-room architecture: library + gallery | Separates working space from display space while maintaining visible connection |
| 3 | Translucent wall between rooms | Makes editorial process legible without making it accessible; authority is visible and bounded |
| 4 | Old Macintosh as admin portal interface | Physical object metaphor for the editorial tools; the library has a terminal |
| 5 | Dual ledgers as physical objects in the library | Aggregate user data logged as material artifacts, not database views |
| 6 | Working pedestal in library, public pedestal in gallery | Same graphmap object in two modes: analytical (wired to Mac) and contemplative (sculpture) |
| 7 | Book on easel for graphmap selection (gallery) | Interactive but deferred to later build phase |
| 8 | Invitation access model, not unlock | The space exists independently of visitors; beta button for friends; eventual public invitation |
| 9 | Parallelogram = published edition from library stacks | Manuscript-to-print relationship; editorial judgment determines what gets published |
| 10 | Logarithmic clustering above ~50-dot threshold | Individual rendering below; averaged density halos above; threshold determined by visual testing |
| 11 | Clustering as Parallax toggle | Not permanent — sparseness at low density is honest; clustering earned by data volume |

---

## 7. What's Next

### Document Update Pass

All documents updated in one pass while decisions are fresh (carried forward from Architecture Resolution Handoff, now expanded):

| Document | Update Needed |
|----------|--------------|
| **Roadmap v1.8** | Add Dream Getty as library milestone, Parallelogram as editorial layer, graphmap factory refactor, Z slider separation, two-room architecture |
| **Spec v06** | Z slider three-job separation, Diatribe-graphmap relationship, toggle board function, Parallelogram triptych, dot-as-complete-object schema, Dream Getty library ontology, two-pedestal architecture |
| **Architecture Update v2** | `prism-graphmap.js` factory pattern, timeline mode, read-only mode, multiple-instance rendering, logarithmic clustering toggle |
| **Parallelogram Design Doc (new)** | Triptych layout, article graphmap specs, scrub slider behavior, cold start content strategy, editorial criteria, relationship to Dream Getty stacks |
| **Dream Getty Design Doc (new)** | Library ontology, two-room floor plan, translucent wall spec, Macintosh admin integration, dual ledger rendering, working vs. public pedestal, access model, gallery interaction design (book on easel) |

### Or: Case Studies

If the document update pass feels premature, the alternative is to proceed with case studies (Pretti/2A first) — working through them in chat before any admin portal entry, per established method. Case studies would stress-test the library ontology by generating content that the library should hold.

---

*— Prism v50 Dream Getty Ontology Handoff — March 10, 2026 —*  
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
