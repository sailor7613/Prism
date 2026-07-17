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
    arcs:      'prism_arcs',
    members:   'prism_members',
    memberPos: 'prism_member_positions',
    followed:  'prism_followed',
    billScores: 'prism_bill_scores',
    ticker:    'prism_ticker_ledger',
    candidates: 'prism_candidates'
  };

  function _get(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch(e) { return null; }
  }
  function _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ── Events (read) ───────────────────────────────────────
  function getEvents() { return _get(KEYS.events) || []; }

  function getEvent(id) {
    return getEvents().find(e => e.id === id) || null;
  }

  function getActiveEvent() {
    return getEvents().find(e => e.active) || null;
  }

  // ── Events (write) ──────────────────────────────────────
  // rid = the Reading's stable cross-device identity (sync layer
  // matches on it; the repo file is named by it). Local ids stay
  // sequential and device-local, per the standing CLAUDE.md note.
  function mintRid() {
    return 'rdg_' + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
  }

  function addEvent(eventObj) {
    const events = getEvents();
    // Generate ID
    const maxNum = events.reduce((max, e) => {
      const n = parseInt(e.id.replace('evt_', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    eventObj.id = 'evt_' + String(maxNum + 1).padStart(3, '0');
    if (!eventObj.rid) eventObj.rid = mintRid();

    // If this event is active, deactivate all others
    if (eventObj.active) {
      events.forEach(e => e.active = false);
    }

    events.push(eventObj);
    _set(KEYS.events, events);
    return eventObj;
  }

  // Upsert a pulled Reading by rid. Never steals this device's
  // active flag; preserves the local event id on update.
  function importReading(reading) {
    const events = getEvents();
    const idx = events.findIndex(e => e.rid === reading.rid);
    if (idx !== -1) {
      const keep = { id: events[idx].id, active: events[idx].active };
      events[idx] = { ...events[idx], ...reading, ...keep };
      _set(KEYS.events, events);
      return events[idx];
    }
    return addEvent({ ...reading, active: false });
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

  // ── Followed legislators ──────────────────────────────────
  // A flat list of bioguideIds the user has chosen to track. Order is
  // preservation order (most-recent follow last). The "your delegation"
  // section in the UI is derived separately from the delegation profile
  // below, so this list is the user's *explicit* follows only.
  function getFollowed() {
    const v = _get(KEYS.followed);
    return Array.isArray(v) ? v : [];
  }
  function isFollowing(bioguideId) {
    return getFollowed().indexOf(bioguideId) !== -1;
  }
  function follow(bioguideId) {
    if (!bioguideId) return getFollowed();
    const list = getFollowed();
    if (list.indexOf(bioguideId) === -1) { list.push(bioguideId); _set(KEYS.followed, list); }
    return list;
  }
  function unfollow(bioguideId) {
    const list = getFollowed().filter(id => id !== bioguideId);
    _set(KEYS.followed, list);
    return list;
  }
  function toggleFollow(bioguideId) {
    return isFollowing(bioguideId) ? (unfollow(bioguideId), false) : (follow(bioguideId), true);
  }

  // ── User delegation (home state + House district) ─────────
  // Stored on the user profile so it travels with identity. `state` is a USPS
  // abbreviation (e.g. 'MD'); `district` is the House district number (or null
  // for at-large / unknown). Used to surface the user's own senators + rep at
  // the top of the tracker. Senators have district === null in the roster.
  function getDelegation() {
    const u = getUser() || {};
    return u.delegation || { state: null, district: null, zip: null };
  }
  function setDelegation(d) {
    const u = getUser() || {};
    u.delegation = {
      state: (d && d.state) ? String(d.state).toUpperCase().slice(0, 2) : null,
      district: (d && d.district != null && d.district !== '') ? Number(d.district) : null,
      zip: (d && d.zip != null && d.zip !== '') ? String(d.zip).replace(/[^0-9]/g, '').slice(0, 5) : null
    };
    setUser(u);
    return u.delegation;
  }

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
  //       prevalentAxis: 'y',  // 'x' | 'y'
  //       denominationAxis: null,  // 'x' | 'y' | null — which axis sorts fluid/denominated pattern; divergence from prevalentAxis = oscillation
  //       objectInstantiation: '',  // specific institutional face of the Object at this event
  //       qz: { A: 0.85, B: 0.40, C: -0.90, D: -0.60 },
  //       qs: { A: null, B: null, C: null, D: null },  // 'fluid' | 'denominated' | 'mixed' | null — per-quadrant denomination status
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
      // Preserve inline events and eventData if not provided in update
      if (!Array.isArray(arc.events) || arc.events.length === 0) {
        arc.events = arcs[idx].events || [];
      }
      if (!arc.eventData && arcs[idx].eventData) {
        arc.eventData = arcs[idx].eventData;
      }
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

  // ── Arc ↔ Event linking ─────────────────────────────────
  // Events in the main store can link to arcs via arcMemberships[].
  // Seed arcs store events inline. getArcEvents handles both.

  function getArcEvents(arcId) {
    // 1. Check main events store for membership links
    const allEvents = getEvents();
    const linked = allEvents.filter(e =>
      Array.isArray(e.arcMemberships) &&
      e.arcMemberships.some(m => m.arcId === arcId)
    );
    if (linked.length > 0) return linked;

    // 2. Fall back to inline arc.events[] (seed data)
    const arc = getArc(arcId);
    if (!arc || !Array.isArray(arc.events) || arc.events.length === 0) return [];

    // Normalize inline events: map label→title, add synthetic arcMemberships
    return arc.events.map(e => ({
      ...e,
      title: e.title || e.label || e.id,
      arcMemberships: [{ arcId, status: 'confirmed' }]
    }));
  }

  function addEventToArc(eventId, arcId, status) {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === eventId);
    if (idx === -1) return null;

    if (!Array.isArray(events[idx].arcMemberships)) {
      events[idx].arcMemberships = [];
    }
    // Upsert: update status if already linked, otherwise add
    const mIdx = events[idx].arcMemberships.findIndex(m => m.arcId === arcId);
    if (mIdx !== -1) {
      events[idx].arcMemberships[mIdx].status = status || 'confirmed';
    } else {
      events[idx].arcMemberships.push({ arcId, status: status || 'confirmed' });
    }

    _set(KEYS.events, events);
    return events[idx];
  }

  function removeEventFromArc(eventId, arcId) {
    // 1. Strip arcMemberships from main events store (if present)
    const events = getEvents();
    const idx = events.findIndex(e => e.id === eventId);
    if (idx !== -1 && Array.isArray(events[idx].arcMemberships)) {
      events[idx].arcMemberships = events[idx].arcMemberships.filter(m => m.arcId !== arcId);
      _set(KEYS.events, events);
    }

    // 2. Remove from arc's eventIds array and inline events[]
    const arc = getArc(arcId);
    if (arc) {
      if (Array.isArray(arc.eventIds)) {
        arc.eventIds = arc.eventIds.filter(id => id !== eventId);
      }
      if (Array.isArray(arc.events)) {
        arc.events = arc.events.filter(e => e.id !== eventId);
      }
      // Clean up orphaned eventData
      if (arc.eventData && arc.eventData[eventId]) {
        delete arc.eventData[eventId];
      }
      saveArc(arc);
    }

    return idx !== -1 ? events[idx] : { id: eventId };
  }

  // ── Members ──────────────────────────────────────────────
  // Schema: { bioguideId, name:{first,last,full}, party, chamber,
  //   state, district, inOffice, terms, nominateD1, nominateD2,
  //   photoUrl, lastUpdated }

  function getMembers() { return _get(KEYS.members) || []; }

  function getMember(bioguideId) {
    return getMembers().find(m => m.bioguideId === bioguideId) || null;
  }

  function getMembersByState(state) {
    return getMembers().filter(m => m.state === state);
  }

  function getMembersByChamber(chamber) {
    return getMembers().filter(m => m.chamber === chamber);
  }

  function getMembersByParty(party) {
    return getMembers().filter(m => m.party === party);
  }

  function loadMembers(membersArray) {
    if (!Array.isArray(membersArray)) {
      console.error('PrismDB.loadMembers: expected array');
      return false;
    }
    _set(KEYS.members, membersArray);
    console.log('PrismDB: loaded ' + membersArray.length + ' members.');
    return true;
  }

  function updateMember(bioguideId, data) {
    const members = getMembers();
    const idx = members.findIndex(m => m.bioguideId === bioguideId);
    if (idx === -1) return null;
    members[idx] = { ...members[idx], ...data, bioguideId };
    _set(KEYS.members, members);
    return members[idx];
  }

  function searchMembers(query) {
    const q = query.toLowerCase();
    return getMembers().filter(m =>
      m.name.full.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q) ||
      m.bioguideId.toLowerCase() === q
    );
  }

  // ── Member Event Positions ────────────────────────────────
  // Same ontological structure as Derive output. A member's
  // position on a Prism event is scored by the same engine that
  // scores editorial content and user responses.
  //
  // Schema: { id, bioguideId, eventId, quadrant, x, y,
  //   pin:{x,y}, z, diatribe, diatribeBand, confidence,
  //   method, provenance, sources:{votes,statements,legislation},
  //   keywords:{A,B,C,D}, adminOverride, timestamp }

  function getMemberPositions() { return _get(KEYS.memberPos) || []; }

  function getMemberPositionsForEvent(eventId) {
    return getMemberPositions().filter(p => p.eventId === eventId);
  }

  function getMemberPositionHistory(bioguideId) {
    return getMemberPositions().filter(p => p.bioguideId === bioguideId);
  }

  function getMemberPosition(bioguideId, eventId) {
    return getMemberPositions().find(
      p => p.bioguideId === bioguideId && p.eventId === eventId
    ) || null;
  }

  function saveMemberPosition(pos) {
    pos.id = pos.id || ('mpos_' + pos.bioguideId + '_' + pos.eventId);
    pos.timestamp = pos.timestamp || new Date().toISOString();

    // Derive quadrant from pin if not set
    if (!pos.quadrant && pos.pin) {
      const right = pos.pin.x >= 0.5;
      const top = pos.pin.y < 0.5;
      if (right && top) pos.quadrant = 'A';
      else if (!right && top) pos.quadrant = 'B';
      else if (!right && !top) pos.quadrant = 'C';
      else pos.quadrant = 'D';
    }

    // Diatribe band
    if (pos.diatribe != null && !pos.diatribeBand) {
      pos.diatribeBand = pos.diatribe <= 33 ? 'nominal'
                       : pos.diatribe <= 66 ? 'coalition'
                       : 'conviction';
    }

    // Defaults
    pos.confidence = pos.confidence ?? 0;
    pos.method = pos.method || 'derive';
    pos.provenance = pos.provenance || 'DERIVED';
    pos.sources = pos.sources || { votes: [], statements: [], legislation: [] };
    pos.keywords = pos.keywords || { A: [], B: [], C: [], D: [] };
    pos.adminOverride = pos.adminOverride || false;

    const all = getMemberPositions();
    const idx = all.findIndex(p => p.id === pos.id);
    if (idx !== -1) {
      all[idx] = pos;
    } else {
      all.push(pos);
    }
    _set(KEYS.memberPos, all);
    return pos;
  }

  function saveMemberPositions(positions) {
    const all = getMemberPositions();
    const idMap = new Map(all.map((p, i) => [p.id, i]));

    positions.forEach(pos => {
      pos.id = pos.id || ('mpos_' + pos.bioguideId + '_' + pos.eventId);
      pos.timestamp = pos.timestamp || new Date().toISOString();
      const existIdx = idMap.get(pos.id);
      if (existIdx != null) {
        all[existIdx] = pos;
      } else {
        all.push(pos);
        idMap.set(pos.id, all.length - 1);
      }
    });

    _set(KEYS.memberPos, all);
    console.log('PrismDB: saved ' + positions.length + ' member positions.');
    return positions;
  }

  function deleteMemberPosition(bioguideId, eventId) {
    const id = 'mpos_' + bioguideId + '_' + eventId;
    const all = getMemberPositions().filter(p => p.id !== id);
    _set(KEYS.memberPos, all);
    return true;
  }

  // Get member pins in same shape as user aggregate pins
  // so graphmap can render them alongside user data
  function getMemberAggregateForEvent(eventId) {
    return getMemberPositionsForEvent(eventId).map(p => {
      const member = getMember(p.bioguideId);
      return {
        x: p.pin ? p.pin.x : 0.5,
        y: p.pin ? p.pin.y : 0.5,
        quadrant: p.quadrant,
        intensity: p.diatribe || 50,
        z: p.z || 0,
        type: 'member',
        bioguideId: p.bioguideId,
        name: member ? member.name.full : p.bioguideId,
        party: member ? member.party : '?',
        chamber: member ? member.chamber : '',
        method: p.method,
        confidence: p.confidence
      };
    });
  }

  // ── Bill Scores (prism_bill_scores) ─────────────────────
  // Promotion of curated bill readings out of evt.billAnalysis
  // (Portal Ontology spec §4.1; heuristics handoff §3 #6 / §5.3).
  // A Prism reading of a bill happens ON an event's axes, so scores
  // key by bill+event — but the store makes every reading globally
  // visible: a reading earned in one event is queryable from all,
  // and survives without the event write.
  //
  // Schema: { id: 'bscore_<billId>_<eventId>', billId, eventId,
  //   billName, displacement, objectZ, diatribe, quadrants,
  //   framingKeywords, reason, rubricId, method, provenance,
  //   confirmedAt, timestamp }
  // Lineage fields are REQUIRED at save — a score without
  // {rubricId, method, provenance} is refused (spec §2: lineage is
  // architecture, not discipline).

  function getBillScores() { return _get(KEYS.billScores) || []; }

  function getBillScoresForBill(billId) {
    return getBillScores().filter(s => s.billId === billId);
  }

  function getBillScoresForEvent(eventId) {
    return getBillScores().filter(s => s.eventId === eventId);
  }

  function getBillScore(billId, eventId) {
    return getBillScores().find(
      s => s.billId === billId && s.eventId === eventId
    ) || null;
  }

  function saveBillScore(score) {
    if (!score || !score.billId || !score.eventId) {
      console.warn('PrismDB.saveBillScore: billId + eventId required — refused.');
      return null;
    }
    if (!score.rubricId || !score.method || !score.provenance) {
      console.warn('PrismDB.saveBillScore: lineage {rubricId, method, provenance} required — refused.');
      return null;
    }
    score.id = score.id || ('bscore_' + score.billId + '_' + score.eventId);
    score.timestamp = score.timestamp || new Date().toISOString();

    const all = getBillScores();
    const idx = all.findIndex(s => s.id === score.id);
    if (idx !== -1) {
      all[idx] = score;
    } else {
      all.push(score);
    }
    _set(KEYS.billScores, all);
    return score;
  }

  function deleteBillScore(billId, eventId) {
    const id = 'bscore_' + billId + '_' + eventId;
    const all = getBillScores().filter(s => s.id !== id);
    _set(KEYS.billScores, all);
    return true;
  }

  // ── Delta ticker ledger (2026-07-10, build spec v1) ─────
  // APPEND-ONLY. Deltas are computed once, at commit, and never
  // recomputed — an entry's coordinates are frozen history (replay
  // uses them verbatim; live positions would let drift corrupt the
  // story the tile tells). Nothing captures on pull. Aggregate
  // deltas append as new tiles when the push arrives.
  function getTickerEntries(eventId) {
    const all = _get(KEYS.ticker) || [];
    return eventId ? all.filter(t => t.eventId === eventId) : all;
  }

  function appendTickerEntries(entries) {
    if (!Array.isArray(entries) || !entries.length) return [];
    const all = _get(KEYS.ticker) || [];
    entries.forEach((t, i) => {
      t.id = t.id || ('tick_' + Date.now() + '_' + all.length + '_' + i);
      t.ts = t.ts || Date.now();
      all.push(t);
    });
    _set(KEYS.ticker, all);
    return entries;
  }

  // ── Event Engine candidates (Build Spec v1 §9, ratified 2026-07-13) ──
  // Raw, pre-author candidate events from the sourcing layer. The admin
  // newsroom's "scan" imports window.PRISM_CANDIDATES here, the triage
  // board reads/writes status, Promote stamps promotedEventId. Local
  // admin data — disposable per the wiped-store rules.
  //
  // Schema: { cid, source:'legislative'|'news'|'fused', ts, raw:{…},
  //   title, summary, framingDraft, suggestedAxes:{x:{pos,neg},y:{pos,neg}},
  //   prevalentAxisGuess:'x'|'y', members:[bioguideId…], bills:[billId…],
  //   fitness:{score,reason,method,ts}, status:'new'|'promoted'|'dismissed',
  //   promotedEventId?,
  //   voteMap?:{voteId,yeaPole:'pos'|'neg'},    // M2 proposal: which pole a
  //     YEA maps to on the prevalent axis — seeds the save-time member-
  //     position write (RULED 2026-07-13). Fitness is CONSTITUTIVE per
  //     spec §4 as amended: quality of the best secondary binary, not a
  //     two-dimensionality diagnosis.
  //   mts?: ms }  // last LOCAL mutation — the LWW key the committed middle
  //     stratum (data/candidate_scores.json) syncs on (RULED 2026-07-15).
  //     Stamped by saveCandidate; baked back in by the fetchers at scan.

  function getCandidates() { return _get(KEYS.candidates) || []; }

  function getCandidate(cid) {
    return getCandidates().find(c => c.cid === cid) || null;
  }

  function saveCandidate(cand) {
    if (!cand || !cand.cid) {
      console.warn('PrismDB.saveCandidate: cid required — refused.');
      return null;
    }
    cand.ts = cand.ts || Date.now();
    cand.status = cand.status || 'new';
    // mts = last local mutation. Every local change (score, dismiss,
    // promote, restore) funnels through here; it is the LWW key the
    // committed middle stratum (candidate_scores.json) syncs on.
    cand.mts = Date.now();
    const all = getCandidates();
    const idx = all.findIndex(c => c.cid === cand.cid);
    if (idx !== -1) all[idx] = cand; else all.push(cand);
    _set(KEYS.candidates, all);
    return cand;
  }

  // Merge a sourced batch (window.PRISM_CANDIDATES) into the store.
  // Upserts by cid but NEVER clobbers local triage state: an existing
  // candidate keeps its status + promotedEventId; brand-new ones enter
  // as 'new'. Returns { added, updated }.
  function importCandidates(batch) {
    if (!Array.isArray(batch)) return { added: 0, updated: 0 };
    const all = getCandidates();
    const byId = new Map(all.map((c, i) => [c.cid, i]));
    let added = 0, updated = 0;
    batch.forEach(c => {
      if (!c || !c.cid) return;
      const idx = byId.get(c.cid);
      if (idx != null) {
        const keep = {
          status: all[idx].status,
          promotedEventId: all[idx].promotedEventId
        };
        // M2 fills these locally; the scanner ships them null — a rescan
        // must never let an incoming null clobber a local score/draft.
        ['fitness', 'framingDraft', 'suggestedAxes', 'prevalentAxisGuess',
         'voteMap'].forEach(k => {
          if (c[k] == null && all[idx][k] != null) keep[k] = all[idx][k];
        });
        // Scanned candidates may arrive with BAKED M2 fields (the fetchers
        // re-merge data/candidate_scores.json — persistence §1.5). Baked
        // records carry mts; if the local copy is NEWER (scored/triaged
        // since that bake was pushed), the local stratum wins wholesale.
        if (c.mts != null && (all[idx].mts || 0) > c.mts) {
          ['fitness', 'framingDraft', 'suggestedAxes', 'prevalentAxisGuess',
           'voteMap'].forEach(k => {
            if (all[idx][k] != null) keep[k] = all[idx][k];
          });
          keep.mts = all[idx].mts;
        }
        all[idx] = { ...all[idx], ...c, ...keep };
        updated++;
      } else {
        all.push({ ...c, status: c.status || 'new', ts: c.ts || Date.now() });
        byId.set(c.cid, all.length - 1);
        added++;
      }
    });
    _set(KEYS.candidates, all);
    return { added, updated };
  }

  function dismissCandidate(cid) {
    const c = getCandidate(cid);
    if (!c) return null;
    c.status = 'dismissed';
    return saveCandidate(c);
  }

  // Hold (2026-07-17, Sailor's ruling): the third triage verdict —
  // "this story matters, not authoring yet." A held story pins above
  // the scan churn, commits to the middle stratum (any status ≠ 'new'
  // exports), and rides a snapshot so it outlives the scan window on
  // every device. ("Stories" is the ruled vocabulary for newsroom
  // items — code keeps candidates/cand_*, as prism_events kept its name.)
  function holdCandidate(cid) {
    const c = getCandidate(cid);
    if (!c) return null;
    c.status = 'held';
    return saveCandidate(c);
  }

  function promoteCandidate(cid, eventId) {
    const c = getCandidate(cid);
    if (!c) return null;
    c.status = 'promoted';
    if (eventId) c.promotedEventId = eventId;
    return saveCandidate(c);
  }

  function deleteCandidate(cid) {
    _set(KEYS.candidates, getCandidates().filter(c => c.cid !== cid));
    return true;
  }

  // ── The middle stratum: scored-but-unpromoted + triage state ──
  // (Persistence RULED 2026-07-15, Curation Desk direction handoff §1.5.)
  // data/candidate_scores.json is the committed record; these two are its
  // store-side faces. LWW per cid by `mts` (stamped in saveCandidate).
  // promotedEventId travels as PROVENANCE ONLY — evt ids are device-local,
  // so merge never applies it; status is what crosses devices.
  const SCORE_FIELDS = ['fitness', 'framingDraft', 'suggestedAxes',
                        'prevalentAxisGuess', 'voteMap'];

  // ── Draft tier (2026-07-15, closes the "drafts don't travel" gap) ──
  // An UNPUBLISHED Reading born from a promoted candidate rides its
  // stratum record as `draftReading`, so a park draft reaches the desk.
  // Once published (syncedAt set), the Reading travels its own pipe
  // (data/readings/) and the draft stops riding. Shape = the Reading
  // file (device-local fields stripped, rid is the identity); LWW by
  // updatedAt on merge. Scratch drafts with no candidate lineage still
  // don't travel — the stratum is keyed by cid.
  const DRAFT_LOCAL_FIELDS = ['id', 'active', 'syncedAt'];
  function _draftFor(c) {
    if (c.status !== 'promoted' || !c.promotedEventId) return null;
    const ev = getEvent(c.promotedEventId);
    if (!ev || ev.syncedAt) return null;       // published — its own pipe now
    const d = {};
    Object.keys(ev).forEach(k => { if (!DRAFT_LOCAL_FIELDS.includes(k)) d[k] = ev[k]; });
    d.schema = 'reading/v1';
    d.updatedAt = ev.updatedAt || new Date(c.mts || Date.now()).toISOString();
    return d;
  }

  // ── Hold tier snapshot (2026-07-17) — a held record carries the story
  // whole, so a hold survives aging out of the scan window and lands on
  // devices that never imported the candidate. Same "records outlive
  // candidates" completion the draft tier got on 07-16, but invoked
  // deliberately from triage rather than as a side effect of drafting.
  const STORY_FIELDS = ['title', 'source', 'summary', 'bills', 'members'];
  function _storyFor(c) {
    const s = {};
    STORY_FIELDS.forEach(k => { if (c[k] != null) s[k] = c[k]; });
    if (c.raw) s.raw = { salience: c.raw.salience,
                         congressGovUrl: c.raw.congressGovUrl,
                         articles: (c.raw.articles || []).slice(0, 6) };
    return s;
  }

  // Records for every candidate that carries any M2 field or has left
  // 'new' — i.e. the stratum worth committing. Shape: { cid: record }.
  function exportCandidateScores() {
    const records = {};
    getCandidates().forEach(c => {
      const scored = SCORE_FIELDS.some(k => c[k] != null);
      if (!scored && c.status === 'new') return;
      const r = { mts: c.mts || c.ts || Date.now(), status: c.status,
                  title: c.title || null };
      SCORE_FIELDS.forEach(k => { if (c[k] != null) r[k] = c[k]; });
      if (c.promotedEventId) r.promotedEventId = c.promotedEventId; // provenance
      const d = _draftFor(c);
      if (d) r.draftReading = d;               // draft tier — see above
      if (c.status === 'held') r.story = _storyFor(c);  // hold tier — see above
      records[c.cid] = r;
    });
    return records;
  }

  // Draft tier: a riding draft upserts by rid, LWW by updatedAt.
  // A locally-PUBLISHED copy (syncedAt) always outranks a draft —
  // a stale park draft must never clobber the published Reading.
  // Lineage relinks to THIS device's event id (evt ids are local).
  function _applyDraft(c, r) {
    if (!r.draftReading || !r.draftReading.rid) return;
    const d = r.draftReading;
    const local = getEvents().find(e => e.rid === d.rid);
    if (!local) {
      const ev = importReading({ ...d, active: false });
      if (ev && c.status === 'promoted') c.promotedEventId = ev.id;
    } else if (!local.syncedAt && (d.updatedAt || '') > (local.updatedAt || '')) {
      const ev = importReading({ ...d });
      if (ev && c.status === 'promoted') c.promotedEventId = ev.id;
    } else if (c.status === 'promoted') {
      c.promotedEventId = local.id;
    }
  }

  // Merge pulled records into the store. Applies M2 fields + status when
  // the record is newer than the local copy; never touches candidates the
  // store doesn't hold (a record may outlive its candidate — that's the
  // editorial history, not an error) — EXCEPT a record carrying a draft,
  // which resurrects its candidate (see below). Returns { applied, skipped }.
  function mergeCandidateScores(records) {
    if (!records || typeof records !== 'object') return { applied: 0, skipped: 0 };
    const all = getCandidates();
    let applied = 0, skipped = 0;
    all.forEach(c => {
      const r = records[c.cid];
      if (!r) return;
      if ((r.mts || 0) <= (c.mts || 0)) { skipped++; return; }
      SCORE_FIELDS.forEach(k => { if (r[k] != null) c[k] = r[k]; });
      if (r.status === 'new' || r.status === 'held' ||
          r.status === 'promoted' || r.status === 'dismissed') {
        // never regress a locally-promoted candidate to 'promoted' minus id
        if (!(c.status === 'promoted' && r.status === 'promoted')) c.status = r.status;
        if (c.status !== 'promoted') delete c.promotedEventId;
      }
      _applyDraft(c, r);
      c.mts = r.mts;
      applied++;
    });
    // Resurrection (2026-07-16, closes the aged-out-candidate gap): a
    // record that arrives CARRYING A DRAFT regenerates its candidate —
    // "records outlive candidates" completes itself. Without this, a
    // park draft whose story aged out of the scan window could never
    // land on a second device (live bite: Iran/NDAA — the desk never
    // held the candidate, so the merge skipped the record wholesale).
    // Scored-only strays still stay records-without-candidates.
    // Hold tier (2026-07-17): a held record carrying its story snapshot
    // resurrects the same way a draft does — a phone hold materializes
    // on the desk even after the story ages out of the scan window.
    Object.keys(records).forEach(cid => {
      const r = records[cid];
      if (!r) return;
      const hasDraft = r.draftReading && r.draftReading.rid;
      const hasStory = r.status === 'held' && r.story;
      if (!hasDraft && !hasStory) return;
      if (all.some(c => c.cid === cid)) return;   // held locally — handled above
      const c = { cid,
                  source: cid.indexOf('cand_leg_') === 0 ? 'legislation' : 'news',
                  title: r.title || (hasDraft && r.draftReading.title) || cid,
                  status: r.status || 'promoted',
                  ts: r.mts || Date.now(), resurrected: true };
      if (hasStory) Object.assign(c, r.story);
      SCORE_FIELDS.forEach(k => { if (r[k] != null) c[k] = r[k]; });
      _applyDraft(c, r);
      c.mts = r.mts || Date.now();
      all.push(c);
      applied++;
    });
    if (applied) _set(KEYS.candidates, all);
    return { applied, skipped };
  }

  // ── Bill readings <-> published Reading (sync transport) ──
  // A published Reading carries its bill readings as portable rows:
  // store rows minus the device-local keys (`id` embeds the local
  // event id; `eventId` IS the local event id). Import rewrites them
  // onto this device's event id. Per-row last-write-wins by
  // `timestamp` — the same rule Readings use for `updatedAt`.
  // Lineage stays mandatory: saveBillScore's refusal applies on
  // import, so a row without {rubricId, method, provenance} never
  // enters the store no matter where it came from.
  const BSCORE_LOCAL_FIELDS = ['id', 'eventId'];

  function exportBillReadings(eventId) {
    return getBillScoresForEvent(eventId).map(s => {
      const r = {};
      Object.keys(s).forEach(k => {
        if (!BSCORE_LOCAL_FIELDS.includes(k)) r[k] = s[k];
      });
      return r;
    });
  }

  function importBillReadings(localEventId, billReadings) {
    if (!localEventId || !Array.isArray(billReadings)) {
      return { imported: 0, skipped: 0 };
    }
    let imported = 0, skipped = 0;
    billReadings.forEach(r => {
      if (!r || !r.billId) { skipped++; return; }
      const cur = getBillScore(r.billId, localEventId);
      if (cur && (cur.timestamp || '') >= (r.timestamp || '')) {
        skipped++;                       // local row is as new or newer
        return;
      }
      const row = Object.assign({}, r, { eventId: localEventId });
      delete row.id;                     // recomputed from billId + local event id
      if (saveBillScore(row)) imported++; else skipped++;
    });
    return { imported, skipped };
  }

  // One-time catch-up: walk legacy per-event `evt.billAnalysis` blobs
  // and promote any rows the store doesn't already have (iPad-era
  // curations that predate the store write). Store rows always win —
  // this never overwrites. Run from the console: PrismDB.migrateBillAnalysis()
  function migrateBillAnalysis() {
    let promoted = 0;
    getEvents().forEach(ev => {
      const analysis = ev.billAnalysis || {};
      Object.keys(analysis).forEach(billId => {
        if (getBillScore(billId, ev.id)) return;
        const saved = saveBillScore(
          Object.assign({ billId: billId, eventId: ev.id }, analysis[billId])
        );
        if (saved) promoted++;
      });
    });
    return promoted;
  }

  // ── Dev Utilities ───────────────────────────────────────
  function clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    console.log('PrismDB cleared (including arcs, members, positions).');
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
          LF: { text: 'The left is holding what\'s true — a federal agent killed a legally armed American citizen — and asking for the institutional response that fact demands: investigation, evidence, accountability before narrative.', side: 'left', band: 'fluid' },
          LC: { text: 'The left is watching its own discourse skip from "independent inquiry" to "abolish ICE" in forty-eight hours, and only the people still inside the move can feel it slipping.', side: 'left', band: 'coalition' },
          LD: { text: 'The left is reading the killing as proof of state fascism and treating every prior framework as collaboration — Pretti frozen into martyr vehicle, the institution frozen into machine.', side: 'left', band: 'denominated' },
          RF: { text: 'The principled right is holding the constitutional line — a legal carrier killed by federal agents demands the same 2A defense that would extend to anyone else, regardless of context.', side: 'right', band: 'fluid' },
          RC: { text: 'The right is watching its own people call a legal gun carrier a domestic terrorist and starting to see 2A becoming tribalism in costume — not switching sides, but not pretending it\'s fine.', side: 'right', band: 'coalition' },
          RD: { text: 'The right is performing law-and-order loyalty: a man with a holstered weapon near federal agents becomes "domestic terrorism," and sanctuary cities become the cause of the killing the agents committed.', side: 'right', band: 'denominated' }
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
          LF: { text: 'The left is holding the procedural line — state fraud prosecutions were working, six federal prosecutors resigned, the operation buried the fix that was already underway.', side: 'left', band: 'fluid' },
          LC: { text: 'The left knows the fraud was real and that Somali whistleblowers reported it first — and can\'t have the harder conversation because both sides demand the position pick one outrage.', side: 'left', band: 'coalition' },
          LD: { text: 'The left is reading Metro Surge as ethnic cleansing with extra steps, treating the fraud as a capitalist pretext and anyone naming enforcement concerns as carrying water for fascism.', side: 'left', band: 'denominated' },
          RF: { text: 'The right is responding to a real operational crisis — a billion in fraud with no accountability is a genuine failure that state systems wouldn\'t engage.', side: 'right', band: 'fluid' },
          RC: { text: 'The right wanted accountability and got Border Patrol arresting landscapers — three thousand arrests, zero fraud convictions, the prosecutors quit, the fraud cases collapsed.', side: 'right', band: 'coalition' },
          RD: { text: 'The right is using the fraud as permission structure for an immigration spectacle, framing state caution as cover for terror financing and federal agents as the only adults in the room.', side: 'right', band: 'denominated' }
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
          LF: { text: 'The left is naming a structural design problem — financialization of housing is a documented architecture with documented policy remedies, blocked by lobbying not by complexity.', side: 'left', band: 'fluid' },
          LC: { text: 'The left is watching three versions of the same bill die in committee and recognizing that belief in the legislative path is also belief in the institutions that keep deciding not to use it.', side: 'left', band: 'coalition' },
          LD: { text: 'The left is reading every market participant as private equity, treating rent itself as illegitimate income and any reformist position as complicity in dispossession.', side: 'left', band: 'denominated' },
          RF: { text: 'The right is correct that supply constraints are the foundational driver — fifty years of exclusion zoning created the vacuum institutional buyers walked into.', side: 'right', band: 'fluid' },
          RC: { text: 'The right is watching Delaware LLCs outbid families in cash and recognizing that the property-rights framework it used to protect community is now being used to tell it to shut up about the loss.', side: 'right', band: 'coalition' },
          RD: { text: 'The right is invoking "free market" to defend an arrangement where institutional capital faces none of the friction ordinary buyers face, scapegoating zoning to keep the rent-extraction architecture intact.', side: 'right', band: 'denominated' }
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
          LF: { text: 'The left is raising legitimate questions about strategic coherence — first-strike signaling without a trigger, coalition, or post-strike plan is denomination work, not strategy.', side: 'left', band: 'fluid' },
          LC: { text: 'The left is right about 1953, the Shah, the JCPOA withdrawal — and is collapsing into a mode where naming the history substitutes for engaging the 84% enrichment in front of it.', side: 'left', band: 'coalition' },
          LD: { text: 'The left is reading every escalation as the next Iraq, treating the nuclear threshold as a pretext for Hormuz oil control and any liberal-hawk position as the permission structure for the next war.', side: 'left', band: 'denominated' },
          RF: { text: 'The right is correct that credible deterrence requires willingness to act — maximum pressure without a military backstop is a posture with no enforcement, and the question is legitimate.', side: 'right', band: 'fluid' },
          RC: { text: 'The right knows Iran is not negotiating in good faith — and is watching an "America First" administration issue first-strike signals at a country with proxies in five regions and a chokehold on twenty percent of global oil.', side: 'right', band: 'coalition' },
          RD: { text: 'The right is performing toughness for domestic consumption, treating any reluctance to escalate as appeasement and any question about endgame as weakness.', side: 'right', band: 'denominated' }
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
          LF: { text: 'The left is naming a real policy gap — a stated red line with no enforcement is worse than no line at all, and the bombs landing in Rafah were American.', side: 'left', band: 'fluid' },
          LC: { text: 'The left did everything inside the rules — primaried, organized, voted uncommitted by the three-quarter million — and the architecture absorbed it like it absorbs everything, and the lesson people are drawing is that the rules don\'t work.', side: 'left', band: 'coalition' },
          LD: { text: 'The left is collapsing the entire history into a single frame of settler-colonial atrocity, treating any acknowledgement of complexity as complicity and any two-state position as management of the colonized.', side: 'left', band: 'denominated' },
          RF: { text: 'The right is correct that credibility depends on consistency — publicly threatening an ally during a war and then walking it back damages every security commitment the United States makes.', side: 'right', band: 'fluid' },
          RC: { text: 'The right knows the defense relationship with Israel runs through Congress and decades of appropriations no presidential interview can override — the question isn\'t why the red line failed, but why anyone thought it wouldn\'t.', side: 'right', band: 'coalition' },
          RD: { text: 'The right is using alliance credibility as a shield against any scrutiny of the policy itself — turning protest into antisemitism, turning the policy question into bigotry, and letting the money keep flowing.', side: 'right', band: 'denominated' }
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
          LF: { text: 'The left is distinguishing between industrial policy and tariffs — the CHIPS Act produced TSMC Arizona; the consumer tariffs are a regressive tax that funds nothing and builds nothing.', side: 'left', band: 'fluid' },
          LC: { text: 'The left spent fifteen years defending the multilateral framework and is watching the framework\'s predictions miss while a tariff-plus-subsidy mess produces the reshoring the framework said it would deliver.', side: 'left', band: 'coalition' },
          LD: { text: 'The left is reading the tariffs as American economic warfare on the Global South, treating reshoring as hegemony maintenance and arguing for cheap goods produced under conditions it would call exploitation if they happened here.', side: 'left', band: 'denominated' },
          RF: { text: 'The right is correct that decades of offshoring created real distributional harm — comparative advantage was right about aggregate welfare and wrong about distribution, and the adjustment mechanisms never got built.', side: 'right', band: 'fluid' },
          RC: { text: 'The right voted for the tariffs and would vote for them again — and is watching the skilled fab jobs go to imported Taiwanese engineers because nobody built the workforce pipeline that would have made reshoring reshore to American workers.', side: 'right', band: 'coalition' },
          RD: { text: 'The right is wrapping a regressive consumption tax in nationalist language, claiming vindication for an outcome industrial policy produced and demanding the wall around the economy be built the same way the wall on the border is.', side: 'right', band: 'denominated' }
        }
      }
    ];

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

  // ── Arc Seed — CS04: Iran-Contra → Maduro ──────────────
  function seedArc() {
    const arc = {
      id: 'arc_cs04',
      title: 'Immigration Arc (1982–2026)',
      subjectType: 'policy',
      description: 'The Empire as unified determining Object across four decades of immigration policy, from covert war through statutory architecture to populist capture.',
      object: 'The Empire',
      objectSelected: 'The Empire',
      objectEditorialName: 'The Empire',
      objectStatus: 'provisional',
      objectDescription: 'U.S. institutional apparatus — executive, legislative, and security establishment — as a continuous actor whose operative purposes persist across administrations.',
      eventIds: ['e4.1','e4.2','e4.3','e4.4','e4.5','e4.6','e4.7','e4.8','e4.9','e4.10'],
      events: [
        { id: 'e4.1', label: 'Iran-Contra / Didion / Webb', date: '1982',
          x: 0.7, y: 0.95, z: 0.85, dia: 80, type: 'event', prevalentAxis: 'y',
          denominationAxis: null, objectInstantiation: 'NSC covert operations apparatus',
          qz: { A: 0.85, B: 0.40, C: -0.90, D: -0.60 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: 'Covert ops apparatus, NSC', B: 'Institutional Democrats, Cold War liberals', C: 'Displaced Central Americans, anti-war activists', D: 'Libertarian skeptics, fiscal conservatives' } },
        { id: 'e4.2', label: 'IRCA + IIRIRA', date: '1986',
          x: 0, y: 0.90, z: 0.80, dia: 72, type: 'event', prevalentAxis: 'y',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: 0.30, B: -0.50, C: -0.40, D: 0.10 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.3', label: 'Pat Buchanan', date: '1992',
          x: 0.8, y: -0.9, z: -0.40, dia: 50, type: 'event', prevalentAxis: 'y',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: -0.50, B: -0.20, C: -0.10, D: 0.30 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.4', label: 'Three/ten-year bars', date: '1996',
          x: 0, y: 0.95, z: 0.90, dia: 75, type: 'event', prevalentAxis: 'y',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: 0.50, B: -0.80, C: -0.95, D: 0.20 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.5', label: 'Rubio \u2014 Gang of Eight', date: '2013',
          x: 0.4, y: 0.5, z: 0.20, dia: 25, type: 'event', prevalentAxis: 'x',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: 0.20, B: 0.40, C: 0.30, D: 0.10 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.6', label: 'Rubio \u2014 2016 reversal', date: '2016',
          x: 0.7, y: -0.6, z: 0.60, dia: 60, type: 'event', prevalentAxis: 'x',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: -0.30, B: -0.70, C: -0.80, D: -0.20 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.7', label: 'Family separation', date: '2018',
          x: 0.8, y: 0.85, z: 0.60, dia: 65, type: 'event', prevalentAxis: 'y',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: 0.40, B: -0.90, C: -0.95, D: -0.30 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.8', label: 'Progressive non-response', date: '2009',
          x: -0.7, y: 0.6, z: 0.70, dia: 70, type: 'event', prevalentAxis: 'y',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: 0.40, B: -0.85, C: -0.90, D: 0.30 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.9', label: '\u201cNot sending their best\u201d', date: '2015',
          x: 0.9, y: -0.85, z: 0.80, dia: 75, type: 'event', prevalentAxis: 'x',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: -0.60, B: -0.80, C: -0.95, D: 0.30 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } },
        { id: 'e4.10', label: 'Progressive totalization', date: '2015',
          x: -0.8, y: 0.6, z: 0.65, dia: 60, type: 'event', prevalentAxis: 'x',
          denominationAxis: null, objectInstantiation: '',
          qz: { A: -0.40, B: -0.50, C: -0.70, D: -0.80 },
          qs: { A: null, B: null, C: null, D: null },
          subjects: { A: '', B: '', C: '', D: '' } }
      ],
      linkedArticleId: null
    };
    saveArc(arc);
    console.log('PrismDB: CS04 arc seeded (' + arc.events.length + ' events).');
    return arc;
  }

  return {
    getEvents, getEvent, getActiveEvent,
    addEvent, updateEvent, deleteEvent, setActive,
    mintRid, importReading,
    getResponses, getResponsesForEvent, hasRespondedToEvent, saveResponse,
    getAggregateForEvent,
    getSnapshots, getSnapshotsForEvent, saveSnapshot,
    getArcs, getArc, saveArc, deleteArc,
    getArcEvents, addEventToArc, removeEventFromArc,
    seedArc,
    getMembers, getMember, getMembersByState, getMembersByChamber,
    getMembersByParty, loadMembers, updateMember, searchMembers,
    getMemberPositions, getMemberPositionsForEvent,
    getMemberPositionHistory, getMemberPosition,
    saveMemberPosition, saveMemberPositions, deleteMemberPosition,
    getMemberAggregateForEvent,
    getBillScores, getBillScoresForBill, getBillScoresForEvent,
    getBillScore, saveBillScore, deleteBillScore,
    getTickerEntries, appendTickerEntries,
    getCandidates, getCandidate, saveCandidate, importCandidates,
    exportCandidateScores, mergeCandidateScores,
    dismissCandidate, holdCandidate, promoteCandidate, deleteCandidate,
    exportBillReadings, importBillReadings, migrateBillAnalysis,
    getState, setState,
    getUser, setUser,
    getFollowed, isFollowing, follow, unfollow, toggleFollow,
    getDelegation, setDelegation,
    clear, seed
  };
})();

// Dev utility: run PrismDB.seed() in console to load example events
// Auto-seed is disabled — use admin.html to create real events
