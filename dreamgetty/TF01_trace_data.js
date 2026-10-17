// ============================================================
// TF01 — The Maximum-Pressure Order
// The first native traceframe. PG01 candidate member (admission
// runs after authoring — no admission by resemblance, including
// its own arc's).
//
// Series: TF (ruled 2026-08-18 — born sharp, derived from the
// membrane payload, never from any legacy trace's shape).
// Canonical source: Parameters/04_Traces/TF01/ · villa copy:
// DreamGetty/dreamgetty/ · DEPLOY copy at next deploy.
//
// STATUS: IN AUTHORING — live session, Sailor + Claude, begun
// 2026-08-18. This file is the working state of the authoring
// conversation; it updates as rulings land. Frame RULED · axes
// RULED · predicates sourced · REFRACTION RUN · DIFFRACTION RUN
// · LI VERIFICATION · DIATRIBE PASS (all 2026-08-18).
// Owed: admission to PG01. The villa renders what exists, no more.
//
// THE MOMENT (ruled as frame one, 2026-08-18): the presidential
// directive to Treasury — maximum economic pressure on Iran.
// Candidate date 2025-02-04 (NSPM-2 signing; pin at authoring).
// The frame fact, plainly: declared as RUPTURE ("maximum
// pressure," as if the prior two administrations had not run
// sanctions continuously) while the economic substrate runs
// CONTINUOUS. The gap between the declared illumination and the
// substrate is this trace's opening finding-candidate — the
// CS04 Event-4 pattern (continuity invisible through partisan
// coding), operating at the petrogas-dollar's own layer.
// Economic predicates sourceable at authoring: designations,
// oil-export volumes to China, shadow-fleet enforcement.
// ============================================================

