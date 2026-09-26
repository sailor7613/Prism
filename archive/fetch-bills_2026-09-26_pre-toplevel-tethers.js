/**
 * fetch-bills.js — Legislation data bootstrap for Prism
 * 
 * Fetches notable bills from BOTH the 119th Congress (2025-2026) and the
 * 118th Congress (2023-2024) via the Congress.gov API.
 *
 * "Notable" = passed at least one chamber, reported by committee,
 * became public law, or received a floor vote.
 *
 * 2026-07-03: the 118th filter widened from enacted-only to the full
 * notable set. Enacted-only made the corpus survivor-biased — bills that
 * moved and then DIED with the 118th (the frustrated field, the votes
 * against, half the dialectic) simply didn't exist on disk, and the
 * inspector's realized/frustrated Z had nothing to place on its negative
 * rungs. Notable-but-dead 118th bills are the honest denominator.
 *
 * 2026-07-04: survivorship bias round 2 fixed. Both the notable filter
 * and deriveStatus read only latestAction.text — but a bill that passed a
 * chamber and then died in the other's committee ends on "Received in
 * the Senate...", and a vetoed bill ends on the failed override. The
 * candidate net now includes implied-passage phrasings, and TRUE status
 * derives from the full /actions history per bill (primary path), with
 * per-milestone dates persisted for the future record-derived z.
 *

 * Imports the shared congress-client.js for pagination/rate-limiting.
 * Output: prism_legislation.json + legislation_data.js
 * 
 * Usage (called by run-all.js, or standalone):
 *   CONGRESS_API_KEY=<key> node fetch-bills.js
 */

const { fetchAll, fetchOne: rawFetchOne } = require('./congress-client.js');
const ceremonial = require('./ceremonial-classifier.js');
const config = require('./config.js');
const fs = require('fs');
const path = require('path');

// ── congress-client.js interface ─────────────────────────────────────
// This module expects congress-client.js to export:
//   fetchAllPages(endpoint, dataKey) → Promise<Array>
//     Paginates through all results at the endpoint.
//     dataKey is the JSON response key containing the array (e.g. 'bills').
//   fetchOne(endpoint, dataKey) → Promise<Object>
//     Single fetch, returns the object under dataKey.
//
// If your congress-client.js exports different names, adjust below:
const fetchAllPages = fetchAll;
const fetchOne = async (endpoint, dataKey) => {
  const data = await rawFetchOne(endpoint);
  return dataKey ? (data[dataKey] || data) : data;
};

// ── Bill types to fetch ──────────────────────────────────────────────
// hr = House bill, s = Senate bill, hjres/sjres = joint resolutions (can become law)
// Skip hres/sres/hconres/sconres — those are internal resolutions, can't become law
const BILL_TYPES = ['hr', 's', 'hjres', 'sjres'];

// ── Notable action keywords ──────────────────────────────────────────
// Bills whose latestAction.text contains any of these are considered notable.
// We check case-insensitively.
const NOTABLE_ACTION_KEYWORDS = [
  'became public law',
  'signed by the president',        // variant phrasing
  'passed house',
  'passed senate',
  'passed/agreed to in house',      // Congress.gov phrasing variant
  'passed/agreed to in senate',
  'reported by',                     // committee reported
  'ordered to be reported',          // committee vote to advance
  'cloture',                         // Senate cloture vote
  'motion to proceed',               // Senate floor action
  'resolving differences',           // conference committee
  'conference report',
  'presented to president',
  'vetoed',
  // ── 2026-07-04 widening: actions that IMPLY prior passage ──────────
  // Survivorship bias round 2: a bill that passed one chamber and then
  // died in the other's committee has latestAction "Received in the
  // Senate / referred to..." — no direct keyword above matched, so the
  // deepest frustrated rungs (passed-chamber, passed-both, vetoed) were
  // structurally empty. A vetoed bill's last action is usually the FAILED
  // OVERRIDE, not "vetoed". These keywords are the CANDIDATE NET only;
  // true status now derives from the full /actions history during
  // enrichment (deriveStatusFromActions) — status as a function of the
  // record, not a string match on its last line.
  'received in the senate',          // → the bill passed the House
  'received in the house',           // → the bill passed the Senate
  'held at the desk',                // chamber-receipt variant
  'placed on senate legislative calendar', // reported (S) / crossed over (HR)
  'over the objections of the president',  // failed veto override (long form)
  'over veto',                       // Senate's ACTUAL phrasing (probe, 2026-07-04)
  'veto message',
  'pocket veto',
];
// NOTE (2026-07-04 probe finding): House-override vetoes end on a GENERIC
// action ("Motion to reconsider laid on the table") — invisible to ANY
// last-line keyword. Since vetoed bills are almost all joint resolutions
// (CRA disapprovals), hjres/sjres skip this net entirely: all are enriched
// and classified from their /actions history, then filtered by derived
// status. The keyword net remains for hr/s only, where ~16k bills/congress
// make full enrichment unaffordable — an economic guard, documented here.

// 118th Congress: same notable filter as the 119th (2026-07-03 — was
// enacted-only, which erased the frustrated field; see header note).
// ENACTED_KEYWORDS kept for reference / possible fast-path runs.
const ENACTED_KEYWORDS = [
  'became public law',
  'signed by the president',
];

