// ============================================================
// PRISM GATE — the editorial desk's locked drawer.
//
// Why this exists: admin-surface.html is a static page on a PUBLIC, SHARED
// origin — every sailor7613.github.io project serves from the same origin,
// so localStorage there is one pool. Until 2026-08-04 that pool held two
// live credentials: a fine-grained GitHub PAT with Contents R/W on this
// repo (enough to rewrite the served pages themselves), and an Anthropic
// API key. This is exactly the disease the villa-gate cured for the Dream
// Getty; this Worker is the same medicine for Prism.
//
// THE ONE RULE (inherited verbatim from villa-gate): GITHUB_TOKEN and
// ANTHROPIC_KEY are read from env, and are never returned, never logged,
// and never named in an error. If a future change would put either in a
// response body under any condition, that change is wrong.
//
// One admin, three verbs:
//   POST /verify — is this desk key still good?
//   POST /file   — put or delete ONE file, path-restricted to data/
//   POST /ai     — relay one Anthropic messages call, key held here
//
// The path restriction is the real upgrade over the PAT it replaces: even a
// LEAKED desk key can only file JSON and images under data/ — it can never
// touch index.html, admin-surface.html, or anything else the origin serves.
// The credential that could rewrite the newsroom no longer exists in any
// browser; the key that remains opens one drawer.
// ============================================================

const REPO = 'sailor7613/Prism';
const BRANCH = 'main';

