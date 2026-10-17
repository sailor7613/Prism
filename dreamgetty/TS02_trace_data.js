// ============================================================
// TS02 — The State-Magisterium Confrontation
// Pipeline output: Parameters project → DreamGetty renderer
//
// Object: Confrontation between American imperial state and
//         Catholic magisterium over moral legitimacy of war
//         and enforcement. Iran conflict and immigration
//         enforcement as dual pressure surfaces.
//
// Classification: Trace Set (contemporaneous)
// Linked traces: TS01 (Iran Conflict), CS01 (ICE Enforcement)
//
// Status: Refraction complete. Diffraction — three reception
//         positions mapped (non-standard; see note below).
//         Boundary descriptions pending.
//
// Schema note: TS02 is a confrontation object with multiple
//   operative centers (state vs. magisterium) rather than a
//   single political event. The standard 4-quadrant diffraction
//   is replaced by 3 reception positions that map the theological
//   channel's processing of the object. DG renderer may need
//   adaptation for non-standard position count.
//
// Date: April 8, 2026
// ============================================================

const TS02_TRACE = {
  id: 'TS02',
  label: 'State-Magisterium Confrontation (Iran / Enforcement)',
  eventType: 'Z-inversion',        // primary shadow operation confirmed
  prevalentAxis: 'Y',              // overwhelmingly institutional on all sides
  traceType: 'confrontation',      // EXTENSION: not single-event

  // ── Linked traces ──────────────────────────────────────
  linkedTraces: ['TS01', 'CS01'],
  importedBaselines: {
    TS01: { x: 0.65, y: 0.85, z: 0.80 },   // Iran war political channel
    CS01: { x: 0.70, y: 0.80, z: 0.82 },   // ICE enforcement domestic channel
  },

  // ── Refraction output — dual operative centers ─────────
  // Magisterial position (Leo XIV — the moral object)
  object: { x: -0.40, y: 0.90, z: 0.85 },

  // State position (Pentagon / executive / enforcement)
  objectState: { x: 0.75, y: 0.85, z: 0.80 },  // EXTENSION

  // Shadow (Barron as transmission layer — attenuates magisterial signal)
  shadow: { x: 0.30, y: 0.60, z: -0.45 },

  transform: {
    dx:  0.70,    // shadow shifts from Leo's -X to mild +X
    dy: -0.30,    // shadow attenuates institutional authority significantly
    dz: -1.30,    // Z-inversion — largest in trace data
    primary: 'Z-inversion',
    description: 'Shadow (Barron) holds partial institutional frame while inverting magisterial delivery. Papal moral clarity re-presented as general theological principle. ΔZ = -1.30 exceeds TS01 (-1.10) because baseline Z is higher — papal delivery carries more weight, so inverting it costs more.',
  },

  // ── Axis semantics ─────────────────────────────────────
  axes: {
    x: { pos: 'State Authority',        neg: 'Moral Authority' },
    y: { pos: 'Institutional',           neg: 'Extra-institutional' },
    z: { pos: 'Delivering',              neg: 'Gap' },
  },

  // ── Predicate table ────────────────────────────────────
  predicates: {
    operative: [
      {
        type: 'T', id: 'T1',
        label: 'Iran war forces moral response from magisterium; Leo speaks clearly and repeatedly against war and sacralization of violence',
        x: -1, y: 1, z: 1,
      },
      {
        type: 'B', id: 'B1',
        label: 'First American pope criticizing an American war — Americanness amplifies Y-weight of whatever he delivers',
        x: 0, y: 1, z: 0,
      },
      {
        type: 'B', id: 'B2',
        label: 'Immigration enforcement producing civilian deaths in bishop\'s own diocese (Renée Good, Alex Pretti — Minnesota, January 2026)',
        x: 1, y: 1, z: -1,
      },
      {
        type: 'M', id: 'M1',
        label: 'Pentagon confrontation with papal nuncio — state asserting authority over Church\'s moral speech',
        x: 1, y: 1, z: 1,
        instances: 5,
        instanceList: [
          'Summoning Cardinal Pierre to Pentagon after State of the World address',
          'Line-by-line dissection of Leo\'s speech as hostile to administration',
          'Invocation of Avignon Papacy — explicit threat of state subordination of Church',
          '250th anniversary invitation as institutional leverage (declined by Vatican)',
          '"Donroe Doctrine" framing — hemispheric dominion as non-negotiable premise',
        ],
      },
      {
        type: 'C', id: 'C1',
        label: 'Religious Liberty Commission vs. Avignon threat — defend religious liberty domestically while threatening Pope\'s ambassador with state coercion of Church',
        x: 1, y: 1, z: 0,
        tension: true,
      },
      {
        type: 'V', id: 'V1',
        label: 'Barron\'s silence on ICE killings in his diocese — episcopal authority not deployed where it structurally should be',
        x: 0, y: -1, z: -1,
        voidCriteria: {
          capacity: true,
          access: true,
          priorities: true,    // finds time for Democrats, Rubio praise
          duration: true,      // sustained across two killings over weeks
        },
      },
    ],
    stated: [
      {
        type: 'F', id: 'F1',
        label: 'My comments were pastoral, not political (Barron post-Broadview)',
        x: 0, y: 1, z: 0,
        operation: 'Incarnational thinning (F9) — severs material-spiritual connection',
      },
      {
        type: 'F', id: 'F2',
        label: 'The Pope was not referring specifically or precisely to the Iran war (Barron on Shapiro)',
        x: 0, y: 1, z: -1,
        operation: 'Debt release foreclosure (F11) — strips temporal index from present-tense moral address',
      },
      {
        type: 'F', id: 'F3',
        label: 'My heart is breaking over the situation (Barron, January 2026)',
        x: 0, y: 0, z: 0,
        operation: 'Affective displacement (B6) — all operative content replaced by emotional register',
      },
      {
        type: 'F', id: 'F4',
        label: 'Cease interfering with ICE / violation of religious liberty (Barron, January 2026)',
        x: 1, y: 1, z: -1,
        operation: 'Z-inversion at framework level — religious liberty vocabulary deployed to protect enforcement rather than detained',
      },
    ],
    convergence: [
      {
        ids: ['M1', 'V1'],
        annotation: 'State coercion (external) and episcopal silence (internal) serve same operative product — attenuation of magisterial moral authority',
        effect: 'Coverage across Y-axis: external +Y coercion and internal -Y void both serve signal attenuation',
      },
    ],
  },

  // ── Reception positions (non-standard — 3 positions) ──
  // TS02 maps theological reception rather than standard
  // quadrant diffraction. These are structural positions
  // on the same object, not the standard RI/LI/LP/RP.
  positionType: 'reception',  // EXTENSION: flags non-standard
  positions: [
    {
      id: 'LEO',
      label: 'Pope Leo XIV — Magisterial, Incarnational',
      structuralLocation: 'Apex of Y-hierarchy',
      coordinates: { x: -0.40, y: 0.90, z: 0.85 },
      diatribe: { current: 7, trajectory: 'stable-low' },
      capacityForSurprise: 'full',
      denominationStage: 0,
      destructionMode: 'none',
      activeElements: [
        'Welcoming principle — fully operative (Lampedusa July 4th)',
        'Fullness of time — present-tense address maintained throughout',
        'Debt release — actively performed (250th debt released, Lampedusa chosen)',
        'Counter-FRAME (B13 candidate) — Lampedusa inverts 250th FRAME',
      ],
      status: 'complete',
      note: 'Leo passes every good-faith test in the encoding. Speaks from the fullness of time, maintains other\'s subjectivity. Position is the encoding\'s ground — the welcoming principle from which the Diatribe gradient is measured. Augustinian formation, two decades in Peru. Did not retreat after Pentagon threat — pressed harder.',
    },
    {
      id: 'BARRON',
      label: 'Bishop Barron — Episcopal, Thinning',
      structuralLocation: 'Middle Y-hierarchy (transmission layer)',
      coordinates: { x: 0.30, y: 0.60, z: -0.45 },
      diatribe: {
        current: 67,
        trajectory: 'ascending',
        arc: [
          { date: '2018', value: 12, note: 'Family separation — moral outrage in Spanish' },
          { date: '2026-01-early', value: 45, note: 'First ICE killing — both-sides, affective displacement' },
          { date: '2026-01-late', value: 60, note: 'Second ICE killing — total silence' },
          { date: '2026-03', value: 67, note: 'Shapiro interview — reinterprets Pope on Iran' },
        ],
      },
      capacityForSurprise: 'selective',   // F10 operative
      denominationStage: 2.5,             // between frame consolidation and substance replacement
      destructionMode: 'defensive-to-performative',
      activePatterns: [2, 4, 15],
      activeElements: [
        'Z-inversion (B1) — primary operation on papal discourse',
        'Magisterial Z-inversion (B1.1) — second-order, on the channel itself',
        'Incarnational thinning (F9) — Broadview demand then retreat',
        'Selective capacity for surprise (F10) — Prejean yes, ICE no',
        'Debt release foreclosure (F11) — strips temporal index from Leo',
        'Affective displacement (B6) — "heart breaking"',
        'Selective re-description (B8) — Pope spoke but not about this war',
      ],
      longitudinalParallel: 'Rubio arc (📓e4): 25→60→80',
      status: 'complete',
      note: 'Structural hinge. Has theological formation to resist regression (Thomist, incarnational). Cannot deploy it — institutional entanglement (Commission, media empire, Fox) forecloses capacity for surprise. The person with formation performs the regression; the person without (Carlson) performs the resistance. Entanglement predicts denomination, not education.',
    },
    {
      id: 'CARLSON',
      label: 'Tucker Carlson — Extra-institutional, De-denominating',
      structuralLocation: 'Outside Y-hierarchy (-Y populist media)',
      coordinates: { x: 0.50, y: -0.70, z: 0.60 },
      diatribe: {
        current: 30,
        trajectory: 'descending',
        arc: [
          { date: '2020-2024', value: 70, note: 'Dominion era — private contempt, public support (Pattern #2)' },
          { date: '2025', value: 55, note: 'Growing public criticism of Iran war policy' },
          { date: '2026-04', value: 30, note: '43-minute theological case against Trump — de-denomination active' },
        ],
      },
      capacityForSurprise: 'recovering',
      denominationStage: 1,               // back from stage 2-3; vehicle still present but substance re-emerging
      destructionMode: 'none-current',     // previously performative, currently reversing
      activeElements: [
        'Welcoming principle — emergent through Protestant-prophetic ground',
        'De-denomination — lateral movement on ghost slider, first instance in trace data',
        'Capacity for surprise recovering — inauguration Bible observation retroactively named',
        'Z-delivery from -Y ground — moral clarity from outside institutional hierarchy',
      ],
      deDenomination: {                    // EXTENSION: tracks reversal
        trigger: 'Easter Sunday Iran threat — moral extremity exceeded denomination absorption capacity',
        mechanism: 'Prophetic-scriptural recovery — "you are not God" as anti-eschatological claim from Protestant ground',
        direction: 'stage 2-3 → stage 1 (vehicle recognized as vehicle, substance re-accessible)',
        stable: 'unknown — first instance, insufficient data to predict persistence',
      },
      status: 'complete',
      note: 'De-denomination test case — first instance of Diatribe descending after deep consolidation. No formal theological training. Protestant. Conspiratorial temperament. Should be MORE susceptible to dispensationalist regression, not less. Yet builds 43-minute theological case against sacralization of political power. The variable is institutional entanglement (low — broke from Fox, no Commission, no episcopal office), not theological formation.',
    },
  ],

  // ── Structural findings ────────────────────────────────
  findings: [
    // Z-inversion
    'Z-inversion confirmed across three institutional channels: political (TS01, ΔZ=-1.10), enforcement (CS01, ΔZ=-1.02), theological (TS02, ΔZ=-1.30). Primary shadow operation is structurally robust.',
    'Theological channel amplifies Z-inversion — papal delivery carries more Z-weight than congressional authorization, so inverting it produces larger delta.',

    // Y-authority
    'Y-authority does not predict Z-delivery. Highest Y (Leo) and lowest Y (Carlson) converge on Z[+] moral clarity. Middle Y (Barron) performs Z-inversion. The institutional middle is where signal is lost.',
    'Y-authority pluralism: the Y-axis contains competing institutional hierarchies (state vs. magisterium) that can be concordant, discordant, or in open confrontation. The encoding must track which Y-channel is operative.',

    // State-Church
    'Pentagon-nuncio meeting is first documented instance of US military-diplomatic apparatus explicitly threatening papal authority with state subordination (Avignon Papacy reference).',
    'Religious Liberty Commission vs. Avignon threat instantiates Pattern #2 (performative institutional) at inter-institutional level. Commission is form; Pentagon coercion is substance.',

    // De-denomination
    'De-denomination is structurally possible. Carlson is first subject in trace data moving back toward fluidity after deep denominational consolidation (stage 2-3 → stage 1). Variable is institutional entanglement, not theological formation.',
    'De-denomination trigger: events whose moral extremity exceeds denomination absorption capacity may force rupture rather than deeper consolidation. Easter Sunday Iran threat is the candidate trigger.',

    // ⛪F resolution
    'Four positions map onto ⛪F Diatribe gradient: Leo (5-10, within fullness), Carlson (25-35, moving toward fullness), Barron (65-70, moving away), Hegseth/White (80-90, re-eschatologized).',
    'Incarnational thinning (F9), selective capacity for surprise (F10), and debt release foreclosure (F11) validated as new elements. All three require the ⛪F theological framework to be legible.',

    // Supply chain
    'Supply chain extends across institutional channels. Political channel denominated readings (TS01) become frame predicates for theological channel (TS02). Inter-channel frame importation confirmed.',

    // Counter-FRAME
    'Counter-FRAME (B13 candidate): Leo choosing Lampedusa on July 4th inverts the 250th anniversary FRAME. Same elements (papal authority, American identity, symbolic date) with reversed Z-loading. First instance in trace data.',
  ],

  // ── New elements registered ────────────────────────────
  newElements: {
    formalized: [
      { id: 'F9',  label: 'Incarnational thinning', category: 'F' },
      { id: 'F10', label: 'Selective capacity for surprise', category: 'F' },
      { id: 'F11', label: 'Debt release foreclosure', category: 'F' },
    ],
    candidates: [
      { id: 'B13',  label: 'Counter-FRAME', category: 'B', instances: 1 },
      { id: 'B1.1', label: 'Magisterial Z-inversion', category: 'B', instances: 1 },
    ],
  },

  // ── Pipeline metadata ──────────────────────────────────
  pipeline: {
    refractionComplete: true,
    diffractionComplete: true,     // non-standard: 3 reception positions, not 4 quadrants
    positionsComplete: 3,          // of 3 (non-standard)
    boundaryDescriptions: 0,       // pending
    coordinateSubjects: 0,         // N/A for reception-type positions (fluid/denominated labels are per-quadrant)
    version: 'Refraction Grammar v1 / Element Grammar v1.1 / Closed Form v1.2',
    note: 'Non-standard diffraction: confrontation object with 3 reception positions instead of 4 quadrants. Schema extension fields: traceType, objectState, positionType, deDenomination, newElements.',
  },
};

// Self-register when loaded in gallery context
if (typeof PrismTraces !== 'undefined' && PrismTraces.register) PrismTraces.register(TS02_TRACE);

// Export for use in DreamGetty or other consumers
if (typeof module !== 'undefined') module.exports = TS02_TRACE;
