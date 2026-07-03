/**
 * fetch-bills.js — Legislation data bootstrap for Prism
 * 
 * Fetches notable bills from the 119th Congress (2025-2026) and enacted
 * laws from the 118th Congress (2023-2024) via the Congress.gov API.
 * 
 * "Notable" = passed at least one chamber, reported by committee,
 * became public law, or received a floor vote.
 * 
 * Imports the shared congress-client.js for pagination/rate-limiting.
 * Output: prism_legislation.json + legislation_data.js
 * 
 * Usage (called by run-all.js, or standalone):
 *   CONGRESS_API_KEY=<key> node fetch-bills.js
 */

const { fetchAll, fetchOne: rawFetchOne } = require('./congress-client.js');
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
];

// For 118th Congress, we only want enacted laws — tighter filter
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

// ── Status derivation from latestAction text ─────────────────────────
function deriveStatus(latestActionText) {
  if (!latestActionText) return 'introduced';
  const t = latestActionText.toLowerCase();
  if (t.includes('became public law') || t.includes('signed by the president')) return 'enacted';
  if (t.includes('vetoed')) return 'vetoed';
  if (t.includes('presented to president')) return 'presented_to_president';
  if (t.includes('resolving differences') || t.includes('conference report')) return 'conference';
  if (t.includes('passed house') || t.includes('passed/agreed to in house')) {
    if (t.includes('passed senate') || t.includes('passed/agreed to in senate')) return 'passed_both';
    return 'passed_house';
  }
  if (t.includes('passed senate') || t.includes('passed/agreed to in senate')) return 'passed_senate';
  if (t.includes('reported by') || t.includes('ordered to be reported')) return 'reported';
  if (t.includes('cloture') || t.includes('motion to proceed')) return 'floor_action';
  return 'committee';
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

// ── Main fetch orchestrator ──────────────────────────────────────────
async function fetchBills() {
  console.log('\n═══ LEGISLATION BOOTSTRAP ═══\n');
  
  const allNotable = [];
  
  // ── 119th Congress: all notable bills ──
  console.log('── 119th Congress (notable bills) ──');
  for (const type of BILL_TYPES) {
    const bills = await fetchBillList(119, type);
    const notable = filterNotable(bills, NOTABLE_ACTION_KEYWORDS);
    console.log(`    → ${notable.length} notable`);
    notable.forEach(b => allNotable.push({ ...b, _congress: 119, _type: type }));
  }
  
  // ── 118th Congress: enacted laws only ──
  console.log('\n── 118th Congress (enacted laws) ──');
  for (const type of BILL_TYPES) {
    const bills = await fetchBillList(118, type);
    const enacted = filterNotable(bills, ENACTED_KEYWORDS);
    console.log(`    → ${enacted.length} enacted`);
    enacted.forEach(b => allNotable.push({ ...b, _congress: 118, _type: type }));
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
    
    // Build the Prism legislation record
    const status = deriveStatus(bill.latestAction?.text);
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
  
  console.log(`\n── Enrichment complete: ${deduped.length} unique bills ──`);
  
  return deduped;
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
    
    return {
      name: bill.title,
      meta: parts.join(' · '),
      id: bill.billId,
    };
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
  
  bills.forEach(b => {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    byCongress[b.congress] = (byCongress[b.congress] || 0) + 1;
    byTopic[b.topic || 'Unclassified'] = (byTopic[b.topic || 'Unclassified'] || 0) + 1;
    byType[b.type] = (byType[b.type] || 0) + 1;
  });
  
  return {
    total: bills.length,
    byStatus,
    byCongress,
    byTopic,
    byType,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Write outputs ────────────────────────────────────────────────────
async function writeBillOutputs(bills) {
  // config.OUTPUT_DIR → Prism/data/ (fixed 2026-07-02: was reading the
  // nonexistent config.outputDir and silently writing to scripts/output/)
  const outputDir = config.OUTPUT_DIR || path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
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