// ── Topic mapping ────────────────────────────────────────────────────
// Maps LOC policy area terms to Prism-friendly topic labels.
// Bills without a mapped topic get their raw LOC policyArea.
const TOPIC_MAP = {
  'Armed Forces and National Security': 'Defense',
  'International Affairs': 'Foreign Policy',
  'Immigration': 'Immigration',
  'Health': 'Healthcare',
  'Energy': 'Energy',
  'Environmental Protection': 'Climate & Energy',
  'Science, Technology, Communications': 'Technology',
  'Economics and Public Finance': 'Economy',
  'Taxation': 'Tax Policy',
  'Education': 'Education',
  'Crime and Law Enforcement': 'Criminal Justice',
  'Government Operations and Politics': 'Government',
  'Commerce': 'Commerce',
  'Transportation and Public Works': 'Infrastructure',
  'Social Welfare': 'Social Policy',
  'Labor and Employment': 'Labor',
  'Finance and Financial Sector': 'Financial Regulation',
  'Housing and Community Development': 'Housing',
  'Agriculture and Food': 'Agriculture',
  'Public Lands and Natural Resources': 'Public Lands',
  'Civil Rights and Liberties, Minority Issues': 'Civil Rights',
  'Foreign Trade and International Finance': 'Trade',
  'Native Americans': 'Native Americans',
  'Water Resources Development': 'Water',
  'Emergency Management': 'Emergency Management',
  'Families': 'Social Policy',
  'Sports and Recreation': 'Other',
  'Animals': 'Other',
  'Arts, Culture, Religion': 'Other',
  'Congress': 'Government',
  'Law': 'Law',
};

// ── Status derivation from latestAction text (FALLBACK path) ─────────
// Primary derivation is deriveStatusFromActions (full history). This
// text-match path remains for bills whose /actions fetch fails, extended
// 2026-07-04 with the implied-passage phrasings (billType disambiguates).
function deriveStatus(latestActionText, billType) {
  if (!latestActionText) return 'introduced';
  const t = latestActionText.toLowerCase();
  const houseOrigin = billType ? billType.startsWith('h') : true;
  if (t.includes('became public law') || t.includes('signed by the president')) return 'enacted';
  if (t.includes('veto') || t.includes('over the objections of the president')) return 'vetoed';
  if (t.includes('presented to president')) return 'presented_to_president';
  if (t.includes('resolving differences') || t.includes('conference report')) return 'conference';
  if (t.includes('passed house') || t.includes('passed/agreed to in house')) {
    if (t.includes('passed senate') || t.includes('passed/agreed to in senate')) return 'passed_both';
    return 'passed_house';
  }
  if (t.includes('passed senate') || t.includes('passed/agreed to in senate')) return 'passed_senate';
  // Implied passage: receipt by the OTHER chamber means this one passed it
  if (t.includes('received in the senate')) return 'passed_house';
  if (t.includes('received in the house')) return 'passed_senate';
  if (t.includes('held at the desk')) return houseOrigin ? 'passed_house' : 'passed_senate';
  if (t.includes('placed on senate legislative calendar')) return houseOrigin ? 'passed_house' : 'reported';
  if (t.includes('reported by') || t.includes('ordered to be reported')) return 'reported';
  if (t.includes('cloture') || t.includes('motion to proceed')) return 'floor_action';
  return 'committee';
}

// ── Status derivation from the FULL action history (primary path) ────
// 2026-07-04: status = max milestone across every recorded action, not a
// string match on the last one. Also emits per-milestone dates + the raw
// action count — record functions for the future record-derived z
// (heuristics handoff §3 #4).
const STATUS_RANK = {
  introduced: 0, committee: 1, reported: 2, floor_action: 3,
  passed_house: 4, passed_senate: 4, passed_both: 5, conference: 6,
  presented_to_president: 7, vetoed: 8, enacted: 9,
};

function deriveStatusFromActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  let best = 'introduced';
  let passedHouseDate = null;
  let passedSenateDate = null;
  const milestones = {};
  const consider = (status, date) => {
    if (!(status in milestones)) milestones[status] = date || null;
    if ((STATUS_RANK[status] ?? 0) > (STATUS_RANK[best] ?? 0)) best = status;
  };
  for (const a of actions) {
    const t = (a.text || '').toLowerCase();
    const d = a.actionDate || null;
    if (t.includes('became public law') || t.includes('signed by the president')) consider('enacted', d);
    else if (t.includes('veto') || t.includes('over the objections of the president')) consider('vetoed', d);
    else if (t.includes('presented to president')) consider('presented_to_president', d);
    else if (t.includes('resolving differences') || t.includes('conference report')) consider('conference', d);
    else if (t.includes('passed house') || t.includes('passed/agreed to in house')) {
      passedHouseDate = passedHouseDate || d;
      consider('passed_house', d);
    }
    else if (t.includes('passed senate') || t.includes('passed/agreed to in senate')) {
      passedSenateDate = passedSenateDate || d;
      consider('passed_senate', d);
    }
    else if (t.includes('cloture') || t.includes('motion to proceed')) consider('floor_action', d);
    else if (t.includes('reported by') || t.includes('ordered to be reported')) consider('reported', d);
  }
  if (passedHouseDate && passedSenateDate) {
    consider('passed_both', [passedHouseDate, passedSenateDate].sort()[1]);
  }
  if (best === 'introduced') return null;  // nothing recognized → caller falls back
  return { status: best, milestones, actionCount: actions.length };
}

