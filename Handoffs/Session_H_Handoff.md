# Session H Handoff — March 15, 2026

## Session Summary

Vocabulary rename across the entire encoding layer: **good faith / bad faith → fluid / denominated**. All three code files renamed, tested, committed. Additionally discovered and resolved a version mismatch between `index-v53.html` (monolithic, outdated) and `index-v55.html` (modularized, forward version). Applied the rename to v55 and output as `index-v56.html`.

---

## Deliverables

### 1. Vocabulary Rename — Encoding Layer

**Decision:** "Bad faith" is itself a denomination — it collapses structural complexity into a moral verdict. The encoding shouldn't do the thing it diagnoses.

**Two-layer register established:**
- **Encoding layer** (code, J encoding, system prompt, JSON keys): uses **fluid / denominated** — describes structural conditions
- **Editorial layer** (Parallelogram articles, reader-facing content): keeps **good faith / bad faith** as interpretive vocabulary that readers arrive at through watching structural analysis unfold

**Physical intuition:** Fluid positions flow; denominated positions have solidified. Diatribe score measures the viscosity gradient between them.

### 2. Files Renamed

**prismdb.js** (972 lines) — 102 replacements
- `goodFaith` → `fluid`, `badFaith` → `denominated` (identifiers, schema keys, display strings)
- `faith: 'good'` → `faith: 'fluid'`, `faith: 'bad'` → `faith: 'denominated'` (6 seed events × 4 descriptors)
- `LG/LB/RG/RB` → `LF/LD/RF/RD` (diatribe descriptor keys)

