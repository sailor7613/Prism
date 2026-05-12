// ============================================================
// PRISMDB EXTENSION — Members & Member Positions
// Merge into prismdb.js inside the IIFE, before the return block
// ============================================================

// Add to KEYS:
//   members:    'prism_members',
//   memberPos:  'prism_member_positions',

// ── Members ─────────────────────────────────────────────────
// Schema:
// {
//   bioguideId: 'O000172',       // Primary key
//   name: { first, last, full },
//   party: 'D' | 'R' | 'I',
//   chamber: 'house' | 'senate',
//   state: 'NY',
//   district: 14 | null,         // null for senators
//   inOffice: true,
//   terms: [{ congress, chamber, startYear, endYear }],
//   nominateD1: -0.523,          // DW-NOMINATE dim1 (nullable)
//   nominateD2: 0.112,           // DW-NOMINATE dim2 (nullable)
//   photoUrl: '...',
//   lastUpdated: '...'
// }

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

// Bulk load from fetch_members.js output
function loadMembers(membersArray) {
  if (!Array.isArray(membersArray)) {
    console.error('PrismDB.loadMembers: expected array');
    return false;
  }
  _set(KEYS.members, membersArray);
  console.log(`PrismDB: loaded ${membersArray.length} members.`);
  return true;
}

// Update a single member (e.g. after merging NOMINATE scores)
function updateMember(bioguideId, data) {
  const members = getMembers();
  const idx = members.findIndex(m => m.bioguideId === bioguideId);
  if (idx === -1) return null;
  members[idx] = { ...members[idx], ...data, bioguideId }; // preserve key
  _set(KEYS.members, members);
  return members[idx];
}

// Search by name (case-insensitive partial match)
function searchMembers(query) {
  const q = query.toLowerCase();
  return getMembers().filter(m =>
    m.name.full.toLowerCase().includes(q) ||
    m.state.toLowerCase() === q ||
    m.bioguideId.toLowerCase() === q
  );
}


// ── Member Event Positions ──────────────────────────────────
// Same ontological structure as Derive output — because it IS
// the same engine. A member's position on a Prism event is
// scored the same way an article or user response is scored.
//
// Schema:
// {
//   id: 'mpos_O000172_evt_001',
//   bioguideId: 'O000172',
//   eventId: 'evt_001',
//   quadrant: 'C',               // which quadrant they land in
//   x: -0.72,                    // position on event's X axis (-1 to 1)
//   y: 0.45,                     // position on event's Y axis (-1 to 1)
//   pin: { x: 0.14, y: 0.275 }, // normalized 0-1 coords (same as user pins)
//   z: 0.30,                     // Z displacement (same as Object Z / Subject Z)
//   diatribe: 45,                // Diatribe composite score (0-100)
//   diatribeBand: 'coalition',   // nominal | coalition | conviction
//   confidence: 0.8,             // scoring confidence (0-1)
//   method: 'derive',            // 'derive' | 'vote_record' | 'admin_placed' | 'hybrid'
//   provenance: 'DERIVED',       // DERIVED | MANUAL — same tags as Derive pipeline
//   sources: {
//     votes: [],                 // vote IDs that informed position
//     statements: [],            // statement refs
//     legislation: []            // bill IDs (sponsored/cosponsored)
//   },
//   keywords: {                  // Derive output: per-quadrant keyword weights
//     A: [], B: [], C: [], D: []
//   },
//   adminOverride: false,
//   timestamp: '...'
// }

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
  pos.id = pos.id || `mpos_${pos.bioguideId}_${pos.eventId}`;
  pos.timestamp = pos.timestamp || new Date().toISOString();

  // Derive quadrant from x/y if not set
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
  // Upsert by id
  const idx = all.findIndex(p => p.id === pos.id);
  if (idx !== -1) {
    all[idx] = pos;
  } else {
    all.push(pos);
  }
  _set(KEYS.memberPos, all);
  return pos;
}

// Bulk save (e.g. after running Derive on all members for an event)
function saveMemberPositions(positions) {
  const all = getMemberPositions();
  const idMap = new Map(all.map((p, i) => [p.id, i]));

  positions.forEach(pos => {
    pos.id = pos.id || `mpos_${pos.bioguideId}_${pos.eventId}`;
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
  console.log(`PrismDB: saved ${positions.length} member positions.`);
  return positions;
}

function deleteMemberPosition(bioguideId, eventId) {
  const id = `mpos_${bioguideId}_${eventId}`;
  const all = getMemberPositions().filter(p => p.id !== id);
  _set(KEYS.memberPos, all);
  return true;
}

// ── Aggregate helpers ───────────────────────────────────────
// Get member pins in the same shape as user aggregate pins
// so the graphmap can render them alongside user data
function getMemberAggregateForEvent(eventId) {
  return getMemberPositionsForEvent(eventId).map(p => {
    const member = getMember(p.bioguideId);
    return {
      x: p.pin?.x ?? 0.5,
      y: p.pin?.y ?? 0.5,
      quadrant: p.quadrant,
      intensity: p.diatribe || 50,
      z: p.z || 0,
      type: 'member',          // distinguishes from user pins
      bioguideId: p.bioguideId,
      name: member?.name?.full || p.bioguideId,
      party: member?.party || '?',
      chamber: member?.chamber || '',
      method: p.method,
      confidence: p.confidence
    };
  });
}

// ── Add to return block ─────────────────────────────────────
// getMembers, getMember, getMembersByState, getMembersByChamber,
// getMembersByParty, loadMembers, updateMember, searchMembers,
// getMemberPositions, getMemberPositionsForEvent,
// getMemberPositionHistory, getMemberPosition,
// saveMemberPosition, saveMemberPositions, deleteMemberPosition,
// getMemberAggregateForEvent,
