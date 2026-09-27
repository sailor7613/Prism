// ═══════════════════════════════════════════════════════════════════════
// push-gate — Prism's notification door (2026-09-26)
//
// Sailor: the beta runs on auto-published Claude drafts, and testers get a
// push when a new Reading lands. This Worker holds the subscriptions (KV
// namespace bound as PUSH) and the VAPID signing key; nothing about either
// ever reaches a browser or the public repo.
//
//   POST /subscribe    { subscription, avatar? }   from the portal (origin-checked)
//   POST /unsubscribe  { endpoint }                from the portal
//   GET  /latest                                   the last notice (the service worker reads it)
//   POST /notify       { key, title, body, url }   from the GitHub Action (NOTIFY_KEY)
//
// Pushes carry NO payload: a payload needs RFC 8291 encryption per
// subscriber, and there is nothing private to say. The service worker wakes
// on the empty push, reads /latest, and shows it. VAPID (RFC 8292) is an
// ES256 JWT signed with WebCrypto.
//
// Secrets (wrangler secret put): VAPID_PUBLIC (base64url, 65-byte point),
// VAPID_PRIVATE_JWK (JSON), NOTIFY_KEY.
// ═══════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = ['https://sailor7613.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500'];
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/, /\.push\.services\.mozilla\.com$/];
const SUBJECT = 'https://sailor7613.github.io/Prism/';
const MAX_SUBS = 500;

const corsFor = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Vary': 'Origin',
});
const reply = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { ...corsFor(origin), 'content-type': 'application/json' } });

// ── bytes ──
const enc = new TextEncoder();
function b64u(bytes) { let s = ''; const b = new Uint8Array(bytes); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function sha256hex(s) { const d = await crypto.subtle.digest('SHA-256', enc.encode(s)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function sameSecret(a, b) { a = String(a || ''); b = String(b || ''); if (!a || !b || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

// ── VAPID (RFC 8292) ──
async function vapidAuth(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(header + '.' + claims));   // IEEE P1363 r||s — what JWT wants
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

async function sendOne(sub, env) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(sub.endpoint, env), TTL: '86400', Urgency: 'normal', 'Content-Length': '0' },
  });
  return res.status;
}

function validSubscription(s) {
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return false;
  let u; try { u = new URL(s.endpoint); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  return PUSH_HOSTS.some(re => re.test(u.hostname));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const route = new URL(request.url).pathname.replace(/\/+$/, '');
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsFor(origin) });
    if (!env.PUSH) return reply({ error: 'no storage bound' }, 500, origin);

    // the service worker reads the last notice (it runs on the portal's origin)
    if (request.method === 'GET' && route.endsWith('/latest')) {
      const latest = await env.PUSH.get('latest');
      return new Response(latest || JSON.stringify({ title: 'Prism', body: 'A new Reading is up.', url: './v2/index.html' }), {
        headers: { ...corsFor(origin), 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
    if (request.method !== 'POST') return reply({ error: 'post only' }, 405, origin);
    let body = {}; try { body = await request.json(); } catch (e) { return reply({ error: 'bad json' }, 400, origin); }

    // ── /notify — server to server (the GitHub Action), keyed, no origin ──
    if (route.endsWith('/notify')) {
      if (!sameSecret(body.key, env.NOTIFY_KEY)) return reply({ error: 'no' }, 401, origin);
      const notice = {
        title: String(body.title || 'Prism').slice(0, 80),
        body: String(body.body || 'A new Reading is up.').slice(0, 180),
        url: String(body.url || './v2/index.html').slice(0, 300),
        at: new Date().toISOString(),
      };
      await env.PUSH.put('latest', JSON.stringify(notice));
      let sent = 0, gone = 0, failed = 0, cursor;
      do {
        const page = await env.PUSH.list({ prefix: 'sub:', cursor });
        for (const k of page.keys) {
          const sub = await env.PUSH.get(k.name, 'json');
          if (!sub) continue;
          let st = 0; try { st = await sendOne(sub, env); } catch (e) { st = 0; }
          if (st >= 200 && st < 300) sent++;
          else if (st === 404 || st === 410) { gone++; await env.PUSH.delete(k.name); }
          else failed++;
        }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return reply({ ok: true, sent, gone, failed }, 200, origin);
    }

    // everything else comes from the portal
    if (!ALLOWED_ORIGINS.includes(origin)) return reply({ error: 'not from Prism' }, 403, origin);

    if (route.endsWith('/subscribe')) {
      const s = body.subscription;
      if (!validSubscription(s)) return reply({ error: 'that is not a push subscription' }, 400, origin);
      const count = parseInt(await env.PUSH.get('count'), 10) || 0;
      const id = 'sub:' + (await sha256hex(s.endpoint)).slice(0, 32);
      const existed = await env.PUSH.get(id);
      if (!existed && count >= MAX_SUBS) return reply({ error: 'the list is full' }, 429, origin);
      await env.PUSH.put(id, JSON.stringify({ endpoint: s.endpoint, keys: s.keys || null, avatar: String(body.avatar || '').slice(0, 40), at: new Date().toISOString() }));
      if (!existed) await env.PUSH.put('count', String(count + 1));
      return reply({ ok: true }, 200, origin);
    }
    if (route.endsWith('/unsubscribe')) {
      if (typeof body.endpoint !== 'string') return reply({ error: 'which one?' }, 400, origin);
      const id = 'sub:' + (await sha256hex(body.endpoint)).slice(0, 32);
      if (await env.PUSH.get(id)) {
        await env.PUSH.delete(id);
        const count = parseInt(await env.PUSH.get('count'), 10) || 1;
        await env.PUSH.put('count', String(Math.max(0, count - 1)));
      }
      return reply({ ok: true }, 200, origin);
    }
    return reply({ error: 'no such door' }, 404, origin);
  },
};
