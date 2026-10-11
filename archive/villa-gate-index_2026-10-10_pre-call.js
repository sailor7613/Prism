// ============================================================
// VILLA GATE — the Dream Getty's door.
//
// Why this exists: a static page on GitHub Pages cannot keep a secret.
// Everything the browser needs in order to check a passcode is in a file the
// browser downloaded, so a passcode checked in index.html is a doorman who
// hands out the key with the question. This Worker is the smallest possible
// piece of server that makes the passcode real.
//
// THE ONE RULE: GITHUB_TOKEN is read from env, and is never returned, never
// logged, and never named in an error. If a future change would put it in a
// response body under any condition, that change is wrong.
//
// Two identity modes, decided entirely by what is in the GUESTS secret — the
// client and this file do not change between them:
//   • HOUSE_CODE alone      → one shared passcode, the client names its avatar
//   • GUESTS entries        → per-person passcode, THE SERVER names the avatar
//                             and the client's claim is discarded
// Shipping with a house code today does not close the door on per-person
// codes tomorrow: add lines to the GUESTS secret and they start being enforced
// on the next request. No redeploy of the villa, no change here.
// ============================================================

// Which house this door opens (2026-09-22). The same Worker is deployed
// twice: as villa-gate (REPO unset → the dreamgetty repo, the villa's feed)
// and as burn-gate (REPO = sailor7613/Prism, Prism's field of burns). The
// door, the passcodes and the residents are identical; only the house differs.
const REPO_DEFAULT = 'sailor7613/dreamgetty';
let REPO = REPO_DEFAULT;

// Only these origins may knock. localhost is here so the villa can be tested
// from Live Server before it is pushed; drop those two lines when it annoys you.
const ALLOWED_ORIGINS = [
  'https://sailor7613.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8000',      // Prism's python fallback server (CLAUDE.md)
  'http://127.0.0.1:8000',
];

const MAX_TEXT = 400;
const MAX_ADDRESS = 6000;      // the docent's address is a speech, not a remark
const MAX_PROFILE = 800;       // a display name, the separator, and a bio
const MAX_UPLOAD = 3 * 1024 * 1024;   // decoded bytes — a notebook page, not an archive
const MAX_UPLOADS_PER_DAY = 12;
// The exedra notebook takes files (2026-08-09). An allowlist, not a
// blocklist: things a notebook can hold. No html, no svg (both can carry
// scripts and would be served from the villa's own origin), no zip.
const UPLOAD_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'md']);
const MAX_PER_DAY = 60;       // per avatar per day, only enforced if KV is bound
const MAX_BODY = 24 * 1024;   // sized for an address; a statement is checked at 400 below
const MAX_FAILS_PER_HOUR = 12; // wrong passcodes from one address before it stops answering
// ── BURNS (2026-09-22, Sailor: "pins should definitely be public") ──
// A burn is a Prism commit: a resident's pin on a Reading's plane — quad,
// band, x/y, z, intensity, their words, and the Burns tiles the commit fired.
// It lands under the avatar in the public repo exactly as a statement lands
// as a stele in the villa: data/field/<rid>/<id>.json + a per-Reading
// manifest the portal pulls. Same door, same author rule, own daily cap.
const MAX_BURNS_PER_DAY = 40;
const MAX_WORDS = 180;
const RID_RE = /^rdg_[a-z0-9]{6,20}$/;
const BANDS = new Set(['fluid', 'coalition', 'denominated']);
const QUADS = new Set(['A', 'B', 'C', 'D']);

// KV is a speed bump, never the boundary. Every call is wrapped: if the free
// tier's write quota is exhausted, or KV is slow, or the binding is missing,
// the door still works and still refuses bad passcodes. A rate limiter that
// can break the lock is worse than no rate limiter.
// (2026-09-27) where only the ACCOUNTS store is bound — the burn-gate — it
// also carries the counters, so the invite can't be guessed without limit.
const rateKv = (env) => env.RATE || env.ACCOUNTS || null;
async function kvGet(env, key) {
  const kv = rateKv(env); if (!kv) return null;
  try { return await kv.get(key); } catch (e) { return null; }
}
async function kvBump(env, key, n, ttl) {
  const kv = rateKv(env); if (!kv) return;
  try { await kv.put(key, String(n), { expirationTtl: ttl }); } catch (e) {}
}

