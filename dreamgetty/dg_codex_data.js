// ============================================================
// DG CODEX — the plain glossary, as the G4 reads it.
// Source of truth: Parameters/00_Architecture/Glossary_Plain_v0.md
// — update both together. Consumed by drawG4Codex (index.html).
// 2026-08-18 · Sailor + Claude
// ============================================================

const DG_CODEX = {

  // one-line glosses the trace-anatomy pane uses for live data
  typeGloss: {
    T: 'trigger — the event itself',
    B: 'substrate — the standing record under it',
    M: 'mechanism — how it was done',
    V: 'void — a telling absence',
    C: 'contradiction — two things held that cannot both be true',
    F: 'frame — a story told about it (positions against the shadow)',
  },
  modeGloss: {
    'vacancy': 'nothing arrives — never engages the object',
    'surface-bound': 'engages hard, lands one layer up',
    'inverted-lens': 'fully engaged, pointing 180° wrong',
    'method-occluded': 'the method passes some bands, stops others',
    'aligned': 'sees it clearly, shares the aim, never questions it',
    'open': 'reaches the object',
    'method-occluded / aligned': 'tuning the instrument, not examining it',
    'inverted-lens (forming)': 'the inversion being ground, not yet set',
  },

  sections: [
    { id: 'ids', title: 'IDs & codes', entries: [
      { term: 'TS / TF / CS / PG', plain: 'The series: TS the old traces (closed) · TF traceframes, the new snapshot series · CS case studies · PG Parallelograms, the arc containers.' },
      { term: 'T1, B2, C1, F4…', plain: 'Predicates — evidence in a trace. The letter is the type (see any entry\'s gloss), the number just counts.' },
      { term: 'A1–A4', plain: 'The four admission tests an occlusion edge must pass: instrumentality · production · substrate independence · the counterfactual.' },
      { term: 'LI · RI · LP · RP', plain: 'The four stations: Left/Right × Institutional/Populist. Quadrants A=LI, B=RI, C=LP, D=RP.' },
      { term: 'O and O′', plain: 'The object, and its shadow — the distorted reading that conceals by being wrong.' },
      { term: 'π (pi)', plain: 'Permeability: how hard it is to reach the object from a station. Always a magnitude AND a mode.' },
      { term: 'Dia', plain: 'A Diatribe score — how captured a reading is: 0 fluid, 100 fully denominated.' },
    ]},
    { id: 'moment', title: 'The moment', entries: [
      { term: 'Object', plain: 'The thing the trace is about. Only ever one per trace; it may be latent — present but not yet detectable.' },
      { term: 'Shadow (O′)', plain: 'The story the discourse tells instead — wrong in a shaped way, and the shape is data.' },
      { term: 'Frame', plain: 'The illumination: the declared time and framing under which the object is visible at all. Required on every trace.' },
      { term: 'Window / blur', plain: 'The declared time-slice. A good trace is a snapshot; blur (motion inside one frame) means arc material is stuck in a trace container.' },
      { term: 'Trace', plain: 'The imprint of one moment of contact between the object and its readers — the live instrument.' },
      { term: 'Traceframe', plain: 'A trace plus its declared frame — one thing that knows its own coordinates, portable into composition.' },
      { term: 'Layer', plain: 'WHICH object is being talked about — the military engagement (1) vs. the petrogas-dollar under it (2). A question, not a place.' },
      { term: 'Predicate + closure', plain: 'Evidence belongs to a trace only if it moves a coordinate; corroboration that moves nothing accrues to the arc.' },
      { term: 'Reader / constitutive', plain: 'A reader is scoreable. A subject whose own words enter the table is constitutive on that axis — unscoreable there (Enrollment Ruling).' },
    ]},
    { id: 'pipeline', title: 'The pipeline', entries: [
      { term: 'Refraction', plain: 'Placing the object and shadow on the axes — where the moment sits vs. where the discourse bends it.' },
      { term: 'Transform', plain: 'The bend itself (dx, dy, dz), with its primary operation named: Z-inversion denies real delivery; Z-assertion pre-credits absent delivery.' },
      { term: 'Axes', plain: 'Each trace declares what X, Y, Z mean for its moment. House constants: X left/right, Y institutional/grassroots, Z delivery.' },
      { term: 'Z', plain: 'Did it deliver or is there a gap? At the arc: realized vs. frustrated, always scored from the object\'s own position.' },
      { term: 'Prevalent axis', plain: 'Which axis carries the structural drama (X or Y).' },
      { term: 'Diffraction', plain: 'Splitting the moment into the four stations\' readings — fluid (reaches toward the object) vs. denominated (captured by the vehicle).' },
      { term: 'Station vs. reading', plain: 'An axis places STATIONS — where a reading is made from — never the reading\'s content. A twist between the two (a coercion-side station holding a diplomacy-preferring reading) does not bend the axis; it lives in the mode and the Dia spread. Parallelogram_v0 §3a.' },
      { term: 'Distinguishability', plain: 'How separable fluid and denominated are: Fluid (0–33) · Oscillation zone (34–66) · Denominated dominant (67–100).' },
      { term: 'Boundary description', plain: 'The prose account of a station\'s fork — what fluid would say, what denominated says instead, and why.' },
    ]},
    { id: 'seeing', title: 'The seeing', entries: [
      { term: 'vacancy', plain: 'Nothing arrives — the subject never engages the object at all.' },
      { term: 'surface-bound', plain: 'Engages hard, lands one layer up — right money, wrong plane.' },
      { term: 'inverted-lens', plain: 'Fully engaged and pointing 180° wrong — his dollar weakens; the object\'s strengthens.' },
      { term: 'method-occluded', plain: 'The method passes some bands and stops others — the regression brackets intent.' },
      { term: 'aligned', plain: 'Sees it clearly and shares the aim, so never questions it. Not blindness — non-interrogation.' },
      { term: 'Boundary vs. edge', plain: 'The boundary reads a subject LOSING the object (denomination). The edge reads an object a subject NEVER RECEIVED (occlusion).' },
      { term: 'A1–A4, typed', plain: 'The tests apply to DATED objects. A standing condition can\'t be asked A4 (no date) — that refusal is a sieve routing it to the arc, not a defect.' },
      { term: 'Latency', plain: 'The object never moved; the detector caught up. Unlit = vacancy; lit-but-undetected = latency.' },
      { term: 'Horizon + guard', plain: 'The curve each station stands under, ONTO the object. Never a claim about who can think — the arc shows when the object rises for whom.' },
      { term: 'Parallax', plain: 'You don\'t cross an edge; you travel until the hidden thing clears it.' },
    ]},
    { id: 'stack', title: 'The stack', entries: [
      { term: 'Parallelogram', plain: 'The static arc frame holding many readings of one broad object. Its stillness is what makes them readings of a single thing.' },
      { term: 'Parallelism admission', plain: 'A traceframe enters only if its axes are SHOWN parallel to the arc\'s — demonstrated, never assumed. The rhyme decides nothing.' },
      { term: 'One-way membrane', plain: 'Arc evidence may update a real-object score, never a predicate table. Frames travel up; nothing flows back down.' },
      { term: 'Arc', plain: 'The story a stack of parallel frames tells, read as motion. The frame stands still, so everything that moves is real.' },
      { term: 'Recurrence', plain: 'The contemporaneous arc\'s proof: predict where the next frame lands, be right — or record the miss. Append-only.' },
      { term: 'Post-detection unreadability', plain: 'An admission made in the open that stays unread from every station, each in its own mode. The horizon\'s checkable prediction.' },
      { term: 'Record / Contemporaneous', plain: 'Two arc types: Record established by determination (courts, documents); Contemporaneous by recurrence. Promotion when determinations accumulate.' },
      { term: 'Dispersion', plain: 'The arc\'s time series of how far the spectrum spreads — how differently the stations read the same events.' },
      { term: 'Detections (M3, C2…)', plain: 'Dated moments an instrument catches the object, named by predicate ID. M3 = the admission (06-24) · C2 = the Hormuz demotion (08-08).' },
    ]},
    { id: 'rules', title: 'House rules', entries: [
      { term: 'Receipts before belief', plain: 'Check the artifact, not the memory of it.' },
      { term: 'The rhyme decides nothing', plain: 'Resemblance is not admission, recovery, or evidence.' },
      { term: 'A failing test may be a sieve', plain: 'Ask what a refusal is sorting before calling the instrument broken.' },
      { term: 'Blur is the diagnostic', plain: 'Motion inside one frame means the frame is drawn too wide.' },
      { term: 'Rehome the load, then strike', plain: 'Nothing is deleted until its job has a new address.' },
      { term: 'Plain language first', plain: 'Findings before proposals; questions asked as bookkeeping. If you can\'t say it plainly, it isn\'t ruled yet.' },
      { term: 'The ledger is append-only', plain: 'Reversals are recorded, never erased.' },
    ]},
  ],
};

if (typeof module !== 'undefined') module.exports = DG_CODEX;
