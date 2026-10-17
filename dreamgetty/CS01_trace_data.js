// ============================================================
// CS01 — Complete Refraction-Diffraction Trace Data
// Pipeline output: Parameters project → DreamGetty renderer
//
// Event: ICE Killing of Alex Pretti / 2A Inversion
// Status: All four positions pipeline-complete.
//         Boundary descriptions pending (the "4" in 8+4).
// Date: March 30, 2026
// ============================================================

const CS01_TRACE = {
  id: 'CS01',
  label: 'ICE Killing of Alex Pretti / 2A Inversion',
  eventType: 'Z-inversion',
  prevalentAxis: 'Y',

  // ── Refraction output ──────────────────────────────────
  object:  { x: 0.70, y: 0.80, z: 0.82 },   // Y-prevalent, Z-delivering
  shadow:  { x: 0.80, y: 0.68, z: -0.20 },   // X-strengthened, Z-inverted

  transform: {
    dx: 0.10,    // shadow codes more purely partisan
    dy: -0.12,   // shadow attenuates institutional slightly
    dz: -1.02,   // Z-inversion — primary shadow operation
    primary: 'Z-inversion',
    description: 'Shadow holds institutional frame nearly intact and inverts the delivery sign.',
  },

  // ── Axis semantics (per-event, overrides factory defaults) ──
  axes: {
    x: { pos: 'Law Enforcement', neg: 'Civil Liberties' },
    y: { pos: 'Institutional',   neg: 'Direct Action' },
    z: { pos: 'Delivering',      neg: 'Gap' },
  },

  // ── Predicate table ────────────────────────────────────
  // Types: T=Trigger, B=Substrate, M=Mechanism, V=Void, C=Contradiction, F=Frame
  // Axis loadings: 1=positive, 0=neutral, -1=negative
  // Operative predicates position relative to O; F predicates relative to O'
  predicates: {
    operative: [
      {
        type: 'T', id: 'T1',
        label: 'Federal agents killed citizen during enforcement operation',
        x: 1, y: 1, z: 1,
      },
      {
        type: 'B', id: 'B1',
        label: 'Citizen was legal gun carrier (2A complication)',
        x: 1, y: 0, z: 0,
      },
      {
        type: 'M', id: 'M1',
        label: 'Institutional self-protection sequence (P3–P7: evidence suppression, identity withholding, self-investigation, obstruction of state investigation, pre-classification)',
        x: 0, y: 1, z: 1,
        instances: 5,   // five predicates share Y[+] Z[+] structure
      },
      {
        type: 'C', id: 'C1',
        label: '2A commitment vs. enforcement action — enforcement killed a gun owner exercising a right the enforcement-aligned position treats as foundational',
        x: 1, y: 0, z: 0,
        tension: true,  // internal contradiction — reduces magnitude in positioning
      },
    ],
    stated: [
      {
        type: 'F', id: 'F1',
        label: 'Lawful operation encountered dangerous situation',
        x: 1, y: 0, z: 0,
      },
      {
        type: 'F', id: 'F2',
        label: 'Tragic outcome occurred',
        x: 0, y: 0, z: 0,
      },
      {
        type: 'F', id: 'F3',
        label: 'Matter is under review',
        x: 0, y: 1, z: 0,
      },
      {
        type: 'F', id: 'F4',
        label: 'Classified as potential domestic terrorism',
        x: 1, y: 1, z: -1,
      },
    ],
  },

  // ── Diffraction output — four positions ────────────────
  // Quadrant mapping: A=upper-left (LI), B=upper-right (RI),
  //                   C=lower-left (LP), D=lower-right (RP)
  // NOTE: Factory color fix required — swap A/B in PIN_COLORS,
  //       quadColors, WORD_COLORS, corner label colors.
  positions: [
    {
      id: 'RI',
      quadrant: 'B',
      concordance: { obj: '(+1,+1,+1)', shd: '(+1,+1,-1)' },
      concordanceType: 'concordant-concordant-delivery',
      gap: { x: -0.10, y: 0.12, z: 1.02 },
      gapDominant: 'Z',
      fluid: 'Complicity',
      denominated: 'Credulity',
      binary: 'complicity vs. credulity',
      distinguishability: 'Fluid',
      status: 'complete',
      note: 'RI owns the machinery (+X,+Y). Object diagnostic splits on Z: is institutional output product or process? Fluid: will you name what the machinery produces. Denominated: will you believe its self-description. Low distinguishability — from inside RI, the boundary is nearly invisible.',
      boundaryDescription: 'The Invisible Threshold. Both readings claim (+X,+Y) — both procedurally oriented, both own the machinery. Entire distance on Z: whether institutional output is product or process. From inside RI, the machinery appears to function either way. Coalition zone is comfortable — credulity feels like procedural trust. Denomination is stable because the boundary is experientially absent.',
      fluidKeywords: [
        { text: 'product', weight: 0.9 },
        { text: 'naming', weight: 0.8 },
        { text: 'machinery', weight: 0.7 },
        { text: 'concealment', weight: 0.6 },
        { text: 'operative', weight: 0.5 },
      ],
      denomKeywords: [
        { text: 'process', weight: 0.9 },
        { text: 'procedure', weight: 0.7 },
        { text: 'trust', weight: 0.8 },
        { text: 'review', weight: 0.5 },
        { text: 'functioning', weight: 0.6 },
      ],
    },
    {
      id: 'LI',
      quadrant: 'A',
      concordance: { obj: '(-1,+1,+1)', shd: '(-1,+1,-1)' },
      concordanceType: 'discordant-concordant-delivery',
      gap: { x: 0.10, y: 0.12, z: 1.02 },
      gapDominant: 'Z',
      fluid: 'Reckoning',
      denominated: 'Self-correction',
      binary: 'reckoning vs. self-correction',
      distinguishability: 'Oscillation zone',
      status: 'complete',
      note: 'LI owns the institutional channel (-X,+Y) but not the policy. The channel is delivering concealment. Reckoning: accountability must transcend the channel. Self-correction: the channel can redirect itself. At high Diatribe intensity, self-correction overshoots into institutional abandonment (LI→LP migration).',
      boundaryDescription: 'The Unstable Surface. Fork is legible: external accountability vs. internal reform. Unstable because Z-delivery under Y-concordance means pushing self-correction reveals channel complicity. Coalition zone sustainable at moderate Diatribe, collapses at high intensity (LI→LP migration). Boundary is a ramp, not a wall.',
      fluidKeywords: [
        { text: 'external', weight: 0.9 },
        { text: 'transcend', weight: 0.8 },
        { text: 'confronting', weight: 0.7 },
        { text: 'independent', weight: 0.6 },
        { text: 'accountability', weight: 0.5 },
      ],
      denomKeywords: [
        { text: 'reform', weight: 0.9 },
        { text: 'redirect', weight: 0.7 },
        { text: 'review', weight: 0.6 },
        { text: 'institutional', weight: 0.8 },
        { text: 'capacity', weight: 0.5 },
      ],
    },
    {
      id: 'LP',
      quadrant: 'C',
      concordance: { obj: '(-1,-1,+1)', shd: '(-1,-1,-1)' },
      concordanceType: 'discordant-discordant-delivery',
      gap: { x: 0.10, y: -0.12, z: 1.02 },
      gapDominant: 'Z',
      fluid: 'Specific',
      denominated: 'Symptomatic',
      binary: 'engagement vs. absorption',
      distinguishability: 'Oscillation zone',
      status: 'complete',
      note: 'LP owns nothing (-X,-Y). Specific: P3–P7 as particular operative sequence — these officers, this evidence, this obstruction. Symptomatic: P3–P7 as instances of structural pattern — state violence, institutional impunity, cover-up as standard output.',
      boundaryDescription: 'The Analytical Fork. Both readings are genuine analytical choices. Most intellectually stable boundary on CS01 — double-discordance removes ownership stakes. Coalition zone: tracking the case while recognizing the pattern. Risk is absorption: symptomatic reading swallows specific, replacing procedural engagement with discursive confirmation.',
      fluidKeywords: [
        { text: 'particular', weight: 0.9 },
        { text: 'evidence', weight: 0.8 },
        { text: 'prosecute', weight: 0.7 },
        { text: 'these officers', weight: 0.6 },
        { text: 'this case', weight: 0.5 },
      ],
      denomKeywords: [
        { text: 'pattern', weight: 0.9 },
        { text: 'structural', weight: 0.8 },
        { text: 'systemic', weight: 0.7 },
        { text: 'confirmation', weight: 0.6 },
        { text: 'instance', weight: 0.5 },
      ],
    },
    {
      id: 'RP',
      quadrant: 'D',
      concordance: { obj: '(+1,-1,+1)', shd: '(+1,-1,-1)' },
      concordanceType: 'concordant-discordant-delivery',
      gap: { x: -0.10, y: -0.12, z: 1.02 },
      gapDominant: 'Z',
      fluid: 'Betrayal',
      denominated: 'Exceptionalism',
      binary: 'betrayal vs. exceptionalism',
      distinguishability: 'Denominated dominant',
      status: 'complete',
      note: 'Maximum contradiction position. RP owns enforcement (+X) but not the institutional channel (-Y). C1 most acute: enforcement killed a gun owner, concealment runs through channels RP cannot access. Betrayal: apparatus broke the compact, Z-delivery means concealment is institutional not accidental. Exceptionalism: aberration, not indictment.',
      boundaryDescription: 'The Violent Threshold. C1 makes boundary existential — cannot hold both readings simultaneously. Coalition zone does not exist in stable form. At conviction-band Diatribe, subject forced to resolve. Boundary is violent because C1 prevents readings from coexisting — each structurally excludes the other.',
      fluidKeywords: [
        { text: 'compact', weight: 0.9 },
        { text: 'violation', weight: 0.8 },
        { text: 'constitutional', weight: 0.7 },
        { text: 'broken', weight: 0.6 },
        { text: 'institutional', weight: 0.5 },
      ],
      denomKeywords: [
        { text: 'aberration', weight: 0.9 },
        { text: 'exception', weight: 0.8 },
        { text: 'sound', weight: 0.7 },
        { text: 'isolated', weight: 0.6 },
        { text: 'intact', weight: 0.5 },
      ],
    },
  ],

  // ── Structural findings ────────────────────────────────
  findings: [
    'CS01 is a Z-inversion event — shadow holds Y nearly intact (ΔY=-0.12) and inverts Z (ΔZ=-1.02).',
    'Z-sign divergence is visible at concordance level — object σ_Z=+1 everywhere, shadow σ_Z=-1 everywhere.',
    'Diagnostic character varies by concordance type, not by Z — RI and LP share Δw structure but differ structurally.',
    'Complicity vs. credulity (RI): corrected from accountability vs. containment. Delivery changes the binary.',
    'LI overshoot: at high Diatribe, self-correction collapses Y-concordance into Y-discordance (LI→LP migration).',
    'RP editorial labels (Betrayal/Exceptionalism) confirmed by formal pipeline derivation.',
    'LI fluid label corrected from Accountability to Reckoning — encodes Z-delivery dimension.',
  ],

  // ── Pipeline metadata ──────────────────────────────────
  pipeline: {
    refractionComplete: true,
    diffractionComplete: true,
    positionsComplete: 4,       // of 4
    boundaryDescriptions: 4,    // of 4 — complete
    coordinateSubjects: 8,      // of 8 — all resolved
    version: 'Refraction Grammar v1 / Closed Form v1.2',
  },
};

// Self-register when loaded in gallery context
if (typeof PrismTraces !== 'undefined' && PrismTraces.register) PrismTraces.register(CS01_TRACE);

// Export for use in DreamGetty or other consumers
if (typeof module !== 'undefined') module.exports = CS01_TRACE;
