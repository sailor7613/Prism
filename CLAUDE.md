# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Prism is a **static web app** (no build step, no bundler, no npm install for the app itself) that maps positions of U.S. Congress members. Two HTML entries at the repo root — `index-v56.html` (main app) and `admin.html` (admin / refraction panel) — load CSS + JS directly from `src/` and data from `data/`.

A separate Node-based **data pipeline** in `scripts/` fetches from the Congress.gov API and voteview.com and writes into `data/`. The pipeline and the app are decoupled: the pipeline produces files; the app reads them.

## Working principles (load-bearing — read first)

These are the development principles this project runs on. They're lifted verbatim from `../Specs/Prism_Roadmap_v1_9.md` and they're load-bearing — operate inside them by default, not as suggestions to weigh.

- **Bounded file scope per session.** Each session touches only the files needed for the task — usually one to three, never the whole codebase. If scope expands mid-session, finish what's in flight and start a new session for the rest.
- **One task at a time.** State the single task clearly at the start. Confirm scope before executing.
- **Start every session with context.** Drop the relevant handoff and files into a new session.
- **Test in browser after every change.** VS Code Live Server makes this instant.
- **Archive old versions.** Before major changes, save a dated/numbered copy of the file being modified.
- **Surgical edits over full file regeneration.** Targeted edits maintain stability.
- **Get ontologically tight before touching code.** Conceptual alignment precedes implementation.
- **Validate ideas through case studies before committing to encoding documents.** Work through cases in chat first.
- **Save handoff documents.** Handoffs are the continuity mechanism between sessions.
- **Admin before UI.** The admin portal produces the content the UI consumes.
- **Mobile before desktop.** The phone is the constraint. Nail the constrained version before expanding.

## Division of labor (Sailor's rule — read before responding)

Sailor's input is conceptual: the modes of political economy, the grammar, the parameters, the sociology. Claude's job is to connect that vision to existing political science and to working code — not to re-litigate, reconcile, or elaborate the political science itself. Treat the political science as settled infrastructure: boring, complete, load-bearing, invisible.

What this means in practice:

- **The product goal is emotive rendering, not analytical completeness.** Prism renders arcane legislative data in a novel way that sparks intuitive understanding — revealing to users a deeper sense of their own politics that the disfunctional media landscape can't. Every design and ontology question should be answered with that goal in view (this is the catharsis principle's product face).
- **Answer at the level of the vision first.** Lead with what a change means for the user experience and Sailor's goals. Keep implementation detail brief and behind the answer, not in front of it. Density is a failure mode: if a response reads like a spec, rewrite it.
- **Stabilize the ontology in service of the goals, not for its own sake.** When ontological tightening is needed, frame it by what it protects in the product, then keep it short.

## Direction: the surface replaces the desk (2026-07-06, supersedes the July 4 role-split)

Sailor's decision, morning of July 6: **`admin.html` is being retired.** `admin-surface.html` is the instrument going forward and will grow to carry all needed admin functionality — the point is that functionality and ontology align, and the surface is where they do. This supersedes the "two instruments, do not grow the surface into a second desk" framing in `../Handoffs/Prism/Prism_Admin_Surface_Direction_Handoff.md`.

Practically: new admin capability lands on the surface, not the desk. The desk keeps working during the migration (events CRUD, Export writer, refraction scoring still live there until ported) — but don't add new functionality to `admin.html`, and when touching a desk feature, prefer porting it to the surface over extending it in place.

Two standing corrections (Sailor, 2026-07-06):

- **Never refer to an event by a bill's name.** Older handoffs say "the Laken Riley curation" for the July 2 immigration-event session — do not repeat this shorthand. Events are conceived from Sailor's sociology and named by their concept; bills attach to events through curation, never the reverse. If a handoff names an event by a bill, treat that as the error it is.
- **Event IDs are device-local, not stable.** PrismDB is per-browser localStorage, so `evt_010` on the iPad and `evt_010` on the desktop can be different events (and the same event can carry different IDs). Refer to events by title/concept across devices; use IDs only within a single device's store.

## Where context lives

This repo (`Prism/`) is one project inside a larger workspace at `../`. When you need orientation beyond what's in this file, look here first:

- `../README.md` — the workspace map (eight top-level folders, their purposes).
- `../Specs/Prism_Roadmap_v1_9.md` — the current living roadmap. Phase order, completion state, immediate next actions. Single source of truth for "what are we building right now."
- `../Specs/Prism_Spec_v06.md` — the product specification.
- `../Specs/Prism_Architecture_Update_v2.md` — graphmap factory spec, Z separation, capability matrix.
- `../Handoffs/Prism/` — per-session technical notes. Recent files carry the most recent context.
- `../Handoffs/Iteration_Log.md` — the running index of what's done, what's next, what's open across the whole workspace. Read the top entry when picking up where you left off.
- `../Parameters/` — the conceptual scaffolding: encoding modules (`J_encoding_v1` and successors), grammars, scoring library, bad faith pattern library, case studies.

Two embedded git repos: `Prism/.git/` and `../DreamGetty/DEPLOY/.git/` maintain independent histories from the outer workspace repo. Commits go to whichever repo you launched from — `Prism/` for app-level changes, `../` for cross-cutting workspace changes (roadmaps, handoffs).

## Current focus

The active MVP target is **Phase 6.1 (Refraction)** — completing the institutional layer. Legislator plotting (538 members from Congress.gov) is done. Three sub-items remain and are the explicit priority:

- **6.1.2 Admin broadcast layer** — curated statements scored and placed on the graph, visible to all users.
- **6.1.3 User submission / Operation B** — users submit statements for AI-assisted personal scoring.
- **6.1.4 Bills and legislation plotted via AI** — bill language analyzed and placed on the graph.

