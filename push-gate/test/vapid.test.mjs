// Runs the Worker in Node with a fake KV and a fake push service; checks the
// VAPID JWT verifies against the public key and that /notify, /subscribe,
// /latest and origin rules behave.
import worker from '../src/index.js';
import assert from 'node:assert';
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await subtle.exportKey('jwk', kp.privateKey);
const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
const b64u = b => Buffer.from(b).toString('base64url');
const store = new Map();
const PUSH = { get: async (k, t) => { const v = store.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { store.set(k, v); }, delete: async k => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
const env = { PUSH, VAPID_PUBLIC: b64u(raw), VAPID_PRIVATE_JWK: JSON.stringify(jwk), NOTIFY_KEY: 'k'.repeat(40) };
const sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url, init });
  const auth = init.headers.Authorization; const m = auth.match(/^vapid t=([^,]+), k=(.+)$/);
  const [h, c, s] = m[1].split('.');
  const pub = await subtle.importKey('raw', Buffer.from(m[2], 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(s, 'base64url'), new TextEncoder().encode(h + '.' + c));
  assert.ok(ok, 'VAPID signature verifies');
  assert.equal(JSON.parse(Buffer.from(c, 'base64url')).aud, new URL(url).origin);
  return new Response(null, { status: url.includes('gone') ? 410 : 201 });
};
const O = 'https://sailor7613.github.io';
const call = (path, body, origin = O, method = 'POST') => worker.fetch(new Request('https://push-gate.x' + path, { method, headers: { 'content-type': 'application/json', Origin: origin }, body: body ? JSON.stringify(body) : undefined }), env);
let r = await call('/subscribe', { subscription: { endpoint: 'https://web.push.apple.com/abc', keys: {} }, avatar: 'ted' });
assert.equal(r.status, 200);
r = await call('/subscribe', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/gone1' } }); assert.equal(r.status, 200);
r = await call('/subscribe', { subscription: { endpoint: 'https://evil.example.com/x' } }); assert.equal(r.status, 400, 'non-push host refused');
r = await call('/subscribe', { subscription: { endpoint: 'https://web.push.apple.com/x' } }, 'https://evil.example.com'); assert.equal(r.status, 403, 'foreign origin refused');
r = await call('/notify', { key: 'wrong', title: 'x' }, ''); assert.equal(r.status, 401);
r = await call('/notify', { key: env.NOTIFY_KEY, title: 'The Karp Minute', body: 'New Reading' }, '');
const j = await r.json(); assert.deepEqual([j.sent, j.gone], [1, 1], 'one sent, one pruned');
r = await call('/latest', null, O, 'GET'); assert.equal((await r.json()).title, 'The Karp Minute');
console.log('push-gate: all checks pass (' + sent.length + ' pushes signed and verified)');
