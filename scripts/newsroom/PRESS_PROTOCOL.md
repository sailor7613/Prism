# The daily cut — protocol for the Press task

*v1 · 2026-10-19 · Sailor + Claude. This file is the canonical instruction the daily Press task follows. Edit it here; the task reads it fresh each run. It sits beside `AUTHORING_PROTOCOL.md` (the newsroom's Readings) and borrows its rules on git, overlays and reporting.*

## What this is

Every morning the **press sweep** (GitHub Action, `scripts/press-sweep.py`, 05:45 PT) commits
`data/press/sweeps/sweep_<date>.json`: every source on the roster swept, every item matched
against `data/press/terms.json`, the hits queued, captions for the YouTube hits in
`data/press/transcripts/<date>/`. This task turns the queue into **cuts** — Press pieces the paper
reads — and leaves the sweep marked. Sailor's rulings (2026-10-15/16): every source is scanned
every time it publishes; each daily cut scans the **whole transcript for objects**, not only
the ones on the register; the Close is the daily RI baseline (the floor); paywalled sources are
read by headline + opening as **beta ledes** (β) and never enter a corner's figure until read
in full. Rulings are never made here; anomalies are reported.

## Inputs

- The day's sweep: `https://raw.githubusercontent.com/sailor7613/Prism/main/data/press/sweeps/sweep_<date>.json`
  (fetch from the Mac's shell with curl; the cloud container cannot reach GitHub raw). If today's
  file is missing, use the newest date in `…/sweeps/index.json` and say so in the note.
- Transcripts the Action pulled: same path under `data/press/transcripts/<date>/`. A queue row
  with `transcript: null` and a `videoId` means YouTube refused the runner — pull it from the Mac
  shell: `python3 Prism/scripts/press-pull.py youtube <link> --program "<name>"` (yt-dlp must be
  installed there; if it isn't, note the row as *transcript owed* and move on).
- The grammar (on disk): `Parameters/09_Parallelograms/Press/README.md` (the line, the cut, the
  two kinds, the baseline's five rules), `Parameters/00_Architecture/Trace_Formula_v1.md`, the
  Codex `Prism/data/codex.json`. Exemplar cuts: `Parameters/09_Parallelograms/Press/2026-10-15_BP_Hormuz/`
  and `…/2026-10-15_TheClose_Baseline/`; exemplar pieces: `Prism/data/press/bp_2026-10-15_hormuz.json`,
  `Prism/data/press/close_2026-10-16.json`.
- Builder: `python3 Prism/scripts/press-build.py <spec.json> <out.json>` — composites are computed,
  never hand-rounded.
- Roster: `Prism/data/press/roster.json` (stations; `baseline: true` marks the floor).

## Order of work (budget: the floor + up to three cuts; stop there)

1. **Confirm the Mac is linked** (list the connected folder). If not, stop; the note is "Mac not linked — no cuts today".
2. **Fetch the sweep** and read the queue. Skip every row that already carries a `cut` mark.
3. **The floor first.** The Close's row (`baseline: true`) is cut under the five baseline rules in
   the README — only register-touching segments, one line-block per segment, `kind: baseline`.
   File `Prism/data/press/close_<date>.json`. If The Close has no transcript today, the floor
   carries over (say so).
4. **Choose up to three cuts** from the remaining hits, in this order: a hit on an object with a
   live window (an open Reading or a standing PG arc), newest first; a corner the paper is thin on
   this week (check `index.json` — three voices per quadrant is the target); a beta lede only when
   nothing fuller exists for that corner. Never two cuts from the same source on the same day.
5. **Cut each one** per the README: transcript → cut (fewest words that carry the object, timestamps
   kept) → lines (`[pos, who, station, touch, z, dia, mode, inferred, quote, note, chapter, zWhy]`;
   z written before the words are read; constitutive voices `@O`, never Dia-scored) → the
   objects pass (every object-shaped thing on the tape, sorted into the data set it belongs to) →
   `press-build.py` → the piece. The cut folder goes under `Parameters/09_Parallelograms/Press/<date>_<Source>_<Slug>/`
   (spec.json + cut.md); the piece under `Prism/data/press/<src>_<date>_<slug>.json` with
   `status: "claude-draft"`.
6. **Register the piece** in `Prism/data/press/index.json` (newest first; the same row shape as
   the existing entries) and append its sightings to `objects_seen.json` (that file is written
   only by the Press). A new object the pass sorted into a data set gets a key in `terms.json`.
7. **Mark the sweep locally**: write `Prism/data/press/sweeps/sweep_<date>.json` to disk with each
   cut row's `cut: "<piece id>"` (the Action keeps these marks on a same-day rerun). Stamp
   `lastCut` on the roster for each source cut.
8. **The note**: `Handoffs/Prism/press/<date>.md` — one line per cut (source · object · station ·
   Dia · z · Lumens · what it does), the floor's figure, hits left in the queue and why, transcripts
   owed, sources whose feed failed, and bench candidates seen twice this week (say so, never rule).
   Finish with the note shortened to a few lines as the final message — that is what Sailor reads
   on his phone.

## Rules

- Never run git in any form in the Mac shell (lock files). Sailor commits in GitHub Desktop.
- Never edit the formula, the schema, the Codex, a piece Sailor has edited (status not
  `claude-draft`), `roster.json` stations, or anything under `Parameters/` outside the new cut folder.
- Every piece carries `status: "claude-draft"`; the paper labels these. Rulings are Sailor's.
- Plain language, findings before proposals, say which calls were yours.