// Residents a visitor may speak as. Ted is staff, Horned Sphere is asleep and
// cannot be summoned — neither is assignable. Kept in step with AVATARS.
const SPEAKABLE = new Set([
  'trout', 'seal', 'y2k', 'otter', 'petra', 'kyle', 'diddy',
  'richard', 'julia', 'emilia', 'adlib', 'austin', 'guest', 'ted',
  // 2026-08-07 — Houston (greyhound), the sea turtle, Edburg (the second
  // house cat) and Luke (albatross). This list and ASSIGNABLE in
  // index.html are one list kept in two places; a key added there and not
  // here is an identity the panel will hand out and the gate will then
  // refuse, which reads to the person holding the invite as being told
  // they do not exist.
  'houston', 'turtle', 'edburg', 'luke',
  // 2026-08-10 — Big Colin (raccoon), Doctor Colin (blue sparrow) and
  // Alrik's own new key (beaver). The wizard is 'richard' above — key
  // renamed 2026-08-10, the name went with the person. Same rule: this
  // list and ASSIGNABLE in index.html together.
  'bigcolin', 'doctorcolin', 'alrik-new',
  // 2026-09-18 — Haley (red fox, the Otter Princess's cousin). Same rule.
  'haley',
]);

// RESERVED — assignable by the server, never claimable by a client.
// Ted is Sailor, and he is the docent: the voice that introduces the whole
// project. If the house code could claim him, then everyone holding it could
// speak as the narrator, and the one identity in the villa that must be
// trustworthy would be the least trustworthy thing in it. So Ted is reachable
// only through a per-person passcode in GUESTS, which the server resolves —
// the client's claim is never consulted for anyone in this set.
const RESERVED = new Set(['ted']);

// ── THE ADDRESS (2026-08-03) ────────────────────────────────────────
// Almost everything said in the villa is a STATEMENT: it becomes a stele
// standing on the spot where it was said, waiting to be walked past.
// An ADDRESS is the other thing — the docent speaking to the house rather
// than leaving a mark in it. It plays to every arriving visitor.
//
// Which is exactly why only an assigned Ted may post one. A message that
// plays automatically to everyone who opens the door is the most abusable
// object in the villa, so the right to make one is the narrowest right in it:
// it needs a passcode that GUESTS maps to a RESERVED resident, which no
// house-code holder can obtain by editing their client.
//
// The payoff is that the introduction stops being code. Sailor rewrites it by
// saying it — no deploy, no commit, no session.
// 'profile' (2026-08-09) — a resident saying who they are. Append-only like
// everything else: the newest one wins and the old ones stay in the feed.
//
// It needs no authority check. The author is named from the passcode and
// every client claim is discarded, so a key can only ever post as its own
// resident — which means "you may edit only your own profile" is not a rule
// anybody has to remember, it is the door.
//
// The client also tags a profile with `replyTo: 'dg:profile'`, and that is
// deliberate: BEFORE this line was deployed, an unknown kind fell through to
// 'statement' here and came back looking like a remark. The replyTo marker
// crosses untouched either way, so the villa reads profiles correctly on both
// sides of this deploy and nothing has to be migrated afterwards.
// 'note' (2026-08-09) — a page in a room's notebook (the pedestals in the
// library and the exedra). Bound to its book by replyTo 'dg:note:<room>',
// which crosses today's door untouched — same pattern as 'profile' above.
const KINDS = new Set(['statement', 'address', 'profile', 'note', 'burn']);

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

// Constant-time compare. The passcode list is tiny and the timing signal is
// smaller still, but a comparison that leaks its answer through how long it
// takes is the sort of thing you fix once instead of reasoning about forever.
function sameSecret(a, b) {
  const enc = new TextEncoder();
  const A = enc.encode(a), B = enc.encode(b);
  let diff = A.length ^ B.length;
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diff |= (A[i] || 0) ^ (B[i] || 0);
  return diff === 0;
}

// Who is knocking? Returns null (refused), or {avatar} where avatar === null
// means "admitted, but the house code does not know who you are — take the
// client's word for it."
// Both sides are trimmed (2026-08-02). Cloudflare's secret Value field is a
// textarea, and a pasted passcode very often carries a trailing newline that
// nobody can see. A door code whose leading whitespace is load-bearing is a
// footgun rather than a feature, so this costs nothing and removes the entire
// class of "I typed it exactly right and it says no".
async function admit(pass, name, env) {
  const given = String(pass || '').trim();
  if (!given) return null;
  let guests = {};
  try { guests = JSON.parse(env.GUESTS || '{}'); } catch (e) { guests = {}; }
  for (const phrase of Object.keys(guests)) {
    if (sameSecret(given, String(phrase).trim())) return { avatar: String(guests[phrase] || '') };
  }
  const house = String(env.HOUSE_CODE || '').trim();
  if (house && sameSecret(given, house)) return { avatar: null };
  // ── CLAIMED SEATS (2026-09-27) ── a name + a passcode the person chose at
  // the door (see /claim). Only where the ACCOUNTS KV is bound (the burn-gate);
  // the villa, deployed from this same file without it, never reaches this.
  const seat = await seatOf(name, env);
  if (seat && await seatChecks(seat, given)) return { avatar: seat.name, seat: true };
  return null;
}

