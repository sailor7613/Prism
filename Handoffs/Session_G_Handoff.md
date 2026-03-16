# Prism Session Handoff — March 15, 2026 (Session G)

**Previous session:** Module 9 revision, two-coordinate-subject model, displacement/denomination separation (Session F)
**This session:** Diatribe derivation protocol revision, J encoding compilation, system prompt update
**Result:** Three deliverables: `Diatribe_Derivation_Protocol_Revision_v2.md`, `J_encoding_v1.md`, `admin.html` (updated system prompt). One encoding task, one compilation task, one code task.

---

## What happened this session

### 1. Diatribe Derivation Protocol — Revised (Ten Steps)

Rewrote the eight-step Diatribe derivation protocol (Module 1.4) as a ten-step protocol that absorbs the two-coordinate-subject model, displacement matrix, and displacement/denomination separation from Session F.

**Steps that held from original:** Steps 1 (establish Object), 6 (spread vs. composite), 7 (Soros dual-destruction), 8 (symmetry test). These are integrity checks — they don't change because the subject model changed.

**Steps that changed:**

- **Step 2 (new) — Receive displacement context.** The protocol now receives prevalent axis, Object Z, and displacement matrix position per quadrant *before* any scoring happens. The scoring is contextualized from the start.

- **Step 3 (revised from old Step 2) — Assess coordinate subject dominance.** The capacity-for-surprise binary is retained as a quick gate but reframed: YES/NO maps to "which pole of the oscillation is dominant?" Good-faith dominant, bad-faith dominant, or oscillation zone.

- **Step 4 (revised from old Step 3) — Apply denomination gradient.** Generalized from the three-level conspiratorial gradient to the full five-stage denomination grammar (Module 3 / 🔥 D). The conspiratorial gradient maps cleanly (Levels 1/2/3 → Stages 0–1/2/3–4) but the five-stage grammar now handles all destruction modes through the same gradient, not just conspiratorial.

- **Step 5 (revised from old Step 4) — Identify destruction mode.** Same table, but adds the shared dependency note — the 26 patterns now serve dual roles (generative in Module 9, diagnostic in Module 1.4).

- **Step 9 (revised from old Step 8) — Assign oscillation tags.** "Mode = none" becomes "good-faith dominant." "Mode = operative" becomes "bad-faith dominant." Middle band is explicitly the oscillation zone with trajectory indicator.

- **Step 10 (new) — Displacement-calibrated interpretation.** The Didion finding formalized: high displacement + low denomination tagged as "resilient good faith under duress." Low displacement + high denomination tagged as "prior capture — displacement-independent denomination." The score means something different depending on the pressure that produced it.

