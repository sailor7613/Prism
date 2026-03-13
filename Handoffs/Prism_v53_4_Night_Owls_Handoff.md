# Prism v53.4 — Night Owls / Arc Authoring Handoff (March 13, 2026)

## Session type: Architecture + Schema Design (limited out before implementation)
## Active version: `index-v53.html`, `admin.html` (6,939 lines), `prismdb.js`

**Context:** This handoff reconstructs the "Night Owls" session (March 12–13, 2026) which hit the context limit before a handoff could be generated. It incorporates the v53.3 handoff (Parallelogram editor panel session, same night) as its foundation, then captures the new ground broken in the Night Owls session on arc authoring and subject definition.

---

## 1. What Was Resolved Before the Limit

### The Subject Definition Question

The session opened on **event arc authoring** — specifically, establishing the object and writing Z values for displaced subjects. The central question: how do we define subjects?

**The key insight:** Subjects aren't just abstract quadrant positions (A/B/C/D). For any given event, there are *actual people and groups* occupying those quadrants, and their relationship to the object is what produces the Z value. The `qz` score for quadrant C on Iran-Contra isn't just "bottom-left's temperature" — it's the specific experience of displaced Central Americans, anti-war activists, investigative journalists. The qz score for quadrant A on the same event isn't "top-right's temperature" — it's the experience of the covert operations apparatus, the National Security Council, the political class burning unauthorized capital.

