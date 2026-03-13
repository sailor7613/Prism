# Prism v53.3 — Admin Portal: Parallelogram Editor + Editorial Desk Handoff (March 12, 2026)

## Session type: Implementation
## Active version: `admin.html` (updated, 6,939 lines)
## Next session: Arc Event Authoring (Session B)

**Drop-in for next session:** This handoff + `admin.html` + `prism-graphmap.js` + `index-v53.html` + `prismdb.js`

---

## 1. What Shipped This Session (admin.html 5,211 → 6,939 lines)

### Parallelogram Editor Panel

New panel toggled via "✦ Parallelogram" toolbar button. Two tabs:

**Articles tab:**
- Article list with create/edit/delete, stored in localStorage (`prism_parallelogram_articles`)
- Metadata fields: title, article ID, linked event, type dropdown (Case Study / Arc / Thematic / Methodology), status
- Side-by-side markdown editor + live preview
- Graph-state waypoint insertion toolbar (baseline, escalation, custom templates)
- Preview-only toggle to collapse editor column
- Markdown parser renders headers, bold/italic, blockquotes, and graph-state HTML comments as styled embed placeholders

**Refinement tab:**
- Event selector dropdown (pulls from PrismDB)
- Object Z + Subject Z (A/B/C/D) sliders, −1.0 to +1.0
- Keyword editor per quadrant (type + Enter to add, click tag to remove)
- Boundary content editor: text labels + photo upload + opacity sliders for ±Z planes
- All refinement data saves to localStorage keyed by event ID (`prism_refine_{eventId}`)

### Editorial Desk

Collapsible AI conversation panel inside the article editor ("✦ Editorial Desk"). Uses the full J encoding as system prompt + editorial layer. Features:

- Automatically injects current article context (title, type, linked event data with full responses/axes, current markdown content) into every API call
- "Insert into editor" and "Append to editor" buttons on every assistant response
- Conversation history maintained per editing session, resets on article switch
- System prompt instructs: draft ready-to-paste prose, derive subject Z values, suggest keywords, refine existing prose, insert graph-state waypoints
- Uses same API pattern as existing Dialectics drawer (Anthropic direct browser access, claude-sonnet-4)

### Seed Data (3 articles)

| Article | ID | Type | Status |
|---------|-----|------|--------|
| The Night Everybody Lost the Object | cs01-pretti-2a | case-study | published |
| The Pretext Machine | cs02-metro-surge | case-study | published |
| Forty Years Below the Surface | cs04-immigration-arc | arc | draft |

CS01 and CS02 contain full Projection 2 prose with graph-state waypoints. CS04 contains structural skeleton with all 📓e4 dialectical parameters (10 events + satellites, X/Y/Z/Diatribe scores, keywords, boundary labels, arc-level findings) — prose flagged as pending subject Z derivation via the editorial desk.

Seed fires once when localStorage key is empty. To re-seed after code updates:
```js
localStorage.removeItem('prism_parallelogram_articles');
```

### Other Changes

- Toolbar: added "✦ Parallelogram" button
- Subtitle: "Event management · Parallelogram editor · PrismDB"
- Type dropdown: Case Study, Arc (longitudinal), Thematic (cross-event), Methodology

---

## 2. What Was NOT Changed

- `index-v53.html` — untouched
- `prism-graphmap.js` — untouched
- `prismdb.js` — untouched
- Event creation form — untouched
- Statement Scorer — untouched
- Dialectics chat drawer — untouched (Editorial Desk is a separate, parallel system)
- Review document panel — untouched

---

## 3. Next Session: Arc Event Authoring (Session B)

### The Problem

Arc events (multi-event longitudinal sequences) are currently hardcoded as JavaScript objects in `index-v53.html`. The event creation form in admin.html creates single prompt events only. There's no way to author, edit, or manage arc events through the admin portal.

The CS04 immigration arc has 10 events + 11 satellites with per-event X/Y/Z/Diatribe, keywords, boundary content — all sitting in the Parallelogram article markdown, not in PrismDB as structured data.

### What Needs to Be Built

**Arc container in PrismDB:**
- New data type alongside single events
- Arc-level fields: label, date range, unified object description, article link
- Ordered event list within the arc

