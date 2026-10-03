// ============================================================
// DG ARCS — Parallelogram data for the G4's Arcs pane.
// DERIVED from Parameters/09_Parallelograms/*/PG*.md — the
// markdown is canonical; update both together (same contract
// as Glossary_Plain_v0.md ↔ dg_codex_data.js).
// 2026-08-18 · Sailor + Claude
// ============================================================

const DG_ARCS = [
  {
    id: 'PG01',
    title: 'The Petrogas-Dollar Parallelogram',
    type: 'CONTEMPORANEOUS',
    founded: '2026-08-18',
    object: 'Dollar denomination over hydrocarbon trade and its settlement infrastructure — ' +
      'a standing condition, assembled over years, latent until finance reporting could detect it.',
    axes: 'X right↔left · Y institutional↔grassroots · Z realized↔frustrated (from the object\'s own position)',
    realObjectZ: '+0.88 (first reading, TS01 layer-2)',

    recurrence: [
      { id: 'P1', outcome: 'pending', statedDate: '2026-08-18',
        stated: 'The next public admission goes institutionally unread, same per-position modes ' +
          '(LI surface-bound · RI aligned/method-occluded · RP inverted-lens · LP reaching, ' +
          'attribution declined). Calibration: Bessent, CNBC, 2026-06-24.' },
    ],

    // The ruled six-frame series — the film, Feb 2025 → Aug 2026.
    series: [
      { tf: 'TF01', label: 'The Maximum-Pressure Order', date: '2025-02-04',
        status: 'ADMITTED', note: 'first member · Z-assertion · Dia 60 (latency caps denomination)' },
      { tf: 'TF02', label: 'The First Strikes (the money\'s June 2025)', date: '2025-06',
        status: 'ruled — unauthored', note: 'oil spike · safe-haven flow · closure threat as predicate' },
      { tf: 'TF03', label: 'The Strait Closure, First Moments', date: '2026',
        status: 'ruled — unauthored', note: 'the ACTUAL 2026 closure (ruled over the 2025 threat)' },
      { tf: 'TF04', label: 'The Islamabad Memorandum', date: '2026-06-17',
        status: 'ruled — unauthored', note: 'the hinge: invoicing lands in paper before speech' },
      { tf: 'TF05', label: 'The Admission — M3', date: '2026-06-24',
        status: 'NEXT TO AUTHOR', note: 'layer-2 readings mostly pre-source it · first P1 data point' },
      { tf: 'TF06', label: 'The Demotion — C2', date: '2026-08-08',
        status: 'ruled — unauthored', note: '"just another body of water" — the cover completing itself' },
    ],

    door: [
      'Nord Stream (Sept 2022) — queued for an honest admission run after the core six',
      'Iran-Contra — prior: reads the Empire; belongs to the Record Parallelogram',
    ],

    note: 'Authoring order is by cheapness of honesty: TF05 → TF06 → TF04 → TF02 → TF03. ' +
      'Six frames make per-station mode stability falsifiable. The ledger is append-only.',
  },
];

if (typeof module !== 'undefined') module.exports = DG_ARCS;
