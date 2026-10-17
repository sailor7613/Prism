// ============================================================
// TS01 — Complete Refraction-Diffraction Trace Data
// Pipeline output: Parameters project → DreamGetty renderer
//
// Event: US Military Strikes on Iran — Operation Epic Fury
// Object (military layer): American military engagement with Iran
// Object (real, provisional): Dollar re-invoicing / reserve-currency capture
// Status: Military layer pipeline-complete, unchanged from prior build.
//         Real-object / projection-gap layer added 2026-08-10 — PROVISIONAL,
//         per CS07's own discipline ("authored before formalizing... do not
//         encode as resolved"). Do not treat realObject/projectionGap as
//         locked the way object/shadow/positions are.
// Date: April 5, 2026 (military layer) · August 10, 2026 (real-object layer)
//
// ------------------------------------------------------------
// CLOSED AS A TRACE — 2026-08-18 (Sailor + Claude)
// ------------------------------------------------------------
// See the `frame` and `lifecycle` blocks below (Trace_Data_Schema_v2 §2 —
// this file is the first application of the required frame block, declared
// retroactively per the 08-17 retirement handoff §5.3). TS01 closes as
// TS01: this file is the record of what it was. The TF series continues
// from its extract — TF01 → PG01, Parameters/09_Parallelograms/
// Contemporaneous/PG01_Petrogas_Dollar.md. Closing is by recording, not
// waiting; reopening remains possible; nothing is destroyed.
// Three-copy md5 sync: all copies updated together 2026-08-18.
//
// ------------------------------------------------------------
// REBUILD NOTE — 2026-08-10 (Sailor + Claude)
// ------------------------------------------------------------
// Total reconsideration requested: "the trace as it stands now was a rough
// epistemological experiment... review all ontological developments... start
// from the ground up... stabilize our parameters." Findings from that review:
//
// 1. Checked against Refraction Grammar v1 / Closed Form v1.2 (this trace's
//    declared version) directly: the military layer is NOT early-draft by
//    those documents' own standards. The 8+4 position model (fluid +
//    denominated per quadrant + boundary description — NOT a third
//    "coalition" band) is what Closed Form v1.2 (Mar 26 2026) mandates, and
//    this trace already uses it correctly. The `distinguishability` values
//    already reflect the corrected three-tier scale (J_dia_operator.md,
//    June 1 2026), not the retired four-tier one. Structurally current.
//
// 2. What was actually thin: coverage, not form.
//    a. g_compilation.md's own entry for this event (e1.10) flagged Object Z
//       as an open oscillation (band +0.50 to −0.95, pending outcome) as of
//       March 2026 — and it was never closed out against what actually
//       happened. Closed below in findings, WITHOUT changing object.z — see
//       note there for why leaving it unchanged is the correct resolution,
//       not an oversight.
//    b. This trace carried exactly one object/shadow pair (military
//       delivery vs. quagmire narrative) with no slot for what CS07
//       (Hormuz MOU, June 19 2026) later did to Hormuz — promoting a
//       materially real object one layer deeper once the surface object
//       turned out to be cover. Added below as `realObject` /
//       `projectionGap`, modeled directly on CS07's precedent.
//    c. Denomination patterns already attributed to this exact event in
//       g_compilation.md (#3, #7, #8, #9) were never tagged against this
//       predicate table. Tagged below.
//
// 3. Known, unresolved, NOT fixed by this rebuild: Closed Form v1.2 (Mar 26)
//    explicitly retired "coalition" as a coordinate-subject band ("not a
//    coordinate subject... the experience of standing at the boundary").
//    Denomination_As_Object_Displacement_v1.md (June 25) and the CS04/CS07
//    case-study format both run live on a fluid/coalition/denominated
//    three-band model. TS01 stays in the 8+4 model per the boundary-model
//    lineage it was built in and per Trace_Data_Schema_v1's DreamGetty
//    consumption contract — this is flagged as open project debt, not
//    reconciled here.
//
// Sourcing for the real-object layer:
//   - Bessent, CNBC interview, June 24, 2026: "We're seeing in the Iranian
//     negotiations the Iranians will be invoicing in dollars" / "dollar
//     dominance is essential" / "Everything we are doing is pushing the
//     dollar" — Venezuela and Russia named as next.
//   - Bessent, public remarks, August 8, 2026: the Strait of Hormuz "is
//     going to become irrelevant" within two years as energy shifts to
//     pipeline transit.
// ============================================================