// ── CLAIMED SEATS ─────────────────────────────────────────────────────
// Sailor, 2026-09-27: the beta group (10–15 people) should be able to make
// their own account rather than have every passcode typed into one list.
// A seat is a NAME (the avatar the burns go public under) and a passcode the
// person chose, kept in the ACCOUNTS KV as a salted PBKDF2 hash. Claiming
// one needs the INVITE code (a secret Sailor sets once and hands out with
// the link). The reserved names and the villa's residents can't be claimed;
// a name, once taken, is taken. The GITHUB_TOKEN rule holds: nothing here
// returns or logs a secret, and a wrong passcode gets the door's one line.
const SEAT_RE = /^[a-z0-9][a-z0-9-]{1,19}$/;
const MIN_PASS = 8;
const PBKDF2_ITER = 100000;
async function seatOf(name, env) {
  if (!env.ACCOUNTS) return null;
  const n = String(name || '').trim().toLowerCase();
  if (!SEAT_RE.test(n)) return null;
  try { const raw = await env.ACCOUNTS.get('seat:' + n); return raw ? Object.assign({ name: n }, JSON.parse(raw)) : null; } catch (e) { return null; }
}
async function seatHash(pass, saltB64) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
async function seatChecks(seat, pass) {
  if (!seat || !seat.salt || !seat.hash) return false;
  try { return sameSecret(await seatHash(pass, seat.salt), seat.hash); } catch (e) { return false; }
}
function residentNames(env) {
  const names = new Set(SPEAKABLE);
  try { Object.values(JSON.parse(env.GUESTS || '{}')).forEach(v => names.add(String(v).trim().toLowerCase())); } catch (e) {}
  return names;
}

// The server does not trust the client's sanitation, because the client is a
// file anyone can copy and edit. These are the same rules index.html applies
// on the way in; this is the copy that actually counts.
const str = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max) : '';
const num = (v) => {
  const n = +v;
  return Number.isFinite(n) ? Math.max(-1e4, Math.min(1e4, n)) : 0;
};

async function gh(path, method, body, token, query) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}${query || ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'villa-gate',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}

