/**
 * fetch-votes.js — the votes pipeline ("the biggest lever", July 4 handoff §3 #5).
 *
 * Fetches member-level roll-call votes for both chambers and joins them to
 * the bill corpus. KEYLESS by design (2026-07-05 finding): both chambers
 * publish member-level XML with the bill reference embedded —
 *   House:  https://clerk.house.gov/evs/{year}/roll{NNN}.xml   (legis-num)
 *   Senate: https://www.senate.gov/legislative/LIS/...          (document block)
 * — so the Congress.gov API (and its key) is not needed at all. We SWEEP
 * the rolls rather than walking per-bill actions: fewer moving parts, no
 * per-bill API budget, and every roll call lands whether or not we knew to
 * ask for it.
 *
 * What this feeds (heuristics handoff §5.7):
 *   - fact-tier interpolation weights (voted for/against = strongest signal)
 *   - record-z from margins (the authored billZ ladder demotes to fallback)
 *   - the substance lens tier 2: a bill that forced a roll call generated a
 *     field; voice-vote bills are the field at rest
 *
 * Output: data/prism_votes.json
 *   { generated, method, votes: [...], byBill: {billId: [voteId]}, stats }
 *   vote: { voteId, chamber, congress, year|session, roll, date, question,
 *           result, billId, totals, margin, party: {D:{yea,nay},...},
 *           positions: {yea:[bioguide], nay:[], present:[], notVoting:[]},
 *           unmatched: [names senate-join could not resolve] }
 * Also stamps prism_legislation.json: rollCallCount, minMargin, lastRollDate
 * (method 'roll_call_sweep_v1' recorded in the votes file lineage).
 *
 * RESUMABLE: data/votes_checkpoint.json persists progress every 25 fetches.
 * Re-run to continue; delete the checkpoint for a clean sweep.
 *
 * Senate member join: senate XML has no bioguide — members resolve via
 * (state, lastName) against data/prism_members.json (verified unique across
 * all 102 senators on disk, 2026-07-05); failures land in vote.unmatched,
 * never silently dropped.
 *
 * Usage:
 *   node scripts/fetch-votes.js                 # full sweep (long; resumable)
 *   VOTES_LIMIT=20 node scripts/fetch-votes.js  # pilot: stop after N fetches
 *   VOTES_ONLY=house VOTES_YEAR=2025 node ...   # one stream
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CHECKPOINT = path.join(DATA_DIR, 'votes_checkpoint.json');
const OUT = path.join(DATA_DIR, 'prism_votes.json');
const METHOD_ID = 'roll_call_sweep_v1';

const CONGRESSES = [
  { congress: 118, houseYears: [2023, 2024], senateSessions: [1, 2] },
  { congress: 119, houseYears: [2025, 2026], senateSessions: [1, 2] },
];
const DELAY_MS = 350;
const LIMIT = parseInt(process.env.VOTES_LIMIT || '0', 10) || Infinity;
const ONLY = process.env.VOTES_ONLY || '';
const YEAR_FILTER = process.env.VOTES_YEAR ? parseInt(process.env.VOTES_YEAR, 10) : null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── tiny XML helpers (fixed-schema government XML; no dependency) ──
function tag(s, name) {
  const m = s.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1].trim() : '';
}
function tags(s, name) {
  const out = []; const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'g');
  let m; while ((m = re.exec(s))) out.push(m[1]);
  return out;
}
const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

// ── fetch with retry (same posture as congress-client.js, XML body) ──
async function fetchXml(url, label) {
  const MAX = 5;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': 'prism-data-pipeline (research)' } });
      if (res.ok) return await res.text();
    } catch (err) {
      if (attempt >= MAX) throw err;
      const wait = Math.min(60000, 2000 * Math.pow(2, attempt - 1));
      console.log(`  ⚠ network fault on ${label} (${err.cause?.code || err.message}) — retry in ${wait / 1000}s`);
      await sleep(wait); continue;
    }
    if (res.status === 404) return null;                       // sweep boundary, not an error
    if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
      const wait = res.status === 429 ? 60000 : Math.min(60000, 2000 * Math.pow(2, attempt - 1));
      console.log(`  ⚠ HTTP ${res.status} on ${label} — retry in ${wait / 1000}s`);
      await sleep(wait); continue;
    }
    throw new Error(`HTTP ${res.status} on ${label}`);
  }
}

// ── bill reference normalization → corpus billId ──
// House legis-num: "S 5" · "H R 29" · "H J RES 20" · "S J RES 11"
// Senate document_type: "S." · "H.R." · "H.J.Res." · "S.J.Res."
function normType(raw) {
  const t = (raw || '').toUpperCase().replace(/[.\s]/g, '');
  return { HR: 'hr', S: 's', HJRES: 'hjres', SJRES: 'sjres' }[t] || null;
}
function houseBillId(legisNum, congress) {
  const m = (legisNum || '').trim().match(/^([A-Z .]+?)\s*(\d+)$/i);
  if (!m) return null;
  const type = normType(m[1]); if (!type) return null;
  return `${type}-${congress}-${m[2]}`;
}
function senateBillId(docType, docNumber, congress) {
  const type = normType(docType); if (!type || !docNumber) return null;
  return `${type}-${congress}-${docNumber}`;
}

// ── vote-cast normalization ──
function normCast(v) {
  const s = (v || '').trim().toLowerCase();
  if (s === 'yea' || s === 'aye') return 'yea';
  if (s === 'nay' || s === 'no') return 'nay';
  if (s.startsWith('present')) return 'present';
  return 'notVoting';
}
function emptyPositions() { return { yea: [], nay: [], present: [], notVoting: [] }; }
function marginOf(t) { const c = t.yea + t.nay; return c ? +( (t.yea - t.nay) / c ).toFixed(3) : null; }

// ── parsers (exported for tests) ──
function parseHouseXml(xml, year) {
  const meta = tag(xml, 'vote-metadata');
  const congress = parseInt(tag(meta, 'congress'), 10);
  const roll = parseInt(tag(meta, 'rollcall-num'), 10);
  const rec = {
    voteId: `h-${congress}-${year}-${roll}`,
    chamber: 'house', congress, year, roll,
    date: tag(meta, 'action-date'),
    question: unesc(tag(meta, 'vote-question')),
    result: unesc(tag(meta, 'vote-result')),
    billId: houseBillId(unesc(tag(meta, 'legis-num')), congress),
    desc: unesc(tag(meta, 'vote-desc')).slice(0, 160),
    totals: { yea: 0, nay: 0, present: 0, notVoting: 0 },
    party: {}, positions: emptyPositions(), unmatched: [],
  };
  const re = /<recorded-vote><legislator name-id="([^"]+)"[^>]*party="([^"]*)"[^>]*>[\s\S]*?<\/legislator><vote>([^<]+)<\/vote><\/recorded-vote>/g;
  let m;
  while ((m = re.exec(xml))) {
    const cast = normCast(m[3]);
    rec.positions[cast].push(m[1]);
    rec.totals[cast]++;
    const p = m[2] || '?';
    rec.party[p] = rec.party[p] || { yea: 0, nay: 0 };
    if (cast === 'yea' || cast === 'nay') rec.party[p][cast]++;
  }
  rec.margin = marginOf(rec.totals);
  return rec;
}

function parseSenateXml(xml, senJoin) {
  const congress = parseInt(tag(xml, 'congress'), 10);
  const session = parseInt(tag(xml, 'session'), 10);
  const roll = parseInt(tag(xml, 'vote_number'), 10);
  const doc = tag(xml, 'document');
  const rec = {
    voteId: `s-${congress}-${session}-${roll}`,
    chamber: 'senate', congress, session, roll,
    date: tag(xml, 'vote_date'),
    question: unesc(tag(xml, 'question')),
    result: unesc(tag(xml, 'vote_result')),
    billId: senateBillId(tag(doc, 'document_type'), tag(doc, 'document_number'), congress),
    desc: unesc(tag(xml, 'vote_title') || tag(doc, 'document_short_title')).slice(0, 160),
    totals: { yea: 0, nay: 0, present: 0, notVoting: 0 },
    party: {}, positions: emptyPositions(), unmatched: [],
  };
  tags(xml, 'member').forEach(mx => {
    const cast = normCast(tag(mx, 'vote_cast'));
    const state = tag(mx, 'state'), last = unesc(tag(mx, 'last_name'));
    const p = tag(mx, 'party') || '?';
    const bio = senJoin(state, last);
    if (bio) rec.positions[cast].push(bio);
    else rec.unmatched.push(unesc(tag(mx, 'member_full')) + ' → ' + cast);
    rec.totals[cast]++;
    rec.party[p] = rec.party[p] || { yea: 0, nay: 0 };
    if (cast === 'yea' || cast === 'nay') rec.party[p][cast]++;
  });
  rec.margin = marginOf(rec.totals);
  return rec;
}

// senate menu → the votes worth fetching (bill-document votes only; skips
// the nomination traffic that dominates the Senate floor)
function parseSenateMenu(xml, congress) {
  return tags(xml, 'vote').map(v => ({
    number: parseInt(tag(v, 'vote_number'), 10),
    issue: unesc(tag(v, 'issue')).trim(),
  })).filter(v => {
    const m = v.issue.match(/^([A-Za-z.\s]+?)\s*(\d+)$/);
    return m && normType(m[1]);
  });
}

// ── senate (state, lastName) → bioguide join ──
function buildSenJoin() {
  const members = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'prism_members.json'), 'utf8'));
  const arr = Array.isArray(members) ? members : (members.members || []);
  const map = {};
  arr.filter(x => x.chamber === 'senate').forEach(s => {
    map[(s.state + '|' + (s.lastName || '').toLowerCase())] = s.bioguideId;
  });
  return (state, last) => map[state + '|' + (last || '').toLowerCase()] || null;
}

// ── checkpoint ──
function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')); }
  catch (_) { return { votes: [], houseNext: {}, senateDone: {}, misses: [] }; }
}
function saveCheckpoint(cp) { fs.writeFileSync(CHECKPOINT, JSON.stringify(cp)); }

// ── main sweep ──
async function main() {
  const bills = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'prism_legislation.json'), 'utf8'));
  const billIds = new Set(bills.map(b => b.billId));
  const senJoin = buildSenJoin();
  const cp = loadCheckpoint();
  const have = new Set(cp.votes.map(v => v.voteId));
  let fetched = 0, kept0 = cp.votes.length;
  const budget = () => fetched < LIMIT;

  const keep = rec => {
    if (!rec.billId || !billIds.has(rec.billId)) return false;   // joins the corpus or it isn't kept
    if (have.has(rec.voteId)) return false;
    cp.votes.push(rec); have.add(rec.voteId);
    return true;
  };
  const tick = async () => { fetched++; if (fetched % 25 === 0) { saveCheckpoint(cp); console.log(`  · checkpoint (${cp.votes.length} votes, ${fetched} fetches this run)`); } await sleep(DELAY_MS); };

  // House: sweep roll numbers per year until 5 consecutive 404s
  if (ONLY !== 'senate') for (const c of CONGRESSES) for (const year of c.houseYears) {
    if (YEAR_FILTER && year !== YEAR_FILTER) continue;
    let n = cp.houseNext[year] || 1, gap = 0;
    console.log(`── House ${year} (congress ${c.congress}) from roll ${n} ──`);
    while (gap < 5 && budget()) {
      const url = `https://clerk.house.gov/evs/${year}/roll${String(n).padStart(3, '0')}.xml`;
      const xml = await fetchXml(url, `house ${year}#${n}`);
      if (xml === null) { gap++; n++; continue; }
      gap = 0;
      try { const rec = parseHouseXml(xml, year); if (keep(rec)) console.log(`  + ${rec.voteId} ${rec.billId} ${rec.question} (${rec.totals.yea}-${rec.totals.nay})`); }
      catch (e) { cp.misses.push({ url, err: e.message }); }
      cp.houseNext[year] = ++n;
      await tick();
    }
  }

  // Senate: menu per session → fetch only bill-document votes
  if (ONLY !== 'house') for (const c of CONGRESSES) for (const session of c.senateSessions) {
    const key = `${c.congress}_${session}`;
    cp.senateDone[key] = cp.senateDone[key] || [];
    const done = new Set(cp.senateDone[key]);
    if (!budget()) break;
    console.log(`── Senate ${c.congress}-${session} ──`);
    const menuUrl = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${c.congress}_${session}.xml`;
    let menu;
    try { menu = await fetchXml(menuUrl, `senate menu ${key}`); } catch (e) { cp.misses.push({ url: menuUrl, err: e.message }); continue; }
    if (!menu) continue;
    const wanted = parseSenateMenu(menu, c.congress).filter(v => !done.has(v.number));
    console.log(`  ${wanted.length} bill-document votes to fetch (nominations skipped)`);
    for (const v of wanted) {
      if (!budget()) break;
      const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${c.congress}${session}/vote_${c.congress}_${session}_${String(v.number).padStart(5, '0')}.xml`;
      const xml = await fetchXml(url, `senate ${key}#${v.number}`);
      if (xml) {
        try { const rec = parseSenateXml(xml, senJoin); if (keep(rec)) console.log(`  + ${rec.voteId} ${rec.billId} ${rec.question} (${rec.totals.yea}-${rec.totals.nay})${rec.unmatched.length ? ' ⚠' + rec.unmatched.length + ' unmatched' : ''}`); }
        catch (e) { cp.misses.push({ url, err: e.message }); }
      }
      cp.senateDone[key].push(v.number);
      await tick();
    }
  }

  saveCheckpoint(cp);

  // ── finalize: output + bill stamps ──
  const byBill = {};
  cp.votes.forEach(v => { (byBill[v.billId] = byBill[v.billId] || []).push(v.voteId); });
  const unmatchedTotal = cp.votes.reduce((a, v) => a + v.unmatched.length, 0);
  const out = {
    generated: new Date().toISOString(), method: METHOD_ID,
    stats: { votes: cp.votes.length, billsWithVotes: Object.keys(byBill).length, house: cp.votes.filter(v => v.chamber === 'house').length, senate: cp.votes.filter(v => v.chamber === 'senate').length, senateUnmatchedPositions: unmatchedTotal, parseMisses: cp.misses.length },
    byBill, votes: cp.votes,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`\n✓ ${OUT}`, out.stats);

  // stamp the record: roll-call presence is the substance signal tier 2
  const vById = byBill;
  bills.forEach(b => {
    const ids = vById[b.billId];
    if (ids) {
      const vs = ids.map(id => cp.votes.find(v => v.voteId === id));
      b.rollCallCount = ids.length;
      b.minMargin = Math.min(...vs.map(v => Math.abs(v.margin ?? 1)));
      b.lastRollDate = vs.map(v => v.date).sort().pop();
    } else { delete b.rollCallCount; delete b.minMargin; delete b.lastRollDate; }
  });
  fs.writeFileSync(path.join(DATA_DIR, 'prism_legislation.json'), JSON.stringify(bills, null, 2));
  console.log(`✓ prism_legislation.json stamped: ${bills.filter(b => b.rollCallCount).length} bills with roll calls`);

  // UI catalog — same stamps, compact keys (rc = roll calls, mm = min margin),
  // same parse-and-rewrite approach as tag-ceremonial.js. The catalog is what
  // the browsing surfaces load; without this the record stays pipeline-only.
  const jsPath = path.join(DATA_DIR, 'legislation_data.js');
  const src = fs.readFileSync(jsPath, 'utf8');
  const m = src.match(/^([\s\S]*?const LEGISLATION_DATA = )([\s\S]*?)(;\s*)$/);
  if (m) {
    const entries = JSON.parse(m[2]);
    const stampById = {};
    bills.forEach(b => { if (b.rollCallCount) stampById[b.billId] = b; });
    let stamped = 0;
    entries.forEach(e => {
      const s = stampById[e.id];
      if (s) { e.rc = s.rollCallCount; e.mm = +s.minMargin.toFixed(3); stamped++; }
      else { delete e.rc; delete e.mm; }
    });
    fs.writeFileSync(jsPath, m[1] + JSON.stringify(entries, null, 2) + m[3]);
    console.log(`✓ legislation_data.js stamped: ${stamped} entries with rc/mm`);
  } else console.error('✗ could not parse legislation_data.js — UI catalog not stamped');
  if (fetched >= LIMIT) console.log(`\n(VOTES_LIMIT=${LIMIT} reached — re-run to continue from checkpoint)`);
  if (cp.misses.length) console.log(`⚠ ${cp.misses.length} parse/fetch misses recorded in checkpoint`);
}

module.exports = { parseHouseXml, parseSenateXml, parseSenateMenu, houseBillId, senateBillId, normCast, METHOD_ID };
if (require.main === module) main().catch(e => { console.error('FATAL:', e); process.exit(1); });
