/**
 * fetch-news.js — Event Engine sourcing, news signal (M3).
 * (Event Engine Build Spec v1 §3.1/§5 — GDELT ratified by Sailor
 * 2026-07-13; standalone-news-events shape ratified same session.)
 *
 * KEYLESS by design: GDELT DOC 2.0 API (free, no key, 15-min refresh).
 * Swappable behind this file if GDELT's noise annoys in practice.
 *
 * Shape: STANDALONE news candidates (source:'news') — no member
 * positions attached (news carries none; that's the legislative feed's
 * job). The M2 pass scores these with the same constitutive-fitness
 * question, arguing the cross-cut from the public field instead of
 * roll-call defectors.
 *
 * Clustering: GDELT returns articles, not events. Syndication is the
 * signal — the same story under near-identical headlines across outlets.
 * Title-token Jaccard clustering (greedy union-find); clusters with
 * fewer than MIN_OUTLETS distinct domains are dropped (one-outlet
 * stories are content-mill noise or not yet events; multi-outlet pickup
 * IS the heat signal).
 *
 * cid: 'cand_news_' + dominant sorted tokens — deterministic-ish while
 * a story is live, so re-runs upsert in the browser store and triage
 * state + M2 scores survive (PrismDB.importCandidates never lets
 * incoming nulls clobber local scores — fixed 2026-07-13).
 *
 * MERGE, don't clobber: fetch-activity.js writes data/candidates.js
 * fresh (legislative only). This script runs AFTER it, re-reads the
 * file, drops stale news candidates, and appends fresh ones. Run order
 * is enforced by Scan News Cycle.command.
 *
 * Salience (0–1): 0.55 outlet volume + 0.45 recency. NOT fitness —
 * fitness stays null until the M2 pass argues for a second axis.
 *
 * Usage:
 *   node scripts/fetch-news.js                    # 3-day window, max 15
 *   TIMESPAN=1d MAXNEWS=10 node scripts/fetch-news.js
 *   QUERY='(immigration OR border)' node scripts/fetch-news.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { loadScores, bakeScores } = require('./candidate-scores');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'candidates.js');
const METHOD_ID = 'gdelt_docapi_v1';

const TIMESPAN = process.env.TIMESPAN || '3d';
const MAXNEWS = parseInt(process.env.MAXNEWS || '15', 10);
const MIN_OUTLETS = parseInt(process.env.MIN_OUTLETS || '3', 10);
const QUERY = process.env.QUERY ||
  '(congress OR senate OR "white house" OR "supreme court")';

// US/English filtering happens CLIENT-SIDE (every ArtList article carries
// language + sourcecountry) — query-side sourcecountry:/sourcelang: made
// GDELT's finicky parser a second failure point for zero benefit.
const API = 'https://api.gdeltproject.org/api/v2/doc/doc' +
  '?query=' + encodeURIComponent(QUERY) +
  '&mode=ArtList&maxrecords=250&timespan=' + TIMESPAN + '&format=json';

const DEBUG_FILE = path.join(DATA_DIR, 'news_debug.txt');
function dumpDebug(note, body) {
  fs.writeFileSync(DEBUG_FILE,
    `# fetch-news.js debug · ${new Date().toISOString()}\n# ${note}\n# URL: ${API}\n\n` +
    String(body).slice(0, 4000) + '\n');
  console.log(`  (raw response dumped → data/news_debug.txt)`);
}

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'prism-event-engine/1.0' } }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

// GDELT throttles bursts per-IP and its parser fails soft (empty or
// plain-text error with HTTP 200) — retry with spacing, and surface the
// raw body when it never comes good.
async function fetchJson(url) {
  let last = null;
  for (let a = 0; a < 3; a++) {
    if (a) { console.log(`  retry ${a}/2 (GDELT throttles bursts — waiting 6s)…`); await new Promise(r => setTimeout(r, 6000)); }
    try { last = await fetchRaw(url); } catch (e) { last = { status: 'ERR', body: e.message }; continue; }
    if (last.status !== 200) continue;
    const body = last.body.trim();
    if (!body) continue;                                   // empty 200 = throttled
    try {
      const j = JSON.parse(body);
      if (Array.isArray(j.articles) && j.articles.length) return j;
      last.body = body;                                    // valid JSON, no articles — retry
    } catch (_) { /* plain-text error — retry, then dump */ }
  }
  dumpDebug(`gave up after 3 attempts (last status ${last && last.status})`, last ? last.body : '(no response)');
  throw new Error('GDELT gave no usable response after 3 attempts — see data/news_debug.txt');
}

// ── title normalization + clustering ──
const STOP = new Set(('a an and are as at be but by for from has have in is it its of on or ' +
  'that the this to was were will with after amid over under new says said').split(' '));