const b64encode = (obj) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj, null, 1));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const b64decode = (s) => {
  const bin = atob(String(s || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    REPO = String(env.REPO || REPO_DEFAULT).trim();

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsFor(origin) });
    if (request.method !== 'POST') return reply({ error: 'the door only opens one way' }, 405, origin);
    if (!ALLOWED_ORIGINS.includes(origin)) return reply({ error: 'not from the villa' }, 403, origin);
    if (!env.GITHUB_TOKEN) return reply({ error: 'the villa has no memory configured' }, 500, origin);

    // /upload carries a base64 file and gets its own ceiling; every other
    // route keeps the statement-sized one.
    const routePath = new URL(request.url).pathname.replace(/\/+$/, '');
    const raw = await request.text();
    const bodyCap = routePath.endsWith('/upload') ? Math.ceil(MAX_UPLOAD * 4 / 3) + 4096 : MAX_BODY;
    if (raw.length > bodyCap) return reply({ error: 'that is more than a statement' }, 413, origin);
    let body = {};
    try { body = JSON.parse(raw); } catch (e) {
      return reply({ error: 'the villa could not read that' }, 400, origin);
    }

    // ── The guessing limit ────────────────────────────────────────────
    // This has to sit BEFORE the passcode check, not after. The first version
    // of the limiter ran after admit() and so only ever counted SUCCESSFUL
    // posts — it capped a chatty friend and did precisely nothing about the
    // actual threat, which is that this endpoint's URL is published in
    // index.html on a public repo and the passcode is the only thing in front
    // of it. Someone can find the door; they must not be able to try it all
    // night.
    //
    // Only failures are counted, and once an address is over its limit no
    // further writes happen — so the KV write budget spent on one attacker is
    // bounded at MAX_FAILS_PER_HOUR, not unbounded.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hour = new Date().toISOString().slice(0, 13);   // yyyy-mm-ddThh
    const failKey = `fail:${ip}:${hour}`;
    const fails = parseInt(await kvGet(env, failKey), 10) || 0;
    if (fails >= MAX_FAILS_PER_HOUR) {
      return reply({ error: 'the villa has stopped answering for a while' }, 429, origin);
    }

    // ── /claim — a newcomer takes a seat: invite code + a name + their own
    // passcode. Failures count against the same guessing limit as a wrong
    // key, so the invite can't be brute-forced any faster than a passcode.
    if (routePath.endsWith('/claim')) {
      if (!env.ACCOUNTS) return reply({ error: 'this door has no seats to give' }, 404, origin);
      const invite = String(env.INVITE || '').trim();
      const given = String(body.invite || '').trim();
      if (!invite || !given || !sameSecret(given, invite)) {
        await kvBump(env, failKey, fails + 1, 7200);
        return reply({ error: 'that invite is not one of ours — ask Sailor for the code' }, 401, origin);
      }
      const name = String(body.name || '').trim().toLowerCase();
      const pass = String(body.pass || '').trim();
      if (!SEAT_RE.test(name)) return reply({ error: 'a name is 2–20 letters, numbers or dashes, starting with a letter or number' }, 400, origin);
      if (RESERVED.has(name) || residentNames(env).has(name)) return reply({ error: 'that name is taken' }, 409, origin);
      if (pass.length < MIN_PASS) return reply({ error: 'a passcode is at least ' + MIN_PASS + ' characters' }, 400, origin);
      if (await seatOf(name, env)) return reply({ error: 'that name is taken' }, 409, origin);
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const salt = btoa(String.fromCharCode(...saltBytes));
      let hash; try { hash = await seatHash(pass, salt); } catch (e) { return reply({ error: 'the door could not keep that' }, 500, origin); }
      try { await env.ACCOUNTS.put('seat:' + name, JSON.stringify({ salt, hash, t: new Date().toISOString() })); }
      catch (e) { return reply({ error: 'the door could not keep that' }, 502, origin); }
      return reply({ ok: true, avatar: name, seat: true }, 200, origin);
    }

    const who = await admit(String(body.pass || ''), body.name, env);
    // The ruled line, verbatim — and the only thing a wrong passcode learns.
    // It does not distinguish "no passcode" from "wrong passcode" on purpose.
    if (!who) {
      await kvBump(env, failKey, fails + 1, 7200);
      return reply({ error: 'the villa hears you but cannot remember — ask Sailor for a key' }, 401, origin);
    }

    // ── /verify — is this passcode still good? ──────────────────────────
    // Checked at the door rather than at the first statement. Without this a
    // typo saves silently and the visitor only learns about it when their
    // first words vanish; and rotating HOUSE_CODE strands everyone who has
    // one saved, with no way back except knowing to reopen the ⚿ menu.
    //
    // It writes nothing and returns nothing but a yes — deliberately. A wrong
    // code gets the identical 401 as a wrong code on /say, above, so this is
    // not a cheaper oracle for guessing than posting was. `avatar` comes back
    // only when a per-person code names one, which is how the villa can tell
    // a friend who they are without them choosing.
    if (new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/verify')) {
      return reply({ ok: true, avatar: who.avatar || null, seat: !!who.seat }, 200, origin);
    }

    // Per-person code: the passcode names the author and the client's claim is
    // discarded. House code: the client names itself, which is exactly the
    // trust level a shared passcode buys and no more.
    const claimed = str(body.avatar, 40);
    const author = who.avatar || claimed;
    if (!who.seat && !SPEAKABLE.has(author)) return reply({ error: 'nobody here by that name' }, 400, origin);

    // ── /upload — a file into the exedra notebook ─────────────────────
    // Behind the same door as speech: the passcode admits, the author is
    // named the same way, and the file lands in feed/files/ in the repo —
    // git is the archive here exactly as it is for words. Own daily cap.
    if (routePath.endsWith('/upload')) {
      const name = str(body.name, 80).replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^[. ]+/, '');
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (!name || !UPLOAD_EXT.has(ext)) {
        return reply({ error: 'the notebook does not take that kind of file' }, 400, origin);
      }
      const data = String(body.data || '').replace(/\s/g, '');
      if (!data || !/^[A-Za-z0-9+/]+=*$/.test(data)) {
        return reply({ error: 'the villa could not read that' }, 400, origin);
      }
      const approxBytes = Math.floor(data.length * 3 / 4);
      if (approxBytes > MAX_UPLOAD) return reply({ error: 'too heavy for the notebook — three megabytes at most' }, 413, origin);
      const upDay = new Date().toISOString().slice(0, 10);
      const upKey = `up:${author}:${upDay}`;
      const upN = parseInt(await kvGet(env, upKey), 10) || 0;
      if (rateKv(env) && upN >= MAX_UPLOADS_PER_DAY) {
        return reply({ error: 'the notebook has taken enough from you today' }, 429, origin);
      }
      await kvBump(env, upKey, upN + 1, 172800);
      const fid = `${Date.now()}-${author}-${Math.random().toString(36).slice(2, 8)}`;
      const fpath = `feed/files/${fid}-${name.replace(/ /g, '_')}`;
      const putF = await gh(fpath, 'PUT',
        { message: `file: ${author} adds ${name}`, content: data, branch: 'main' }, env.GITHUB_TOKEN);
      if (!putF.ok) {
        console.log('upload write failed', putF.status);
        return reply({ error: 'the villa could not keep that' }, 502, origin);
      }
      return reply({ ok: true, path: fpath, author }, 200, origin);
    }
    // ── /burn — a pin on a Reading's plane, under the avatar ──────────
    // Requires a PER-PERSON code (who.avatar): a house-code holder naming
    // themselves may speak in the villa, but a burn is a position on the
    // record and the record needs to know whose it is.
    if (routePath.endsWith('/burn')) {
      if (!who.avatar) return reply({ error: 'a burn needs your own key — ask Sailor' }, 403, origin);
      const b = (body.burn && typeof body.burn === 'object') ? body.burn : {};
      const rid = str(b.rid, 40);
      if (!RID_RE.test(rid)) return reply({ error: 'no such Reading' }, 400, origin);
      const clamp = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
      const quad = QUADS.has(b.quad) ? b.quad : null;
      const band = BANDS.has(b.band) ? b.band : null;
      if (!quad || !band) return reply({ error: 'a burn needs a corner and a band' }, 400, origin);
      const tiles = (Array.isArray(b.tiles) ? b.tiles : []).slice(0, 12).map(t => ({
        species: str(t && t.species, 16), glyph: str(t && t.glyph, 4), figure: str(t && t.figure, 32),
        label: str(t && t.label, 80), valence: str(t && t.valence, 12),
      })).filter(t => t.species);
      const burnDay = new Date().toISOString().slice(0, 10);
      const burnKey = `burn:${author}:${burnDay}`;
      const burnN = parseInt(await kvGet(env, burnKey), 10) || 0;
      if (rateKv(env) && burnN >= MAX_BURNS_PER_DAY) return reply({ error: 'enough burns for one day' }, 429, origin);
      await kvBump(env, burnKey, burnN + 1, 172800);
      const entry = {
        id: `${Date.now()}-${author}-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'burn', author, rid,
        title: str(b.title, 80),
        t: new Date().toISOString(),
        x: +clamp(b.x, 0, 1, 0.5).toFixed(4), y: +clamp(b.y, 0, 1, 0.5).toFixed(4),
        z: +clamp(b.z, -1, 1, 0).toFixed(3),
        quad, band, intensity: Math.round(clamp(b.intensity, 0, 100, 50)),
        words: str(b.words, MAX_WORDS).trim() || null,
        tiles,
        device: str(b.device, 24) || null,
      };
      const dir = `data/field/${rid}`;
      const msg = `burn: ${author} on ${entry.title || rid} · ${quad}/${band} z ${entry.z >= 0 ? '+' : ''}${entry.z}`;
      const put = await gh(`${dir}/${entry.id}.json`, 'PUT',
        { message: msg, content: b64encode(entry), branch: 'main' }, env.GITHUB_TOKEN);
      if (!put.ok) { console.log('burn write failed', put.status); return reply({ error: 'the field could not keep that' }, 502, origin); }
      const lag = await appendManifest(`${dir}/manifest.json`, entry, msg, env.GITHUB_TOKEN);
      return reply(lag ? { ok: true, entry, warning: 'burn placed, ledger lagging' } : { ok: true, entry }, 200, origin);
    }

    // A reserved resident may only be ASSIGNED (who.avatar), never CLAIMED.
    // Refused with the door's own line rather than a distinct message, so a
    // client probing for reserved names learns nothing from the difference.
    if (!who.avatar && RESERVED.has(author)) {
      return reply({ error: 'the villa hears you but cannot remember — ask Sailor for a key' }, 401, origin);
    }

    const kind = KINDS.has(body.kind) ? body.kind : 'statement';
    // An address may only be ASSIGNED authority, never claimed — the same test
    // that guards Ted himself, because an address is Ted's voice by definition.
    if (kind === 'address' && !(who.avatar && RESERVED.has(author))) {
      return reply({ error: 'only the docent addresses the house' }, 403, origin);
    }
    const text = str(body.text,
      kind === 'address' ? MAX_ADDRESS : (kind === 'profile' ? MAX_PROFILE : MAX_TEXT)).trim();
    if (!text) return reply({ error: 'nothing was said' }, 400, origin);

    // The daily ceiling — a different job from the guessing limit above. This
    // one is about volume from someone who is legitimately inside: a runaway
    // script, a stuck key, or a friend having a night. One write per accepted
    // post, so a guestbook never comes close to the free tier's budget.
    const day = new Date().toISOString().slice(0, 10);
    const dayKey = `said:${author}:${day}`;
    const said = parseInt(await kvGet(env, dayKey), 10) || 0;
    if (rateKv(env) && said >= MAX_PER_DAY) {
      return reply({ error: 'the villa has heard enough from you today' }, 429, origin);
    }
    await kvBump(env, dayKey, said + 1, 172800);

    const pos = Array.isArray(body.pos) ? body.pos : [];
    const to = str(body.to, 40);
    const entry = {
      // Date.now() + author is NOT unique — two statements from the same
      // person inside one millisecond collide, and the collision is silent:
      // same filename, so the second overwrites the first, and the manifest's
      // own dedup then drops it as already-present. Caught by the concurrency
      // test. The suffix costs six characters and removes the whole class.
      id: `${Date.now()}-${author}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      author,
      to: (to && to !== author && SPEAKABLE.has(to)) ? to : null,
      text,
      t: new Date().toISOString(),          // the server owns the clock, not the client
      pos: [num(pos[0]), num(pos[1]), num(pos[2])],
      place: str(body.place, 60),
      replyTo: str(body.replyTo, 80) || null,
    };
    const msg = `feed: ${entry.author}${entry.to ? ' → ' + entry.to : ''} @ ${entry.place || 'the villa'}`;

    const put = await gh(`feed/${entry.id}.json`, 'PUT',
      { message: msg, content: b64encode(entry), branch: 'main' }, env.GITHUB_TOKEN);
    if (!put.ok) {
      // Deliberately vague to the caller; the detail stays in the Worker log.
      console.log('statement write failed', put.status);
      return reply({ error: 'the villa could not remember that' }, 502, origin);
    }

    // The manifest is rebuilt from the REMOTE copy every time, never from what
    // the client thinks the feed contains (see appendManifest).
    const lag = await appendManifest('feed/manifest.json', entry, msg, env.GITHUB_TOKEN);
    // The statement file landed; only the index is behind. The next post will
    // pick it up, so this is a warning rather than a failure.
    return reply(lag ? { ok: true, entry, warning: 'stele placed, ledger lagging' } : { ok: true, entry }, 200, origin);
  },
};