// ── Bill type display labels ─────────────────────────────────────────
const TYPE_LABELS = {
  hr: 'H.R.',
  s: 'S.',
  hjres: 'H.J.Res.',
  sjres: 'S.J.Res.',
};

// ── Status display labels ────────────────────────────────────────────
const STATUS_LABELS = {
  enacted: 'Enacted',
  vetoed: 'Vetoed',
  presented_to_president: 'To President',
  conference: 'Conference',
  passed_both: 'Passed Both',
  passed_house: 'Passed House',
  passed_senate: 'Passed Senate',
  reported: 'Reported',
  floor_action: 'Floor Action',
  committee: 'Committee',
  introduced: 'Introduced',
};

// ── Fetch bills for one congress + one bill type ─────────────────────
async function fetchBillList(congress, billType) {
  const endpoint = `/bill/${congress}/${billType}`;
  console.log(`  Fetching ${endpoint}...`);
  const bills = await fetchAllPages(endpoint, 'bills');
  console.log(`    → ${bills.length} ${billType.toUpperCase()} bills`);
  return bills;
}

// ── Filter bills by notable action keywords ──────────────────────────
function filterNotable(bills, keywords) {
  return bills.filter(bill => {
    const actionText = bill.latestAction?.text || '';
    const lower = actionText.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  });
}

// ── Fetch bill detail (sponsor, policyArea, etc.) ────────────────────
async function fetchBillDetail(congress, billType, billNumber) {
  const endpoint = `/bill/${congress}/${billType}/${billNumber}`;
  return fetchOne(endpoint, 'bill');
}

// ── Fetch bill subjects ──────────────────────────────────────────────
async function fetchBillSubjects(congress, billType, billNumber) {
  const endpoint = `/bill/${congress}/${billType}/${billNumber}/subjects`;
  return fetchOne(endpoint, 'subjects');
}

// ── Fetch full action history (paginated) ────────────────────────────
async function fetchBillActions(congress, billType, billNumber) {
  const endpoint = `/bill/${congress}/${billType}/${billNumber}/actions`;
  return fetchAllPages(endpoint, 'actions');
}

// ── Enrich one bill: detail + subjects + actions → Prism record ──────
// Extracted 2026-07-06 from the fetchBills() enrichment loop so the
// terrain fetch shares one enrichment lineage with the notable pipeline —
// identical record shape, one code path. `listBill` is the raw list item
// (may be a bare { number } stub in terrain mode; detail fills the gaps).
async function enrichBillRecord(listBill, congress, billType, billNumber) {
  // Fetch detail
  let detail = null;
  try {
    detail = await fetchBillDetail(congress, billType, billNumber);
  } catch (err) {
    console.warn(`    ⚠ Detail fetch failed for ${billType}${billNumber}-${congress}: ${err.message}`);
  }

  // Fetch subjects
  let subjects = null;
  try {
    subjects = await fetchBillSubjects(congress, billType, billNumber);
  } catch (err) {
    // Subjects endpoint can 404 for some bills — that's fine
  }

  // Fetch full action history — status derives from the record (2026-07-04)
  let actionsDerived = null;
  try {
    const actions = await fetchBillActions(congress, billType, billNumber);
    actionsDerived = deriveStatusFromActions(actions);
  } catch (err) {
    console.warn(`    ⚠ Actions fetch failed for ${billType}${billNumber}-${congress} — falling back to latestAction text`);
  }

  // Parse sponsor from detail
  let sponsor = null;
  if (detail?.sponsors && detail.sponsors.length > 0) {
    const s = detail.sponsors[0];
    sponsor = {
      bioguideId: s.bioguideId || null,
      name: s.fullName || s.firstName + ' ' + s.lastName || 'Unknown',
      party: s.party || null,
      state: s.state || null,
    };
  }

  // Parse policy area + subjects
  const policyArea = detail?.policyArea?.name || null;
  const topic = policyArea ? (TOPIC_MAP[policyArea] || policyArea) : null;

  const subjectTerms = [];
  if (subjects?.legislativeSubjects) {
    const items = subjects.legislativeSubjects;
    // Can be array of items or nested
    if (Array.isArray(items)) {
      items.forEach(item => {
        if (item.name) subjectTerms.push(item.name);
      });
    }
  }

  // Title handling — prefer short title, fall back to official
  const title = detail?.title || listBill.title || 'Untitled';
  const shortTitle = detail?.shortTitle || null;

  // Cosponsor count
  const cosponsors = detail?.cosponsors?.count ?? null;

  // latestAction: the list item carries it in pipeline mode; the terrain
  // path passes a stub, so the detail response is the fallback source.
  const latest = listBill.latestAction || detail?.latestAction || null;

  // Build the Prism legislation record.
  // Status: actions-history derivation is primary; latestAction text is
  // the fallback. statusMethod records which path produced it (lineage).
  const status = actionsDerived?.status || deriveStatus(latest?.text, billType);
  const statusMethod = actionsDerived?.status ? 'actions_history' : 'latest_action_text';
  return {
    billId: `${billType}-${congress}-${billNumber}`,
    congress,
    type: billType,
    number: billNumber,
    title: shortTitle || title,
    titleFull: title,
    sponsor,
    cosponsors,
    policyArea,
    topic,
    subjects: subjectTerms.slice(0, 20),  // Cap at 20 to keep size reasonable
    status,
    statusLabel: STATUS_LABELS[status] || status,
    statusMethod,                                  // 'actions_history' | 'latest_action_text'
    milestones: actionsDerived?.milestones || null, // per-milestone dates — record fn for future record-z
    actionCount: actionsDerived?.actionCount ?? null,
    latestAction: {
      date: latest?.actionDate || null,
      text: latest?.text || null,
    },
    originChamber: detail?.originChamber || (billType.startsWith('h') ? 'House' : 'Senate'),
    introducedDate: detail?.introducedDate || null,
    congressGovUrl: `https://www.congress.gov/bill/${congress}th-congress/${typeToUrlSlug(billType)}/${billNumber}`,
    relatedEventIds: [],   // Populated by admin — maps bills to Prism events
    lastUpdated: new Date().toISOString(),
  };
}

