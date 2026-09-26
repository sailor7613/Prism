# The daily drafting — authoring protocol for Claude drafts

*v1 · 2026-09-22 · Sailor + Claude. This file is the canonical instruction the daily
drafting task follows. Edit it here; the task reads it fresh each run.*

## What this is

Every morning the newsroom scan (GitHub Action, `scripts/scan-objects.js`) commits an
object register to `data/newsroom/objects.json` with up to three objects **queued**
for drafting. This task turns each queued object into a **Claude draft** — a Reading
authored z-first under the Trace Formula v1 — and writes it to
`data/readings/drafts/claude/<rid>.json` in Sailor's Prism folder. Sailor reads on the
admin surface; the moment he edits one, it refiles to his drafts. Rulings are never
made here; anomalies are *reported*, and a repeated anomaly is a bench candidate.

The product thesis these drafts serve: pop discourse is overwrought with **inversions**
(a station's polarity on an object flipping against its own prior) and **breaks in
object permanence** (an object leaving the discourse unresolved, or returning renamed).
Every draft looks for both and records what it finds on the object.

## Inputs

- Register: `https://raw.githubusercontent.com/sailor7613/Prism/main/data/newsroom/objects.json`
  (fetch from the Mac's shell; the cloud container cannot reach GitHub raw).
- Digest for the day: `data/newsroom/digest-latest.md` (same repo).
- Exemplars (the live tier, on disk): `Prism/data/readings/*.json` — the Ban
  (`rdg_mu7ban350hom`), the Tariff (`rdg_ms51urghz7zi`) and the Refund
  (`rdg_mu7refund166`) are the shape to match, field for field.
- Formula and schema (on the Mac): `Parameters/00_Architecture/Trace_Formula_v1.md`,
  `Shared/Event_Data_Schema_v1.md` (+ the v2 addendum), `Parameters/00_Architecture/frame_facts.json`.
- Checker: `node "Parameters/00_Architecture/formula_check.js" <reading.json>` — must
  report **All clean** before a draft lands.

## Before drafting: skip what's already done (added 2026-09-23)

The task now runs every two hours whenever the Mac is on, and the register on GitHub is
rewritten by every scan, so a `queued` status there does NOT mean undrafted. Before
authoring anything:

1. List every file in `Prism/data/readings/drafts/claude/` (including `_held/`) and in
   `Prism/data/readings/drafts/`, and collect each file's `newsroom.oid`.
2. Skip any queued object whose `oid` is already in that set.
3. Also skip any queued object that is **not yet an object**: a vote, ruling, sentencing or
   hearing that is scheduled, pending or "without ruling" has not finished forming (§4c).
   Leave it queued; don't dismiss it — a later scan will see it land. One line in the note.
4. If nothing is left, write nothing and end with the single line "nothing new".
   Don't write a morning note for an empty run.
5. At most 3 new drafts per calendar day (Pacific). Count today's files by `newsroom.draftedOn`.

## The order of authoring (each object, in this order — never reversed)

1. **Object before window.** State the instrument in one line: what it is, who holds
   it, the day it *finished forming* (the trigger day). If the register's read is wrong
   (holder is the wrong actor, the "object" is a mood), correct it on the object card
   and say why; if there is no instrument, mark the object `dismissed` with a reason
   and stop — a frame with no instrument sweeps clean vacuously.
2. **Window (§4c).** `window.close` = the trigger day. A fact's date is its as-of date,
   not its report date. Declare `window.why` at authoring. A pertinent fact after the
   close means the trigger day is wrong — re-declare with a why, never widen.
3. **Frame, from in-window sources only.** The framing paragraph dates itself (every
   load-bearing fact carries its date inside the prose). Sources from the object's
   article list first; search for primary text (the bill, the order, the opinion) when
   it exists. Pre-window background goes in `meta.frameFirst.background_preWindow`, not
   the frame. Then `prompt` (one line, the question the Reading asks) and
   `framingKeywords`.
4. **Sweep before z.** Run the checker on the frame. Fix leaks (wording that moves a
   fact's date, e.g. "by the end of June" for a June-29 as-of). Log what was excluded
   as after-window in `meta.framingAudit`.
5. **Axes and split.** `prevalentAxis` (x or y — the line the Diatribe slider runs
   along; choose the stated object's line, not the more interesting cleavage),
   `axes.x/y/z` (poles in the Reading's own words), `split{topology, strength, seam,
   rationale}` (oscillations are allowed: 3-vs-1 peels, intra-quadrant, diffuse —
   address the discourse as it is), `antiValentBand`.
6. **The twelve, z first.** For each station A–D × fluid/coalition/denominated:
   `z` (−1..1, does this station believe the object *delivers*), then `zReason` (one
   sentence, mechanism not mood), then `instrument{holder, trusted}` — **the holder as
   this station sees it, and whether the station trusts that holder to deliver to
   them** (R-0921-1: a rim's z is signed by holder-trust). Only then the words:
   `text` (2–3 sentences in the station's own voice), `xWord`, `yWord`, `words[]`.
   Author blind if possible: a subagent given only the frame, prompt, keywords, axes
   and the formula — no other Readings, no register.
7. **Diatribe** (`LF LC LD RF RC RD`, each `{text, side, band}`), `diatribeLayer`,
   `objectLayer` (stated vs operative object; an inversion lean if there is one).
8. **Sweep again** — the whole file. All clean or it does not land.
9. **Record the two pathologies on the object card**, in the register you write back:
   `inversions[]` — any station whose polarity on this object reverses a prior it
   held (cite the prior: a live Reading, or coverage in the window); `permanence` notes
   if the object is a return, or the draft found the object had already dissolved.

## File shape

Match the exemplars exactly. Required top level: `title, category, date (= formedOn),
prompt, framing, framingKeywords, prevalentAxis, split, antiValentBand,
antiValentRationale, axes, responses, diatribe, diatribeLayer, objectLayer, window,
meta, rid, schema: "reading/v1", formulaVersion: "v1", updatedAt`. Plus:

- `authorTier: "claude"` and `newsroom: { oid, queuedOn, draftedOn }` — **required**; the duplicate guard above reads `newsroom.oid`.
- `meta.status: "draft"`, `meta.frameFirst`, `meta.framingAudit`, `meta.blindAuthoring`
  as in the Tariff exemplar. `meta.dialecticsRef` = the oid.
- `rid`: `rdg_` + 12 lowercase base36 chars (mint fresh; never reuse).
- `title`: Claude's lean, plainly marked in `meta.frameFirst.titleLean` — Sailor names
  Readings.

## Where it lands, and the note

- Write each draft to `Prism/data/readings/drafts/claude/<rid>.json`.
- Update the register on disk (`Prism/data/newsroom/objects.json`): the object's
  `status` → `drafted`, `drafts.claude` → rid, `draftedOn`, plus `inversions[]` and any
  holder/formedOn correction with a `corrections[]` note. Dismissed objects → `dismissed`
  with `dismissedWhy`.
- Do **not** commit. Sailor commits in GitHub Desktop.
- Write the morning note to `Handoffs/Prism/newsroom/YYYY-MM-DD.md`: one line per
  object (title lean · kind · holder · trigger day · z pattern in eight numbers ·
  inversions found · dismissed-with-why), then the register's breaks and returns for
  the day, then anything the checker flagged twice this week (a bench candidate — say
  so, do not rule). Send the same note as the run's push notification, shortened.
- Bench candidates go in the note only. **Never** edit the formula, the schema, the
  Current Law, or a live Reading from this task.

## If something is missing

Mac not linked → write nothing, say so in the note, stop. Register not updated today
(scan failed) → draft from yesterday's queue only if still `queued`, else stop. Checker
not clean after two passes → do not land the draft; write it to
`drafts/claude/_held/<rid>.json` with the checker output attached in `meta.held`, and
say so.
