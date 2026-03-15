// ============================================================
// PRISM DATA LAYER — shared localStorage-backed data model
// Single source of truth for index.html and admin.html
// ============================================================
const PrismDB = (() => {
  const KEYS = {
    events:    'prism_events',
    responses: 'prism_responses',
    state:     'prism_state',
    user:      'prism_user',
    snapshots: 'prism_parallax_snapshots',
    arcs:      'prism_arcs'
  };

  function _get(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch(e) { return null; }
  }
  function _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ── Events (read) ───────────────────────────────────────
  function getEvents() {
    const events = _get(KEYS.events) || [];
    let anyDirty = false;
    events.forEach(evt => {
      const { dirty } = _normalizeEventWords(evt);
      if (dirty) anyDirty = true;
    });
    // Write back once if any words were derived (lazy migration)
    if (anyDirty) _set(KEYS.events, events);
    return events;
  }

  function getEvent(id) {
    return getEvents().find(e => e.id === id) || null;
  }

  function getActiveEvent() {
    return getEvents().find(e => e.active) || null;
  }

  // ── Events (write) ──────────────────────────────────────
  function addEvent(eventObj) {
    const events = getEvents();
    // Generate ID
    const maxNum = events.reduce((max, e) => {
      const n = parseInt(e.id.replace('evt_', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    eventObj.id = 'evt_' + String(maxNum + 1).padStart(3, '0');

    // If this event is active, deactivate all others
    if (eventObj.active) {
      events.forEach(e => e.active = false);
    }

    events.push(eventObj);
    _set(KEYS.events, events);
    return eventObj;
  }

  function updateEvent(id, data) {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return null;

    // If setting active, deactivate all others
    if (data.active) {
      events.forEach(e => e.active = false);
    }

    events[idx] = { ...events[idx], ...data, id }; // preserve ID
    _set(KEYS.events, events);
    return events[idx];
  }

  function deleteEvent(id) {
    const events = getEvents().filter(e => e.id !== id);
    _set(KEYS.events, events);
    return true;
  }

  function setActive(id) {
    const events = getEvents();
    events.forEach(e => e.active = (e.id === id));
    _set(KEYS.events, events);
  }

  // ── Responses ───────────────────────────────────────────
  function getResponses() { return (_get(KEYS.responses) || []).map(_normalizeResponse); }

  function getResponsesForEvent(eventId) {
    return getResponses().filter(r => r.eventId === eventId);
  }

  // Ensure Diatribe v2 fields exist on legacy response records
  function _normalizeResponse(r) {
    if (r.diatribeSliderPosition === undefined) r.diatribeSliderPosition = null;
    if (r.ghostSliderPosition === undefined) r.ghostSliderPosition = null;
    if (r.oppositionCOG === undefined) r.oppositionCOG = null;
    if (r.commentaryScores === undefined) r.commentaryScores = null;
    return r;
  }

  // ── Word derivation from response text ─────────────────
  // Generates a words[] array from response text + xWord/yWord
  // Format matches what syncGraphmapWords() consumes:
  //   { t: 'word', w: 'x+'|'y+'|null, weight: 0.0–1.0, axis: 'x'|'y'|null }
  const _STOP_WORDS = new Set([
    'the','and','but','for','are','was','not','you','all','can','had','her',
    'one','our','has','his','how','its','may','new','now','old','see','way',
    'who','did','get','let','say','she','too','use','than','them','then',
    'they','this','that','what','when','with','from','have','been','will',
    'more','make','like','just','over','such','take','also','into','some',
    'could','other','after','would','about','there','their','which','being',
    'still','where','those','these','should','because','between','before',
    'every','been','don','didn','isn','it','was','were','does','same','own',
    'most','very','each','only','back','we','he','me','my','no','so','do',
    'if','or','an','be','by','at','as','up','on','of','in','is','to','a','i'
  ]);

  function _deriveWords(text, xWord, yWord) {
    if (!text) return [];
    const words = [];
    const seen = new Set();

    // Parse multi-word xWord/yWord into sets for seen-tracking
    const xTokens = (xWord || '').toLowerCase().split(/\s+/).filter(Boolean);
    const yTokens = (yWord || '').toLowerCase().split(/\s+/).filter(Boolean);

    // Add xWord and yWord as high-weight axis-tagged entries first
    if (xWord && xWord.trim()) {
      const xClean = xWord.trim();
      words.push({ t: xClean, w: 'x+', weight: 0.9, axis: 'x' });
      xClean.toLowerCase().split(/\s+/).forEach(t => seen.add(t));
    }
    if (yWord && yWord.trim()) {
      const yClean = yWord.trim();
      words.push({ t: yClean, w: 'y+', weight: 0.9, axis: 'y' });
      yClean.toLowerCase().split(/\s+/).forEach(t => seen.add(t));
    }

    // Extract additional significant words from text
    const fragments = text.split(/\s+/);
    fragments.forEach((frag, i) => {
      const clean = frag.replace(/[.,!?;:'"()—\-]/g, '').trim();
      if (!clean || clean.length < 3) return;
      const lower = clean.toLowerCase();
      if (_STOP_WORDS.has(lower) || seen.has(lower)) return;
      seen.add(lower);

      // Weight by position (earlier words slightly heavier) and length (longer = more specific)
      let weight = 0.4 + (clean.length > 5 ? 0.1 : 0) + (i < fragments.length / 2 ? 0.05 : 0);
      weight = Math.min(0.7, weight);

      words.push({ t: clean, w: weight, weight: weight, axis: null });
    });

    return words;
  }

  // Normalize events on read: backfill empty words[] from text + xWord/yWord
  const BANDS = ['goodFaith', 'coalition', 'badFaith'];

  function _normalizeEventWords(evt) {
    if (!evt || !evt.responses) return { evt, dirty: false };
    let dirty = false;

    ['A', 'B', 'C', 'D'].forEach(q => {
      const quad = evt.responses[q];
      if (!quad) return;
      BANDS.forEach(band => {
        const resp = quad[band];
        if (!resp) return;
        if (!resp.words || resp.words.length === 0) {
          const derived = _deriveWords(resp.text, resp.xWord, resp.yWord);
          if (derived.length > 0) {
            resp.words = derived;
            dirty = true;
          }
        }
      });
    });

    return { evt, dirty };
  }

  function hasRespondedToEvent(eventId) {
    return getResponses().some(r => r.eventId === eventId && !r.mock);
  }

  function saveResponse(resp) {
    // Compute derived fields
    resp.id = resp.id || ('res_' + Date.now());
    resp.timestamp = resp.timestamp || Date.now();
    resp.diverged = resp.initialChoice !== resp.finalQuadrant;
    resp.coords = {
      x: Math.round(resp.pin.x * 200 - 100),
      y: Math.round((1 - resp.pin.y) * 200 - 100)
    };
    // Intensity: distance from quadrant center (0.25,0.25 / 0.75,0.25 etc), mapped 1-100
    const qCenters = {
      A: {x:0.75, y:0.25}, B: {x:0.25, y:0.25},
      C: {x:0.25, y:0.75}, D: {x:0.75, y:0.75}
    };
    const qc = qCenters[resp.finalQuadrant] || {x:0.5,y:0.5};
    const dist = Math.sqrt(Math.pow(resp.pin.x - qc.x, 2) + Math.pow(resp.pin.y - qc.y, 2));
    resp.intensity = Math.max(1, Math.min(100, Math.round((1 - dist / 0.35) * 100)));
    resp.intensityBand = resp.intensity <= 33 ? 'nominal' : resp.intensity <= 66 ? 'coalition' : 'conviction';

    // Diatribe derived (legacy v1 — will be replaced by Diatribe UI in Phase 5)
    const absD = Math.abs(resp.diatribeScore || 0);
    resp.diatribeFaith = absD <= 50 ? 'good' : 'bad';
    resp.diatribeSide = (resp.diatribeScore || 0) < 0 ? 'left' : 'right';
    resp.diatribeBand = absD <= 33 ? 'nominal' : absD <= 66 ? 'coalitional' : 'conviction';

    // Diatribe v2 fields (nullable until Diatribe UI is built)
    resp.diatribeSliderPosition = resp.diatribeSliderPosition ?? null;
    resp.ghostSliderPosition = resp.ghostSliderPosition ?? null;
    resp.oppositionCOG = resp.oppositionCOG ?? null;
    resp.commentaryScores = resp.commentaryScores ?? null;

    const all = getResponses();
    all.push(resp);
    _set(KEYS.responses, all);
    return resp;
  }

  // ── Aggregate ───────────────────────────────────────────
  function getAggregateForEvent(eventId) {
    return getResponsesForEvent(eventId).map(r => ({
      x: r.pin.x,
      y: r.pin.y,
      quadrant: r.finalQuadrant,
      intensity: r.intensity || 50,
      mock: !!r.mock
    }));
  }

  // ── App State ───────────────────────────────────────────
  function getState() {
    return _get(KEYS.state) || { currentEventId: null, lastCompletedEventId: null, eventsCompleted: 0 };
  }

  function setState(patch) {
    _set(KEYS.state, Object.assign(getState(), patch));
  }

  // ── User ────────────────────────────────────────────────
  function getUser() { return _get(KEYS.user); }
  function setUser(profile) { _set(KEYS.user, profile); }

  // ── Parallax Snapshots ────────────────────────────────
  function getSnapshots() { return _get(KEYS.snapshots) || []; }

  function getSnapshotsForEvent(eventId) {
    return getSnapshots().filter(s => s.eventId === eventId);
  }

  function saveSnapshot(snap) {
    snap.id = snap.id || ('snap_' + Date.now());
    snap.timestamp = snap.timestamp || Date.now();
    const all = getSnapshots();
    all.push(snap);
    _set(KEYS.snapshots, all);
    return snap;
  }

  // ── Arcs ─────────────────────────────────────────────────
  // An arc is a temporally ordered sequence of events with a
  // unified determining object. Each event carries per-quadrant
  // Subject Z values and subject labels (who occupies each
  // quadrant for that event).
  //
  // Schema:
  // {
  //   id: 'arc_cs04',
  //   title: 'Immigration Arc (1982–2026)',
  //   description: '...',
  //   object: 'The Empire',
  //   objectDescription: 'U.S. institutional apparatus...',
  //   events: [
  //     {
  //       id: 'e4.1',
  //       label: 'Iran-Contra / Didion / Webb',
  //       date: '1982',
  //       x: 0.7, y: 0.95, z: 0.85,   // Object Z
  //       dia: 80,
  //       type: 'event',
  //       qz: { A: 0.85, B: 0.40, C: -0.90, D: -0.60 },
  //       subjects: {
  //         A: '',  // e.g. "Covert ops apparatus, NSC"
  //         B: '',  // e.g. "Institutional Democrats, Cold War liberals"
  //         C: '',  // e.g. "Displaced Central Americans, anti-war activists"
  //         D: ''   // e.g. "Libertarian skeptics, fiscal conservatives"
  //       }
  //     }
  //   ],
  //   linkedArticleId: null,
  //   created: '...', updated: '...'
  // }

  function getArcs() { return _get(KEYS.arcs) || []; }

  function getArc(id) {
    return getArcs().find(a => a.id === id) || null;
  }

  function saveArc(arc) {
    const arcs = getArcs();
    const now = new Date().toISOString();

    // Generate ID if new
    if (!arc.id) {
      const maxNum = arcs.reduce((max, a) => {
        const n = parseInt(a.id.replace('arc_', ''), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      arc.id = 'arc_' + String(maxNum + 1).padStart(3, '0');
      arc.created = now;
    }
    arc.updated = now;

    // Ensure events array exists
    if (!Array.isArray(arc.events)) arc.events = [];

    // Upsert: replace existing or append
    const idx = arcs.findIndex(a => a.id === arc.id);
    if (idx !== -1) {
      arcs[idx] = arc;
    } else {
      arcs.push(arc);
    }

    _set(KEYS.arcs, arcs);
    return arc;
  }

  function deleteArc(id) {
    const arcs = getArcs().filter(a => a.id !== id);
    _set(KEYS.arcs, arcs);
    return true;
  }

  // ── Dev Utilities ───────────────────────────────────────
  function clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    console.log('PrismDB cleared (including arcs).');
  }

  // ── Seed ────────────────────────────────────────────────
  // Para·01–06: All six case study events with 12 responses each
  // (3 bands × 4 quadrants = 72 short-form responses total)
  function seed() {
    if (_get(KEYS.events)) {
      console.log('PrismDB: events already exist, skipping seed.');
      return false;
    }

    const events = [

      // ════════════════════════════════════════════════════
      // Para·01 — Pretti / Second Amendment (CS01)
      // X-prevalent · Domestic Policy · Immigration · 2A
      // ════════════════════════════════════════════════════
      {
        id: 'evt_001',
        title: 'ICE killing of Alex Pretti / Second Amendment inversion',
        category: 'Domestic Policy · 2A · Immigration',
        framing: 'On January 24, 2026, ICE agents shot and killed Alex Pretti — a legally armed nurse and veteran caregiver — near an immigration arrest in Minneapolis. The killing inverted standard Second Amendment positions: pro-gun conservatives defended the agents while gun-control liberals began discussing arming themselves.',
        prompt: 'Legally armed nurse killed by ICE during immigration operation. Both sides invert on gun rights.',
        meta: { dialecticsRef: 'cs01', status: 'published', editHistory: [] },
        date: '2026-01-24',
        active: true,
        prevalentAxis: 'x',
        antiValentBand: 'badFaith',
        axes: {
          x: { pos: 'Right', neg: 'Left' },
          y: { pos: 'Institutional', neg: 'Grassroots' }
        },
        responses: {
          A: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'A man was killed by his government. That demands investigation.',
              xWord: 'government', yWord: 'investigation',
              words: []
            },
            coalition: {
              text: 'We jumped from \'investigate\' to \'abolish ICE\' too fast.',
              xWord: 'ICE', yWord: 'jumped',
              words: []
            },
            badFaith: {
              text: 'They executed a nurse and hid the footage. Block every DHS dollar.',
              xWord: 'executed', yWord: 'block',
              words: []
            }
          },
          B: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Enforcement requires accountability. DHS can\'t investigate itself.',
              xWord: 'enforcement', yWord: 'accountability',
              words: []
            },
            coalition: {
              text: 'I support enforcement. But he was no terrorist and they know it.',
              xWord: 'enforcement', yWord: 'terrorist',
              words: []
            },
            badFaith: {
              text: 'He showed up armed to interfere. The officers are the victims.',
              xWord: 'armed', yWord: 'officers',
              words: []
            }
          },
          C: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'He saw someone being hurt and stepped in. That\'s what neighbors do.',
              xWord: 'neighbors', yWord: 'stepped in',
              words: []
            },
            coalition: {
              text: 'The arming discourse scares me. The anger is real but the guns are new.',
              xWord: 'arming', yWord: 'anger',
              words: []
            },
            badFaith: {
              text: 'Arm up. If they\'ll execute a nurse, nobody is safe.',
              xWord: 'arm up', yWord: 'execute',
              words: []
            }
          },
          D: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Legal carrier, legal permit, shot on the ground. Every gun owner should worry.',
              xWord: 'legal', yWord: 'gun owner',
              words: []
            },
            coalition: {
              text: 'Our side explained why it was okay. That\'s not 2A. That\'s tribalism.',
              xWord: '2A', yWord: 'tribalism',
              words: []
            },
            badFaith: {
              text: 'He showed up armed at a federal operation. Play stupid games.',
              xWord: 'armed', yWord: 'federal',
              words: []
            }
          }
        },
        diatribe: {
          LG: { text: 'The left is demanding institutional accountability for a killing that demands it — investigation before narrative.', side: 'left', faith: 'good' },
          LB: { text: 'The left is using Pretti\'s death to advance abolition politics, freezing his identity into a martyr vehicle.', side: 'left', faith: 'bad' },
          RG: { text: 'The principled right sees a constitutional crisis — a legal carrier killed by federal agents deserves 2A defense regardless of context.', side: 'right', faith: 'good' },
          RB: { text: 'The right is performing law-and-order loyalty, selectively applying 2A principles based on who the gun was pointed at.', side: 'right', faith: 'bad' }
        }
      },

      // ════════════════════════════════════════════════════
      // Para·02 — Metro Surge / ICE Minnesota (CS02)
      // X-prevalent · Immigration · Federal Operations
      // ════════════════════════════════════════════════════
      {
        id: 'evt_002',
        title: 'Operation Metro Surge / ICE deployment in Minnesota',
        category: 'Immigration · Federal Operations',
        framing: 'A massive ICE operation in Minnesota targeted the Somali-American community, ostensibly over welfare fraud. State prosecutors had been building fraud cases that the federal operation disrupted. Six prosecutors resigned. Three thousand arrests yielded zero fraud convictions.',
        prompt: 'Federal ICE operation in Minnesota disrupts state fraud prosecution, produces mass arrests with no fraud convictions.',
        meta: { dialecticsRef: 'cs02', status: 'published', editHistory: [] },
        date: '2026-01-20',
        active: false,
        prevalentAxis: 'x',
        antiValentBand: 'badFaith',
        axes: {
          x: { pos: 'Right', neg: 'Left' },
          y: { pos: 'Institutional', neg: 'Grassroots' }
        },
        responses: {
          A: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'The fraud was being prosecuted. The operation disrupted it. Six prosecutors quit.',
              xWord: 'prosecuted', yWord: 'prosecutors',
              words: []
            },
            coalition: {
              text: 'Some people genuinely believe Minnesota failed. The operation buried the fix.',
              xWord: 'Minnesota', yWord: 'operation',
              words: []
            },
            badFaith: {
              text: 'They picked the community Fox News already dehumanized. This is occupation.',
              xWord: 'dehumanized', yWord: 'occupation',
              words: []
            }
          },
          B: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'The fraud is real. Three thousand arrests and zero fraud cases isn\'t accountability.',
              xWord: 'fraud', yWord: 'accountability',
              words: []
            },
            coalition: {
              text: 'I wanted this to be about the fraud. The arrest numbers say it wasn\'t.',
              xWord: 'fraud', yWord: 'arrest',
              words: []
            },
            badFaith: {
              text: 'Democrats covered for a billion in fraud. Enforcement is the consequence.',
              xWord: 'Democrats', yWord: 'enforcement',
              words: []
            }
          },
          C: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'The strongest whistleblowers were Somali community members themselves.',
              xWord: 'Somali', yWord: 'whistleblowers',
              words: []
            },
            coalition: {
              text: 'Both sides need me to pick one outrage. I can\'t have the harder conversation.',
              xWord: 'sides', yWord: 'conversation',
              words: []
            },
            badFaith: {
              text: 'Ethnic cleansing with extra steps. The fraud was a capitalist inevitability.',
              xWord: 'cleansing', yWord: 'capitalist',
              words: []
            }
          },
          D: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'The fraud was real. Masked agents shooting citizens isn\'t a serious response.',
              xWord: 'fraud', yWord: 'masked agents',
              words: []
            },
            coalition: {
              text: 'If they deliberately sabotaged the fraud cases with an immigration spectacle, I\'d believe it.',
              xWord: 'sabotaged', yWord: 'spectacle',
              words: []
            },
            badFaith: {
              text: 'They set up fake nonprofits to funnel money to Somalia. Enforcement is the consequence.',
              xWord: 'nonprofits', yWord: 'enforcement',
              words: []
            }
          }
        },
        diatribe: {
          LG: { text: 'The left is holding the procedural line — state prosecution was working, the federal operation destroyed it.', side: 'left', faith: 'good' },
          LB: { text: 'The left is using the community as a shield, refusing to acknowledge real fraud to deny enforcement any legitimacy.', side: 'left', faith: 'bad' },
          RG: { text: 'The right is responding to a real operational crisis — a billion in fraud with no accountability is a genuine failure.', side: 'right', faith: 'good' },
          RB: { text: 'The right is manufacturing urgency to expand executive power — the fraud framing is a pretext for immigration spectacle.', side: 'right', faith: 'bad' }
        }
      },

      // ════════════════════════════════════════════════════
      // Para·03 — Housing / Financialization (CS03)
      // Y-prevalent · Economic Policy · Housing
      // ════════════════════════════════════════════════════
      {
        id: 'evt_003',
        title: 'Housing affordability and institutional financialization',
        category: 'Economic Policy · Housing',
        framing: 'Housing costs have reached historic highs relative to income across most U.S. metros. Institutional investors now own significant shares of single-family homes in multiple markets. Algorithmic rent-setting software faces antitrust lawsuits. Multiple legislative efforts to address the crisis have stalled.',
        prompt: 'Housing affordability crisis deepens as institutional investors expand single-family home purchases.',
        meta: { dialecticsRef: 'cs03', status: 'published', editHistory: [] },
        date: '2026-02-15',
        active: false,
        prevalentAxis: 'y',
        antiValentBand: 'badFaith',
        axes: {
          x: { pos: 'Right', neg: 'Left' },
          y: { pos: 'Institutional', neg: 'Populist' }
        },
        responses: {
          A: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'It\'s a market design problem with market design solutions. Pass the bill.',
              xWord: 'market', yWord: 'bill',
              words: []
            },
            coalition: {
              text: 'Three versions of the same bill died. I still believe in legislation. Barely.',
              xWord: 'bill', yWord: 'legislation',
              words: []
            },
            badFaith: {
              text: 'Every legislator who votes no is running interference for private equity.',
              xWord: 'legislator', yWord: 'private equity',
              words: []
            }
          },
          B: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Upzone, reform permitting, build more. Corporate buyers fill a supply vacuum.',
              xWord: 'permitting', yWord: 'supply',
              words: []
            },
            coalition: {
              text: 'Supply is most of the answer. Algorithmic rent collusion is the rest.',
              xWord: 'supply', yWord: 'collusion',
              words: []
            },
            badFaith: {
              text: 'Deregulate construction. The market solves it. Blackstone didn\'t cause this.',
              xWord: 'market', yWord: 'deregulate',
              words: []
            }
          },
          C: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'Community land trusts work. Tenant unions work. Legislation is a supplement.',
              xWord: 'community', yWord: 'tenant unions',
              words: []
            },
            coalition: {
              text: '\'Protect the neighborhood\' is starting to sound like NIMBY with better politics.',
              xWord: 'neighborhood', yWord: 'NIMBY',
              words: []
            },
            badFaith: {
              text: 'There is no reform. The legislature is the landlord\'s instrument.',
              xWord: 'reform', yWord: 'legislature',
              words: []
            }
          },
          D: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'A small landlord is a neighbor. Invitation Homes is a spreadsheet.',
              xWord: 'landlord', yWord: 'neighbor',
              words: []
            },
            coalition: {
              text: 'The free-market argument I used is now being used against me.',
              xWord: 'free-market', yWord: 'against me',
              words: []
            },
            badFaith: {
              text: 'They outbid every family with cash. Zone them out. Tax them into selling.',
              xWord: 'family', yWord: 'zone',
              words: []
            }
          }
        },
        diatribe: {
          LG: { text: 'The left is naming a structural design problem — financialization of housing is a policy choice with policy remedies.', side: 'left', faith: 'good' },
          LB: { text: 'The left treats every market participant as private equity, collapsing the distinction between landlords and hedge funds.', side: 'left', faith: 'bad' },
          RG: { text: 'The right is correct that supply constraints are the foundational driver — building more is a necessary condition.', side: 'right', faith: 'good' },
          RB: { text: 'The right invokes "free market" to defend an arrangement where institutional capital faces no friction ordinary buyers face.', side: 'right', faith: 'bad' }
        }
      },

      // ════════════════════════════════════════════════════
      // Para·04 — Rubio / Iran First Strike (CS04)
      // Y-prevalent · Foreign Policy · Iran
      // ════════════════════════════════════════════════════
      {
        id: 'evt_004',
        title: 'Rubio signals US willingness as first-strike actor on Iran',
        category: 'Foreign Policy · Iran · Nuclear',
        framing: 'Secretary of State Marco Rubio publicly signaled U.S. willingness to act as a first-strike actor against Iran\'s nuclear program, citing 84% enrichment levels. The statement came amid ongoing maximum-pressure diplomacy and raised questions about strategic coherence versus political signaling.',
        prompt: 'Rubio signals first-strike willingness against Iran nuclear program amid 84% enrichment.',
        meta: { dialecticsRef: 'cs04', status: 'published', editHistory: [] },
        date: '2026-02-20',
        active: false,
        prevalentAxis: 'y',
        antiValentBand: 'badFaith',
        axes: {
          x: { pos: 'Right', neg: 'Left' },
          y: { pos: 'Hawkish', neg: 'Dovish' }
        },
        responses: {
          A: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: '84% enrichment is real. The question is whether to act coherently.',
              xWord: 'enrichment', yWord: 'coherently',
              words: []
            },
            coalition: {
              text: 'The principle is sound. This statement is doing denomination work, not strategy.',
              xWord: 'principle', yWord: 'denomination',
              words: []
            },
            badFaith: {
              text: 'Liberal hawks are always the permission structure for the next war.',
              xWord: 'hawks', yWord: 'permission',
              words: []
            }
          },
          B: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Maximum pressure needs a credible backstop. The statement lacked discipline.',
              xWord: 'pressure', yWord: 'backstop',
              words: []
            },
            coalition: {
              text: 'The hawkish case is right. The strategic incoherence is also right.',
              xWord: 'hawkish', yWord: 'incoherence',
              words: []
            },
            badFaith: {
              text: 'Iran\'s been at war with us for forty years. When, not whether.',
              xWord: 'Iran', yWord: 'war',
              words: []
            }
          },
          C: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'The nuclear framing is the surface. Hormuz is the material object.',
              xWord: 'nuclear', yWord: 'Hormuz',
              words: []
            },
            coalition: {
              text: 'Naming the history is necessary. Substituting it for the present loses the room.',
              xWord: 'history', yWord: 'present',
              words: []
            },
            badFaith: {
              text: 'Nuclear program is the pretext. WMDs in Iraq, Gulf of Tonkin, same architecture.',
              xWord: 'pretext', yWord: 'architecture',
              words: []
            }
          },
          D: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Who does this war benefit? Not the people fighting it.',
              xWord: 'war', yWord: 'benefit',
              words: []
            },
            coalition: {
              text: 'Anti-war right has been vindicated three times. Don\'t blow it on contrarianism.',
              xWord: 'anti-war', yWord: 'vindicated',
              words: []
            },
            badFaith: {
              text: 'Another trillion, another generation of soldiers, same CEOs collecting bonuses.',
              xWord: 'trillion', yWord: 'CEOs',
              words: []
            }
          }
        },
        diatribe: {
          LG: { text: 'The left is raising legitimate questions about strategic coherence — signaling without strategy invites escalation.', side: 'left', faith: 'good' },
          LB: { text: 'The left is using anti-war framing to avoid engaging with the real enrichment threshold — reflexive opposition as identity.', side: 'left', faith: 'bad' },
          RG: { text: 'The right is correct that credible deterrence requires willingness to act — ambiguity in the face of 84% enrichment is its own signal.', side: 'right', faith: 'good' },
          RB: { text: 'The right is performing toughness for domestic consumption — the statement damaged deterrence by revealing political rather than strategic motivation.', side: 'right', faith: 'bad' }
        }
      },

      // ════════════════════════════════════════════════════
      // Para·05 — Israel / Rafah Red Line (CS05)
      // Y-prevalent, X near-collapse · Foreign Policy · Israel
      // ════════════════════════════════════════════════════
      {
        id: 'evt_005',
        title: 'Israel crosses Rafah red line / US policy collapse',
        category: 'Foreign Policy · Israel · Palestine',
        framing: 'The Biden administration drew a public "red line" at a Rafah ground operation, threatening to condition military aid. Israel crossed it. The administration did not follow through. The gap between the stated line and the policy response became the dominant political object.',
        prompt: 'US red line on Rafah crossed without policy consequence. Arms flow continues.',
        meta: { dialecticsRef: 'cs05', status: 'published', editHistory: [] },
        date: '2026-02-10',
        active: false,
        prevalentAxis: 'y',
        antiValentBand: 'badFaith',
        axes: {
          x: { pos: 'Right', neg: 'Left' },
          y: { pos: 'Interventionist', neg: 'Non-Interventionist' }
        },
        responses: {
          A: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'Israel crossed the line, but conditioning arms mid-war abandons them.',
              xWord: 'arms', yWord: 'conditioning',
              words: []
            },
            coalition: {
              text: 'Nobody thought we\'d cut them off. The signal was the point.',
              xWord: 'signal', yWord: 'cut',
              words: []
            },
            badFaith: {
              text: 'After the Holocaust and October 7th, there is no red line.',
              xWord: 'Holocaust', yWord: 'red line',
              words: []
            }
          },
          B: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'The red line should never have been drawn. It damaged every commitment.',
              xWord: 'commitment', yWord: 'red line',
              words: []
            },
            coalition: {
              text: 'Walking it back was correct. Drawing it was the mistake.',
              xWord: 'walking back', yWord: 'mistake',
              words: []
            },
            badFaith: {
              text: 'Condition aid and every ally questions every promise we\'ve ever made.',
              xWord: 'aid', yWord: 'ally',
              words: []
            }
          },
          C: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'Arms flow or they don\'t. The red line was performance.',
              xWord: 'arms', yWord: 'performance',
              words: []
            },
            coalition: {
              text: 'The protests mattered. The policy didn\'t change. Both are true.',
              xWord: 'protests', yWord: 'policy',
              words: []
            },
            badFaith: {
              text: 'Settler colonialism from Balfour to Rafah. The line was always complicity.',
              xWord: 'colonialism', yWord: 'complicity',
              words: []
            }
          },
          D: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Billions in unconditional aid with zero accountability. Why?',
              xWord: 'aid', yWord: 'accountability',
              words: []
            },
            coalition: {
              text: 'Question this and you\'re antisemitic from the left, isolationist from the right.',
              xWord: 'antisemitic', yWord: 'isolationist',
              words: []
            },
            badFaith: {
              text: 'Not our war. Not our money. Not our problem.',
              xWord: 'our', yWord: 'war',
              words: []
            }
          }
        },
        diatribe: {
          LG: { text: 'The left is naming a real policy gap — a stated red line with no enforcement mechanism is worse than no line at all.', side: 'left', faith: 'good' },
          LB: { text: 'The left is collapsing the entire history into a single frame, making every position that acknowledges complexity into complicity.', side: 'left', faith: 'bad' },
          RG: { text: 'The right is correct that credibility depends on consistency — drawing lines you won\'t enforce damages the alliance framework.', side: 'right', faith: 'good' },
          RB: { text: 'The right is using alliance credibility as a shield against any scrutiny of the policy itself — loyalty as discourse terminator.', side: 'right', faith: 'bad' }
        }
      },

      // ════════════════════════════════════════════════════
      // Para·06 — Tariffs / TSMC Arizona (CS06)
      // Y-prevalent · Economic Policy · Trade · Semiconductors
      // ════════════════════════════════════════════════════
      {
        id: 'evt_006',
        title: 'Tariff escalation and TSMC Arizona semiconductor reshoring',
        category: 'Economic Policy · Trade · Semiconductors',
        framing: 'Broad tariff escalation coincided with TSMC\'s Arizona fabrication plant reaching production milestones. The policy debate split between tariff advocates and industrial-policy advocates, both claiming the reshoring as vindication. Neither side engaged the deeper supply chain — EUV lithography machines from ASML in the Netherlands remain the binding constraint.',
        prompt: 'Tariff escalation and semiconductor reshoring collide. Both sides claim vindication.',
        meta: { dialecticsRef: 'cs06', status: 'published', editHistory: [] },
        date: '2026-03-01',
        active: false,
        prevalentAxis: 'y',
        antiValentBand: 'badFaith',
        axes: {
          x: { pos: 'Right', neg: 'Left' },
          y: { pos: 'Institutional', neg: 'Populist' }
        },
        responses: {
          A: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'Reshoring yes. Tariffs no. Industrial policy is the tool.',
              xWord: 'industrial', yWord: 'policy',
              words: []
            },
            coalition: {
              text: 'The framework failed. I\'m not sure tariffs didn\'t work.',
              xWord: 'framework', yWord: 'tariffs',
              words: []
            },
            badFaith: {
              text: 'It\'s a regressive tax with a nationalist paint job.',
              xWord: 'regressive', yWord: 'nationalist',
              words: []
            }
          },
          B: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Tariffs distort prices, invite retaliation, and surrender leverage.',
              xWord: 'tariffs', yWord: 'leverage',
              words: []
            },
            coalition: {
              text: 'Comparative advantage was right on aggregate, wrong on distribution.',
              xWord: 'advantage', yWord: 'distribution',
              words: []
            },
            badFaith: {
              text: 'Markets were already reshoring. Politicians just want the photo.',
              xWord: 'markets', yWord: 'politicians',
              words: []
            }
          },
          C: {
            xSide: 'left',
            source: '',
            goodFaith: {
              text: 'Cheap goods meant exploited workers. The friction is overdue.',
              xWord: 'exploited', yWord: 'friction',
              words: []
            },
            coalition: {
              text: 'The thing I wanted is happening for the wrong reasons.',
              xWord: 'wanted', yWord: 'wrong reasons',
              words: []
            },
            badFaith: {
              text: 'Reshoring is hegemony maintenance. We\'re forcing the transfer.',
              xWord: 'hegemony', yWord: 'forcing',
              words: []
            }
          },
          D: {
            xSide: 'right',
            source: '',
            goodFaith: {
              text: 'Thirty years of \'inevitable.\' Now it\'s \'too expensive.\' For who?',
              xWord: 'inevitable', yWord: 'expensive',
              words: []
            },
            coalition: {
              text: 'I believe in the direction. I\'m not sure who\'s steering.',
              xWord: 'direction', yWord: 'steering',
              words: []
            },
            badFaith: {
              text: 'Bring it all back. Every factory. Every job. American.',
              xWord: 'American', yWord: 'factory',
              words: []
            }
          }
        },
        diatribe: {
          LG: { text: 'The left is distinguishing between industrial policy and tariffs — reshoring through targeted investment rather than blunt price distortion.', side: 'left', faith: 'good' },
          LB: { text: 'The left is reflexively opposing tariffs because of who enacted them, even when the outcome matches their stated policy goals.', side: 'left', faith: 'bad' },
          RG: { text: 'The right is correct that decades of offshoring created real distributional harm — the question of friction and cost-bearing is legitimate.', side: 'right', faith: 'good' },
          RB: { text: 'The right is wrapping a regressive consumption tax in nationalist language, claiming vindication for an outcome industrial policy produced.', side: 'right', faith: 'bad' }
        }
      }
    ];

    // ── Derive words for all seeded responses ──
    events.forEach(evt => _normalizeEventWords(evt));

    _set(KEYS.events, events);

    // ── Generate mock aggregate responses (50 per event) ──
    const mockResponses = [];
    const quads = ['A','B','C','D'];
    const qCenters = {
      A: {x:0.75, y:0.25}, B: {x:0.25, y:0.25},
      C: {x:0.25, y:0.75}, D: {x:0.75, y:0.75}
    };
    // Weight: A gets most, D gets fewest (matches spec's minority quadrant)
    const qWeights = { A: 18, B: 12, C: 13, D: 7 };

    events.forEach(evt => {
      quads.forEach(q => {
        const count = qWeights[q];
        const center = qCenters[q];
        for (let i = 0; i < count; i++) {
          const spread = 0.16;
          const px = Math.max(0.02, Math.min(0.98, center.x + (Math.random() - 0.5) * spread * 2));
          const py = Math.max(0.02, Math.min(0.98, center.y + (Math.random() - 0.5) * spread * 2));
          const dist = Math.sqrt(Math.pow(px - center.x, 2) + Math.pow(py - center.y, 2));
          const intensity = Math.max(1, Math.min(100, Math.round((1 - dist / 0.35) * 100)));
          const dScore = Math.round((Math.random() - 0.5) * 200);
          mockResponses.push({
            id: 'mock_' + evt.id + '_' + q + '_' + i,
            eventId: evt.id,
            timestamp: Date.now() - Math.floor(Math.random() * 86400000),
            initialChoice: q,
            finalQuadrant: q,
            diverged: false,
            pin: { x: px, y: py },
            coords: { x: Math.round(px * 200 - 100), y: Math.round((1 - py) * 200 - 100) },
            intensity: intensity,
            intensityBand: intensity <= 33 ? 'nominal' : intensity <= 66 ? 'coalition' : 'conviction',
            text: '',
            diatribeScore: dScore,
            diatribeFaith: Math.abs(dScore) <= 50 ? 'good' : 'bad',
            diatribeSide: dScore < 0 ? 'left' : 'right',
            diatribeBand: Math.abs(dScore) <= 33 ? 'nominal' : Math.abs(dScore) <= 66 ? 'coalitional' : 'conviction',
            zValue: 0,
            zReason: '',
            mock: true
          });
        }
      });
    });

    _set(KEYS.responses, mockResponses);

    // Set initial state — first event active
    _set(KEYS.state, { currentEventId: 'evt_001', lastCompletedEventId: null, eventsCompleted: 0 });

    console.log('PrismDB seeded: ' + events.length + ' events, ' + mockResponses.length + ' mock responses.');
    return true;
  }

  return {
    getEvents, getEvent, getActiveEvent,
    addEvent, updateEvent, deleteEvent, setActive,
    getResponses, getResponsesForEvent, hasRespondedToEvent, saveResponse,
    getAggregateForEvent,
    getSnapshots, getSnapshotsForEvent, saveSnapshot,
    getArcs, getArc, saveArc, deleteArc,
    getState, setState,
    getUser, setUser,
    clear, seed
  };
})();

// Dev utility: run PrismDB.seed() in console to load example events
// Auto-seed is disabled — use admin.html to create real events
