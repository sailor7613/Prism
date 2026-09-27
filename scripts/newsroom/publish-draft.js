#!/usr/bin/env node
/**
 * publish-draft.js — auto-publish a clean Claude draft (2026-09-26).
 *
 * Sailor's beta direction: the daily Claude drafts publish themselves. This
 * files a draft from data/readings/drafts/claude/<rid>.json straight into the
 * published tier (data/readings/<rid>.json) through GitHub's contents API —
 * NO local git (git in the Cowork shell strands lock files) — and records the
 * publish on the local drafting overlay (data/newsroom/objects.local.json).
 * The push lands a commit on main, which fires the seed bake and the
 * new-Reading notification (.github/workflows/notify-reading.yml).
 *
 *   node scripts/newsroom/publish-draft.js <rid> [--dry]
 *
 * Needs GITHUB_PUBLISH_TOKEN in scripts/secrets.local.js (gitignored) — set it
 * with "Set Publish Token.command". A fine-grained token, sailor7613/Prism,
 * Contents: Read and write.
 *
 * Refuses unless: the checker reports "All clean"; the kill switch
 * (data/newsroom/autopublish.json → enabled) is on; the draft isn't already
 * published. Never overwrites a published Reading that Sailor has touched
 * (authorTier !== 'claude' on the remote copy).
 */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');                 // Prism/
const OWNER = 'sailor7613', REPO = 'Prism', BRANCH = 'main';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const rid = args.find(a => /^rdg_[a-z0-9]{8,}$/.test(a));
function die(msg, code) { console.error('✗ ' + msg); process.exit(code || 1); }
if (!rid) die('usage: node scripts/newsroom/publish-draft.js <rid> [--dry]');

// ── gates ──
let sw = { enabled: true };
try { sw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/newsroom/autopublish.json'), 'utf8')); } catch (e) {}
if (!sw.enabled) die('auto-publish is switched off (data/newsroom/autopublish.json)', 3);

const draftPath = path.join(ROOT, 'data/readings/drafts/claude', rid + '.json');
if (!fs.existsSync(draftPath)) die('no draft at ' + path.relative(ROOT, draftPath));
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
if ((draft.authorTier || 'claude') !== 'claude') die('not a Claude draft — Sailor publishes his own');

const checker = path.resolve(ROOT, '..', 'Parameters/00_Architecture/formula_check.js');
let out = '';
try { out = execFileSync('node', [checker, draftPath], { encoding: 'utf8' }); } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
if (!/All clean\./.test(out)) die('checker is not clean — not publishing\n' + out.split('\n').slice(-12).join('\n'), 4);

let TOKEN = process.env.GITHUB_PUBLISH_TOKEN;
if (!TOKEN) { try { TOKEN = require(path.join(ROOT, 'scripts/secrets.local.js')).GITHUB_PUBLISH_TOKEN; } catch (e) {} }
if (!TOKEN && !DRY) die('no GITHUB_PUBLISH_TOKEN — run "Set Publish Token.command" once', 5);

// ── GitHub contents API ──
// Through curl, not Node's https: curl honours the shell's proxy settings
// (the Cowork shells reach GitHub only through a proxy), Node 22 does not.
// The token rides a header file readable only by this process, never argv.
const os = require('os');
function api(method, p, body) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}` + (method === 'GET' ? `?ref=${BRANCH}` : '');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-pub-'));
  const hdr = path.join(tmp, 'h'); const dat = path.join(tmp, 'd');
  fs.writeFileSync(hdr, ['User-Agent: prism-publish', 'Accept: application/vnd.github+json', 'X-GitHub-Api-Version: 2022-11-28',
    ...(TOKEN ? ['Authorization: Bearer ' + TOKEN] : []), ...(body ? ['Content-Type: application/json'] : [])].join('\n'), { mode: 0o600 });
  const a = ['-s', '-m', '60', '-X', method, '-H', '@' + hdr, '-w', '\n%{http_code}', url];
  if (body) { fs.writeFileSync(dat, JSON.stringify(body), { mode: 0o600 }); a.push('--data-binary', '@' + dat); }
  let raw = '';
  try { raw = execFileSync('curl', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
  const k = raw.lastIndexOf('\n'); const status = parseInt(raw.slice(k + 1), 10) || 0;
  let json = null; try { json = JSON.parse(raw.slice(0, k)); } catch (e) {}
  return Promise.resolve({ status, json });
}
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const unb64 = s => Buffer.from(String(s || '').replace(/\n/g, ''), 'base64').toString('utf8');

(async () => {
  const target = `data/readings/${rid}.json`;
  const cur = await api('GET', target);
  let sha = null;
  if (cur.status === 200) {
    sha = cur.json.sha;
    let remote = null; try { remote = JSON.parse(unb64(cur.json.content)); } catch (e) {}
    if (remote && remote.authorTier && remote.authorTier !== 'claude') die('the published copy is Sailor\'s now — leaving it alone', 6);
  } else if (cur.status !== 404) die('GitHub read failed (' + cur.status + ')' + (cur.status === 401 ? ' — the publish token is wrong or expired' : ''));

  const now = new Date().toISOString();
  const file = JSON.parse(JSON.stringify(draft));
  file.schema = 'reading/v1';
  file.meta = Object.assign({}, file.meta, { status: 'published', autoPublished: { on: now, by: 'publish-draft.js (newsroom)' } });
  file.updatedAt = now;
  if (DRY) { console.log('DRY RUN · would publish', target, sha ? '(update)' : '(new)', '·', file.title); return; }

  const put = await api('PUT', target, { message: 'Reading (auto): ' + (file.title || rid), content: b64(JSON.stringify(file, null, 2)), branch: BRANCH, ...(sha ? { sha } : {}) });
  if (put.status !== 200 && put.status !== 201) die('publish failed (' + put.status + ')' + (put.status === 401 || put.status === 403 ? ' — token lacks Contents: write on sailor7613/Prism' : ''));
  console.log('✓ published', target, '·', file.title);

  // overlay: mark the object promoted in the LOCAL overlay only. Writing the
  // remote copy too would make Sailor's next pull conflict with his tracked
  // local file (the 09-25 collision); the local edit rides his next commit.
  const oid = file.newsroom && file.newsroom.oid;
  if (oid) {
    const ovPath = path.join(ROOT, 'data/newsroom/objects.local.json');
    let ov = { schema: 'prism_object_overlay_v1', objects: {} };
    try { ov = JSON.parse(fs.readFileSync(ovPath, 'utf8')); } catch (e) {}
    ov.objects = ov.objects || {};
    const e = ov.objects[oid] = Object.assign({}, ov.objects[oid]);
    e.status = 'promoted'; e.drafts = Object.assign({}, e.drafts, { claude: rid }); e.publishedOn = now.slice(0, 10);
    ov.updatedAt = now;
    fs.writeFileSync(ovPath, JSON.stringify(ov, null, 1));
    console.log('✓ overlay:', oid, '→ promoted (local; rides the next commit)');
  }
  // local housekeeping: the draft moves aside (gitignored) so a later commit
  // can't re-add it as a draft beside its published self
  const doneDir = path.join(ROOT, 'data/readings/drafts/claude/_published');
  fs.mkdirSync(doneDir, { recursive: true });
  fs.renameSync(draftPath, path.join(doneDir, rid + '.json'));
})().catch(e => die(e.message));