const TF01_TRACE = {
  id: 'TF01',
  label: 'The Maximum-Pressure Order',
  eventType: 'Z-assertion',    // rendered — keep short. Derived 2026-08-18, provisional until diffraction corroborates
  eventTypeExtended: 'Z-assertion (refraction, 2026-08-18): the shadow pre-credits undelivered pressure. Snapshot frame; candidate PG01 member; admission after authoring.',
  prevalentAxis: 'Y',           // Y +0.90 carries the structure; the drama plays on Z

  // ── Diatribe — PASS RUN 2026-08-18 (Sailor ruled the five numbers) ──
  dia: {
    composite: 60,              // oscillation zone — right for a moment whose object is latent:
                                // the high station scores are denomination about the FRAME
                                // (rupture vs continuity), not about an object almost nobody
                                // has detected. Latency caps denomination.
    note: 'Arc-facing prediction hook: as detection arrives in later frames, watch whether the ' +
      'scores climb — post-detection unreadability (PG01 P1) says they hold or worsen even ' +
      'after M3. Trump unscored (constitutive, Enrollment). Bessent unscored: no day-of ' +
      'reading of the order in evidence — itself mildly interesting, given who he becomes.',
  },

  // ── THE FRAME — required, Trace_Data_Schema_v2 §2. Born sharp. ──
  frame: {
    declared: 'Maximum pressure — the directive presented as rupture with predecessor policy',
    contested: ['continuity (the stated register: the same pressure, declared continuously across three administrations)'],
    asOfDate: '2026-08-18',
    window: {
      // RULED 2026-08-18 (Sailor): the signing day alone. Day-of and week-after
      // readings enter as readings OF the moment even though they postdate it —
      // the window bounds the imprint, not the readers (TS01 precedent).
      start: '2025-02-04',
      end:   '2025-02-04',
    },
  },

  lifecycle: { status: 'live', closedDate: null, closingFindings: [] },

  // ── Refraction output — RUN 2026-08-18 (Sailor ruled the placement) ──
  object:  { x: 0.70, y: 0.90, z: 0.25 },
  // X +0.70: the order IS coercion-first, proudly. Y +0.90: pure executive
  // sanctions apparatus. Z +0.25: delivery genuinely open at signing — the
  // order declares pressure while B2 says the recent operative record is gap;
  // modestly positive on B1's proof the instrument works when enforced.
  shadow:  { x: 0.85, y: 0.75, z: 0.85 },
  transform: {
    dx: 0.15,    // shadow sharpens partisan coding — rupture means "unlike the weak predecessors"
    dy: -0.15,   // shadow personalizes: the apparatus's continuous instrument becomes one president's will
    dz: 0.60,    // PRIMARY — Z-assertion: the frame asserts delivery as already assured; the record holds it open
    primary: 'Z-assertion',
    description: 'The rupture frame (F1) inflates Z rather than inverting it: delivery declared as fait accompli while the operative record (B2) runs the other way. Structural inverse of TS01\'s Z-inversion — there the shadow denied a delivering object; here it pre-credits an undelivered one. Shadow x/y completed in-session: sharpened partisan coding, personalized apparatus.',
  },

  // ── Axis semantics — RULED 2026-08-18 (Sailor) ──
  axes: {
    x: { pos: 'Coercion-first', neg: 'Diplomacy-first' },
    y: { pos: 'Sanctions apparatus', neg: 'Affected populations' },
    z: { pos: 'Delivering', neg: 'Gap' },
    // Z is literally instrumented on this trace: barrels-per-day IS the
    // delivery metric. Pressure realized = exports fall; gap = oil flows.
  },

  // ── Predicate table — first sourced pass, 2026-08-18 ──
  // Types: T=Trigger, B=Substrate, F=Frame. Loadings relative to O (F: to O').
  predicates: {
    operative: [
      {
        type: 'T', id: 'T1',
        label: 'NSPM-2 signed 2025-02-04 — "Imposing Maximum Pressure on the Government of the Islamic Republic of Iran." Treasury directed to "immediately impose sanctions or appropriate enforcement remedies on all persons" and run "a robust and continual sanctions enforcement campaign"; relief guidance rescinded.',
        x: 1, y: 1, z: 0,   // z 0: at signing, delivery is the question posed, not a fact
        note: 'Structural wrinkle, recorded: the drive-exports-to-zero campaign ("including exports of Iranian crude to the People\'s Republic of China") is formally assigned to STATE; Treasury holds the enforcement campaign. The order-to-Bessent thread is the enforcement thread — and it is the thread the worldline follows to M3.',
      },
      {
        type: 'B', id: 'B1',
        label: 'First maximum-pressure era, operative record: Iran petroleum revenue collapsed to ~$16bn in 2020. The instrument works when enforced.',
        x: 1, y: 1, z: 1,
      },
      {
        type: 'B', id: 'B2',
        label: 'The enforcement gap, 2021–2024: ~$144bn in petroleum sales 2021–2023 (~$100bn above the prior two years); crude/condensate exports more than tripled 2020→2023 to ~1.59 mbpd; ~1.7 mbpd as of the EIA SHIP Act report (Oct 2024). Sanctions on the books throughout.',
        x: 0, y: 1, z: -1,  // x 0: the slack ran under bipartisan stated pressure
      },
      {
        type: 'B', id: 'B3',
        label: 'The gap was on the congressional record, conceded in writing, a year before the order: bipartisan letter to Biden, 2024-02-01, demanding stronger enforcement — "Iran is now exporting on average more than 1.4 million barrels of crude oil per day, two-thirds of which ends up in the People\'s Republic of China"; ~$88bn in oil revenue Feb 2021–Oct 2023; Iranian economy +4%/yr, FX reserves +45%. FIVE DEMOCRATS SIGNED (Hassan, Rosen, Casey, Fetterman, Cortez-Masto), alongside Risch, Rubio, Hagerty.',
        x: 0, y: 1, z: -1,
        note: 'Corroborates B2 from a wholly independent instrument (a Senate letter, not the EIA report) — two instruments, same finding, which is what warrant looks like. Load-bearing for LI: the position did not merely fail to make the continuity argument in Feb 2025; members of the caucus had already signed the opposite. Also the origin of two worldlines (see findings). Dated 2024-02-01.',
      },
      {
        type: 'C', id: 'C1',
        label: 'The trigger hedges itself: at the signing Trump says he is "torn," hopes he will not have to enforce the memo, and writes that he would "much prefer a Verified Nuclear Peace Agreement." Maximum pressure declared and half-disavowed in one breath — F1 contradicted by its own author inside the window.',
        x: -1, y: 1, z: 0,
        tension: true,
        note: 'Load-bearing for RP (the deal-not-war reading is performed from the podium itself) and for the arc: the operator stages pressure as the alternative to war at frame one; by M3 the same apparatus names what the pressure was for.',
      },
    ],
    stated: [
      {
        type: 'F', id: 'F1',
        label: 'Rupture frame — "maximum pressure is BACK": the order presented as decisive break with predecessor weakness. Conceals the stated-register continuity (pressure was declared throughout) and asserts delivery to come.',
        x: 1, y: 1, z: 1,
      },
    ],
  },

  // ── Positions — DIFFRACTION RUN 2026-08-18 (Sailor ruled the draft) ──
  // Day-of / first-week readings of the order. LI carries a thin-sweep
  // caveat (see its note); everything else sourced in the 08-18 sweep.
  positions: [
    { id: 'LI', quadrant: 'A', status: 'complete',
      permeability: { magnitude: 0.10, mode: 'vacancy' },
      internalSpread: 'low — the register is silence; little variance in nothing',
      fluid: 'Continuity-naming',
      denominated: 'Affordable silence',
      binary: 'naming the continuity vs. affording the silence',
      dia: { composite: 68, spread: null,
        note: 'Tier floor, deliberately: structural foreclosure, not an active vehicle. ' +
          'Nobody at LI is spinning — B3 shows the counter-argument was signed away a year ' +
          'early. The silence dominates completely (the tier) with no machinery running ' +
          '(the floor).' },
      distinguishability: 'Denominated dominant',
      concordance: { obj: '(+1,+1, 0)', shd: '(+1,+1,+1)' }, concordanceType: 'shadow-concordant-by-absence',
      gap: { x: 0, y: 0, z: 0.25 }, gapDominant: 'Z',
      boundaryDescription:
        'Naming the continuity — "this was our stated policy too," which deflates the rupture ' +
        'frame overnight — versus the silence the position can actually afford. Criticizing the ' +
        'order concedes B2. And B3 shows the concession was ALREADY MADE, in writing: five ' +
        'Democratic senators signed the 2024 letter citing 1.4 mbpd and $88bn, demanding harder ' +
        'enforcement. The fluid reading is not merely unaffordable — it was surrendered a year ' +
        'early. Vacancy here is not ignorance; it is a position that spent its own ammunition. ' +
        'Anti-valence structural, the TS01-LI shape, visible seventeen months earlier.',
      note: 'VERIFICATION PASS RUN 2026-08-18, caveat lifted with its bound stated: a targeted ' +
        'sweep for institutional-left response to NSPM-2 in its own window returned nothing — ' +
        'searches surfaced material from adjacent periods (2021 post-mortems, 2026 war powers) ' +
        'but no day-of reading. Vacancy AT THE MOMENT stands. Cross-frame mode observation, ' +
        'arc-facing not trace-level: when LI does engage this object economically it is ' +
        'SURFACE-BOUND, and its critique runs in the more-enforcement direction — a shape that ' +
        'structurally cannot ask what the instrument is for. (Evidence accrues to PG01, not ' +
        'here: it postdates this window and moves no coordinate — closure rule.)',
      subjects: [
        { name: 'Democratic leadership, day-of', role: 'reader', mode: 'vacancy',
          note: 'No prominent pushback surfaced; the position\'s own record forecloses the critique.' },
      ] },
    { id: 'RI', quadrant: 'B', status: 'complete',
      permeability: { magnitude: 0.35, mode: 'aligned' },
      internalSpread: 'moderate — celebrants and compliance-parsers, one register apart',
      fluid: 'Instrument accounting',
      denominated: 'Rupture celebration',
      binary: 'the instrument has a record vs. the weakness has ended',
      dia: { composite: 70, spread: { min: 25, max: 80 },
        note: 'Celebrants ~80 — "history proves" is B1 recited without B2, active denomination ' +
          'against the station\'s own published evidence. Compliance bar ~25 — professionally ' +
          'fluid, method-occluded. The spread crosses two tiers.' },
      distinguishability: 'Denominated dominant',
      concordance: { obj: '(+1,+1, 0)', shd: '(+1,+1,+1)' }, concordanceType: 'shadow-concordant',
      gap: { x: 0.15, y: 0, z: 0.6 }, gapDominant: 'Z',
      boundaryDescription:
        'Holding the instrument to its own record — enforced, it collapses revenue to $16bn; ' +
        'idle, it leaks $144bn — versus celebrating the rupture, which requires not reading the ' +
        'gap numbers the station\'s own institutions published in October. The evidence sits ' +
        'in-station, dated, and unassembled: RI reads the shadow, not the object.',
      note: 'Sanctions bar (Crowell, Steptoe, Winston) parses compliance mechanics with intent ' +
        'bracketed — instrument-tuning, not examination. Same facet split as TS01-RI (Miran: price, not reach).',
      subjects: [
        { name: 'Gen. Jack Keane', role: 'reader', mode: 'aligned', note: '"Absolutely first-rate"; strategic-offensive framing, day-of on Fox.' },
        { name: 'Rep. Nancy Mace', role: 'reader', mode: 'aligned', note: '"History proves" celebration; the record cited is B1 without B2.' },
        { name: 'Sanctions bar (Crowell/Steptoe/Winston)', role: 'reader', mode: 'method-occluded', note: 'Compliance parsing; the instrument\'s purpose bracketed by professional convention.' },
      ] },
    { id: 'LP', quadrant: 'C', status: 'complete',
      permeability: { magnitude: 0.65, mode: 'open' },
      internalSpread: 'moderate — siege-naming and madness-reading coexist',
      fluid: 'Instrument-naming',
      denominated: 'Unprecedented-madness',
      binary: 'the sanction is the war vs. the madman is the story',
      dia: { composite: 40, spread: { min: 20, max: 60 },
        note: 'Siege-namers reach in good faith (~20); madness-readers co-sign the rupture ' +
          'frame they think they are attacking (~60). The fork is genuinely live.' },
      distinguishability: 'Oscillation zone',
      concordance: { obj: '(+1,+1, 0)', shd: '(−1, 0, 0)' }, concordanceType: 'object-reaching',
      gap: { x: 0.2, y: 0.3, z: 0.25 }, gapDominant: 'Z',
      boundaryDescription:
        'Naming the economic instrument as the campaign itself — siege framing, and the ' +
        'continuity said aloud ("Biden never lifted them") because the position owes neither ' +
        'administration anything — versus the madness reading, which treats the order as ' +
        'unprecedented and thereby co-signs the rupture frame it despises.',
      note: 'The only station whose fluid reading reaches both the instrument and the continuity. ' +
        'Same reach-with-caveat profile as TS01-LP one layer down.',
      subjects: [
        { name: 'Diplomacy camp (NIAC/Parsi register)', role: 'reader', mode: 'open', note: 'Maximum pressure named as failed policy; diplomacy counter-frame.' },
        { name: 'Humanitarian-sanctions critics', role: 'reader', mode: 'open', note: 'Siege framing: the economic instrument named as force.' },
      ] },
    { id: 'RP', quadrant: 'D', status: 'complete',
      permeability: { magnitude: 0.30, mode: 'inverted-lens' },
      internalSpread: 'HIGH — deal-hopers and enforcement-hawks in one base',
      fluid: 'Deal-not-war',
      denominated: 'Pressure-as-peace',
      binary: 'sanctions instead of war vs. sanctions as the war, unseen',
      dia: { composite: 68, spread: { min: 40, max: 80 },
        note: 'C1 IS WHY THE SPREAD STAYS WIDE: the operator performed this station\'s ' +
          'preferred reading from the podium while signing its opposite, so the sincere ' +
          'deal-not-war variant (~40) survives beside the assembled pressure-as-peace ' +
          'denomination (~80). Without C1 this station collapses toward the high end.' },
      distinguishability: 'Denominated dominant',
      concordance: { obj: '(+1,−1, 0)', shd: '(+1, 0,+1)' }, concordanceType: 'inverted-forming',
      gap: { x: 0, y: 1.8, z: 0.25 }, gapDominant: 'Y',
      boundaryDescription:
        'Holding "pressure instead of war" as a promise kept — performed from the podium itself ' +
        '(C1: torn, deal-preferring, hopefully-never-enforced) — versus assembling that the ' +
        'economic instrument IS the campaign. The lens is being ground here: the reading that ' +
        'becomes the full inversion at TS01 layer 2 (Paul, seventeen months later) is already ' +
        'refusing assembly in February 2025.',
      note: 'C1 is this station\'s reading spoken by the operator. The base hears the hedge as ' +
        'the policy; the memo\'s text is the policy.',
      subjects: [
        { name: 'The base reading, performed at the podium', role: 'reader', mode: 'inverted-lens', note: 'C1 — the operator stages RP\'s own preferred reading while signing its opposite.' },
        { name: 'MAGA anti-war channel', role: 'reader', mode: 'inverted-lens', note: 'Deal-preference held; instrument-as-war not assembled.' },
      ] },
  ],

  // ── Findings — the authoring log, oldest first ──
  findings: [
    'AUTHORING OPENED 2026-08-18. Moment ruled: the maximum-pressure order, frame one of the PG01 candidate series.',
    'Worldline note: the officer receiving this order is the same subject who, seventeen months later, names the object aloud and goes unread (M3, 2026-06-24). Frame one and the admission share a subject.',
    'RULED 2026-08-18: window = the signing day (2025-02-04); axes = coercion-first/diplomacy-first · sanctions-apparatus/affected-populations · delivering/gap.',
    'THE CONTINUITY FINDING, REFINED BY SOURCING (2026-08-18, survives its first test): the rupture-vs-continuity intuition splits in two registers. STATED register — continuous: sanctions on the books and pressure declared across three administrations; the "as if Biden and Obama had not been saying the same thing" reading is correct about the saying. OPERATIVE register — discontinuous by an order of magnitude: ~$16bn (2020, enforced) vs ~$144bn (2021–2023, slack), exports tripled to ~1.59 mbpd. Declared rupture over stated continuity over operative discontinuity — a stated-vs-operative structure, Z-gap shaped. The frame\'s apparent stupidity is real but structured: the rhetoric is continuous while enforcement oscillates beneath it.',
    'Z IS INSTRUMENTED: barrels-per-day is this trace\'s literal delivery metric — the same series later consumed at the arc as dispersion\'s neighbor. What the order declares is measurable against what the tankers do.',
    'Diffraction owed: four position readings of the order at its moment (day-of/week-after). LI near-vacancy suspected — if the grassroots-left reading of a Treasury directive barely exists, the absence is the finding.',
    'Sourcing, first pass (2026-08-18): NSPM-2 verbatim from whitehouse.gov · EIA SHIP Act report (Oct 2024) figures via FDD · CRS IF12952 for the China trade line. Predicates carry dated, checkable quantities per house discipline.',
    'REFRACTION RUN 2026-08-18 (Sailor ruled object placement and shadow Z; shadow x/y completed in-session): O at (+0.70, +0.90, +0.25) — coercion-first, pure apparatus, delivery held open by the record. O\' at (+0.85, +0.75, +0.85). Primary shadow operation: Z-ASSERTION — the frame pre-credits delivery the record does not yet support. Structural inverse of TS01\'s Z-inversion; if the pairing holds across the series, the arc gains a two-pole vocabulary for how frames mishandle delivery: deny it when real, assert it when absent.',
    'DIFFRACTION RUN 2026-08-18 (Sailor ruled the station draft): LI vacancy π~0.10 (thin-sweep caveat, verification pass owed) · RI aligned π~0.35 · LP open π~0.65 · RP inverted-lens-forming π~0.30. Four stations, four distinct ways of not reaching (or reaching) the moment — π requires a mode here as everywhere.',
    'C1 ADDED: the trigger hedges itself — the operator half-disavows the rupture frame inside the window. The contradiction is not in the discourse about the order; it is in the order\'s own staging.',
    'LI VERIFICATION PASS RUN 2026-08-18 (the diffraction\'s one honest debt, closed). Vacancy at the moment holds — no day-of institutional-left reading surfaced. But the REASON is now documented rather than inferred: B3, the 2024 bipartisan letter, shows five Democratic senators had already signed the enforcement-gap numbers. The position could not attack the order in Feb 2025 because it had conceded the premise in writing twelve months earlier. A sweep with a stated bound, not a shrug.',
    'TWO WORLDLINES, dated and checkable, opened by B3. RUBIO: signs the 2024 letter demanding Iran\'s exports be driven down; NSPM-2 assigns the drive-exports-to-zero campaign to STATE; by 2026 he is the Secretary of State narrating the operational reality aloud (CS04 Event 10). The demand, the office, and the admission are one thread. FETTERMAN: signs the same letter; by CS04 Event 10 his endorsement is the measure of how far Y-axis suppression has traveled. The arc can animate both.',
    'DIATRIBE PASS RUN 2026-08-18 (Sailor ruled all five numbers): LI 68 (structural floor of the denominated tier) · RI 70 (25–80) · LP 40 (20–60) · RP 68 (40–80, held open by C1) · event composite 60, oscillation zone. The composite is the finding: LATENCY CAPS DENOMINATION — nobody can be fully denominated about an object almost nobody has detected; the high station scores are about the frame, not the object. Prediction hook for the arc: if the scores climb or hold across frames as detection arrives, that is P1\'s shape in the Diatribe register.',
    'ARC-FACING OBSERVATION (for the admission, not assumed): the four modes at this frame are early drafts of the four modes the TS01 layer-2 work found in August 2026 — vacancy at LI, alignment at RI, inversion at RP, reach at LP. Per-station mode stability across seventeen months is recurrence material of exactly the kind PG01 establishes itself by; TF02+ will test it.',
  ],

  // ── Subjects — enrollment watch ──
  subjects: [
    { name: 'Donald Trump', role: 'constitutive', axis: 'declaration',
      note: 'Author of the order; his words are T1/F1. Unscoreable as a reader on the declaration axis (Enrollment Ruling).' },
    { name: 'Scott Bessent', role: 'reader',
      note: 'Recipient of the enforcement directive. Still reader-eligible at this frame — he has not yet supplied predicate text here. Enrollment watch: he becomes constitutive at M3 (2026-06-24), one worldline later.' },
  ],

  // ── Pipeline metadata ──
  pipeline: {
    refractionComplete: true,    // run 2026-08-18
    diffractionComplete: true,   // run 2026-08-18; LI verification pass RUN same day
    positionsComplete: 4,
    boundaryDescriptions: 4,
    coordinateSubjects: 8,
    version: 'Trace_Data_Schema_v2 — TF-native, snapshot scope. Frame RULED · axes RULED · refraction RUN · diffraction RUN. Diatribe pass run. Owed: admission to PG01.',
  },
};

// Self-register when loaded in gallery context
if (typeof PrismTraces !== 'undefined' && PrismTraces.register) PrismTraces.register(TF01_TRACE);

// Export for use in DreamGetty or other consumers
if (typeof module !== 'undefined') module.exports = TF01_TRACE;
