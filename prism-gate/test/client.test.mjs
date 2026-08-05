// The client half of the cure, proven the way villa-gate's gate_client_test
// proved it: load the REAL prism-sync.js and prism-ai.js (the copies staged
// for commit), and confirm (1) legacy credentials in localStorage are
// scrubbed, never migrated; (2) no request from either file ever carries an
// Authorization or x-api-key header; (3) every write and every AI call goes
// through the gate, and reads stay keyless on the public repo.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const SYNC_SRC = readFileSync(new URL('../../src/js/prism-sync.js', import.meta.url), 'utf8');
const AI_SRC = readFileSync(new URL('../../src/js/prism-ai.js', import.meta.url), 'utf8');

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else { failed++; console.error('  ✗ ' + name); }
}

// ── a browser-shaped sandbox ──
function makeWorld(seed = {}) {
  const store = new Map(Object.entries(seed));
  const calls = [];
  const responses = [];
  const sandbox = {
    console,
    TextEncoder, TextDecoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    Date, JSON, Math, Array, Object, String, Number, Promise, URLSearchParams,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    fetch: async (url, opts = {}) => {
      calls.push({ url: String(url), opts });
      const next = responses.shift() || { status: 200, body: { ok: true, sha: 'sha-new', content: null } };
      return {
        ok: next.status < 300,
        status: next.status,
        json: async () => next.body,
        text: async () => JSON.stringify(next.body),
      };
    },
    PrismDB: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return { sandbox, store, calls, responses };
}

// ═══ the scrub — legacy credentials removed, never migrated ═══
{
  const { sandbox, store } = makeWorld({
    'prism.admin.ghToken': 'ghp_LEGACY_SHOULD_DIE',
    'prism.admin.apiKey': 'sk-ant-LEGACY_SHOULD_DIE',
  });
  vm.runInContext(SYNC_SRC, sandbox);
  const PrismSync = vm.runInContext('PrismSync', sandbox);
  ok(!store.has('prism.admin.ghToken'), 'legacy PAT is scrubbed from localStorage on load');
  ok(!store.has('prism.admin.apiKey'), 'legacy Anthropic key is scrubbed on load');
  ok(!store.has('prism.admin.deskKey'), 'nothing was migrated into the desk key');
  ok(PrismSync.deskKey() === '', 'deskKey() is empty after the scrub');
}

// ═══ writes go through the gate; nothing carries a credential ═══
{
  const { sandbox, store, calls, responses } = makeWorld();
  vm.runInContext(SYNC_SRC, sandbox);
  const PrismSync = vm.runInContext('PrismSync', sandbox);
  sandbox.window.PRISM_GATE = 'https://prism-gate.test.workers.dev';
  store.set('prism.admin.deskKey', 'the-medium-rule-77');

  responses.push({ status: 200, body: { ok: true, sha: 'sha-put-1' } });
  const sha = await PrismSync.putFile('data/x/scores.json', { a: 1 }, 'msg');
  ok(sha === 'sha-put-1', 'putFile returns the gate sha');
  const put = calls[calls.length - 1];
  ok(put.url === 'https://prism-gate.test.workers.dev/file', 'putFile POSTs to the gate, not api.github.com');
  const body = JSON.parse(put.opts.body);
  ok(body.code === 'the-medium-rule-77' && body.op === 'put' && body.path === 'data/x/scores.json',
    'the desk key and path ride the body');

  // a keyless read, then a gated delete
  responses.push({ status: 200, body: { content: Buffer.from('{"x":1}').toString('base64'), sha: 'sha-old' } });
  responses.push({ status: 200, body: { ok: true } });
  await PrismSync.deleteDraft('rid_z');
  const read = calls[calls.length - 2], del = calls[calls.length - 1];
  ok(read.url.startsWith('https://api.github.com/'), 'the pre-delete read stays on the public contents API');
  ok(!(read.opts.headers || {}).Authorization, '…and carries NO Authorization header');
  ok(del.url.endsWith('/file') && JSON.parse(del.opts.body).op === 'del', 'the delete goes through the gate');

  ok(calls.every(c => !(c.opts.headers || {}).Authorization && !(c.opts.headers || {})['x-api-key']),
    'no request from prism-sync ever carries a credential header');
}

// ═══ pulls-only honesty without a key ═══
{
  const { sandbox } = makeWorld();
  vm.runInContext(SYNC_SRC, sandbox);
  const PrismSync = vm.runInContext('PrismSync', sandbox);
  let threw = null;
  try { await PrismSync.putFile('data/x.json', {}, 'm'); } catch (e) { threw = e.message; }
  ok(/desk key/i.test(threw || ''), 'no desk key → the refusal names the desk key, not a token');
}

// ═══ AI calls go through the gate ═══
{
  const { sandbox, calls, responses } = makeWorld();
  vm.runInContext(SYNC_SRC, sandbox);
  vm.runInContext(AI_SRC, sandbox);
  const PrismAI = vm.runInContext('PrismAI', sandbox);
  sandbox.window.PRISM_GATE = 'https://prism-gate.test.workers.dev';

  responses.push({ status: 200, body: { content: [{ type: 'text', text: 'the wire answers' }], stop_reason: 'end_turn' } });
  const text = await PrismAI.call('the-medium-rule-77', { prompt: 'hello', maxTokens: 1600 });
  ok(text === 'the wire answers', 'PrismAI returns the relayed text');
  const ai = calls[calls.length - 1];
  ok(ai.url === 'https://prism-gate.test.workers.dev/ai', 'the call went to the gate, not api.anthropic.com');
  const aiBody = JSON.parse(ai.opts.body);
  ok(aiBody.code === 'the-medium-rule-77' && Array.isArray(aiBody.body.messages), 'desk key + messages ride the body');
  ok(!(ai.opts.headers || {})['x-api-key'], 'no x-api-key header leaves the browser');
  ok(!(ai.opts.headers || {})['anthropic-dangerous-direct-browser-access'], 'the browser-access escape hatch is gone');
}

// ═══ the sources themselves ═══
{
  ok(!/anthropic-dangerous-direct-browser-access/.test(AI_SRC), 'the escape-hatch header is out of the source');
  ok(!/api\.anthropic\.com/.test(AI_SRC), 'api.anthropic.com no longer appears in prism-ai.js');
  const codeOnly = SYNC_SRC.replace(/\/\/[^\n]*/g, '');
  const ghTokenLines = codeOnly.split('\n').filter(l => l.includes('ghToken'));
  ok(ghTokenLines.every(l => l.includes('removeItem')),
    'ghToken survives in prism-sync.js code only inside the scrub (removeItem)');
  ok(!/Bearer/.test(SYNC_SRC.replace(/\/\/[^\n]*/g, '')), 'no Bearer header construction left in prism-sync.js');
}

// ═══ the served tree — the 2026-08-05 credential-debt sweep ═══
// admin.html and admin-pad.html were retired to archive/ and v2/index.html's
// derive panel was routed through the gate. These assertions exist so the
// served tree cannot quietly regrow a direct Anthropic call: the failure they
// guard against is a page that asks a human to paste an sk-ant key into a
// public shared origin, which is the exact disease the gate was built to cure.
{
  const ROOT = new URL('../../', import.meta.url);           // the Prism repo root
  const served = ['v2/index.html', 'index.html', 'admin-surface.html', 'legislation-inspector.html'];
  for (const rel of served) {
    let src = '';
    try { src = readFileSync(new URL(rel, ROOT), 'utf8'); } catch (e) { continue; }
    const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
    ok(!/api\.anthropic\.com/.test(code), `${rel} makes no direct Anthropic call`);
    ok(!/anthropic-dangerous-direct-browser-access/.test(code), `${rel} has no browser-access escape hatch`);
    ok(!/['"]x-api-key['"]/.test(code), `${rel} sends no x-api-key header`);
  }
  // the re-infection vector: nothing served may WRITE a credential to the
  // shared origin's localStorage. prism-sync scrubs prism.admin.apiKey on load;
  // admin-pad.html used to write it back on every keystroke, so the scrub was a
  // loop rather than a cure.
  for (const rel of served) {
    let src = '';
    try { src = readFileSync(new URL(rel, ROOT), 'utf8'); } catch (e) { continue; }
    const writes = src.split('\n').filter(l => /setItem\([^)]*(apiKey|ghToken|sk-ant)/.test(l));
    ok(writes.length === 0, `${rel} never persists a credential to localStorage`);
  }
  // the retired pages really did leave the served root
  for (const gone of ['admin.html', 'admin-pad.html']) {
    ok(!existsSync(new URL(gone, ROOT)), `${gone} is no longer at the served root`);
  }
}

console.log(`\n${passed + failed} assertions — ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
