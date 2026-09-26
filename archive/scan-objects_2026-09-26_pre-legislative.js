#!/usr/bin/env node
/**
 * scan-objects.js — the newsroom's daily scan, object-first (2026-09-22).
 *
 * Sailor's redirection (09-22): the product addresses pop discourse as
 * overwrought with INVERSIONS and breaks in OBJECT PERMANENCE, so the flow
 * has to be a steady stream of objects to observe — rulings come out of the
 * flow, by recurrence, not ahead of it. The unit here is therefore the
 * OBJECT (the instrument that finished forming — Window Rule §4c), not the
 * story. Heat (syndication) still ranks; it no longer defines.
 *
 * What one run does:
 *   1. Ask GDELT DOC 2.0 (keyless) for instrument-shaped coverage — several
 *      queries, each a set of forming verbs × holders.
 *   2. Cluster articles by title (syndication = the same object under near-
 *      identical headlines); keep clusters with ≥ MIN_OUTLETS distinct domains.
 *   3. Read the instrument off each cluster: verb (signed / ruled / passed /
 *      vetoed / issued / voided …), holder (President / Senate / a court /
 *      an agency …), kind (law / order / ruling / rule / vote …), and the
 *      formed-on day = the cluster's earliest sighting (an as-of date, §4c.1).
 *   4. Merge into the REGISTER (data/newsroom/objects.json), which has
 *      memory: an object seen again updates; one that goes silent while
 *      unresolved is flagged a permanence BREAK; one that comes back after a
 *      break is a RETURN. Matching is title-token overlap + same holder, so a
 *      renamed object finds its earlier self.
 *   5. Queue the day's drafting: up to DAILY_QUOTA new objects that clear the
 *      bar (instrument read, ≥ MIN_OUTLETS, not already drafted).
 *   6. Write a digest (data/newsroom/digest-YYYY-MM-DD.md) for the morning.
 *
 * Runs on GitHub Actions (GDELT is unreachable from the Cowork shells) —
 * see scripts/github-workflows/scan-objects.yml. Also runs by hand:
 *
 *   node scripts/scan-objects.js                    # live, 2-day window
 *   FIXTURE=data/candidates.js node scripts/scan-objects.js   # offline: reuse a
 *                                                   # previous scan's articles
 *   TIMESPAN=3d QUOTA=3 node scripts/scan-objects.js
 *
 * No npm. Node 18+.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const NR_DIR = path.join(ROOT, 'data', 'newsroom');
const REGISTER = path.join(NR_DIR, 'objects.json');
const TIMESPAN = process.env.TIMESPAN || '2d';
const DAILY_QUOTA = parseInt(process.env.QUOTA || '3', 10);
const MIN_OUTLETS = parseInt(process.env.MIN_OUTLETS || '3', 10);
const SILENT_DAYS = parseInt(process.env.SILENT_DAYS || '5', 10);   // a watched object silent this long = a break
const FIXTURE = process.env.FIXTURE || null;
const TODAY = (process.env.TODAY || new Date().toISOString()).slice(0, 10);

// ── 1. What an instrument looks like in a headline ──────────────────
// Forming verbs → kind. Order matters: first match wins.
const VERBS = [
  { re: /\b(signs?|signed|signing)\b.*\b(into law|bills?|acts?|orders?|proclamations?|memorandum|legislation|package)\b|\b(into law)\b/i, verb: 'signed', kind: 'law' },
  { re: /\b(veto(?:es|ed)?)\b/i, verb: 'vetoed', kind: 'veto' },
  { re: /\bexecutive order\b|\b(issues?|issued|signs?|signed)\b.*\b(order|proclamation|directive|memo(?:randum)?)\b/i, verb: 'issued', kind: 'order' },
  { re: /\b(proclaims?|proclaimed|proclamation)\b/i, verb: 'proclaimed', kind: 'proclamation' },
  { re: /\b(strikes? down|struck down|overturn(?:s|ed)?|blocks?|blocked|halts?|halted|enjoins?|enjoined|injunction|upholds?|upheld|rules?|ruled|ruling|sides? with|sided with|tosses|tossed|dismiss(?:es|ed))\b/i, verb: 'ruled', kind: 'ruling' },
  { re: /\b(pass(?:es|ed)?|approv(?:es|ed|al)|clears?|cleared|advanc(?:es|ed)|votes? to|voted to|rejects?|rejected|fails?|failed|filibuster(?:s|ed)?|tabled)\b/i, verb: 'voted', kind: 'vote' },
  { re: /\b(final rule|finaliz(?:es|ed)|rescind(?:s|ed)?|repeal(?:s|ed)?|rolls? back|rolled back|regulation|rulemaking)\b/i, verb: 'ruled (agency)', kind: 'rule' },
  { re: /\b(indict(?:s|ed|ment)|charg(?:es|ed) with|arraign(?:ed|ment)|plead(?:s|ed) guilty|convict(?:s|ed|ion)|sentenc(?:es|ed))\b/i, verb: 'charged', kind: 'indictment' },
  { re: /\b(sues?|sued|lawsuit|files? suit|filed suit|class action|petitions?)\b/i, verb: 'sued', kind: 'suit' },
  { re: /\b(tariffs?|sanctions?|levies|levied|impos(?:es|ed))\b/i, verb: 'imposed', kind: 'tariff/sanction' },
  { re: /\b(nominat(?:es|ed|ion)|confirm(?:s|ed|ation)|appoint(?:s|ed)|fir(?:es|ed)|ousts?|ousted|resign(?:s|ed|ation))\b/i, verb: 'personnel', kind: 'appointment' },
  { re: /\b(deal|agreement|accord|pact|ceasefire|treaty)\b.*\b(reached|signed|announced|struck|collapses?|collapsed)\b|\b(reach(?:es|ed)|strikes?|struck)\b.*\b(deal|agreement|accord)\b/i, verb: 'agreed', kind: 'agreement' },
  { re: /\b(shutdown|funding (?:bill|deal|lapse)|continuing resolution|debt (?:ceiling|limit)|appropriations?)\b/i, verb: 'funding', kind: 'appropriation' },
  { re: /\b(subpoena(?:s|ed)?|hearing|testif(?:y|ies|ied)|under oath|contempt)\b/i, verb: 'compelled', kind: 'hearing' },
];
// Holders → the station-trust axis needs a named holder (Rim Rule).
const HOLDERS = [
  { re: /\bsupreme court\b|\bscotus\b|\bjustices?\b/i, holder: 'the Supreme Court' },
  { re: /\bappeals? court\b|\bcircuit\b|\b(federal )?judge\b|\bcourt\b/i, holder: 'a federal court' },
  { re: /\bsenate\b|\bsenators?\b/i, holder: 'the Senate' },
  { re: /\bhouse (?:of representatives|republicans|democrats|gop|votes?|passes|speaker)\b|\bspeaker (?:johnson|of the house)\b|(?<!white )\bhouse\b(?! (?:media|press|ban))/i, holder: 'the House' },
  { re: /\bcongress\b|\blawmakers\b/i, holder: 'Congress' },
  { re: /\btrump\b|\bwhite house\b|\bpresident\b|\badministration\b|\bexecutive order\b/i, holder: 'the President' },
  { re: /\btreasury\b|\bbessent\b|\birs\b/i, holder: 'Treasury' },
  { re: /\bfederal reserve\b|\bthe fed\b|\bpowell\b|\bfomc\b/i, holder: 'the Federal Reserve' },
  { re: /\b(dhs|homeland security|ice|cbp|border patrol|immigration and customs)\b/i, holder: 'DHS' },
  { re: /\b(commerce department|commerce secretary|lutnick|ustr|trade representative)\b/i, holder: 'Commerce' },
  { re: /\b(pentagon|defense department|hegseth|department of war)\b/i, holder: 'the Pentagon' },
  { re: /\b(justice department|doj|attorney general|bondi|fbi)\b/i, holder: 'the Justice Department' },
  { re: /\b(fda|cdc|hhs|kennedy)\b/i, holder: 'HHS' },
  { re: /\b(epa|interior|energy department)\b/i, holder: 'an agency' },
  { re: /\bstate department\b|\brubio\b/i, holder: 'the State Department' },
  { re: /\bgovernor\b|\bgov\b\.?|\bnewsom\b|\bdesantis\b|\babbott\b|\bhochul\b|\bstate legislature\b|\bstatehouse\b/i, holder: 'a state' },
  { re: /\bfcc\b|\bftc\b|\bsec\b|\bcfpb\b/i, holder: 'a regulator' },
];
// Queries: forming verbs × federal holders. GDELT DOC caps query length, so
// several medium queries beat one giant one. sourcecountry filtering is
// done after the fact (query-side operators proved unreliable, 2026-07).
const QUERIES = [
  '(signed OR "signs" OR "into law" OR vetoed OR "executive order" OR proclamation) (trump OR "white house" OR congress OR senate OR governor)',
  '("struck down" OR "strikes down" OR upheld OR upholds OR blocks OR blocked OR injunction OR ruling OR rules) ("supreme court" OR judge OR court OR appeals)',
  '(passes OR passed OR approves OR rejects OR "votes to" OR "voted to" OR filibuster OR advances) (senate OR house OR congress OR bill)',
  '("final rule" OR rescinds OR repeals OR tariff OR tariffs OR sanctions OR "trade deal" OR agreement) (trump OR treasury OR commerce OR "federal reserve" OR administration)',
  '(indicted OR indictment OR charged OR subpoena OR "under oath" OR hearing OR testifies) (senate OR house OR "justice department" OR fbi OR "attorney general")',
];

// ── GDELT ─────────────────────────────────────────────────────────────
function gdeltUrl(query) {
  return 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(query) +
    '&mode=ArtList&maxrecords=250&timespan=' + TIMESPAN + '&format=json&sort=DateDesc';
}
function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'prism-newsroom/2.0' } }, res => {
      let body = ''; res.on('data', d => body += d); res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}
async function fetchArticles(query) {
  let last = null;
  for (let a = 0; a < 3; a++) {
    if (a) await new Promise(r => setTimeout(r, 6000));          // GDELT throttles bursts
    try { last = await fetchRaw(gdeltUrl(query)); } catch (e) { last = { status: 'ERR', body: e.message }; continue; }
    if (last.status !== 200 || !last.body.trim()) continue;
    try { const j = JSON.parse(last.body); if (Array.isArray(j.articles)) return j.articles; } catch (_) {}
  }
  console.warn('  ⚠ no usable GDELT response for: ' + query.slice(0, 60) + '… (status ' + (last && last.status) + ')');
  // keep the raw reply in the repo so a failed query can be read after the run
  try {
    fs.mkdirSync(NR_DIR, { recursive: true });
    fs.appendFileSync(path.join(NR_DIR, 'scan-debug.txt'),
      `\n# ${new Date().toISOString()} · status ${last && last.status}\n# query: ${query}\n# url: ${gdeltUrl(query)}\n` + String(last && last.body || '').slice(0, 1500) + '\n');
  } catch (e) {}
  return [];
}
// The July pipeline's query is known to return articles; if every instrument
// query comes back empty, the day still gets a pool to read objects from.
const FALLBACK_QUERY = '(congress OR senate OR "white house" OR "supreme court" OR governor OR "executive order" OR tariff)';
function fixtureArticles() {
  const s = fs.readFileSync(path.resolve(ROOT, FIXTURE), 'utf8');
  const i = s.indexOf('['), j = s.lastIndexOf(']');
  const arr = JSON.parse(s.slice(i, j + 1));
  const out = [];
  arr.forEach(c => { if (c.source === 'news' && c.raw && Array.isArray(c.raw.articles)) c.raw.articles.forEach(a => out.push({ ...a, seendate: a.seendate, sourcecountry: 'United States', language: 'English' })); });
  return out;
}

// ── 2. Clustering (ported from fetch-news.js: syndication is the signal) ──
const STOP = new Set(('a an and are as at be but by for from has have in is it its of on or that the this to was were will with after amid over under new says said his her their vs').split(' '));
function tokens(title) {
  return new Set((title || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) { let inter = 0; for (const t of a) if (b.has(t)) inter++; const uni = a.size + b.size - inter; return uni ? inter / uni : 0; }
function isoDate(seendate) {
  if (!seendate) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(seendate)) return seendate;
  const m = /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/.exec(seendate);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}Z` : null;
}
function cluster(articles) {
  const toks = articles.map(a => tokens(a.title));
  const parent = articles.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < articles.length; i++) for (let j = i + 1; j < articles.length; j++) if (jaccard(toks[i], toks[j]) >= 0.5) parent[find(i)] = find(j);
  const groups = new Map();
  articles.forEach((a, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  return [...groups.values()].map(idxs => idxs.map(i => articles[i]));
}

// ── 3. Reading the instrument off a cluster ───────────────────────────
function readInstrument(arts) {
  const titles = arts.map(a => a.title || '');
  const text = titles.join(' · ');
  let verb = null, kind = null, verbAt = -1;
  for (const v of VERBS) { const m = v.re.exec(text); if (m) { verb = v.verb; kind = v.kind; verbAt = m.index; break; } }
  // The holder is the ACTOR of the forming verb, not any name in the headline:
  // prefer the holder mentioned closest before the verb (subject position),
  // else the first mention anywhere. ("Newsom signs bills to stop Trump …" →
  // a state, not the President.)
  let holder = null, best = -1;
  for (const h of HOLDERS) {
    const m = h.re.exec(text); if (!m) continue;
    const before = verbAt < 0 || m.index < verbAt;
    const score = before ? (1000 - (verbAt - m.index)) : (100 - m.index / 10);
    if (score > best) { best = score; holder = h.holder; }
  }
  // headline = the most common title (syndication), trimmed of wire cruft
  const counts = new Map(); titles.forEach(t => { const k = t.replace(/\s+/g, ' ').trim(); counts.set(k, (counts.get(k) || 0) + 1); });
  const headline = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const dates = arts.map(a => isoDate(a.seendate)).filter(Boolean).sort();
  return { verb, kind, holder, headline, firstSeen: dates[0] || null, lastSeen: dates[dates.length - 1] || null };
}
function domains(arts) { return new Set(arts.map(a => a.domain).filter(Boolean)); }

// ── 4. The register ───────────────────────────────────────────────────
// The drafting overlay (objects.local.json) is READ here and never written:
// the drafting task owns it. Applying it keeps drafted/dismissed objects from
// being re-queued, and the register the scan writes carries their status, so
// the two files never need merging by hand (scripts/newsroom/overlay.js).
const OVERLAY = path.join(NR_DIR, 'objects.local.json');
const { applyOverlay } = require('./newsroom/overlay.js');
function loadRegister() {
  let reg;
  try { reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { reg = { schema: 'prism_object_register_v1', objects: [], scans: [] }; }
  let ov = null;
  try { ov = JSON.parse(fs.readFileSync(OVERLAY, 'utf8')); } catch (e) {}
  if (ov) applyOverlay(reg, ov);
  delete reg.localEdits;                 // retired: the overlay replaces hand-merged registers
  return reg;
}
function oid(headline, holder) {
  const t = [...tokens(headline)].sort().slice(0, 4).join('-') || 'object';
  const h = (holder || 'x').toLowerCase().replace(/[^a-z]+/g, '').slice(0, 8);
  return 'obj_' + h + '_' + t;
}
function matchExisting(reg, ins, toks) {
  let best = null, bestScore = 0;
  for (const o of reg.objects) {
    const s = jaccard(toks, new Set(o.tokens || []));
    const sameHolder = !ins.holder || !o.holder || o.holder === ins.holder;
    const score = s * (sameHolder ? 1 : 0.6);
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return bestScore >= 0.42 ? best : null;   // renamed objects still overlap on the load-bearing tokens
}
function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

function mergeScan(reg, clusters) {
  const seenToday = new Set();
  const events = { new: [], returned: [], updated: [] };
  clusters.forEach(arts => {
    const outlets = domains(arts);
    if (outlets.size < MIN_OUTLETS) return;
    const ins = readInstrument(arts);
    if (!ins.verb) return;                                          // no forming verb → not an object (a mood)
    const toks = tokens(ins.headline);
    const top = arts.slice().sort((a, b) => (b.seendate || '').localeCompare(a.seendate || '')).slice(0, 8)
      .map(a => ({ title: a.title, url: a.url, domain: a.domain, seendate: isoDate(a.seendate), image: a.socialimage || a.image || null }));
    let o = matchExisting(reg, ins, toks);
    if (!o) {
      o = {
        oid: oid(ins.headline, ins.holder), headline: ins.headline, tokens: [...toks],
        kind: ins.kind, verb: ins.verb, holder: ins.holder,
        formedOn: (ins.firstSeen || TODAY).slice(0, 10),          // as-of, §4c.1; the draft may re-declare with a why
        firstSeen: ins.firstSeen, lastSeen: ins.lastSeen,
        scans: 1, outlets: outlets.size, peakOutlets: outlets.size,
        status: 'new',                                            // new | queued | drafted | promoted | dismissed | watch
        permanence: { silentDays: 0, breaks: [], returns: [] },
        inversions: [],                                           // filled by the drafting pass: {station, from, to, on, evidence}
        drafts: {}, live: null,
        articles: top, aliases: [],
      };
      reg.objects.push(o); events.new.push(o);
    } else {
      const wasSilent = o.permanence.silentDays >= SILENT_DAYS;
      if (o.headline !== ins.headline && !o.aliases.includes(ins.headline)) o.aliases.push(ins.headline);
      o.tokens = [...new Set([...(o.tokens || []), ...toks])].slice(0, 24);
      o.lastSeen = ins.lastSeen || o.lastSeen;
      o.scans += 1; o.outlets = outlets.size; o.peakOutlets = Math.max(o.peakOutlets || 0, outlets.size);
      if (!o.holder && ins.holder) o.holder = ins.holder;
      // keep the freshest coverage, dedup by url
      const have = new Set(o.articles.map(a => a.url));
      top.forEach(a => { if (!have.has(a.url)) o.articles.unshift(a); });
      o.articles = o.articles.slice(0, 12);
      if (wasSilent) { o.permanence.returns.push({ on: TODAY, after: o.permanence.silentDays }); events.returned.push(o); }
      o.permanence.silentDays = 0;
      events.updated.push(o);
    }
    seenToday.add(o.oid);
  });
  // permanence: everything not seen today ages; a watched/unresolved object that goes silent is a break
  reg.objects.forEach(o => {
    if (seenToday.has(o.oid)) return;
    o.permanence.silentDays = o.lastSeen ? Math.max(0, daysBetween(o.lastSeen.slice(0, 10), TODAY)) : o.permanence.silentDays + 1;
    const unresolved = !['promoted', 'dismissed'].includes(o.status);
    const lastBreak = o.permanence.breaks[o.permanence.breaks.length - 1];
    if (unresolved && o.scans >= 2 && o.permanence.silentDays === SILENT_DAYS && !(lastBreak && lastBreak.on === TODAY)) {
      o.permanence.breaks.push({ on: TODAY, afterScans: o.scans, peakOutlets: o.peakOutlets });
    }
  });
  return events;
}

// ── 5. The day's queue ────────────────────────────────────────────────
function queueDay(reg) {
  // The scan now runs several times a day (it rides the 3-hourly workflow),
  // so the quota is per DAY: top up to DAILY_QUOTA counting what's already
  // queued or drafted today.
  const already = reg.objects.filter(o => o.queuedOn === TODAY).length;
  const room = Math.max(0, DAILY_QUOTA - already);
  const fresh = reg.objects.filter(o => o.status === 'new' && o.holder && o.kind !== 'hearing');
  fresh.sort((a, b) => (b.peakOutlets - a.peakOutlets) || (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  const picked = fresh.slice(0, room);
  picked.forEach(o => { o.status = 'queued'; o.queuedOn = TODAY; });
  // anything 'new' that didn't make the cut watches for a second scan
  fresh.slice(room).forEach(o => { o.status = 'watch'; });
  return picked;
}

// ── 6. Digest ─────────────────────────────────────────────────────────
function digest(reg, ev, queued) {
  const L = [];
  const line = o => `- **${o.headline}** — ${o.kind} · ${o.verb} · holder: ${o.holder || '?'} · formed ${o.formedOn} · ${o.outlets} outlets (peak ${o.peakOutlets}) · \`${o.oid}\``;
  L.push(`# Newsroom digest — ${TODAY}`, '', `Register: ${reg.objects.length} objects · this scan: ${ev.new.length} new, ${ev.updated.length} seen again, ${ev.returned.length} returned.`, '');
  L.push(`## Queued for drafting (${queued.length})`, ...(queued.length ? queued.map(line) : ['- (nothing cleared the bar)']), '');
  const breaks = reg.objects.filter(o => o.permanence.breaks.some(b => b.on === TODAY));
  L.push(`## Permanence breaks (went silent while unresolved)`, ...(breaks.length ? breaks.map(o => line(o) + ` · silent ${o.permanence.silentDays}d after ${o.scans} scans`) : ['- none today']), '');
  L.push(`## Returned after a break`, ...(ev.returned.length ? ev.returned.map(line) : ['- none today']), '');
  L.push(`## New objects (all)`, ...(ev.new.length ? ev.new.map(line) : ['- none']), '');
  const watching = reg.objects.filter(o => o.status === 'watch');
  L.push(`## Watching (${watching.length})`, ...watching.slice(0, 15).map(line), '');
  return L.join('\n');
}

// ── Run ───────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(NR_DIR, { recursive: true });
  const reg = loadRegister();
  let articles = [];
  if (FIXTURE) {
    articles = fixtureArticles();
    console.log(`fixture: ${articles.length} articles from ${FIXTURE}`);
  } else {
    try { fs.unlinkSync(path.join(NR_DIR, 'scan-debug.txt')); } catch (e) {}
    for (const q of QUERIES) {
      const got = await fetchArticles(q);
      console.log(`  ${got.length} articles · ${q.slice(0, 70)}…`);
      articles.push(...got);
      await new Promise(r => setTimeout(r, 2500));
    }
    if (!articles.length) {
      console.warn('  ⚠ every instrument query came back empty — falling back to the broad query');
      const got = await fetchArticles(FALLBACK_QUERY);
      console.log(`  ${got.length} articles · fallback`);
      articles.push(...got);
    }
    articles = articles.filter(a => (a.language || 'English') === 'English' && (!a.sourcecountry || a.sourcecountry === 'United States'));
  }
  // dedup by url, then exact title+domain
  const seen = new Set();
  articles = articles.filter(a => { const k = a.url || (a.title + '|' + a.domain); if (seen.has(k)) return false; seen.add(k); return true; });
  const clusters = cluster(articles);
  const ev = mergeScan(reg, clusters);
  const queued = queueDay(reg);
  reg.scans.push({ on: TODAY, at: new Date().toISOString(), articles: articles.length, clusters: clusters.length, new: ev.new.length, queued: queued.map(o => o.oid), fixture: !!FIXTURE });
  reg.scans = reg.scans.slice(-60);
  reg.updatedAt = new Date().toISOString();
  fs.writeFileSync(REGISTER, JSON.stringify(reg, null, 1));
  const md = digest(reg, ev, queued);
  fs.writeFileSync(path.join(NR_DIR, `digest-${TODAY}.md`), md);
  fs.writeFileSync(path.join(NR_DIR, 'digest-latest.md'), md);
  console.log(`\n${articles.length} articles → ${clusters.length} clusters → register ${reg.objects.length} objects (${ev.new.length} new, ${queued.length} queued)`);
  queued.forEach(o => console.log(`  queued: ${o.headline}  [${o.kind} · ${o.holder} · ${o.formedOn}]`));
})().catch(e => { console.error(e); process.exit(1); });
