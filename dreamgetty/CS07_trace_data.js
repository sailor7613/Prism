// ============================================================
// CS07 — Complete Refraction-Diffraction Trace Data
// Pipeline output: Parameters project → DreamGetty renderer
//
// Event: Islamabad Memorandum / Hormuz Reopening / US–Iran Ceasefire
// Shadow object: Hormuz-as-peace (the Strait is open, the war is ending).
// Real object:   The petrogas-dollar (capture of the seaborne energy
//                market and the currency it settles in).
// Event type:    Z-PROJECTION — the structural complement of CS01's
//                Z-inversion. Shadow HOLDS the delivery sign (+Z) and
//                recodes the X-vehicle (imperial → humanitarian). A
//                realized object hidden behind a realized shadow.
// Status: All four positions pipeline-complete. First trace to exercise
//         the candidate third gap type (projection gap).
// Date: June 19, 2026
// ============================================================

const CS07_TRACE = {
  id: 'CS07',
  label: 'Islamabad Memorandum / Hormuz Reopening',
  eventType: 'Z-projection',
  prevalentAxis: 'Y',

  shadowObject: 'Hormuz-as-peace — the Strait reopened, relief, the war winding down',
  realObject: 'The petrogas-dollar — US capture of seaborne energy supply and its settlement currency',

  // ── Refraction output ──────────────────────────────────
  object:  { x: 0.55, y: 0.85, z: 0.85 },   // Y-prevalent, Z-delivering (the petrogas-dollar)
  shadow:  { x: -0.35, y: 0.70, z: 0.55 },   // X-recoded (imperial→humanitarian), Z-HELD positive (still "realized")

  transform: {
    dx: -0.90,   // shadow recodes the imperial/national-security vehicle as humanitarian/diplomatic
    dy: -0.15,   // shadow attenuates the institutional/apparatus reading slightly ("diplomacy," not "machinery")
    dz: -0.30,   // delivery sign PRESERVED — both object and shadow read realized; this is the projection gap
    primary: 'Z-projection',
    description: 'Shadow swaps the X-vehicle (imperial → humanitarian) while preserving the delivery sign (still +Z). A realized object concealed behind a realized shadow — the projection gap. Distinct from CS01: the Z-sign is held, not flipped. A frustrated shadow would trip the alarm; a realized shadow is never audited.',
  },

  // ── Axis semantics (per-event, overrides factory defaults) ──
  axes: {
    x: { pos: 'National Security / Enforced Order', neg: 'Anti-Imperial / Humanitarian' },
    y: { pos: 'Institutional Stabilizers',          neg: 'Populist Skeptics' },
    z: { pos: 'Substrate · delivering',             neg: 'Surface · the peace' },
  },

  // ── Predicate table ────────────────────────────────────
  // Types: T=Trigger, B=Substrate, M=Mechanism, V=Void, C=Contradiction, F=Frame
  // Axis loadings: 1=positive, 0=neutral, -1=negative
  // Operative predicates position relative to O; F predicates relative to O' (shadow)
  predicates: {
    operative: [
      {
        type: 'T', id: 'T1',
        label: 'Strait of Hormuz reopened toll-free for 60 days under US-brokered ceasefire; blockade lifted but fleet remains (Hegseth: blockade posture continues)',
        x: 1, y: 1, z: 1,
      },
      {
        type: 'B', id: 'B1',
        label: 'US LNG captured ~half of European import share (27%→48%+) after Nord Stream\'s end; seaborne, dollar-priced spot market replaced the pipeline corridor',
        x: 1, y: 1, z: 1,
      },
      {
        type: 'B', id: 'B2',
        label: 'Dollar reserve share fell below 57% (first since 1995) even as Washington moved to monopolize the alternative seaborne supply — the petrogas-dollar bet',
        x: 1, y: 0, z: 1,
      },
      {
        type: 'M', id: 'M1',
        label: 'Pressure-valve sequence: open the chokepoint just enough to keep the global market clearing while the takeover sets — $300B Gulf-funded fund, sanctions relief, Iran–China program, frozen-asset release',
        x: 0, y: 1, z: 1,
        instances: 4,
      },
      {
        type: 'C', id: 'C1',
        label: 'America-First vehicle vs. corporate beneficiary — the energy spoils accrue to Chevron and LNG traders, not the citizen at the pump; the fleet does not come home',
        x: 1, y: -1, z: 0,
        tension: true,
      },
    ],
    stated: [
      {
        type: 'F', id: 'F1',
        label: 'A peace framework was signed; the war is ending',
        x: 0, y: 0, z: 0,
      },
      {
        type: 'F', id: 'F2',
        label: 'The Strait is open and tankers move again — relief, stabilized prices',
        x: -1, y: 0, z: 0,
      },
      {
        type: 'F', id: 'F3',
        label: 'Diplomacy and reconstruction beat endless war',
        x: -1, y: 1, z: 0,
      },
      {
        type: 'F', id: 'F4',
        label: 'The nuclear question — the casus belli — is deferred to good-faith talks',
        x: 0, y: 1, z: -1,
      },
    ],
  },

  // ── Diffraction output — four positions ────────────────
  // Quadrant mapping: A=upper-left (LI), B=upper-right (RI),
  //                   C=lower-left (LP), D=lower-right (RP)
  // gap.z = +0.30 everywhere — the projection gap (small, SAME-SIGN),
  //         the structural inverse of CS01's constant +1.02 inversion.
  positions: [
    {
      id: 'RI',
      quadrant: 'B',
      concordance: { obj: '(+1,+1,+1)', shd: '(-1,+1,+1)' },
      concordanceType: 'concordant-concordant-projection',
      gap: { x: -0.90, y: 0.15, z: 0.30 },
      gapDominant: 'X',
      fluid: 'Conquest',
      denominated: 'Deterrence',
      binary: 'the market we cornered vs. peace through strength',
      distinguishability: 'Oscillation zone',
      status: 'complete',
      note: 'RI owns the real object (+X,+Y,+Z) — the apparatus that executed the energy capture. It can name what was actually won ("the market we cornered, the occupation of the sea lanes") but denominates into deterrence: maximum pressure worked, Iran signed under the guns, the deferred nuclear file is leverage retained. The gap is X-dominant — to denominate, RI must recode its own conquest as "peace through strength."',
      boundaryDescription: 'The Owner\'s Choice. RI sits on the real object and can see it plainly; the boundary is whether to name the conquest or dress it as deterrence. Oscillation zone — at moderate Diatribe the hawk says the quiet part ("name what was won"); at conviction band it collapses into "surrender / the toll booth pays." Naming is available but costly, because to name the object is to admit the war was never about the centrifuge.',
      fluidKeywords: [
        { text: 'the market we cornered', weight: 0.9 },
        { text: 'occupation of the sea lanes', weight: 0.8 },
        { text: 'what was won', weight: 0.7 },
        { text: 'LNG', weight: 0.6 },
        { text: 'dominance', weight: 0.5 },
      ],
      denomKeywords: [
        { text: 'deterrence', weight: 0.9 },
        { text: 'maximum pressure', weight: 0.8 },
        { text: 'on our terms', weight: 0.7 },
        { text: 'leverage', weight: 0.6 },
        { text: 'peace through strength', weight: 0.5 },
      ],
    },
    {
      id: 'LI',
      quadrant: 'A',
      concordance: { obj: '(-1,+1,+1)', shd: '(-1,+1,+1)' },
      concordanceType: 'identity-coordinate-projection',
      gap: { x: 0.90, y: 0.15, z: 0.30 },
      gapDominant: 'X',
      fluid: 'Cover',
      denominated: 'Vindication',
      binary: 'the relief is the cover vs. diplomacy worked',
      distinguishability: 'Projection-blind',
      status: 'complete',
      note: 'LI owns the institutional/diplomatic channel (-X,+Y) and is the LONE REALIZER of the shadow. Because the shadow object is left-coded humanitarian relief — LI\'s own home — object and shadow occupy nearly identical coordinates for LI, and the peace is genuinely real. So the boundary is nearly invisible from inside LI: the realized shadow reports success and the eye stops looking. To see the object, LI must cross the entire X-axis (gap.x +0.90) to the imperial substrate it cannot believe its own side authored.',
      boundaryDescription: 'The Invisible Threshold (projection form). The CS07 signature. LI\'s fluid and denominated readings share coordinates — the cover and the vindication look the same, because the peace is real. Projection-blind: a frustrated shadow would alarm LI, but a realized one is never audited. Coalition zone is dangerously comfortable — "take the win" feels like maturity. The boundary is experientially absent, not because LI is dishonest but because good news does not get inspected.',
      fluidKeywords: [
        { text: 'the relief is the cover', weight: 0.9 },
        { text: 'still in the water', weight: 0.8 },
        { text: 'routes through', weight: 0.7 },
        { text: 'the fleet', weight: 0.6 },
        { text: 'what is it for', weight: 0.5 },
      ],
      denomKeywords: [
        { text: 'diplomacy worked', weight: 0.9 },
        { text: 'de-escalation', weight: 0.8 },
        { text: 'take the win', weight: 0.7 },
        { text: 'corridor of time', weight: 0.6 },
        { text: 'relief', weight: 0.5 },
      ],
    },
    {
      id: 'LP',
      quadrant: 'C',
      concordance: { obj: '(-1,-1,+1)', shd: '(-1,-1,+1)' },
      concordanceType: 'discordant-discordant-projection',
      gap: { x: 0.10, y: -0.15, z: 0.30 },
      gapDominant: 'Z',
      fluid: 'Substrate',
      denominated: 'Absorption',
      binary: 'name the petrogas-dollar vs. slogan it away',
      distinguishability: 'Analytical fork',
      status: 'complete',
      note: 'LP owns nothing (-X,-Y) and therefore sees the substrate most clearly — double-discordance removes the ownership stakes that blind LI. Shares LI\'s object/shadow coordinates yet reads them as analytically distinct: the open Strait is a pressure valve, the real object is the petrogas-dollar, "Iran controls Hormuz" is a sentence the US Navy is standing inside of. The failure mode is absorption — naming the heist hardens into a slogan ("armed robbery") that waves away that a real ceasefire stopped real shelling.',
      boundaryDescription: 'The Analytical Fork. Most intellectually stable boundary on CS07 — LP can hold "the relief is real AND the relief is the cover" without ownership distortion. Coalition zone: track the substrate while crediting the ceasefire. Risk is absorption: the substrate reading swallows the specific, replacing checkable factors (LNG share, reserve share, settlement currency) with confirmation that it was all a heist. Hold both, or lose the room.',
      fluidKeywords: [
        { text: 'pressure valve', weight: 0.9 },
        { text: 'petrogas-dollar', weight: 0.8 },
        { text: 'in what currency', weight: 0.7 },
        { text: 'who profits', weight: 0.6 },
        { text: 'substrate', weight: 0.5 },
      ],
      denomKeywords: [
        { text: 'armed robbery', weight: 0.9 },
        { text: 'slogan', weight: 0.7 },
        { text: 'absorption', weight: 0.6 },
        { text: 'reflex', weight: 0.6 },
        { text: 'confirmation', weight: 0.5 },
      ],
    },
    {
      id: 'RP',
      quadrant: 'D',
      concordance: { obj: '(+1,-1,+1)', shd: '(-1,-1,+1)' },
      concordanceType: 'concordant-discordant-projection',
      gap: { x: -0.90, y: -0.15, z: 0.30 },
      gapDominant: 'X',
      fluid: 'Racket',
      denominated: 'Victory',
      binary: 'a racket for Chevron vs. a win for America',
      distinguishability: 'Violent threshold',
      status: 'complete',
      note: 'Maximum-contradiction position. RP owns the enforcement vehicle (+X) but not the institutional channel (-Y). C1 is acute: the open Strait and the seized oil are American "strength," yet the spoils route to Chevron and the LNG traders while the citizen pays at the pump and the fleet never comes home. Racket: the apparatus broke the America-First compact and the war\'s gains are corporate. Victory: Trump won, America controls the energy, take the win.',
      boundaryDescription: 'The Violent Threshold. C1 makes the boundary existential — RP cannot hold "win for America" and "racket for Chevron" at once. No stable coalition zone: at conviction-band Diatribe the subject is forced to resolve, and the spectacle apparatus (Pattern #9) usually converts the contradiction to compliance ("62% of the world\'s oil — take the win"). The boundary is violent because the two readings structurally exclude each other.',
      fluidKeywords: [
        { text: 'forever-deployment', weight: 0.9 },
        { text: 'who this peace is for', weight: 0.8 },
        { text: 'at the pump', weight: 0.7 },
        { text: 'Chevron', weight: 0.6 },
        { text: 'your money', weight: 0.5 },
      ],
      denomKeywords: [
        { text: '62% of the oil', weight: 0.9 },
        { text: 'Trump won', weight: 0.8 },
        { text: 'America First', weight: 0.7 },
        { text: 'take the win', weight: 0.6 },
        { text: 'strength', weight: 0.5 },
      ],
    },
  ],

  // ── Structural findings ────────────────────────────────
  findings: [
    'CS07 is a Z-projection event — the shadow HOLDS the delivery sign (+Z) and recodes the X-vehicle (imperial→humanitarian, ΔX=-0.90). The structural complement of CS01\'s Z-inversion.',
    'The projection gap: real object (petrogas-dollar, Z=+0.85) and shadow object (Hormuz-as-peace, Z=+0.55) BOTH read realized. Sign agreement is the camouflage — a frustrated shadow trips the alarm; a realized shadow is never audited. gap.z = +0.30 everywhere (vs CS01\'s +1.02 inversion).',
    'LI (A) and LP (C) share identical object/shadow coordinates yet diverge in legibility: LI is projection-blind (owns the institutional channel; the realized peace blinds it), LP names the substrate cleanly (double-discordance removes ownership stakes). Legibility varies by ownership, not coordinates.',
    'RI (B) owns the real object and can name it ("the market we cornered") but denominates into deterrence / peace-through-strength. Naming the object means admitting the war was never about the centrifuge.',
    'RP (D) carries maximum contradiction (C1): America-First vehicle, corporate beneficiary. Violent threshold — "win for America" and "racket for Chevron" structurally exclude each other.',
    'Hormuz promoted from substrate (CS04, where nuclear framing suppressed it) to mask (CS07, where it suppresses the petrogas-dollar). The same referent can be real object at one scale and shadow object at another.',
    'Candidate third gap type — PROJECTION GAP — validated here. Distinct from intrinsic (Object Z) and relational (legislator-gap). Recommend §4.5 extension only after a second projection instance confirms.',
  ],

  // ── Projection-gap diagnostic (CS07-specific) ──────────
  projectionGap: {
    objectZ: 0.85,        // real object — petrogas-dollar — realized
    shadowZ: 0.55,        // shadow object — Hormuz-as-peace — also realized
    gap: 0.30,            // magnitude is secondary
    signAgreement: true,  // THE load-bearing feature — both realized, so the shadow hides the object
    homeQuadrant: 'A',    // LI is projection-blind — where the gap is least legible
    clearestQuadrant: 'C',// LP names the substrate — where the gap is most legible
  },

  // ── Pipeline metadata ──────────────────────────────────
  pipeline: {
    refractionComplete: true,
    diffractionComplete: true,
    positionsComplete: 4,       // of 4
    boundaryDescriptions: 4,    // of 4 — complete
    coordinateSubjects: 8,      // of 8 — all resolved
    version: 'Refraction Grammar v1 / Closed Form v1.2 — projection extension (candidate)',
  },
};

// Self-register when loaded in gallery context
if (typeof PrismTraces !== 'undefined' && PrismTraces.register) PrismTraces.register(CS07_TRACE);

// Export for use in DreamGetty or other consumers
if (typeof module !== 'undefined') module.exports = CS07_TRACE;
