/**
 * Prism Data Pipeline — Per-Member Legislative Record Pull
 *
 * For every current member, fetches the bills they SPONSORED (authored) and
 * COSPONSORED (signed onto), classifies each by how far it advanced
 * (latestAction → status), and writes per-member tallies to
 * data/sponsorship_stats.json.
 *
 * Two signals, deliberately kept separate (the scorer weights them):
 *   sponsored   — authored. Strong individual delivery signal.
 *   cosponsored — signed onto someone else's bill. Weaker, broader signal of
 *                 legislative engagement / coalition alignment; widens coverage
 *                 for members who author little but cosponsor a lot.
 *
 * Endpoints (Congress.gov v3):
 *   /member/{bioguideId}/sponsored-legislation     → key 'sponsoredLegislation'
 *   /member/{bioguideId}/cosponsored-legislation    → key 'cosponsoredLegislation'
 *
 * Usage:
 *   CONGRESS_API_KEY=<key> node scripts/fetch-sponsorship.js
 *
 * Output: data/sponsorship_stats.json
 *   { generatedAt, congressesIncluded, billTypes, members: {
 *       "<bio>": { name, party, chamber,
 *                  sponsored:   { total, byStatus },
 *                  cosponsored: { total, byStatus } } } }
 *
 * Runtime note: cosponsorship is voluminous (members cosponsor hundreds of
 * bills), so this is heavier than the sponsored-only pull — expect ~2–3 pages
 * per member for cosponsorship and a longer total run. Calls are paced at
 * config.DELAY_MS and honor 429 via the shared client. MUST run on a machine
 * with outbound access to api.congress.gov (the Prism sandbox is network-
 * restricted).
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { fetchAll } = require('./congress-client');

const CONGRESSES = [119, 118];
const BILL_TYPES = new Set(['hr', 's', 'hjres', 'sjres']);

// ── Status derivation (verbatim from fetch-bills.js, kept in sync) ──────
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

function loadRoster() {
  const p = path.join(config.OUTPUT_DIR, 'prism_members.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(raw) ? raw : (raw.members || Object.values(raw)[0]);
}

async function fetchList(bioguideId, kind) {
  // kind: 'sponsored' | 'cosponsored'
  const endpoint = `/member/${bioguideId}/${kind}-legislation`;
  const key = kind === 'sponsored' ? 'sponsoredLegislation' : 'cosponsoredLegislation';
  try {
    return await fetchAll(endpoint, key);
  } catch (e) {
    console.warn(`  ! ${bioguideId} ${kind}: ${e.message}`);
    return null; // distinct from a real zero
  }
}

function tally(items) {
  const byStatus = {};
  let total = 0;
  for (const it of items) {
    const cong = it.congress;
    if (cong != null && !CONGRESSES.includes(Number(cong))) continue;
    const type = (it.type || '').toLowerCase();
    if (!BILL_TYPES.has(type)) continue;
    const status = deriveStatus(it.latestAction && it.latestAction.text);
    byStatus[status] = (byStatus[status] || 0) + 1;
    total++;
  }
  return { total, byStatus, ok: true };   // ok marks a successful fetch (even when total is 0)
}

// ── Resume / merge ──
// A re-run reuses every endpoint that already succeeded and only retries the
// gaps (failed endpoints), so fixing a handful of flaky partials costs minutes,
// not a full 20-minute refetch — and it can never overwrite good data with a
// fresh failure. An endpoint counts as "done" only if it carries ok:true; a
// null (failed) or a legacy entry without ok gets retried once.
function loadExisting() {
  try {
    const p = path.join(config.OUTPUT_DIR, 'sponsorship_stats.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')).members || {};
  } catch (e) { return {}; }
}
function endpointOk(e) {
  if (!e) return false;                 // null / missing → needs fetching
  if (e.ok === true) return true;       // new format: explicit success marker
  // Legacy entry (no ok flag): trust it only if it carries real content. An
  // empty {total:0, byStatus:{}} is indistinguishable from a failed fetch, so
  // we retry those once — a genuine zero then comes back stamped ok:true and
  // settles. Members with actual bills are kept as-is (no needless refetch).
  return (e.total > 0) || !!(e.byStatus && Object.keys(e.byStatus).length > 0);
}

async function main() {
  const roster = loadRoster();
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Prism — Per-Member Legislative Record Pull     ║');
  console.log('║  Congress.gov sponsored + cosponsored           ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`Members: ${roster.length} · congresses: ${CONGRESSES.join(', ')}\n`);

  const existing = loadExisting();
  const haveExisting = Object.keys(existing).length;
  if (haveExisting) console.log(`Resuming: ${haveExisting} members already on disk — only gaps will be re-fetched.\n`);

  const out = {};
  let fetched = 0, cached = 0, partial = 0, i = 0;
  for (const m of roster) {
    i++;
    const bio = m.bioguideId;
    const nm = typeof m.name === 'string' ? m.name : (m.name && m.name.full) || bio;
    const prev = existing[bio];
    const needSp = !endpointOk(prev && prev.sponsored);
    const needCo = !endpointOk(prev && prev.cosponsored);

    // Fully cached — reuse and skip the API entirely.
    if (!needSp && !needCo) {
      out[bio] = { name: nm, party: (m.party || '').toUpperCase(), chamber: (m.chamber || '').toLowerCase(),
                   sponsored: prev.sponsored, cosponsored: prev.cosponsored };
      cached++;
      continue;
    }

    process.stdout.write(`[${i}/${roster.length}] ${bio} ${nm} … `);
    // Only hit the endpoint(s) that still need it; keep the other from disk.
    let sponsored = (prev && endpointOk(prev.sponsored)) ? prev.sponsored : null;
    let cosponsored = (prev && endpointOk(prev.cosponsored)) ? prev.cosponsored : null;
    if (needSp) { const it = await fetchList(bio, 'sponsored'); sponsored = it ? tally(it) : null;
                  if (needCo) await new Promise(r => setTimeout(r, config.DELAY_MS)); }
    if (needCo) { const it = await fetchList(bio, 'cosponsored'); cosponsored = it ? tally(it) : null; }

    out[bio] = { name: nm, party: (m.party || '').toUpperCase(), chamber: (m.chamber || '').toLowerCase(),
                 sponsored, cosponsored };
    fetched++;
    if (!endpointOk(sponsored) || !endpointOk(cosponsored)) partial++;
    const sTxt = endpointOk(sponsored) ? sponsored.total : '✗';
    const cTxt = endpointOk(cosponsored) ? cosponsored.total : '✗';
    console.log(`sp ${sTxt} · co ${cTxt}`);
    await new Promise(r => setTimeout(r, config.DELAY_MS));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    congressesIncluded: CONGRESSES,
    billTypes: [...BILL_TYPES],
    source: 'Congress.gov /member/{bioguideId}/{sponsored,cosponsored}-legislation',
    note: 'Law-capable measures only; status from latestAction. Weights/blend live in score-sponsorship-z.js.',
    members: out,
  };
  const outPath = path.join(config.OUTPUT_DIR, 'sponsorship_stats.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`\n✔ Wrote ${outPath}`);
  console.log(`  ${cached} reused from disk · ${fetched} fetched this run · ${partial} still partial.`);
  if (partial) console.log('  (just run it again to retry the remaining partials — each pass only retries the gaps.)');
  else if (haveExisting) console.log('  All endpoints complete. ✔');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
