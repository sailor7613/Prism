// Runs the real Worker against a fake GitHub contents API and a fake
// Anthropic messages API. No Cloudflare account, no network, no real repo
// touched — but the code under test is src/index.js exactly as deployed.
import worker from '../src/index.js';

const ORIGIN = 'https://sailor7613.github.io';
const TOKEN = 'ghp_FAKE_TOKEN_FOR_TESTS_00000000000000';
const AI_KEY = 'sk-ant-FAKE_KEY_FOR_TESTS_000000000000';
const DESK = 'the-medium-rule-77';

// ── the fakes ──
let repo, ghCalls, aiCalls, lastAiBody, lastAiHeaders;
function resetWorld() { repo = new Map(); ghCalls = []; aiCalls = []; lastAiBody = null; lastAiHeaders = null; }
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    aiCalls.push(u);
    lastAiBody = JSON.parse(opts.body);
    lastAiHeaders = opts.headers || {};
    if (lastAiHeaders['x-api-key'] !== AI_KEY) {
      return new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 });
    }
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'ok from the wire' }],
      stop_reason: 'end_turn',
    }), { status: 200 });
  }
  ghCalls.push({ url: u, method: opts.method || 'GET', auth: (opts.headers || {}).Authorization });
  const m = u.match(/contents\/(.+?)(\?|$)/);
  const path = decodeURIComponent(m[1]);
  const method = opts.method || 'GET';
  if (method === 'GET') {
    if (!repo.has(path)) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    const f = repo.get(path);
    return new Response(JSON.stringify({ content: b64(f.body), sha: f.sha }), { status: 200 });
  }
  if (method === 'DELETE') {
    const body = JSON.parse(opts.body);
    if (!repo.has(path)) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    if (repo.get(path).sha !== body.sha) return new Response(JSON.stringify({ message: 'conflict' }), { status: 409 });
    repo.delete(path);
    return new Response(JSON.stringify({ commit: {} }), { status: 200 });
  }
  const body = JSON.parse(opts.body);
  const existing = repo.get(path);
  if (existing && !body.sha) return new Response(JSON.stringify({ message: 'sha missing' }), { status: 422 });
  if (existing && body.sha !== existing.sha) return new Response(JSON.stringify({ message: 'conflict' }), { status: 409 });
  const sha = 'sha-' + Math.random().toString(36).slice(2);
  repo.set(path, { body: Buffer.from(body.content, 'base64').toString('utf8'), sha });
  return new Response(JSON.stringify({ content: { sha }, commit: {} }), { status: 200 });
};

// A KV stand-in. `writes` counted so tests can prove the budget an attacker
// burns is bounded rather than unbounded.
function makeKV({ broken } = {}) {
  const m = new Map();
  const kv = {
    writes: 0,
    async get(k) { if (broken) throw new Error('kv down'); return m.has(k) ? m.get(k) : null; },
    async put(k, v) { if (broken) throw new Error('kv down'); kv.writes++; m.set(k, v); },
    _map: m,
  };
  return kv;
}

const ENV = () => ({ GITHUB_TOKEN: TOKEN, ANTHROPIC_KEY: AI_KEY, DESK_KEY: DESK });

// every response body ever produced, for THE ONE RULE check at the end
const allBodies = [];
async function call(route, body, { env = ENV(), origin = ORIGIN, ip = '10.0.0.1', method = 'POST' } = {}) {
  const res = await worker.fetch(new Request('https://prism-gate.workers.dev' + route, {
    method,
    headers: { Origin: origin, 'CF-Connecting-IP': ip, 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  }), env);
  const text = await res.text();
  allBodies.push(text);
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json, text, headers: res.headers };
}

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ ' + name); }
}

const goodPut = (path = 'data/readings/rid_test.json', extra = {}) => ({
  code: DESK, op: 'put', path,
  content: b64(JSON.stringify({ schema: 'reading/v1' })),
  message: 'Reading: test', ...extra,
});

// ═══ the door ═══
resetWorld();
{
  const r = await call('/file', goodPut(), { method: 'GET' });
  ok(r.status === 405, 'GET refused 405');
}
{
  const r = await call('/file', goodPut(), { origin: 'https://evil.example' });
  ok(r.status === 403, 'foreign origin refused');
  ok(ghCalls.length === 0, 'foreign origin never reaches GitHub');
}
{
  const r = await call('/file', goodPut('data/readings/x.json', { code: 'wrong' }));
  ok(r.status === 401, 'wrong key 401');
  ok(r.json.error === 'the desk does not know this key', 'wrong key gets the one line');
  const v = await call('/verify', { code: 'wrong' });
  ok(v.status === 401 && v.json.error === r.json.error, '/verify shares the identical line — no cheaper oracle');
  const empty = await call('/verify', { code: '' });
  ok(empty.status === 401 && empty.json.error === r.json.error, 'absent key indistinguishable from wrong');
  ok(ghCalls.length === 0, 'no GitHub call without the key');
}
{
  const v = await call('/verify', { code: DESK });
  ok(v.status === 200 && v.json.ok === true, '/verify says yes to the desk key');
  const trimmed = await call('/verify', { code: '  ' + DESK + '\n' });
  ok(trimmed.status === 200, 'whitespace around the key is forgiven');
}