const TS01_TRACE = {
  id: 'TS01',
  label: 'US Military Strikes on Iran — Operation Epic Fury',
  // eventType is RENDERED — DreamGetty draws it with ctx.fillText at fixed
  // canvas positions (index.html ~6221 left-aligned after the id, ~6280
  // centred at x=512) with no wrapping, and folds it into story text
  // (~19152) and the inspect-panel system prompt (~18803). It must stay
  // short. Extended description goes in eventTypeExtended, which nothing
  // reads. Do not lengthen this string without re-photographing the easel.
  eventType: 'Z-inversion',
  eventTypeExtended: 'Z-inversion (military layer) + projection gap (real-object layer, provisional)',
  prevalentAxis: 'Y',

  // ── THE FRAME — declared retroactively 2026-08-18 (Sailor) ──
  // First application of Trace_Data_Schema_v2 §2's required frame block.
  // The window is declared honestly as the long exposure it was — February
  // to August 2026, operation to detection. The blur that exposure produced
  // (latency and oscillation material — motion legible inside the frame) is
  // exactly what routes upward to the arc in the TF01 extract, per the
  // exposure discipline; it does not invalidate the trace, it types it.
  frame: {
    declared: 'Operation — never officially named a war or an engagement; ill-defined by design, with consequences beyond what is claimed (Refraction_Optics_v0 §2: contested illumination is an encodable fact of the trace)',
    contested: ['war', 'engagement'],
    asOfDate: '2026-08-18',
    window: {
      start: '2026-02-01',   // operation
      end:   '2026-08-08',   // detection — C2, the Hormuz demotion remark
    },
  },

  // ── Lifecycle — CLOSED 2026-08-18 (retirement handoff §5.4) ──
  lifecycle: {
    status: 'closed',
    closedDate: '2026-08-18',
    closingFindings: [
      'SCOPE: NARROW. The trace closes on the dated object — the operation, February to August 2026, operation to detection. The broad object (the petrogas-dollar) is a standing condition, ineligible for a trace edge by the typing ruling (Occlusion_Edge_v0 §5a); it routes to the arc: PG01.',
      'EDGE: NOT ADMITTED ON THIS RECORD — A2 unevidenced at close. Recorded as a finding, not a debt. Nothing waits on the Memorandum documents; if they surface, reopening is possible like anything else.',
      'OSCILLATION: resolution carried as-is — closed 2026-08-10 without rescoring object.z; the outcome dissolved the question rather than resolving it (see findings).',
      'EXTRACTION: TF01 extracts to PG01 through the one-way membrane — declared frame, real-object score, position readings with permeability modes, dated detections (M3 2026-06-24, C2 c. 2026-08-08), subject roles under the Enrollment Ruling. The predicate table and local evidentiary machinery stay here.',
    ],
  },

  // ── Refraction output — military layer (UNCHANGED from prior build) ──
  object:  { x: 0.65, y: 0.85, z: 0.80 },   // Y-prevalent, Z-delivering
  shadow:  { x: 0.80, y: 0.75, z: -0.30 },   // X-sharpened, Y-attenuated, Z-inverted

  transform: {
    dx: 0.15,    // shadow sharpens partisan coding
    dy: -0.10,   // shadow slightly attenuates institutional character
    dz: -1.10,   // Z-inversion — primary shadow operation
    primary: 'Z-inversion',
    description: 'Shadow sharpens partisan coding, slightly attenuates institutional character, and inverts delivery sign. Critical discourse deploys institutional authority to narrate failure of an institutionally executed engagement.',
  },

  // ── Axis semantics (per-event, overrides factory defaults) ──
  axes: {
    x: { pos: 'Interventionist', neg: 'Restrained' },
    y: { pos: 'Institutional',   neg: 'Direct Action' },
    z: { pos: 'Delivering',      neg: 'Gap' },
  },

  // ── Predicate table ────────────────────────────────────
  // Types: T=Trigger, B=Substrate, M=Mechanism, V=Void, C=Contradiction, F=Frame
  // Axis loadings: 1=positive, 0=neutral, -1=negative
  // Operative predicates position relative to O; F predicates relative to O'
  // `patterns`: denomination_pattern_library.md numbers, added in this rebuild —
  //   attribution source is g_compilation.md's own e1.10 entry (📓e1 Event 10)
  //   plus CS04/CS07's cross-references, not re-derived from scratch here.
  predicates: {
    operative: [
      {
        type: 'T', id: 'T1',
        label: 'US and Israel conduct major strikes across 24 of 31 Iranian provinces; explicit regime change rhetoric; Iranian retaliation hits Tel Aviv and US regional bases',
        x: 1, y: 1, z: 1,
        patterns: [9],
        patternNote: 'Pattern #9 (performative glorification) — operation naming and staged framing begin at the trigger itself, per g_compilation e1.10.',
      },
      {
        type: 'B', id: 'B1',
        label: 'Korea (1950–53): 36,000 American dead, permanent military presence, prosperous allied democracy — strategic success at high casualty cost',
        x: 1, y: 1, z: 1,
      },
      {
        type: 'B', id: 'B2',
        label: 'Vietnam (1955–75): 58,000 American dead, withdrawal without strategic objective achieved — singular Z-negative case in substrate',
        x: 1, y: -1, z: -1,
      },
      {
        type: 'B', id: 'B3',
        label: 'Iraq (2003–11): ~4,500 American dead, core objectives fulfilled (Saddam removed, regional power reshaped, permanent military infrastructure), widest gap between operative delivery and public narrative of failure',
        x: 1, y: 1, z: 1,
      },
      {
        type: 'B', id: 'B4',
        label: 'ISIS/Syria: Jolani rises through ISIS, ISIS credibly linked to CIA/proxy operations, Assad falls, Jolani installed — operative Z-positive through indirect channels',
        x: 1, y: 0, z: 1,
      },
      {
        type: 'M', id: 'M1',
        label: 'Sanctions regime and economic pressure (1979–2025): decades of escalating sanctions, JCPOA as single institutional interruption then withdrawn — pre-military engagement channel operating at Z-neutral',
        x: 1, y: 1, z: 0,
        patterns: [3],
        patternNote: 'Pattern #3 (destroying a mechanism that works) — "maximum pressure" repeated across the sanctions/JCPOA-withdrawal sequence, per g_compilation e1.10.',
      },
      {
        type: 'M', id: 'M2',
        label: 'Congressional abdication on war powers: Massie/Khanna prepare bipartisan resolution, Democratic leadership does not advance it, upper-left Democrats abstain rather than insist on institutional process',
        x: 0, y: -1, z: 1,
        patterns: [7],
        patternNote: 'Pattern #7 (captive dreamer\'s definitional retreat) — institutional abstention framed as prudence rather than abdication, per g_compilation e1.10.',
      },
      {
        type: 'V', id: 'V1',
        label: 'No congressional authorization — no vote, no debate, absence creates legal window for engagement',
        x: 0, y: -1, z: 1,
      },
      {
        type: 'C', id: 'C1',
        label: 'Shadow discourse simultaneously holds that American covert operations produce intended regime outcomes (CIA → ISIS → Jolani) and that American military engagement produces unintended failure — these cannot both be true in the same analytical frame',
        x: -1, y: 0, z: 0,
        tension: true,
      },
    ],
    stated: [
      {
        type: 'F', id: 'F1',
        label: 'Quagmire frame — casualties are beginning of a spiral, Hormuz closure, regional escalation as evidence of emerging entanglement',
        x: 0, y: 0, z: -1,
      },
      {
        type: 'F', id: 'F2',
        label: 'Economic consequences frame — oil prices, shipping disruption, global market impact as evidence costs exceed strategic benefit',
        x: 0, y: 1, z: -1,
      },
      {
        type: 'F', id: 'F3',
        label: 'War powers illegitimacy frame — engagement lacks institutional authorization regardless of outcome',
        x: 0, y: 1, z: 0,
      },
      {
        type: 'F', id: 'F4',
        label: 'Victory narrative — strategic success, nuclear capability neutralized, compresses operative complexity into claimable narrative',
        x: 1, y: 1, z: 1,
        patterns: [8],
        patternNote: 'Pattern #8 (historical revision, Denial mode) — Tim Pool-type retroactive "always planned it" narrative folds into the compressed victory story, per g_compilation e1.10. Also the frame this trace\'s new C2 predicate destabilizes: the "victory" the frame claims is centered on the strait, which the apparatus itself later discards (see realObject / C2 below).',
      },
    ],

    // ── Real-object predicate table — NEW, 2026-08-10, PROVISIONAL ────
    // These do not feed object/shadow above. They ground `realObject` and
    // `projectionGap` below, modeled on CS07's real-object/shadow-object
    // move (Hormuz promoted from real object in CS04 to shadow object in
    // CS07, beneath the petrogas-dollar). Kept in a separate array on
    // purpose — additive to the schema, not a silent rescoring of the
    // military layer above.
    realObject: [
      {
        type: 'M', id: 'M3',
        label: 'Treasury Secretary Bessent, CNBC "Squawk Box," June 24 2026 (interviewer Joe Kernen): "We\'re seeing in the Iranian negotiations, the Iranians will be invoicing in dollars." Same appearance: "dollar dominance is essential"; administration policy described as "pushing the dollar"; Iran characterised as previously "selling discounted oil to China and not getting dollars."',
        x: 1, y: 1, z: 1,
        source: 'CNBC "Squawk Box," Wednesday June 24, 2026. Corroborated across TheStreet, Yahoo/Bloomberg wire, Eulerpool. Bessent also addressed the Economic Club of New York the prior evening (June 23, 2026) — those remarks not yet pulled and may carry a fuller statement of the same policy.',
        sourcingNote: 'VERBATIM vs REPORTED — kept separate per CS07\'s sourcing discipline. VERBATIM: the Iran invoicing line, "dollar dominance is essential," "pushing the dollar," "selling discounted oil to China and not getting dollars." REPORTED PARAPHRASE, not quoted speech: the extension to Venezuela (one outlet quotes the fragment "the dollar will be at the core of Venezuela\'s trade" but inside a paraphrastic frame) and to Russia (rendered by outlets as his prediction, not his words). The Iran claim is the load-bearing one and it is solid. Do NOT let the Venezuela/Russia extension inherit its confidence — that is the layer-1/layer-2 error this discipline exists to prevent.',
        note: 'The first on-record confirmation of the petrogas-dollar attribution (Medhurst, May 2026 — CS07\'s "layer 1") from an actual party to the negotiation, rather than press inference or dissident reading. Layer 1 moves from contested to stated-and-disputed-only-in-degree — but for Iran only. Note also the direction of travel the China line establishes: "invoicing in dollars" presupposes Iran was OUTSIDE the dollar system beforehand, which makes this recapture of lost ground, not maintenance of a status quo. That distinction matters for realObject.z — an apparatus reconquering territory scores differently from one holding it.',
      },
      {
        type: 'C', id: 'C2',
        label: 'Bessent on the Strait of Hormuz, seated interview, c. August 8 2026 — full transcript: "The strait is never going back to the way it was because the Iranians have used, or tried to use it, as a choke point. What we are going to see over the next two years, the strait is going to become irrelevant. It is going to become just another body of water, and I would say that more than 50 or 70% of the energy that moves through the strait now is going to go through underground pipelines."',
        x: 0, y: 1, z: 1,
        tension: true,
        source: 'Video interview (Arizona setting), 0:36 clip circulated via @clashreport. Transcript taken from that post; primary venue not yet identified — WORTH TRACING, the room is not a studio. Substance corroborated by Townhall and Conservative Treehouse reporting dated Aug 8 2026.',
        note: 'Structurally distinct from C1: not a flaw in shadow discourse, but a statement from inside the operative apparatus. Three separable findings. (1) INSTRUMENTALITY CONFIRMED — the chokepoint is declared expendable immediately after being secured, which is the first falsification test for a projection claim and it passes. (2) A LIVE DENOMINATION REPAIR INSIDE ONE SENTENCE — "the Iranians have used, or tried to use it, as a choke point." The self-correction is load-bearing: "used" concedes Iran successfully exercised control over the strait, which contradicts the victory narrative (F4); "tried to use" restores the frame in which the US was never not in control. The speaker performs the repair in real time. (3) THE FORECAST IS NOT CREDIBLE AS INFRASTRUCTURE, AND THAT IS THE POINT — "more than 50 or 70%" is not a projection anyone holding a capacity figure would give, and existing Hormuz-bypass pipeline capacity is a modest fraction of throughput with major new capacity taking many years, not two. So the sentence is not forecasting. It is DEMOTING: Hormuz reclassified from the chokepoint everything depends on to "just another body of water." That is denomination-as-object-displacement (see 00_Architecture/Denomination_As_Object_Displacement_v1.md) executed by the operative apparatus on its own former object, rather than by a tribal discourse on a contested one — a use of the concept the architecture note does not yet cover. Its function is retrospective: nobody audits a body of water. C2 is therefore the projection gap\'s closing move — the surface object dismissed once it has done its work, which both confirms it was instrumental and forecloses re-examination of what it was instrumental FOR.',
      },
    ],
  },

  // ── Diffraction output — four positions (UNCHANGED) ────
  // Quadrant mapping: A=upper-left (LI), B=upper-right (RI),
  //                   C=lower-left (LP), D=lower-right (RP)
  positions: [
    {
      id: 'RI',
      quadrant: 'B',
      concordance: { obj: '(+1,+1,+1)', shd: '(+1,+1,-1)' },
      concordanceType: 'concordant-concordant-delivery',
      gap: { x: 0.15, y: -0.10, z: -1.10 },
      gapDominant: 'Z',
      fluid: 'Stewardship',
      denominated: 'Triumphalism',
      binary: 'stewardship vs. triumphalism',
      distinguishability: 'Oscillation zone',
      status: 'complete',
      note: 'RI owns the policy, the channel, and the delivery. Both readings affirm delivery — split is on depth of accounting for what success contains.',
      boundaryDescription: 'Full operative accounting vs. compressed victory narrative. Both affirm delivery. Denomination through simplification, not inversion.',
      fluidKeywords: [
        { text: 'accounting', weight: 0.9 },
        { text: 'operative',  weight: 0.8 },
        { text: 'cost',       weight: 0.7 },
        { text: 'asymmetry',  weight: 0.8 },
        { text: 'strategic',  weight: 0.6 },
        { text: 'ownership',  weight: 0.7 },
      ],
      denomKeywords: [
        { text: 'victory',      weight: 0.9 },
        { text: 'mission',      weight: 0.8 },
        { text: 'won',          weight: 0.7 },
        { text: 'decisive',     weight: 0.6 },
        { text: 'strength',     weight: 0.7 },
        { text: 'accomplished', weight: 0.8 },
      ],
    },
    {
      id: 'LI',
      quadrant: 'A',
      concordance: { obj: '(-1,+1,+1)', shd: '(-1,+1,-1)' },
      concordanceType: 'discordant-concordant-delivery',
      gap: { x: -0.15, y: -0.10, z: -1.10 },
      gapDominant: 'Z',
      fluid: 'Responsibility',
      denominated: 'Disavowal',
      binary: 'responsibility vs. disavowal',
      distinguishability: 'Denominated dominant',
      status: 'complete',
      note: 'Y-concordance at +0.85 is highest single-axis concordance in table. LI shares the institutional channel at maximum intensity while opposing the policy it delivers. LI→LP migration risk active: disavowal overshoots into institutional abandonment.',
      boundaryDescription: 'Institutional concordance as obligation vs. X-discordance as sufficient distance. The Y-axis split: wield the standing or voice the opposition.',
      fluidKeywords: [
        { text: 'authorization', weight: 0.9 },
        { text: 'obligation',    weight: 0.8 },
        { text: 'resolution',    weight: 0.7 },
        { text: 'institutional', weight: 0.6 },
        { text: 'process',       weight: 0.7 },
        { text: 'standing',      weight: 0.8 },
      ],
      denomKeywords: [
        { text: 'oppose',    weight: 0.9 },
        { text: 'statement', weight: 0.8 },
        { text: 'distance',  weight: 0.7 },
        { text: 'abstain',   weight: 0.9 },
        { text: 'record',    weight: 0.6 },
        { text: 'rhetoric',  weight: 0.7 },
      ],
    },
    {
      id: 'LP',
      quadrant: 'C',
      concordance: { obj: '(-1,-1,+1)', shd: '(-1,-1,-1)' },
      concordanceType: 'discordant-discordant-delivery',
      gap: { x: -0.15, y: 0.10, z: -1.10 },
      gapDominant: 'Z',
      fluid: 'Critique',
      denominated: 'Condemnation',
      binary: 'critique vs. condemnation',
      distinguishability: 'Oscillation zone',
      status: 'complete',
      note: 'Maximum activation — opposes policy, opposes channel, delivery is a fact regardless. C1 contradiction lives here: simultaneous claim of American operative capacity and strategic failure.',
      boundaryDescription: 'Empirical engagement with operative content vs. systemic verdict that precedes evidence. C1 contradiction as diagnostic marker.',
      fluidKeywords: [
        { text: 'empirical',   weight: 0.8 },
        { text: 'specific',    weight: 0.9 },
        { text: 'evidence',    weight: 0.7 },
        { text: 'mechanism',   weight: 0.7 },
        { text: 'resolve',     weight: 0.6 },
        { text: 'casualties',  weight: 0.8 },
      ],
      denomKeywords: [
        { text: 'empire',       weight: 0.9 },
        { text: 'systemic',     weight: 0.8 },
        { text: 'quagmire',     weight: 0.7 },
        { text: 'imperialism',  weight: 0.8 },
        { text: 'inevitable',   weight: 0.7 },
        { text: 'industrial',   weight: 0.6 },
      ],
    },
    {
      id: 'RP',
      quadrant: 'D',
      concordance: { obj: '(+1,-1,+1)', shd: '(+1,-1,-1)' },
      concordanceType: 'concordant-discordant-delivery',
      gap: { x: 0.15, y: 0.10, z: -1.10 },
      gapDominant: 'Z',
      fluid: 'Mandate',
      denominated: 'Efficacy',
      binary: 'mandate vs. efficacy',
      distinguishability: 'Denominated dominant',
      status: 'complete',
      note: 'Shadow maximally congenial to RP — sharpens X-ownership, reduces institutional character. Offers identity confirmation and Z-inversion simultaneously. Rand Paul as fluid benchmark (Diatribe 10 across Iran and Venezuela — cross-session benchmark per g_compilation e1.s6/e4.s8).',
      boundaryDescription: 'Constitutional authorization as legitimacy requirement vs. delivery as self-authorizing. Rand Paul as fluid benchmark.',
      fluidKeywords: [
        { text: 'constitutional', weight: 0.9 },
        { text: 'authorization',  weight: 0.8 },
        { text: 'democratic',     weight: 0.7 },
        { text: 'principle',      weight: 0.8 },
        { text: 'powers',         weight: 0.7 },
        { text: 'legitimate',     weight: 0.6 },
      ],
      denomKeywords: [
        { text: 'results',   weight: 0.9 },
        { text: 'delivered',  weight: 0.8 },
        { text: 'effective',  weight: 0.7 },
        { text: 'pragmatic',  weight: 0.6 },
        { text: 'outcome',    weight: 0.8 },
        { text: 'strength',   weight: 0.7 },
      ],
    },
  ],

  // ── Real object / projection gap — NEW, 2026-08-10, PROVISIONAL ────
  // Modeled directly on CS07 (Hormuz MOU, June 19 2026): a shadow object and
  // a real object that are DIFFERENT objects and BOTH read realized — the
  // shadow's genuine success is what conceals the real object, because good
  // news does not get audited. In CS04→CS07, Hormuz was promoted from real
  // object to shadow object beneath the petrogas-dollar. Here, the existing
  // military `object` above (delivering, Z+0.80) plays the shadow-object
  // role: not because it was ever false, but because its being genuinely,
  // stably true is exactly what let a deeper object run underneath it
  // unexamined.
  realObject: {
    status: 'PROVISIONAL — candidate extension, not formalized. Per CS07: "flagged for formalization... do not encode as resolved." This block strengthens layer-1 attribution; it does not itself resolve the projection-gap type.',
    id: 'petrogas-dollar',
    label: 'Dollar re-invoicing / reserve-currency capture',
    x: 0.75, y: 0.90, z: 0.88,
    description: 'The object one layer beneath military delivery. Not "was the strike a strategic success" but "what was the strike, and everything after it, actually for." Confirmed on-record by the Treasury Secretary (M3, June 24 2026) as a stated aim of the Iran negotiations specifically, extending to Venezuela and Russia. The physical chokepoint (Hormuz) that CS04 first named as the object beneath the nuclear framing, and that CS07 later promoted to shadow object beneath the petrogas-dollar, is treated by the apparatus itself as expendable once it has done its work (C2, August 8 2026) — corroborating that the currency object, not the strait, is the durable one.',
    sourcing: {
      layer1_attribution: 'Medhurst, "How the US Pulled off an Armed Robbery of the World\'s Energy Supply and Created the Petrogas-Dollar," May 2026 — originally the contested dissident reading (CS07\'s framing: "hard to close"). As of this rebuild, corroborated on-record by Bessent (M3) as a stated negotiating aim, not merely inferred from trade data. Disputed only in degree now, not in kind.',
      layer2_substrate: 'Measurable and independent of layer 1: US LNG ~27% (2021) → ~48% (2024) of EU imports; IMF COFER dollar reserve share below 57% for the first time since 1995 (Q3 2025); Saudi yuan-priced oil to China 15%→22%. Per CS07\'s own discipline, the real object rests on this layer — a reader can disbelieve Medhurst\'s intent claim and the real object is still in the trade data. M3 does not replace layer 2; it closes most of the gap between the two layers.',
    },
  },

  projectionGap: {
    status: 'CANDIDATE — third gap type, not formalized. Distinct from intrinsic gap (Object Z, stated-vs-operative inside one object) and relational gap (one actor across two corpora).',
    shadowObjectRef: 'object',
    shadowObjectReading: 'Realized at Z+0.80 — the military engagement genuinely delivered on its own stated terms (see B1–B4 substrate, F4 victory narrative). This is not a false reading being exposed as false.',
    realObjectRef: 'realObject',
    realObjectReading: 'Realized at Z+0.88 — the currency-capture object, per M3/C2.',
    signAgreement: true,
    description: 'Both objects read realized. That shared sign is the cover: a frustrated shadow trips the alarm; a realized shadow is the perfect cover, because good news (or at least "mission accomplished" news) does not get audited. The quagmire-vs-victory argument that occupied this trace\'s original object/shadow pair (Z-inversion, April 2026) was a real argument, honestly encoded — and also, in retrospect, an argument conducted entirely at the wrong altitude. Resolving it either way (quagmire or victory) would have left the real object exactly as invisible.',
  },

  // ── Structural findings ────────────────────────────────
  findings: [
    'TS01 is a Z-inversion event — shadow sharpens X (+0.15), attenuates Y (-0.10), inverts Z (-1.10).',
    'Z-sign divergence universal — object σ_Z=+1 everywhere, shadow σ_Z=-1 everywhere. Same structural pattern as CS01.',
    'Shadow amplifies institutional authority of critique while object Y is attenuated by congressional abdication — the institution that abdicated war powers reasserts authority through critical discourse.',
    'Substrate predicates (B1–B4) establish that American military engagement delivers at progressively lower casualty cost. Vietnam is the singular Z-negative exception, and the shadow\'s quagmire frame depends on Vietnam as representative rather than exceptional.',
    'Shadow has a supply chain — denominated readings of Iraq become frame predicates for Iran. O\' partially constructed from prior events\' O\'.',
    'F4 (victory narrative) is structurally anomalous: a frame predicate that aligns with object Z-sign. Denomination through simplification, not inversion.',
    'Y-prevalence confirmed at diagnostic level — highest-distinguishability positions (LI, RP) both split on institutional process questions.',
    'LI Y-concordance at +0.85 is highest single-axis concordance in table — structural encoding of Democratic complicity through abdication.',
    'C1 contradiction (American operative capacity vs. strategic failure narrative) lives inside shadow discourse, not inside object.',
    '— 2026-08-10 rebuild —',
    'Oscillation flag closed WITHOUT rescoring object.z. g_compilation.md (March 2026) predicted this event\'s Z resolving between +0.50 (regime-change-stable) and -0.95 (quagmire); neither happened — ceasefire via Islamabad Memorandum (June 17 2026), nuclear file deferred, no regime change, Strait reopened toll-free for 60 days (CS07). Rescoring object.z toward either predicted pole would answer a question the actual outcome dissolved rather than resolved: both "delivered" and "quagmire" were arguments about the military object, and the real resolution happened one layer down. Leaving object.z at +0.80, unrevised, is the finding, not an omission — see projectionGap.',
    'Denomination patterns attributed to this event by g_compilation.md (e1.10) but never previously tagged on this predicate table: #9 (performative glorification, T1), #3 (destroying a working mechanism, M1), #7 (captive dreamer\'s definitional retreat, M2), #8 (historical revision, F4). Tagged inline above.',
    'Pattern #20 (cultural/ideological framing masking economic mechanism) now has two dated instances on this arc: CS04 (nuclear framing suppressing Hormuz, the transit-layer instance) and CS07 (Hormuz-as-relief suppressing the petrogas-dollar, the monetary-layer instance). This trace\'s M3/C2 mark that same pattern operating on the strike itself, chronologically prior to both.',
    'Pattern #16 (Z-gap by architectural design) applies to realObject: the gap between "the war was about the nuclear threat" and "the war was about currency capture" is not a lie that closes under scrutiny — it is a structural feature the apparatus does not need to hide, because the shadow object (military delivery) is genuinely, stably true.',
    'Real-object / projection-gap layer (realObject, projectionGap, and predicates.realObject) is a schema extension, additive only — object, shadow, transform, predicates.operative, predicates.stated, and positions are unchanged from the prior build and remain the pipeline-complete military-layer trace.',
    'Unresolved, flagged, not fixed here: Closed Form v1.2 (Mar 26 2026) retired "coalition" as a coordinate-subject band; Denomination_As_Object_Displacement_v1.md (June 25 2026) and the CS04/CS07 case-study format both run live on a fluid/coalition/denominated three-band model. This trace stays in the 8+4 model it was built in. The two schemas are presently unreconciled project-wide.',
  ],

  // ── Pipeline metadata ──────────────────────────────────
  pipeline: {
    refractionComplete: true,
    diffractionComplete: true,
    positionsComplete: 4,
    boundaryDescriptions: 4,
    coordinateSubjects: 8,
    version: 'Refraction Grammar v1 / Closed Form v1.2 (military layer, unchanged) + Real-Object Extension v0.1 — provisional, 2026-08-10',
  },
};

// Self-register when loaded in gallery context
if (typeof PrismTraces !== 'undefined' && PrismTraces.register) PrismTraces.register(TS01_TRACE);

// Export for use in DreamGetty or other consumers
if (typeof module !== 'undefined') module.exports = TS01_TRACE;
