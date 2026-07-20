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

  // ── Pull ──────────────────────────────────────────────────
  // Returns { pulled: n, checked: n } or throws with a readable message.
  async function pull() {
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
      let local = PrismDB.getEvents().find(e => e.rid === reading.rid);
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

  // ── Publish ───────────────────────────────────────────────
  // Publishes one local event (by local id) as its Reading file.
  // Returns { rid } or throws with a readable message.
  async function publish(localId) {
    if (!token()) throw new Error('No GitHub token — add one under Sync in the top bar');
    let ev = PrismDB.getEvent(localId);
    if (!ev) throw new Error('Nothing to publish — save first');
    if (!ev.rid) {
      ev = PrismDB.updateEvent(localId, { rid: PrismDB.mintRid() });
    }
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
    return { rid: ev.rid };
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

  return { pull, publish, token, TOKEN_KEY, getFile, putFile };
})();