Axis interaction rules rewritten with mechanistic grounding (displacement matrix explains each rule's predictive force). Didion added to calibration benchmark table at Diatribe 10.

### 2. J Encoding v1.0 — Compiled

Integrated all Session F and G encoding work into the canonical document. Two operations:

- **Module 1.4 replaced** (old lines 156–239) with the full revised ten-step protocol, displacement/denomination separation, oscillation tags, displacement-calibrated interpretation, mechanistic axis interaction rules, and updated output specification.
- **Module 9 added** after Module 8 — coordinate subject definition, two-per-quadrant model, displacement matrix, nine-step response derivation protocol, anti-valent band, arc mode specification, Parallelogram graphmap toggle, response format constraints, module relationship table.

Document went from 614 lines (v0.1) to 837 lines (v1.0). Modules 1–9 now complete in a single document. Modules 10 (word tagging) and 11 (Parallax) exist in separate documents pending future integration.

### 3. PRISM_SYSTEM_PROMPT Updated in admin.html

Rewrote the system prompt (lines 3699–3820, ~122 lines) to reflect Module 9 v2 and the revised derivation protocol. New prompt is ~138 lines.

**Key changes:**
- Coordinate subject model introduced as the core concept
- Two coordinate subjects per quadrant, independently derived
- Coalition defined as emergent oscillation, not independently authored
- Seven-step derivation protocol: Object → displacement field → good-faith subjects → bad-faith subjects → coalition → voice register → symmetry test
- Voice profiles demoted from opening characterization to Step 6 — styling layer, not derivation
- Vacancy concept added
- Displacement field (prevalent axis, Object Z, matrix) enters as Step 2

**Preserved identically:**
- JSON output shape — every field name, every nesting level
- Three bands: goodFaith, coalition, badFaith (same keys)
- Word tag spec, weights, isPrimary
- Anti-valent band, pairing constraint, response length constraint
- Category, framing, diatribe descriptors

The frontend will not know anything changed. The AI receives better derivation instructions and produces responses grounded in position rather than register.

---

## Deliverables

| File | Description | Destination |
|------|-------------|-------------|
| `Diatribe_Derivation_Protocol_Revision_v2.md` | Standalone ten-step protocol | Dialectical parameters folder |
| `J_encoding_v1.md` | Compiled canonical document (Modules 1–9) | Alongside / replacing J_encoding_v0 |
| `admin.html` | System prompt updated (line 3699+) | Code/ (already placed, git committed) |

Session F deliverables (for reference — produced in prior session, not this one):
- `Module_9_Revision_v2.md` → Dialectical parameters folder
- `Diatribe_Axis_Interaction_Rules_Revision.md` → Dialectical parameters folder

---

## Current file inventory

| File | Lines | Status |
|------|-------|--------|
| `admin.html` | 5,227 | **Updated this session** — PRISM_SYSTEM_PROMPT rewritten (lines 3699–3837) |
| `J_encoding_v1.md` | 837 | **New this session** — compiled Modules 1–9 |
| `prismdb.js` | 1,068 | Unchanged (Session D version) |
| `index-v53.html` | 7,515 | Unchanged (Session D version) |
| `prism-graphmap.js` | ~1,854 | Unchanged |
| `index-v55.html` | ~3,471 | Unchanged |
| `prism-parallax.js` | ~1,023 | Unchanged |
| `prism-styles.css` | 2,665 | Unchanged |
| `prism-splash.js` | 489 | Unchanged |

---

## How the system prompt works (for future reference)

The markdown parameter files on the drive are the canonical encoding. The app does NOT read them directly. `admin.html` contains a hardcoded JavaScript string (`PRISM_SYSTEM_PROMPT`) that holds a condensed version of the encoding. When the editorial desk AI features fire an API call to Anthropic, that string is sent as the system message. Changes to the encoding documents require a manual condensation step into the system prompt string.

A future architecture (Phase 3.5) could store markdown files in Supabase and assemble the system prompt dynamically at call time. For now, it's hand-curated.

---

## Task List

### Encoding & Dialectical Work
1. ~~Diatribe derivation protocol — full revision~~ **✓ Done this session**
2. ~~Integrate Module 9 v2 into J encoding~~ **✓ Done this session**
3. ~~Integrate Diatribe axis interaction rules revision into Module 1.4~~ **✓ Done this session (folded into Module 1.4 revision)**
4. **Axis interaction rules — complete formalization** — X-axis capture mechanism, bilateral suppression, form-substance divergence at organizational level. Partially addressed by this session's revision but deeper catalog work remains.
5. **Module 10 revision** — if keyword clouds emerge from editorial process, tagging protocol may need to reflect that editorial derivation *is* the tagging.
6. **Quantitative User Z ↔ Object Z mapping** — vocabulary bridged by Addendum 1, mapping function not defined.
7. **Arc quadrant responses** — Iran-Contra → Maduro events have framing, scores, subjects but no response sets. Now: 8-response sets per event (good faith + bad faith per quadrant, coalition generated from relationship).
8. **Integrate Modules 10 and 11 into J encoding** — both exist as separate documents. J_encoding_v1.0 is complete through Module 9.

### Schema & Admin Work
9. **Add `prevalentAxis` to arc event schema** in `prismdb.js`
10. ~~Update PRISM_SYSTEM_PROMPT in admin.html~~ **✓ Done this session**
11. **Arc editor UI in admin.html** — no arc CRUD exists in admin UI. PrismDB has methods but nothing calls them.
12. **Seed arc data into `prismdb.js`** — once editorial finalized through admin workflow.
13. **Parallelogram graphmap toggle** — good-faith field / bad-faith field toggle for embedded graphmaps.

### Ongoing Code Tasks
14. **Test the Derive pipeline live** — verify API call, JSON parsing, PrismDB write, word cloud rendering end-to-end through admin. This is the natural next step now that the system prompt is updated.
15. **Apply orb/cone rename patterns to v55** — find-replace guide from Session D.
16. **Getty pedestals** — wire graphmap factory instances into gallery.
17. **Veil-lift transition** — Three.js canvas beneath flat app, dwell trigger, camera pullback.
18. **Production backend** — Supabase, Cloudflare Worker, Vercel. Phase 3.5.

---

## Key reminders

- **`prism-graphmap.js` in project knowledge is outdated (253 lines)** — always use uploaded version (~1,854 lines)
- **Displacement ≠ denomination** — displacement is the push (structural, from Object), denomination is the collapse (quality of engagement, measured by Diatribe). They correlate but come apart. Didion proves they come apart.
- **Two coordinate subjects per quadrant** — good faith (derived from axes + modes + Object) and bad faith (derived from pattern library + degradation grammar + denomination history). Coalition is emergent oscillation, not independently derived.
- **Realized/frustrated is the Z-axis vocabulary** — back/over retained for 3D gesture only
- **Object Z is scored from the Object's own position** — gap between stated and operative purpose is Diatribe, not Z
- **Logical positions are prior to empirical actors** — the quadrant subject is the necessary position at that coordinate, not the faction that approximates it
- **Voice profiles are styling, not derivation** — position-first, register-second
- **System prompt ≠ J encoding** — J encoding is the full canonical document; the system prompt is a condensed operational version in admin.html. Changes to encoding require manual condensation into the prompt string.
- **JSON output shape unchanged** — frontend parses the same fields. Only the derivation instructions changed.
- **Test the pipeline next** — the system prompt is updated but hasn't been tested with a live API call yet. Natural first task for next code session.

---

*— End of handoff — March 15, 2026, Session G —*
