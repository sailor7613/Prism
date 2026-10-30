// ============================================================
// THE PARALLELOGRAM REPORT (working name during the build: Dream News) — the desk in the Plaza (2026-10-18, Sailor: "a news desk
// somewhere in the plaza, somewhat impossible like the graphmap pedestal,
// modern like a normal news show desk, no name badge for Ted, a chyron")
//
// Loaded last by dreamgetty/index.html and dormant unless the URL carries
// ?show=<episode>. Then: the HUD goes away, the roaming Ted stands down, a
// second Ted sits at a desk that floats over the Plaza paving with nothing
// under it, the episode's parallelogram hangs in the air behind him on its
// own graphmap, the camera is pinned to the desk, and an HTML chyron runs
// over the frame. window.SHOW = { ready, duration, seek(t), level(v), beats, overlay(id) }
// is what scripts/show/render.js steps.
//
//   /Prism/dreamgetty/?show=ep01_reduced_diesel                plays (audio if tts.py has run)
//   /Prism/dreamgetty/?show=ep01_reduced_diesel&capture=1      stepped by the renderer
//   &aspect=16:9                                                wide framing
//
// CLIPS (2026-10-25, the episode-one build): an episode may carry several
// press pieces on the one map (EP.pieces) and three kinds of beat —
//   text   Ted speaks (as before)
//   clip   a cut from a clip file; layout 'full' = a hard cut to the clip, the
//          set hidden, a lower third and the bug over it. In the browser the
//          <video> plays; under capture the renderer composites the clip
//          itself (ffmpeg) and only asks this page for the lower third
//          (SHOW.overlay(beatId) → a transparent frame of bug + lower third).
//   land   the map alone — the stage camera frames the pedestal, the desk is
//          hidden, the line's dot drops in with its Dia on a card.
// A clip's press line lands on the map as it plays (piece + line, with
// clips[src].in = the source-tape second where the clip file starts).
//
// Everything it touches is the villa's own: PLACE_REGISTRY (the Plaza),
// getTedHeight (the paving), buildCoyote (the same animal), PrismGraphmap
// (external-parent mode, as the pedestal does it), scene, camera, renderer,
// clock. Nothing in the villa is changed; this only adds and, in show mode,
// hides. prism-graphmap.js is read, never written, from here.
// ============================================================
(function () {
  const Q = new URLSearchParams(location.search);
  const ID = Q.get('show'); if (!ID) return;
  const CAPTURE = Q.get('capture') === '1';
  const ASPECT = Q.get('aspect') || '9:16';
  const WIDE = ASPECT === '16:9';
  document.body.classList.add('dream-news');

  // ── the overlay: everything of the villa's HUD goes; the frame gets a bug, a chyron, subtitles, a ticker, a lower third, a landing card
  const css = document.createElement('style');
  css.textContent = `
    body.dream-news > :not(#scene-container):not(#dn):not(script):not(style) { display: none !important; }
    body.dream-news { cursor: none; }
    #dn { position: fixed; inset: 0; pointer-events: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #fff; z-index: 2000; }
    #dn * { box-sizing: border-box; }
    #dn-bug { position: absolute; left: 4vw; top: 3vh; display: flex; align-items: center; gap: 0.8vw; }
    #dn-bug .mark { width: 2.6vw; height: 2.6vw; min-width: 22px; min-height: 22px; background: linear-gradient(135deg, #ff4f3d, #ffb13d); transform: skewX(-12deg); }
    #dn-bug .name { font-weight: 800; letter-spacing: .18em; font-size: clamp(13px, 1.3vw, 26px); white-space: nowrap; text-shadow: 0 1px 6px rgba(0,0,0,.8); }
    #dn-bug .live { margin-left: .6vw; font-size: clamp(10px, .9vw, 18px); letter-spacing: .2em; color: #ffb13d; }
    #dn-clock { position: absolute; right: 4vw; top: 3vh; font-size: clamp(12px, 1.1vw, 22px); letter-spacing: .14em; opacity: .85; }
    #dn-sub { position: absolute; left: 6vw; right: 6vw; bottom: 27vh; text-align: center; font-size: clamp(16px, 2.2vw, 44px); font-weight: 600; line-height: 1.25; text-shadow: 0 2px 8px rgba(0,0,0,.9), 0 0 2px #000; }
    #dn-sub b { color: #ffb13d; font-weight: 700; }
    #dn-chyron { position: absolute; left: 0; right: 0; bottom: 9vh; display: grid; grid-template-columns: auto 1fr; }
    #dn-chyron .tag { background: linear-gradient(135deg, #ff4f3d, #ffb13d); color: #111; font-weight: 800; letter-spacing: .18em; padding: 1.2vh 1.6vw; font-size: clamp(11px, 1vw, 20px); display: flex; align-items: center; }
    #dn-chyron .text { background: rgba(8, 10, 16, .92); border-top: 2px solid #ffb13d; padding: 1vh 1.8vw 1.1vh; }
    #dn-chyron .h { font-size: clamp(18px, 2.4vw, 46px); font-weight: 800; line-height: 1.1; letter-spacing: -.01em; }
    #dn-chyron .s { font-size: clamp(11px, 1.1vw, 22px); letter-spacing: .12em; text-transform: uppercase; opacity: .85; margin-top: .5vh; }
    #dn-chyron .s .st { font-weight: 800; letter-spacing: .14em; }
    #dn-ticker { position: absolute; left: 0; right: 0; bottom: 0; height: 5.5vh; background: #0b0d14; border-top: 1px solid #262a3a; display: flex; align-items: stretch; overflow: hidden; }
    #dn-ticker .lbl { background: #ffb13d; color: #111; font-weight: 800; letter-spacing: .18em; font-size: clamp(10px, .9vw, 18px); display: flex; align-items: center; padding: 0 1.4vw; white-space: nowrap; }
    #dn-ticker .run { flex: 1; overflow: hidden; display: flex; align-items: center; }
    #dn-tape { white-space: nowrap; font-size: clamp(12px, 1.2vw, 24px); letter-spacing: .04em; color: #cfd3dd; will-change: transform; }
    #dn-tape .LI{color:#ff6b6b} #dn-tape .RI{color:#6ea4ff} #dn-tape .LP{color:#7fd69a} #dn-tape .RP{color:#ffb13d} #dn-tape .O{color:#fff}
    #dn-tape .sep { color: #4a4f63; padding: 0 1.2vw; }
    #dn-end { position: absolute; inset: 0; background: #0b0d14; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 2.4vh; text-align: center; padding: 6vw; }
    #dn-end .a { font-size: clamp(28px, 4vw, 80px); font-weight: 800; letter-spacing: .18em; }
    #dn-end .b { font-size: clamp(14px, 1.5vw, 30px); opacity: .8; max-width: 70vw; line-height: 1.4; }
    #dn-end .c { font-size: clamp(11px, 1vw, 20px); letter-spacing: .24em; text-transform: uppercase; opacity: .55; }
    /* the clip, full frame (the browser plays it; the renderer composites it) */
    #dn-clip { position: absolute; inset: 0; width: 100%; height: 100%; background: #000; object-fit: contain; display: none; }
    /* the lower third on a clip: a station-coloured bar, the name, the show and the date */
    #dn-lower { position: absolute; left: 4vw; bottom: 9vh; display: none; align-items: stretch; gap: 1.1vw; }
    #dn-lower .bar { width: .55vw; min-width: 5px; background: #ffb13d; }
    #dn-lower .who { font-size: clamp(22px, 2.6vw, 52px); font-weight: 800; line-height: 1.05; letter-spacing: -.01em; text-shadow: 0 2px 10px rgba(0,0,0,.9); }
    #dn-lower .what { font-size: clamp(12px, 1.15vw, 23px); letter-spacing: .14em; text-transform: uppercase; opacity: .9; margin-top: .7vh; text-shadow: 0 1px 6px rgba(0,0,0,.9); }
    #dn-lower .what .st { font-weight: 800; }
    /* the landing card: the map alone, the line's dot dropping in */
    #dn-land { position: absolute; left: 4vw; bottom: 9vh; display: none; align-items: flex-end; gap: 2vw; }
    #dn-land .dia { display: flex; flex-direction: column; align-items: flex-start; line-height: .9; }
    #dn-land .dia .n { font-size: clamp(64px, 9vw, 180px); font-weight: 800; letter-spacing: -.04em; text-shadow: 0 4px 24px rgba(0,0,0,.9); }
    #dn-land .dia .l { font-size: clamp(11px, 1.1vw, 22px); letter-spacing: .3em; opacity: .8; margin-top: .6vh; }
    #dn-land .txt { padding-bottom: 1.2vh; }
    #dn-land .who { font-size: clamp(20px, 2.2vw, 44px); font-weight: 800; letter-spacing: -.01em; text-shadow: 0 2px 10px rgba(0,0,0,.9); }
    #dn-land .what { font-size: clamp(12px, 1.1vw, 22px); letter-spacing: .14em; text-transform: uppercase; opacity: .85; margin-top: .6vh; }
    #dn-land .quote { font-size: clamp(14px, 1.4vw, 28px); font-style: italic; opacity: .9; margin-top: 1vh; max-width: 48vw; line-height: 1.3; text-shadow: 0 2px 8px rgba(0,0,0,.9); }
    /* black before the first beat (the lead), so the show cuts in from black */
    #dn-black { position: absolute; inset: 0; background: #000; display: none; }
    #dn-ctl { position: fixed; left: 12px; top: 12px; z-index: 2100; font: 13px system-ui; color: #ccc; background: rgba(0,0,0,.7); padding: 8px 10px; border-radius: 6px; pointer-events: auto; cursor: default; }
    #dn-ctl button { font: 13px system-ui; margin-right: 8px; }
    body.dream-news.capture #dn-ctl { display: none; }
    /* chrome: 'bug' blocks (the cold open) show only the bug, the words and whatever the beat type adds */
    body.dream-news.chrome-bug #dn-clock, body.dream-news.chrome-bug #dn-chyron, body.dream-news.chrome-bug #dn-ticker { display: none !important; }
    /* overlay mode (the renderer's lower-third frame): nothing but the bug and the lower third, over nothing */
    body.dream-news.overlay #dn > :not(#dn-bug):not(#dn-lower) { display: none !important; }
    body.dream-news.overlay #scene-container { visibility: hidden !important; }
    html.dream-news-overlay, body.dream-news.overlay { background: transparent !important; background-color: transparent !important; }   /* the villa sets the body's colour inline, every frame */
    ${WIDE ? '#dn-sub { bottom: 33vh; font-size: clamp(16px, 1.9vw, 38px); } #dn-chyron { right: 34vw; } #dn-chyron .h { font-size: clamp(18px, 2vw, 40px); }' : ''}
  `;
  document.head.appendChild(css);
  const dn = document.createElement('div'); dn.id = 'dn';
  dn.innerHTML = `
    <video id="dn-clip" muted playsinline preload="auto"></video>
    <div id="dn-bug"><div class="mark"></div><div class="name">THE PARALLELOGRAM REPORT</div><div class="live">● LIVE FROM THE PLAZA</div></div>
    <div id="dn-clock"></div>
    <div id="dn-sub"></div>
    <div id="dn-chyron"><div class="tag"></div><div class="text"><div class="h"></div><div class="s"></div></div></div>
    <div id="dn-lower"><div class="bar"></div><div><div class="who"></div><div class="what"></div></div></div>
    <div id="dn-land"><div class="dia"><div class="n"></div><div class="l">DIA</div></div><div class="txt"><div class="who"></div><div class="what"></div><div class="quote"></div></div></div>
    <div id="dn-ticker"><div class="lbl">THE TAPE</div><div class="run"><div id="dn-tape"></div></div></div>
    <div id="dn-end"><div class="a"></div><div class="b"></div><div class="c"></div></div>
    <div id="dn-black"></div>`;
  document.body.appendChild(dn);
  if (!CAPTURE) { const c = document.createElement('div'); c.id = 'dn-ctl'; c.innerHTML = '<button id="dn-play">play</button><button id="dn-stop">stop</button><span id="dn-t">0.0</span> s'; document.body.appendChild(c); }
  else document.body.classList.add('capture');

  const $ = id => document.getElementById(id);

  (async function () {
    const EP = await fetch('../data/show/' + ID + '.json').then(r => r.json());
    // the pieces on the map: v2 lists several (EP.pieces); v1 names one (EP.piece)
    const PIECE_IDS = EP.pieces || (EP.piece ? [EP.piece] : []);
    const PIECES = await Promise.all(PIECE_IDS.map(id => fetch('../data/press/' + id + '.json').then(r => r.json()).then(p => { p.id = p.id || id; return p; })));
    const byPiece = {}; PIECE_IDS.forEach((id, i) => { byPiece[id] = PIECES[i]; });
    const P0 = PIECES[0];
    let TL = null; try { const r = await fetch('../data/show/' + ID + '/timeline.json'); if (r.ok) TL = await r.json(); } catch (e) {}
    const CLIPS_DIR = (EP.clipsDir || 'Transcripts/show/ep01/clips').replace(/^\/+|\/+$/g, '');
    const clipURL = src => '/' + CLIPS_DIR + '/' + src + '.mp4';   // the workspace is served from its root
    const CLIP_IN = EP.clips || {};   // clips[src].in = seconds on the source tape where the clip file starts

    const blocks = EP.blocks || [{ id: 'all', title: EP.segment || 'The Reduced', clip: true, beats: EP.beats }];
    const beats = []; blocks.forEach(blk => blk.beats.forEach(b => beats.push({ ...b, type: b.type || 'text', block: blk })));
    if (TL && TL.beats) { const by = Object.fromEntries(TL.beats.map(b => [b.id, b])); beats.forEach(b => { const t = by[b.id]; if (t) { b.start = t.start; b.end = t.end; b.words = t.words || null; } }); }
    else { let t = 0.4; beats.forEach(b => { b.start = t; const d = b.type === 'clip' ? (b.out - b.in) : b.type === 'text' ? b.text.split(/\s+/).length / 2.6 : (b.dur || 1.5); t += d; b.end = t; if (b.type === 'text') t += 0.55; b.words = null; }); }
    const END_HOLD = EP.endHold != null ? EP.endHold : 3;
    const DURATION = (TL && TL.duration ? TL.duration : beats[beats.length - 1].end) + END_HOLD;

    $('dn-bug').querySelector('.name').textContent = (EP.show || 'The Parallelogram Report').toUpperCase();
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const clean = s => (s || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+—.*$/, '').replace(/\s+/g, ' ').trim();   // "Ben Shapiro (host)" → "Ben Shapiro"
    const fmtDate = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? `${MON[+m[2] - 1]} ${+m[3]}, ${m[1]}` : (d || ''); };
    const STATION = { LI: ['LI', 'Left · Institutional', '#ff6b6b', 'A'], RI: ['RI', 'Right · Institutional', '#6ea4ff', 'B'], LP: ['LP', 'Left · Popular', '#7fd69a', 'C'], RP: ['RP', 'Right · Popular', '#ffb13d', 'D'] };
    // what a clip or landing beat is about: its piece, its line, the name on the lower third
    function lineInfo(b) {
      const P = byPiece[b.piece] || P0; const p = P && b.line != null ? P.lines[b.line] : null;
      const who = (b.lower && b.lower[0]) || (p ? clean(P.names[p.who] || p.who) : '');
      const what = (b.lower && b.lower[1]) || (P ? `${clean(P.source.program)} · ${fmtDate(P.source.date)}` : '');
      return { P, p, who, what, st: p ? p.station : null, dia: p ? p.dia : null, quote: p ? (p.text || p.quote || '') : '' };
    }
    $('dn-clock').textContent = P0 ? `${P0.source.program.toUpperCase()} · ${P0.source.date}` : (EP.show || '').toUpperCase();
    if (EP.endcard) { const e = EP.endcard.lines; $('dn-end').children[0].textContent = (e[0] || EP.show || 'The Parallelogram Report').toUpperCase(); $('dn-end').children[1].textContent = e[1] || ''; $('dn-end').children[2].textContent = e[2] || ''; }
    const zs = z => z == null ? '—' : (z > 0 ? '+' : '') + z.toFixed(1);
    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    // every scored line of every piece, flat; L[i] = { pi, li, pid, P, ...line }
    const L = []; PIECES.forEach((P, pi) => P.lines.forEach((p, li) => L.push(Object.assign({ pi, li, pid: P.id, P }, p))));
    const flatIdx = (pid, li) => L.findIndex(p => p.pid === pid && p.li === li);
    const tapeHTML = L.map(p => `<span class="${p.station}">${p.station === 'O' ? '@O' : p.station}</span> ${p.P.names[p.who] || p.who} ${fmt(p.t)}${p.dia == null ? '' : ' · Dia ' + p.dia}${p.z == null ? '' : ' · z ' + zs(p.z)}<span class="sep">◆</span>`).join('');
    const tape = $('dn-tape'); tape.innerHTML = tapeHTML + tapeHTML;

    // ── the set, in the Plaza
    const PL = PLACE_REGISTRY.find(p => p.key === 'plaza');
    const gy = (typeof getTedHeight === 'function') ? getTedHeight(PL.x, PL.z) : BUILDING_Y;
    // The desk at the Plaza mark, turned so the pedestal (galleria centre) sits just over Ted's right shoulder:
    // Ted faces +z local; his right is −x local; "over the right shoulder" is the local direction (−sin a, −cos a).
    const DN = new THREE.Group(); DN.position.set(PL.x - 1.5, gy, PL.z - 0.5);
    { const a = 16 * Math.PI / 180, dx = 0 - DN.position.x, dz = 0 - DN.position.z;
      DN.rotation.y = Math.atan2(dx, dz) - Math.atan2(-Math.sin(a), -Math.cos(a)); }
    scene.add(DN);
    if (typeof tedTurner !== 'undefined') tedTurner.visible = false;   // the anchor is at the desk; the walker stands down

    // the desk: a broadcast desk in parts that don't touch — a wide top, a curved backlit fascia hung below it,
    // a plinth bar under that, two wings, each on its own slow drift, so the thing hangs together on nothing
    const DESK_Y = 1.02, DESK_W = 3.1, DESK_D = 1.0, DESK_R = 5.2;
    const dark = new THREE.MeshBasicMaterial({ color: 0x0d1119 });
    const darker = new THREE.MeshBasicMaterial({ color: 0x080b11, side: THREE.DoubleSide });
    const amber = new THREE.MeshBasicMaterial({ color: 0xffb13d, side: THREE.DoubleSide });
    const amberSoft = new THREE.MeshBasicMaterial({ color: 0xffb13d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const white = new THREE.MeshBasicMaterial({ color: 0xe8ecff, side: THREE.DoubleSide });
    const parts = [];   // each part's rest pose is read on the first drift, after its position is set
    const part = (mesh, phase, amp) => { mesh.userData.phase = phase; mesh.userData.amp = amp || 0.012; DN.add(mesh); parts.push(mesh); return mesh; };
    // the top: a thin wide slab with a lit underside edge
    const top = part(new THREE.Mesh(new THREE.BoxGeometry(DESK_W, 0.055, DESK_D), dark), 0.0, 0.010); top.position.set(0, DESK_Y, 0);
    const topGlow = part(new THREE.Mesh(new THREE.PlaneGeometry(DESK_W + 0.1, DESK_D + 0.1), amberSoft), 0.0, 0.010); topGlow.rotation.x = Math.PI / 2; topGlow.position.set(0, DESK_Y - 0.03, 0);
    const arc = Math.asin((DESK_W * 0.48) / DESK_R) * 2;
    const curved = (r, h, mat) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64, 1, true, -arc / 2, arc), mat);
    // the fascia: a curved panel hung a hand below the top, a hair forward, with two light lines across it
    const fascia = part(curved(DESK_R, 0.62, darker), 1.1, 0.014); fascia.position.set(0, DESK_Y - 0.40, DESK_D / 2 + 0.06 - DESK_R);
    const back = new THREE.Mesh(new THREE.BoxGeometry(DESK_W + 0.6, 1.0, 0.04), darker); back.position.set(0, DESK_Y - 0.52, -0.3); DN.add(back);   // the modesty panel: the gaps between the parts show it, not the anchor's legs
    const line1 = part(curved(DESK_R + 0.006, 0.018, amber), 1.1, 0.014); line1.position.set(0, DESK_Y - 0.16, DESK_D / 2 + 0.06 - DESK_R);
    const line2 = part(curved(DESK_R + 0.006, 0.010, white), 1.1, 0.014); line2.position.set(0, DESK_Y - 0.66, DESK_D / 2 + 0.06 - DESK_R);
    // the plinth: a shorter bar lower still, set back, with its own amber lip
    const plinth = part(curved(DESK_R - 0.25, 0.14, darker), 2.3, 0.018); plinth.position.set(0, DESK_Y - 0.84, DESK_D / 2 + 0.06 - DESK_R);
    const plinthLip = part(curved(DESK_R - 0.244, 0.014, amber), 2.3, 0.018); plinthLip.position.set(0, DESK_Y - 0.92, DESK_D / 2 + 0.06 - DESK_R);
    // the wings: two slim panels off the ends of the top, angled back, floating free
    [-1, 1].forEach(sx => {
      const w = part(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.9), darker), sx > 0 ? 3.4 : 4.1, 0.016);
      w.position.set(sx * (DESK_W / 2 + 0.16), DESK_Y - 0.22, -0.12); w.rotation.y = sx * 0.28;
      const wl = part(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.9), amber), sx > 0 ? 3.4 : 4.1, 0.016);
      wl.position.set(sx * (DESK_W / 2 + 0.16), DESK_Y - 0.44, -0.12); wl.rotation.y = sx * 0.28;
    });
    // the light pool on the paving, and the amber under-light on Ted's chest
    const under = new THREE.PointLight(0xffb13d, 1.4, 4.5, 2); under.position.set(0, DESK_Y - 0.95, 0.2); DN.add(under);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshBasicMaterial({ color: 0xffb13d, transparent: true, opacity: 0.10, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02; DN.add(pool);
    function driftDesk(t) {
      const sep = 1 + 0.35 * Math.sin(t * 0.21);   // the gaps breathe: the parts drift apart and back
      parts.forEach(m => { if (!m.userData.rest) m.userData.rest = m.position.clone(); const r = m.userData.rest, ph = m.userData.phase, a = m.userData.amp;
        m.position.y = r.y + Math.sin(t * 0.55 + ph) * a * sep + (r.y < DESK_Y - 0.05 ? -(sep - 1) * 0.08 * (DESK_Y - r.y) : 0);
        m.position.x = r.x + Math.sin(t * 0.33 + ph * 1.7) * a * 0.6; });
    }
    // studio light on the anchor
    const key = new THREE.SpotLight(0xfff1dc, 1.1, 14, 0.5, 0.6, 1.5); key.position.set(-2.5, 4.6, 3.6); key.target.position.set(0, 1.3, 0); DN.add(key); DN.add(key.target);
    const rim = new THREE.SpotLight(0x8fb5ff, 0.9, 14, 0.6, 0.6, 1.5); rim.position.set(2.6, 3.8, -2.6); rim.target.position.set(0, 1.3, 0); DN.add(rim); DN.add(rim.target);

    // THE PEDESTAL IS THE STAGE (Sailor, 10-19). The villa's inlined factory predates the Press paths, so for the
    // show the current factory (src/js/prism-graphmap.js) is loaded beside it under its own name and a second
    // instance is hung at the pedestal's own height, the villa's gallery graphmap hidden while the show is on.
    // It turns and comes forward with the beats: `map.orbit` and `map.zoom` from the episode json, and when Ted
    // looks at it (`ted: 'map'`) it slides toward the desk and rises a little so the line he's on reads.
    const GM = await fetch('../src/js/prism-graphmap.js?v=11').then(r => r.text()).then(src => new Function(src.replace(/const PrismGraphmap = /, 'return '))());
    const COL = { LI: 0xb83a3a, RI: 0x3868a8, LP: 0x3a8a52, RP: 0xb87828, O: 0xe8d9a8 };
    try { if (typeof galleryGraphmap !== 'undefined' && galleryGraphmap.group) galleryGraphmap.group.visible = false; } catch (e) {}
    try { ['asteriskGroup', 'ring1', 'ring2', 'ringGlow1', 'trackerGlobe'].forEach(k => { try { const o = eval(k); if (o) o.visible = false; } catch (e) {} }); } catch (e) {}
    const PED_Y = (typeof GRAPH_CENTER_Y !== 'undefined') ? GRAPH_CENTER_Y : 4.3;
    const PED_HOME = new THREE.Vector3(0, PED_Y, 0);
    // "forward" for the stage = from the pedestal toward the desk, flattened
    const toDesk = new THREE.Vector3(DN.position.x, 0, DN.position.z).normalize();
    const stage = new THREE.Group(); stage.position.copy(PED_HOME); scene.add(stage);
    const stageIn = new THREE.Group(); stageIn.rotation.order = 'YXZ'; stage.add(stageIn);   // orbit lives here (yaw, then pitch about its own axis); the slide lives on `stage`
    const g = GM.create({ externalParent: stageIn, mode: 'readonly', capabilities: { orbit: false, zInput: false, zRender: true, diatribeSlider: false, clustering: 'individual' } });
    g.setCornerLabels && g.setCornerLabels({ A: 'LI', B: 'RI', C: 'LP', D: 'RP' });
    // THE STAGE'S OWN LABELS (Sailor, 10-19: the factory's are too small at this distance). The factory's corner
    // sprites are hidden and four large billboard labels stand at the corners, in the station colours, the full
    // name under the mark; the one Ted is on brightens with the beat.
    const bigLabel = (mark, name, color) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d');
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 18;
      x.fillStyle = color; x.font = '800 150px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.fillText(mark, 512, 92);
      x.fillStyle = '#f2f3f7'; x.font = '600 56px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.fillText(name.toUpperCase(), 512, 206);
      const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
      sp.scale.set(2.0, 0.5, 1); sp.renderOrder = 50; return sp; };
    const stageLabels = {};
    { const ext = 1.4;   // the plane is GRAPH_SIZE 2.8 wide in factory units
      const corner = { A: [-1, 1], B: [1, 1], C: [-1, -1], D: [1, -1] };
      Object.keys(STATION).forEach(k => { const [mark, name, color, q] = STATION[k]; const sp = bigLabel(mark, name, color);
        sp.position.set(corner[q][0] * ext * 0.92, corner[q][1] * ext * 1.02, 0.12); stageIn.add(sp); stageLabels[k] = sp; }); }
    try { g.group.traverse(o => { if (o.isSprite && o.scale.x <= 1.5 && o.scale.y <= 0.2) o.visible = false; }); } catch (e) {}   // the factory's small labels
    // the landing card's backing: the plane is translucent and the galleria stands behind it from the landing camera,
    // so on a landing beat an opaque dark card hangs a hair behind the map (the g4 screen's language) and nothing shows through
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.5), new THREE.MeshBasicMaterial({ color: 0x0b0d14, side: THREE.DoubleSide }));
    backing.position.set(0, 0.03, -0.03); backing.visible = false; stageIn.add(backing);
    if (P0) g.loadTrace(P0.trace);   // one trace on the map (the first piece's); several pieces share the plane by their dots
    g.setBoundaryMode && g.setBoundaryMode('dual');
    g.setBoundaryVisible && g.setBoundaryVisible(false);
    L.forEach((p, i) => { g.addDot(p.normX, p.normY, p.quadrant, p.normZ, { color: p.station === 'O' ? COL.O : COL[p.station], radius: p.station === 'O' ? 0.035 : 0.06, shape: p.station === 'O' ? 'diamond' : undefined, label: '', meta: { i } }); g.setDotVisible(i, false); });
    // a dashed path per speaker per piece
    const speakers = [...new Set(L.filter(p => p.station !== 'O').map(p => p.pid + ':' + p.who))];
    speakers.forEach(w => { const st0 = L.find(p => p.pid + ':' + p.who === w).station; g.addPath([], { id: w, color: COL[st0], opacity: .55, dashed: true }); });
    // THE LANDING PLATE: the villa draws its statue and gallery pictures with depth testing off, so they show through
    // anything hung in front of them. On a landing beat the camera therefore renders layer 1 alone — the stage (map,
    // dots, labels, backing) and the lights — and the villa falls away; the desk camera renders everything as before.
    const STAGE_LAYER = 1;
    const stageToLayer = () => { stageIn.traverse(o => o.layers.enable(STAGE_LAYER)); scene.traverse(o => { if (o.isLight) o.layers.enable(STAGE_LAYER); }); };
    // the stage faces the desk at rest; orbit cues turn it from there
    const faceDesk = Math.atan2(toDesk.x, toDesk.z);
    // Where the map goes when Ted turns to it: off the pedestal and over to the desk, into the frame beside him
    // (the pedestal's kind of impossible — it floats across the Plaza and back). `near` is 0 at home, 1 at the desk.
    DN.updateMatrixWorld(true);   // the desk was added this same tick: without this its world matrix can still be the identity here, and the spot lands 12 units behind the desk (a load race that hit the welcome and the modes renders, 2026-10-25)
    const DESK_SPOT = DN.localToWorld(new THREE.Vector3(WIDE ? -1.7 : -0.62, WIDE ? 2.35 : 2.55, -1.5));
    const DESK_ZOOM = WIDE ? 0.62 : 0.46;
    const mapPose = { yaw: 0, pitch: -0.55, zoom: 1, near: 0 }, mapWant = { yaw: 0, pitch: -0.55, zoom: 1, near: 0 };
    function tickStage(t) {
      const k = 0.05;
      for (const key in mapWant) mapPose[key] += (mapWant[key] - mapPose[key]) * k;
      stageIn.rotation.set(mapPose.pitch, faceDesk + mapPose.yaw + Math.sin(t * 0.12) * 0.04, 0);
      const n = mapPose.near, ease = n * n * (3 - 2 * n);
      stageIn.scale.setScalar(mapPose.zoom * (1 + (DESK_ZOOM - 1) * ease));
      stage.position.lerpVectors(PED_HOME, DESK_SPOT, ease); stage.position.y += Math.sin(ease * Math.PI) * 1.2 + Math.sin(t * 0.5) * 0.03;   // an arc on the way over
    }

    // THE MOUNTAIN BEHIND HIM (Sailor: "some kind of texture, lighting or something"): the show runs in the villa's
    // night (gallery) mode so the slope falls into the fog and the desk's own lights carry the frame, and a wide
    // amber wash from behind the desk grazes the slope so it reads as a hillside at dusk rather than a wall.
    try { if (typeof isDarkMode !== 'undefined' && !isDarkMode && typeof toggleMode === 'function') toggleMode(); } catch (e) {}
    // the haze: the villa's fog pulled in to the show's depth, dusk-coloured, so the slope recedes instead of standing flat
    try { scene.fog.color.set(0x4a3d48); scene.fog.near = 18; scene.fog.far = 95; if (typeof lights !== 'undefined') { lights.hemi.intensity = 0.35; lights.ambient.intensity = 0.55; } } catch (e) {}
    const wash = new THREE.SpotLight(0xffa24a, 7, 160, 0.6, 0.7, 1.0);
    wash.position.copy(DN.position).add(new THREE.Vector3(0, 6, 0));
    { const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), DN.rotation.y); wash.target.position.copy(DN.position).addScaledVector(back, 60).add(new THREE.Vector3(0, 18, 0)); }
    scene.add(wash); scene.add(wash.target);
    const washCool = new THREE.SpotLight(0x5f84ff, 4, 180, 0.75, 0.9, 1.0);
    washCool.position.copy(wash.position).add(new THREE.Vector3(8, 4, 0)); washCool.target.position.copy(wash.target.position).add(new THREE.Vector3(14, 10, 0));
    scene.add(washCool); scene.add(washCool.target);
    // the anchor: the villa's own animal, seated behind the desk on nothing
    const ted = buildCoyote(); ted.scale.setScalar(1.3); ted.position.set(0, 0.0, -0.95); ted.rotation.order = 'YXZ'; ted.rotation.x = -0.1;
    const U = ted.userData;
    (U.legs || []).forEach((l, i) => { const grp = l.group || l.hip; if (!grp) return; if (i >= 2) { grp.rotation.x = -1.25; } });
    DN.add(ted);
    const jawRest = U.jaw ? U.jaw.position.y : null;
    let level = 0, look = 'camera';
    // THE ELEPHANT IN THE ROOM (the welcome beat): a beat with `elephant: { from: [x, z], to: [x, z] }` (desk-local
    // units, defaults: right to left across the back of the Plaza) walks it through the background over the beat.
    // Built in dream-elephant.js, loaded only when an episode asks for it.
    let elephant = null, elephantAt = null;   // elephantAt = { x, z, heading } for this frame, or null (hidden)
    if (beats.some(b => b.elephant)) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'dream-elephant.js?v=1'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }).catch(e => console.error('[dream-news] elephant', e));
      if (typeof buildElephant === 'function') { elephant = buildElephant(); elephant.scale.setScalar(1.0); elephant.visible = false; DN.add(elephant); }
    }
    function poseElephant(t) {
      if (!elephant) return;
      elephant.visible = !!elephantAt;
      if (!elephantAt) return;
      // its feet on the villa's own ground (the Plaza paving, or the slope behind it), read the way the desk's height was
      const w = DN.localToWorld(new THREE.Vector3(elephantAt.x, 0, elephantAt.z));
      const groundY = (typeof getTedHeight === 'function') ? getTedHeight(w.x, w.z) : DN.position.y;
      elephant.position.set(elephantAt.x, 0, elephantAt.z); elephant.rotation.y = elephantAt.heading;
      elephant.userData.walk(t, 0);                        // walk() sets the group's y to its bob
      elephant.position.y += groundY - DN.position.y;      // …on top of the ground, in the desk's frame
    }
    function poseTed(t) {
      ted.position.y = 0.0 + Math.sin(t * 1.3) * 0.006; ted.position.z = -0.95;
      if (U.head) {
        const want = look === 'map' ? { x: -0.2, y: -1.05 } : { x: 0.02, y: 0 };
        U.head.rotation.y += (want.y - U.head.rotation.y) * 0.08; U.head.rotation.x += (want.x - U.head.rotation.x) * 0.08;
      }
      if (U.jaw && jawRest != null) U.jaw.position.y = jawRest - level * 0.05;
      if (U.tail) U.tail.rotation.y = Math.sin(t * 2.2) * 0.1;
    }

    // ── the camera: pinned to the desk with a slow push-in over the episode; on a landing beat it cuts to the map
    //    alone — the map flies to its spot beside the desk (the desk hidden), where nothing of the galleria stands
    //    through it, and the camera sits square in front of it, close enough that the plane and its labels fill the frame
    const camFrom = new THREE.Vector3(), camAt = new THREE.Vector3(), camRight = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    function placeCamera(t) {
      if (cur && cur.type === 'land') {
        const s = stageIn.scale.x, half = 1.4 * 1.12 * s;                        // the plane's half-height plus its labels, in world units
        const dist = half / Math.tan((camera.fov || 60) / 2 * Math.PI / 180) * (WIDE ? 1.26 : 1.9);
        // the target sits a little below and left of the map, so the map reads up and to the right of the Dia card
        camRight.crossVectors(toDesk, UP).normalize();
        camAt.copy(stage.position); camAt.y -= 0.34 * s; camAt.addScaledVector(camRight, WIDE ? 0.62 * s : 0);
        camFrom.copy(camAt).addScaledVector(toDesk, dist); camFrom.y += dist * 0.2;   // from the desk's side, a little above
        camera.layers.set(STAGE_LAYER);
      } else {
        camera.layers.set(0);
        const k = Math.min(1, t / Math.max(1, DURATION));
        const dist = (WIDE ? 5.0 : 5.8) - k * 0.5;
        camFrom.set(0.12, 1.38, dist); camAt.set(0, WIDE ? 1.7 : 1.95, -0.9);
        DN.localToWorld(camFrom); DN.localToWorld(camAt);
      }
      camera.position.copy(camFrom); camera.lookAt(camAt);
      if (typeof camTarget !== 'undefined' && camTarget.copy) camTarget.copy(camAt);
    }

    // ── the lines' arrival on the map, seek-safe: for every flat line, the earliest show time at which a clip or a
    //    landing reveals it (a clip reveals its line when the line's own second passes inside the cut; a landing at its start)
    const revealAt = new Array(L.length).fill(null);
    const earlier = (i, at) => { if (at != null && (revealAt[i] == null || at < revealAt[i])) revealAt[i] = at; };
    beats.forEach(b => {
      if (b.type === 'clip' && b.piece) {
        const cin = (CLIP_IN[b.src] && CLIP_IN[b.src].in) || 0;
        const only = b.lines || (b.line != null ? [b.line] : null);
        L.forEach((p, i) => { if (p.pid !== b.piece) return; if (only && !only.includes(p.li)) return;
          const local = p.t - cin;   // where the line starts inside the clip file
          if (only || (local >= b.in - 0.5 && local <= b.out + 0.5)) earlier(i, Math.min(b.end, b.start + Math.max(0, local - b.in))); });
      }
      if (b.type === 'land' && b.piece && b.line != null) { const i = flatIdx(b.piece, b.line); if (i >= 0) earlier(i, b.start); }
    });
    // a text beat's map.reveal is tape-seconds of its piece shown so far ('all' = the whole tape), eased in over the
    // beat's first 60%; the latest such beat at or before t rules its piece
    function pieceUpto(pid, t) {
      let prev = 0, val = null, at = null;
      for (const x of beats) { if (x.start > t) break; if (x.type !== 'text' || !x.map || x.map.reveal == null || (x.piece || (P0 && P0.id)) !== pid) continue; if (val != null) prev = val; val = x.map.reveal === 'all' ? 1e9 : x.map.reveal; at = x; }
      if (val == null) return -1;
      const f = Math.min(1, Math.max(0, (t - at.start) / Math.max(0.1, (at.end - at.start) * 0.6)));
      return prev + (val - prev) * f;
    }

    // ── one seek(t) sets everything for that moment
    let showT = 0, cur = null;
    if (CAPTURE) clock.getElapsedTime = () => showT;   // the villa's own clock runs on the renderer's time under capture
    function beatAt(t) { let b = null; for (const x of beats) if (t >= x.start) b = x; return b; }
    const vid = $('dn-clip');
    function applyMap(t, b) {
      const m = b.map || {};
      const pid = b.piece || (P0 && P0.id);
      if (b.type === 'land') { const o = b.orbit || [0, -40]; mapWant.yaw = o[0] * Math.PI / 180; mapWant.pitch = -(90 + o[1]) * Math.PI / 180 * 0.35; if (b.zoom) mapWant.zoom = Math.min(1.35, Math.max(0.8, 7 / b.zoom)); mapWant.near = 1; }
      else {
        if (m.orbit) { mapWant.yaw = m.orbit[0] * Math.PI / 180; mapWant.pitch = -(90 + m.orbit[1]) * Math.PI / 180 * 0.9; }
        if (m.zoom) mapWant.zoom = Math.min(1.35, Math.max(0.8, 7 / m.zoom));
        mapWant.near = (b.ted === 'map') ? 1 : 0;
      }
      g.setTraceVisible && g.setTraceVisible(!!m.trace);
      const upto = {}; PIECE_IDS.forEach(id => { upto[id] = pieceUpto(id, t); });
      const focus = (b.type === 'text' && m.focus != null) ? flatIdx(pid, m.focus) : (b.type === 'land' && b.line != null) ? flatIdx(pid, b.line) : -1;
      const landS = b.type === 'land' ? 1.6 + 1.6 * Math.max(0, 1 - (t - b.start) / 0.35) : 2.4;   // a landing dot drops in big and settles
      const seen = {};
      L.forEach((p, i) => {
        const on = (revealAt[i] != null && t >= revealAt[i]) || p.t <= upto[p.pid];
        g.setDotVisible(i, on); g.setDotEmphasis && g.setDotEmphasis(i, focus === i ? landS : 1);
        if (on && p.station !== 'O') (seen[p.pid + ':' + p.who] = seen[p.pid + ':' + p.who] || []).push({ x: p.normX, y: p.normY, z: p.normZ }); });
      speakers.forEach(w => g.setPath(w, m.paths ? (seen[w] || []) : []));
    }
    function setLower(b) {
      const li = lineInfo(b); const S = li.st && STATION[li.st];
      $('dn-lower').querySelector('.bar').style.background = S ? S[2] : '#ffb13d';
      $('dn-lower').querySelector('.who').textContent = li.who;
      $('dn-lower').querySelector('.what').innerHTML = (S ? `<span class="st" style="color:${S[2]}">■ ${S[0]}</span> · ` : '') + li.what;
    }
    function setLand(b) {
      const li = lineInfo(b); const S = li.st && STATION[li.st]; const el = $('dn-land');
      el.querySelector('.dia .n').textContent = li.dia == null ? '—' : li.dia; el.querySelector('.dia .n').style.color = S ? S[2] : '#fff';
      el.querySelector('.who').textContent = li.who;
      el.querySelector('.what').innerHTML = (S ? `<span class="st" style="color:${S[2]};font-weight:800">■ ${S[0]} · ${S[1]}</span> · ` : '') + li.what;
      el.querySelector('.quote').textContent = li.quote ? '“' + li.quote + '”' : '';
    }
    function showClip(b, t) {
      const url = clipURL(b.src); if (vid.dataset.src !== url) { vid.dataset.src = url; vid.src = url; }
      vid.style.display = 'block';
      const want = b.in + (t - b.start);
      if (CAPTURE) { if (Math.abs((vid.currentTime || 0) - want) > 0.04) vid.currentTime = want; }
      else { if (vid.paused || Math.abs(vid.currentTime - want) > 0.35) { vid.currentTime = want; vid.play().catch(() => {}); } }
    }
    function hideClip() { if (vid.style.display !== 'none') { vid.style.display = 'none'; if (!vid.paused) vid.pause(); } }
    function seek(t) {
      showT = t;
      const b = beatAt(t);
      const over = TL && TL.duration ? t >= TL.duration : (b && b === beats[beats.length - 1] && t >= b.end);
      $('dn-end').style.display = (over && EP.endcard) ? 'flex' : 'none';
      $('dn-black').style.display = (!b && beats.length) ? 'block' : 'none';   // the lead: black until the first beat
      if (b) {
        if (b !== cur) {
          const prevType = cur && cur.type; cur = b;
          document.body.classList.toggle('chrome-bug', (b.block.chrome || 'full') === 'bug');
          const li = lineInfo(b); const Pb = byPiece[b.piece] || (EP.piece ? P0 : null);   // a beat without a piece (the welcome) carries the show's own line, unless the episode is a one-piece v1
          $('dn-chyron').querySelector('.h').textContent = b.caption || ''; $('dn-chyron').querySelector('.tag').textContent = (b.block.title || '').toUpperCase();
          const st = (b.type === 'text' && b.map && b.map.focus != null && Pb && Pb.lines[b.map.focus]) ? Pb.lines[b.map.focus].station : li.st; const S = st && STATION[st];
          $('dn-chyron').querySelector('.s').innerHTML = (S ? `<span class="st" style="color:${S[2]}">■ ${S[0]} · ${S[1]}</span> · ` : '') + (Pb ? `${Pb.title} · ${clean(Pb.source.program)}` : `${EP.show || 'The Parallelogram Report'}${EP.title ? ' · ' + EP.title : ''}`);
          $('dn-clock').textContent = Pb ? `${clean(Pb.source.program).toUpperCase()} · ${fmtDate(Pb.source.date).toUpperCase()}` : (EP.title || '').toUpperCase();
          look = b.ted || 'camera';
          Object.keys(stageLabels).forEach(k => { stageLabels[k].material.opacity = (!st || st === k) ? 1 : 0.7; });
          // the beat's kind sets the frame: clip → the video and its lower third; land → the stage camera and the card; text → the desk
          const isClip = b.type === 'clip' && (b.layout || 'full') === 'full', isLand = b.type === 'land';
          $('dn-lower').style.display = isClip ? 'flex' : 'none'; if (isClip) setLower(b);
          $('dn-land').style.display = isLand ? 'flex' : 'none'; if (isLand) setLand(b);
          DN.visible = !isLand; backing.visible = isLand; if (isLand) stageToLayer();
          if (!isClip) hideClip();
          applyMap(t, b);
          if (prevType !== b.type) Object.assign(mapPose, mapWant);   // a hard cut: no easing into the new pose
        } else applyMap(t, b);
        if (b.type === 'clip' && (b.layout || 'full') === 'full') showClip(b, t);
        if (b.elephant && elephant) {
          const e = b.elephant === true ? {} : b.elephant, from = e.from || [10.5, -7.5], to = e.to || [-10.5, -6.5];
          const lead = e.lead != null ? e.lead : 0.02, span = Math.max(0.1, (b.end - b.start) * (e.span != null ? e.span : 1));
          const u = (t - b.start - lead * (b.end - b.start)) / span;
          if (u >= 0 && u <= 1) { const x = from[0] + (to[0] - from[0]) * u, z = from[1] + (to[1] - from[1]) * u; elephantAt = { x, z, heading: Math.atan2(to[0] - from[0], to[1] - from[1]) }; }
          else elephantAt = null;
        } else elephantAt = null;
        if (b.words) { const lit = b.words.filter(w => w.s <= t).slice(-9); $('dn-sub').innerHTML = lit.map((w, i) => i === lit.length - 1 ? `<b>${w.w}</b>` : w.w).join(' '); } else $('dn-sub').textContent = '';
      }
      if (TL && TL.envelope && TL.envelope.length && TL.fps) level = TL.envelope[Math.floor(t * TL.fps)] || 0;
      else if (b && !CAPTURE) level = (b.type === 'text' && t < b.end) ? 0.35 + 0.35 * Math.abs(Math.sin(t * 9)) : 0;
      tape.style.transform = `translateX(${-((t * 110) % (tape.scrollWidth / 2))}px)`;
      const ctl = $('dn-t'); if (ctl) ctl.textContent = t.toFixed(1);
    }
    // the renderer's lower-third frame: the page shows nothing but the bug and the lower third for that beat, over
    // nothing (transparent), so ffmpeg can lay it on the clip; overlay(null) puts the set back
    function overlay(id) {
      const b = id ? beats.find(x => x.id === id) : null;
      document.body.classList.toggle('overlay', !!b); document.documentElement.classList.toggle('dream-news-overlay', !!b);
      if (b) { setLower(b); $('dn-lower').style.display = 'flex'; }
      else if (!(cur && cur.type === 'clip')) $('dn-lower').style.display = 'none';
    }
    // the same frame as markup, for the renderer to draw in a blank tab of its own (the villa paints a tinted body
    // and a hidden canvas under everything, so a transparent capture of this page never comes out clean)
    function overlayHTML(id) {
      const b = beats.find(x => x.id === id); if (!b) return null;
      const keep = $('dn-lower').style.display; setLower(b);
      const html = $('dn-bug').outerHTML + $('dn-lower').outerHTML.replace(/style="[^"]*"/, 'style="display:flex"');
      $('dn-lower').style.display = keep;
      return { css: css.textContent, html };
    }
    // every drawn frame: the map eases to its pose, Ted moves, the camera holds — hooked on the villa's own render call
    const origRender = renderer.render.bind(renderer);
    renderer.render = function (s, c) {
      const t = CAPTURE ? showT : (clock.getElapsedTime());
      tickStage(t); try { g.update && g.update(t); } catch (e) {}
      poseTed(t); driftDesk(t); poseElephant(t);
      placeCamera(showT);
      origRender(s, c);
    };

    // ── preview clock (the browser plays the mixed track, audio.mp3, so the clip <video> stays muted)
    if (!CAPTURE) {
      let raf = null, t0 = 0, audio = new Audio('../data/show/' + ID + '/audio.mp3'); audio.onerror = () => { audio = null; };
      const tick = () => { const t = audio && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000; seek(t); if (t < DURATION) raf = requestAnimationFrame(tick); };
      $('dn-play').onclick = () => { t0 = performance.now(); if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } cancelAnimationFrame(raf); tick(); };
      $('dn-stop').onclick = () => { cancelAnimationFrame(raf); if (audio) audio.pause(); hideClip(); };
    }
    stageToLayer();
    seek(0);
    window.SHOW = {
      ready: true, duration: DURATION, fps: EP.fps || 24, seek, level: v => { level = v; }, overlay, overlayHTML, aspect: ASPECT, width: WIDE ? 1920 : 1080, height: WIDE ? 1080 : 1920, scale: 1,
      blocks: (TL && TL.blocks) || blocks.map(blk => ({ id: blk.id, title: blk.title, clip: !!blk.clip, start: beats.find(b => b.block === blk).start, end: beats.filter(b => b.block === blk).slice(-1)[0].end })),
      beats: beats.map(b => ({ id: b.id, type: b.type, block: b.block.id, start: b.start, end: b.end, src: b.src, in: b.in, out: b.out, layout: b.type === 'clip' ? (b.layout || 'full') : undefined, piece: b.piece, line: b.line })),
      clipsDir: CLIPS_DIR,
      dbg: () => ({ cur: cur && cur.id, look, mapPose: Object.assign({}, mapPose), mapWant: Object.assign({}, mapWant), stage: stage.position.toArray().map(v => +v.toFixed(2)), deskSpot: DESK_SPOT.toArray().map(v => +v.toFixed(2)), nearLocal: DN.worldToLocal(stage.position.clone()).toArray().map(v => +v.toFixed(2)), cam: camera.position.toArray().map(v => +v.toFixed(2)) }),   // for a look under capture: the map's pose and where it is in the desk's frame
    };
  })().catch(e => { console.error('[dream-news]', e); });
})();
