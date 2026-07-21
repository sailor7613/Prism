/**
 * bake-images.js — pipeline-side image bake (Event Engine, photographs).
 * (Ruled 2026-07-19, Photo Grammar Integration: browser bake-at-publish
 * can only rescue CORS-open sources — fetch() hits the same wall the
 * canvas does. Node has no CORS. This is the stronger path, sized for
 * its own session; the browser bake stays as the in-surface fallback.)
 *
 * Runs in the WORKING TREE on Sailor's machine (Scan News Cycle step 4,
 * or standalone). No PAT, no GitHub API — it writes files and rewrites
 * JSON; the commit rides GitHub Desktop like everything else.
 *
 * Two sweeps, independent (one failing never blocks the other):
 *
 *  1. READING RESCUE — data/readings/rdg_*.json: any images[] entry
 *     without `baked` (or whose baked file is missing from disk) is
 *     fetched and written to data/readings/images/<rid>/<urlhash>.<ext>.
 *     Same djb2 hash + extension rules as prism-sync.js bakeImages, so
 *     the two paths land identical filenames and never duplicate.
 *     Devices pick the updated JSON up on normal pull.
 *
 *  2. HELD-CANDIDATE BAKE — data/candidates.js news candidates whose
 *     triage status is held/promoted (status re-read fresh from
 *     data/candidate_scores.json — the committed middle stratum — since
 *     the surface may have triaged after the last scan): the promote-
 *     lift pool (articles with an image, first 6 — exactly the set the
 *     surface lifts) is baked to data/news/images/<cid>/<urlhash>.<ext>
 *     and each article entry gains `imageBaked`. The surface prefers it
 *     and promote carries it onto the Reading, so photographs are
 *     durable from story-hold time, before any publish. `new` and
 *     `dismissed` candidates are NEVER baked — a full scan is 15
 *     clusters × 12 articles of churn the repo doesn't want.
 *
 *  PRUNE — a data/news/images/<cid>/ dir whose candidate has rotated
 *  out (or fallen back to new/dismissed) is deleted, UNLESS any file in
 *  it is referenced by a Reading's baked path (a published Reading may
 *  point into the news tree via the promote-lift carry). Reading images
 *  (data/readings/images/) are never pruned — Readings are sovereign.
 *
 * Failures decay gracefully, per the publish-never-blocks precedent:
 * an image that won't fetch stays hotlinked and is reported, exit 0.
 *
 * Usage:
 *   node scripts/bake-images.js            # both sweeps + prune
 *   DRY=1 node scripts/bake-images.js      # report only, write nothing
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const READINGS_DIR = path.join(DATA_DIR, 'readings');
const READING_IMG_DIR = 'data/readings/images';   // repo-relative, mirrors prism-sync IMG_DIR
const NEWS_IMG_DIR = 'data/news/images';
const CANDIDATES_FILE = path.join(DATA_DIR, 'candidates.js');
const SCORES_FILE = path.join(DATA_DIR, 'candidate_scores.json');

const DRY = !!process.env.DRY;
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '15000', 10);
const MAX_BYTES = parseInt(process.env.MAX_BYTES || String(10 * 1024 * 1024), 10);
const LIFT_POOL = 6;   // must match the surface's promote lift slice(0,6)

// ── identical to prism-sync.js (same URL → same filename, both paths) ──
function urlHash(u) {
  let h = 5381;
  for (let i = 0; i < u.length; i++) h = ((h << 5) + h + u.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
function extFromType(t) {
  t = (t || '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('avif')) return 'avif';
  return 'jpg';
}

// ── fetch (redirects followed, size-capped, image/* enforced) ─────────
function fetchImage(url, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('too many redirects'));
    let mod;
    try { mod = url.startsWith('https:') ? https : url.startsWith('http:') ? http : null; }
    catch (_) { mod = null; }
    if (!mod) return reject(new Error('unsupported url'));
    const req = mod.get(url, { headers: { 'user-agent': 'prism-event-engine/1.0 (image bake)' } }, res => {
      const sc = res.statusCode || 0;
      if (sc >= 300 && sc < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return resolve(fetchImage(next, depth + 1));
      }
      if (sc !== 200) { res.resume(); return reject(new Error('http ' + sc)); }
      const type = res.headers['content-type'] || '';
      // mirror prism-sync: reject only a PRESENT non-image type
      if (type && !type.toLowerCase().startsWith('image/')) {
        res.resume(); return reject(new Error('not an image (' + type.split(';')[0] + ')'));
      }
      const chunks = []; let size = 0;
      res.on('data', d => {
        size += d.length;
        if (size > MAX_BYTES) { req.destroy(new Error('over size cap')); return; }
        chunks.push(d);
      });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (!buf.length) return reject(new Error('empty body'));
        resolve({ buf, type });
      });
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// bake one URL to <destRelDir>/<hash>.<ext>; returns repo-relative path.
// Skips the network entirely when the file already exists (idempotent).
async function bake(url, destRelDir) {
  const hash = urlHash(url);
  const absDir = path.join(ROOT, destRelDir);
  if (fs.existsSync(absDir)) {
    const hit = fs.readdirSync(absDir).find(f => f.startsWith(hash + '.'));
    if (hit) return destRelDir + '/' + hit;
  }
  const { buf, type } = await fetchImage(url);
  const rel = destRelDir + '/' + hash + '.' + extFromType(type);
  if (!DRY) {
    fs.mkdirSync(absDir, { recursive: true });
    fs.writeFileSync(path.join(ROOT, rel), buf);
  }
  return rel;
}

// ── sweep 1: reading rescue ───────────────────────────────────────────
async function sweepReadings(report) {
  if (!fs.existsSync(READINGS_DIR)) return;
  const files = fs.readdirSync(READINGS_DIR).filter(f => /^rdg_.*\.json$/.test(f));
  for (const f of files) {
    const abs = path.join(READINGS_DIR, f);
    let ev;
    try { ev = JSON.parse(fs.readFileSync(abs, 'utf8')); }
    catch (e) { report.errors.push(`${f}: unparseable (${e.message})`); continue; }
    if (!Array.isArray(ev.images) || !ev.images.length) continue;
    const rid = ev.rid || f.replace(/\.json$/, '');
    let changed = false;
    for (const p of ev.images) {
      if (!p || !p.url) continue;
      if (p.baked && fs.existsSync(path.join(ROOT, p.baked))) { report.already++; continue; }
      try {
        const had = p.baked;
        p.baked = await bake(p.url, READING_IMG_DIR + '/' + rid);
        changed = changed || p.baked !== had || !had;
        report.baked.push(`${rid} ← ${p.url}`);
      } catch (e) {
        report.hotlinked.push(`${rid} · ${p.url} (${e.message})`);
      }
    }
    if (changed && !DRY) {
      // preserve the file's own formatting habit (browser PUTs carry no
      // trailing newline; hand-touched files may)
      const hadNl = /\n$/.test(fs.readFileSync(abs, 'utf8'));
      fs.writeFileSync(abs, JSON.stringify(ev, null, 2) + (hadNl ? '\n' : ''));
      report.rewritten.push('data/readings/' + f);
    }
  }
}

// ── sweep 2: held-candidate bake ──────────────────────────────────────
function readCandidates() {
  if (!fs.existsSync(CANDIDATES_FILE)) return null;
  const src = fs.readFileSync(CANDIDATES_FILE, 'utf8');
  const eq = src.indexOf('window.PRISM_CANDIDATES');
  const start = src.indexOf('[', eq);
  const end = src.lastIndexOf(']');
  if (eq < 0 || start < 0 || end < 0) throw new Error('candidates.js unparseable — regenerate via fetch-activity.js');
  return { header: src.slice(0, start), candidates: JSON.parse(src.slice(start, end + 1)), tail: src.slice(end + 1) };
}

function freshStatus(c, scores) {
  const r = scores && scores[c.cid];
  return (r && r.status != null) ? r.status : c.status;
}

async function sweepCandidates(report) {
  let parsed;
  try { parsed = readCandidates(); }
  catch (e) { report.errors.push('candidates.js: ' + e.message); return { bakedByCid: {} }; }
  if (!parsed) return { bakedByCid: {} };

  let scores = null;
  try {
    const j = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    if (j && j.schema === 'candidate_scores/v1' && j.records) scores = j.records;
  } catch (_) { /* stratum not pushed yet — candidates.js status stands */ }

  const bakedByCid = {};   // cid → Set of live repo-relative baked paths
  let changed = false;
  for (const c of parsed.candidates) {
    if (c.source !== 'news' || !c.raw || !Array.isArray(c.raw.articles)) continue;
    const status = freshStatus(c, scores);
    if (status !== 'held' && status !== 'promoted') continue;
    const pool = c.raw.articles.filter(a => a && a.image).slice(0, LIFT_POOL);
    for (const a of pool) {
      if (a.imageBaked && fs.existsSync(path.join(ROOT, a.imageBaked))) {
        (bakedByCid[c.cid] = bakedByCid[c.cid] || new Set()).add(a.imageBaked);
        report.already++; continue;
      }
      try {
        a.imageBaked = await bake(a.image, NEWS_IMG_DIR + '/' + c.cid);
        (bakedByCid[c.cid] = bakedByCid[c.cid] || new Set()).add(a.imageBaked);
        changed = true;
        report.baked.push(`${c.cid} ← ${a.image}`);
      } catch (e) {
        report.hotlinked.push(`${c.cid} · ${a.image} (${e.message})`);
      }
    }
  }
  if (changed && !DRY) {
    fs.writeFileSync(CANDIDATES_FILE,
      parsed.header + JSON.stringify(parsed.candidates, null, 2) + parsed.tail);
    report.rewritten.push('data/candidates.js');
  }
  return { bakedByCid, candidates: parsed.candidates, scores };
}

