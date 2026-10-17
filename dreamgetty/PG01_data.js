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
      { id: 'P2', outcome: 'pending', statedDate: '2026-09-17',
        stated: 'Institutional coverage of the Russian-theater strike campaign reads war, shortages ' +
          'and prices, never settlement structure. Falsified by any RI/LI piece connecting the ' +
          'campaign to invoicing or the dollar\'s share of the marginal barrel, 2026-08-14 → 11-30.' },
      { id: 'P3', outcome: 'pending', statedDate: '2026-10-02', zTarget: 0.8,
        stated: 'The shock realizes the object by re-routing it. TF03 (the Strait closure) scores the ' +
          'real object at z ≥ +0.8 at the hemisphere barrel: Gulf supply to the US goes to zero and ' +
          'is replaced by Western-Hemisphere supply, dollar-settled by construction; the dollar-settled ' +
          'share of US crude imports does not fall. Basis: the active layer, first fetch 2026-10-02.' },
    ],

    // §6 — the active layer (ruled 2026-10-02): the arc read as motion. Columns: realization (flows,
    // with a declared settlement layer) · detection (events, as-of + detected) · price (the shadow).
    // Drawn in the G4's Active pane (Prism/active/). Flows do not score z; no instrumentality claim.
    // §6.7 (DRAFTED 2026-10-12, awaiting ruling): the map is a globe on the public pedestal; one determination —
    // the share of traded energy sold in dollars, with its denominator; a point of view, the US by default.
    active: { ruled: '2026-10-02', amendment: '§6.7 drafted 2026-10-12 — the globe', pane: 'Active', source: 'Prism/data/active/active.json',
      settlement: 'Prism/data/active/settlement.json',
      guards: ['the frame stands still', 'flows do not score z', 'no instrumentality', 'accruals stay accruals', 'Prism sees it through Readings'] },

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