// ═══ the guessing limit — before the key check, bounded writes ═══
resetWorld();
{
  const env = ENV(); env.RATE = makeKV();
  for (let i = 0; i < 12; i++) await call('/verify', { code: 'guess-' + i }, { env, ip: '6.6.6.6' });
  const writesAfterFails = env.RATE.writes;
  const r = await call('/verify', { code: DESK }, { env, ip: '6.6.6.6' });
  ok(r.status === 429, 'address over limit is refused BEFORE the key check — even with the right key');
  const r2 = await call('/verify', { code: 'guess-13' }, { env, ip: '6.6.6.6' });
  ok(r2.status === 429, 'no further guesses answered');
  ok(env.RATE.writes === writesAfterFails, 'refusals over the limit cost zero KV writes — attacker budget bounded');
  const other = await call('/verify', { code: DESK }, { env, ip: '7.7.7.7' });
  ok(other.status === 200, 'a different address keeps normal service');
}

// ═══ /file put — the happy path ═══
resetWorld();
{
  const r = await call('/file', goodPut());
  ok(r.status === 200 && r.json.ok === true, 'put lands');
  ok(typeof r.json.sha === 'string' && r.json.sha.startsWith('sha-'), 'new sha comes back');
  ok(repo.has('data/readings/rid_test.json'), 'the file exists in the repo');
  ok(ghCalls.every(c => c.auth === `Bearer ${TOKEN}`), 'the SERVER token signs the GitHub call');
}
{
  // update with the sha; conflict without the right one
  const cur = repo.get('data/readings/rid_test.json');
  const upd = await call('/file', goodPut('data/readings/rid_test.json', { sha: cur.sha }));
  ok(upd.status === 200, 'update with sha lands');
  const stale = await call('/file', goodPut('data/readings/rid_test.json', { sha: 'sha-stale' }));
  ok(stale.status === 409, 'stale sha passes 409 through — the client conflict flow survives');
  const noSha = await call('/file', goodPut('data/readings/rid_test.json'));
  ok(noSha.status === 422, 'existing-file-no-sha passes 422 through — bake\'s already-baked case survives');
}

// ═══ /file — the drawer's edges ═══
resetWorld();
{
  const refused = [
    'index.html',
    'admin-surface.html',
    'data/../index.html',
    'data/readings/../../admin.html',
    '.github/workflows/evil.yml',
    'feed/entry.json',
    'data/evil.js',
    'data/readings/x.html',
    'data/.hidden/x.json',
    'data/readings/',
    '../data/x.json',
    'data//x.json',
  ];
  for (const p of refused) {
    const r = await call('/file', goodPut(p));
    ok(r.status === 403, `refused: ${p}`);
  }
  ok(ghCalls.length === 0, 'refused paths never reach GitHub');
  const img = await call('/file', goodPut('data/readings/images/rid_x/ab12.jpg'));
  ok(img.status === 200, 'a baked image path is allowed');
  const scores = await call('/file', goodPut('data/candidate_scores.json'));
  ok(scores.status === 200, 'the committed middle stratum is allowed');
}
{
  const noContent = await call('/file', { code: DESK, op: 'put', path: 'data/x.json' });
  ok(noContent.status === 400, 'nothing to file → 400');
  const notB64 = await call('/file', goodPut('data/x.json', { content: 'not*base64!' }));
  ok(notB64.status === 400, 'non-base64 content → 400');
  const huge = await call('/file', goodPut('data/x.json', { content: 'A'.repeat(12 * 1024 * 1024 + 1) }));
  ok(huge.status === 413, 'over the carry limit → 413');
  const badOp = await call('/file', { code: DESK, op: 'list', path: 'data/x.json' });
  ok(badOp.status === 400, 'unknown op → 400');
}