function tokens(title) {
  return new Set((title || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 0;
}

function cluster(articles) {
  const toks = articles.map(a => tokens(a.title));
  const parent = articles.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < articles.length; i++)
    for (let j = i + 1; j < articles.length; j++)
      if (jaccard(toks[i], toks[j]) >= 0.5) parent[find(i)] = find(j);
  const groups = new Map();
  articles.forEach((a, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  });
  return [...groups.values()].map(idxs => ({ idxs, toks: idxs.map(i => toks[i]) }));
}

function isoDate(seendate) {  // GDELT: YYYYMMDDTHHMMSSZ (tolerant)
  const m = /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/.exec(seendate || '');
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}Z`;
}

function shapeCandidates(articles, now) {
  // dedup by url, then by exact title+domain
  const seen = new Set();
  articles = articles.filter(a => {
    if (!a.title || !a.url) return false;
    const k = a.url;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  const spanMs = { '1d': 1, '2d': 2, '3d': 3, '7d': 7 }[TIMESPAN] ?
    ({ '1d': 1, '2d': 2, '3d': 3, '7d': 7 }[TIMESPAN]) * 864e5 : 3 * 864e5;

  return cluster(articles).map(({ idxs, toks }) => {
    const arts = idxs.map(i => articles[i]);
    const domains = new Set(arts.map(a => a.domain));
    if (domains.size < MIN_OUTLETS) return null;

    // medoid headline = the one most similar to the rest of its cluster
    let best = 0, bestScore = -1;
    toks.forEach((t, i) => {
      const s = toks.reduce((acc, u) => acc + jaccard(t, u), 0);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    const title = arts[best].title;

    // deterministic-ish cid from the dominant shared tokens
    const counts = {};
    toks.forEach(t => t.forEach(w => counts[w] = (counts[w] || 0) + 1));
    const key = Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 3).map(e => e[0]).sort().join('-');
    if (!key) return null;

    const times = arts.map(a => Date.parse(isoDate(a.seendate) || 0)).filter(t => !isNaN(t));
    const newest = times.length ? Math.max(...times) : now;
    const recency = Math.max(0, 1 - (now - newest) / spanMs);
    const volume = Math.min(1, domains.size / 10);
    const salience = +(0.55 * volume + 0.45 * recency).toFixed(3);

    arts.sort((a, b) => (Date.parse(isoDate(b.seendate) || 0) || 0) - (Date.parse(isoDate(a.seendate) || 0) || 0));
    const kept = arts.slice(0, 12).map(a => ({
      title: a.title, url: a.url, domain: a.domain, seendate: isoDate(a.seendate)
    }));

    return {
      cid: 'cand_news_' + key,
      source: 'news',
      ts: Date.now(),
      raw: { method: METHOD_ID, query: QUERY, timespan: TIMESPAN, salience, articles: kept },
      title,
      summary: kept.slice(0, 6).map(a =>
        `${(a.seendate || '').slice(0, 10)} ${a.domain}: ${a.title}`).join('\n'),
      framingDraft: null,                   // M2 fills
      suggestedAxes: null,                  // M2
      prevalentAxisGuess: null,             // M2
      members: [],                          // news carries no positions
      bills: [],
      fitness: null,                        // M2 — salience is NOT fitness
      status: 'new'
    };
  }).filter(Boolean);
}

function readExisting() {
  if (!fs.existsSync(OUT)) return { header: null, candidates: [] };
  const src = fs.readFileSync(OUT, 'utf8');
  const eq = src.indexOf('window.PRISM_CANDIDATES');
  const start = src.indexOf('[', eq);
  const end = src.lastIndexOf(']');
  if (eq < 0 || start < 0 || end < 0) throw new Error('candidates.js unparseable — regenerate via fetch-activity.js');
  return { candidates: JSON.parse(src.slice(start, end + 1)) };
}

async function main() {
  console.log(`GDELT sweep: ${TIMESPAN} window · query ${QUERY}`);
  const data = await fetchJson(API);
  let articles = data.articles;
  console.log(`${articles.length} articles returned`);

  // client-side US/English filter (see note at API constant)
  articles = articles.filter(a =>
    (a.language || '') === 'English' &&
    (a.sourcecountry || '') === 'United States');
  console.log(`${articles.length} after US/English filter`);
  if (!articles.length) {
    dumpDebug('articles returned but none US/English — check sourcecountry values', JSON.stringify(data.articles.slice(0, 5), null, 2));
    return;
  }

  const news = shapeCandidates(articles, Date.now())
    .sort((a, b) => b.raw.salience - a.raw.salience)
    .slice(0, MAXNEWS);
  console.log(`${news.length} news candidates (≥${MIN_OUTLETS} outlets each)`);
  news.slice(0, 8).forEach(c => console.log(
    `  ${c.raw.salience.toFixed(2)} [${c.raw.articles.length} art] ${c.title.slice(0, 70)}`));

  // merge: keep legislative (and any non-news) candidates, replace news
  const existing = readExisting().candidates;
  const keptExisting = existing.filter(c => c.source !== 'news');

  // Re-merge the committed middle stratum onto the fresh news entries
  // (legislative entries were baked by fetch-activity.js, which runs first).
  const baked = bakeScores(news, loadScores());
  if (baked) console.log(`  ${baked} news candidates re-merged from data/candidate_scores.json`);

  const merged = [...keptExisting, ...news];

  const header =
    `// Auto-generated — legislative: scripts/fetch-activity.js · news: scripts/fetch-news.js\n` +
    `// ${new Date().toISOString()} · ${keptExisting.length} legislative + ${news.length} news (GDELT, ${TIMESPAN})\n` +
    `// Consumed by the admin-surface 📡 newsroom → PrismDB.importCandidates\n`;
  fs.writeFileSync(OUT, header +
    'window.PRISM_CANDIDATES = ' + JSON.stringify(merged, null, 2) + ';\n');
  console.log(`✓ ${OUT} (${merged.length} total candidates)`);
}

if (require.main === module) {
  main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { tokens, jaccard, cluster, shapeCandidates, isoDate };  // testable