// ── Main fetch orchestrator ──────────────────────────────────────────
async function fetchBills() {
  console.log('\n═══ LEGISLATION BOOTSTRAP ═══\n');
  
  const allNotable = [];
  
  // Joint resolutions bypass the keyword net (see NOTABLE_ACTION_KEYWORDS
  // note): all are enriched, classified from /actions history, and
  // filtered by derived status afterward. hr/s keep the net (volume).
  const ENRICH_ALL_TYPES = new Set(['hjres', 'sjres']);

  // ── 119th Congress: all notable bills ──
  console.log('── 119th Congress (notable bills) ──');
  for (const type of BILL_TYPES) {
    const bills = await fetchBillList(119, type);
    const candidates = ENRICH_ALL_TYPES.has(type)
      ? bills
      : filterNotable(bills, NOTABLE_ACTION_KEYWORDS);
    console.log(`    → ${candidates.length} candidates${ENRICH_ALL_TYPES.has(type) ? ' (all — jres bypass)' : ' (keyword net)'}`);
    candidates.forEach(b => allNotable.push({ ...b, _congress: 119, _type: type }));
  }

  // ── 118th Congress: full notable set — enacted AND died-in-motion ──
  // (the frustrated field; was enacted-only until 2026-07-03)
  console.log('\n── 118th Congress (notable bills — incl. died-in-motion) ──');
  for (const type of BILL_TYPES) {
    const bills = await fetchBillList(118, type);
    const candidates = ENRICH_ALL_TYPES.has(type)
      ? bills
      : filterNotable(bills, NOTABLE_ACTION_KEYWORDS);
    console.log(`    → ${candidates.length} candidates${ENRICH_ALL_TYPES.has(type) ? ' (all — jres bypass)' : ' (keyword net)'}`);
    candidates.forEach(b => allNotable.push({ ...b, _congress: 118, _type: type }));
  }
  
  console.log(`\n── Total notable bills to enrich: ${allNotable.length} ──\n`);
  
  // ── Enrich each bill with detail + subjects ──
  const enriched = [];
  let enrichCount = 0;
  
  // (Summaries note, carried from the old inline loop: the detail level
  // has a summaries URL, but that's another fetch per bill — skipped to
  // keep the pipeline fast. Possible follow-up enrichment pass.)
  for (const bill of allNotable) {
    enrichCount++;
    if (enrichCount % 25 === 0 || enrichCount === 1) {
      console.log(`  Enriching ${enrichCount}/${allNotable.length}...`);
    }
    enriched.push(await enrichBillRecord(bill, bill._congress, bill._type, bill.number));
  }
  
  // ── Sort: enacted first, then by status weight, then by latest action date ──
  const STATUS_WEIGHT = {
    enacted: 0,
    vetoed: 1,
    presented_to_president: 2,
    conference: 3,
    passed_both: 4,
    passed_house: 5,
    passed_senate: 5,
    reported: 6,
    floor_action: 6,
    committee: 7,
    introduced: 8,
  };
  
  enriched.sort((a, b) => {
    const wa = STATUS_WEIGHT[a.status] ?? 9;
    const wb = STATUS_WEIGHT[b.status] ?? 9;
    if (wa !== wb) return wa - wb;
    // Within same status, newest action first
    return (b.latestAction?.date || '').localeCompare(a.latestAction?.date || '');
  });
  
  // ── Dedup (in case a bill appears in both 118th enacted and 119th notable) ──
  const seen = new Set();
  const deduped = enriched.filter(bill => {
    if (seen.has(bill.billId)) return false;
    seen.add(bill.billId);
    return true;
  });

  // ── Notable filter, applied to DERIVED status (2026-07-04) ──
  // The jres bypass enriches everything; here the "notable" threshold is
  // enforced on what the record says the bill reached (≥ reported), not
  // on last-line phrasing. Applies uniformly — keyword-caught hr/s bills
  // that derive below reported drop too (net false-positives).
  const before = deduped.length;
  const notable = deduped.filter(b => (STATUS_RANK[b.status] ?? 0) >= STATUS_RANK.reported);
  console.log(`\n── Notable filter (derived status ≥ reported): ${before} → ${notable.length} (dropped ${before - notable.length}) ──`);

  console.log(`── Enrichment complete: ${notable.length} unique bills ──`);

  return notable;
}

