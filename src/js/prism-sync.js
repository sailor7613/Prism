// ============================================================
// PRISM SYNC — Readings unified across devices via the repo
// ------------------------------------------------------------
// The repo is the database. One JSON file per Reading in
// data/readings/, named by the Reading's stable id (rid).
// Local PrismDB event ids (evt_*) stay device-local, exactly as
// documented in CLAUDE.md; the rid is the cross-device identity.
//
// Pull  — list data/readings/ via the GitHub contents API
//         (public repo: no token needed), import anything new
//         or newer than the local copy (matched by rid,
//         last-write-wins by updatedAt).
// Publish — PUT the current Reading's file via the contents API
//         using a fine-grained personal access token scoped to
//         this repo, stored per device in localStorage.
//
// Device-local fields (id, active, syncedAt) never enter the
// file; the file carries rid + updatedAt + schema instead.
// The file also carries `billReadings` — the Reading's rows from
// prism_bill_scores with device-local keys stripped (2026-07-07).
// Pull detaches them and merges into the local store per-row.
// ============================================================
const PrismSync = (() => {
  const OWNER  = 'sailor7613';
  const REPO   = 'Prism';
  const BRANCH = 'main';
  const DIR    = 'data/readings';
  const API    = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DIR}`;
  const TOKEN_KEY = 'prism.admin.ghToken';
  const SHAS_KEY  = 'prism.sync.shas';   // rid -> last imported/published blob sha

  function token()  { return (localStorage.getItem(TOKEN_KEY) || '').trim(); }
  function shas()   { try { return JSON.parse(localStorage.getItem(SHAS_KEY)) || {}; } catch(e){ return {}; } }
  function setSha(rid, sha) { const s = shas(); s[rid] = sha; localStorage.setItem(SHAS_KEY, JSON.stringify(s)); }

  // ── Draft sync spine (2026-07-28, Store Fragmentation handoff §3) ──
  // Two more tenants of repo-as-database, same per-rid file pattern as
  // the published tier: data/readings/drafts/ (every unpublished
  // Reading, §3.1–3.2) and data/readings/desk/ (Editorial Desk runs,
  // §3.5). Each keeps its own sha cache, same shape as SHAS_KEY.
  const DRAFTS_DIR = 'data/readings/drafts';
  const DESK_DIR   = 'data/readings/desk';
  const DRAFT_SHAS_KEY = 'prism.sync.draftShas';
  const DESK_SHAS_KEY  = 'prism.sync.deskShas';
  function shasIn(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch(e){ return {}; } }
  function setShaIn(key, rid, sha) {
    const s = shasIn(key);
    if (sha == null) delete s[rid]; else s[rid] = sha;
    localStorage.setItem(key, JSON.stringify(s));
  }

  // Notices (push refusals, pull-only honesty) surface through whatever
  // status line the host page registers — never silently swallowed.
  let _notify = null;
  function onNotice(fn) { _notify = fn; }
  function notice(m) { try { if (_notify) _notify(m); else console.warn('PrismSync: ' + m); } catch(e){} }

  function headers(json) {
    const h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token()) h['Authorization'] = 'Bearer ' + token();
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  // unicode-safe base64 (chunked so large Readings don't blow the arg limit)
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ── Reading <-> event ─────────────────────────────────────
  // The file is the Reading; the local event wraps it with
  // device-local bookkeeping. Strip that bookkeeping on the way
  // out, restore nothing on the way in (import decides).
  // `billReadings` is transport, not event state: it rides the
  // file, sourced fresh from prism_bill_scores at every publish,
  // and is detached again on pull before the event upsert.
  const LOCAL_FIELDS = ['id', 'active', 'syncedAt', 'billReadings'];
  function toFile(ev) {
    const r = {};
    Object.keys(ev).forEach(k => { if (!LOCAL_FIELDS.includes(k)) r[k] = ev[k]; });
    r.schema = 'reading/v1';
    r.updatedAt = new Date().toISOString();
    const bills = PrismDB.exportBillReadings(ev.id);
    if (bills.length) r.billReadings = bills;
    return r;
  }

  // Draft variant: same stripping, but updatedAt is the SAVE's stamp,
  // not push time — it's the draft tier's LWW key (§3.2), and the
  // non-contrived rule wants the mutation's own timestamp, not the
  // transport's. (toFile re-stamps because Publish IS the mutation.)
  function toDraftFile(ev) {
    const r = {};
    Object.keys(ev).forEach(k => { if (!LOCAL_FIELDS.includes(k)) r[k] = ev[k]; });
    r.schema = 'reading/v1';
    r.updatedAt = ev.updatedAt || new Date().toISOString();
    const bills = PrismDB.exportBillReadings(ev.id);
    if (bills.length) r.billReadings = bills;
    return r;
  }

  // Published outranks draft, on every device (§3.2): locally-published
  // (syncedAt) OR present in the published tier's sha cache (populated
  // by every load's pull) — either way this Reading rides its own pipe.
  function isPublished(ev) {
    return !!(ev && (ev.syncedAt || (ev.rid && shas()[ev.rid])));
  }

  // Era bridge (2026-07-28, found live on the iPad's first pull after
  // the desktop sweep): rid propagation can't reach a local copy that
  // PREDATES rids — matching by rid alone lands the pulled Reading
  // beside it as a duplicate. Fall back to exact title match, ONLY
  // onto a local copy with NO rid, and adopt the incoming rid onto it
  // (logged lineage) — the same title fallback the 07-27 consolidation
  // used by hand, automated for the one era that needs it. An existing
  // rid is never overridden: two rid'd readings sharing a title are
  // genuinely two readings. This branch goes quiet forever once every
  // device's store is post-backfill.
  function findLocal(reading) {
    const events = PrismDB.getEvents();
    let local = events.find(e => e.rid === reading.rid);
    if (local) return local;
    const t = (reading.title || '').trim();
    if (!t) return null;
    local = events.find(e => !e.rid && (e.title || '').trim() === t);
    if (local) {
      local = PrismDB.updateEvent(local.id, { rid: reading.rid,
        ridLineage: 'adopted from sync ' + new Date().toISOString() });
    }
    return local;
  }

  // ── Pull (published tier) ─────────────────────────────────
  // Returns { pulled: n, checked: n } or throws with a readable message.
  async function pullPublished() {
    const res = await fetch(`${API}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers() });
    if (res.status === 404) return { pulled: 0, checked: 0 };   // no readings dir yet — fine
    if (!res.ok) throw new Error('GitHub list failed (' + res.status + ')');
    const list = (await res.json()).filter(f => f.type === 'file' && f.name.endsWith('.json'));
    const known = shas();
    let pulled = 0;
    for (const f of list) {
      const rid = f.name.replace(/\.json$/, '');
      if (known[rid] === f.sha) continue;                        // already have this exact version
      const fres = await fetch(f.url, { headers: headers() });   // contents API per-file (includes content)
      if (!fres.ok) continue;
      const body = await fres.json();
      let reading;
      try { reading = JSON.parse(b64decode(body.content)); } catch(e) { continue; }
      if (!reading.rid) reading.rid = rid;                       // filename is authoritative
      // Detach bill readings before the event upsert — they live in
      // the store, never on the event object.
      const bills = Array.isArray(reading.billReadings) ? reading.billReadings : null;
      if ('billReadings' in reading) delete reading.billReadings;
      let local = findLocal(reading);
      if (!local || (reading.updatedAt || '') > (local.updatedAt || '')) {
        local = PrismDB.importReading(reading);
        pulled++;
      }
      // Bill rows merge per-row (LWW by timestamp) even when the
      // event body itself wasn't newer — the file changed, so its
      // bills may be.
      if (bills && local) PrismDB.importBillReadings(local.id, bills);
      setSha(rid, f.sha);
    }
    return { pulled, checked: list.length };
  }

  // ── Pull (draft tier, §3.1–3.2) ───────────────────────────
  // Same machinery over data/readings/drafts/. LWW by updatedAt with
  // two standing guards: a newer LOCAL draft outranks an older repo
  // copy (skip — this device's next push carries it), and a locally-
  // PUBLISHED Reading never takes a draft (a stale park draft must
  // never clobber the published Reading — _applyDraft's rule, held).
  async function pullDrafts() {
    const res = await fetch(`${FILE_API}${DRAFTS_DIR}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers() });
    if (res.status === 404) return { pulled: 0, checked: 0 };   // no drafts dir yet — fine
    if (!res.ok) throw new Error('GitHub list failed (' + res.status + ')');
    const list = (await res.json()).filter(f => f.type === 'file' && f.name.endsWith('.json'));
    const known = shasIn(DRAFT_SHAS_KEY);
    let pulled = 0;
    for (const f of list) {
      const rid = f.name.replace(/\.json$/, '');
      if (known[rid] === f.sha) continue;
      const fres = await fetch(f.url, { headers: headers() });
      if (!fres.ok) continue;
      let reading;
      try { reading = JSON.parse(b64decode((await fres.json()).content)); } catch(e) { continue; }
      if (!reading.rid) reading.rid = rid;                       // filename is authoritative
      const bills = Array.isArray(reading.billReadings) ? reading.billReadings : null;
      if ('billReadings' in reading) delete reading.billReadings;
      let local = findLocal(reading);
      if (local && local.syncedAt) { setShaIn(DRAFT_SHAS_KEY, rid, f.sha); continue; }
      if (!local || (reading.updatedAt || '') > (local.updatedAt || '')) {
        local = PrismDB.importReading(reading);
        pulled++;
      }
      if (bills && local) PrismDB.importBillReadings(local.id, bills);
      setShaIn(DRAFT_SHAS_KEY, rid, f.sha);
    }
    return { pulled, checked: list.length };
  }

  // ── Push (draft tier) ─────────────────────────────────────
  // One draft file per save-touched Reading. Refusal warns, never
  // silently overwrites: if the repo copy is NEWER than this device's,
  // the push declines and says so — the next pull applies it instead.
  async function pushDraft(localId) {
    if (!token()) throw new Error('No GitHub token on this origin — pulls only');
    const ev = PrismDB.getEvent(localId);
    if (!ev) throw new Error('Nothing to push — save first');
    // NO minting here (§3.4): pre-rid readings exist on several origins;
    // minting at push would fork identities. Backfill runs once, on the
    // canonical origin (PrismDB.backfillRids) — until then they stay home.
    if (!ev.rid) return { skipped: 'no rid — backfill on the canonical origin first' };
    if (isPublished(ev)) return { rid: ev.rid, skipped: 'published' };  // its own pipe
    const file = toDraftFile(ev);
    const rel = `${DRAFTS_DIR}/${ev.rid}.json`;
    const cur = await getFile(rel);
    if (cur && cur.json && (cur.json.updatedAt || '') > (file.updatedAt || '')) {
      notice('⚠ draft push refused for “' + (ev.title || ev.rid) + '” — the repo copy is newer (' +
        String(cur.json.updatedAt).slice(0, 19) + '); reload to pull it');
      return { rid: ev.rid, refused: cur.json.updatedAt };
    }
    const sha = await putFile(rel, file, 'Draft: ' + (ev.title || ev.rid), cur ? cur.sha : undefined);
    setShaIn(DRAFT_SHAS_KEY, ev.rid, sha);
    return { rid: ev.rid, pushed: true };
  }

  // Every unpublished Reading, one pass — the ⇡ full-sync gesture and
  // the first-run sweep. Refusals count, never throw.
  async function pushAllDrafts() {
    const out = { pushed: 0, refused: 0, skipped: 0, failed: 0 };
    if (!token()) return out;
    for (const ev of PrismDB.getEvents()) {
      if (isPublished(ev)) { out.skipped++; continue; }
      try {
        const r = await pushDraft(ev.id);
        if (r.pushed) out.pushed++;
        else if (r.refused) out.refused++;
        else out.skipped++;
      } catch (e) { out.failed++; }
    }
    return out;
  }

  // Deleting a draft everywhere = deleting its repo file (deletion has
  // to propagate, or a locally-pruned dup resurrects on the next pull).
  // Callers confirm; this just does it. Quiet 404 = already gone.
  async function deleteDraft(rid) {
    if (!token()) throw new Error('No GitHub token on this origin — pulls only');
    const rel = `${DRAFTS_DIR}/${rid}.json`;
    const cur = await getFile(rel);
    if (!cur) { setShaIn(DRAFT_SHAS_KEY, rid, null); return { rid, gone: true }; }
    const res = await fetch(`${FILE_API}${rel}`, {
      method: 'DELETE',
      headers: headers(true),
      body: JSON.stringify({ message: 'Remove draft ' + rid, branch: BRANCH, sha: cur.sha })
    });
    if (!res.ok) throw new Error('Draft delete failed (HTTP ' + res.status + ')');
    setShaIn(DRAFT_SHAS_KEY, rid, null);
    return { rid, deleted: true };
  }

  // ── Bake-at-publish (ruled 2026-07-19; load-bearing per the Photo
  // Z-Probe session — two of six event photos never cleared their outlets'
  // CORS walls live, and og:image URLs rot) ─────────────────
  // Once photographs are structural on the graph (boundary washes, placed
  // moments, the introit), Publish fetches each kept image and commits it
  // into the repo beside the reading JSON (data/readings/images/<rid>/…).
  // The entry gains `baked` = repo-relative path; consumers prefer it and
  // fall back to the hotlink. An image the browser can't fetch (CORS wall,
  // rot) simply stays hotlinked — graceful decay, publish never blocks.
  // Filenames are a hash of the source URL, so re-publishing skips images
  // already in the repo instead of duplicating them.
  const IMG_DIR = 'data/readings/images';

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
  function b64bytes(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin);
  }

  // Mutates ev.images in place (adds `baked`). Returns { baked, hotlinked, changed }.
  async function bakeImages(ev) {
    const out = { baked: 0, hotlinked: 0, changed: false };
    if (!Array.isArray(ev.images) || !ev.images.length) return out;
    for (const p of ev.images) {
      if (!p || !p.url) continue;
      if (p.baked) { out.baked++; continue; }               // already in the repo
      try {
        const res = await fetch(p.url, { mode: 'cors' });
        if (!res.ok) throw new Error('http ' + res.status);
        const type = res.headers.get('content-type') || '';
        if (type && !type.toLowerCase().startsWith('image/')) throw new Error('not an image');
        const buf = await res.arrayBuffer();
        if (!buf.byteLength) throw new Error('empty body');
        const rel = IMG_DIR + '/' + ev.rid + '/' + urlHash(p.url) + '.' + extFromType(type);
        const put = await fetch(`${FILE_API}${rel}`, {
          method: 'PUT',
          headers: headers(true),
          body: JSON.stringify({
            message: 'Bake image for ' + ev.rid,
            branch: BRANCH,
            content: b64bytes(buf),
          })
        });
        // 422 without sha = the file already exists (same URL hash → same
        // source) — that's success, not conflict.
        if (!put.ok && put.status !== 422) throw new Error('put ' + put.status);
        p.baked = rel; out.baked++; out.changed = true;
      } catch (e) {
        out.hotlinked++;                                    // CORS wall or rot — hotlink, graceful decay
      }
    }
    return out;
  }

  // ── Publish ───────────────────────────────────────────────
  // Publishes one local event (by local id) as its Reading file.
  // Returns { rid, bake } or throws with a readable message.
  async function publish(localId) {
    if (!token()) throw new Error('No GitHub token — add one under Sync in the top bar');
    let ev = PrismDB.getEvent(localId);
    if (!ev) throw new Error('Nothing to publish — save first');
    if (!ev.rid) {
      ev = PrismDB.updateEvent(localId, { rid: PrismDB.mintRid() });
    }
    // Bake kept images into the repo BEFORE assembling the file, so the
    // published Reading carries its `baked` paths to every device.
    let bake = null;
    try {
      bake = await bakeImages(ev);
      if (bake.changed) ev = PrismDB.updateEvent(localId, { images: ev.images });
    } catch (e) { bake = null; }   // baking never blocks a publish
    const file = toFile(ev);
    const path = `${API}/${ev.rid}.json`;

    // current remote sha (needed to update; also our conflict signal)
    let sha = null, remote = null;
    const cur = await fetch(`${path}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers() });
    if (cur.ok) {
      const body = await cur.json();
      sha = body.sha;
      try { remote = JSON.parse(b64decode(body.content)); } catch(e) { remote = null; }
    } else if (cur.status !== 404) {
      throw new Error('GitHub read failed (' + cur.status + ')');
    }

    // conflict guard: remote moved past what this device last synced
    if (remote && shas()[ev.rid] && shas()[ev.rid] !== sha) {
      const when = remote.updatedAt ? new Date(remote.updatedAt).toLocaleString() : 'unknown time';
      if (!confirm('“' + (ev.title || ev.rid) + '” changed in the repo (' + when + ') since this device last synced.\n\nOverwrite with this device’s version?')) {
        throw new Error('Publish cancelled — pull first to take the repo version');
      }
    }

    const put = await fetch(path, {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify({
        message: 'Reading: ' + (ev.title || ev.rid),
        branch: BRANCH,
        content: b64encode(JSON.stringify(file, null, 2)),
        ...(sha ? { sha } : {})
      })
    });
    if (!put.ok) {
      const msg = put.status === 401 ? 'token rejected' :
                  put.status === 403 ? 'token lacks access to the repo' :
                  put.status === 409 || put.status === 422 ? 'repo changed mid-publish — pull, then publish again' :
                  'HTTP ' + put.status;
      throw new Error('Publish failed: ' + msg);
    }
    const out = await put.json();
    setSha(ev.rid, out.content.sha);
    PrismDB.updateEvent(localId, { updatedAt: file.updatedAt, syncedAt: file.updatedAt });
    // The Reading has left the draft tier (§3.1: candidate lineage
    // stays, the drafts file stops carrying it) — remove its draft
    // file so no origin ever re-imports a pre-publish copy. Quiet:
    // a failed cleanup only leaves a stale draft that LWW outranks.
    try { await deleteDraft(ev.rid); } catch (e) { /* publish already succeeded */ }
    return { rid: ev.rid, bake };
  }

  // ── Generic repo-file transport (2026-07-15) ──────────────
  // The Readings dir was the first tenant of repo-as-database; the
  // committed middle stratum (data/candidate_scores.json) is the second.
  // These are the raw verbs: GET/PUT one JSON file by repo-relative path.
  // GET is keyless on the public repo; PUT needs the same token Publish
  // uses. Callers carry the sha between get and put (conflict signal).
  const FILE_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;

  // → { json, sha } | null (404 = file doesn't exist yet — fine)
  async function getFile(relPath) {
    const res = await fetch(`${FILE_API}${relPath}?ref=${BRANCH}&t=${Date.now()}`,
      { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('GitHub read failed (' + res.status + ')');
    const body = await res.json();
    let json = null;
    try { json = JSON.parse(b64decode(body.content)); } catch (e) { /* caller decides */ }
    return { json, sha: body.sha };
  }

  // → new sha. Pass the sha from getFile to update; omit to create.
  async function putFile(relPath, obj, message, sha) {
    if (!token()) throw new Error('No GitHub token — add one under Sync in the top bar');
    const put = await fetch(`${FILE_API}${relPath}`, {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify({
        message: message || ('Update ' + relPath),
        branch: BRANCH,
        content: b64encode(JSON.stringify(obj, null, 2)),
        ...(sha ? { sha } : {})
      })
    });
    if (!put.ok) {
      const msg = put.status === 401 ? 'token rejected' :
                  put.status === 403 ? 'token lacks access to the repo' :
                  put.status === 409 || put.status === 422 ? 'repo changed mid-push — pull, then push again' :
                  'HTTP ' + put.status;
      throw new Error('Push failed: ' + msg);
    }
    return (await put.json()).content.sha;
  }

  // ── Desk tier (§3.5 — RULED convergent this session) ──────
  // One file per rid under data/readings/desk/. The desk record is
  // keyed locally by eventId (device-local!); the file rides the rid
  // and import rewrites onto this device's event id — evt_* never
  // crosses a device boundary. LWW per record on updatedAt, applied
  // by PrismDB.importDeskRecord (preserves the remote stamp; saveDesk
  // re-stamps and would break convergence).
  async function pullDesk() {
    if (!PrismDB.importDeskRecord) return { pulled: 0, checked: 0 };  // version skew — quiet
    const res = await fetch(`${FILE_API}${DESK_DIR}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers() });
    if (res.status === 404) return { pulled: 0, checked: 0 };
    if (!res.ok) throw new Error('GitHub list failed (' + res.status + ')');
    const list = (await res.json()).filter(f => f.type === 'file' && f.name.endsWith('.json'));
    const known = shasIn(DESK_SHAS_KEY);
    let pulled = 0;
    for (const f of list) {
      const rid = f.name.replace(/\.json$/, '');
      if (known[rid] === f.sha) continue;
      const fres = await fetch(f.url, { headers: headers() });
      if (!fres.ok) continue;
      let file;
      try { file = JSON.parse(b64decode((await fres.json()).content)); } catch(e) { continue; }
      if (!file || file.schema !== 'desk/v1' || !file.record) { setShaIn(DESK_SHAS_KEY, rid, f.sha); continue; }
      const local = PrismDB.getEvents().find(e => e.rid === rid);
      // No local Reading for this rid yet — leave the sha unset so the
      // record retries after a later pull lands the Reading itself.
      if (!local) continue;
      const rec = { ...file.record, updatedAt: file.updatedAt || file.record.updatedAt };
      if (PrismDB.importDeskRecord(local.id, rec)) pulled++;
      setShaIn(DESK_SHAS_KEY, rid, f.sha);
    }
    return { pulled, checked: list.length };
  }

  async function pushDesk(eventId) {
    if (!token()) throw new Error('No GitHub token on this origin — pulls only');
    const rec = PrismDB.getDesk ? PrismDB.getDesk(eventId) : null;
    if (!rec) return { skipped: 'no desk run' };
    const ev = PrismDB.getEvent(eventId);
    if (!ev) return { skipped: 'no event' };
    if (!ev.rid) return { skipped: 'no rid — backfill on the canonical origin first' };
    const record = {};
    Object.keys(rec).forEach(k => { if (k !== 'eventId') record[k] = rec[k]; });
    const file = { schema: 'desk/v1', rid: ev.rid, updatedAt: rec.updatedAt || new Date().toISOString(), record };
    const rel = `${DESK_DIR}/${ev.rid}.json`;
    const cur = await getFile(rel);
    if (cur && cur.json && (cur.json.updatedAt || '') > (file.updatedAt || '')) {
      notice('⚠ desk push refused for “' + (ev.title || ev.rid) + '” — the repo copy is newer; reload to pull it');
      return { rid: ev.rid, refused: cur.json.updatedAt };
    }
    const sha = await putFile(rel, file, 'Desk run: ' + (ev.title || ev.rid), cur ? cur.sha : undefined);
    setShaIn(DESK_SHAS_KEY, ev.rid, sha);
    return { rid: ev.rid, pushed: true };
  }

  async function pushAllDesk() {
    const out = { pushed: 0, refused: 0, skipped: 0, failed: 0 };
    if (!token() || !PrismDB.getDesks) return out;
    for (const eventId of Object.keys(PrismDB.getDesks())) {
      try {
        const r = await pushDesk(eventId);
        if (r.pushed) out.pushed++;
        else if (r.refused) out.refused++;
        else out.skipped++;
      } catch (e) { out.failed++; }
    }
    return out;
  }

  // ── Unified pull — on load, everywhere (§3.2) ─────────────
  // Published first (published outranks draft), then drafts, then desk
  // (a desk record needs its Reading in the store to land). A tier
  // failing never blocks the others; errors ride the result.
  async function pull() {
    const r = await pullPublished();               // throws like it always did
    const out = { pulled: r.pulled, checked: r.checked, draftsPulled: 0, deskPulled: 0 };
    try { out.draftsPulled = (await pullDrafts()).pulled; }
    catch (e) { out.draftsError = e.message; }
    try { out.deskPulled = (await pullDesk()).pulled; }
    catch (e) { out.deskError = e.message; }
    return out;
  }

  // ── Auto-carry queues (§3.1 — every save carries its draft) ──
  // Same debounce discipline as the newsroom's nrQueuePush: 2.5s
  // quiet, token-gated (pull-only origins no-op — load-time honesty
  // already said so), flushed immediately when the tab hides (mobile
  // PWAs get backgrounded mid-debounce).
  const _q = { draft: new Set(), desk: new Set() };
  let _qTimer = null;
  async function flushQueues() {
    clearTimeout(_qTimer); _qTimer = null;
    const drafts = [..._q.draft]; _q.draft.clear();
    const desks  = [..._q.desk];  _q.desk.clear();
    for (const id of drafts) { try { await pushDraft(id); } catch (e) { notice('draft push failed: ' + e.message); } }
    for (const id of desks)  { try { await pushDesk(id); }  catch (e) { notice('desk push failed: ' + e.message); } }
  }
  function _queue(kind, localId) {
    if (!localId) return;
    try { if (!token()) return; } catch (e) { return; }
    _q[kind].add(localId);
    clearTimeout(_qTimer);
    _qTimer = setTimeout(flushQueues, 2500);
  }
  function queueDraftPush(localId) { _queue('draft', localId); }
  function queueDeskPush(eventId)  { _queue('desk', eventId); }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && _qTimer) flushQueues();
    });
  }

  return { pull, publish, token, TOKEN_KEY, getFile, putFile,
           pushDraft, pushAllDrafts, deleteDraft, queueDraftPush,
           pushDesk, pushAllDesk, queueDeskPush, flushQueues, onNotice };
})();