**For the arc authoring form:** This means per-event Subject Z values need editorial context — who *is* the subject in each quadrant for this event? The admin form should capture:
- The qz numeric value (slider, -1 to +1)
- A subject label or description per quadrant per event (who specifically occupies this position)
- The relationship to the object (how this subject's expectations relate to the determining force)

### Object Z Reminder (from v53.1)

Object Z measures whether the determining force is winning. Positive = apparatus succeeding. Negative = apparatus constrained or defeated. The unified object for CS04 (immigration arc) is "The Empire" — U.S. institutional apparatus managing Latin American relations and resulting displacement.

**The tell sign of an object:** it's determining the event. If it's getting its way, its Z is positive.

### Arc Data: Currently Hardcoded, Needs Schema

The 20 arc events for CS04 are hardcoded in `index-v53.html` (~line 5320) as a JavaScript array. Each event carries `id`, `label`, `date`, `x`, `y`, `z` (Object Z), `dia`, `type`, and `qz: { A, B, C, D }`. The session was working toward pulling this into PrismDB as a proper data type so the admin portal can author and edit arcs.

---

## 2. Proposed PrismDB Schema Extension: `prism_arcs`

*(From the v53.3 handoff, confirmed in Night Owls as the right direction)*

```javascript
// New localStorage key: prism_arcs
{
  id: 'arc_cs04',
  title: 'Immigration Arc (1982–2026)',
  description: 'U.S. institutional management of Latin American displacement...',
  object: 'The Empire',           // The determining force
  objectDescription: 'U.S. institutional apparatus managing Latin American relations and displacement',
  events: [                       // Ordered array
    {
      id: 'e4.1',
      label: 'Iran-Contra / Didion / Webb',
      date: '1982',
      x: 0.7,
      y: 0.95,
      z: 0.85,                    // Object Z
      dia: 80,
      type: 'event',
      qz: {                      // Per-quadrant Subject Z
        A: 0.85,
        B: 0.40,
        C: -0.90,
        D: -0.60
      },
      subjects: {                 // NEW: who occupies each quadrant for this event
        A: '',                    // e.g. "Covert ops apparatus, NSC"
        B: '',                    // e.g. "Institutional Democrats, Cold War liberals"
        C: '',                    // e.g. "Displaced Central Americans, anti-war activists"
        D: ''                     // e.g. "Libertarian skeptics, fiscal conservatives"
      }
    },
    // ... remaining events in order
  ],
  linkedArticleId: null,          // Reference to Parallelogram article
  created: '...',
  updated: '...'
}
```

### PrismDB Methods Needed

- `PrismDB.getArcs()` — returns all arcs
- `PrismDB.getArc(id)` — returns single arc
- `PrismDB.saveArc(arc)` — create or update
- `PrismDB.deleteArc(id)` — remove an arc
- Seed function should populate CS04 from the current hardcoded data in index-v53.html

---

## 3. What Was Built in the Sessions Leading Up to Night Owls (Same Night)

### v53.2 Session: Boundary Planes + Keywords (git committed)
- Z boundary planes with translucent quads at ±Z_EXTENT
- Boundary labels ("Winner" / "Loser")
- Boundary photos (Didion at -Z, Meese at +Z for e4.1; Rubio at -Z, Boehner at +Z for e4.5)
- Keyword sprites around subject orbs
- All committed as `v53.2: Z boundary planes, keyword sprites, embedded photos`

### v53.3 Session: Parallelogram Editor Panel in Admin Portal
Built and delivered:
- **✦ Parallelogram toolbar button** in admin portal
- **Parallelogram editor panel** with two modes:
  - Article mode: markdown editor, live preview, graph-state waypoint toolbar
  - Refinement mode: per-event Z value editor, keyword editor, boundary content editor
- **Article list**: browse/edit existing Parallelogram articles
- **Editorial Desk**: AI chat drawer (separate from Dialectics drawer) with `PARA_DESK_SYSTEM` prompt for article drafting
- Articles stored in `prism_parallelogram_articles` localStorage key
- Refinement data stored in `prism_refine_{eventId}` localStorage keys
- Conversation is ephemeral — resets on article switch (intentional: prose is the artifact, not the conversation)

---

## 4. Architecture Notes

- **Parallelogram articles are localStorage** (`prism_parallelogram_articles` key), separate from PrismDB events. Articles reference events but don't live inside them.
- **Refinement data is localStorage** (`prism_refine_{eventId}` keys), per-event. Interim storage for Z/keyword/boundary values.
- **Editorial Desk conversation is ephemeral** — resets on article switch. The prose is the artifact, not the conversation.
- **The J encoding is embedded twice** in admin.html: once in `CHAT_SYSTEM_PROMPT` (Dialectics drawer) and once extended in `PARA_DESK_SYSTEM` (Editorial Desk). The desk version appends editorial context instructions. Both share the same ~47k-char J encoding base.
- **API key field** is shared — both drawers read from `#aiApiKey` in the event creation form.
- **The PARA_DESK_SYSTEM prompt** is at approximately line 6513 in admin.html.

---

## 5. What Night Owls Was Working Toward (Interrupted)

The session was examining the actual files (`admin.html`, `prismdb.js`, `index-v53.html`) to plan the arc authoring implementation. Specifically:

1. **PrismDB current schema** — reviewing the KEYS structure and existing methods (~line 1-50, 860-895 of prismdb.js)
2. **Seed event data shape** — reviewing current event structure in prismdb.js (~line 186-280)
3. **Hardcoded arc data** — locating `arcEvents` in index-v53.html (~line 5320+) to extract into PrismDB
4. **PARA_DESK_SYSTEM prompt** — examining the editorial desk prompt in admin.html (~line 6513) to understand how arc data could be passed to the AI for article drafting
5. **Arc authoring form design** — the admin UI for creating/editing arcs (container + ordered event list + per-event editors)

### Session Plan (from v53.3 handoff, confirmed in Night Owls)

1. Extend PrismDB schema for arc data type
2. Build arc authoring form (container + ordered event list + per-event editors)
3. Wire save/load/edit for arcs
4. Seed CS04 arc as structured data (pull from the index hardcode)
5. Link arc data to Parallelogram article (so the editorial desk can reference structured parameters)

---

## 6. Files to Drop Into Next Session

| File | Why |
|------|-----|
| **This handoff** | Arc authoring spec + reconstructed session context |
| `admin.html` | Current admin portal (6,939 lines) — includes Parallelogram editor from v53.3 |
| `prismdb.js` | Shared data layer — needs schema extension for arcs |
| `index-v53.html` | Reference for hardcoded arc data model (~line 5320) |
| `prism-graphmap.js` | Boundary + keyword API reference |

---

## 7. Key Concepts to Carry Forward

- **Subjects are people, not positions**: qz values represent the experience of actual groups, not abstract quadrant temperatures. The authoring form should capture *who* occupies each quadrant per event.
- **Object Z measures whether the determining force is winning** — positive = apparatus succeeding, negative = constrained/defeated
- **The tell sign of an object**: it's determining the event. If it's getting its way, its Z is positive.
- **Arc as container**: an arc is a temporally ordered sequence of events with a unified determining object. The arc carries the object definition; the events carry the per-quadrant subject experiences.
- **CS04 is the first arc to structure**: 20 events, 1982–2026, "The Empire" as unified object. All qz values are 80-85% accurate per Sailor — admin portal enables refinement.
- **Three storage layers in admin**: PrismDB events (shared), Parallelogram articles (localStorage, separate), refinement data (localStorage, per-event). Arcs are a new PrismDB entity.

---

## 8. Current File State Summary

| File | Lines | Status |
|------|-------|--------|
| `index-v53.html` | ~4,750 | v53.2 changes committed to git; all 20 arc events with Object Z + qz values |
| `admin.html` | 6,939 | v53.3 Parallelogram editor panel shipped; Editorial Desk wired |
| `prismdb.js` | ~895 | Needs arc schema extension |
| `prism-graphmap.js` | ~253+ | Updated with boundary planes, keyword sprites, boundary photos |

---

*— Prism v53.4 Night Owls Handoff (Reconstructed) — March 13, 2026 —*
*— Reconstructed by Claude from conversation history — Project: Western Diametrica — Prism —*
