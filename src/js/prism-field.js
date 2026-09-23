// ═══════════════════════════════════════════════════════════════════════
// PRISM FIELD — profiles and public pins for the beta (2026-09-22)
//
// Identity is the villa's: the passcode that opens the Dream Getty opens
// Beam. The burn-gate (villa-gate deployed a second time with REPO =
// sailor7613/Prism) names the resident from the key — the client's claim is
// never consulted — and writes each commit as a public BURN under the avatar:
//   data/field/<rid>/<id>.json  +  data/field/<rid>/manifest.json
// Sailor, 2026-09-22: "pins should definitely be public." A burn is a stele.
//
// Reads are keyless off the public repo (raw), like Readings. Profiles (a
// resident's display name + bio) are read from the villa's own feed — they
// are already the person's, written in the villa.
//
// Public: PrismField.knock(pass) · bound() · unbind() · pushBurn(commit) ·
//         pullField(rid) · field(rid) · profileOf(avatar) · roster
// ═══════════════════════════════════════════════════════════════════════
const PrismField = (() => {
  'use strict';
  const GATE = (typeof window !== 'undefined' && window.PRISM_BURN_GATE) || 'https://burn-gate.shanecorwin.workers.dev';
  const RAW_PRISM = 'https://raw.githubusercontent.com/sailor7613/Prism/main/';
  const RAW_VILLA = 'https://raw.githubusercontent.com/sailor7613/dreamgetty/main/';
  const K_PASS = 'prism.beam.pass', K_AVATAR = 'prism.beam.avatar';
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} },
  };

  // The villa's residents (ASSIGNABLE + Ted), as Prism shows them. Keys are
  // the gate's; names and creatures are for the surface. Keep in step with
  // the villa's roster when a resident is added there.
  const roster = {
    trout: { name: 'Trout', creature: 'trout' }, seal: { name: 'the Seal', creature: 'seal' },
    y2k: { name: 'Y2K', creature: 'husky' }, otter: { name: 'the Otter Princess', creature: 'otter' },
    petra: { name: 'Petra', creature: 'shark' }, kyle: { name: 'Kyle', creature: 'dolphin' },
    diddy: { name: 'Diddy', creature: 'diddy' }, richard: { name: 'Richard', creature: 'wizard' },
    julia: { name: 'Julia', creature: 'raven' }, emilia: { name: 'Emilia', creature: 'heron' },
    adlib: { name: 'Adlib', creature: 'stoat' }, austin: { name: 'Austin', creature: 'pelican' },
    houston: { name: 'Houston', creature: 'greyhound' }, turtle: { name: 'the Sea Turtle', creature: 'turtle' },
    edburg: { name: 'Edburg', creature: 'house cat' }, luke: { name: 'Luke', creature: 'albatross' },
    bigcolin: { name: 'Big Colin', creature: 'raccoon' }, doctorcolin: { name: 'Doctor Colin', creature: 'blue sparrow' },
    'alrik-new': { name: 'Alrik', creature: 'beaver' }, haley: { name: 'Haley', creature: 'red fox' },
    ted: { name: 'Ted Turner', creature: 'coyote' }, guest: { name: 'a guest', creature: 'visitor' },
  };
  const nameOf = (avatar) => (roster[avatar] && roster[avatar].name) || avatar || 'someone';

  // ── the door ────────────────────────────────────────────────────────
  async function knock(pass) {
    const p = String(pass || '').trim();
    if (!p) return { ok: false, error: 'no key' };
    let res, json = null;
    try {
      res = await fetch(GATE + '/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass: p }) });
      try { json = await res.json(); } catch (e) {}
    } catch (e) { return { ok: false, error: 'the door is not answering' }; }
    if (!res.ok) return { ok: false, error: (json && json.error) || ('refused (' + res.status + ')') };
    if (!json || !json.avatar) return { ok: false, error: 'that key opens the villa but does not name you — ask Sailor for your own' };
    store.set(K_PASS, p); store.set(K_AVATAR, json.avatar);
    return { ok: true, avatar: json.avatar, name: nameOf(json.avatar) };
  }
  function bound() { const a = store.get(K_AVATAR); return a ? { avatar: a, name: nameOf(a), creature: (roster[a] || {}).creature || null } : null; }
  function unbind() { store.set(K_PASS, null); store.set(K_AVATAR, null); }

  // ── a burn: the commit, under the avatar ─────────────────────────────
  async function pushBurn(commit) {
    const pass = store.get(K_PASS);
    if (!pass) return { skipped: 'unbound' };
    const burn = {
      rid: commit.rid, title: commit.title || '',
      x: commit.x, y: commit.y, z: commit.z, quad: commit.quad, band: commit.band, intensity: commit.intensity,
      words: commit.words || '', tiles: (commit.tiles || []).map(t => ({ species: t.species, glyph: t.glyph, figure: t.figure, label: t.label, valence: t.valence })),
      device: commit.device || '',
    };
    let res, json = null;
    try {
      res = await fetch(GATE + '/burn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass, burn }) });
      try { json = await res.json(); } catch (e) {}
    } catch (e) { return { ok: false, error: 'the field is not answering' }; }
    if (!res.ok) return { ok: false, error: (json && json.error) || ('refused (' + res.status + ')') };
    // fold it into the local field at once so the plane shows it without a pull
    try {
      const cur = field(commit.rid);
      if (json && json.entry && !cur.some(e => e.id === json.entry.id)) PrismDB.setField(commit.rid, [json.entry].concat(cur));
    } catch (e) {}
    return { ok: true, entry: json && json.entry };
  }

  // ── the field: everyone's burns on a Reading ─────────────────────────
  async function pullField(rid) {
    if (!rid) return [];
    try {
      const res = await fetch(RAW_PRISM + 'data/field/' + rid + '/manifest.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.status === 404) { PrismDB.setField(rid, []); return []; }
      if (!res.ok) return field(rid);
      const j = await res.json();
      const entries = Array.isArray(j.entries) ? j.entries.filter(e => e && e.kind === 'burn') : [];
      PrismDB.setField(rid, entries);
      return entries;
    } catch (e) { return field(rid); }
  }
  function field(rid) { try { return PrismDB.getField(rid) || []; } catch (e) { return []; } }
  // one pin per resident: their latest burn on this Reading
  function latestByResident(rid) {
    const seen = new Set(), out = [];
    field(rid).slice().sort((a, b) => (a.t < b.t ? 1 : -1)).forEach(e => { if (!seen.has(e.author)) { seen.add(e.author); out.push(e); } });
    return out;
  }

  // ── profiles: what a resident said about themselves, in the villa ────
  let villaFeed = null, villaFeedAt = 0;
  async function villaProfiles() {
    if (villaFeed && Date.now() - villaFeedAt < 10 * 60 * 1000) return villaFeed;
    try {
      const res = await fetch(RAW_VILLA + 'feed/manifest.json?t=' + Math.floor(Date.now() / 600000), { cache: 'no-store' });
      if (!res.ok) return villaFeed || {};
      const j = await res.json();
      const out = {};
      (j.entries || []).filter(e => e && e.kind === 'profile').sort((a, b) => (a.t < b.t ? 1 : -1))
        .forEach(e => { if (!out[e.author]) { const parts = String(e.text || '').split(/\s[·|—]\s|\n/); out[e.author] = { name: (parts[0] || '').trim() || nameOf(e.author), bio: parts.slice(1).join(' ').trim(), t: e.t }; } });
      villaFeed = out; villaFeedAt = Date.now();
      return out;
    } catch (e) { return villaFeed || {}; }
  }
  async function profileOf(avatar) {
    const all = await villaProfiles();
    return all[avatar] || { name: nameOf(avatar), bio: '' };
  }

  return { knock, bound, unbind, pushBurn, pullField, field, latestByResident, profileOf, roster, nameOf, GATE };
})();
