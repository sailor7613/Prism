# Session L Handoff — Parallelogram Tab Build

**Date:** March 16, 2026 (evening session)
**Files modified:** `admin.html`, `prismdb.js`
**Session length:** ~6 hours across multiple tool use limits

---

## What Happened

### 1. Fixed bricked admin portal
The previous session (K) built arc management functions across 3 tool use limits and accidentally pasted the arc function block three times. Three `let currentArcEditId = null;` declarations in the same `<script>` block caused a SyntaxError that killed every function in admin.html. Fix: deleted two duplicate blocks (~490 lines), kept the most polished version (V2) with `arcToggleStatus`, unified `showArcForm(id)`, and index-based `arcMoveEvent`.

### 2. Built the Parallelogram tab
Complete restructure of `tabParaContent`. What was a flat arc list is now a full editorial workspace:

**Sub-navigation:** Arcs and Articles as peer views within the Parallelogram tab.

**Arcs view:** Arc list with cards (title, object, status badge, event count, edit/delete/open in editor). Arc creation form with Subject Type field (Actor/Policy/Pattern). "Begin Brainstorm →" button on saved arcs.

**Brainstorm panel:** Two-column layout — research conversation with Claude (left) and growing event string (right). Wired to Anthropic API with a dedicated system prompt that instructs Claude to think dialectically and present event candidates as **Title** (Date). Each candidate gets a "✓ confirm" button that drops it into the event string. Manual add also available. "Begin Editorial →" creates PrismDB events from confirmed brainstorm events, links them to the arc, and opens the editor.

**Articles view:** Article list with create/delete. Proper creation form with title field, checkbox list for importing Prism events, and optional arc tag dropdown for probationary tagging.

**Editor (contextual):** Not a separate tab — appears contextually when you open an arc or article, replacing the list view with a "← Back" button. Three-column layout:
- **Outline rail** (left): Auto-populated from arc events with intro/bridge/closing sections. ◆ Derive button, Refinement stub, + New Event stub.
- **Manuscript** (center): Markdown textarea with formatting toolbar (B, I, H1, H2, ¶, waypoint insertion), preview toggle, auto-save to localStorage.
- **Editorial desk** (right): Chat conversation with Claude, wired to Anthropic API. Sends arc/article context + current manuscript content. "→ insert to manuscript" button converts Claude's formatted response back to markdown and inserts at cursor.

### 3. Wired three API integrations
- **Brainstorm research conversation** — `BRAINSTORM_SYSTEM_PROMPT` with arc context injection, conversation history, candidate parsing with confirm buttons
- **Editorial desk** — `EDITORIAL_DESK_SYSTEM_PROMPT` with manuscript context (truncated at 3000 chars), conversation history
- **◆ Derive pipeline** — `DERIVE_SYSTEM_PROMPT` extracts structured JSON (keywords per quadrant with weights, Object Z, per-quadrant Subject Z, axis-load phrases). Writes results back to PrismDB on all linked events.

### 4. Dark mode
CSS custom properties with `[data-theme="dark"]` override. Toggle button in header (`◐ dark`/`◐ light`), persists via localStorage.

### 5. API key improvements
API key field added to Parallelogram tab. Both key fields (Events and Parallelogram) sync bidirectionally via `syncApiKeys()`. All API call sites use `getApiKey()` which checks both fields.

### 6. Bug fixes
- `prismdb.js`: defensive `eventIds` initialization in `addEventToArc` — handles arcs created without the array
- Brainstorm confirm buttons: quotes in titles no longer break onclick attributes. Candidate data stored on `window._bsCandidates` by safe ID.
- `beginEditorial`: idempotency protection — button disables and shows "Creating events..." to prevent double-fire
- Toast positioning: moved from `bottom: 24px` to `bottom: 60px` to clear the Dialectics drawer bar
- `insertFromDesk`: properly converts HTML formatting (bold, italic, br) back to markdown when inserting

---

## Current File State

- `admin.html` — ~7,394 lines. Single `<script>` block, no duplicate declarations.
- `prismdb.js` — ~1,048 lines. Arc CRUD with defensive initialization. No changes beyond the one-line `eventIds` fix.

---

## Cleanup Needed Before Tomorrow

**Delete duplicate events:** evt_007 through evt_011 (five copies of "Force the Vote" Campaign Launch created by a double-fire of Begin Editorial during testing). Delete from Events tab.

**Git commit:**
```
cd "/Volumes/EP3_B/PARALLELOGRAM PRISM/Code" && git add -A && git commit -m "Session L: Parallelogram tab build — brainstorm, editor, derive, dark mode"
```

---

## What's Still Stubbed

- **Refinement view** button in editor outline (toast placeholder)
- **+ New Event** button in editor outline (toast placeholder — should open a Parallelogram-specific event creator)
- **Old Parallelogram Editor** (Article Mode, Refinement Mode with Z sliders, provenance tags) still lives in Events tab area — could be migrated to the new editor or deprecated

---

## Architecture Decisions Made This Session

1. **Editor is contextual, not a tab.** It replaces the current arcs/articles view when you open a document, with a back button to return. This was a mid-session correction.

2. **Arc lifecycle has three phases:** Create (name + subject type) → Brainstorm (research conversation builds event string) → Editorial (three-column editor). The brainstorm output becomes the outline rail skeleton.

3. **Event Articles vs Event Arcs:** Arcs are retrospective, authored from scratch through brainstorm. Articles are contemporaneous, importing existing Prism events. An article's event can be tagged into an arc as probationary — the connection flows through the article process, not by dragging raw events into arcs.

4. **Manuscript is the source of truth for derivation.** Both user prose and AI drafts live together. Provenance is tracked at the block level (planned, not yet implemented). Derive processes the whole manuscript.

5. **Brainstorm candidates use safe ID lookup** instead of escaping titles into onclick attributes — more robust for titles with quotes, special characters.

---

## Pending Work (unchanged from Session K)

- Control panel cleanup pass (stale 2D-era controls)
- Z-cluster centroid stops in orbit sequence
- Veil-lift transition (Dream Getty)
- Desktop app (Tauri, frameless window)
- Production backend (Phase 3.5): Supabase, Cloudflare Worker, Vercel
- ProPublica API integration (Refraction panel)

---

## Standing Reminders

- **Session hygiene:** admin.html is now ~7.4K lines — use bash/sed for targeted reads
- **Pre-session git ritual:** `cd "/Volumes/EP3_B/PARALLELOGRAM PRISM/Code" && git add -A && git commit -m "pre-session snapshot"`
- **Project knowledge is stale:** `admin.html` in project knowledge predates this entire session. `prism-graphmap.js` is outdated. `index-v53.html` is outdated (current is v56).
- **Both prismdb.js AND admin.html must be on drive** — they're a matched pair now. admin.html calls `PrismDB.getArcEvents()` and other arc methods that only exist in the updated prismdb.js.