**admin.html** (5,211 lines) — 124 replacements, 1 deliberate retention
- CSS classes, HTML IDs, form fields, data attributes, BANDS constant
- `diaSides` object keys, `forEach` arrays, JSON output shapes (both system prompts)
- Scorer system prompt, PRISM_SYSTEM_PROMPT (derive pipeline), chat system prompt (embedded J encoding v0)
- Pattern library names (#1, #2, #4, #6, #17), calibration anchors, epistemological ground
- Framing principle rewritten: encoding layer uses fluid/denominated; editorial layer uses good faith/bad faith
- **Deliberate retention:** Line 4446 — framing principle establishing the two-layer register

**index-v56.html** (3,471 lines, renamed from v55) — ~43 replacements, 5 deliberate retentions
- Band state variables, determination function, display labels, `getDiaLabel()` returns
- Hardcoded CS04 event data (all object keys in response cards)
- Diatribe descriptor key selection (`LG/LB/RG/RB` → `LF/LD/RF/RD`)
- Graph-state markers (`bilateral-bad-faith` → `bilateral-denominated`)
- Code comments
- **Deliberate retentions** (editorial prose, kept per two-layer register):
  - Line 98: "your running record of good faith" (UI onboarding text)
  - Line 1098: "good-faith and bad-faith variants" (CS04 article)
  - Line 1187: "Pure good faith" (Gary Webb passage)
  - Line 1299: "shared bad faith" (bilateral mirror passage)
  - Line 1486: "Pattern #16 from the bad faith library" (CS04 article)

**External files — no changes needed:**
- `prism-styles.css` — 0 references
- `prism-splash.js` — 0 references
- `prism-parallax.js` — 0 references
- `prism-graphmap.js` — 0 references (was already clean)

### 3. Derive Pipeline Validated

- Ran AI Derive in admin portal with new system prompt
- Console check: `aiLastDraft.diatribe` returns `["LF","LD","RF","RD"]`
- Console check: `aiLastDraft.quadrantResponses.A` returns `["xSide", "fluid", "coalition", "denominated"]`
- Full round-trip confirmed: system prompt produces new shape → frontend parses correctly

### 4. Main App Validated

- Loaded `index-v56.html` in Chrome
- Required `localStorage.removeItem('prism_events')` + `PrismDB.seed()` to clear stale cached data
- Diatribe slider correctly shows: FLUID · NOMINAL → COALITION · COALITIONAL → DENOMINATED · CONVICTION
- Response cards switch between bands correctly

---

## Version Discovery

**v53 vs v55 mismatch:** The project knowledge file was `index-v53.html` (7,514 lines, monolithic — all CSS/HTML/JS inline). The actual working file on the drive is `index-v55.html` (3,471 lines, modularized — CSS, splash, and parallax extracted to external files). We initially renamed v53, discovered the mismatch when testing, then applied the same rename to v55 and output as v56.

**v55 external dependencies:**
- `prism-styles.css` — extracted CSS
- `prism-splash.js` — splash/onboarding logic
- `prism-parallax.js` — parallax view logic
- `legislation_data.js` — congressional data
- `politicians_data.js` — politician data

**Action needed:** Update project knowledge to use `index-v56.html` instead of `index-v53.html`. The v53 copy in project knowledge is now doubly outdated (old vocabulary AND old architecture).

---

## Git Commits

1. `b9c8ccd` — "rename good-faith/bad-faith → fluid/denominated across encoding layer" (prismdb.js, admin.html, index-v53.html, Session_G_Handoff.md)
2. `f84430d` — "v56: fluid/denominated rename applied to forward v55 codebase" (index-v56.html)

---

## What's Next

### Immediate — localStorage migration note
Any user who has existing events in localStorage from the old schema will hit the same `undefined` error we saw. When we ship, we need either:
- A migration function that renames keys in cached events
- Or a version check that clears and re-seeds on schema change

### Pending — Parameter docs (read-only, update on drive)
These are all project knowledge markdown files. Must be updated on the drive, not through Claude's file tools.

**Full rename (encoding layer):**
- J encoding v1.0 (837 lines) — every good-faith/bad-faith reference
- g_compilation (44 references)
- Bad faith pattern library → Denomination pattern library
- Degradation grammar doc (23 references)
- Diatribe aperture revision (23 references)

**Selective rename (straddles both layers):**
- Case studies CS01 (30 refs), CS02 (25 refs) — structural analysis renames, editorial prose keeps good faith/bad faith
- Spec docs — encoding references rename, product-facing descriptions keep both vocabularies

**Deliberately keep good faith/bad faith:**
- Parallelogram design doc — editorial layer, establishes reader-facing vocabulary

### Pending — Arc schema extension
Task from Session G, not started this session:
- Extract hardcoded CS04 arc event data from `index-v56.html` (formerly v53 lines 5320–5430, now ~lines 1160–1530 in v56)
- Implement `prism_arcs` schema in `prismdb.js`
- Arc entity shape: container fields (`id`, `title`, `object`, `objectDescription`) + ordered events array
- Per-event fields: Object Z, per-quadrant Subject Z (`qz`), subject labels, coordinates, date
- CRUD methods: `getArcs()`, `getArc(id)`, `saveArc(arc)`, `deleteArc(id)`, `seedArc()`
- `prevalentAxis` addition to arc event schema
- Wire arc authoring into admin portal

### Pending — Desktop app (Tauri)
- Frameless window, asset extraction, veil-lift transition

### Pending — Production backend (Phase 3.5)
- Supabase (database), Cloudflare Worker (Anthropic API proxy), Vercel (static hosting)

---

## Key Reminders

- **Pre-session git ritual:** `cd "/Volumes/EP3_B/PARALLELOGRAM PRISM/Code" && git add -A && git commit -m "pre-session snapshot"`
- **Project knowledge `prism-graphmap.js`** (253 lines) is always outdated — use uploaded file (~1,854 lines)
- **Project knowledge `index-v53.html`** is now outdated — forward version is `index-v56.html`
- **localStorage caching:** After schema changes, users need `localStorage.removeItem('prism_events')` + `PrismDB.seed()` + reload
- **Displacement ≠ denomination; Object Z scored from Object's own position**
- **Realized/frustrated** replaces "back/over" in the analytical register
- **File locations:** uploaded source files at `/mnt/user-data/uploads/`, working project files at `/mnt/project/`
- **For reading large code blocks:** use `sed -n 'START,ENDp'` via bash
