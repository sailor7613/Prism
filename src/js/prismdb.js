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
    register:  'prism_object_register',   // Burns (2026-09-22): the newsroom's object register, pulled daily
    candidates: 'prism_candidates',
    // Editorial Desk runs (2026-07-26). Key name kept from build 1's inline
    // store in admin-surface.html, so any run recorded before this store
    // moved into PrismDB carries over unchanged.
    desk:      'prism_desk_v1'
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
      // Baked-path carry (2026-07-21, pipeline bake): `imageBaked` is
      // DERIVED — url-hashed by the bake, identical from any writer —
      // so it rides OUTSIDE LWW. The pipeline stamps the stratum story;
      // the holding device's own mts equals the record's, so without
      // this the stamp would never enter its store — and its next push
      // (export overlays pulled records) would erase it from the file.
      // Additive only: never overwrites a present imageBaked.
      const sArts = r.story && r.story.raw && Array.isArray(r.story.raw.articles)
        ? r.story.raw.articles : null;
      if (sArts && c.raw && Array.isArray(c.raw.articles)) {
        const bakedByImg = {};
        sArts.forEach(a => { if (a && a.image && a.imageBaked) bakedByImg[a.image] = a.imageBaked; });
        let stamped = false;
        c.raw.articles.forEach(a => {
          if (a && a.image && !a.imageBaked && bakedByImg[a.image]) {
            a.imageBaked = bakedByImg[a.image]; stamped = true;
          }
        });
        if (stamped) applied++;   // triggers the persist below even when LWW skips
      }
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
                  source: cid.indexOf('cand_leg_') === 0 ? 'legislative' : 'news',
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
  // ── Editorial Desk runs (2026-07-26) ────────────────────
  // One record per event: Sailor's fire-time snapshot, Sonnet's independent
  // column, per-slot resolutions, and calibration-schema deltas. Deliberately
  // a SEPARATE store from prism_events (Editorial Desk handoff §4 — "never
  // silently overwrite"): an event save can never clobber a desk run, and
  // the two columns stay separate stored objects until an explicit per-slot
  // resolution. The accumulated deltas are the record the closed form is
  // meant to grow out of (§5) — future readers go through these accessors.
  function getDesks() { return _get(KEYS.desk) || {}; }
  function getDesk(eventId) { return getDesks()[eventId] || null; }
  function saveDesk(rec) {
    if (!rec || !rec.eventId) return null;
    const all = getDesks();
    // LWW per record on updatedAt — a stale tab never wins silently.
    // Refusal returns the stored (newer) record; the caller compares
    // identity to detect it and warns instead of overwriting.
    const cur = all[rec.eventId];
    if (cur && cur.updatedAt && rec.updatedAt && cur.updatedAt > rec.updatedAt) return cur;
    rec.updatedAt = new Date().toISOString();
    all[rec.eventId] = rec;
    _set(KEYS.desk, all);
    return rec;
  }
  function deleteDesk(eventId) {
    const all = getDesks();
    if (all[eventId]) { delete all[eventId]; _set(KEYS.desk, all); }
  }

  // Sync-side upsert (2026-07-28, draft sync spine §3.5 — desk records
  // converge). Unlike saveDesk this PRESERVES the incoming updatedAt:
  // re-stamping an imported record would make every origin's copy
  // "newest" and the tier could never converge. Same LWW, same refusal:
  // a local record as new or newer stays put (returns null).
  function importDeskRecord(eventId, rec) {
    if (!eventId || !rec) return null;
    const all = getDesks();
    const cur = all[eventId];
    if (cur && (cur.updatedAt || '') >= (rec.updatedAt || '')) return null;
    all[eventId] = Object.assign({}, rec, { eventId: eventId });
    _set(KEYS.desk, all);
    return all[eventId];
  }

  // ── rid backfill (2026-07-28, draft sync spine §3.4 — one-time) ──
  // Pre-rid-era readings merge by title, which is exactly the fragility
  // the rid exists to end. Mint them a rid ONCE, on the canonical
  // desktop origin only (running this on two origins would fork
  // identities — the sync then propagates the canonical minting).
  // Mechanical call, logged lineage: PrismDB.backfillRids() in the
  // console on http://127.0.0.1:5500; pass true to override the guard.
  function backfillRids(force) {
    const CANON = '127.0.0.1:5500';
    if (!force && typeof location !== 'undefined' && location.host !== CANON) {
      console.warn('PrismDB.backfillRids: refused — this is ' + (location.host || 'an unknown origin') +
        ', not the canonical ' + CANON + '. Run it there (or pass true to force, knowing why).');
      return { minted: 0, refused: true };
    }
    const events = getEvents();
    let minted = 0;
    events.forEach(ev => {
      if (ev.rid) return;
      ev.rid = mintRid();
      ev.ridLineage = 'backfilled ' + new Date().toISOString() + ' on ' +
        (typeof location !== 'undefined' ? location.host : 'unknown');
      console.log('PrismDB.backfillRids: ' + ev.id + ' “' + (ev.title || 'untitled') + '” → ' + ev.rid);
      minted++;
    });
    if (minted) _set(KEYS.events, events);
    return { minted: minted };
  }

  function clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    console.log('PrismDB cleared (including arcs, members, positions, desk runs).');
  }

  // ── Seed ────────────────────────────────────────────────
  // The LIVE TIER, bundled (2026-09-21). data/readings_seed.js — generated by
  // scripts/bake-seed.js from data/readings/*.json — publishes
  // window.PRISM_SEED_READINGS = [{ rid, sha, reading }]. A fresh device's
  // first paint is the ruled floor and nothing else; the sync pull then only
  // refetches a file whose sha has moved. The six pre-formula case studies
  // that lived here (Para·01–06, 2026-02) are retired — see git history and
  // the 2026-09-21 handoff; their live successors are in the tier.
  const SEED_VERSION = 2;
  function seedReadings() {
    try { return (typeof window !== 'undefined' && Array.isArray(window.PRISM_SEED_READINGS)) ? window.PRISM_SEED_READINGS : []; }
    catch (e) { return []; }
  }
  // The landing Reading on a fresh device: the delivered-object demo (the
  // Ban) when it is in the tier, else the newest by updatedAt.
  const SEED_LANDING_RID = 'rdg_mu7ban350hom';

  // Seed migration v2 (2026-09-21): returning devices still carry the six
  // pre-formula case studies the old seed baked in (no rid — every later
  // event has one). Retire them once, on whichever entry loads first — the
  // portal and the desk share this store. Idempotent; safe on a fresh store.
  function migrate() {
    try {
      if (parseInt(localStorage.getItem('prism.seed.version') || '0', 10) >= SEED_VERSION) return 0;
      const events = getEvents();
      if (!events.length) return 0;                       // nothing stored yet — seed() will stamp the version
      const keep = events.filter(e => e.rid);
      const dropped = events.length - keep.length;
      if (!keep.some(e => e.active) && keep.length) {
        const landing = keep.find(e => e.rid === SEED_LANDING_RID) || keep[0];
        keep.forEach(e => e.active = (e === landing));
      }
      _set(KEYS.events, keep);
      localStorage.setItem('prism.seed.version', String(SEED_VERSION));
      if (dropped) console.log('PrismDB: seed migration v2 retired ' + dropped + ' pre-formula seed event(s)');
      return dropped;
    } catch (e) { console.warn('PrismDB: seed migration failed:', e && e.message); return 0; }
  }

  function seed() {
    migrate();
    if (_get(KEYS.events)) {
      console.log('PrismDB: events already exist, skipping seed.');
      return false;
    }

    const bundle = seedReadings();
    const events = [];
    const shas = {};
    bundle.forEach((entry, i) => {
      const r = JSON.parse(JSON.stringify(entry.reading));   // never mutate the bundle
      const bills = Array.isArray(r.billReadings) ? r.billReadings : null;
      if ('billReadings' in r) delete r.billReadings;         // bills live in the store, not on the event
      r.id = 'evt_' + String(i + 1).padStart(3, '0');
      r.rid = entry.rid;
      r.active = false;
      r.syncedAt = r.syncedAt || r.publishedAt || r.updatedAt || new Date().toISOString();  // seeded = published
      r.seededFrom = 'readings_seed';
      events.push(r);
      if (entry.sha) shas[entry.rid] = entry.sha;
      if (bills) r._seedBills = bills;
    });
    let landing = events.find(e => e.rid === SEED_LANDING_RID);
    if (!landing) landing = events.slice().sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))[0];
    if (landing) landing.active = true;

    _set(KEYS.events, events);
    // Bill readings ride in the same way the pull carries them.
    events.forEach(e => {
      if (e._seedBills) { try { importBillReadings(e.id, e._seedBills); } catch (err) {} delete e._seedBills; }
    });
    _set(KEYS.events, events);
    // Pre-fill the sync sha cache so the first pull skips files it already has.
    try {
      const cur = JSON.parse(localStorage.getItem('prism.sync.shas') || '{}') || {};
      localStorage.setItem('prism.sync.shas', JSON.stringify({ ...cur, ...shas }));
    } catch (e) {}
    try { localStorage.setItem('prism.seed.version', String(SEED_VERSION)); } catch (e) {}

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
    _set(KEYS.state, { currentEventId: landing ? landing.id : null, lastCompletedEventId: null, eventsCompleted: 0 });

    console.log('PrismDB seeded from the live tier: ' + events.length + ' Reading(s), ' + mockResponses.length + ' mock responses.');
    return true;
  }

  // ── Burns: the object register + frame states (Burns Spec v2 §2) ──
  // The register is the newsroom's file (data/newsroom/objects.json), pulled
  // like a Reading. A frame's state is read off the object + this device's
  // ledger; precedence flared > burnt > dark > exposed > lit (the rarest,
  // most editorial fact wins — Claude's call, logged in the spec).
  function setRegister(reg) { _set(KEYS.register, reg || null); }
  function getRegister() { return _get(KEYS.register) || null; }
  function frameStates() {
    const reg = getRegister();
    if (!reg || !Array.isArray(reg.objects)) return [];
    const ledger = _get(KEYS.ticker) || [];
    const burntRids = new Set(ledger.map(t => t.rid).filter(Boolean));
    const events = getEvents();
    return reg.objects.filter(o => o.status !== 'dismissed').map(o => {
      const rid = o.live || (o.drafts && (o.drafts.sailor || o.drafts.claude)) || null;
      const ev = rid ? events.find(e => e.rid === rid) : null;
      const broken = (o.permanence && o.permanence.breaks && o.permanence.breaks.length) ? o.permanence.breaks[o.permanence.breaks.length - 1] : null;
      const returned = (o.permanence && o.permanence.returns && o.permanence.returns.length) ? o.permanence.returns[o.permanence.returns.length - 1] : null;
      const dark = !!(broken && !(returned && returned.on > broken.on));
      const scarred = !!(broken && !dark);
      let state = 'lit';
      if (rid) state = 'exposed';
      if (dark) state = 'dark';
      if (rid && burntRids.has(rid)) state = 'burnt';
      if (o.inversions && o.inversions.length) state = 'flared';
      return { oid: o.oid, rid, eventId: ev ? ev.id : null, headline: o.headline || '', kind: o.kind, holder: o.holder, formedOn: o.formedOn, state, scarred, lastSeen: o.lastSeen, articles: o.articles || [] };
    }).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
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
    getEvents, getEvent, getActiveEvent, migrate,
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
    getDesks, getDesk, saveDesk, deleteDesk, importDeskRecord,
    backfillRids,
    getState, setState,
    getUser, setUser,
    getFollowed, isFollowing, follow, unfollow, toggleFollow,
    getDelegation, setDelegation,
    setRegister, getRegister, frameStates,
    clear, seed
  };
})();
// The seed migration runs on load from every entry (the desk never calls
// seed(); the store is shared). Idempotent after the first pass.
try { PrismDB.migrate(); } catch (e) {}

// Dev utility: run PrismDB.seed() in console to load example events
// Auto-seed is disabled — use admin.html to create real events