When biasing where to put effort, bias toward unblocking these. The roadmap has the full ordered Immediate Next Actions list.

## Common commands

### Run the app

The day-to-day workflow uses **VS Code's Live Server extension**: right-click `index-v56.html` in the file explorer and choose "Open with Live Server." Auto-reload on save makes the "test in browser after every change" principle frictionless.

For a non–VS Code fallback, serve the repo root with Python:

    python3 -m http.server 8000
    # http://localhost:8000/index-v56.html
    # http://localhost:8000/admin.html

Append `?dev` to the URL to skip the splash (adds `dev-skip` class on `<html>`).

### Rebuild data

Requires Node 18+ (uses built-in `fetch`). No npm dependencies.

    export CONGRESS_API_KEY=your_key
    cd scripts
    node run-all.js          # full pipeline: members + bills
    node fetch-members.js    # members + voteview NOMINATE only
    node fetch-bills.js      # bills only

Pipeline writes into `../data/`. A full run takes a few minutes — `scripts/config.js` paces calls at `DELAY_MS=500` and waits `RETRY_DELAY_MS=60000` on 429.

### Tests

No automated test runner. `test/graphmap-factory-test.html` is a manual harness — open it in a browser to exercise `PrismGraphmap` in isolation.

## Architecture

### Two entries, one data layer

`index-v56.html` and `admin.html` are both standalone pages. They share state through **`PrismDB`** (`src/js/prismdb.js`), an IIFE module that wraps `localStorage` under keys like `prism_events`, `prism_members`, `prism_arcs`. Anything that needs to persist across page loads or be visible to both pages goes through PrismDB — do not write to `localStorage` directly from feature code.

Both pages load the same two data scripts before any module JS:

    data/legislation_data.js     (bills, static export)
    data/politicians_data.js     (member roster, auto-generated by run-all.js)

These define globals (`POLITICIANS_DATA`, etc.) — that's the handoff from the pipeline to the app.

### Module layout (`src/js/`)

- **`prismdb.js`** — Persistence + lookups. Single source of truth for events, members, member positions, parallax snapshots, arcs.
- **`prism-graphmap.js`** — Factory that creates independent 3D quadrant graph instances using Three.js r128 (loaded from CDN, not vendored). Each call to `PrismGraphmap.create({ container, mode })` returns its own scene; there's also a singleton-style `mount/unmount` for backward compat. Per-instance state lives on the returned object, not in module scope.
- **`prism-splash.js`** — Splash screen + onboarding + portal entry. Uses `requestAnimationFrame` for avatar animation.
- **`prism-parallax.js`** — Parallax overlay, orbit engine, three-panel swipe (Beam / Prism / Refraction). Touches DOM by ID directly and shares header-position constants with the main page.

Script-tag load order in `index-v56.html` matters: Three.js → graphmap → prismdb → splash → parallax. Don't reorder casually.

### Data pipeline (`scripts/`)

- **`config.js`** — Central config. Reads `CONGRESS_API_KEY` from env and exits if unset. `CONGRESS_NUMBER` is hardcoded (currently 119) — bump it here when the new Congress is seated.
- **`congress-client.js`** — Thin wrapper over the Congress.gov v3 API with paging + rate-limit handling.
- **`fetch-members.js`** — Members + voteview NOMINATE ideology scores. Exports `fetchMembers()`.
- **`fetch-bills.js`** — Bill metadata + actions. Exports `fetchBills()` and `writeBillOutputs()`.
- **`run-all.js`** — Orchestrator. Writes `prism_members.json`, `politicians_data.js` (drop-in for the app), `prism_legislation.json`, and `fetch_stats.json` into `data/`.

The pipeline does not delete old files. `prism_members.min.json` is a hand-minified snapshot used by the app; `prism_members.json` is the full pipeline output.

### What's intentionally inactive

- **`archive/`** — Superseded code kept as a paper trail. Nothing in `src/` or any HTML loads from here. Don't add imports to it; if you need something out, copy it into `src/js/` instead.
- **`parallelograms/case_studies/`** — Conceptual / narrative docs about specific bills. Not code.

## Conventions specific to this repo

- **Layout is by lifecycle, not by feature.** `src/` = hand-written, `data/` = generated, `scripts/` = generator, `archive/` = inactive. When adding a file, ask which lifecycle bucket it belongs in rather than which feature.
- **Entry HTML files are large but mid-extraction, not monolithic by design.** `index-v56.html` (~3,650 lines / ~750KB) and `admin.html` (~10,800 lines / ~430KB) are page-level shells that have been actively getting smaller via the monolith split — `prism-styles.css`, `prism-splash.js`, and `prism-parallax.js` have already been extracted. Pending extractions: `prism-parallelogram.js`, `prism-morph.js`, `prism-core.js`, and an eventual admin extraction pass. When adding new logic, push it into `src/js/` rather than inline. When touching existing inline code, prefer extracting the relevant block over editing it in place if the scope feels right.
- **No transpilation.** Anything you write in `src/js/` runs in the browser as-is. Stick to syntax that current evergreen browsers support natively.
- **Versioned entry filename** (`index-v56.html`): the version suffix is the convention here, not an artifact to clean up. If you fork the entry, bump the number rather than renaming in place.
- **AI autosuggest is the load-bearing admin pattern.** The Sonnet-backed autosuggest in `admin.html` (event creation, statement scoring, ✦ Suggest, ✦ Curate) is the working pattern this project leans on. Editorial deltas between AI proposals and final saved content are intended training data for the closed-form classifier — preserve this pattern and log the deltas when extending it. The system prompts (`PRISM_SYSTEM_PROMPT`, `BILL_CURATE_SYSTEM_PROMPT`) are canonical; don't fork them silently.