// ── prune (news tree only; reading-referenced files are kept) ─────────
function readingReferencedPaths() {
  const refs = new Set();
  if (!fs.existsSync(READINGS_DIR)) return refs;
  for (const f of fs.readdirSync(READINGS_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const ev = JSON.parse(fs.readFileSync(path.join(READINGS_DIR, f), 'utf8'));
      (ev.images || []).forEach(p => { if (p && p.baked) refs.add(p.baked); });
    } catch (_) { /* unparseable already reported by sweep 1 */ }
  }
  return refs;
}

function prune(sweep, report) {
  const newsAbs = path.join(ROOT, NEWS_IMG_DIR);
  if (!fs.existsSync(newsAbs)) return;
  const refs = readingReferencedPaths();
  for (const cid of fs.readdirSync(newsAbs)) {
    const dirAbs = path.join(newsAbs, cid);
    if (!fs.statSync(dirAbs).isDirectory()) continue;
    const live = sweep.bakedByCid[cid] || new Set();
    for (const file of fs.readdirSync(dirAbs)) {
      const rel = NEWS_IMG_DIR + '/' + cid + '/' + file;
      if (live.has(rel)) continue;                       // current pool
      if (refs.has(rel)) { report.kept.push(rel + ' (reading-referenced)'); continue; }
      if (!DRY) fs.unlinkSync(path.join(dirAbs, file));
      report.pruned.push(rel);
    }
    if (!DRY && fs.existsSync(dirAbs) && !fs.readdirSync(dirAbs).length) fs.rmdirSync(dirAbs);
  }
}

// ── main ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`Image bake${DRY ? ' (DRY RUN — nothing written)' : ''} · working tree: ${ROOT}`);
  const report = { baked: [], hotlinked: [], already: 0, rewritten: [], pruned: [], kept: [], errors: [] };

  await sweepReadings(report);
  const sweep = await sweepCandidates(report);
  prune(sweep, report);

  console.log(`\n  baked ${report.baked.length} · already in repo ${report.already} · hotlinked (decay) ${report.hotlinked.length} · pruned ${report.pruned.length}`);
  report.baked.forEach(l => console.log('  ✓ ' + l));
  report.hotlinked.forEach(l => console.log('  ⚠ ' + l));
  report.kept.forEach(l => console.log('  ○ kept ' + l));
  report.pruned.forEach(l => console.log('  ✕ pruned ' + l));
  report.rewritten.forEach(l => console.log('  ↻ rewrote ' + l));
  report.errors.forEach(l => console.log('  ✗ ' + l));
  if (!report.baked.length && !report.hotlinked.length && !report.pruned.length && !report.errors.length)
    console.log('  nothing to do — every held photograph is already in the repo.');
}

if (require.main === module) {
  main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}

module.exports = { urlHash, extFromType, bake, LIFT_POOL };
