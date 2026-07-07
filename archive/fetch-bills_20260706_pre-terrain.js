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
  
  for (const bill of allNotable) {
    enrichCount++;
    const congress = bill._congress;
    const billType = bill._type;
    const billNumber = bill.number;
    
    if (enrichCount % 25 === 0 || enrichCount === 1) {
      console.log(`  Enriching ${enrichCount}/${allNotable.length}...`);
    }
    
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
    const title = detail?.title || bill.title || 'Untitled';
    const shortTitle = detail?.shortTitle || null;
    
    // Cosponsor count
    const cosponsors = detail?.cosponsors?.count ?? null;
    
    // Summary (from detail — first summary if present)
    // The detail level has a summaries URL, but we'd need another fetch.
    // For now, we skip summaries to keep the pipeline fast.
    // Can be added as a follow-up enrichment pass.
    
    // Build the Prism legislation record.
    // Status: actions-history derivation is primary; latestAction text is
    // the fallback. statusMethod records which path produced it (lineage).
    const status = actionsDerived?.status || deriveStatus(bill.latestAction?.text, billType);
    const statusMethod = actionsDerived?.status ? 'actions_history' : 'latest_action_text';
    const record = {
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
        date: bill.latestAction?.actionDate || null,
        text: bill.latestAction?.text || null,
      },
      originChamber: detail?.originChamber || (billType.startsWith('h') ? 'House' : 'Senate'),
      introducedDate: detail?.introducedDate || null,
      congressGovUrl: `https://www.congress.gov/bill/${congress}th-congress/${typeToUrlSlug(billType)}/${billNumber}`,
      relatedEventIds: [],   // Populated by admin — maps bills to Prism events
      lastUpdated: new Date().toISOString(),
    };
    
    enriched.push(record);
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

// ── Generate legislation_data.js for onboarding UI ───────────────────
function generateLegislationDataJS(bills) {
  const entries = bills.map(bill => {
    const typeLabel = TYPE_LABELS[bill.type] || bill.type.toUpperCase();
    const num = `${typeLabel} ${bill.number}`;
    const year = bill.introducedDate ? bill.introducedDate.slice(0, 4) : '';
    const congress = bill.congress === 119 ? '119th' : '118th';
    
    // Build meta string: "H.R. 1234 · Enacted · Defense" or "S. 567 · Passed Senate · Healthcare"
    const parts = [num];
    if (bill.status === 'enacted') {
      // For enacted, show PL number style if available, otherwise just "Enacted"
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
    return entry;
  });
  
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

  bills.forEach(b => {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    byCongress[b.congress] = (byCongress[b.congress] || 0) + 1;
    byTopic[b.topic || 'Unclassified'] = (byTopic[b.topic || 'Unclassified'] || 0) + 1;
    byType[b.type] = (byType[b.type] || 0) + 1;
    byStatusMethod[b.statusMethod || 'unknown'] = (byStatusMethod[b.statusMethod || 'unknown'] || 0) + 1;
  });

  return {
    total: bills.length,
    byStatus,
    byCongress,
    byTopic,
    byType,
    byStatusMethod,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Write outputs ────────────────────────────────────────────────────
async function writeBillOutputs(bills) {
  // config.OUTPUT_DIR → Prism/data/ (fixed 2026-07-02: was reading the
  // nonexistent config.outputDir and silently writing to scripts/output/)
  const outputDir = config.OUTPUT_DIR || path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

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

// ── Export for run-all.js ────────────────────────────────────────────
module.exports = { fetchBills, writeBillOutputs };

// ── Standalone execution ─────────────────────────────────────────────
if (require.main === module) {
  fetchBills()
    .then(bills => writeBillOutputs(bills))
    .then(() => console.log('\n✓ Bills fetch complete.\n'))
    .catch(err => {
      console.error('✗ Bills fetch failed:', err);
      process.exit(1);
    });
}