// ── Convert bill type to Congress.gov URL slug ───────────────────────
function typeToUrlSlug(type) {
  const map = {
    hr: 'house-bill',
    s: 'senate-bill',
    hjres: 'house-joint-resolution',
    sjres: 'senate-joint-resolution',
  };
  return map[type] || type;
}

// ── Full record → compact catalog entry ──────────────────────────────
// One mapper for both the full-pipeline write and the terrain append, so
// the compact shape can't drift between paths. The compact/full key split
// (rc/mm vs rollCallCount/minMargin, cer vs ceremonial, tf vs provenance)
// is DELIBERATE — compact keys are size-paid per entry in a ~500KB file
// the browser parses on load; recorded 2026-07-06, see terrain handoff.
function compactEntry(bill) {
  const typeLabel = TYPE_LABELS[bill.type] || bill.type.toUpperCase();
  const num = `${typeLabel} ${bill.number}`;

  // Build meta string: "H.R. 1234 · Enacted · Defense" or "S. 567 · Passed Senate · Healthcare"
  const parts = [num];
  if (bill.status === 'enacted') {
    parts.push('Enacted');
  } else {
    parts.push(bill.statusLabel);
  }
  if (bill.topic) parts.push(bill.topic);

  const entry = {
    name: bill.title,
    meta: parts.join(' · '),
    id: bill.billId,
  };
  if (bill.ceremonial) entry.cer = 1;   // substance-lens fold flag (2026-07-05)
  if ((bill.provenance || '').startsWith('terrain_fetch')) entry.tf = 1;   // terrain-fetched arrival (2026-07-06)
  return entry;
}

// ── Generate legislation_data.js for onboarding UI ───────────────────
function generateLegislationDataJS(bills) {
  const entries = bills.map(compactEntry);
  
  const js = `// Auto-generated by fetch-bills.js — ${new Date().toISOString()}
// ${entries.length} notable bills from 118th–119th Congress
// Drop-in replacement for LEGISLATION_DATA in index.html

const LEGISLATION_DATA = ${JSON.stringify(entries, null, 2)};
`;
  return js;
}

