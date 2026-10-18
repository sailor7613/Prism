/* codex.js — the Codex, as a plug-in any G4 program can carry (2026-10-17).
   A small ¶ in the corner opens a panel over the page: Ted's head across the top
   fifth, the words used on this page, every entry, how the pieces fit together,
   and a box to ask Ted. Entries come from one shared file (data/codex.json).
   Ted's answers come from the ted-gate (window.PRISM_TED.gate); the key never
   reaches the browser.

   Host API:  Codex.init({ codexUrl })            once, after the page loads
              Codex.setContext({ page, terms: ['dial','z'], context: () => 'plain text about what's on screen' })
              Codex.open('z') / Codex.close()
   Any element with data-codex="term" opens that entry when tapped. */
(function (root) {
  'use strict';
  const S = { entries: {}, order: [], intro: '', ctx: { page: '', terms: [], context: '' }, history: [], ready: null, built: false, open: false, busy: false };
  const $ = (q, el) => (el || document).querySelector(q);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function css() {
    const s = document.createElement('style');
    s.textContent = `
    .cx-glyph { position: fixed; right: 14px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); z-index: 80; width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(233,236,242,.25); background: rgba(10,18,38,.85); color: #e9ecf2; font: 20px Georgia, serif; cursor: pointer; display: grid; place-items: center; box-shadow: 0 4px 18px rgba(0,0,0,.4); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    .cx-glyph::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; padding: 1px; background: linear-gradient(135deg, #8fd0ff, #c9a0ff, #ffd28f); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; opacity: .7; }
    .cx-scrim { position: fixed; inset: 0; z-index: 81; background: rgba(3,6,14,.5); opacity: 0; pointer-events: none; transition: opacity .25s; }
    .cx-panel { position: fixed; z-index: 82; left: 0; right: 0; bottom: 0; height: 86vh; display: grid; grid-template-rows: 20% 1fr auto; background: #0b1224; border-top: 1px solid rgba(233,236,242,.18); border-radius: 12px 12px 0 0; transform: translateY(102%); transition: transform .35s cubic-bezier(.2,.8,.2,1); color: #e9ecf2; font-family: Georgia, 'Times New Roman', serif; overflow: hidden; }
    @media (min-width: 900px) { .cx-panel { left: auto; right: 16px; bottom: 16px; width: 440px; height: 84vh; border: 1px solid rgba(233,236,242,.18); border-radius: 12px; } }
    .cx-on .cx-scrim { opacity: 1; pointer-events: auto; } .cx-on .cx-panel { transform: none; }
    .cx-ted { position: relative; display: grid; grid-template-columns: 34% 1fr; align-items: stretch; border-bottom: 1px solid rgba(233,236,242,.1); background: radial-gradient(ellipse at 20% 60%, rgba(60,80,140,.35), rgba(0,0,0,0) 70%); min-height: 120px; }
    .cx-ted canvas { width: 100%; height: 100%; display: block; }
    .cx-say { align-self: center; margin: 10px 16px 10px 0; max-height: calc(100% - 20px); overflow-y: auto; font-size: 13.5px; line-height: 1.42; color: #e9ecf2; }
    .cx-say.think { color: rgba(233,236,242,.55); font-style: italic; }
    .cx-x { position: absolute; top: 8px; right: 10px; background: none; border: 0; color: rgba(233,236,242,.5); font: 10px ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; }
    .cx-body { overflow-y: auto; padding: 14px 16px 20px; }
    .cx-k { font: 9.5px ui-monospace, Menlo, monospace; letter-spacing: .2em; text-transform: uppercase; color: rgba(233,236,242,.45); margin: 14px 0 8px; }
    .cx-k:first-child { margin-top: 0; }
    .cx-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .cx-chip { font: 12px ui-monospace, Menlo, monospace; padding: 5px 10px; border: 1px solid rgba(233,236,242,.2); border-radius: 999px; background: none; color: #e9ecf2; cursor: pointer; }
    .cx-chip.on { background: #e9ecf2; color: #0c0b09; }
    .cx-entry { margin: 12px 0 4px; padding: 12px 14px; border: 1px solid rgba(233,236,242,.14); border-radius: 6px; background: rgba(233,236,242,.03); }
    .cx-entry h4 { margin: 0 0 6px; font-weight: 400; font-size: 20px; background: linear-gradient(90deg, #a8dcff, #d9b8ff, #ffe0a8); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .cx-entry p { margin: 0; font-size: 15px; line-height: 1.5; color: rgba(233,236,242,.85); }
    .cx-find { width: 100%; box-sizing: border-box; background: rgba(233,236,242,.05); border: 1px solid rgba(233,236,242,.18); color: #e9ecf2; font: 14px Georgia, serif; padding: 9px 11px; border-radius: 4px; }
    .cx-list a, .cx-map a { display: block; padding: 8px 0; border-bottom: 1px solid rgba(233,236,242,.07); color: #e9ecf2; text-decoration: none; font-size: 15px; cursor: pointer; }
    .cx-list a small { display: block; font-size: 12.5px; color: rgba(233,236,242,.5); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cx-map { counter-reset: s; } .cx-map a::before { counter-increment: s; content: counter(s) '  '; font: 10px ui-monospace, Menlo, monospace; color: rgba(233,236,242,.4); }
    .cx-ask { display: flex; gap: 8px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid rgba(233,236,242,.12); background: #0a1020; }
    .cx-ask input { flex: 1; min-width: 0; background: rgba(233,236,242,.06); border: 1px solid rgba(233,236,242,.2); color: #e9ecf2; font: 15px Georgia, serif; padding: 10px 12px; border-radius: 6px; }
    .cx-ask button { font: 11px ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; padding: 0 14px; border-radius: 6px; border: 1px solid #e9ecf2; background: #e9ecf2; color: #0c0b09; cursor: pointer; }
    .cx-ask button:disabled { opacity: .5; }
    [data-codex] { cursor: help; }
    `;
    document.head.appendChild(s);
  }

  function build() {
    if (S.built) return; S.built = true; css();
    const g = document.createElement('button'); g.className = 'cx-glyph'; g.type = 'button'; g.title = 'the Codex'; g.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M18.6 6.4A8.4 8.4 0 1 0 18.6 17.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    // inside the G4 shell the Codex button lives in the bar; the floating one is for a program opened on its own
    if (root.parent !== root) g.style.display = 'none';
    addEventListener('message', e => { if ((e.data || {}).type === 'g4:codex') { if (S.open) close(); else open(); } });
    const scrim = document.createElement('div'); scrim.className = 'cx-scrim';
    const p = document.createElement('aside'); p.className = 'cx-panel'; p.setAttribute('aria-label', 'the Codex');
    p.innerHTML = `<div class="cx-ted"><canvas id="cdxTed"></canvas><div class="cx-say" id="cdxSay"></div><button class="cx-x" id="cdxX">close</button></div>
      <div class="cx-body" id="cdxBody">
        <div class="cx-k" id="cdxHereK">on this page</div><div class="cx-chips" id="cdxHere"></div>
        <div class="cx-entry" id="cdxEntry" hidden><h4></h4><p></p></div>
        <div class="cx-k">every word</div><input class="cx-find" id="cdxFind" type="search" placeholder="look up a word" autocomplete="off"><div class="cx-list" id="cdxList"></div>
        <div class="cx-k">how it fits together</div><div class="cx-map" id="cdxMap"></div>
      </div>
      <form class="cx-ask" id="cdxAsk"><input id="cdxQ" placeholder="Ask Ted anything" autocomplete="off" maxlength="600"><button id="cdxGo" type="submit">ask</button></form>`;
    document.body.appendChild(g); document.body.appendChild(scrim); document.body.appendChild(p);
    g.addEventListener('click', () => open());
    scrim.addEventListener('click', close); $('#cdxX').addEventListener('click', close);
    addEventListener('keydown', e => { if (e.key === 'Escape' && S.open) close(); });
    $('#cdxFind').addEventListener('input', paintList);
    $('#cdxAsk').addEventListener('submit', e => { e.preventDefault(); ask(); });
    document.addEventListener('click', e => { const t = e.target.closest('[data-codex]'); if (!t || t.closest('.cx-panel')) return; e.preventDefault(); open(t.dataset.codex); });
  }

  function key(term) {
    if (!term) return null; const t = String(term).toLowerCase().trim();
    if (S.entries[t]) return t;
    for (const k in S.entries) { const e = S.entries[k]; if ((e.word || '').toLowerCase() === t || (e.aka || []).some(a => a.toLowerCase() === t)) return k; }
    return null;
  }
  function showEntry(k) {
    const e = S.entries[k], box = $('#cdxEntry'); if (!e) { box.hidden = true; return; }
    box.hidden = false; box.querySelector('h4').textContent = e.word; box.querySelector('p').textContent = e.text;
    document.querySelectorAll('.cx-chip').forEach(c => c.classList.toggle('on', c.dataset.k === k));
    say(e.text, true);
  }
  function paintHere() {
    const terms = (S.ctx.terms || []).map(key).filter(Boolean);
    $('#cdxHereK').hidden = !terms.length;
    $('#cdxHere').innerHTML = terms.map(k => `<button type="button" class="cx-chip" data-k="${k}">${esc(S.entries[k].word)}</button>`).join('');
    $('#cdxHere').querySelectorAll('.cx-chip').forEach(c => c.addEventListener('click', () => showEntry(c.dataset.k)));
  }
  function paintList() {
    const q = ($('#cdxFind').value || '').toLowerCase().trim();
    const ks = S.order.concat(Object.keys(S.entries).filter(k => !S.order.includes(k))).filter(k => S.entries[k] && (!q || (S.entries[k].word + ' ' + S.entries[k].text + ' ' + (S.entries[k].aka || []).join(' ')).toLowerCase().includes(q)));
    $('#cdxList').innerHTML = (q ? ks : ks.slice(0, 8)).map(k => `<a data-k="${k}">${esc(S.entries[k].word)}<small>${esc(S.entries[k].text)}</small></a>`).join('') || '<a>Nothing by that word. Ask Ted.</a>';
    $('#cdxList').querySelectorAll('a[data-k]').forEach(a => a.addEventListener('click', () => { showEntry(a.dataset.k); $('#cdxBody').scrollTo({ top: 0, behavior: 'smooth' }); }));
  }
  function paintMap() {
    $('#cdxMap').innerHTML = S.order.filter(k => S.entries[k]).slice(0, 9).map(k => `<a data-k="${k}">${esc(S.entries[k].word)}</a>`).join('');
    $('#cdxMap').querySelectorAll('a').forEach(a => a.addEventListener('click', () => { showEntry(a.dataset.k); $('#cdxBody').scrollTo({ top: 0, behavior: 'smooth' }); }));
  }

  // ── Ted's head ──
  const T = { r: null, scene: null, cam: null, ted: null, talkUntil: 0, think: false, raf: 0, mx: 0, my: 0 };
  function tedInit() {
    if (T.r !== null) return; T.r = false;
    const cv = $('#cdxTed');
    if (!root.THREE || typeof PrismGraphmap === 'undefined' || !PrismGraphmap.buildCoyote) { cv.outerHTML = '<div style="display:grid;place-items:center;font:44px Georgia,serif;color:#c9a46a">T</div>'; return; }
    try { T.r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return; }
    T.r.setPixelRatio(Math.min(devicePixelRatio, 2));
    T.scene = new THREE.Scene();
    T.scene.add(new THREE.AmbientLight(0x9aa6c8, 0.55));
    const key = new THREE.DirectionalLight(0xfff0dc, 1.0); key.position.set(1.5, 2.5, 3); T.scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8c8ff, 0.6); rim.position.set(-2, 1.5, -1.5); T.scene.add(rim);
    T.ted = PrismGraphmap.buildCoyote(); T.scene.add(T.ted);
    // just the head: the body sits below the frame
    T.cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20); T.cam.position.set(0.18, 1.3, 2.15); T.cam.lookAt(0, 1.22, 0.45);
    addEventListener('pointermove', e => { T.mx = e.clientX / innerWidth - 0.5; T.my = e.clientY / innerHeight - 0.5; }, { passive: true });
    tedSize(); addEventListener('resize', tedSize);
  }
  function tedSize() { if (!T.r) return; const cv = $('#cdxTed'), r = cv.getBoundingClientRect(); if (!r.width) return; T.r.setSize(r.width, r.height, false); T.cam.aspect = r.width / r.height; T.cam.updateProjectionMatrix(); }
  function tedLoop() {
    cancelAnimationFrame(T.raf);
    const tick = ms => {
      if (!S.open || !T.r) return; T.raf = requestAnimationFrame(tick);
      const t = ms / 1000, U = T.ted.userData, head = U.head, ears = U.ears || [];
      if (head) {
        const ty = T.mx * 0.7 + 0.25, tx = T.my * 0.35 - 0.05, tz = T.think ? Math.sin(t * 1.6) * 0.18 + 0.12 : 0;
        head.rotation.y += (ty - head.rotation.y) * 0.08; head.rotation.x += (tx - head.rotation.x) * 0.08; head.rotation.z += (tz - head.rotation.z) * 0.08;
      }
      const talking = performance.now() < T.talkUntil;
      if (U.jaw) U.jaw.position.y = (1.11 - 1.20) - (talking ? (0.5 + 0.5 * Math.sin(t * 17)) * 0.035 : 0);
      if (ears[0]) ears[0].rotation.x = T.think ? Math.sin(t * 3) * 0.2 : Math.max(0, Math.sin(t * 0.7) - 0.97) * 8;
      if (U.tail) U.tail.rotation.y = Math.sin(t * 2.2) * 0.35;
      T.r.render(T.scene, T.cam);
    };
    T.raf = requestAnimationFrame(tick);
  }
  let sayTimer = 0;
  function say(text, quick) {
    const el = $('#cdxSay'); clearInterval(sayTimer); el.classList.remove('think'); T.think = false;
    const full = String(text || '');
    if (quick || full.length < 2) { el.textContent = full; T.talkUntil = performance.now() + Math.min(2500, full.length * 18); return; }
    let i = 0; el.textContent = ''; T.talkUntil = performance.now() + full.length * 28 + 300;
    sayTimer = setInterval(() => { i += 2; el.textContent = full.slice(0, i); el.scrollTop = el.scrollHeight; if (i >= full.length) clearInterval(sayTimer); }, 28);
  }
  function thinking() { const el = $('#cdxSay'); clearInterval(sayTimer); el.classList.add('think'); el.textContent = 'Hmm…'; T.think = true; }

  // ── asking ──
  async function ask() {
    const q = ($('#cdxQ').value || '').trim(); if (!q || S.busy) return;
    const gate = root.PRISM_TED && root.PRISM_TED.gate;
    if (!gate) { say('I can’t answer questions yet — I haven’t been switched on. The entries below are all here, though.'); return; }
    S.busy = true; $('#cdxGo').disabled = true; $('#cdxQ').value = ''; thinking();
    let ctx = S.ctx.context; try { if (typeof ctx === 'function') ctx = ctx(); } catch (e) { ctx = ''; }
    try {
      const r = await fetch(gate.replace(/\/$/, '') + '/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q, page: S.ctx.page || document.title, context: String(ctx || '').slice(0, 2500), history: S.history.slice(-6) }) });
      const j = await r.json().catch(() => ({}));
      if (j.answer) { S.history.push({ role: 'user', content: q }, { role: 'assistant', content: j.answer }); say(j.answer); }
      else say(j.error || 'I can’t be reached right now. Try again in a bit.');
    } catch (e) { say('I can’t be reached right now. Try again in a bit.'); }
    S.busy = false; $('#cdxGo').disabled = false;
  }

  function open(term) {
    build(); S.ready.then(() => {
      S.open = true; document.documentElement.classList.add('cx-on'); paintHere(); paintList(); paintMap();
      tedInit(); requestAnimationFrame(() => { tedSize(); tedLoop(); });
      const k = key(term);
      if (k) showEntry(k); else { $('#cdxEntry').hidden = true; document.querySelectorAll('.cx-chip').forEach(c => c.classList.remove('on')); if (!S.greeted) { S.greeted = true; say(S.intro); } }
    });
  }
  function close() { S.open = false; document.documentElement.classList.remove('cx-on'); cancelAnimationFrame(T.raf); }
  function init(opts) {
    opts = opts || {};
    if (!S.ready) S.ready = fetch(opts.codexUrl || '../data/codex.json', { cache: 'no-store' }).then(r => r.json()).then(j => { S.entries = j.entries || {}; S.order = j.order || Object.keys(S.entries); S.intro = j.intro || ''; }).catch(() => { S.intro = 'The Codex couldn’t load just now.'; });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
    return api;
  }
  function setContext(c) { S.ctx = Object.assign({ page: '', terms: [], context: '' }, c || {}); if (S.open) paintHere(); }
  const api = { init, open, close, setContext, lookup: k => { const kk = key(k); return kk ? S.entries[kk] : null; } };
  root.Codex = api;
})(typeof window !== 'undefined' ? window : globalThis);
