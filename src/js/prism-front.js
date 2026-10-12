// ============================================================
// THE FRONT DOOR (2026-10-08) — the landing, built out of objects.
//
// Sailor: the most interesting thing about Prism is that it re-establishes
// object permanence in discourse, and that it links to actual legislation.
// So the index of Prism is not a list of moments (the dropdown); it is the
// set of OBJECTS currently standing — each a law, order, ruling or thing with
// a date on it — and the discourse moving across them.
//
// Four moves: the HEADLINE (today's object — the one that most recently
// changed state; a rule, not a hand) · the STANDING OBJECTS (the live
// Readings as what they're about, law first) · the DOORS (the dimensions as
// rooms, each with one live line) · the RAIL (object stays, noise moves —
// next build). Phone first: one screen plus a swipe.
//
// Host contract (v2/index.html): PrismFront.show({ events, currentId }) —
// events = the live Readings (PrismDB rows), currentId = the Reading the
// page loaded. A card navigates with ?event=<id> (the portal's existing
// route). Reads ../data/active/active.json and ../data/newsroom/objects.json
// for the doors' live lines; both optional.
// ============================================================
(function () {
  'use strict';

  const CSS = `
  #front { position: fixed; inset: 0; z-index: 60; background: radial-gradient(1200px 700px at 50% -10%, rgba(32,48,96,.45), transparent 60%), #0b1020; color: #f0ebe0; font-family: Georgia, "Times New Roman", serif; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  #front[hidden] { display: none; }
  #front .fr-wrap { max-width: 1040px; margin: 0 auto; padding: max(14px, env(safe-area-inset-top)) 16px 28px; }
  #front .fr-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  #front .fr-mark { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: #7d8290; }
  #front .fr-mark b { color: #f0ebe0; font-weight: normal; letter-spacing: .12em; }
  #front .fr-x { font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #b9b4a8; background: none; border: 1px solid rgba(200,210,235,.16); border-radius: 14px; padding: 5px 12px; cursor: pointer; }
  /* the headline — today's object */
  #front .fr-head { position: relative; border: 1px solid rgba(212,170,82,.35); border-radius: 12px; padding: 22px 22px 18px; background: linear-gradient(180deg, rgba(212,170,82,.07), rgba(212,170,82,.02)); margin-bottom: 18px; cursor: pointer; }
  #front .fr-head:hover { border-color: rgba(212,170,82,.6); }
  #front .fr-tag { font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; letter-spacing: .18em; text-transform: uppercase; color: #d4aa52; margin-bottom: 10px; }
  #front .fr-chip { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: #f0ebe0; border: .5px solid rgba(196,156,72,.55); border-radius: 10px; padding: 3px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #front .fr-chip i { display: inline-block; width: 8px; height: 8px; background: #d4aa52; transform: rotate(45deg); flex: none; }
  #front .fr-chip .k { color: #7d8290; letter-spacing: .12em; text-transform: uppercase; font-size: 9px; }
  #front .fr-objname { font-size: 15px; color: #b9b4a8; margin: 12px 0 4px; font-style: italic; }
  #front .fr-head h1 { font-size: clamp(26px, 5vw, 40px); line-height: 1.08; margin: 0 0 12px; font-weight: normal; letter-spacing: -.01em; }
  #front .fr-prompt { font-size: 16px; line-height: 1.45; color: #d8d3c8; margin: 0 0 16px; max-width: 720px; }
  #front .fr-read { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: #0b1020; background: #d4aa52; border: 0; border-radius: 16px; padding: 8px 16px; cursor: pointer; }
  #front .fr-state { font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: #7d8290; margin-left: 12px; }
  /* the standing objects */
  #front h2 { font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; letter-spacing: .18em; text-transform: uppercase; color: #7d8290; font-weight: normal; margin: 0 0 8px; }
  #front .fr-objects { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 2px 2px 10px; margin: 0 -2px 14px; scrollbar-width: thin; }
  #front .fr-card { flex: 0 0 236px; scroll-snap-align: start; border: 1px solid rgba(200,210,235,.14); border-radius: 10px; padding: 12px 13px 10px; background: rgba(13,20,40,.7); cursor: pointer; display: flex; flex-direction: column; gap: 6px; min-height: 148px; }
  #front .fr-card:hover { border-color: rgba(212,170,82,.5); }
  #front .fr-card.now { border-color: rgba(212,170,82,.35); }
  #front .fr-card .fr-chip { font-size: 9.5px; padding: 2px 8px; align-self: flex-start; max-width: 100%; }
  #front .fr-card .n { font-size: 13.5px; line-height: 1.3; color: #f0ebe0; }
  #front .fr-card .t { font-size: 11.5px; color: #7d8290; font-style: italic; margin-top: auto; }
  #front .fr-card .d { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #7d8290; }
  /* the rail — the object stays, the noise moves */
  #front .fr-rail { border: 1px solid rgba(200,210,235,.12); border-radius: 10px; background: rgba(13,20,40,.5); padding: 10px 12px 8px; margin: 0 0 16px; overflow-x: auto; }
  #front .fr-rail svg { display: block; min-width: 640px; width: 100%; }
  #front .fr-rail .row { cursor: pointer; }
  #front .fr-rail .row:hover .lbl { fill: #f0ebe0; }
  #front .fr-rail .key { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: #7d8290; margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap; }
  #front .fr-rail .key i { display: inline-block; width: 7px; height: 7px; vertical-align: middle; margin-right: 5px; }
  /* the slate — predictions stated before election day; held or missed after; testers call them */
  #front .fr-slate { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 2px 2px 10px; margin: 0 -2px 14px; }
  #front .fr-pred { flex: 0 0 300px; scroll-snap-align: start; border: 1px solid rgba(200,210,235,.14); border-radius: 10px; padding: 12px 13px 10px; background: rgba(13,20,40,.7); display: flex; flex-direction: column; gap: 6px; }
  #front .fr-pred .o { font-size: 13.5px; color: #f0ebe0; }
  #front .fr-pred .p { font-size: 12.5px; line-height: 1.4; color: #d8d3c8; font-style: italic; }
  #front .fr-pred .s { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #7d8290; }
  #front .fr-pred .s b { color: #d4aa52; font-weight: normal; }
  #front .fr-pred .s b.held { color: #60a880; } #front .fr-pred .s b.missed { color: #dc6060; }
  #front .fr-pred .calls { margin-top: auto; display: flex; gap: 6px; align-items: center; font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: #7d8290; }
  #front .fr-pred .calls button { font: inherit; background: none; color: #b9b4a8; border: 1px solid rgba(200,210,235,.16); border-radius: 10px; padding: 3px 9px; cursor: pointer; }
  #front .fr-pred .calls button.on { border-color: #d4aa52; color: #d4aa52; }
  #front .fr-pred .calls .n { margin-left: auto; }
  #front .fr-countdown { font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; letter-spacing: .18em; text-transform: uppercase; color: #d4aa52; margin: -4px 0 8px; }
  /* the doors */
  #front .fr-doors { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  #front .fr-door.paper { background: #e7e2d3; color: #1c1a16; border-color: #c9c2ad; }
  #front .fr-door.paper .k { color: #2c4470; }
  #front .fr-door.paper .l { color: #2c4470; }
  #front .fr-door.paper:hover { border-color: #1c1a16; }
  #front .fr-door { border: 1px solid rgba(200,210,235,.14); border-radius: 10px; padding: 12px 13px; background: rgba(13,20,40,.55); cursor: pointer; text-decoration: none; color: inherit; display: block; min-height: 96px; }
  #front .fr-door:hover { border-color: rgba(212,170,82,.5); }
  #front .fr-door .k { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: #7d8290; }
  #front .fr-door .n { font-size: 15px; margin: 4px 0 6px; }
  #front .fr-door .l { font-family: ui-monospace, Menlo, monospace; font-size: 10px; color: #d4aa52; line-height: 1.4; }
  #front .fr-door.arc { border-color: rgba(212,170,82,.3); }
  /* the shape of a Reading: its plane, drawn — the twelve stations as the crayon pins at their band, the object in gold */
  #front .fr-plane { display: block; }
  #front .fr-head { display: grid; grid-template-columns: minmax(0, 1fr) 250px; gap: 18px; align-items: center; }
  #front .fr-head > div { min-width: 0; }
  #front .fr-chip > span { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  #front .fr-chip > span.k { flex: none; overflow: visible; }
  #front .fr-head .fr-plane { width: 250px; height: 250px; }
  #front .fr-card .fr-plane { width: 100%; height: 118px; margin: -4px 0 2px; }
  #front .fr-door .ic { float: right; width: 44px; height: 44px; margin: -2px -2px 6px 8px; opacity: .9; }
  #front .fr-door .ic.wide { width: 72px; height: 36px; }
  #front .fr-door .ic img { width: 100%; height: 100%; object-fit: contain; }
  @media (max-width: 760px) {
    #front .fr-head { grid-template-columns: minmax(0, 1fr); }
    #front .fr-head .fr-plane { width: 100%; height: 190px; order: -1; margin-bottom: -8px; }
  }
  @media (max-width: 760px) {
    #front .fr-head { padding: 18px 16px 16px; }
    #front .fr-doors { grid-template-columns: repeat(2, 1fr); }
    #front .fr-door:last-child { grid-column: span 2; }
    #front .fr-card { flex-basis: 200px; }
  }`;

  const KIND = { bill: 'the bill', statute: 'the law', ruling: 'the ruling', executive: 'the order', object: 'the object' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const fmtDate = p => { if (!p) return ''; const [y, m, d] = String(p).split('-').map(Number); if (!y) return p; const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return (d ? d + ' ' : '') + (m ? M[m - 1] + ' ' : '') + y; };

  // the object a Reading stands on: centralObject, else its object-relation tether, else its void
  function objectOf(e) {
    const co = e.centralObject;
    if (co && (co.name || co.ref)) return { kind: co.kind || 'object', ref: co.ref || '', name: co.name || co.ref, state: co.state || '', stateDate: co.stateDate || e.date || '', declared: true };
    const t = (e.tethers || []).find(x => x.relation === 'object') || (e.tethers || [])[0];
    if (t) return { kind: t.billId ? 'bill' : 'statute', ref: t.bill || t.cite || t.billId || '', name: t.title || t.statute || t.billId, state: t.statusAsOf || t.enacted || '', stateDate: e.date || '', declared: false };
    if (e.legislativeVoid) return { kind: 'object', ref: '', name: 'no instrument — stands against ' + short(e.legislativeVoid.standsAgainst, 60), state: 'void', stateDate: e.date || '', declared: false };
    return { kind: 'object', ref: '', name: 'object not yet declared', state: '', stateDate: e.date || '', declared: false };
  }
  // the chip: kind · the ref's first clause · the state
  // a catalog id reads as the bill number: hr-119-8800 → H.R. 8800, s-119-2651 → S. 2651
  const billNo = r => { const m = /^(hr|s|hjres|sjres|hres|sres)-\d+-(\d+)$/i.exec(String(r || '').trim()); if (!m) return null; const t = { hr: 'H.R.', s: 'S.', hjres: 'H.J.Res.', sjres: 'S.J.Res.', hres: 'H.Res.', sres: 'S.Res.' }[m[1].toLowerCase()]; return t + ' ' + m[2]; };
  function chip(o, small) {
    const raw = billNo(o.ref) || String(o.ref || '').split(/ — |;| \(/)[0].trim();
    const ref = short(raw, small ? 26 : 48);
    return '<span class="fr-chip"><i></i><span class="k">' + esc(KIND[o.kind] || 'the object') + '</span>' + (ref ? '<span>' + esc(ref) + '</span>' : '') + (o.state && !small ? '<span class="k">· ' + esc(short(o.state, 38)) + '</span>' : '') + '</span>';
  }

  // ── the plane, drawn: a Reading's shape at a glance ──
  // quadrant corners as the portal draws them (A top-left · B top-right · C bottom-left · D bottom-right),
  // band = distance from the centre (fluid 0.17 · coalition 0.30 · denominated 0.42, the portal's own OFF),
  // opacity = the station's z (frustrated dim → realized bright). The object sits at the centre in gold.
  const IMG = '../src/img/front/';
  const PIN = { A: 'pin_A_red.png', B: 'pin_B_blue.png', C: 'pin_C_green.png', D: 'pin_D_orange.png' };
  const DIR = { A: [-1, 1], B: [1, 1], C: [-1, -1], D: [1, -1] }, OFF = { fluid: 0.17, coalition: 0.30, denominated: 0.42 };
  function planeSVG(e, big) {
    const S = 100, c = S / 2, R = (e.responses || {});
    const parts = [];
    // the plane: a faint grid and the two axes
    parts.push('<rect x="4" y="4" width="92" height="92" rx="3" fill="rgba(200,210,235,.035)" stroke="rgba(200,210,235,.12)" stroke-width=".6"/>');
    parts.push('<line x1="' + c + '" y1="6" x2="' + c + '" y2="94" stroke="rgba(200,210,235,.14)" stroke-width=".6"/><line x1="6" y1="' + c + '" x2="94" y2="' + c + '" stroke="rgba(200,210,235,.14)" stroke-width=".6"/>');
    // the stations
    let n = 0;
    ['A', 'B', 'C', 'D'].forEach(q => ['fluid', 'coalition', 'denominated'].forEach(band => {
      const v = R[q] && R[q][band]; if (!v || !v.text) return;
      const o = OFF[band] * S, d = DIR[q], x = c + d[0] * o, y = c - d[1] * o;
      const z = typeof v.z === 'number' ? v.z : 0, op = (0.45 + 0.55 * (z + 1) / 2).toFixed(2), sz = big ? 15 : 17;
      parts.push('<image href="' + IMG + PIN[q] + '" x="' + (x - sz / 2) + '" y="' + (y - sz / 2) + '" width="' + sz + '" height="' + sz + '" opacity="' + op + '"/>');
      n++;
    }));
    // the object: a gold cube at the centre (the same object the plane carries), smaller when the Reading has no declared object
    const o = objectOf(e), k = o.declared ? 7 : 4.5, g = o.declared ? '#d4aa52' : 'rgba(212,170,82,.45)';
    parts.push('<g transform="translate(' + c + ' ' + c + ')">' +
      '<polygon points="0,-' + k + ' ' + (k * .87) + ',-' + (k / 2) + ' 0,0 -' + (k * .87) + ',-' + (k / 2) + '" fill="' + g + '"/>' +
      '<polygon points="-' + (k * .87) + ',-' + (k / 2) + ' 0,0 0,' + k + ' -' + (k * .87) + ',' + (k / 2) + '" fill="' + g + '" opacity=".7"/>' +
      '<polygon points="' + (k * .87) + ',-' + (k / 2) + ' 0,0 0,' + k + ' ' + (k * .87) + ',' + (k / 2) + '" fill="' + g + '" opacity=".5"/></g>');
    if (!n) parts.push('<text x="' + c + '" y="' + (c + 22) + '" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="5" fill="rgba(240,235,224,.4)" letter-spacing=".1em">NO STATIONS YET</text>');
    return '<svg class="fr-plane" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + parts.join('') + '</svg>';
  }
  // door symbols — the arc's flows, the field's strip, a seat, Ted's own face, the prism
  const ICON = {
    arc: '<svg viewBox="0 0 44 44" fill="none" stroke="#d4aa52" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="24" r="3" fill="#d4aa52" stroke="none"/><path d="M14 23 Q24 6 38 12"/><path d="M14 25 Q26 30 38 22"/><path d="M13 26 Q20 40 34 36" opacity=".55" stroke-dasharray="3 3"/></svg>',
    field: '<svg viewBox="0 0 44 44" fill="none" stroke="rgba(240,235,224,.55)" stroke-width="1.5"><rect x="3" y="15" width="9" height="14" rx="1"/><rect x="14" y="15" width="9" height="14" rx="1" fill="rgba(212,170,82,.35)" stroke="#d4aa52"/><rect x="25" y="15" width="9" height="14" rx="1"/><rect x="36" y="15" width="6" height="14" rx="1" opacity=".5"/></svg>',
    seat: '<svg viewBox="0 0 44 44" fill="none" stroke="rgba(240,235,224,.6)" stroke-width="1.5"><circle cx="22" cy="16" r="7" stroke-dasharray="3 2"/><path d="M8 38 Q22 24 36 38" stroke-dasharray="3 2"/><circle cx="22" cy="16" r="2" fill="#d4aa52" stroke="none"/></svg>',
    ted: '<img src="' + IMG + 'Ted.png" alt="">',
    codex: '<img src="' + IMG + 'prism_mark.png" alt="" style="object-fit:contain">',
    paper: '<svg viewBox="0 0 44 44" fill="none" stroke="#2c4470" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M13 8 H40 L31 36 H4 Z"/><path d="M17 16 H34" stroke="#d9a93a"/><path d="M14 23 H30" stroke="#de4f2b"/><path d="M11 30 H25" stroke="#5f8e3f"/></svg>',
  };

  let root = null, opts = null;
  function build() {
    if (root) return root;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('section'); root.id = 'front'; root.hidden = true; root.setAttribute('aria-label', 'The objects standing');
    document.body.appendChild(root);
    return root;
  }

  function render() {
    const live = (opts.events || []).slice();
    // the headline rule: the object that most recently changed state (stateDate), else the most recent Reading
    const key = e => (objectOf(e).stateDate || e.date || '') + '|' + (e.updatedAt || '');
    live.sort((a, b) => key(b).localeCompare(key(a)));
    const head = live[0]; if (!head) { root.innerHTML = ''; return; }
    const ho = objectOf(head);
    const rest = live.slice(1);
    const go = id => { const u = new URL(location.href); u.searchParams.delete('front'); u.searchParams.delete('reading'); u.searchParams.set('event', id); location.href = u.toString(); };
    const openHead = () => { if (head.id === opts.currentId) hide(); else go(head.id); };

    root.innerHTML =
      '<div class="fr-wrap">' +
        '<div class="fr-top"><div class="fr-mark"><b>Prism</b> · the objects standing · ' + live.length + '</div><button class="fr-x" id="frX">to the reading →</button></div>' +
        '<article class="fr-head" id="frHead"><div>' +
          '<div class="fr-tag">today\'s object · changed state ' + esc(fmtDate(ho.stateDate)) + '</div>' +
          chip(ho, false) +
          '<div class="fr-objname">' + esc(ho.name) + '</div>' +
          '<h1>' + esc(head.title || '') + '</h1>' +
          (head.prompt ? '<p class="fr-prompt">' + esc(head.prompt) + '</p>' : '') +
          '<button class="fr-read" id="frRead">read it →</button><span class="fr-state">' + esc(fmtDate(head.date)) + (head.category ? ' · ' + esc(short(head.category, 40)) : '') + '</span>' +
        '</div>' + planeSVG(head, true) + '</article>' +
        '<h2>the standing objects</h2>' +
        '<div class="fr-objects" id="frObjects">' + rest.map(e => { const o = objectOf(e); return '<div class="fr-card' + (e.id === opts.currentId ? ' now' : '') + '" data-id="' + esc(e.id) + '">' + planeSVG(e, false) + chip(o, true) + '<div class="n">' + esc(short(o.name, 70)) + '</div><div class="t">' + esc(e.title || '') + '</div><div class="d">' + esc(fmtDate(o.stateDate || e.date)) + (o.state ? ' · ' + esc(short(o.state, 26)) : '') + '</div></div>'; }).join('') + '</div>' +
        '<h2>the rail · the object stays, the noise moves</h2>' +
        '<div class="fr-rail" id="frRail"></div>' +
        '<h2>the slate · called before election day</h2>' +
        '<div class="fr-countdown" id="frCountdown"></div>' +
        '<div class="fr-slate" id="frSlate"></div>' +
        '<h2>the dimensions</h2>' +
        '<div class="fr-doors">' +
          '<a class="fr-door arc" href="../active/?ted"><div class="ic">' + ICON.arc + '</div><div class="k">the arc</div><div class="n">Where the oil went</div><div class="l" id="frArc">reading the layer…</div></a>' +
          '<div class="fr-door" id="frField"><div class="ic">' + ICON.field + '</div><div class="k">the field</div><div class="n">What the newsroom is watching</div><div class="l" id="frFieldLine">…</div></div>' +
          '<div class="fr-door" id="frSeat"><div class="ic">' + ICON.seat + '</div><div class="k">your seat</div><div class="n">Your pins and burns</div><div class="l" id="frSeatLine">' + esc(opts.seat || 'take a seat') + '</div></div>' +
          '<a class="fr-door" href="?example"><div class="ic">' + ICON.ted + '</div><div class="k">ted</div><div class="n">The tour, again</div><div class="l">a small real law, three moves</div></a>' +
          '<a class="fr-door paper" href="../parallelogram/"><div class="ic">' + ICON.paper + '</div><div class="k">the election paper</div><div class="n">Is the race moving the needle?</div><div class="l" id="frPaperLine">laying out…</div></a>' +
          '<a class="fr-door" href="https://sailor7613.github.io/dreamgetty/" target="_blank" rel="noopener"><div class="ic">' + ICON.codex + '</div><div class="k">the codex</div><div class="n">The words, defined</div><div class="l">object · settlement · the frame · z</div></a>' +
        '</div>' +
      '</div>';

    loadSlate();
    root.querySelector('#frX').addEventListener('click', hide);
    root.querySelector('#frRead').addEventListener('click', ev => { ev.stopPropagation(); openHead(); });
    root.querySelector('#frHead').addEventListener('click', openHead);
    root.querySelectorAll('.fr-card').forEach(c => c.addEventListener('click', () => { const id = c.dataset.id; if (id === opts.currentId) hide(); else go(id); }));
    root.querySelector('#frField').addEventListener('click', () => { hide(); if (typeof opts.onField === 'function') opts.onField(); });
    root.querySelector('#frSeat').addEventListener('click', () => { hide(); if (typeof opts.onSeat === 'function') opts.onSeat(); });

    // the paper's line — quiet on failure
    fetch('../data/races/races.json', { cache: 'no-store' }).then(r => r.json()).then(async j => {
      const el = root.querySelector('#frPaperLine'); if (!el) return;
      const days = Math.ceil((dayStr(j.electionDay) - dayOf(Date.now())) / 864e5);
      const parts = [];
      for (const rc of (j.races || []).slice(0, 2)) {
        const zs = await Promise.all(rc.variants.map(v => fetch(v.file.replace(/^\.\.\//, '../'), { cache: 'no-store' }).then(r => r.json()).then(x => x.impliedZ).catch(() => null)));
        parts.push(rc.shortSeat.split(',')[0] + ' ' + zs.map(z => z == null ? '·' : (z > 0 ? '+' : z < 0 ? '−' : '') + Math.abs(z).toFixed(2)).join(' / '));
      }
      el.textContent = parts.join(' · ') + (days > 0 ? ' · ' + days + ' days' : '');
    }).catch(() => {});
    // live lines — both optional, both quiet on failure
    fetch('../data/active/active.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(a => {
      const el = root.querySelector('#frArc'); if (!el) return;
      try {
        const imp = a.realization.importsByOrigin.series, last = s => s.points[s.points.length - 1], tot = last(imp['NUS-Z00']), period = tot[0];
        const at = s => { const p = s && s.points.find(q => q[0] === period); return p ? p[1] : 0; };
        const gulf = Object.values(imp).filter(s => ['SAU', 'IRQ', 'KWT', 'ARE', 'QAT', 'OMN', 'BHR'].indexOf(s.label) >= 0).reduce((x, s) => x + at(s), 0);
        const ven = at(Object.values(imp).find(s => s.label === 'VEN'));
        const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(period.slice(5, 7)) - 1];
        const hyp = a.hypotheses && a.hypotheses.rows && a.hypotheses.rows[0];
        el.textContent = 'Gulf ' + Math.round(gulf) + ' · Venezuela ' + Math.round(ven) + ' · ' + M + (hyp ? ' · ' + hyp.id + ' ' + (hyp.outcome === 'pending' ? 'unscored' : hyp.outcome) : '');
      } catch (e) { el.textContent = 'the barrels, month by month'; }
    }).catch(() => { const el = root.querySelector('#frArc'); if (el) el.textContent = 'the barrels, month by month'; });
    fetch('../data/newsroom/objects.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      const el = root.querySelector('#frFieldLine'); if (!el) return;
      const os = Array.isArray(j.objects) ? j.objects : Object.values(j.objects || {});
      const n = s => os.filter(o => o.status === s).length;
      el.textContent = (n('new') + n('queued')) + ' forming · ' + n('watch') + ' watched · ' + n('drafted') + ' drafted';
    }).catch(() => { const el = root.querySelector('#frFieldLine'); if (el) el.textContent = 'the burns, bottom row'; });
  }

  // ── the rail ──
  // One still line per object, from the day it formed to today. The marks are what moved:
  // ◆ the trigger day (the object's stateDate) · ◇ the Reading published · | burns (public pins,
  // colored by the quadrant they sat in) · · detection events (the active layer, dated by
  // detection) on the lines that carry PG01's instrument. Nothing on a line is an arrow.
  const QCOL = { A: '#6094dc', B: '#dc6060', C: '#60a880', D: '#c49c48' };
  const dayOf = t => { const d = new Date(t); return isNaN(d) ? null : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  const dayStr = p => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(p || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)) : null; };
  function drawRail(live, burnsByRid, events) {
    const host = root.querySelector('#frRail'); if (!host) return;
    const rows = live.map(e => { const o = objectOf(e); return { e, o, t0: dayStr(o.stateDate || e.date), pub: dayOf(e.updatedAt), burns: burnsByRid[e.rid] || [], pg01: /NSPM-2|petrogas|maximum pressure/i.test(JSON.stringify(e.tethers || []) + (o.ref || '')) }; })
      .filter(r => r.t0).sort((a, b) => b.t0 - a.t0);
    if (!rows.length) { host.innerHTML = ''; return; }
    const today = dayOf(Date.now());
    const election = opts.electionDay ? dayStr(opts.electionDay) : null;
    const tMin = Math.min(...rows.map(r => r.t0)) - 15 * 864e5, tMax = Math.max(today, election || 0) + 10 * 864e5;
    const W = 900, L = 170, R = 16, rowH = 22, top = 18, H = top + rows.length * rowH + 22;
    const x = t => L + (t - tMin) / (tMax - tMin) * (W - L - R);
    const parts = ['<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px" aria-label="The rail">'];
    // month ticks
    const d0 = new Date(tMin); let m = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1);
    for (; m < tMax; m = (dd => Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth() + 1, 1))(new Date(m))) {
      const dt = new Date(m), jan = dt.getUTCMonth() === 0;
      parts.push('<line x1="' + x(m) + '" y1="' + top + '" x2="' + x(m) + '" y2="' + (H - 18) + '" stroke="rgba(200,210,235,' + (jan ? '.16' : '.06') + ')" stroke-width="1"/>');
      if (jan || dt.getUTCMonth() % 3 === 0) parts.push('<text x="' + (x(m) + 3) + '" y="' + (H - 6) + '" font-family="ui-monospace,Menlo,monospace" font-size="8.5" fill="#7d8290" letter-spacing=".1em">' + (jan ? dt.getUTCFullYear() : ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dt.getUTCMonth()]) + '</text>');
    }
    // today
    parts.push('<line x1="' + x(today) + '" y1="' + top + '" x2="' + x(today) + '" y2="' + (H - 18) + '" stroke="rgba(212,170,82,.5)" stroke-width="1" stroke-dasharray="2 3"/>');
    parts.push('<text x="' + (x(today) - 3) + '" y="' + (top - 6) + '" text-anchor="end" font-family="ui-monospace,Menlo,monospace" font-size="8.5" fill="#d4aa52" letter-spacing=".12em">TODAY</text>');
    // the election: the date every line runs toward; after it the lines keep going — what the vote changed and what it didn't
    if (election) {
      parts.push('<line x1="' + x(election) + '" y1="' + top + '" x2="' + x(election) + '" y2="' + (H - 18) + '" stroke="rgba(240,235,224,.55)" stroke-width="1.5"/>');
      parts.push('<text x="' + (x(election) + 4) + '" y="' + (top - 6) + '" font-family="ui-monospace,Menlo,monospace" font-size="8.5" fill="#f0ebe0" letter-spacing=".12em">' + (today < election ? 'ELECTION · ' + Math.ceil((election - today) / 864e5) + ' DAYS' : 'ELECTION') + '</text>');
    }
    rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2;
      parts.push('<g class="row" data-id="' + esc(r.e.id) + '">');
      parts.push('<rect x="0" y="' + (y - rowH / 2) + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>');
      // the still line, from the day it formed to today
      parts.push('<line x1="' + x(r.t0) + '" y1="' + y + '" x2="' + x(today) + '" y2="' + y + '" stroke="rgba(212,170,82,.55)" stroke-width="1.5"/>');
      // ◆ formed
      parts.push('<rect x="' + (x(r.t0) - 3.5) + '" y="' + (y - 3.5) + '" width="7" height="7" fill="#d4aa52" transform="rotate(45 ' + x(r.t0) + ' ' + y + ')"/>');
      // ◇ published (the Reading's last save)
      if (r.pub && r.pub > r.t0) parts.push('<rect x="' + (x(r.pub) - 3) + '" y="' + (y - 3) + '" width="6" height="6" fill="none" stroke="rgba(240,235,224,.6)" stroke-width="1" transform="rotate(45 ' + x(r.pub) + ' ' + y + ')"/>');
      // | burns
      r.burns.forEach(b => { const t = dayOf(b.t); if (!t) return; parts.push('<line x1="' + x(t) + '" y1="' + (y - 7) + '" x2="' + x(t) + '" y2="' + (y + 7) + '" stroke="' + (QCOL[b.quad] || '#f0ebe0') + '" stroke-width="2"><title>' + esc((b.author || '') + ' · ' + String(b.t).slice(0, 10) + ' · ' + (b.quad || '') + ' ' + (b.band || '')) + '</title></line>'); });
      // · detection events on the lines that carry PG01's instrument (dated by detection)
      if (r.pg01) (events || []).forEach(ev => { const t = dayStr(ev.detected || ev.asOf); if (!t || t < r.t0) return; parts.push('<circle cx="' + x(t) + '" cy="' + (y - 6) + '" r="1.8" fill="rgba(240,235,224,.55)"><title>' + esc(ev.asOf + ' · ' + ev.theater + ' · ' + ev.what) + '</title></circle>'); });
      // label
      parts.push('<text class="lbl" x="' + (L - 10) + '" y="' + (y + 3) + '" text-anchor="end" font-family="Georgia,serif" font-size="11" fill="#b9b4a8">' + esc(short(r.o.name, 26)) + '</text>');
      parts.push('</g>');
    });
    parts.push('</svg>');
    host.innerHTML = parts.join('') + '<div class="key"><span><i style="background:#d4aa52;transform:rotate(45deg)"></i>formed</span><span><i style="border:1px solid rgba(240,235,224,.6);transform:rotate(45deg)"></i>published</span><span><i style="width:2px;background:#6094dc"></i>a burn, by its corner</span><span><i style="border-radius:50%;background:rgba(240,235,224,.55);width:5px;height:5px"></i>read by the press (the arc\'s lines)</span></div>';
    host.querySelectorAll('.row').forEach(g => g.addEventListener('click', () => { const id = g.dataset.id; if (id === opts.currentId) hide(); else { const u = new URL(location.href); u.searchParams.delete('front'); u.searchParams.delete('reading'); u.searchParams.set('event', id); location.href = u.toString(); } }));
  }
  function loadRail(live) {
    // burns: the local field cache first, then the public manifests (keyless, raw) — redraw as they land
    const cache = {}; live.forEach(e => { try { if (e.rid && typeof PrismField !== 'undefined') cache[e.rid] = PrismField.field(e.rid); } catch (x) {} });
    let events = [];
    drawRail(live, cache, events);
    fetch('../data/active/active.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(a => { events = (a && a.events && a.events.rows) || []; drawRail(live, cache, events); }).catch(() => {});
    if (typeof PrismField !== 'undefined' && PrismField.pullField) {
      Promise.all(live.filter(e => e.rid).map(e => PrismField.pullField(e.rid).then(b => { cache[e.rid] = b || []; }).catch(() => {}))).then(() => drawRail(live, cache, events));
    }
  }

  // ── the slate: predictions, their state, and the testers' calls ──
  function drawSlate(slate, callsById, mine) {
    const host = root.querySelector('#frSlate'); if (!host) return;
    const cd = root.querySelector('#frCountdown');
    if (cd && slate.electionDay) { const d = Math.ceil((dayStr(slate.electionDay) - dayOf(Date.now())) / 864e5); cd.textContent = (d > 0 ? d + ' days to the vote · ' : d === 0 ? 'election day · ' : 'after the vote · ') + 'stated ' + fmtDate(slate.statedDate) + ' · outcomes never revised'; }
    const bound = !!(opts.seat);
    host.innerHTML = (slate.rows || []).map(r => {
      const calls = callsById[r.id] || [], held = calls.filter(c => c.call === 'held').length, missed = calls.length - held, my = mine[r.id];
      const st = r.outcome === 'pending' ? '<b>pending</b>' : '<b class="' + esc(r.outcome) + '">' + esc(r.outcome) + '</b>';
      return '<div class="fr-pred" data-id="' + esc(r.id) + '"' + (r.rid ? ' data-rid="' + esc(r.rid) + '"' : '') + '>' +
        '<div class="s">' + esc(r.id.replace('slate', 'the slate · ')) + ' · ' + st + '</div>' +
        '<div class="o">' + esc(r.object) + '</div>' +
        '<div class="p">' + esc(r.prediction) + '</div>' +
        '<div class="s">missed if ' + esc(short(r.missedIf, 90)) + '</div>' +
        '<div class="calls">' + (bound ? '<button data-call="held"' + (my === 'held' ? ' class="on"' : '') + '>held</button><button data-call="missed"' + (my === 'missed' ? ' class="on"' : '') + '>missed</button>' : '<span>take a seat to call it</span>') +
        '<span class="n">' + held + ' held · ' + missed + ' missed</span></div></div>';
    }).join('');
    host.querySelectorAll('.fr-pred button[data-call]').forEach(b => b.addEventListener('click', async ev => {
      ev.stopPropagation();
      const card = b.closest('.fr-pred'), id = card.dataset.id, call = b.dataset.call;
      if (typeof PrismField === 'undefined' || !PrismField.pushCall) return;
      b.textContent = '…';
      const r = await PrismField.pushCall(id, call, '');
      if (r && r.ok) { mine[id] = call; callsById[id] = (callsById[id] || []).filter(c => c.author !== (r.entry && r.entry.author)).concat([r.entry]); drawSlate(slate, callsById, mine); }
      else { b.textContent = call; if (r && r.error) alert(r.error); }
    }));
    host.querySelectorAll('.fr-pred[data-rid]').forEach(card => card.addEventListener('click', () => {
      const rid = card.dataset.rid, e = (opts.events || []).find(x => x.rid === rid); if (!e) return;
      if (e.id === opts.currentId) hide(); else { const u = new URL(location.href); u.searchParams.delete('front'); u.searchParams.delete('reading'); u.searchParams.set('event', e.id); location.href = u.toString(); }
    }));
  }
  function loadSlate() {
    fetch('../data/slate/slate.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(async slate => {
      if (!slate) { const h = root.querySelector('#frSlate'); if (h) h.innerHTML = ''; loadRail(opts.events || []); return; }
      opts.electionDay = slate.electionDay;
      const callsById = {}, mine = {};
      drawSlate(slate, callsById, mine);
      if (typeof PrismField !== 'undefined' && PrismField.pullCalls) {
        let me = null; try { const b = PrismField.bound(); me = b && b.avatar; } catch (e) {}
        await Promise.all((slate.rows || []).map(r => PrismField.pullCalls(r.id).then(cs => { callsById[r.id] = cs; const m = cs.find(c => c.author === me); if (m) mine[r.id] = m.call; }).catch(() => {})));
        drawSlate(slate, callsById, mine);
      }
      try { drawRail(opts.events || [], {}, []); } catch (e) {}
      loadRail(opts.events || []);
    }).catch(() => loadRail(opts.events || []));
  }

  function show(o) { opts = Object.assign({}, opts || {}, o || {}); build(); render(); root.hidden = false; document.body.classList.add('on-front'); try { root.scrollTop = 0; } catch (e) {} }
  function hide() { if (!root) return; root.hidden = true; document.body.classList.remove('on-front'); }

  window.PrismFront = { show, hide, objectOf };
})();