// ── Stats summary ────────────────────────────────────────────────────
function generateStats(bills) {
  const byStatus = {};
  const byCongress = {};
  const byTopic = {};
  const byType = {};
  const byStatusMethod = {};
  const byProvenance = {};

  bills.forEach(b => {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    byCongress[b.congress] = (byCongress[b.congress] || 0) + 1;
    byTopic[b.topic || 'Unclassified'] = (byTopic[b.topic || 'Unclassified'] || 0) + 1;
    byType[b.type] = (byType[b.type] || 0) + 1;
    byStatusMethod[b.statusMethod || 'unknown'] = (byStatusMethod[b.statusMethod || 'unknown'] || 0) + 1;
    byProvenance[b.provenance || 'notable_pipeline'] = (byProvenance[b.provenance || 'notable_pipeline'] || 0) + 1;
  });

  return {
    total: bills.length,
    byStatus,
    byCongress,
    byTopic,
    byType,
    byStatusMethod,
    byProvenance,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Write outputs ────────────────────────────────────────────────────
async function writeBillOutputs(bills) {
  // config.OUTPUT_DIR → Prism/data/ (fixed 2026-07-02: was reading the
  // nonexistent config.outputDir and silently writing to scripts/output/)
  const outputDir = config.OUTPUT_DIR || path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Terrain carry-over (2026-07-06): fetchBills() rebuilds the NOTABLE
  // corpus only — bills that arrived via --terrain would silently vanish
  // on every full run without this. Records already re-caught by the
  // notable net drop their terrain provenance (they're notable now, which
  // is the honest description; terrain membership stays derivable from
  // policyArea). Roll-call stamps (rc/mm) are fetch-votes.js's to restore.
  const prevPath = path.join(outputDir, 'prism_legislation.json');
  if (fs.existsSync(prevPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
      const have = new Set(bills.map(b => b.billId));
      const carried = prev.filter(b => (b.provenance || '').startsWith('terrain_fetch') && !have.has(b.billId));
      if (carried.length) {
        bills.push(...carried);
        console.log(`  ✓ carried ${carried.length} terrain-fetched bills across the rebuild`);
      }
    } catch (e) {
      console.warn(`  ⚠ could not read previous catalog for terrain carry-over: ${e.message}`);
    }
  }

  // Ceremonial tag — record-tier, lineage-carrying pattern match
  // (scripts/ceremonial-classifier.js). Applied on every fetch so the
  // substance lens never depends on a manual retag. 2026-07-05.
  bills.forEach(b => ceremonial.apply(b));
  console.log(`  ✓ ceremonial tag: ${bills.filter(b => b.ceremonial).length} bills (${ceremonial.METHOD_ID})`);

  // Full dataset
  const fullPath = path.join(outputDir, 'prism_legislation.json');
  fs.writeFileSync(fullPath, JSON.stringify(bills, null, 2));
  console.log(`  ✓ ${fullPath} (${bills.length} bills)`);
  
  // Onboarding UI data
  const jsContent = generateLegislationDataJS(bills);
  const jsPath = path.join(outputDir, 'legislation_data.js');
  fs.writeFileSync(jsPath, jsContent);
  console.log(`  ✓ ${jsPath}`);
  
  // Stats
  const stats = generateStats(bills);
  const statsPath = path.join(outputDir, 'bill_fetch_stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`  ✓ ${statsPath}`);
  console.log(`\n── Bill Stats ──`);
  console.log(`  Total: ${stats.total}`);
  console.log(`  By congress:`, stats.byCongress);
  console.log(`  By status:`, stats.byStatus);
  console.log(`  By status method:`, stats.byStatusMethod);
  console.log(`  By type:`, stats.byType);
}

// ═══ TERRAIN FETCH (2026-07-06) ══════════════════════════════════════
// A Reading is sovereign over what it examines (CLAUDE.md standing
// decision, 2026-07-06): given a CRS policy area ("Immigration"), fetch
// EVERY bill in that terrain — roll calls or not, notable or not — and
// merge them into the catalog provenance-marked. The notable-action
// filter is deliberately absent here: a committee-dead bill arrives with
// a thin record, which is honest and sometimes IS the finding. The
// survey graph keeps excluding terrain-fetched bills (inspector-side);
// the catalog pane and curate see them.
//
// Membership is decided by the record's own taxonomy — Sailor names the
// terrain, the librarian-assigned policy area answers who's in it. The
// framing keywords never touch the fetch boundary (interpretive functions
// don't define record boundaries).
//
// The Congress.gov list endpoint carries no policyArea, so membership
// costs one detail call per un-indexed bill. data/policy_area_index.json
// is the persisted checkpoint that makes that a ONE-TIME cost: the first
// run pays ~15–20k detail calls (hours, rate-limited, resumable — safe to
// interrupt, it picks up where it left off); every later terrain, any
// policy area, reads the index and only re-fetches bills whose updateDate
// moved.

const TERRAIN_PROVENANCE = 'terrain_fetch_v1';   // versioned — same rule as pattern_match_v1 / margin_scaled_v1
const INDEX_VERSION = 'policy_area_index_v1';

function policyAreaIndexPath() {
  return path.join(config.OUTPUT_DIR, 'policy_area_index.json');
}

function loadPolicyAreaIndex() {
  try {
    const idx = JSON.parse(fs.readFileSync(policyAreaIndexPath(), 'utf8'));
    if (idx && idx.version === INDEX_VERSION && idx.bills) return idx;
    console.warn('  ⚠ policy_area_index.json has an unknown shape — rebuilding from scratch');
  } catch (e) { /* first run — no index yet */ }
  return { version: INDEX_VERSION, updatedAt: null, bills: {} };
}

function savePolicyAreaIndex(idx) {
  idx.updatedAt = new Date().toISOString();
  fs.writeFileSync(policyAreaIndexPath(), JSON.stringify(idx));  // compact on purpose — ~20k entries
}

// Index shape: bills["hr-119-3"] = { p: "Immigration"|null, u: "<updateDate>" }
async function buildPolicyAreaIndex(congress) {
  const idx = loadPolicyAreaIndex();
  const queue = [];
  console.log(`── Indexing policy areas · ${congress}th Congress ──`);
  for (const type of BILL_TYPES) {
    const bills = await fetchBillList(congress, type);
    for (const b of bills) {
      const id = `${type}-${congress}-${b.number}`;
      const u = b.updateDate || null;
      const known = idx.bills[id];
      if (known && known.u === u) continue;               // unchanged since last index
      if (b.policyArea && 'name' in b.policyArea) {       // free ride if the API ever adds it to list items
        idx.bills[id] = { p: b.policyArea.name || null, u };
        continue;
      }
      queue.push({ id, type, number: b.number, u });
    }
  }
  console.log(`\n  Index: ${Object.keys(idx.bills).length} bills already indexed · ${queue.length} need a detail call`);
  if (queue.length) {
    const CHECKPOINT_EVERY = 200;
    const t0 = Date.now();
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      try {
        const detail = await fetchBillDetail(congress, q.type, q.number);
        idx.bills[q.id] = { p: detail?.policyArea?.name || null, u: q.u };
      } catch (err) {
        // not stored → retried automatically on the next run
        console.warn(`    ⚠ detail failed for ${q.id} — will retry next run (${err.message})`);
      }
      if ((i + 1) % CHECKPOINT_EVERY === 0 || i === queue.length - 1) {
        savePolicyAreaIndex(idx);
        const perMin = (i + 1) / ((Date.now() - t0) / 60000);
        const etaMin = Math.round((queue.length - i - 1) / Math.max(0.1, perMin));
        console.log(`  indexed ${i + 1}/${queue.length} · ~${etaMin} min remaining · checkpoint saved`);
      }
    }
  }
  savePolicyAreaIndex(idx);
  return idx;
}

// ── Surgical merge into the two catalog files ─────────────────────────
// Append, never regenerate: existing compact entries carry rc/mm stamps
// from fetch-votes.js (and cer flags) that a regeneration would erase.
function appendToCatalogFiles(catalog, newRecords) {
  const outputDir = config.OUTPUT_DIR;

  // Full catalog
  const fullPath = path.join(outputDir, 'prism_legislation.json');
  const merged = catalog.concat(newRecords);
  fs.writeFileSync(fullPath, JSON.stringify(merged, null, 2));
  console.log(`  ✓ ${fullPath} (${merged.length} bills, +${newRecords.length})`);

  // Compact catalog — parse the existing global, append, rewrite verbatim
  const jsPath = path.join(outputDir, 'legislation_data.js');
  const src = fs.readFileSync(jsPath, 'utf8');
  const existing = new Function(`${src}\n;return LEGISLATION_DATA;`)();
  const additions = newRecords.map(compactEntry);
  const all = existing.concat(additions);
  const tfCount = all.filter(e => e.tf).length;
  const js = `// Auto-generated by fetch-bills.js — ${new Date().toISOString()}
// ${all.length} bills from 118th–119th Congress (${tfCount} terrain-fetched · tf:1)
// Drop-in replacement for LEGISLATION_DATA in index.html

const LEGISLATION_DATA = ${JSON.stringify(all, null, 2)};
`;
  fs.writeFileSync(jsPath, js);
  console.log(`  ✓ ${jsPath} (+${additions.length} entries, tf:1)`);

  // Stats — regenerated from the merged catalog so counts stay honest
  const stats = generateStats(merged);
  fs.writeFileSync(path.join(outputDir, 'bill_fetch_stats.json'), JSON.stringify(stats, null, 2));
  console.log('  ✓ bill_fetch_stats.json refreshed');
}

async function fetchTerrain(policyArea, congress) {
  console.log(`\n═══ TERRAIN FETCH — "${policyArea}" · ${congress}th Congress ═══`);
  console.log(`    provenance: ${TERRAIN_PROVENANCE} · notable-action filter: OFF (by design)\n`);

  const catalogPath = path.join(config.OUTPUT_DIR, 'prism_legislation.json');
  if (!fs.existsSync(catalogPath)) {
    console.error('✗ prism_legislation.json not found — run the notable pipeline (run-all.js) first.');
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const inCatalog = new Set(catalog.map(b => b.billId));

  const idx = await buildPolicyAreaIndex(congress);

  // Membership: the record's own taxonomy decides.
  const marker = `-${congress}-`;
  const memberIds = Object.keys(idx.bills)
    .filter(id => id.includes(marker) && idx.bills[id].p === policyArea);
  if (!memberIds.length) {
    const areas = [...new Set(Object.values(idx.bills).map(v => v.p).filter(Boolean))].sort();
    console.error(`✗ No ${congress}th bills carry policyArea "${policyArea}" (labels are exact).`);
    console.error(`  Known policy areas:\n    ${areas.join('\n    ')}`);
    process.exit(1);
  }
  const newIds = memberIds.filter(id => !inCatalog.has(id));
  console.log(`\n── Terrain "${policyArea}": ${memberIds.length} bills · ${memberIds.length - newIds.length} already in catalog · ${newIds.length} to enrich ──\n`);
  if (!newIds.length) {
    console.log('Nothing to add — the catalog already holds the whole terrain.');
    return;
  }

  const newRecords = [];
  let n = 0;
  for (const id of newIds) {
    n++;
    if (n % 25 === 0 || n === 1) console.log(`  Enriching ${n}/${newIds.length}...`);
    const [type, cg, number] = id.split('-');
    const record = await enrichBillRecord({ number }, parseInt(cg, 10), type, number);
    record.provenance = TERRAIN_PROVENANCE;   // how it arrived — membership itself lives on policyArea
    ceremonial.apply(record);                 // same record-tier tag as every other arrival
    newRecords.push(record);
  }

  appendToCatalogFiles(catalog, newRecords);
  const thin = newRecords.filter(r => (STATUS_RANK[r.status] ?? 0) < STATUS_RANK.reported).length;
  console.log(`\n✓ Terrain fetch complete: ${newRecords.length} bills joined the catalog, provenance-marked.`);
  console.log(`  ${thin} arrived with thin records (below "reported") — honest, and sometimes the finding.`);
  console.log('  Survey graph excludes them; catalog pane + curate see them. Hard-reload the browser (Cmd-Shift-R).');
}

// ═══ TETHER FETCH (2026-09-25) ══════════════════════════════════════
// An utterance Reading tethers its layers to bills by id (Event Classes v0,
// "Tethers"). A tethered bill the catalog doesn't hold yet is fetched here,
// one by one, through the same enrichment as every other arrival, and
// appended provenance-marked. Like terrain bills, no notable filter: a
// tether is an editorial pointer, and a thin record is honest.
const TETHER_PROVENANCE = 'tether_fetch_v1';
async function fetchByIds(ids) {
  console.log(`\n═══ TETHER FETCH — ${ids.join(', ')} ═══`);
  const catalogPath = path.join(config.OUTPUT_DIR, 'prism_legislation.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const inCatalog = new Set(catalog.map(b => b.billId));
  const newRecords = [];
  for (const id of ids) {
    if (inCatalog.has(id)) { console.log(`  · ${id} already in catalog`); continue; }
    const [type, cg, number] = id.split('-');
    if (!type || !cg || !number) { console.warn(`  ⚠ ${id}: expected <type>-<congress>-<number>, e.g. s-119-2937`); continue; }
    const record = await enrichBillRecord({ number }, parseInt(cg, 10), type, number);
    record.provenance = TETHER_PROVENANCE;
    ceremonial.apply(record);
    newRecords.push(record);
    console.log(`  ✓ ${id} · ${record.title || ''} · ${record.status || ''}`);
  }
  if (newRecords.length) appendToCatalogFiles(catalog, newRecords);
  else console.log('Nothing to add.');
}

// --tethers: collect every tethered billId across the Readings (live, drafts,
// Claude drafts), fetch the ones the catalog lacks, then mark them in the
// Readings: tether.inDb = true and the id joins linkedBills.
function readingFiles(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!/^(_retired|clips|images)$/.test(f.name)) out = out.concat(readingFiles(p)); }
    else if (f.name.endsWith('.json')) out.push(p);
  }
  return out;
}
async function fetchTethers() {
  const files = readingFiles(path.join(config.OUTPUT_DIR, 'readings'));
  const ids = new Set();
  const withTethers = [];
  for (const f of files) {
    let r; try { r = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    const layers = (r.utterance && r.utterance.layers) || [];
    const t = layers.flatMap(l => l.tethers || []).filter(x => x && x.billId);
    if (!t.length) continue;
    t.forEach(x => ids.add(String(x.billId).toLowerCase()));
    withTethers.push(f);
  }
  if (!ids.size) { console.log('No tethered bills in any Reading.'); return; }
  await fetchByIds([...ids]);
  const catalog = new Set(JSON.parse(fs.readFileSync(path.join(config.OUTPUT_DIR, 'prism_legislation.json'), 'utf8')).map(b => b.billId));
  for (const f of withTethers) {
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    let changed = false;
    r.linkedBills = Array.isArray(r.linkedBills) ? r.linkedBills : [];
    (r.utterance.layers || []).forEach(l => (l.tethers || []).forEach(t => {
      const id = t.billId && String(t.billId).toLowerCase();
      if (!id || !catalog.has(id)) return;
      if (!t.inDb) { t.inDb = true; changed = true; }
      if (!r.linkedBills.includes(id)) { r.linkedBills.push(id); changed = true; }
    }));
    if (changed) {
      if (r.meta && r.meta.linkedBillsOwed) delete r.meta.linkedBillsOwed;
      r.updatedAt = new Date().toISOString();
      fs.writeFileSync(f, JSON.stringify(r, null, 1));
      console.log(`  ✓ linked in ${path.basename(f)} (${r.title || ''})`);
    }
  }
}

// ── Export for run-all.js ────────────────────────────────────────────
module.exports = { fetchBills, writeBillOutputs, fetchTerrain, fetchByIds, fetchTethers };

// ── Standalone execution ─────────────────────────────────────────────
//   node fetch-bills.js                                → notable pipeline
//   node fetch-bills.js --terrain "Immigration"        → terrain fetch (119th)
//   node fetch-bills.js --terrain "Health" --congress 118
//   node fetch-bills.js --bills s-119-2937,hr-119-9917   → tether fetch (specific bills)
if (require.main === module) {
  const args = process.argv.slice(2);
  const ti = args.indexOf('--terrain');
  const bi = args.indexOf('--bills');
  if (args.includes('--tethers')) {
    fetchTethers().then(() => console.log('\n✓ Tethers fetched and linked.\n')).catch(err => { console.error('✗ Tether fetch failed:', err); process.exit(1); });
  } else if (bi !== -1) {
    const ids = String(args[bi + 1] || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!ids.length) { console.error('Usage: node fetch-bills.js --bills s-119-2937,hr-119-9917'); process.exit(1); }
    fetchByIds(ids).then(() => console.log('\n✓ Tether fetch done.\n')).catch(err => { console.error('✗ Tether fetch failed:', err); process.exit(1); });
  } else if (ti !== -1) {
    const area = args[ti + 1];
    if (!area || area.startsWith('--')) {
      console.error('Usage: node fetch-bills.js --terrain "Immigration" [--congress 119]');
      process.exit(1);
    }
    const ci = args.indexOf('--congress');
    const congress = ci !== -1 ? parseInt(args[ci + 1], 10) : config.CONGRESS_NUMBER;
    fetchTerrain(area, congress)
      .then(() => console.log('\n✓ Terrain fetch done.\n'))
      .catch(err => {
        console.error('✗ Terrain fetch failed:', err);
        console.error('  (Progress is checkpointed — rerun the same command to resume.)');
        process.exit(1);
      });
  } else {
    fetchBills()
      .then(bills => writeBillOutputs(bills))
      .then(() => console.log('\n✓ Bills fetch complete.\n'))
      .catch(err => {
        console.error('✗ Bills fetch failed:', err);
        process.exit(1);
      });
  }
}