// ═══ /file del ═══
resetWorld();
{
  await call('/file', goodPut('data/readings/drafts/rid_d.json'));
  const sha = repo.get('data/readings/drafts/rid_d.json').sha;
  const noSha = await call('/file', { code: DESK, op: 'del', path: 'data/readings/drafts/rid_d.json' });
  ok(noSha.status === 400, 'unfiling without sha → 400');
  const del = await call('/file', { code: DESK, op: 'del', path: 'data/readings/drafts/rid_d.json', sha });
  ok(del.status === 200 && !repo.has('data/readings/drafts/rid_d.json'), 'del removes the file');
  const again = await call('/file', { code: DESK, op: 'del', path: 'data/readings/drafts/rid_d.json', sha });
  ok(again.status === 404, 'deleting the deleted → 404 (client treats as already gone)');
  const outside = await call('/file', { code: DESK, op: 'del', path: 'index.html', sha: 'x' });
  ok(outside.status === 403, 'del is path-restricted too');
}

// ═══ /ai — the relay ═══
resetWorld();
{
  const r = await call('/ai', {
    code: DESK,
    body: {
      model: 'claude-sonnet-5', max_tokens: 1600,
      thinking: { type: 'adaptive' }, output_config: { effort: 'low' },
      system: 'sys', messages: [{ role: 'user', content: 'hi' }],
      metadata: { user_id: 'evil' }, tools: [{ name: 'evil' }],
    },
  });
  ok(r.status === 200, 'ai relay returns Anthropic\'s 200');
  ok(r.json.content[0].text === 'ok from the wire', 'Anthropic body passes through verbatim');
  ok(lastAiHeaders['x-api-key'] === AI_KEY, 'the SERVER key signs the wire call');
  ok(!('anthropic-dangerous-direct-browser-access' in lastAiHeaders), 'the browser-access escape hatch is gone');
  ok(lastAiBody.model === 'claude-sonnet-5' && lastAiBody.system === 'sys', 'allowlisted fields forwarded');
  ok(!('metadata' in lastAiBody) && !('tools' in lastAiBody), 'unknown fields are NOT forwarded — allowlist, not passthrough');
}
{
  const capped = await call('/ai', { code: DESK, body: { model: 'm', max_tokens: 999999, messages: [{ role: 'user', content: 'x' }] } });
  ok(capped.status === 200 && lastAiBody.max_tokens === 32000, 'max_tokens capped at the ceiling');
  const empty = await call('/ai', { code: DESK, body: { model: 'm' } });
  ok(empty.status === 400, 'no messages → 400, never reaches the wire');
  const wrongKey = await call('/ai', { code: 'nope', body: { messages: [{ role: 'user', content: 'x' }] } });
  ok(wrongKey.status === 401, 'ai behind the same door');
}
{
  // daily ceiling, and its shape: PrismAI reads error.message
  const env = ENV(); env.RATE = makeKV();
  env.RATE._map.set('ai:' + new Date().toISOString().slice(0, 10), '500');
  const r = await call('/ai', { code: DESK, body: { messages: [{ role: 'user', content: 'x' }] } }, { env });
  ok(r.status === 429 && r.json.error && typeof r.json.error.message === 'string',
    'ai daily ceiling refuses in the {error:{message}} shape PrismAI reads');
}

// ═══ write ceiling + KV as speed bump, never boundary ═══
resetWorld();
{
  const env = ENV(); env.RATE = makeKV();
  env.RATE._map.set('write:' + new Date().toISOString().slice(0, 10), '2000');
  const r = await call('/file', goodPut(), { env });
  ok(r.status === 429, 'write ceiling refuses');
}
{
  const env = ENV(); env.RATE = makeKV({ broken: true });
  const r = await call('/file', goodPut('data/readings/kv_down.json'), { env });
  ok(r.status === 200, 'a KV that throws on every call cannot break the lock — valid write still lands');
  const bad = await call('/file', goodPut('data/readings/kv2.json', { code: 'wrong' }), { env });
  ok(bad.status === 401, '…and an invalid key still bounces');
}

// ═══ misconfiguration is the desk's problem, not the caller's ═══
resetWorld();
{
  const env = ENV(); delete env.GITHUB_TOKEN;
  const r = await call('/file', goodPut(), { env });
  ok(r.status === 500 && !/token/i.test(JSON.stringify(r.json)), 'missing shelf key: 500, no credential named');
  const env2 = ENV(); delete env2.ANTHROPIC_KEY;
  const r2 = await call('/ai', { code: DESK, body: { messages: [{ role: 'user', content: 'x' }] } }, { env: env2 });
  ok(r2.status === 500, 'missing wire key: 500');
}

// ═══ THE ONE RULE — across every response this suite produced ═══
{
  const everything = allBodies.join('\n');
  ok(!everything.includes(TOKEN), 'GITHUB_TOKEN appears in no response, ever');
  ok(!everything.includes(AI_KEY), 'ANTHROPIC_KEY appears in no response, ever');
}

console.log(`\n${passed + failed} assertions — ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