// The manifest is rebuilt from the REMOTE copy every time, never from what
// the client thinks the feed contains. That is what stops one visitor's
// stale tab from erasing everyone else's statements — the old client
// uploaded its own whole list, which was a lost-update waiting to happen.
// 409 means someone else committed between our read and our write: re-read
// and try again rather than clobbering them. Returns true when the index is
// still behind after four tries (the entry file itself has landed either way).
async function appendManifest(path, entry, msg, token) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await gh(path, 'GET', null, token, '?ref=main');
    let entries = [];
    let sha;
    if (cur.ok && cur.data && cur.data.content) {
      sha = cur.data.sha;
      try {
        const parsed = JSON.parse(b64decode(cur.data.content));
        if (Array.isArray(parsed.entries)) entries = parsed.entries;
      } catch (e) { entries = []; }
    }
    if (entries.some(e => e && e.id === entry.id)) return false;
    entries.unshift(entry);
    entries.sort((a, b) => (a.t < b.t ? 1 : -1));
    const upd = await gh(path, 'PUT', {
      message: `${msg} (manifest)`,
      content: b64encode({ entries }),
      branch: 'main',
      ...(sha ? { sha } : {}),
    }, token);
    if (upd.ok) return false;
    if (upd.status !== 409) break;
  }
  return true;
}