// Only these origins may knock. localhost is here so the desk can be tested
// from Live Server before it is pushed; drop those two lines when it annoys you.
const ALLOWED_ORIGINS = [
  'https://sailor7613.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

// ── Sizes and ceilings ──────────────────────────────────────
// MAX_CONTENT is sized for a baked image riding base64 (~9 MB of pixels);
// a Reading JSON is a rounding error against it. MAX_BODY is the whole
// request. The daily ceilings are runaway guards, not meters: a full-sync
// sweep pushing every draft is a normal afternoon, so writes are generous.
const MAX_BODY = 14 * 1024 * 1024;
const MAX_CONTENT = 12 * 1024 * 1024;   // base64 characters, /file put
const MAX_FAILS_PER_HOUR = 12;          // wrong keys from one address before it stops answering
const MAX_WRITES_PER_DAY = 2000;        // accepted /file ops
const MAX_AI_PER_DAY = 500;             // accepted /ai relays
const MAX_AI_TOKENS = 32000;            // max_tokens ceiling on a relayed call

// Where the desk may file. One prefix, a segment grammar that cannot climb,
// and an extension allowlist that matches what the surface actually writes:
// Reading/draft/desk/score JSON, and baked images.
const PATH_RE = /^data\/(?:[A-Za-z0-9_][A-Za-z0-9._-]*\/)*[A-Za-z0-9_][A-Za-z0-9._-]*\.(json|png|jpe?g|webp|gif|avif)$/;
function pathAllowed(p) {
  if (typeof p !== 'string' || p.length > 300) return false;
  if (!PATH_RE.test(p)) return false;
  // Belt and braces: the grammar above already forces every segment to open
  // with [A-Za-z0-9_], so '..' cannot appear — but a rule this load-bearing
  // gets its own explicit line rather than an inference.
  if (p.split('/').some(seg => !seg || seg === '.' || seg === '..')) return false;
  return true;
}

// KV is a speed bump, never the boundary. Every call is wrapped: if the free
// tier's write quota is exhausted, or KV is slow, or the binding is missing,
// the desk still works and still refuses bad keys. A rate limiter that can
// break the lock is worse than no rate limiter.
async function kvGet(env, key) {
  if (!env.RATE) return null;
  try { return await env.RATE.get(key); } catch (e) { return null; }
}
async function kvBump(env, key, n, ttl) {
  if (!env.RATE) return;
  try { await env.RATE.put(key, String(n), { expirationTtl: ttl }); } catch (e) {}
}

function corsFor(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const reply = (obj, status, origin) => new Response(JSON.stringify(obj), {
  status,
  headers: { ...corsFor(origin), 'content-type': 'application/json' },
});

// Constant-time compare, straight from villa-gate. The timing signal on one
// key is negligible, but this is the sort of thing you fix once instead of
// reasoning about forever.
function sameSecret(a, b) {
  const enc = new TextEncoder();
  const A = enc.encode(a), B = enc.encode(b);
  let diff = A.length ^ B.length;
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diff |= (A[i] || 0) ^ (B[i] || 0);
  return diff === 0;
}

// One admin, one key. Both sides trimmed — Cloudflare's secret Value field
// is a textarea and pasted passcodes carry invisible trailing newlines
// (villa-gate, 2026-08-02: the whole class of "I typed it exactly right and
// it says no" removed for free).
function admit(code, env) {
  const given = String(code || '').trim();
  if (!given) return false;
  const key = String(env.DESK_KEY || '').trim();
  return !!key && sameSecret(given, key);
}

async function gh(path, method, body, token) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}${method === 'GET' ? `?ref=${BRANCH}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'prism-gate',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsFor(origin) });
    if (request.method !== 'POST') return reply({ error: 'the desk only takes deliveries' }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return reply({ error: 'not from the newsroom' }, 403, origin);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply({ error: 'that is more than the desk will carry' }, 413, origin);
    let body = {};
    try { body = JSON.parse(raw); } catch (e) {
      return reply({ error: 'the desk could not read that' }, 400, origin);
    }

    // ── The guessing limit ────────────────────────────────────────────
    // BEFORE the key check, never after — villa-gate's hardest-won line.
    // This URL will be published in committed client code on a public repo;
    // the desk key is the only thing in front of it. Someone can find the
    // drawer; they must not be able to try it all night. Only failures are
    // counted, and once an address is over its limit no further KV writes
    // happen, so the budget one attacker can burn is bounded.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hour = new Date().toISOString().slice(0, 13);
    const failKey = `fail:${ip}:${hour}`;
    const fails = parseInt(await kvGet(env, failKey), 10) || 0;
    if (fails >= MAX_FAILS_PER_HOUR) {
      return reply({ error: 'the desk has stopped answering for a while' }, 429, origin);
    }

    // The one line a wrong key learns, identical for absent, wrong, and
    // reserved — /verify shares it, so verification is not a cheaper oracle.
    if (!admit(body.code, env)) {
      await kvBump(env, failKey, fails + 1, 7200);
      return reply({ error: 'the desk does not know this key' }, 401, origin);
    }

    const route = new URL(request.url).pathname.replace(/\/+$/, '');

    // ── /verify — is this desk key still good? ──────────────────────
    // Checked when the key is saved rather than at the first publish, so a
    // typo is caught at the door instead of surfacing days later as a
    // mysterious refusal mid-deadline (door_test's lesson, inherited).
    if (route.endsWith('/verify')) {
      return reply({ ok: true }, 200, origin);
    }

    // ── /ai — relay one Anthropic call, key held here ───────────────
    if (route.endsWith('/ai')) {
      if (!env.ANTHROPIC_KEY) return reply({ error: 'the desk has no wire configured' }, 500, origin);

      const day = new Date().toISOString().slice(0, 10);
      const aiKey = `ai:${day}`;
      const used = parseInt(await kvGet(env, aiKey), 10) || 0;
      if (env.RATE && used >= MAX_AI_PER_DAY) {
        return reply({ error: { message: 'the desk has said enough today' } }, 429, origin);
      }
      await kvBump(env, aiKey, used + 1, 172800);

      // Field allowlist, not passthrough: exactly what PrismAI sends, so a
      // leaked desk key cannot turn the relay into a general-purpose proxy
      // for someone else's payload shapes.
      const b = (body.body && typeof body.body === 'object') ? body.body : {};
      if (!Array.isArray(b.messages) || !b.messages.length) {
        return reply({ error: { message: 'nothing to say' } }, 400, origin);
      }
      const out = {
        model: String(b.model || '').slice(0, 64),
        max_tokens: Math.min(Math.max(1, +b.max_tokens || 1600), MAX_AI_TOKENS),
        messages: b.messages,
      };
      if (b.system != null) out.system = b.system;
      if (b.thinking != null) out.thinking = b.thinking;
      if (b.output_config != null) out.output_config = b.output_config;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(out),
      });
      // Anthropic's status and JSON pass through verbatim — PrismAI's
      // hardening (retry, truncation guard, text-block extraction) stays
      // client-side and keeps working unchanged. The response never
      // contains the key.
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { ...corsFor(origin), 'content-type': 'application/json' },
      });
    }

    // ── /file — put or delete one file under data/ ──────────────────
    if (!env.GITHUB_TOKEN) return reply({ error: 'the desk has no shelf key configured' }, 500, origin);

    const op = body.op === 'del' ? 'del' : body.op === 'put' ? 'put' : null;
    if (!op) return reply({ error: 'the desk files and unfiles; nothing else' }, 400, origin);
    if (!pathAllowed(body.path)) {
      return reply({ error: 'the desk files under data/ and nowhere else' }, 403, origin);
    }

    const day = new Date().toISOString().slice(0, 10);
    const wKey = `write:${day}`;
    const writes = parseInt(await kvGet(env, wKey), 10) || 0;
    if (env.RATE && writes >= MAX_WRITES_PER_DAY) {
      return reply({ error: 'the desk has filed enough today' }, 429, origin);
    }
    await kvBump(env, wKey, writes + 1, 172800);

    const message = String(body.message || '').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 200)
      || (op === 'put' ? 'Update ' : 'Remove ') + body.path;

    if (op === 'del') {
      const sha = String(body.sha || '');
      if (!sha) return reply({ error: 'unfiling needs the sha' }, 400, origin);
      const r = await gh(body.path, 'DELETE', { message, branch: BRANCH, sha }, env.GITHUB_TOKEN);
      if (r.ok) return reply({ ok: true }, 200, origin);
      if (r.status === 404) return reply({ error: 'already gone' }, 404, origin);
      if (r.status === 409 || r.status === 422) return reply({ error: 'conflict' }, r.status, origin);
      console.log('gate del failed', r.status);
      return reply({ error: 'the shelf did not take it' }, 502, origin);
    }

    const content = String(body.content || '');
    if (!content) return reply({ error: 'nothing to file' }, 400, origin);
    if (content.length > MAX_CONTENT) return reply({ error: 'that is more than the desk will carry' }, 413, origin);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(content)) return reply({ error: 'the desk files base64' }, 400, origin);

    const put = await gh(body.path, 'PUT', {
      message,
      branch: BRANCH,
      content: content.replace(/\s/g, ''),
      ...(body.sha ? { sha: String(body.sha) } : {}),
    }, env.GITHUB_TOKEN);

    if (put.ok) {
      const sha = put.data && put.data.content && put.data.content.sha || null;
      return reply({ ok: true, sha }, 200, origin);
    }
    // 409/422 pass through: the client's conflict flow ("repo changed
    // mid-push — pull, then push again", and bake's 422-means-already-baked)
    // depends on telling these apart from a hard failure.
    if (put.status === 409 || put.status === 422) return reply({ error: 'conflict' }, put.status, origin);
    // Everything else is deliberately vague to the caller; the detail stays
    // in the Worker log. A 401 here is OUR token gone stale — that is the
    // desk's problem, and it must not read like the caller's.
    console.log('gate put failed', put.status);
    return reply({ error: 'the shelf did not take it' }, 502, origin);
  },
};