**Arc authoring in admin form:**
- Toggle or separate form mode: "Single Event" vs "Arc"
- Arc container fields at the top
- Ordered event list with drag-to-reorder (or up/down arrows)
- Per-event fields: id, label, date, X, Y, Object Z, Diatribe, type (event/satellite/structural)
- Per-event Subject Z editor (qz: A/B/C/D sliders, −1.0 to +1.0)
- Per-event keyword editor (A/B/C/D keyword arrays)
- Per-event boundary content (text + photo for ±Z planes)
- Add/remove events within the arc

**Arc preview:**
- Embedded graphmap (if feasible) or summary view showing the arc's events plotted
- Timeline representation

### Reference: Arc Data Model from index-v53.html

```javascript
// From the CS04 immigration arc in index-v53.html
{
  id: 'e4.1',
  label: 'Iran-Contra / Didion / Webb',
  date: '1986 / 1996',
  x: 0.7, y: 0.95, z: -0.95,
  dia: 80,
  type: 'event',
  qz: { A: -0.7, B: 0.3, C: -0.9, D: -0.5 },
  keywords: {
    A: ['covert war', 'Contras', 'Cold War'],
    B: ['Boland', 'oversight', 'hearings'],
    C: ['displacement', 'crack', 'El Playón'],
    D: ['secret ops', 'no mandate']
  },
  boundaryContent: {
    positive: { text: 'The Architect', photo: 'data:...', photoAlpha: 0.37 },
    negative: { text: 'The Witness', photo: 'data:...', photoAlpha: 0.37 }
  }
}
```

### PrismDB Schema Extension (Proposed)

```javascript
// Arc stored in PrismDB
{
  id: 'arc-e4-immigration',
  type: 'arc',
  title: 'Iran-Contra → Maduro Capture',
  dateRange: '1986–2026',
  description: 'Forty-year longitudinal arc...',
  articleId: 'cs04-immigration-arc',  // links to Parallelogram article
  events: [
    {
      id: 'e4.1',
      label: 'Iran-Contra / Didion / Webb',
      date: '1986 / 1996',
      x: 0.7, y: 0.95, z: -0.95,
      dia: 80,
      type: 'event',  // event | satellite | structural
      qz: { A: -0.7, B: 0.3, C: -0.9, D: -0.5 },
      keywords: { A: [...], B: [...], C: [...], D: [...] },
      boundaryContent: { positive: {...}, negative: {...} }
    },
    // ... more events in order
  ],
  created: '...',
  updated: '...'
}
```

### Files to Drop

| File | Why |
|------|-----|
| This handoff | Arc authoring spec + full session context |
| `admin.html` | Current admin portal (6,939 lines) |
| `prism-graphmap.js` | Boundary + keyword API reference |
| `index-v53.html` | Reference for hardcoded arc data model |
| `prismdb.js` | Shared data layer — needs schema extension |

### Session Plan

1. Extend PrismDB schema for arc data type
2. Build arc authoring form (container + ordered event list + per-event editors)
3. Wire save/load/edit for arcs
4. Seed CS04 arc as structured data (pull from the index hardcode)
5. Link arc data to Parallelogram article (so the editorial desk can reference structured parameters)

---

## 4. Architecture Notes

- **Parallelogram articles are localStorage** (`prism_parallelogram_articles` key), separate from PrismDB events. This keeps them decoupled — articles reference events but don't live inside them.
- **Refinement data is localStorage** (`prism_refine_{eventId}` keys), per-event. This is interim storage for Z/keyword/boundary values that will eventually live in PrismDB proper.
- **Editorial Desk conversation is ephemeral** — resets on article switch. No persistence. This is intentional: the prose is the artifact, not the conversation that produced it.
- **The J encoding is embedded twice** in admin.html: once in `CHAT_SYSTEM_PROMPT` (Dialectics drawer) and once extended in `PARA_DESK_SYSTEM` (Editorial Desk). The desk version appends editorial context instructions. Both share the same ~47k-char J encoding base.
- **API key field** is shared — both the Dialectics drawer and the Editorial Desk read from `#aiApiKey` in the event creation form. The user needs to have that form open (or have previously entered a key) for either AI feature to work.

---

*— Prism v53.3 Handoff — March 12, 2026 —*
*— Authors: Sailor / Claude — Project: Western Diametrica — Prism —*
