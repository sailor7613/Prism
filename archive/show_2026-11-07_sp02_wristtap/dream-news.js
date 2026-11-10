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
//          hidden, the line's dot drops in with its diatribe score on a card.
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
    body.dream-news > :not(#scene-container):not(#dn):not(#dn-ctl):not(script):not(style) { display: none !important; }
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
    #dn-land .nums { display: flex; gap: 2.2vw; align-items: flex-end; }
    #dn-land .num { display: flex; flex-direction: column; align-items: flex-start; line-height: .9; }
    #dn-land .num .n { font-size: clamp(64px, 9vw, 180px); font-weight: 800; letter-spacing: -.04em; text-shadow: 0 4px 24px rgba(0,0,0,.9); }
    #dn-land .num .l { font-size: clamp(11px, 1.1vw, 22px); letter-spacing: .3em; opacity: .8; margin-top: .6vh; }
    #dn-land .txt { padding-bottom: 1.2vh; }
    #dn-land .who { font-size: clamp(20px, 2.2vw, 44px); font-weight: 800; letter-spacing: -.01em; text-shadow: 0 2px 10px rgba(0,0,0,.9); }
    #dn-land .what { font-size: clamp(12px, 1.1vw, 22px); letter-spacing: .14em; text-transform: uppercase; opacity: .85; margin-top: .6vh; }
    #dn-land .quote { font-size: clamp(14px, 1.4vw, 28px); font-style: italic; opacity: .9; margin-top: 1vh; max-width: 48vw; line-height: 1.3; text-shadow: 0 2px 8px rgba(0,0,0,.9); }
    /* black before the first beat (the lead), so the show cuts in from black */
    #dn-black { position: absolute; inset: 0; background: #000; display: none; }
    /* the big words (10-28): the clocked line, centred, each word popping in as it's spoken */
    #dn-big { position: absolute; left: 8vw; right: 8vw; top: 0; bottom: 22vh; display: none; align-items: center; justify-content: center; flex-wrap: wrap; align-content: center; gap: .2em .34em; text-align: center; font-weight: 800; font-size: clamp(30px, 5.4vw, 108px); line-height: 1.05; letter-spacing: -.02em; color: #fff; text-shadow: 0 6px 34px rgba(0,0,0,.95), 0 1px 4px rgba(0,0,0,.9); pointer-events: none; }
    #dn-big span { display: inline-block; opacity: .92; }
    #dn-big span.new { animation: dn-pop .32s cubic-bezier(.2,1.4,.4,1) both; }
    @keyframes dn-pop { from { transform: scale(.55) translateY(.25em); opacity: 0; } to { transform: none; opacity: .92; } }
    body.dream-news.reading #dn-land { bottom: 24vh; }   /* the reading: the landing card sits above the chyron */
    body.dream-news.reading #dn-land .num .n { font-size: clamp(34px, 4.6vw, 92px); }   /* …and its numbers stay out of the g4's way */
    body.dream-news.reading #dn-land .nums { gap: 1.4vw; }
    /* the score card (10-26): a piece's three numbers, held while Ted talks them through */
    #dn-score { position: absolute; right: 3.5vw; top: 16vh; width: min(30vw, 520px); display: none; background: rgba(8,10,16,.88); border: 1px solid #2a2f42; border-top: 3px solid #ffb13d; border-radius: 6px; padding: 1.6vh 1.4vw 1.4vh; color: #f2f3f7; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
    #dn-score .k { font-size: clamp(10px, .85vw, 16px); letter-spacing: .16em; text-transform: uppercase; opacity: .7; }
    #dn-score .t { font-size: clamp(14px, 1.35vw, 26px); font-weight: 700; margin-top: .4vh; }
    #dn-score .row { display: grid; grid-template-columns: auto 1fr; gap: .2vh 1vw; align-items: baseline; margin-top: 1.4vh; }
    #dn-score .n { font-size: clamp(26px, 3vw, 58px); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
    #dn-score .l { font-size: clamp(11px, 1vw, 19px); letter-spacing: .12em; text-transform: uppercase; }
    #dn-score .l small { display: block; letter-spacing: .02em; text-transform: none; opacity: .75; font-size: clamp(11px, .95vw, 18px); margin-top: .3vh; }
    #dn-score .v { margin-top: 1.4vh; padding-top: 1vh; border-top: 1px solid #2a2f42; font-size: clamp(11px, .95vw, 18px); line-height: 1.6; opacity: .9; }
    #dn-score .on { color: #ffb13d; }
    /* the console (live mode): play / pause, beats, blocks, scrub — H hides it for a clean recording */
    #dn-ctl { position: fixed; left: 50%; transform: translateX(-50%); top: 9vh; z-index: 2100; width: min(880px, 92vw); font: 12px/1.3 system-ui, sans-serif; color: #d8dbe6; background: rgba(11,13,20,.86); border: 1px solid #2a2f42; padding: 10px 12px 8px; border-radius: 10px; pointer-events: auto; cursor: default; backdrop-filter: blur(6px); transition: opacity .35s; }
    #dn-ctl.hidden { opacity: 0; pointer-events: none; }
    #dn-ctl .row { display: flex; align-items: center; gap: 6px; }
    #dn-ctl button { font: 13px system-ui; background: #1b1f2e; color: #e8eaf2; border: 1px solid #343a52; border-radius: 6px; padding: 4px 9px; cursor: pointer; }
    #dn-ctl button:hover { background: #262b3f; }
    #dn-ctl #dn-play { min-width: 64px; font-weight: 700; background: linear-gradient(135deg, #ff4f3d, #ffb13d); color: #111; border: 0; }
    #dn-ctl .t { margin-left: 6px; font-variant-numeric: tabular-nums; opacity: .85; }
    #dn-ctl label { margin-left: auto; display: flex; align-items: center; gap: 5px; opacity: .85; cursor: pointer; }
    #dn-ctl .keys { opacity: .45; margin-left: 10px; white-space: nowrap; }
    #dn-bar { position: relative; display: flex; height: 22px; margin: 9px 0 5px; border-radius: 5px; overflow: hidden; cursor: pointer; background: #12141d; }
    #dn-bar .seg { position: relative; height: 100%; border-right: 2px solid #0b0d14; background: #20253a; display: flex; align-items: center; padding: 0 6px; overflow: hidden; white-space: nowrap; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #9aa1bb; }
    #dn-bar .seg.on { background: #2c3350; color: #fff; }
    #dn-bar .fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255,177,61,.28); pointer-events: none; }
    #dn-bar .head { position: absolute; top: 0; bottom: 0; width: 2px; background: #ffb13d; pointer-events: none; }
    #dn-now { opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    body.dream-news.capture #dn-ctl { display: none; }
    /* chrome: 'bug' blocks (the cold open) show only the bug, the words and whatever the beat type adds */
    body.dream-news.chrome-bug #dn-clock, body.dream-news.chrome-bug #dn-chyron, body.dream-news.chrome-bug #dn-ticker { display: none !important; }
    body.dream-news.credits #dn-clock, body.dream-news.credits #dn-chyron, body.dream-news.credits #dn-ticker, body.dream-news.credits #dn-bug, body.dream-news.credits #dn-sub { display: none !important; }
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
    <div id="dn-land"><div class="nums"><div class="dia num"><div class="n"></div><div class="l">DIATRIBE</div></div><div class="zn num"><div class="n"></div><div class="l">Z</div></div><div class="lum num"><div class="n"></div><div class="l">LUMENS</div></div></div><div class="txt"><div class="who"></div><div class="what"></div><div class="quote"></div></div></div>
    <div id="dn-ticker"><div class="lbl">THE TAPE</div><div class="run"><div id="dn-tape"></div></div></div>
    <div id="dn-end"><div class="a"></div><div class="b"></div><div class="c"></div></div>
    <div id="dn-score"></div>
    <div id="dn-black"></div>
    <div id="dn-big"></div>`;
  document.body.appendChild(dn);
  if (!CAPTURE) { const c = document.createElement('div'); c.id = 'dn-ctl'; c.innerHTML = '<div class="row"><button id="dn-prevb" title="previous block  ( [ )">⏮</button><button id="dn-prev" title="previous beat  ( ← )">◀</button><button id="dn-play" title="play / pause  ( space )">▶ play</button><button id="dn-next" title="next beat  ( → )">▶</button><button id="dn-nextb" title="next block  ( ] )">⏭</button><span class="t"><span id="dn-t">0:00</span> / <span id="dn-dur">0:00</span></span><label title="stop at the end of each block, to talk it through  ( P )"><input type="checkbox" id="dn-hold"> pause between blocks</label><span class="keys">space · ← → · [ ] · P · H hides</span>' + (window.parent !== window ? '<button id="dn-glass" title="back to the glass  ( Esc )">⟵ glass</button>' : '') + '</div><div id="dn-bar"></div><div id="dn-now"></div>'; document.body.appendChild(c); }
  else document.body.classList.add('capture');

  const $ = id => document.getElementById(id);
  const LIVE = { playing: false };   // the console's state; the clip <video> only plays while this is true

  (async function () {
    const EP = await fetch('../data/show/' + ID + '.json?v=' + Date.now()).then(r => r.json());
    // the pieces on the map: v2 lists several (EP.pieces); v1 names one (EP.piece)
    const PIECE_IDS = EP.pieces || (EP.piece ? [EP.piece] : []);
    const PIECES = await Promise.all(PIECE_IDS.map(id => fetch('../data/press/' + id + '.json').then(r => r.json()).then(p => { p.id = p.id || id; return p; })));
    const byPiece = {}; PIECE_IDS.forEach((id, i) => { byPiece[id] = PIECES[i]; });
    const P0 = PIECES[0];
    let TL = null; try { const r = await fetch('../data/show/' + ID + '/timeline.json?v=' + Date.now()); if (r.ok) TL = await r.json(); } catch (e) {}
    const CLIPS_DIR = (EP.clipsDir || 'Transcripts/show/ep01/clips').replace(/^\/+|\/+$/g, '');
    const clipURL = src => '/' + CLIPS_DIR + '/' + src + '.mp4';   // the workspace is served from its root
    const CLIP_IN = EP.clips || {};   // clips[src].in = seconds on the source tape where the clip file starts

    const blocks = EP.blocks || [{ id: 'all', title: EP.segment || 'The Reduced', clip: true, beats: EP.beats }];
    const beats = []; blocks.forEach(blk => blk.beats.forEach(b => beats.push({ ...b, type: b.type || 'text', block: blk })));
    if (TL && TL.beats) { const by = Object.fromEntries(TL.beats.map(b => [b.id, b])); beats.forEach(b => { const t = by[b.id]; if (t) { b.start = t.start; b.end = t.end; b.words = t.words || null; } });
      // 11-03: a beat the mix doesn't have yet (written, not yet voiced and mixed) sits out until the next mix — the
      // show plays the mix it has instead of going black
      for (let i = beats.length - 1; i >= 0; i--) if (beats[i].start == null) { console.warn('[dream-news] not in the mix yet:', beats[i].id); beats.splice(i, 1); } }
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
      return { P, p, who, what, st: p ? p.station : null, dia: p ? p.dia : null, z: p ? p.z : null, lumens: (P && P.scoreboard) ? P.scoreboard.lumens : null, quote: p ? (p.text || p.quote || '') : '' };
    }
    $('dn-clock').textContent = P0 ? `${P0.source.program.toUpperCase()} · ${P0.source.date}` : (EP.show || '').toUpperCase();
    if (EP.endcard) { const e = EP.endcard.lines; $('dn-end').children[0].textContent = (e[0] || EP.show || 'The Parallelogram Report').toUpperCase(); $('dn-end').children[1].textContent = e[1] || ''; $('dn-end').children[2].textContent = e[2] || ''; }
    const zs = z => z == null ? '—' : (z > 0 ? '+' : '') + z.toFixed(1);
    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    // every scored line of every piece, flat; L[i] = { pi, li, pid, P, ...line }
    const L = []; PIECES.forEach((P, pi) => P.lines.forEach((p, li) => L.push(Object.assign({ pi, li, pid: P.id, P }, p))));
    const flatIdx = (pid, li) => L.findIndex(p => p.pid === pid && p.li === li);
    const tapeHTML = L.map(p => `<span class="${p.station}">${p.station === 'O' ? '@O' : p.station}</span> ${p.P.names[p.who] || p.who} ${fmt(p.t)}${p.dia == null ? '' : ' · diatribe ' + p.dia}${p.z == null ? '' : ' · z ' + zs(p.z)}<span class="sep">◆</span>`).join('');
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
    const g = GM.create({ externalParent: stageIn, mode: 'readonly', capabilities: { orbit: false, zInput: true, zRender: true, diatribeSlider: false, clustering: 'individual' } });
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
    const LAND_PED = EP.landOnPedestal !== false;
    const LAND_YAW = (() => { const q = new URLSearchParams(location.search).get('landYaw'); return q != null ? +q : EP.landYaw != null ? EP.landYaw : -0.7; })();   // the pedestal shot comes round this far from the desk's side, so the Venus isn't behind the plane
    const dotW = new THREE.Vector3(), closeFrom = new THREE.Vector3(), closeAt = new THREE.Vector3(), sideDir = new THREE.Vector3(), sideFrom = new THREE.Vector3(), sideAt = new THREE.Vector3(), _sd = new THREE.Vector3();
    const landIdx = b => (b && b.type === 'land' && b.piece && b.line != null) ? flatIdx(b.piece, b.line) : -1;
    const landDir = new THREE.Vector3();   // landings on the villa's own pedestal (10-26); false = the old black plate at the desk spot
    const mapPose = { yaw: 0, pitch: -0.55, zoom: 1, near: 0, drop: 0, focus: 0 }, mapWant = { yaw: 0, pitch: -0.55, zoom: 1, near: 0, drop: 0, focus: 0 }; let focusPid = null; const _fp = new THREE.Vector3();
    function tickStage(t) {
      const k = 0.05;
      { const z = Math.max(0.8, mapPose.zoom * (1 + (DESK_ZOOM - 1) * (mapPose.near * mapPose.near * (3 - 2 * mapPose.near)))); const f = Math.min(1, 0.9 / z);   // 10-29: the corner labels shrink as the map grows
        Object.values(stageLabels).forEach(sp => sp.scale.set(2.0 * f, 0.5 * f, 1)); }
      for (const key in mapWant) mapPose[key] += (mapWant[key] - mapPose[key]) * k;
      stageIn.rotation.set(mapPose.pitch, faceDesk + mapPose.yaw + Math.sin(t * 0.12) * 0.04, 0);
      const n = mapPose.near, ease = n * n * (3 - 2 * n);
      stageIn.scale.setScalar(mapPose.zoom * (1 + (DESK_ZOOM - 1) * ease));
      stage.position.lerpVectors(PED_HOME, DESK_SPOT, ease); stage.position.y += Math.sin(ease * Math.PI) * 1.2 + Math.sin(t * 0.5) * 0.03 - mapPose.drop * ease;   // drop (10-27): the map lowered in frame for the edge-on z views
      if (mapPose.focus > 0.001 && focusPid && typeof PINS !== 'undefined') { const P = PINS.find(x => x.pid === focusPid); if (P) {   // focusPin (10-28): slide the map so the pin sits where its centre was
        stage.updateMatrixWorld(true); _fp.copy(P.pos); P.mesh.parent.localToWorld(_fp); _fp.sub(stage.position); stage.position.addScaledVector(_fp, -mapPose.focus); } }   // an arc on the way over
    }

    // THE MOUNTAIN BEHIND HIM (Sailor: "some kind of texture, lighting or something"): the show runs in the villa's
    // night (gallery) mode so the slope falls into the fog and the desk's own lights carry the frame, and a wide
    // amber wash from behind the desk grazes the slope so it reads as a hillside at dusk rather than a wall.
    try { if (typeof isDarkMode !== 'undefined' && !isDarkMode && typeof toggleMode === 'function') toggleMode(); } catch (e) {}
    // the haze: the villa's fog pulled in to the show's depth, dusk-coloured, so the slope recedes instead of standing flat
    try { scene.fog.color.set(0x4a3d48); scene.fog.near = 18; scene.fog.far = 95; if (typeof lights !== 'undefined') { lights.hemi.intensity = 0.35; lights.ambient.intensity = 0.55; } } catch (e) {}
    // THE HILL (2026-10-26, Sailor: "more green, maybe with some soft grass texture"): the slope behind the desk is the
    // villa's terrain (its rocky-peak colours, washed pale by the haze). In the show it gets a soft grass texture, a green
    // tint over its own colours, and a thinner, greener haze so the green survives the distance.
    const hillShaders = [];
    try {
      const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gx = gc.getContext('2d');
      gx.fillStyle = '#4f7a46'; gx.fillRect(0, 0, 256, 256);
      let sd = 11; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 2600; i++) {                    // soft blades: short strokes in lighter and darker greens
        const x = rnd() * 256, y = rnd() * 256, l = 3 + rnd() * 7, a = -0.4 + rnd() * 0.8, k = rnd();
        gx.strokeStyle = k > 0.55 ? `rgba(${150 + rnd() * 40 | 0},${185 + rnd() * 40 | 0},${110 + rnd() * 30 | 0},.35)` : `rgba(${50 + rnd() * 20 | 0},${80 + rnd() * 25 | 0},${40 + rnd() * 15 | 0},.35)`;
        gx.lineWidth = 0.8 + rnd() * 1.2; gx.beginPath(); gx.moveTo(x, y); gx.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); gx.stroke();
        for (const [ox, oy] of [[256, 0], [-256, 0], [0, 256], [0, -256]]) { gx.beginPath(); gx.moveTo(x + ox, y + oy); gx.lineTo(x + ox + Math.sin(a) * l, y + oy - Math.cos(a) * l); gx.stroke(); }   // tile cleanly
      }
      gx.filter = 'blur(0.6px)'; gx.drawImage(gc, 0, 0); gx.filter = 'none';
      const grass = new THREE.CanvasTexture(gc); grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
      try { grass.anisotropy = renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
      scene.traverse(o => { if (o.isMesh && o.userData && o.userData.isTerrain) {
        const sz = (o.geometry.parameters && o.geometry.parameters.width) || 400; grass.repeat.set(sz / 7, sz / 7);
        o.material = o.material.clone(); o.material.map = grass; o.material.color.set(0x6fa062); o.material.needsUpdate = true;   // 10-29: a darker green
        // THE BREEZE (10-29, Sailor: "a nice breeze blowing over long grass up the hill"): bands of light move across the slope
        o.material.onBeforeCompile = sh => { sh.uniforms.uBreeze = { value: 0 }; hillShaders.push(sh);
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBreeze; varying vec3 vWp;')
            .replace('#include <dithering_fragment>', `#include <dithering_fragment>
              float g1 = sin(vWp.x * 0.11 + vWp.z * 0.07 + vWp.y * 0.05 - uBreeze * 1.1);
              float g2 = sin(vWp.x * 0.23 - vWp.z * 0.19 + vWp.y * 0.09 - uBreeze * 1.7 + 1.3);
              float gust = 0.88 + 0.12 * g1 + 0.06 * g2;
              gl_FragColor.rgb *= gust;`); }; } });
      scene.fog.color.set(0x41504a); scene.fog.near = 26; scene.fog.far = 150;
    } catch (e) { console.error('[dream-news] hill', e); }
    const wash = new THREE.SpotLight(0xffa24a, 7, 160, 0.6, 0.7, 1.0);
    wash.position.copy(DN.position).add(new THREE.Vector3(0, 6, 0));
    { const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), DN.rotation.y); wash.target.position.copy(DN.position).addScaledVector(back, 60).add(new THREE.Vector3(0, 18, 0)); }
    scene.add(wash); scene.add(wash.target);
    const washCool = new THREE.SpotLight(0x5f84ff, 4, 180, 0.75, 0.9, 1.0);
    washCool.position.copy(wash.position).add(new THREE.Vector3(8, 4, 0)); washCool.target.position.copy(wash.target.position).add(new THREE.Vector3(14, 10, 0));
    scene.add(washCool); scene.add(washCool.target);
    // THE ANCHOR (2026-10-26): Ted on the articulated rig built in the Fukuyama session (src/js/ted-rig.js +
    // ted-poses.js) — seated, elbows on the desk, paws that move, in his suit. The rig's desk poses assume a desktop
    // at .70 with its near edge at z .18; it is scaled so that lands on this desk's top. Falls back to the villa's
    // four-legged coyote if the rig can't load.
    const loadJS = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    let rig = null;
    try { await loadJS('../src/js/ted-poses.js?v=1026'); await loadJS('../src/js/ted-rig.js?v=1026'); if (window.TedRig) rig = TedRig.build(); } catch (e) { console.error('[dream-news] ted rig', e); }
    const RIG_K = DESK_Y / 0.70;
    DN.traverse(o => o.layers.enable(1));   // 10-29: the desk on the pierce layer with Ted — he no longer pierces the table under the dim
    const tedHolder = new THREE.Group(); DN.add(tedHolder);
    let ted, U = {};
    if (rig) {
      rig.setSuit(EP.tedSuit !== false);
      tedHolder.scale.setScalar(RIG_K); tedHolder.position.set(0, 0, -DESK_D / 2 - 0.18 * RIG_K);
      tedHolder.add(rig.root); ted = tedHolder; rig.root.traverse(o => o.layers.enable(1));   // 10-29: on the pierce layer — bright under the dim window.__ted = { rig, holder: tedHolder, guest: () => tedGuest.slice(), dbg: () => ({ gaze: gazeNow.toArray(), tposeT: tedPoseT, want: tedWant, cur: cur && cur.id, curTed: cur && cur.ted, cam: camera.position.toArray(), stage: stage.position.toArray() }) };
      tedHolder.remove(rig.root); rig.snapPose('deskListen', { guest: [0, 1.0, 3] }); tedHolder.add(rig.root);   // posed at the origin: the rig's IK and look-at work in world space
    } else {
      ted = buildCoyote(); ted.scale.setScalar(1.3); ted.position.set(0, 0.0, -0.95); ted.rotation.order = 'YXZ'; ted.rotation.x = -0.1;
      U = ted.userData;
      (U.legs || []).forEach((l, i) => { const grp = l.group || l.hip; if (!grp) return; if (i >= 2) { grp.rotation.x = -1.25; } });
      DN.add(ted);
    }
    const jawRest = U.jaw ? U.jaw.position.y : null;
    let level = 0, look = 'camera';
    // THE ELEPHANT IN THE ROOM (the welcome beat): a beat with `elephant: { from: [x, z], to: [x, z] }` (desk-local
    // units, defaults: right to left across the back of the Plaza) walks it through the background over the beat.
    // Built in dream-elephant.js, loaded only when an episode asks for it.
    let elephant = null, elephantAt = null;   // elephantAt = { x, z, heading, idle?, wave? } for this frame, or null (hidden)
    if (beats.some(b => b.elephant)) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'dream-elephant.js?v=1'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }).catch(e => console.error('[dream-news] elephant', e));
      if (typeof buildElephant === 'function') { elephant = buildElephant(); elephant.scale.setScalar(1.0); elephant.visible = false; DN.add(elephant);
        elephant.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.map) { o.material = o.material.clone(); o.material.color.setScalar(0.5); o.material.emissiveIntensity = 0.1; } else if (o.isMesh && o.material && o.material.color && o.material.roughness > 0.9) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.55); o.material.emissiveIntensity = 0.1; } }); }   // 10-28: the show's lights bleach the hide white; take it down to grey
    }
    const _ev = new THREE.Vector3();
    function poseElephant(t) {
      if (!elephant) return;
      elephant.visible = !!elephantAt;
      if (!elephantAt) return;
      // its feet on the villa's own ground (the Plaza paving, or the slope behind it), read the way the desk's height was
      const w = DN.localToWorld(new THREE.Vector3(elephantAt.x, 0, elephantAt.z));
      const groundY = (typeof getTedHeight === 'function') ? getTedHeight(w.x, w.z) : DN.position.y;
      elephant.position.set(elephantAt.x, 0, elephantAt.z); elephant.rotation.y = elephantAt.heading;
      const U_ = elephant.userData, wv = elephantAt.wave || 0;
      if (elephantAt.idle || wv > 0) {
        U_.walk(t * 0.22, 0); U_.legs.forEach(l => { l.rotation.x = 0; });   // standing: the sway without the stride
      } else U_.walk(t, 0);                                 // walk() sets the group's y to its bob
      if (wv > 0) {
        // THE WAVE (10-28, Sailor: "have the elephant look over and wave its trunk and flap its ears, as Ted says hi"):
        // the head turns to the lens, the ears flap, the trunk lifts and swings — eased in and out over the window
        const k = Math.sin(Math.min(1, wv) * Math.PI); const ke = Math.min(1, k * 1.6);
        elephant.updateMatrixWorld(true); _ev.copy(camera.position); elephant.worldToLocal(_ev);
        const yaw = Math.atan2(_ev.x, _ev.z);
        U_.head.rotation.y += Math.max(-1.1, Math.min(1.1, yaw)) * ke; U_.head.rotation.x -= 0.18 * ke;
        U_.ears.forEach((e, i) => { e.rotation.z += (i ? -1 : 1) * Math.sin(t * 9 + i) * 0.5 * ke; });
        U_.trunk.forEach((seg, i) => { seg.rotation.x += (i === 0 ? -1.15 : -0.22) * ke; seg.rotation.z += Math.sin(t * 5.5 - i * 0.7) * 0.28 * ke; });
      }
      elephant.position.y += groundY - DN.position.y;      // …on top of the ground, in the desk's frame
    }
    // ── PASSERSBY (10-27, Sailor: "other animal avatars walk through the scene during the report… not in such a high
    //    density, whatever's not distracting in the background"): the villa's land residents, cloned (their originals keep
    //    their own lives), cross the back of the Plaza one at a time, on a fixed schedule from show time so a seek or a
    //    capture always shows the same walker. Lanes sit behind the desk, deeper than the map and the g4. Episode flag:
    //    `passersby: true` (or { period, dur }). Off during the cold open, on the elephant's beat, during every clip (full-frame, or on the g4) and on landings.
    const PB = { list: [], on: !!EP.passersby, period: (EP.passersby && EP.passersby.period) || 46, dur: (EP.passersby && EP.passersby.dur) || 24, path: (EP.passersby && EP.passersby.path) || [[12.5, -9], [-1.2, -16]] };
    if (PB.on) {
      const g_ = n => { try { return (new Function('return typeof ' + n + " !== 'undefined' ? " + n + ' : null'))(); } catch (e) { return null; } };
      ['y2kHusky', 'greyhoundHouston', 'foxHaley', 'catAdlib', 'stoatEmilia', 'raccoonBigColin', 'beaverAlrik', 'heronJulia',
       'catEdburg', 'pelicanAustin', 'diddyKong', 'albatrossLuke', 'sparrowDoctorColin', 'wizardAlrik',
       'troutFish', 'sealPup', 'otterPrincess', 'sharkPetra', 'dolphinKyle', 'seaTurtle'].forEach(name => {   // 10-29: the swimmers walk through too
        const src = g_(name); if (!src || !src.isObject3D) return;
        const stash = []; src.traverse(o => { stash.push([o, o.userData]); o.userData = {}; });   // clone() JSON-copies userData, and theirs holds Object3Ds
        let c; try { c = src.clone(true); } finally { stash.forEach(([o, u]) => { o.userData = u; }); }
        const pair = new Map(); const a = [], b = [];
        src.traverse(o => a.push(o)); c.traverse(o => b.push(o)); a.forEach((o, i) => pair.set(o, b[i]));
        const remap = v => v && v.isObject3D ? (pair.get(v) || null) : (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x && x.isObject3D ? (pair.get(x) || x) : x])) : v);
        const legs = Array.isArray(src.userData.legs) ? src.userData.legs.map(remap).map(l => l && (l.isObject3D ? l : (l.group || l.hip || l.upper || null))).filter(Boolean) : [];
        c.userData = { name, legs }; c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.visible = false;
        c.traverse(o => { o.visible = true; o.frustumCulled = false; }); c.visible = false;
        const box = new THREE.Box3().setFromObject(c); const h = box.max.y - box.min.y;
        if (h > 0 && (h < 0.5 || h > 3.2)) c.scale.multiplyScalar(Math.min(3.2, Math.max(0.5, h)) / h);   // keep them people-sized beside the elephant's 2.8
        DN.add(c); PB.list.push(c);
      });
      if (!PB.list.length) PB.on = false;
    }
    window.__PB = PB;   // debug handle (PB.force = [[i, x, z], …] pins walkers for a look)
    // the walkable surface: the villa's stone where there is stone (the Plaza deck), else the ground — the visitor's own rule
    const pbGround = w => (typeof getVisitorHeight === 'function') ? getVisitorHeight(w.x, w.z) : (typeof getTedHeight === 'function') ? getTedHeight(w.x, w.z) : DN.position.y;
    // THE INTRO CAST (10-29, Sailor: "let's see the ocean animals in the opening sequence"): during the fly-in the swimmers
    // stand in at the break and the river mouth, where the camera opens — clones, so the villa's own residents keep roaming
    const OCEAN = (typeof OCEAN_Y !== 'undefined') ? OCEAN_Y : -11.6;
    const INTRO_CAST = { troutFish: [2, OCEAN + 0.1, 100, 0.4], otterPrincess: [-1, OCEAN + 0.15, 93, 2.6], sharkPetra: [7, OCEAN - 0.1, 109, -1.2], dolphinKyle: [-4, OCEAN + 0.2, 113, 0.8], seaTurtle: [10, OCEAN + 0.05, 97, 1.9], sealPup: [12, -10.3, 80, 2.2] };
    const _cw = new THREE.Vector3();
    function posePassersby(t, b) {
      PB.list.forEach(c => { c.visible = false; });
      if (b && b.layout === 'fly') { PB.list.forEach(c => { const at = INTRO_CAST[c.userData.name]; if (!at) return;
        _cw.set(at[0], at[1] + Math.sin(t * 1.1 + at[0]) * 0.12, at[2]); DN.worldToLocal(_cw); c.position.copy(_cw); c.rotation.set(0, at[3] - DN.rotation.y, Math.sin(t * 0.9 + at[2]) * 0.05); c.visible = true; }); return; }
      if (PB.force) { PB.force.forEach(([i, x, z]) => { const c = PB.list[i]; if (!c) return; const w = DN.localToWorld(new THREE.Vector3(x, 0, z)); const gy = pbGround(w); c.position.set(x, gy - DN.position.y, z); c.visible = true; }); return; }   // debug: PB.force = [[i, x, z], …]
      if (!PB.on || !b || (b.block && b.block.id === 'coldopen') || b.elephant || b.type === 'clip' || b.type === 'land') return;
      const k = Math.floor(t / PB.period), u = (t - k * PB.period - 8) / PB.dur;
      if (u < 0 || u > 1) return;
      const c = PB.list[Math.floor(hash(k + 3) * PB.list.length) % PB.list.length];
      // the lane (10-27, read off the villa): the Plaza deck runs out behind the desk on camera-right, so they walk on the
      // stone between frame-right and Ted's back — in from the edge and away behind him, or out from behind him to the edge.
      // Frame-left is the map's side, and stays clear.
      const j = (hash(k + 41) - 0.5) * 1.5, P0 = [PB.path[0][0], PB.path[0][1] + j], P1 = [PB.path[1][0], PB.path[1][1] + j * 0.5];
      const inward = hash(k + 29) > 0.5, from = inward ? P0 : P1, to = inward ? P1 : P0;
      const x = from[0] + (to[0] - from[0]) * u, z = from[1] + (to[1] - from[1]) * u;
      const w = DN.localToWorld(new THREE.Vector3(x, 0, z));
      const gy = pbGround(w);
      const step = t * 7.5, bob = Math.abs(Math.sin(step)) * 0.06;
      c.position.set(x, gy - DN.position.y + bob, z); c.rotation.set(0, Math.atan2(to[0] - from[0], to[1] - from[1]), 0);
      if (c.userData.legs.length) c.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(step + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.5; });
      else c.rotation.z = Math.sin(step) * 0.07;   // no legs to swing: a waddle
      c.visible = true;
    }
    const tedGuest = [0, 1.0, 3];   // where he looks, in the rig's own frame (the holder's local space)
    const _gv = new THREE.Vector3(), gazeNow = new THREE.Vector3(); let gazeInit = false;
    let tedPoseT = null, tedWant = '', tPose = 0, gestE = 0;
    const hash = n => { const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
    // GAZE (2026-10-26, Sailor: "primarily looking at the camera … his gaze to go to the graphmap when things land"):
    // the lens by default; the map for a couple of seconds after a line lands in a reading, at the top of a beat that
    // points at the map, and now and then while he talks about it
    const _eg = new THREE.Vector3();
    function gazeTarget(t) {
      { const W = walkState(showT);
        if (W.mode === 'walk' && walkPath) { walkPoint(W.d + (W.toPed ? 2.0 : -2.0), _eg); _eg.y = pbGround(_eg) + 1.4; return _eg; }
        if (W.mode === 'there' && cur && cur.type === 'text' && cur.ted === 'map' && typeof trackerGlobe !== 'undefined') { const into = showT - cur.start; if (into < 2.4 || (into % 9) > 7.0) { trackerGlobe.getWorldPosition(_eg); return _eg; } } }
      if (elephantAt && elephantAt.wave > 0 && elephantAt.wave < 0.92 && elephant) { elephant.getWorldPosition(_eg); _eg.y += 2.4; return _eg; }   // 10-29: he looks over at the elephant for the wave ("Hey there, buddy")
      if (READ.on && READ.focus >= 0 && READ.landAge < 2.2) return stage.position;
      if (cur && cur.type === 'text' && cur.ted === 'map') { const into = t - cur.start; if (into < 2.4 || (into % 9) > 7.0) return stage.position; }
      return camera.position;
    }
    // ── THE WALK TO THE GLOBE (ex01, 2026-11-06, Sailor: "I want the explainer to be of Ted walking away from his desk, to
    //    the SST as it sits on the pedestal"). `tedWalk: 'pedestal'` on a beat: from the top of that beat Ted stands (0.7 s),
    //    walks out round his right-hand end of the desk and across to a mark beside the pedestal, and turns to the lens. He
    //    stays there for every later beat until one says `tedWalk: 'desk'` (the same path, back, and he sits). The camera
    //    travels with him into a two-shot — Ted and the globe — and when he arrives the picture resolves (trackerResolveShow
    //    in index.html). All of it a pure function of show time. Rig path only (the four-legged fallback stays at the desk).
    const WALK = { speed: 1.35, standUp: 0.7, turn: 0.7 };
    const TED_DESK_LOCAL = rig ? tedHolder.position.clone() : null;
    const walkBeats = beats.filter(b => b.tedWalk === 'pedestal' || b.tedWalk === 'desk');
    const walkPath = (() => {
      if (!rig) return null;
      DN.updateMatrixWorld(true);
      const p0 = DN.localToWorld(TED_DESK_LOCAL.clone());
      const p1 = DN.localToWorld(new THREE.Vector3(-(DESK_W / 2 + 0.75), 0, -DESK_D / 2 - 0.55));   // his right is −x local
      const out = new THREE.Vector3(DN.position.x, 0, DN.position.z).normalize();                     // from the pedestal toward the desk
      // the mark: out from the pedestal toward the desk a little, and off to the side that reads as frame right from the
      // two-shot camera (which sits out along the same line), so Ted stands BESIDE the globe, not under it
      const sideR = new THREE.Vector3().crossVectors(out, new THREE.Vector3(0, 1, 0)).normalize().negate();
      const mark = out.clone().multiplyScalar(EP.walkMarkOut != null ? EP.walkMarkOut : (WIDE ? 1.4 : 2.6)).addScaledVector(sideR, EP.walkMarkSide != null ? EP.walkMarkSide : (WIDE ? 2.3 : 0.75));   // 9:16: stacked — the globe above, Ted under it, a little right
      const pts = [p0, p1, mark].map(p => new THREE.Vector3(p.x, 0, p.z));
      const seg = [0]; for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + pts[i].distanceTo(pts[i - 1]));
      return { pts, seg, len: seg[seg.length - 1], out };
    })();
    function walkPoint(d, out) {
      const P = walkPath; d = Math.max(0, Math.min(P.len, d));
      let i = 1; while (i < P.seg.length - 1 && d > P.seg[i]) i++;
      const k = (d - P.seg[i - 1]) / Math.max(1e-6, P.seg[i] - P.seg[i - 1]);
      return out.lerpVectors(P.pts[i - 1], P.pts[i], k);
    }
    function walkState(t) {
      if (!walkPath || !walkBeats.length) return { mode: 'desk' };
      let wb = null; for (const b of walkBeats) if (b.start != null && t >= b.start) wb = b;
      if (!wb) return { mode: 'desk' };
      const toPed = wb.tedWalk === 'pedestal', dur = walkPath.len / WALK.speed, u0 = t - wb.start;
      const arriveT = wb.start + WALK.standUp + dur;
      if (u0 < WALK.standUp) return { mode: toPed ? 'rise' : 'stand', d: toPed ? 0 : walkPath.len, toPed, arriveT, k: u0 / WALK.standUp };
      const u = (u0 - WALK.standUp) / dur;
      if (u < 1) return { mode: 'walk', d: (toPed ? u : 1 - u) * walkPath.len, u, toPed, arriveT };
      return toPed ? { mode: 'there', d: walkPath.len, since: t - arriveT, toPed, arriveT } : { mode: 'desk' };
    }
    const _wp = new THREE.Vector3(), _wq = new THREE.Vector3(), _wl = new THREE.Vector3(), _wc = new THREE.Vector3();
    let walkYaw = 0;
    window.__walk = { state: t => walkState(t), path: walkPath };   // debug handle
    // ── TED'S FRAMINGS once he's by the globe (ex01, 11-06, Sailor: "maybe Ted is reduced in screen space at points… an
    //    Alice in Wonderland Cheshire Cat floating head motif… Ted in the far background behind the SST globe and pierce
    //    through, so we can see his whole body, but he's way off in the distance and we can focus in on whatever aspect of
    //    the globe we are talking about"). Beat fields, carried forward:
    //      globeFocus: [lat, lon, dist?] — the camera goes in on that place on the globe (null = back to the two-shot)
    //      tedFrame: 'two' (beside the globe) | 'far' (way off behind it, whole body, drawn through it) | 'head' (the floating head)
    //    Default: 'far' while the camera is on the globe, 'two' otherwise.
    const tedFrameOf = b => { const f = carry('tedFrame', b, null); return f || (carry('globeFocus', b, null) ? 'far' : 'two'); };
    const _fb = { f: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() };
    function camBasis() { camera.getWorldDirection(_fb.f); _fb.r.crossVectors(_fb.f, UP).normalize(); _fb.u.crossVectors(_fb.r, _fb.f).normalize(); return _fb; }
    const headMeshes = [];
    if (rig) { const H = rig.joints.head; rig.root.traverse(o => { if (!o.isMesh) return; let p = o, under = false; while (p) { if (p === H) { under = true; break; } p = p.parent; } headMeshes.push([o, under, o.visible]); }); }
    let headOnly = false;
    function setHeadOnly(on) { if (on === headOnly) return; headOnly = on; headMeshes.forEach(([o, under, vis]) => { o.visible = on ? (under && vis) : vis; }); }
    const _hp = new THREE.Vector3(), _hw = new THREE.Vector3();
    function placeWalkingTed(W) {
      if (W.mode === 'desk') { tedHolder.position.copy(TED_DESK_LOCAL); tedHolder.rotation.y = 0; walkYaw = 0; return; }
      walkPoint(W.d, _wp);
      const gyW = pbGround(_wp);
      _wl.set(_wp.x, gyW, _wp.z); DN.worldToLocal(_wl);
      if (W.mode === 'rise') _wl.copy(TED_DESK_LOCAL);
      tedHolder.position.copy(_wl);
      const frame = W.mode === 'there' ? tedFrameOf(cur) : 'two';
      setHeadOnly(frame === 'head');
      if (frame === 'far' || frame === 'head') {
        const B = camBasis(), vh = Math.tan((camera.fov || 36) / 2 * Math.PI / 180), asp = window.innerWidth / Math.max(1, window.innerHeight);
        if (frame === 'far') {   // way off behind the globe, on his own feet: where a line through a spot in the upper frame meets the ground
          const sx = WIDE ? 0.3 : 0.28, sy = WIDE ? -0.05 : 0.18;   // the spot, in half-frame units (x right, y up) — his feet
          _hp.copy(B.f).addScaledVector(B.r, sx * vh * asp).addScaledVector(B.u, sy * vh).normalize();
                    const d = EP.farDist || 28;                                             // far off: about a tenth of the frame tall
          _hw.copy(camera.position).addScaledVector(_hp, d); const gyF = pbGround(_hw);
          _hw.y = Math.max(gyF, _hw.y);                                           // on the ground if the spot is below it; else he stands in the air (it's a dream)
          _wl.copy(_hw); DN.worldToLocal(_wl); tedHolder.position.copy(_wl);
        } else {                  // the floating head, upper left, close
          const d = WIDE ? 4.2 : 5.6; _hp.copy(camera.position).addScaledVector(B.f, d).addScaledVector(B.r, -d * vh * asp * 0.45).addScaledVector(B.u, d * vh * (WIDE ? 0.4 : 0.5));
          _wc.copy(camera.position); DN.worldToLocal(_wc); tedHolder.rotation.y = Math.atan2(_wc.x - tedHolder.position.x, _wc.z - tedHolder.position.z);
          tedHolder.updateMatrixWorld(true); rig.joints.head.getWorldPosition(_hw);
          _hw.sub(_hp); const lp = tedHolder.position.clone(); DN.localToWorld(lp); lp.sub(_hw); DN.worldToLocal(lp); tedHolder.position.copy(lp);
        }
        if (frame === 'far') { _wc.copy(camera.position); DN.worldToLocal(_wc); tedHolder.rotation.y = Math.atan2(_wc.x - tedHolder.position.x, _wc.z - tedHolder.position.z); }
        walkYaw = tedHolder.rotation.y;
        return;
      }
      // heading, in the desk's frame (the rig faces +z): along the path while walking, to the lens once there
      let yaw;
      if (W.mode === 'walk') {
        walkPoint(W.d + (W.toPed ? 0.25 : -0.25), _wq); _wq.y = gyW; DN.worldToLocal(_wq); yaw = Math.atan2(_wq.x - _wl.x, _wq.z - _wl.z);
      } else if (W.mode === 'rise') yaw = 0;
      else { _wc.copy(camera.position); DN.worldToLocal(_wc); const toCam = Math.atan2(_wc.x - _wl.x, _wc.z - _wl.z);
        walkPoint(walkPath.len - 0.25, _wq); _wq.y = gyW; DN.worldToLocal(_wq); const along = Math.atan2(_wl.x - _wq.x, _wl.z - _wq.z);
        const k = W.mode === 'there' ? Math.min(1, (W.since || 0) / WALK.turn) : 1; let dy = toCam - along; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        yaw = along + dy * (k * k * (3 - 2 * k)); }
      tedHolder.rotation.y = yaw; walkYaw = yaw;
    }
    function poseTed(t) {
      if (rig) {
        const dt = tedPoseT == null ? 0 : Math.max(0, Math.min(0.1, t - tedPoseT)); tedPoseT = t;
        // HANDS (Sailor: "the looped sequence is too tight"): the gesture loop runs on its own slower clock whose speed
        // wanders, and while he talks the gestures come in phrases — a few seconds of making a point, then the paws rest —
        // chosen per 4-second window so no two stretches repeat the same way
        tPose += dt * (0.42 + 0.16 * Math.sin(t * 0.31) + 0.1 * Math.sin(t * 0.83 + 1.7));
        const talking = level > 0.08;
        const W = walkState(showT); placeWalkingTed(W);
        const want = W.mode === 'desk' ? 'deskListen' : W.mode === 'walk' ? 'walkStraight' : 'stand';   // ex01: up from the desk, walking, standing by the globe
        // the gaze eases toward its target (no snapping), in the rig's own frame
        const tgt = gazeTarget(t); if (!gazeInit) { gazeNow.copy(tgt); gazeInit = true; }
        gazeNow.lerp(tgt, 1 - Math.pow(0.04, dt));
        _gv.copy(gazeNow); tedHolder.updateMatrixWorld(true); tedHolder.worldToLocal(_gv); tedGuest[0] = _gv.x; tedGuest[1] = _gv.y; tedGuest[2] = _gv.z;
        tedHolder.remove(rig.root);   // pose him at the origin (the rig's IK and look-at are in world space), then put him back
        rig.root.updateMatrixWorld(true);
        if (want !== tedWant) { tedWant = want; rig.setPose(want, { guest: tedGuest, cam: tedGuest }); }
        rig.setTalk(false); rig.update(dt, W.mode === 'walk' ? showT : tPose);
        // GESTURES (Sailor, 10-26: "his hand still does a funny hover"): while he talks, now and then the right paw lifts off
        // the desk in a soft arc and settles again — one lift per phrase window, some windows still, no loop to read
        if ((talking || gestE > 0.01) && W.mode === 'desk') {
          const W = 3.8, w = Math.floor(t / W), u = (t % W) / W, on = talking && hash(w) < 0.5;
          const target = on ? Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 2) : 0;
          gestE += (target - gestE) * Math.min(1, dt * 4);
          const side = hash(w + 0.5) < 0.7 ? 'R' : 'L', sd = side === 'R' ? 1 : -1;
          rig.tools.addRot('shoulder' + side, -10 * gestE, 0, sd * -4 * gestE);
          rig.tools.addRot('elbow' + side, -18 * gestE, 0, 0);
          rig.tools.addRot('wrist' + side, 8 * gestE * Math.sin(t * 1.3), 0, 0);
        }
        // THE WAVE BACK (10-28): while the elephant waves, Ted lifts his right paw and waves it
        const wv = elephantAt && elephantAt.wave ? Math.min(1, Math.sin(Math.min(1, elephantAt.wave) * Math.PI) * 1.5) : 0;
        if (wv > 0) {
          rig.tools.addRot('chest', 0, 30 * wv, 0);   // 10-29: he turns to face the elephant (frame right)
          const W = window.__WAVE || { sx: -20, sy: 0, sz: -120, ex: -70, ey: 0, ez: 0, wx: 0, wz: 30 };
          rig.tools.addRot('shoulderR', W.sx * wv, W.sy * wv, W.sz * wv);
          rig.tools.addRot('elbowR', W.ex * wv, W.ey * wv, W.ez * wv);
          rig.tools.addRot('wristR', W.wx * wv * Math.sin(t * 8.5), 0, W.wz * wv * Math.sin(t * 8.5));
        }
        rig.root.updateMatrixWorld(true);                       // detached: refresh the chain at the origin before the look-at reads it
        rig.tools.look(tedGuest, 1, 0, 0.35);                  // after the pose: the eyes go where the gaze is, every frame
        tedHolder.add(rig.root);
        rig.joints.jaw.rotateX(level * 0.42);                   // the mouth follows the voice itself (the timeline's envelope)
        rig.joints.head.rotateX(-level * 0.05 * Math.sin(t * 3.1));
        return;
      }
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
    // ── THE FLY-IN (10-28, Sailor: "fly through the gallery, the graphmap with the supply shock tracker up, and the Venus",
    //    to the Eyewitness theme): a clip beat with `layout: 'fly'` carries only sound; the camera rides one smooth curve
    //    through the villa in world units and lands exactly on the desk shot the show opens from. Keys: [t 0..1, from, at].
    // keys: [t 0..1, from, at]; a key may be in desk-local units with 'd' first ('d', x, y, z) — the elephant's hill, the desk
    const ELEPHANT_HILL = [-12, 0, -34];   // where the elephant stands during the fly-in, desk-local (on the slope behind the desk)
    // ep 1.1 (11-02): an episode can bring its own flight — `EP.flyKeys` (same [t, from, at] form) — so ep01's stays as it was
    const FLY_KEYS = Array.isArray(EP.flyKeys) ? EP.flyKeys.map(k => k.slice()) : [
      [0.00, [14, -3, 124], [4, -12, 104]],             // out over the water: the break and the kelp bed, the swimmers
      [0.06, [20, -6.5, 90], [8, -10.5, 78]],           // down on the beach: the animals at the river mouth
      [0.12, [4, -5, 86], [0, -9, 66]],                 // up the river
      [0.17, [1, 2.5, 54], [0, 0.5, 34]],               // the valley rising to the villa
      [0.22, [6, 5.5, 31], [0, 2.2, 20]],               // low over the reflection pool
      [0.28, [1, 4.8, 16], [-2, 3.5, 2]],               // up the steps toward the galleria
      [0.33, ['d', 5, 2.6, -21], ['d', -12, 2.0, -34]], // the elephant on the hill, passing by
      [0.40, [-2, 6.5, 19], [-14, 3.2, 3]],             // a fast pan across the outside of the west wing
      [0.46, [-17, 5.2, 12], [-15, 3.0, 1]],
      [0.52, [-5.2, 3.5, 2.2], [-6, 3.3, -3]],          // the Venus: round her front — she faces the desk, so from her east side
      [0.60, [-2.0, 3.5, -2.2], [-6, 3.3, -3]],         // her face
      [0.68, [-3.8, 3.0, -5.8], [-6, 3.1, -3]],         // the last look, over her shoulder
      [0.76, [1.6, 4.7, -3.4], [0, 4.3, 0]],            // the supply shock tracker, round the back of the globe
      [0.84, [3.2, 4.6, 1.4], [0, 4.2, 0]],
      [0.91, ['d', 6, 3.4, 12], ['d', 0, 1.8, 0]],      // out to the Plaza, the desk ahead
      [1.00, null, null],                                // the desk shot
    ];
    const flyV = a => a[0] === 'd' ? DN.localToWorld(new THREE.Vector3(a[1], a[2], a[3])) : new THREE.Vector3(...a);
    function deskShot(out1, out2) { out1.set(0.12, 1.38, WIDE ? 5.0 : 5.8); out2.set(0, WIDE ? 1.7 : 1.95, -0.9); DN.localToWorld(out1); DN.localToWorld(out2); }
    let flyCurveFrom = null, flyCurveAt = null;
    function flyCamera(t) {
      if (!flyCurveFrom) {
        const end1 = new THREE.Vector3(), end2 = new THREE.Vector3(); deskShot(end1, end2);
        const pre = end1.clone().add(end1.clone().sub(end2).setY(0).normalize().multiplyScalar(5)).add(new THREE.Vector3(0, 1.6, 0));   // the last approach: straight in over the desk's front
        FLY_KEYS[FLY_KEYS.length - 1][1] = end1.toArray(); FLY_KEYS[FLY_KEYS.length - 1][2] = end2.toArray();
        FLY_KEYS.splice(FLY_KEYS.length - 1, 0, [0.955, pre.toArray(), end2.toArray()]);
        flyCurveFrom = new THREE.CatmullRomCurve3(FLY_KEYS.map(k => flyV(k[1])), false, 'centripetal');
        flyCurveAt = new THREE.CatmullRomCurve3(FLY_KEYS.map(k => flyV(k[2])), false, 'centripetal');
      }
      const span = Math.max(0.1, (epv(cur, 'flyEnd') != null ? epv(cur, 'flyEnd') : (cur.end - cur.start)));
      let u = Math.max(0, Math.min(1, (t - cur.start) / span));
      // the keys' own times → the curve's even parameter (piecewise linear), eased at both ends
      const e = u < 0.06 ? u * u / 0.06 : u > 0.9 ? 1 - Math.pow(1 - u, 2) / 0.1 : u, n = FLY_KEYS.length - 1; let v = 1;   // the keys set the pace; eased only at the ends
      for (let i = 0; i < n; i++) { const a = FLY_KEYS[i][0], c = FLY_KEYS[i + 1][0]; if (e <= c) { v = (i + (e - a) / Math.max(1e-6, c - a)) / n; break; } }
      flyCurveFrom.getPoint(v, camFrom); flyCurveAt.getPoint(v, camAt);
    }
    // during the fly-in the pedestal shows the villa's own supply shock tracker (its globe), the show's map stepped aside;
    // at the end the show's name comes up over the desk, where the theme lands
    let flyGlobe = false;
    const introTitle = document.createElement('div'); introTitle.id = 'dn-introtitle';
    introTitle.innerHTML = '<div class="t">THE PARALLELOGRAM REPORT</div><div class="s">live from the Plaza · the Getty Villa</div>';
    introTitle.style.cssText = 'position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:40;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.85);opacity:0';
    introTitle.querySelector('.t').style.cssText = 'font-weight:800;letter-spacing:.12em;font-size:clamp(28px,5.2vw,96px)';
    introTitle.querySelector('.s').style.cssText = 'font-weight:300;letter-spacing:.32em;font-size:clamp(11px,1.2vw,22px);margin-top:1.4vh;opacity:.85;text-transform:uppercase';
    (document.getElementById('dn') || document.body).appendChild(introTitle);   // inside #dn: the show hides every other child of body
    const EPB = {}; (EP.blocks || []).forEach(bl => (bl.beats || []).forEach(x => { EPB[x.id] = x; }));
    const epv = (b, k) => (b && b[k] != null) ? b[k] : (b && EPB[b.id] ? EPB[b.id][k] : undefined);
    function flyFrame(t, b) {
      const fly = !!(b && b.layout === 'fly');
      // ep 1.1 (11-01, Sailor: "the supply shock tracker globe spins like a wheel"): `globe: true` on a beat puts the
      // tracker's globe on the pedestal in place of the map and spins it, fast at first, settling over the beat
      const spin = !!epv(b, 'globe'); const on = fly || spin;
      stage.visible = !on;
      if (on && !flyGlobe) { flyGlobe = true; try { pedestalShow('tracker'); } catch (e) {} }
      try { if (typeof trackerGlobe !== 'undefined') { trackerGlobe.visible = on; if (on) trackerGlobe.traverse(o => o.layers.enable(0));
        const gb = trackerGlobe.children.find(c => c.isGroup && c.name !== 'trackerCard') || trackerGlobe;   // the earth and its flows only — not the card
        if (spin) { const u = Math.max(0, t - b.start); gb.rotation.z = (b.globeFrom || 0) - (b.globeTurn != null ? b.globeTurn : 9.0) * (1 - Math.exp(-u / 1.4)); } else if (on) gb.rotation.z = 0; } } catch (e) {}   // 11-02: turns like a clock face (Sailor) — round the axis that points at the camera, clockwise
      // ex01 (11-05, the tracker explainer): `globeMonth: 'YYYY-MM'` holds the globe's routes on the month Ted is reading
      // (the villa's own month clock stops); a globe beat without it lets the clock run again, as in ep 1.1
      try { if (on && typeof trackerData !== 'undefined' && trackerData && trackerRig.built) { const gm = epv(b, 'globeMonth');
        if (gm) { const i = trackerData.months.findIndex(m => m.period === gm); trackerRig.playing = false; if (i >= 0 && trackerRig.month !== i) trackerSetMonth(i); }
        else trackerRig.playing = true; } } catch (e) {}
      const at = on ? (epv(b, 'titleAt') != null ? epv(b, 'titleAt') : 28.5) : 0, k = on ? Math.max(0, Math.min(1, (t - b.start - at) / 0.8)) * Math.max(0, Math.min(1, (b.end - t) / 0.5)) : 0;
      introTitle.style.display = k > 0 ? 'flex' : 'none'; introTitle.style.opacity = k.toFixed(3);
    }
    // ── THE CREDITS (ep 1.1, 11-03, Sailor: "end the episode with credits that should include the avatars and Prism"):
    //    a clip beat with `layout: 'credits'` carries only its sound (the theme again); the camera eases back and up off
    //    the desk over the Plaza toward the villa, and `credits: [[role, names], …]` roll up the screen over it
    const credEl = document.createElement('div'); credEl.id = 'dn-credits';
    credEl.style.cssText = 'position:fixed;inset:0;display:none;pointer-events:none;z-index:41;overflow:hidden;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.9);background:linear-gradient(90deg,rgba(0,0,0,.0) 20%,rgba(0,0,0,.45) 50%,rgba(0,0,0,.0) 80%)';
    const credRoll = document.createElement('div'); credRoll.style.cssText = 'position:absolute;left:0;right:0;top:0;text-align:center;will-change:transform';
    credEl.appendChild(credRoll); (document.getElementById('dn') || document.body).appendChild(credEl);
    let credFor = null;
    function creditsFrame(t, b) {
      const on = !!(b && b.layout === 'credits'); credEl.style.display = on ? 'block' : 'none'; document.body.classList.toggle('credits', on); if (!on) return;
      const C = epv(b, 'credits') || [];
      if (credFor !== b.id) { credFor = b.id;
        credRoll.innerHTML = C.map(([role, names], i) => i === 0
          ? `<div style="font-weight:800;letter-spacing:.12em;font-size:clamp(22px,3.4vw,62px);margin-bottom:.25em">${role}</div><div style="font-weight:300;letter-spacing:.26em;text-transform:uppercase;font-size:clamp(10px,1.05vw,19px);opacity:.85;margin-bottom:9vh">${names}</div>`
          : `<div style="font-weight:600;letter-spacing:.28em;text-transform:uppercase;font-size:clamp(9px,.95vw,17px);color:#d9ccff;margin-bottom:.7em">${role}</div><div style="font-weight:400;font-size:clamp(13px,1.45vw,27px);line-height:1.5;max-width:46vw;margin:0 auto 6.5vh">${names}</div>`).join(''); }
      const H = window.innerHeight, h = credRoll.scrollHeight || H * 3, span = Math.max(1, b.end - b.start - 1.2);
      const u = Math.max(0, Math.min(1, (t - b.start - 0.6) / span));
      credRoll.style.transform = `translateY(${(H * 1.02 - u * (h + H * 0.35)).toFixed(1)}px)`;
      credEl.style.opacity = Math.min(1, (t - b.start) / 0.8, Math.max(0, (b.end - t) / 0.6)).toFixed(3);
    }
    const _cf0 = new THREE.Vector3(), _ca0 = new THREE.Vector3(), _cf1 = new THREE.Vector3(), _ca1 = new THREE.Vector3();
    function creditsCamera(t) {
      const u = ease3(Math.max(0, Math.min(1, (t - cur.start) / Math.max(1, cur.end - cur.start))));
      _cf0.set(0.12, 1.38, WIDE ? 5.0 : 5.8); _ca0.set(0, WIDE ? 1.7 : 1.95, -0.9);
      _cf1.set(3.5, 9.5, 24); _ca1.set(-4, 2.5, -16);
      DN.localToWorld(_cf0); DN.localToWorld(_ca0); DN.localToWorld(_cf1); DN.localToWorld(_ca1);
      camFrom.lerpVectors(_cf0, _cf1, u); camAt.lerpVectors(_ca0, _ca1, u);
    }
    // the walk's camera (ex01): the desk shot → travelling with Ted → a two-shot of Ted and the globe, from out past his mark
    const _df = new THREE.Vector3(), _da = new THREE.Vector3(), _tf = new THREE.Vector3(), _ta = new THREE.Vector3(), _th = new THREE.Vector3();
    function twoShot(outF, outA, drift) {
      const mark = walkPath.pts[walkPath.pts.length - 1], out = walkPath.out, g0 = pbGround(mark);
      if (WIDE) {
        outA.set(mark.x * 0.5, (g0 + 1.3) * 0.5 + PED_Y * 0.5, mark.z * 0.5);              // between Ted's head and the globe
        outF.copy(outA).addScaledVector(out, 7.4 - drift * 0.8);
        outF.y = Math.max(g0 + 1.6, outA.y - 0.1);
      } else {
        // 9:16 (Twitter): Ted's feet to the top of the globe fill the frame above the glass when it's docked, the whole
        // frame when it isn't — the aim drops so the stack sits in the upper part
        const docked = carry('m3p', cur, 'off') === 'dock', d = 11.5 - drift * 0.8, H = 2 * d * Math.tan((camera.fov || 36) / 2 * Math.PI / 180);
        const top = PED_Y + 1.3, mid = (g0 + top) / 2;
        outA.set(mark.x * 0.45, docked ? mid - 0.2 * H : mid, mark.z * 0.45);
        outF.copy(outA).addScaledVector(out, d); outF.y += 0.6;
      }
    }
    const _fP = new THREE.Vector3(), _fC = new THREE.Vector3(), _fN = new THREE.Vector3();
    function focusShot(outF, outA, f) {
      const R = (typeof TRACKER_R !== 'undefined') ? TRACKER_R : 1.15, d = (f[2] || 2.0) * (WIDE ? 1.15 : 1.9);
      trackerGlobe.updateMatrixWorld(true);
      _fP.copy(trackerLatLon(f[0], f[1], R)); trackerSpin.localToWorld(_fP); trackerGlobe.getWorldPosition(_fC);
      _fN.copy(_fP).sub(_fC).normalize();
      outF.copy(_fP).addScaledVector(_fN, d); outF.y += 0.18 * d; outA.copy(_fP);
      if (!WIDE && carry('m3p', cur, 'off') === 'dock') outA.y -= d * 0.3;   // the glass covers the lower 40%: the place sits in the upper frame
    }
    function shotFor(b, t, W, outF, outA) {
      const f = carry('globeFocus', b, null);
      if (f && typeof trackerLatLon === 'function') focusShot(outF, outA, f);
      else twoShot(outF, outA, Math.min(1, (W.since || 0) / 30));
    }
    let globePierceOff = false;
    function tedFrameLayers(t, b) {
      if (typeof trackerGlobe === 'undefined') return;
      const W = walkState(t), off = W.mode === 'there' && tedFrameOf(b) === 'far';
      if (off) trackerGlobe.traverse(o => o.layers.disable(1));
      else if (globePierceOff) trackerGlobe.traverse(o => o.layers.enable(1));
      globePierceOff = off;
    }
    function walkCamera(t, W) {
      deskShot(_df, _da);
      if (W.mode === 'rise') { camFrom.copy(_df); camAt.copy(_da); camAt.y += 0.25 * Math.min(1, W.k || 0); return; }
      if (W.mode === 'there') {
        shotFor(cur, t, W, camFrom, camAt);
        const p = prevBeat(cur), fk = b => JSON.stringify(carry('globeFocus', b, null));
        if (p && fk(p) !== fk(cur)) { const u = Math.max(0, Math.min(1, (t - cur.start) / 1.8)); if (u < 1) { shotFor(p, t, W, _tf, _ta); const e = ease3(u); camFrom.lerpVectors(_tf, camFrom, e); camAt.lerpVectors(_ta, camAt, e); } }
        return;
      }
      if (W.mode === 'stand') { twoShot(camFrom, camAt, 1); return; }
      twoShot(_tf, _ta, 0);
      const u = W.toPed ? W.u : 1 - W.u, e = ease3(Math.max(0, Math.min(1, u)));
      tedHolder.getWorldPosition(_th); _th.y += 1.45;
      camFrom.lerpVectors(_df, _tf, e);
      camAt.lerpVectors(_da, _th, Math.min(1, u * 2.5)).lerp(_ta, e * e);
    }
    function placeCamera(t) {
      if (ART.on) { camera.layers.set(0); articleCamera(t); camera.position.copy(camFrom); camera.lookAt(camAt); if (typeof camTarget !== 'undefined' && camTarget.copy) camTarget.copy(camAt); return; }
      if (cur && cur.layout === 'fly') { camera.layers.set(0); flyCamera(t); }
      else if (cur && cur.layout === 'credits') { camera.layers.set(0); creditsCamera(t); }
      else if (cur && cur.type === 'land' && LAND_PED) {
        // THE LANDING ON THE PEDESTAL (2026-10-26, Sailor: "the graphmap that we see, be the actual one on the pedestal,
        // not just in a void"): the map stays home over its pedestal in the villa, and the camera goes to it — from the
        // desk's side, a little above, wide enough that the pedestal stands under the plane
        camera.layers.set(0);
        const s = stageIn.scale.x, half = 1.4 * 1.12 * s;
        const dist = half / Math.tan((camera.fov || 60) / 2 * Math.PI / 180) * (WIDE ? 1.75 : 2.5);
        landDir.copy(toDesk).applyAxisAngle(UP, LAND_YAW);
        camRight.crossVectors(landDir, UP).normalize();
        camAt.copy(stage.position); camAt.y -= 0.85 * s; camAt.addScaledVector(camRight, WIDE ? 0.55 * s : 0);
        camFrom.copy(camAt).addScaledVector(landDir, dist); camFrom.y += dist * 0.12;
        // THE PAN (10-28, Sailor: "start in on the pin as it appears, then pan to the side of the graphmap as the pin sinks
        // or floats; if it sinks, pan through the graphmap so we see the pin in negative z"): close on the pin for a
        // second, then round to the plane's edge — above it for a float, below it (looking up through the plane) for a sink
        const li = landIdx(cur), m = li >= 0 ? dotMesh[li] : null;
        if (m) {
          m.getWorldPosition(dotW);
          const u = ease3(Math.max(0, Math.min(1, (t - cur.start - 1.0) / 2.2)));
          closeFrom.copy(dotW).addScaledVector(landDir, 2.3 * s); closeFrom.y += 0.4 * s; closeAt.copy(dotW);
          const zh = dotHome[li] ? dotHome[li].z : 0, sink = zh < -0.02;
          _sd.copy(dotW).sub(stage.position); const sideSign = _sd.dot(camRight) >= 0 ? -1 : 1;   // round toward the pin's own side
          sideDir.copy(landDir).applyAxisAngle(UP, sideSign * 1.3);
          sideFrom.copy(dotW).lerp(stage.position, 0.5).addScaledVector(sideDir, dist * 0.4); sideFrom.y += (sink ? -1.1 : 0.5) * s;
          sideAt.copy(dotW).lerp(stage.position, 0.15);
          camFrom.lerpVectors(closeFrom, sideFrom, u); camAt.lerpVectors(closeAt, sideAt, u);
        }
      } else if (cur && cur.type === 'land') {
        const s = stageIn.scale.x, half = 1.4 * 1.12 * s;                        // the plane's half-height plus its labels, in world units
        const dist = half / Math.tan((camera.fov || 60) / 2 * Math.PI / 180) * (WIDE ? 1.26 : 1.9);
        // the target sits a little below and left of the map, so the map reads up and to the right of the Dia card
        camRight.crossVectors(toDesk, UP).normalize();
        camAt.copy(stage.position); camAt.y -= 0.34 * s; camAt.addScaledVector(camRight, WIDE ? 0.62 * s : 0);
        camFrom.copy(camAt).addScaledVector(toDesk, dist); camFrom.y += dist * 0.2;   // from the desk's side, a little above
        camera.layers.set(STAGE_LAYER);
      } else if (READ.on) { camera.layers.set(0); readingCamera(t);
      } else {
        camera.layers.set(0);
        const k = Math.min(1, t / Math.max(1, DURATION));
        const dist = (WIDE ? 5.0 : 5.8) - k * 0.5;
        camFrom.set(0.12, 1.38, dist); camAt.set(0, WIDE ? 1.7 : 1.95, -0.9);
        DN.localToWorld(camFrom); DN.localToWorld(camAt);
      }
      { const W = walkState(t);
        if (W.mode !== 'desk' && !(cur && (cur.type === 'land' || cur.layout === 'fly' || cur.layout === 'credits')) && !READ.on) walkCamera(t, W); }
      if (!CAPTURE) userCamera();
      // ep 1.1: `quake: true` — the desk shakes, hard for the first second and dying out over two (deterministic in t)
      if (cur && epv(cur, 'quake')) { const u = Math.max(0, t - cur.start), a = 0.05 * Math.exp(-u / 0.9) * (u < 2.6 ? 1 : 0);
        camFrom.x += a * Math.sin(u * 47.0) + a * 0.6 * Math.sin(u * 83.0); camFrom.y += a * 0.8 * Math.sin(u * 61.0 + 1.3); camAt.x += a * 0.5 * Math.sin(u * 53.0 + 0.7); }
      camera.position.copy(camFrom); camera.lookAt(camAt);
      if (typeof camTarget !== 'undefined' && camTarget.copy) camTarget.copy(camAt);
    }

    // ── THE THREE BANDS (10-26, Sailor: "we split it into three bands"): Dia is a dot's distance from the centre, so the
    //    bands are rings — fluid inside 33, coalition to 66, denominated beyond. Faint always; bright while Ted explains them.
    const bandTier = d => d == null ? '' : d <= 33 ? 'fluid' : d <= 66 ? 'coalition' : 'denominated';
    const RING_R = d => (0.055 + d / 100 * 0.38) * 2.8;
    const bandGroup = new THREE.Group(); { let host = null; g.group.traverse(o => { if (!host && o.userData && o.userData.isGraphmapDot) host = o.parent; }); (host || g.group).add(bandGroup); }   // the dots' own group: the plane's centre is its origin
    const ringMats = [];
    [[33, 'FLUID · 0–33', '#9fe0b4'], [66, 'COALITION · 34–66', '#ffd27a'], [100, 'DENOMINATED · 67–100', '#ff8a6b']].forEach(([d, label, css], k) => {
      const r = RING_R(d), pts = []; for (let a = 0; a <= 128; a++) { const th = a / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0.004)); }
      const m = new THREE.LineDashedMaterial({ color: new THREE.Color(css), dashSize: 0.06, gapSize: 0.045, transparent: true, opacity: 0.25, depthWrite: false });
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m); ln.computeLineDistances(); bandGroup.add(ln); ringMats.push(m);
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
      x.font = '700 40px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 10; x.fillStyle = css; x.fillText(label, 256, 48);
      const sm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false, opacity: 0.25, fog: false });
      const sp = new THREE.Sprite(sm); const a = Math.PI * 0.62; sp.position.set(Math.cos(a) * r, Math.sin(a) * r + 0.06, 0.02); sp.scale.set(1.25, 0.235, 1); sp.renderOrder = 55; bandGroup.add(sp); ringMats.push(sm);
    });
    const bandPulse = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    bandPulse.position.z = 0.006; bandPulse.renderOrder = 56; bandPulse.visible = false; bandGroup.add(bandPulse); bandPulse.layers.enable(1);
    const BAND_I = { fluid: 0, coalition: 1, denominated: 2 }, BAND_COL = [0x9fe0b4, 0xffd27a, 0xff8a6b];
    function bandsFrame(b, t) {
      const loud = b && ((b.block && b.block.id === 'scores' && /^s_(dia|bands)/.test(b.id)) || b.bands === true);   // 10-27: `bands: true` lights the rings on any beat (the diatribe lesson moved to the Tucker reading)
      const named = b && b.band != null ? BAND_I[b.band] : -1;
      ringMats.forEach((m, k) => { const ring = Math.floor(k / 2); const want = named >= 0 ? (ring === named ? 1.0 : 0.18) : loud ? 0.95 : 0.22; m.opacity += (want - m.opacity) * 0.12; });
      // THE PULSE (10-29, Sailor: "have the bands illuminate with a radial effect"): a ring runs out from the centre to the
      // named band over a second, then a second, softer one follows; the named ring is the one left lit
      if (named >= 0) { const into = t - b.start; const R = RING_R([33, 66, 100][named]); const one = (t0, w) => { const u = (into - t0) / w; return (u > 0 && u < 1) ? u : -1; };
        const u = one(0.15, 1.1) >= 0 ? one(0.15, 1.1) : one(1.6, 1.4);
        if (u >= 0) { const sc = R * ease3(u); bandPulse.scale.set(sc, sc, 1); bandPulse.material.color.setHex(BAND_COL[named]); bandPulse.material.opacity = 0.9 * (1 - u * 0.4); bandPulse.visible = sc > 0.01; }
        else bandPulse.visible = false; }
      else bandPulse.visible = false;
    }
    // ── THE SCORE CARD: a text beat with `card: 'score'` holds its piece's numbers on screen while Ted talks them through
    const zWord = z => z == null ? '' : z >= 0.15 ? 'above the plane: they think it is working' : z <= -0.15 ? 'below the plane: they think they are losing' : 'on the plane: neither';
    function setScore(b) {
      const P = byPiece[b.piece]; if (!P) return false; const S = P.scoreboard || {}; const st = Object.keys(S.stations || {}).find(k => S.stations[k]);
      const SS = STATION[st] || ['', '', '#ffb13d']; const V = Object.assign({}, ...Object.values(S.stations || {}).filter(Boolean).map(x => x.voices || {}));   // 10-27: every voice on the piece, across stations (Tucker × West spans RP and LP)
      const nm = w => clean(P.names[w] || w);
      const voices = Object.keys(V).sort((a, c) => V[c].n - V[a].n).map(w => `${nm(w)} <b>${V[w].dia}</b> · z ${zs(V[w].readZ)}`).join('<br>');
      $('dn-score').style.borderTopColor = SS[2];
      $('dn-score').innerHTML = `<div class="k" style="color:${SS[2]}">■ ${SS[0]} · ${SS[1]} · ${clean(P.source.program)}</div><div class="t">${P.title}</div>
        <div class="row"><div class="n" style="color:${SS[2]}">${S.dia}</div><div class="l">Diatribe · ${bandTier(S.dia)}<small>how strongly they feel, 0–100</small></div>
        <div class="n">${zs(S.readZ)}</div><div class="l">z<small>${zWord(S.readZ)}</small></div>
        <div class="n">${S.lumens}</div><div class="l">Lumens<small>how much of the thing they can see</small></div></div>
        <div class="v">${voices}</div>`;
      return true;
    }
    // ── EXPLORE (10-26, Sailor: "click and drag around to explore, with the camera snapping back after 5 seconds"): drag to
    //    orbit the show's camera about what it's looking at, scroll to move in or out; five idle seconds and it eases home.
    const USER = { yaw: 0, pitch: 0, zoom: 1, last: -1e9, drag: null, t: performance.now() };
    if (!CAPTURE) {
      const cv = renderer.domElement;
      const own = e => e.target === cv;
      window.addEventListener('pointerdown', e => { if (!own(e)) return; USER.drag = { x: e.clientX, y: e.clientY }; USER.last = performance.now(); e.stopImmediatePropagation(); }, true);
      window.addEventListener('pointermove', e => { if (!USER.drag) return; const dx = e.clientX - USER.drag.x, dy = e.clientY - USER.drag.y; USER.drag = { x: e.clientX, y: e.clientY };
        USER.yaw -= dx * 0.005; USER.pitch = Math.max(-0.55, Math.min(0.95, USER.pitch + dy * 0.004)); USER.last = performance.now(); e.stopImmediatePropagation(); }, true);
      const up = e => { if (USER.drag) { USER.drag = null; USER.last = performance.now(); e.stopImmediatePropagation(); } };
      window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      window.addEventListener('click', e => { if (own(e)) e.stopImmediatePropagation(); }, true);
      window.addEventListener('wheel', e => { if (!own(e)) return; USER.zoom = Math.max(0.35, Math.min(2.6, USER.zoom * (1 + e.deltaY * 0.0012))); USER.last = performance.now(); e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true, passive: false });
    }
    const _uv = new THREE.Vector3(), _ax = new THREE.Vector3();
    function userCamera() {
      const now = performance.now(), dt = Math.min(0.1, (now - USER.t) / 1000); USER.t = now;
      if (!USER.drag && now - USER.last > 5000) { const k = 1 - Math.exp(-dt * 2.2); USER.yaw += (0 - USER.yaw) * k; USER.pitch += (0 - USER.pitch) * k; USER.zoom += (1 - USER.zoom) * k; }
      if (Math.abs(USER.yaw) < 1e-4 && Math.abs(USER.pitch) < 1e-4 && Math.abs(USER.zoom - 1) < 1e-4) return;
      _uv.copy(camFrom).sub(camAt).applyAxisAngle(UP, USER.yaw);
      _ax.crossVectors(_uv, UP).normalize(); _uv.applyAxisAngle(_ax, USER.pitch).multiplyScalar(USER.zoom);
      camFrom.copy(camAt).add(_uv);
    }

    // ── THE READING (2026-10-26, Sailor: "play the clips more … the graphmap more fully integrated, to the level it is in the
    //    Fukuyama interviews … keep things dynamic, let the camera move around … the graphmap spinning around and resizing").
    //    A clip beat with layout 'reading' plays on a floating g4 screen beside Ted (frame right) instead of full frame. Its
    //    run file (data/show/<ep>/runs/<clip>.json, made by scripts/show/make_runs.py from the Press piece + word-level
    //    captions — one score per line, never re-scored) times everything: captions under the screen, the caught words
    //    lifting off them and flying to their line's dot, the dot landing when the speaker finishes the line, a stem to its
    //    z, the map (over at frame left) turning and swelling toward each landing, the camera drifting and pushing in.
    //    Everything is a pure function of t, so seeking, pausing and frame-stepping all land on the same picture.
    const isReading = b => b && b.type === 'clip' && b.layout === 'reading';
    const RUNS = {};
    await Promise.all([...new Set(beats.filter(b => b.type === 'clip' && b.piece && b.layout !== 'fly').map(b => b.src))].map(async src => {
      try { RUNS[src] = await fetch('../data/show/' + ID + '/runs/' + src + '.json?v=' + Date.now()).then(r => r.json()); } catch (e) { console.error('[dream-news] run', src, e); } }));
    const READ = { on: false, b: null, run: null, local: 0, focus: -1, landAge: 99, near: 0, under: 0 };
    // the g4 screen: white plastic bezel, the clip as a video texture, a caption strip under the picture
    const G4W = 1.92, G4H = 1.08, G4 = new THREE.Group(); G4.visible = false; DN.add(G4);
    const G4_HOME = new THREE.Vector3(WIDE ? 1.78 : 0.62, WIDE ? 2.08 : 2.9, -1.15);
    G4.position.copy(G4_HOME); G4.rotation.y = WIDE ? -0.32 : -0.12;
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(G4W + 0.16, G4H + 0.44), new THREE.MeshBasicMaterial({ color: 0xeceae4, transparent: true, opacity: 0.94, side: THREE.DoubleSide, fog: false }));
    bezel.position.set(0, -0.12, -0.012); G4.add(bezel);
    const bezelEdge = new THREE.Mesh(new THREE.PlaneGeometry(G4W + 0.22, G4H + 0.5), new THREE.MeshBasicMaterial({ color: 0xffb13d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false }));
    bezelEdge.position.set(0, -0.12, -0.02); G4.add(bezelEdge);
    const vtex = new THREE.VideoTexture($('dn-clip')); try { vtex.colorSpace = THREE.SRGBColorSpace; } catch (e) {} try { vtex.encoding = THREE.sRGBEncoding; } catch (e) {}
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(G4W, G4H), new THREE.MeshBasicMaterial({ map: vtex, side: THREE.FrontSide, fog: false, toneMapped: false }));
    G4.add(screen);
    const capC = document.createElement('canvas'); capC.width = 1536; capC.height = 192; const capX = capC.getContext('2d');
    const capTex = new THREE.CanvasTexture(capC);
    const capPlane = new THREE.Mesh(new THREE.PlaneGeometry(G4W, G4W * 192 / 1536), new THREE.MeshBasicMaterial({ map: capTex, transparent: true, fog: false, toneMapped: false }));
    capPlane.position.set(0, -G4H / 2 - 0.15, 0.002); G4.add(capPlane);
    const nameC = document.createElement('canvas'); nameC.width = 1024; nameC.height = 96; const nameX = nameC.getContext('2d');
    const nameTex = new THREE.CanvasTexture(nameC);
    const namePlane = new THREE.Mesh(new THREE.PlaneGeometry(G4W * 0.62, G4W * 0.62 * 96 / 1024), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, fog: false, toneMapped: false }));
    namePlane.position.set(-G4W * 0.19, G4H / 2 + 0.07, 0.002); G4.add(namePlane);
    let capKey = '', nameKey = '';
    function drawName(run, st) {
      const k = run.clip + st; if (k === nameKey) return; nameKey = k;
      const S = STATION[st] || ['', '', '#ffb13d'];
      nameX.clearRect(0, 0, 1024, 96); nameX.textBaseline = 'middle';
      nameX.fillStyle = S[2]; nameX.fillRect(0, 22, 10, 52);
      nameX.font = '700 40px "Helvetica Neue", Helvetica, Arial, sans-serif'; nameX.fillStyle = '#16181f'; nameX.fillText(clean(run.source || ''), 26, 38);
      nameX.font = '600 26px "Helvetica Neue", Helvetica, Arial, sans-serif'; nameX.fillStyle = S[2]; nameX.fillText((S[0] ? '■ ' + S[0] + ' · ' + S[1] : '') + ' · ' + fmtDate(run.date), 26, 74);
      nameTex.needsUpdate = true;
    }
    function drawCaption(run, local) {
      const W = run.words; let k = -1; for (let i = 0; i < W.length; i++) { if (W[i][1] <= local) k = i; else break; }
      const key = run.clip + ':' + k; if (key === capKey) return; capKey = key;
      capX.clearRect(0, 0, 1536, 192);
      if (k < 0 || local - W[k][2] > 2.5) { capTex.needsUpdate = true; return; }
      const caught = new Set(); run.lines.forEach(l => l.caught.forEach(c => { if (Math.abs(c[1] - (W.find(w => w[0] === c[0] && Math.abs(w[1] - c[1]) < 0.02) || [0, -9])[1]) < 0.02) caught.add(c[1]); }));
      const from = Math.max(0, k - 9), seg = W.slice(from, k + 1);
      capX.font = '600 54px "Helvetica Neue", Helvetica, Arial, sans-serif'; capX.textBaseline = 'middle';
      let total = seg.reduce((a, w) => a + capX.measureText(w[0] + ' ').width, 0), x = Math.max(24, (1536 - total) / 2);
      seg.forEach((w, j) => { const isC = caught.has(w[1]); const last = j === seg.length - 1;
        capX.fillStyle = isC ? '#ffb13d' : last ? '#ffffff' : 'rgba(255,255,255,.72)';
        capX.shadowColor = 'rgba(0,0,0,.85)'; capX.shadowBlur = 10; capX.fillText(w[0] + ' ', x, 96); x += capX.measureText(w[0] + ' ').width; });
      capTex.needsUpdate = true;
    }
    // the dots' meshes and their stems (a dashed drop from the dot to the plane: how far the reading sits off it, z)
    const dotMesh = {}; g.group.traverse(o => { if (o.userData && o.userData.isGraphmapDot && o.userData.i != null) dotMesh[o.userData.i] = o; });
    const dotHome = {}; Object.keys(dotMesh).forEach(i => { dotHome[i] = dotMesh[i].position.clone(); });
    const dotsHost = bandGroup.parent;
    // THE LANDING STEM: a dashed drop from the landing pin to the plane while it sinks or floats (redrawn every frame)
    const landStem = (() => { const grp = new THREE.Group();
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.85 }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      grp.add(ln); grp.add(ring); grp.visible = false; dotsHost.add(grp); grp.traverse(o => o.layers.enable(1)); return { grp, ln, ring }; })();
    let landSink = null;
    function landFrame(t, b) {
      // the pin: on the plane as it appears, then sinks or floats to its z over two seconds (restored on the next beat)
      if (landSink != null && (!b || b.type !== 'land' || landIdx(b) !== landSink)) { if (dotMesh[landSink] && dotHome[landSink]) dotMesh[landSink].position.copy(dotHome[landSink]); landSink = null; }
      const li = landIdx(b), m = li >= 0 ? dotMesh[li] : null;
      if (!m || !dotHome[li]) { landStem.grp.visible = false; return; }
      const k = ease3(Math.max(0, Math.min(1, (t - b.start - 1.0) / 2.0)));
      m.position.z = dotHome[li].z * k; landSink = li;
      if (Math.abs(m.position.z) < 0.01) { landStem.grp.visible = false; return; }
      const col = COL[L[li].station] || 0xffffff; landStem.ln.material.color.setHex(col); landStem.ring.material.color.setHex(col);
      const a = landStem.ln.geometry.attributes.position; a.setXYZ(0, m.position.x, m.position.y, m.position.z); a.setXYZ(1, m.position.x, m.position.y, 0); a.needsUpdate = true; landStem.ln.computeLineDistances();
      landStem.ring.position.set(m.position.x, m.position.y, 0.002); landStem.grp.visible = true;
    }
    // THE RIPPLES (10-28): a ring spreads on the plane where a pin lands and where each word arrives — a pure function of t
    const RIPPLES = []; for (let k = 0; k < 16; k++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); r.visible = false; r.renderOrder = 57; dotsHost.add(r); r.layers.enable(1); RIPPLES.push(r); }
    function rippleFrame(events, t) {
      let k = 0;
      events.forEach(ev => { const age = t - ev.t; if (age < 0 || age > 1.7 || k >= RIPPLES.length) return; const r = RIPPLES[k++]; const u = age / 1.7;
        r.visible = true; r.position.set(ev.x, ev.y, 0.004); const sc = 0.05 + u * 0.5; r.scale.set(sc, sc, 1); r.material.color.setHex(ev.col); r.material.opacity = (1 - u) * (1 - u) * 0.85; });
      for (; k < RIPPLES.length; k++) RIPPLES[k].visible = false;
    }
    // THE CLOCKED LINE'S WORDS: from the run file, the words of the press line as they're said in the cut (clip-local times)
    const normW = w => (w || '').toLowerCase().replace(/[^a-z0-9']/g, '');
    const WORDS_CACHE = {};
    function lineWords(b) {
      if (!b || b.type !== 'clip' || !b.piece || b.line == null) return [];
      const key = b.id; if (WORDS_CACHE[key]) return WORDS_CACHE[key];
      const run = RUNS[b.src], li = lineInfo(b); if (!run || !li.p) return (WORDS_CACHE[key] = []);
      const q = new Set(li.quote.replace(/[“”"…—–]/g, ' ').split(/\s+/).map(normW).filter(w => w.length > 1));
      const out = [];
      (run.words || []).forEach(w => { const n = normW(w[0]); if (n.length > 1 && w[1] >= b.in - 0.3 && w[1] <= b.out + 0.2 && q.has(n) && !out.some(o => o.n === n)) out.push({ w: w[0].replace(/^[“"(]+|[,.;:!?"”)]+$/g, ''), n, t: w[1] }); });
      return (WORDS_CACHE[key] = out.slice(0, 14));
    }
    function bigFrame(t, b) {
      const el = $('dn-big'); const on = b && b.type === 'clip' && (b.layout || 'full') === 'full' && b.piece && b.line != null;
      if (!on) { el.style.display = 'none'; el.dataset.n = ''; el.dataset.b = ''; return; }
      const words = lineWords(b), local = b.in + (t - b.start), shown = words.filter(w => w.t <= local + 0.05);
      const S = STATION[lineInfo(b).st]; const sig = b.id + ':' + shown.length;
      if (el.dataset.b !== sig) { el.dataset.b = sig; el.innerHTML = shown.map((w, i) => `<span class="${i === shown.length - 1 ? 'new' : ''}"${i === shown.length - 1 && S ? ` style="color:${S[2]}"` : ''}>${w.w}</span>`).join(''); }
      el.style.display = shown.length ? 'flex' : 'none';
    }
    // on the landing the same words fly off the glass onto the map, each rippling where it lands
    const LANDW = {}; const _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
    function landWordSprites(b) {
      if (LANDW[b.id]) return LANDW[b.id];
      const prev = beats[beats.indexOf(b) - 1]; const li = landIdx(b);
      const ws = (prev && prev.type === 'clip' && prev.piece === b.piece && prev.line === b.line) ? lineWords(prev) : [];
      const S = li >= 0 ? STATION[L[li].station] : null;
      return (LANDW[b.id] = ws.map(w => wordSprite(w.w.toLowerCase(), S ? S[2] : '#ffb13d')));
    }
    const WORD_T0 = 0.3, WORD_GAP = 0.1, WORD_FLIGHT = 1.15;
    function landWordsFrame(t, b) {
      Object.values(LANDW).forEach(ws => ws.forEach(sp => { sp.visible = false; }));
      const li = landIdx(b), m = li >= 0 ? dotMesh[li] : null; if (!m) return;
      const ws = landWordSprites(b); if (!ws.length) return;
      m.getWorldPosition(_b); camera.getWorldDirection(_fw); _rt.crossVectors(_fw, UP).normalize();
      ws.forEach((sp, k) => {
        const dt = t - (b.start + WORD_T0 + k * WORD_GAP); if (dt < 0) return;
        const fl = Math.min(1, dt / WORD_FLIGHT), fe = ease3(fl);
        _a.copy(camera.position).addScaledVector(_fw, 2.0).addScaledVector(_rt, (k - (ws.length - 1) / 2) * 0.26); _a.y += 0.12;
        _c.lerpVectors(_a, _b, fe); _c.y += Math.sin(fe * Math.PI) * 0.3; sp.position.copy(_c);
        const rest = Math.max(0, dt - WORD_FLIGHT), fade = Math.max(0, 1 - rest / 1.1);
        const sc = (0.5 - 0.22 * fe) * (0.35 + 0.65 * fade); sp.scale.set(sc, sc / 4, 1); sp.material.opacity = fade; sp.visible = fade > 0.01;
      });
    }
    function rippleEvents(b) {
      if (!b) return [];
      const li = landIdx(b);
      if (li >= 0 && dotHome[li]) { const col = COL[L[li].station] || 0xffffff, h = dotHome[li]; const ev = [{ x: h.x, y: h.y, t: b.start + 0.15, col }];
        landWordSprites(b).forEach((sp, k) => ev.push({ x: h.x, y: h.y, t: b.start + WORD_T0 + k * WORD_GAP + WORD_FLIGHT, col })); return ev; }
      if (isReading(b)) { const ev = []; FLY.forEach(f => { if (f.src !== b.src || f.tw < b.in - 0.3 || f.tw > b.out) return; const m = dotMesh[f.i]; if (!m) return; ev.push({ x: m.position.x, y: m.position.y, t: b.start + (f.tw - b.in) + 1.25, col: COL[L[f.i].station] || 0xffffff }); }); return ev; }
      return [];
    }
    const stems = {};
    function stemFor(i) {
      if (stems[i]) return stems[i]; const m = dotMesh[i]; if (!m) return null;
      const col = COL[L[i].station] || 0xffffff;
      const geo = new THREE.BufferGeometry().setFromPoints([m.position.clone(), new THREE.Vector3(m.position.x, m.position.y, 0)]);
      const ln = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: col, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.8 })); ln.computeLineDistances();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      ring.position.set(m.position.x, m.position.y, 0.002);
      const grp = new THREE.Group(); grp.add(ln); grp.add(ring); m.parent.add(grp); grp.visible = false; stems[i] = grp; liftStage(); return grp;
    }
    // ── THE Z PLANES (10-27, Sailor: "flip around so we can see below the plane… very translucent z boundary planes with
    //    frustrated/realized in a soft legible font"): two faint sheets at z ±0.5, parallel to the map, each named once.
    //    `map.zPlanes: true` on a beat brings them up; they fade in and out.
    const ZF = 0.75 * 2.2 * 0.8;   // a reading's z → the dots' local height (press-build's normZ = 0.75 z; the factory's Z_EXTENT 2.2 × 0.8)
    const softLabel = (text, color, wt = 400) => { const c = document.createElement('canvas'); c.width = 1536; c.height = 160; const x = c.getContext('2d');
      x.font = wt + ' 92px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.letterSpacing = '18px'; x.shadowColor = 'rgba(0,0,0,.75)'; x.shadowBlur = 16; x.fillStyle = color; x.fillText(text, 768, 80);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 }));
      sp.scale.set(1.5, 0.156, 1); sp.renderOrder = 58; return sp; };
    const zPlanes = new THREE.Group(); bandGroup.parent.add(zPlanes); const zMats = [];
    // the sheets: a thin-film shader — the colour bands drift with the view angle and time, tinted green (+z) and red (−z);
    // translucent, no depth write, so the pins pierce them fully opaque (10-29, Sailor)
    const iriMat = tint => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uTint: { value: new THREE.Color(tint) } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; uniform float uOpacity; uniform vec3 uTint; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
          float band = fract(vUv.x * 1.3 + vUv.y * 0.7 + uTime * 0.045 + f * 1.4 + 0.12 * sin(vUv.y * 9.0 + uTime * 0.6));
          vec3 iri = 0.55 + 0.45 * cos(6.28318 * (band + vec3(0.0, 0.33, 0.67)));
          vec3 col = mix(uTint, iri, 0.5) + 0.25 * f;
          float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(0.0, 0.06, 1.0 - vUv.x) * smoothstep(0.0, 0.06, vUv.y) * smoothstep(0.0, 0.06, 1.0 - vUv.y);
          gl_FragColor = vec4(col, uOpacity * (0.5 + 0.5 * f) * (0.55 + 0.45 * edge)); }` });
    const zShaders = [];
    [[0.5, '+Z · REALIZED', '#9fe8b4', 0x5fd38a], [-0.5, '−Z · FRUSTRATED', '#ff9d9d', 0xe06060]].forEach(([z, word, css, hex]) => {
      const m = iriMat(hex); zShaders.push(m);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), m); pl.position.z = z * ZF; pl.renderOrder = 40; zPlanes.add(pl);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.8, 2.8)), new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false }));
      e.position.z = z * ZF; zPlanes.add(e); zMats.push([e.material, 0.7]);
      { const c = document.createElement('canvas'); c.width = 1536; c.height = 200; const x = c.getContext('2d');   // the name, printed on the glass itself (10-29): a flat plane on the sheet, centred
        x.font = '600 120px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '26px'; x.fillStyle = css; x.globalAlpha = 0.9; x.fillText(word, 768, 100);
        const tm = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
        const tp = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.3), tm); tp.position.set(0, 0, z * ZF + (z > 0 ? 0.012 : -0.012)); tp.renderOrder = 41; zPlanes.add(tp); zMats.push([tm, 0.92]); }
    });
    zPlanes.traverse(o => o.layers.enable(1));
    function zPlanesFrame(t, b) {   // time-based, so a paused seek shows the same thing as playback
      const zp = x => !!(x && ((x.map && x.map.zPlanes) || (x.type === 'land' && (x.zPlanes != null ? x.zPlanes : !!EP.landIsolate)))); const on = zp(b);   // ep 1.1: a landing brings the z planes up, as standard
      const prev = b && beats[beats.indexOf(b) - 1];
      const k = !on ? 0 : zp(prev) ? 1 : Math.min(1, (t - b.start) / 0.9);
      zMats.forEach(([m, full]) => { m.opacity = full * k; }); zShaders.forEach(m => { m.uniforms.uOpacity.value = 0.34 * k; m.uniforms.uTime.value = t; }); zPlanes.visible = k > 0.002; }
    // ── THE PINS (10-27, Sailor: "the scattering of statements for each given media segment condense into a single pin…
    //    have the pins bounce down to the plane for a moment" while Ted explains x and y). One pin per piece: the mean of its
    //    lines' places, its read z, its colour the station most of its lines sit in. `map.pins`: 'gather' (the scatter
    //    flies in to the pin), true (pins only), and `map.flat: true` (the pins sit down on the plane for the x/y talk).
    // ep 1.1 (11-02, Sailor: "we collapse the pins… let's see each side and discuss the coordinates"): `EP.pinSplit: [pieceId]`
    // gives a piece one pin per voice — a debate's two candidates stand apart. A split pin's id is `<piece>:<who>`.
    const PIN_KEYS = PIECE_IDS.flatMap(pid => (EP.pinSplit || []).includes(pid)
      ? [...new Set(L.filter(p => p.pid === pid && p.station !== 'O').map(p => p.who))].map(w => ({ key: pid + ':' + w, pid, who: w }))
      : [{ key: pid, pid, who: null }]);
    const PINS = PIN_KEYS.map(({ key, pid: pid0, who }, k) => {
      const pid = key;
      const ls = L.filter(p => p.pid === pid0 && p.station !== 'O' && (who == null || p.who === who)); if (!ls.length) return null; const P = byPiece[pid0] || {}; const S = P.scoreboard || {};
      const cnt = {}; ls.forEach(p => { cnt[p.station] = (cnt[p.station] || 0) + 1; }); const st = Object.keys(cnt).sort((a, c) => cnt[c] - cnt[a])[0];
      const nx = ls.reduce((a, p) => a + p.normX, 0) / ls.length, ny = ls.reduce((a, p) => a + p.normY, 0) / ls.length;
      const z = who != null ? ls.reduce((a, p) => a + (p.z || 0), 0) / ls.length : (S.readZ != null ? S.readZ : 0);
      const pos = new THREE.Vector3((nx - 0.5) * 2.8, (0.5 - ny) * 2.8, z * ZF);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshStandardMaterial({ color: COL[st], emissive: COL[st], emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.2 }));
      mesh.position.copy(pos); mesh.visible = false; mesh.renderOrder = 60; bandGroup.parent.add(mesh);
      const short = ((EP.pinLabels && EP.pinLabels[pid]) || (who != null && P.names && P.names[who] ? clean(P.names[who]).replace(/\s*\(.*/, '') : null) || P.pin || (P.names && Object.values(P.names).map(n => clean(n).split(' ').slice(-1)[0]).join(' × ')) || pid);
      const lb = softLabel(short, STATION[st] ? STATION[st][2] : '#fff', 600); lb.material.opacity = 1; lb.scale.set(1.15, 0.12, 1); lb.visible = false; bandGroup.parent.add(lb);
      const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: COL[st], dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.8 }));
      stem.visible = false; bandGroup.parent.add(stem);
      [mesh, lb, stem].forEach(o => o.layers.enable(1));
      return { pid, st, pos, mesh, lb, stem, lines: ls.map(p => L.indexOf(p)) };
    }).filter(Boolean);
    // each label sits off its pin, away from the centre, alternate pins nudged either side so neighbours don't stack
    PINS.forEach((P, k) => { const d = new THREE.Vector2(P.pos.x, P.pos.y); if (d.length() < 0.08) d.set(0, -1); d.normalize();
      const perp = new THREE.Vector2(-d.y, d.x).multiplyScalar((k % 2 ? 1 : -1) * 0.2); P.lo = new THREE.Vector2(d.x * 0.6 + perp.x, d.y * 0.36 + perp.y); });
    const lineHome = {};
    const easeBack = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
    // ── THE LUMENS ARC (sp01, 10-31, ruled by Sailor: light depends on which way a line faces the object, not where it sits).
    //    `map.arc: true`: the object glows at the centre of the plane; every line on the map that faces it (touch O, T, B, M, X)
    //    gets a beam from the object, brighter the cooler the line (1 − diatribe/100 — the same sum as lumens); a line facing
    //    the argument about the argument (touch F) gets no beam and a dark ring — in shadow, from any corner.
    const ARC = (() => { const grp = new THREE.Group(); grp.visible = false; bandGroup.parent.add(grp);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0, depthWrite: false }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.renderOrder = glow.renderOrder = 66; grp.add(core); grp.add(glow);
      const lab = softLabel('THE OBJECT', '#ffe6a8', 600); lab.scale.set(0.95, 0.1, 1); lab.position.set(0, -0.26, 0.05); grp.add(lab);
      grp.traverse(o => o.layers.enable(1));
      return { grp, core, glow, lab, beams: {} }; })();
    const REC_T = new Set(['O', 'T', 'B', 'M', 'X']);
    function arcFrame(t, b) {
      const on = !!(b && b.map && b.map.arc); const prev = b && beats[beats.indexOf(b) - 1]; const was = !!(prev && prev.map && prev.map.arc);
      const k = !on ? 0 : was ? 1 : Math.min(1, (t - b.start) / 1.1);
      ARC.grp.visible = k > 0.002; if (!ARC.grp.visible) return;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.4);
      ARC.core.material.opacity = 0.95 * k; ARC.glow.material.opacity = 0.35 * k * pulse; ARC.glow.scale.setScalar(1 + 0.08 * Math.sin(t * 2.4)); ARC.lab.material.opacity = 0.9 * k;
      const wp = new THREE.Vector3();
      L.forEach((p, i) => { const d = dotMesh[i]; let B = ARC.beams[i];
        const vis = !!(d && d.visible && d.parent && d.parent.visible !== false && p.station !== 'O');
        if (!B) { if (!vis) return;
          const lit = REC_T.has(p.touch);
          const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffdf9a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.085, 28), new THREE.MeshBasicMaterial({ color: lit ? 0xffe2a0 : 0x0b0d14, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
          line.renderOrder = 65; ring.renderOrder = 67; line.layers.enable(1); ring.layers.enable(1); ARC.grp.add(line); ARC.grp.add(ring);
          B = ARC.beams[i] = { line, ring, lit, w: Math.max(0.12, 1 - (p.dia || 0) / 100) }; }
        if (!vis) { B.line.material.opacity = 0; B.ring.material.opacity = 0; return; }
        d.getWorldPosition(wp); ARC.grp.worldToLocal(wp);
        const pos = B.line.geometry.attributes.position; pos.setXYZ(1, wp.x, wp.y, wp.z); pos.needsUpdate = true;
        B.ring.position.copy(wp); B.ring.lookAt(camera.getWorldPosition(new THREE.Vector3()));   // lookAt takes a world point
        B.line.material.opacity = B.lit ? 0.75 * B.w * k : 0;
        B.ring.material.opacity = B.lit ? 0.55 * B.w * k : 0.85 * k; });
    }
    // ── THE SPLIT (sp01, 10-31, ruled by Sailor: read from the audience's own seat, the displaced cost drawn beside it).
    //    `map.split: 'home'` — one pin up in realized: your seat. `'both'` — and a second pin down in frustrated, off to the
    //    side: the cost, somewhere else. A dashed line ties them: the same event.
    const SPLIT = (() => { const grp = new THREE.Group(); grp.visible = false; bandGroup.parent.add(grp);
      const mk = (hex, at, word, css) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 22, 16), new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0 }));
        m.position.copy(at); m.renderOrder = 62; grp.add(m);
        const lb = softLabel(word, css, 700); lb.scale.set(1.7, 0.177, 1); lb.position.copy(at).add(new THREE.Vector3(0, 0, at.z > 0 ? 0.24 : -0.24)); grp.add(lb);
        const st = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(at.x, at.y, 0), at.clone()]), new THREE.LineDashedMaterial({ color: hex, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0 }));
        st.computeLineDistances(); grp.add(st); return { m, lb, st }; };
      const home = mk(0x5fd38a, new THREE.Vector3(-0.55, 0.15, 0.62 * ZF), 'YOUR SEAT · REALIZED', '#9fe8b4');
      const cost = mk(0xe06060, new THREE.Vector3(0.95, -0.2, -0.62 * ZF), 'COST · UKRAINE · GAZA', '#ff9d9d');
      const tie = new THREE.Line(new THREE.BufferGeometry().setFromPoints([home.m.position.clone(), cost.m.position.clone()]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0 }));
      tie.computeLineDistances(); grp.add(tie);
      const same = softLabel('SAME EVENT', '#ffffff', 600); same.scale.set(0.8, 0.085, 1); same.position.copy(home.m.position).lerp(cost.m.position, 0.5).add(new THREE.Vector3(0.12, 0, 0)); grp.add(same);
      grp.traverse(o => o.layers.enable(1));
      return { grp, home, cost, tie, same }; })();
    // ── THE DIAGNOSTIC BOUNDARY (ep 1.1, 11-02, Sailor: "a great opportunity to introduce the diagnostic boundary"):
    //    `map.boundary: { a: pinId, b: pinId, words: [aSide, bSide] }` stands a translucent sheet on the map where two
    //    readings of one statement meet — the good-faith reading on one side, the bad-faith reading on the other.
    //    11-03 (Sailor: "the diagnostic shows where the good/bad faith interpretations meet"): its disturbance is the
    //    piece's own Diatribe — J_dia_operator §2: Diatribe and the DiaGnostic boundary are one scalar read at two
    //    altitudes — so it is no longer set by hand. `charge` (0–1) still overrides, for a boundary with no piece.
    const BOUND = (() => { const grp = new THREE.Group(); grp.visible = false; bandGroup.parent.add(grp);
      const geo = new THREE.PlaneGeometry(1.5, 0.95, 40, 26); const base = geo.attributes.position.array.slice();
      const mat = iriMat(0xb9a6ff); mat.side = THREE.DoubleSide; const sheet = new THREE.Mesh(geo, mat); sheet.renderOrder = 45; grp.add(sheet);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.5, 0.95)), new THREE.LineBasicMaterial({ color: 0xd9ccff, transparent: true, opacity: 0, depthWrite: false })); grp.add(edge);
      const la = softLabel('·', '#ffe6a8', 700), lb = softLabel('·', '#ff9d9d', 700); [la, lb].forEach(l => { l.scale.set(1.25, 0.13, 1); grp.add(l); });
      const title = softLabel('DIAGNOSTIC BOUNDARY', '#d9ccff', 600); title.scale.set(1.35, 0.14, 1); grp.add(title);
      grp.traverse(o => o.layers.enable(1));
      return { grp, sheet, geo, base, mat, edge, la, lb, title, words: '' }; })();
    const _ba = new THREE.Vector3(), _bb = new THREE.Vector3(), _bn = new THREE.Vector3(), _br = new THREE.Vector3(), _bup = new THREE.Vector3(0, 0, 1), _bm = new THREE.Matrix4();
    function boundaryFrame(t, b) {
      const m = (b && b.map) || {}; const B = m.boundary; const prev = b && beats[beats.indexOf(b) - 1]; const was = !!(prev && prev.map && prev.map.boundary);
      if (!B) { BOUND.grp.visible = false; return; }
      const A = PINS.find(x => x.pid === B.a), C = PINS.find(x => x.pid === B.b); if (!A || !C) { BOUND.grp.visible = false; return; }
      const k = was ? 1 : Math.min(1, (t - b.start) / 1.2); BOUND.grp.visible = true;
      _ba.set(A.pos.x, A.pos.y, 0); _bb.set(C.pos.x, C.pos.y, 0);
      _bn.subVectors(_bb, _ba); const len = Math.max(0.2, _bn.length()); _bn.normalize(); _br.crossVectors(_bup, _bn).normalize();
      _bm.makeBasis(_br, _bup, _bn); BOUND.sheet.quaternion.setFromRotationMatrix(_bm); BOUND.edge.quaternion.copy(BOUND.sheet.quaternion);
      const mid = _ba.clone().lerp(_bb, 0.5); mid.z = 0.48; BOUND.sheet.position.copy(mid); BOUND.edge.position.copy(mid);
      const BP = byPiece[String(B.a).split(':')[0]] || byPiece[String(B.b).split(':')[0]]; const bDia = (BP && BP.scoreboard && BP.scoreboard.dia != null) ? BP.scoreboard.dia : null;
      const ch = Math.max(0, Math.min(1, B.charge != null ? B.charge : bDia != null ? bDia / 100 : 0.5)); const amp = 0.04 + 0.2 * ch;
      const P_ = BOUND.geo.attributes.position, a = P_.array, base = BOUND.base;
      for (let i = 0; i < a.length; i += 3) { const x = base[i], y = base[i + 1]; const fx = 1 - Math.pow(Math.abs(x) / 0.75, 3), fy = 1 - Math.pow(Math.abs(y) / 0.475, 3);
        a[i + 2] = amp * Math.max(0, fx) * Math.max(0, fy) * (Math.sin(x * 5.0 + t * 1.3) * Math.cos(y * 6.0 - t * 0.9) + 0.45 * Math.sin(x * 11.0 - y * 7.0 + t * 2.1) * ch); }
      P_.needsUpdate = true; BOUND.geo.computeVertexNormals();
      BOUND.mat.uniforms.uOpacity.value = 0.5 * k; BOUND.mat.uniforms.uTime.value = t; BOUND.edge.material.opacity = 0.55 * k;
      const w = (B.words || []).join('|'); if (BOUND.words !== w) { BOUND.words = w;
        const re = (sp, text, css) => { const c = document.createElement('canvas'); c.width = 1536; c.height = 160; const x = c.getContext('2d'); x.font = '700 92px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '14px'; x.shadowColor = 'rgba(0,0,0,.75)'; x.shadowBlur = 16; x.fillStyle = css; x.fillText(text, 768, 80); sp.material.map.dispose(); sp.material.map = new THREE.CanvasTexture(c); sp.material.needsUpdate = true; };
        re(BOUND.la, (B.words || [])[0] || '', '#ffe6a8'); re(BOUND.lb, (B.words || [])[1] || '', '#ff9d9d');
        re(BOUND.title, 'DIAGNOSTIC BOUNDARY' + (bDia != null && B.charge == null ? ' · DIATRIBE ' + Math.round(bDia) : ''), '#d9ccff'); }
      BOUND.la.position.copy(_ba).add(new THREE.Vector3(0, 0, 0.62)); BOUND.lb.position.copy(_bb).add(new THREE.Vector3(0, 0, 0.62));
      BOUND.title.position.copy(mid).add(new THREE.Vector3(0, 0, 0.6));
      [BOUND.la, BOUND.lb].forEach(l => { l.material.opacity = 0.95 * k; }); BOUND.title.material.opacity = 0.8 * k;
    }
    // ep 1.1 (11-02, Sailor: "when we're scoring a statement onto the graphmap, isolate the pin as much as possible…
    // make that a standard treatment, with the z boundary planes"): on a landing, every other dot steps back — the line
    // alone on the map, between the realized and frustrated sheets. On by `EP.landIsolate` (or `isolate` on the beat).
    function landIsoFrame(t, b) {
      if (!b || b.type !== 'land' || !(b.isolate != null ? b.isolate : EP.landIsolate)) return;
      const keep = landIdx(b); L.forEach((_, i) => { if (i !== keep) g.setDotVisible(i, false); });
    }
    function splitFrame(t, b) {
      const mode = b && b.map && b.map.split; const prev = b && beats[beats.indexOf(b) - 1]; const pm = prev && prev.map && prev.map.split;
      SPLIT.grp.visible = !!mode; if (!mode) return;
      L.forEach((_, i) => g.setDotVisible(i, false));   // the two pins alone on the map: the event, from two seats
      const ramp = Math.min(1, (t - b.start) / 1.0);
      const kh = pm ? 1 : ramp, kc = mode === 'both' ? (pm === 'both' ? 1 : ramp) : 0;
      const setK = (o, k) => { o.m.material.opacity = k; o.lb.material.opacity = k; o.st.material.opacity = 0.8 * k; };
      setK(SPLIT.home, kh); setK(SPLIT.cost, kc); SPLIT.tie.material.opacity = 0.7 * kc; SPLIT.same.material.opacity = 0.9 * kc;
    }
    // THE MEASURE FRAME (10-28): on `map.measure: pieceId` the pin's x, y and z are drawn out in turn — along the plane
    // from the centre, up to the pin's y, up the stem — then a halo sized by its lumens; each with its name
    const MEAS = (() => { const grp = new THREE.Group(); grp.visible = false; bandGroup.parent.add(grp); grp.traverse(o => o.layers.enable(1));
      const mk = col => { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthTest: false })); ln.renderOrder = 70; ln.layers.enable(1); grp.add(ln); return ln; };
      const lx = mk(0xffffff), ly = mk(0xffffff), lz = mk(0xffffff);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })); halo.renderOrder = 69; halo.layers.enable(1); grp.add(halo);
      const lab = ['X', 'Y', 'Z', 'LUMENS'].map(w => { const sp = softLabel(w, '#ffffff', 600); sp.scale.set(0.9, 0.094, 1); sp.material.opacity = 0; sp.layers.enable(1); grp.add(sp); return sp; });
      return { grp, lx, ly, lz, halo, lab }; })();
    function measureFrame(t, b) {
      const m = (b && b.map) || {}; const P = m.measure ? PINS.find(x => x.pid === m.measure) : null;
      if (!P) { MEAS.grp.visible = false; return; }
      MEAS.grp.visible = true; const into = t - b.start, seg = (a, d) => ease3(Math.max(0, Math.min(1, (into - a) / d)));
      const kx = seg(0.4, 1.1), ky = seg(1.6, 1.1), kz = seg(2.8, 1.1), kl = seg(4.0, 1.2); const S = P.pos, col = COL[P.st] || 0xffffff;
      const set = (ln, a, c, k) => { const q = ln.geometry.attributes.position; q.setXYZ(0, a.x, a.y, a.z); q.setXYZ(1, a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, a.z + (c.z - a.z) * k); q.needsUpdate = true; ln.visible = k > 0.001; ln.material.color.setHex(col); };
      const o = new THREE.Vector3(0, 0, 0), px = new THREE.Vector3(S.x, 0, 0), py = new THREE.Vector3(S.x, S.y, 0), pz = new THREE.Vector3(S.x, S.y, S.z);
      set(MEAS.lx, o, px, kx); set(MEAS.ly, px, py, ky); set(MEAS.lz, py, pz, kz);
      const PP = byPiece[P.pid] || byPiece[String(P.pid).split(':')[0]]; const L_ = (PP && PP.scoreboard) ? PP.scoreboard.lumens : 50; const r = 0.12 + 0.55 * (L_ / 100);
      MEAS.halo.position.set(S.x, S.y, S.z); MEAS.halo.scale.setScalar(r * kl); MEAS.halo.material.opacity = 0.9 * kl * (0.75 + 0.25 * Math.sin(t * 3)); MEAS.halo.material.color.setHex(col);
      MEAS.lab[0].position.set(S.x / 2, -0.17, 0.02); MEAS.lab[0].material.opacity = kx;
      MEAS.lab[1].position.set(S.x + 0.3 * Math.sign(S.x || 1), S.y / 2, 0.02); MEAS.lab[1].material.opacity = ky;
      MEAS.lab[2].position.set(S.x + 0.3 * Math.sign(S.x || 1), S.y, S.z / 2); MEAS.lab[2].material.opacity = kz;
      MEAS.lab[3].position.set(S.x, S.y + r + 0.16, S.z); MEAS.lab[3].material.opacity = kl;
    }
    // THE STILLS (10-28, Sailor: "have their pictures up while he's talking"): `still: 'name'` on a beat shows
    // data/show/<ep>/stills/<name>.jpg in a frame at the top right, with its caption
    const stillEl = document.createElement('div'); stillEl.id = 'dn-still';
    stillEl.innerHTML = '<img><div class="c"></div>';
    stillEl.style.cssText = 'position:fixed;right:3.5vw;top:14vh;width:min(26vw,460px);display:none;flex-direction:column;background:rgba(8,10,16,.9);border:1px solid #2a2f42;border-radius:6px;padding:.6vw;z-index:35;pointer-events:none;box-shadow:0 10px 40px rgba(0,0,0,.6);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff;opacity:0;transition:opacity .35s';
    stillEl.querySelector('img').style.cssText = 'width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:3px;display:block;background:#000';
    stillEl.querySelector('.c').style.cssText = 'font-size:clamp(11px,.95vw,18px);letter-spacing:.12em;text-transform:uppercase;opacity:.85;margin-top:.5vw;padding:0 .2vw';
    (document.getElementById('dn') || document.body).appendChild(stillEl);
    // THE QUOTE CARD (sp01, 10-31, Sailor: "let's just read the podcast clips"): `quote: {text, who, src}` on a text beat
    // shows the line being read, who said it and where, centred low — Ted reads it; the card says whose words they are
    const quoteEl = document.createElement('div'); quoteEl.id = 'dn-quote';
    quoteEl.innerHTML = '<div class="q"></div><div class="w"></div>';
    quoteEl.style.cssText = 'position:fixed;left:50%;top:15vh;transform:translateX(-50%);width:min(58vw,1000px);display:none;background:rgba(8,10,16,.88);border:1px solid #2a2f42;border-left:4px solid #ffb13d;border-radius:6px;padding:1.6vh 1.6vw 1.3vh;z-index:35;pointer-events:none;box-shadow:0 12px 44px rgba(0,0,0,.6);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff;opacity:0;transition:opacity .35s';
    quoteEl.querySelector('.q').style.cssText = 'font-size:clamp(16px,1.7vw,34px);line-height:1.32;font-weight:600;font-family:Georgia,"Times New Roman",serif';
    quoteEl.querySelector('.w').style.cssText = 'font-size:clamp(10px,.85vw,16px);letter-spacing:.16em;text-transform:uppercase;opacity:.75;margin-top:1vh';
    (document.getElementById('dn') || document.body).appendChild(quoteEl);
    function quoteFrame(t, b) {
      const q = epv(b, 'quote');
      if (!q || !q.text) { quoteEl.style.opacity = '0'; setTimeout(() => { if (quoteEl.style.opacity === '0') quoteEl.style.display = 'none'; }, 380); return; }
      if (quoteEl.dataset.b !== b.id) { quoteEl.dataset.b = b.id; quoteEl.querySelector('.q').textContent = '\u201c' + q.text + '\u201d'; quoteEl.querySelector('.w').textContent = [q.who, q.src].filter(Boolean).join(' \u00b7 '); }
      quoteEl.style.display = 'block'; requestAnimationFrame(() => { quoteEl.style.opacity = '1'; });
    }
    // THE SCOREBOARD (10-29, Sailor: "a table with all the scores… make it obvious which were + and − on the z axis"):
    // one row per piece, in the order given, each row arriving 1.4 s after the last; z green for +, red for −, with an arrow
    const tableEl = document.createElement('div'); tableEl.id = 'dn-table';
    tableEl.style.cssText = 'position:fixed;left:50%;top:14vh;transform:translateX(-50%);width:min(64vw,1100px);display:none;background:rgba(8,10,16,.86);border:1px solid #2a2f42;border-top:3px solid #ffb13d;border-radius:8px;padding:1.2vh 1.4vw 1vh;z-index:36;pointer-events:none;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff;box-shadow:0 14px 50px rgba(0,0,0,.65)';
    (document.getElementById('dn') || document.body).appendChild(tableEl);
    const tableStyle = document.createElement('style'); tableStyle.textContent = `
      #dn-table table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
      #dn-table th { font-size: clamp(10px,.8vw,15px); letter-spacing: .18em; text-transform: uppercase; opacity: .6; text-align: left; padding: .4vh .6vw; font-weight: 600; }
      #dn-table th.n, #dn-table td.n { text-align: right; }
      #dn-table td { padding: .55vh .6vw; border-top: 1px solid #1f2435; font-size: clamp(15px,1.5vw,30px); font-weight: 700; }
      #dn-table td.who { font-weight: 800; } #dn-table td.who small { display: block; font-size: .55em; font-weight: 400; opacity: .65; letter-spacing: .1em; text-transform: uppercase; }
      #dn-table td.z { font-weight: 800; } #dn-table td.z.pos { color: #7fe0a8; } #dn-table td.z.neg { color: #ff8a8a; }
      #dn-table tr.row { opacity: 0; transform: translateY(.6vh); transition: opacity .45s, transform .45s; } #dn-table tr.row.in { opacity: 1; transform: none; }`;
    document.head.appendChild(tableStyle);
    function tableFrame(t, b) {
      const ids = b && b.map && Array.isArray(b.map.table) ? b.map.table : null;
      if (!ids) { tableEl.style.display = 'none'; tableEl.dataset.b = ''; return; }
      if (tableEl.dataset.b !== b.id) { tableEl.dataset.b = b.id;
        tableEl.innerHTML = '<table><thead><tr><th>Segment</th><th class="n">Diatribe</th><th class="n">z</th><th class="n">Lumens</th></tr></thead><tbody>' + ids.map(pid => { const P = byPiece[pid]; if (!P) return ''; const S = P.scoreboard || {}; const st = Object.keys(S.stations || {}).find(k => S.stations[k]); const SS = STATION[st] || ['', '', '#fff'];
          const z = S.readZ || 0, zc = z > 0.05 ? 'pos' : z < -0.05 ? 'neg' : ''; const arrow = z > 0.05 ? '▲' : z < -0.05 ? '▼' : '•';
          return `<tr class="row" data-pid="${pid}"><td class="who" style="border-left:4px solid ${SS[2]}">${(EP.pinLabels && EP.pinLabels[pid]) || P.title}<small>${SS[0]} · ${clean(P.source.program)}</small></td><td class="n">${S.dia}</td><td class="n z ${zc}">${arrow} ${(z > 0 ? '+' : '') + z.toFixed(1)}</td><td class="n">${S.lumens}</td></tr>`; }).join('') + '</tbody></table>'; }
      tableEl.style.display = 'block';
      tableEl.querySelectorAll('tr.row').forEach((tr, k) => tr.classList.toggle('in', t - b.start >= 0.6 + k * 1.4));
    }
    // ── THE M3P (ex01, 2026-11-06, Sailor: "the g4 should take up the lower 40% of the mobile screen… keep the m3p as free
    //    floating as possible… some kind of light angled / iridescent effect as the m3p lags and floats and slides into place…
    //    it should move around and resize as it makes sense to present the information"). The Mark III Prism, the terminal
    //    station that runs Prism (Pacifica Dialectics). On the show it is glass: real page content, drawn at the screen's own
    //    resolution so every word reads on a phone, floating over the villa. Where it sits is a beat field, carried forward:
    //      m3p: 'off' | 'dock' (the lower 40%) | 'low' (slid down and out of the way, a strip for words) | 'full' (the glass)
    //      m3pScreen: 'intro' | 'signals' | 'needle' | 'america' | 'russia' | 'strikes' | 'shadow' | 'diesel' | 'bet'
    //      m3pText: words projected on the strip (the 'low' screen); m3pHi: which row of a list is lit
    //    It moves between places over ~1.3 s with an overshoot, tilting with its own speed (the lag), and idles with a slow
    //    float. The rim and the sheen are thin-film light that brightens while it moves. All a pure function of show time.
    const M3P_ON = beats.some(b => b.m3p);
    const m3pEl = document.createElement('div'); m3pEl.id = 'dn-m3p';
    // 11-07 (Sailor: "make the m3p screen look a little more like an actual display panel"): a device — graphite body, a thin
    // bezel round an inset screen (glass reflection, faint scanlines), and a chin with the wordmark, a power light and, on a
    // live page, the controls as hardware keys
    m3pEl.innerHTML = '<div class="glass"><div class="screen"><div class="bar"><span class="ttl"></span><span class="sw"></span></div><div class="scr"></div><div class="refl"></div></div>'
      + '<div class="chin"><span class="mk">M3P</span><span class="led"></span>' + (CAPTURE ? '' :
      '<span class="ctl"><button data-c="back" title="back 10 seconds">⟲10</button><button data-c="play" title="play / pause">▶</button><button data-c="fwd" title="forward 10 seconds">10⟳</button><button data-c="read" class="rd" title="read it as an article">READ</button></span>') + '</div></div>';
    // the controls live in the M3P's bar (11-06, Sailor: "the player controls should be folded into the m3p… play/pause, forward/back 10s")
    m3pEl.addEventListener('click', e => { const c = e.target && e.target.dataset && e.target.dataset.c; if (!c || !window.__ctl) return; e.stopPropagation();
      if (c === 'play') window.__ctl.toggle(); else if (c === 'back') window.__ctl.skip(-10); else if (c === 'fwd') window.__ctl.skip(10); else if (c === 'read') artOpen(); });
    const m3pCSS = document.createElement('style');
    m3pCSS.textContent = `
      #dn-m3p { position: absolute; left: 0; top: 0; display: none; z-index: 30; pointer-events: none; perspective: 1400px; }
      #dn-m3p .glass { position: absolute; inset: 0; border-radius: 1.6vmin; overflow: hidden; transform-style: preserve-3d;
        background: linear-gradient(160deg, rgba(14,20,40,.80), rgba(6,9,20,.86)); backdrop-filter: blur(6px) saturate(1.2); -webkit-backdrop-filter: blur(6px) saturate(1.2);
        box-shadow: 0 2vmin 6vmin rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.10); color: #f3efe6; font-family: Georgia, 'Times New Roman', serif; }
      #dn-m3p .glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: .32vmin; pointer-events: none; opacity: var(--rim, .45);
        background: conic-gradient(from var(--a, 0deg), #ffd6a0, #ffb0e0, #b8c8ff, #a8f0e0, #fff2b0, #ffd6a0);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
      #dn-m3p .glass::after { content: ''; position: absolute; inset: -40%; pointer-events: none; opacity: var(--sheen, .12); mix-blend-mode: screen;
        background: linear-gradient(var(--sa, 115deg), transparent 40%, rgba(255,214,170,.55) 46%, rgba(255,170,230,.5) 49%, rgba(170,200,255,.5) 52%, rgba(170,255,225,.45) 55%, transparent 61%);
        transform: translateX(var(--sx, -30%)); }
      #dn-m3p .bar { display: flex; align-items: center; gap: 1.6vmin; padding: 1.4vmin 2.4vmin; border-bottom: 1px solid rgba(255,255,255,.08); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      #dn-m3p .mk { font-weight: 800; letter-spacing: .14em; font-size: 2.2vmin; background: linear-gradient(90deg, #ffd6a0, #ffb0e0, #b8c8ff, #a8f0e0); -webkit-background-clip: text; background-clip: text; color: transparent; }
      #dn-m3p .ttl { font-size: 1.9vmin; letter-spacing: .16em; text-transform: uppercase; opacity: .7; }
      #dn-m3p .sw { margin-left: auto; width: 1.2vmin; height: 1.2vmin; border-radius: 50%; background: #d4aa52; box-shadow: 0 0 1.2vmin #d4aa52; }
      #dn-m3p .scr { position: absolute; left: 0; right: 0; top: 5.4vmin; bottom: 0; padding: 2.2vmin 3vmin; }
      #dn-m3p .k { font: 600 1.9vmin/1.2 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: .18em; text-transform: uppercase; opacity: .62; }
      #dn-m3p .big { font-weight: 700; font-size: 9vmin; line-height: 1; margin: 1vmin 0 .6vmin; }
      #dn-m3p .mid { font-size: 3.4vmin; line-height: 1.25; }
      #dn-m3p .sm { font-size: 2.2vmin; line-height: 1.35; opacity: .72; }
      #dn-m3p .gold { color: #d4aa52; } #dn-m3p .blue { color: #8aa2ff; } #dn-m3p .grey { color: #aab0bd; } #dn-m3p .fire { color: #ff8a4a; }
      #dn-m3p .row { display: grid; grid-template-columns: 5vmin 1fr; gap: 1.6vmin; align-items: start; padding: 1.1vmin 0; border-top: 1px solid rgba(255,255,255,.06); opacity: .5; }
      #dn-m3p .row.on { opacity: 1; } #dn-m3p .row .g { font-size: 3.6vmin; line-height: 1; text-align: center; }
      #dn-m3p .row .h { font-size: 3vmin; } #dn-m3p .row .d { font-size: 2.1vmin; opacity: .75; margin-top: .3vmin; }
      #dn-m3p svg { display: block; width: 100%; }
      #dn-m3p .proj { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 4vmin; font-size: 3.6vmin; line-height: 1.25; }
      #dn-m3p.low .bar { display: none; } #dn-m3p.low .scr { top: 0; }
      #dn-m3p .ctl { margin-left: auto; display: flex; gap: 1vmin; pointer-events: auto; }
      #dn-m3p .ctl button { pointer-events: auto; cursor: pointer; font: 600 2vmin 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #ece6da; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); border-radius: 1.6vmin; padding: .7vmin 1.5vmin; letter-spacing: .04em; }
      #dn-m3p .ctl button[data-c="play"] { min-width: 6vmin; background: rgba(212,170,82,.9); color: #0a0e1c; border: 0; }
      #dn-m3p .ctl .rd { letter-spacing: .14em; }
      #dn-m3p.pill .scr { display: none; } #dn-m3p.pill .ttl { display: none; } #dn-m3p.pill .bar { border-bottom: 0; height: 100%; }
      #dn-m3p.low .ctl { display: none; }
      body.dream-news.m3p-ep #dn-ctl { display: none !important; }
      /* the device (11-07) */
      #dn-m3p .glass { background: linear-gradient(180deg, #2b2f3a 0%, #171a22 55%, #0e1016 100%); border-radius: 2.4vmin; backdrop-filter: none; -webkit-backdrop-filter: none;
        box-shadow: 0 2.6vmin 7vmin rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.2), inset 0 -1px 0 rgba(0,0,0,.7); }
      #dn-m3p .screen { position: absolute; left: 1.3vmin; right: 1.3vmin; top: 1.3vmin; bottom: 6.4vmin; border-radius: 1.3vmin; overflow: hidden;
        background: radial-gradient(120% 95% at 50% 38%, #142042 0%, #0b1124 58%, #060914 100%); box-shadow: inset 0 0 0 1px rgba(0,0,0,.85), inset 0 0 3.2vmin rgba(0,0,0,.6); }
      #dn-m3p .screen::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,.028) 0 1px, transparent 1px 3px); }
      #dn-m3p .refl { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(155deg, rgba(255,255,255,.11) 0%, rgba(255,255,255,.035) 26%, transparent 40%); }
      #dn-m3p .bar { padding: 1.1vmin 2.2vmin; gap: 1.2vmin; border-bottom: 1px solid rgba(255,255,255,.07); }
      #dn-m3p .ttl { font-size: 1.9vmin; }
      #dn-m3p .scr { top: 4.6vmin; display: flex; flex-direction: column; justify-content: center; padding: 1.4vmin 3.2vmin 2vmin; }
      #dn-m3p .chin { position: absolute; left: 0; right: 0; bottom: 0; height: 6.4vmin; display: flex; align-items: center; gap: 1.2vmin; padding: 0 2.6vmin; }
      #dn-m3p .chin .mk { font-size: 2.5vmin; }
      #dn-m3p .led { width: 1vmin; height: 1vmin; border-radius: 50%; background: #8dffc0; box-shadow: 0 0 1.4vmin #5dff9e; opacity: .85; }
      #dn-m3p .ctl button { background: linear-gradient(180deg, #3d4250, #23262f); border: 1px solid #090a0e; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 .3vmin .6vmin rgba(0,0,0,.5); border-radius: 1vmin; font-size: 1.9vmin; color: #ebe6dc; padding: .8vmin 1.6vmin; }
      #dn-m3p .ctl button[data-c="play"] { background: linear-gradient(180deg, #e6c06a, #b8913f); color: #0a0e1c; border: 1px solid #5e4a1e; }
      #dn-m3p.pill .screen { display: none; } #dn-m3p.pill .chin { height: 100%; }
      #dn-m3p.low .chin { display: none; } #dn-m3p.low .screen { inset: .9vmin; } #dn-m3p.low .scr { top: 0; padding: 0; }
      /* bigger type, so the screen is filled and reads on a phone */
      #dn-m3p .k { font-size: 2.05vmin; } #dn-m3p .mid { font-size: 3.7vmin; } #dn-m3p .sm { font-size: 2.35vmin; } #dn-m3p .big { font-size: 10.5vmin; }
      #dn-m3p .row { padding: 1.5vmin 0; grid-template-columns: 5.6vmin 1fr; } #dn-m3p .row .g { font-size: 4.2vmin; } #dn-m3p .row .h { font-size: 3.6vmin; } #dn-m3p .row .d { font-size: 2.35vmin; }
      /* the chyron, in an M3P episode: a slim label riding the top edge of the device; the show's long name stays on the bug */
      body.dream-news.m3p-ep #dn-chyron { right: auto; grid-template-columns: auto 1fr; border-radius: 1.2vmin 1.2vmin 0 0; overflow: hidden; box-shadow: 0 1vmin 3vmin rgba(0,0,0,.45); }
      body.dream-news.m3p-ep #dn-chyron .tag { font-size: 1.75vmin; padding: 0 1.8vmin; letter-spacing: .2em; }
      body.dream-news.m3p-ep #dn-chyron .text { border-top: 0; padding: 1.1vmin 2vmin 1.2vmin; background: rgba(10,13,22,.88); }
      body.dream-news.m3p-ep #dn-chyron .h { font-size: 3.5vmin; }
      body.dream-news.m3p-ep #dn-chyron .s { display: none; }
      body.dream-news.m3p-ep #dn-clock { display: none; }
      body.dream-news.m3p-ep #dn-bug { top: 2.6vh; gap: 1.4vmin; }
      body.dream-news.m3p-ep #dn-bug .mark { width: 3vmin; height: 3vmin; min-width: 0; min-height: 0; }
      body.dream-news.m3p-ep #dn-bug .name { font-size: 2.3vmin; }
      body.dream-news.m3p-ep #dn-bug .live { font-size: 1.6vmin; }
    `;
    // 11-07: the M3P's type is sized off the device's own docked size (--u), not the window, so it fits the screen in a
    // desktop preview window as well as on a phone
    m3pCSS.textContent = m3pCSS.textContent.replace(/(#dn-m3p[^{]*\{[^}]*\})/g, rule => rule.replace(/([\d.]+)vmin/g, 'calc(var(--u, 1vmin) * $1)'));
    document.head.appendChild(m3pCSS); (document.getElementById('dn') || document.body).appendChild(m3pEl);
    if (M3P_ON) { m3pCSS.textContent += ' body.dream-news.m3p-ep #dn-ticker { display: none !important; }'; document.body.classList.add('m3p-ep'); }   // the glass carries what the tape did
    const m3pGlass = m3pEl.querySelector('.glass'), m3pScr = m3pEl.querySelector('.scr'), m3pTtl = m3pEl.querySelector('.ttl');
    // where it sits, as fractions of the frame (x, y, w, h)
    const M3P_AT = WIDE
      ? { dock: [0.555, 0.13, 0.41, 0.66], low: [0.58, 0.72, 0.37, 0.13], full: [0.08, 0.10, 0.84, 0.72], off: [0.555, 1.12, 0.41, 0.66], pill: [0.36, 0.885, 0.28, 0.07] }
      : { dock: [0.04, 0.575, 0.92, 0.355], low: [0.07, 0.80, 0.86, 0.10], full: [0.04, 0.14, 0.92, 0.76], off: [0.04, 1.10, 0.92, 0.355], pill: [0.1, 0.905, 0.8, 0.06] };
    // a beat's value for a field, carried forward from the last beat that set it
    const carry = (key, b, dflt) => { let v = dflt; for (const x of beats) { if (x.start != null && b && x.start > b.start) break; if (x[key] !== undefined) v = x[key]; if (x === b) break; } return v; };
    const prevBeat = b => { const i = beats.indexOf(b); return i > 0 ? beats[i - 1] : null; };
    const _gs = new THREE.Vector3();
    function globeOnScreen() {
      if (typeof trackerGlobe === 'undefined') return [0.5, 0.3];
      trackerGlobe.getWorldPosition(_gs); _gs.project(camera); return [(_gs.x + 1) / 2, (1 - _gs.y) / 2];
    }
    // ── the screens, drawn from the tracker's own computation (index.html: trackerData), so they are never a month stale
    const m3pPct = x => Math.round(x * 100) + '%';
    const m3pMon = p => (typeof trackerMonthName === 'function') ? trackerMonthName(p, true).replace(' 20', " '") : p;
    function spark(vals, color, lo, hi, marks) {
      const W = 600, H = 150, n = vals.length, pts = vals.map((v, i) => [12 + (W - 24) * i / Math.max(1, n - 1), H - 14 - (H - 28) * (v - lo) / (hi - lo)]);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const dots = (marks || []).map(([i, lab, below]) => `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="7" fill="${color}"/><text x="${pts[i][0]}" y="${pts[i][1] + (below ? 34 : -14)}" fill="${color}" font-size="26" font-family="Georgia" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${lab}</text>`).join('');
      return `<svg viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round"/>${dots}</svg>`;
    }
    function m3pScreen(name, b) {
      const T = (typeof trackerData !== 'undefined') ? trackerData : null, D = (typeof g4ActiveData !== 'undefined' && g4ActiveData) || {};
      const hi = carry('m3pHi', b, -1);
      const rows = (list) => list.map((r, i) => `<div class="row ${hi < 0 || hi === i ? 'on' : ''}"><div class="g ${r[3] || ''}">${r[0]}</div><div><div class="h">${r[1]}</div><div class="d">${r[2]}</div></div></div>`).join('');
      if (name === 'intro') return ['Terminal station', `<div class="k">Mark III Prism</div><div class="big" style="font-size:12vmin;letter-spacing:.06em">M3P</div><div class="mid">runs <b>Prism</b></div><div class="sm">Pacifica Dialectics</div>
        <svg viewBox="0 0 600 120" style="margin-top:2vmin"><polygon points="250,105 300,15 350,105" fill="none" stroke="#f3efe6" stroke-width="3"/><line x1="40" y1="70" x2="285" y2="62" stroke="#f3efe6" stroke-width="3"/>
        ${['#ff6a5a', '#ffb13d', '#ffe46a', '#6fe08a', '#6fa8ff', '#a77bff'].map((c, i) => `<line x1="318" y1="62" x2="590" y2="${30 + i * 13}" stroke="${c}" stroke-width="4"/>`).join('')}</svg>`];
      if (name === 'signals') return ['What it takes in', rows([
        ['⟶', 'Where the oil went', 'official customs, every border, month by month', 'gold'],
        ['✦', 'What got hit', 'strikes, seizures, sanctions — the day it happened, the day we heard', 'fire'],
        ['$', 'What it cost', 'the price — the shadow, kept last', 'grey'],
        ['❝', 'What people said', 'statements, filed as claims the world can check', 'blue']])];
      if (name === 'needle' && T) {
        const full = T.months.filter(m => m.dollarShare != null && m.panelPresent.length === 5), v = trackerVerdict(T);
        const vals = full.map(m => m.dollarShare), lowI = vals.indexOf(Math.min(...vals));
        return ['Sold in dollars', `<div class="k">the needle · five big buyers</div><div class="big gold">${v.word}</div>
          <div class="mid">${m3pPct(T.ago.dollarShare)} in ${m3pMon(T.ago.period)} → ${m3pPct(T.now.dollarShare)} in ${m3pMon(T.now.period)}</div>
          ${spark(vals, '#d4aa52', 0.6, 1.0, [[0, m3pPct(vals[0])], [lowI, m3pPct(vals[lowI]), true], [vals.length - 1, m3pPct(vals[vals.length - 1])]])}
          <div class="sm">${m3pPct(T.now.namedShare)} of what moved can be named · about half of that is dollars by industry default</div>`];
      }
      if (name === 'america' && T) {
        const full = T.months.filter(m => m.panelPresent.length === 5), g = full.map(m => m.us.gulfShare), h = full.map(m => m.us.hemiShare);
        const z = g.indexOf(Math.min(...g)), last = g.length - 1;
        return ["America's barrel", `<div class="k">where US imports came from</div><div class="big gold" style="font-size:7vmin">The Gulf: ${m3pPct(g[0])} → ${m3pPct(g[z])} → ${m3pPct(g[last])}</div>
          ${spark(h, '#d4aa52', 0.0, 1.0, [[0, m3pPct(h[0])], [z, m3pPct(h[z])], [last, m3pPct(h[last])]])}
          ${spark(g, '#b07a2e', 0.0, 1.0, [[z, '0'], [last, m3pPct(g[last])]])}
          <div class="sm">solid: this hemisphere · dashed gold: the Persian Gulf · every barrel paid in dollars</div>`];
      }
      if (name === 'russia' && T) {
        const full = T.months.filter(m => m.panelPresent.length === 5);
        const ri = full.map(m => m.edges.filter(e => e.from === 'Russia' && e.to === 'India' && !e.uncounted).reduce((a, e) => a + e.kt, 0) / 4.08 / 1000);
        const top = ri.indexOf(Math.max(...ri)), last = ri.length - 1;
        return ['The biggest blue line', `<div class="k">Russia → India · rupees, dirhams, yuan</div><div class="big blue">${ri[top].toFixed(1)}M</div><div class="mid">barrels a day at the peak, ${m3pMon(full[top].period)}</div>
          ${spark(ri, '#8aa2ff', 0, Math.max(...ri) * 1.15, [[0, ri[0].toFixed(1) + 'M'], [top, ri[top].toFixed(1) + 'M'], [last, ri[last].toFixed(1) + 'M', true]])}
          <div class="sm">India's own customs count · crude and products</div>`];
      }
      if (name === 'strikes') {
        const L = ((D.strikes && D.strikes.rows) || []).slice().sort((a, b2) => b2.asOf.localeCompare(a.asOf)).slice(0, 5);
        return ['What got hit', rows(L.map(r => ['✦', `${r.short} · ${m3pMon(r.asOf.slice(0, 7)).split(' ')[0]} ${+r.asOf.slice(8, 10)}`,
          `${r.status}${r.firms ? (/flag/.test(r.firms) ? ' · seen from orbit' : / not seen/.test(' ' + r.firms) ? ' · not seen from orbit' : '') : ''} · ${r.source.split(/[;,(]/)[0]}`, 'fire']))];
      }
      if (name === 'shadow') {
        const s = D.price && D.price.series && D.price.series.RBRTE ? D.price.series.RBRTE.points.filter(p => p[0] >= '2025-10') : [];
        if (!s.length) return ['The shadow', ''];
        const v = s.map(p => p[1]);
        return ['The shadow', `<div class="k">Brent, a barrel</div><div class="big grey">$${Math.round(v[v.length - 1])}</div><div class="mid">what everyone shouts about — kept last</div>${spark(v, '#aab0bd', 40, 140, [[0, '$' + Math.round(v[0])], [v.length - 1, '$' + Math.round(v[v.length - 1])]])}`];
      }
      if (name === 'diesel') {
        const R = D.recent || {}, dr = R.dieselRetail && R.dieselRetail.series && R.dieselRetail.series.EMD_EPD2D_PTE_NUS_DPG ? R.dieselRetail.series.EMD_EPD2D_PTE_NUS_DPG.points : [];
        const at = d => { let x = null; dr.forEach(p => { if (p[0] <= d) x = p; }); return x; };
        const was = at('2026-10-12'), now = dr[dr.length - 1];
        return ['A claim, filed', `<div class="k">Oct 11 · the president</div><div class="mid">“Russia will immediately supply 300,000 tons…”</div>
          <div class="row on"><div class="g gold">⟶</div><div><div class="h">Diesel imports</div><div class="d">flat since August — no jump</div></div></div>
          <div class="row on"><div class="g grey">$</div><div><div class="h">${was ? '$' + was[1].toFixed(2) : '—'} → ${now ? '$' + now[1].toFixed(2) : '—'}</div><div class="d">diesel at the pump, the week he said it → the latest</div></div></div>
          <div class="sm">the test runs to the end of November</div>`];
      }
      if (name === 'bet') return ['On the record', `<div class="k">Oct 2 · Sailor's bet</div><div class="mid">The shock doesn't loosen the dollar's grip on America's oil. It re-routes the oil toward it.</div>
        <div class="row on"><div class="g fire">?</div><div><div class="h">How it could be wrong</div><div class="d">the Gulf barrel comes back before this hemisphere locks in</div></div></div><div class="sm">August: the Gulf came back. The ruling is owed.</div>`];
      return ['', ''];
    }
    const ease3m = u => u * u * (3 - 2 * u);
    const backOut = u => { const c = 1.35; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
    let m3pKey = '';
    function m3pFrame(t, b) {
      if (!M3P_ON) { m3pEl.style.display = 'none'; return; }
      if (!b) { if (CAPTURE) { m3pEl.style.display = 'none'; return; } b = beats[0]; }   // before the first beat a live page still shows its controls
      const live = (p) => (!CAPTURE && p === 'off') ? 'pill' : p;   // on a live page the M3P never leaves: it folds to its controls
      const place = live(carry('m3p', b, 'off')), was = live((() => { const p = prevBeat(b); return p ? carry('m3p', p, 'off') : 'off'; })());
      const W_ = window.innerWidth, H_ = window.innerHeight;
      let A = (M3P_AT[was] || M3P_AT.off).slice(), B = (M3P_AT[place] || M3P_AT.off).slice();
      if (was === 'off' && place !== 'off') { const [gx, gy] = globeOnScreen(); A = [gx - 0.06, gy - 0.03, 0.12, 0.07]; }   // it comes out of the globe
      const D = 1.3, u = Math.max(0, Math.min(1, (t - b.start) / D)), e = place === was ? 1 : backOut(u), v = place === was ? 0 : Math.max(0, 1 - Math.abs(2 * u - 1)) * (1 - u * 0.3);
      const r = A.map((a, i) => a + (B[i] - a) * e);
      if (place === 'off' && u >= 1) { m3pEl.style.display = 'none'; document.body.classList.remove('m3p-dock'); return; }
      m3pEl.style.display = 'block';
      { const DK = M3P_AT.dock; m3pEl.style.setProperty('--u', Math.min(DK[3] * H_ / 63, DK[2] * W_ / 92).toFixed(2) + 'px'); }
      m3pEl.style.left = (r[0] * W_) + 'px'; m3pEl.style.top = (r[1] * H_) + 'px'; m3pEl.style.width = (r[2] * W_) + 'px'; m3pEl.style.height = (r[3] * H_) + 'px';
      // the lag: it tilts into its own motion, and idles with a slow float
      const dy = B[1] - A[1], dx = B[0] - A[0], sgn = Math.sign(dy || 1);
      const rx = -sgn * 16 * v + Math.sin(t * 0.37) * 1.6, ry = Math.sign(dx || 0.0001) * 12 * v + Math.sin(t * 0.29 + 1) * 2.2 + (was === 'off' && place !== 'off' ? 55 * (1 - ease3m(u)) : 0), rz = Math.sin(t * 0.43) * 0.5;
      m3pGlass.style.transform = `translateY(${(Math.sin(t * 0.7) * 0.5).toFixed(2)}vh) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      m3pGlass.style.opacity = (was === 'off' && place !== 'off') ? Math.min(1, u * 2.2).toFixed(3) : (place === 'off' ? (1 - u).toFixed(3) : '1');
      // the light: the rim's colours turn, faster and brighter while it moves; a sheen crosses with the motion
      m3pGlass.style.setProperty('--a', ((t * 22 + v * 140) % 360).toFixed(1) + 'deg');
      m3pGlass.style.setProperty('--rim', (0.38 + 0.55 * v).toFixed(3));
      m3pGlass.style.setProperty('--sheen', (0.08 + 0.55 * v).toFixed(3));
      m3pGlass.style.setProperty('--sx', (-45 + 90 * (place === was ? (0.5 + 0.5 * Math.sin(t * 0.21)) : u)).toFixed(1) + '%');
      m3pGlass.style.setProperty('--sa', (105 + rx * 1.5).toFixed(1) + 'deg');
      // what it shows
      m3pEl.classList.toggle('low', place === 'low'); m3pEl.classList.toggle('pill', place === 'pill');
      if (!CAPTURE && window.__ctl) { const pb = m3pEl.querySelector('[data-c="play"]'); const s = window.__ctl.playing() ? '❚❚' : '▶'; if (pb && pb.textContent !== s) pb.textContent = s; }
      const scr = carry('m3pScreen', b, 'intro'), text = b.m3pText || (place === 'low' ? carry('m3pText', b, '') : '');
      const key = place + '|' + scr + '|' + text + '|' + carry('m3pHi', b, -1);
      if (key !== m3pKey) { m3pKey = key;
        if (place === 'low') { m3pTtl.textContent = ''; m3pScr.innerHTML = `<div class="proj"><span>${text || ''}</span></div>`; }
        else { const [ttl, html] = m3pScreen(scr, b); m3pTtl.textContent = ttl; m3pScr.innerHTML = html; } }
      // the show's words make room: the chyron and the subtitles sit above the glass while it is docked
      document.body.classList.toggle('m3p-dock', place === 'dock' || place === 'full');
      const topV = r[1] * 100;
      const ch = $('dn-chyron'), sub = $('dn-sub');
      if (!WIDE) {   // 9:16: the label sits on the device's top edge, the same width; the words above it
        const A = (place === 'off') ? [0.04, 0.95, 0.92] : r;
        ch.style.left = (A[0] * 100) + 'vw'; ch.style.width = (A[2] * 100) + 'vw'; ch.style.bottom = (100 - A[1] * 100 - 0.2) + 'vh';
        sub.style.bottom = (100 - A[1] * 100 + 8.5) + 'vh';
      } else { ch.style.left = ''; ch.style.width = ''; ch.style.bottom = ''; sub.style.bottom = ''; }
      try { if (typeof trackerCard !== 'undefined' && trackerCard.visible) trackerCard.visible = false; } catch (e) {}   // the M3P carries the tracker's readout
    }
    // ── THE TWO READINGS (2026-11-06, Sailor: "if the user wanted to click into glass mode, the entire content we are
    //    presenting would reconfigure into an article of the show… this should apply to anything we put on Parallelogram").
    //    One file, two readings. The show: Ted speaks it, the camera moves, the M3P floats. The article: the same beats as
    //    copy, block titles as section heads, the M3P's screens as figures, and the globe held in the top of the frame,
    //    going where each section points as you scroll (a scrubber under it). Scroll position is show time, both ways.
    //    The article reads only the CONTENT fields of a beat — text (or `read`, a written override), caption, the block's
    //    title, m3pScreen / m3pText / m3pHi, globeFocus, globeMonth — and ignores the STAGING fields (tedWalk, tedFrame,
    //    ted, m3p placement, globeTurn). Format spec: Specs/Parallelogram_Report_Format_and_Style_v1.md §5.
    const ART = { on: false, built: false, active: -1, lock: 0 };
    const artCSS = document.createElement('style');
    artCSS.textContent = `
      #dn-art, #dn-artbar { display: none; pointer-events: auto; }
      body.dn-article { cursor: auto; }
      body.dn-article #dn > :not(#dn-art):not(#dn-artbar) { display: none !important; }
      body.dn-article #dn-ctl { display: none !important; }
      body.dn-article #dn-art { display: block; position: fixed; left: 0; right: 0; top: calc(44vh + 64px); bottom: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
        background: #0a0e1c; color: #ece6da; font-family: Georgia, 'Times New Roman', serif; scroll-behavior: auto; }
      body.dn-article #dn-artbar { display: flex; position: fixed; left: 0; right: 0; top: 44vh; height: 64px; align-items: center; gap: 10px; padding: 0 14px;
        background: linear-gradient(180deg, rgba(10,14,28,.92), #0a0e1c); border-top: 1px solid rgba(255,255,255,.12); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #ece6da; }
      #dn-artbar::before { content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 2px; background: linear-gradient(90deg, #ffd6a0, #ffb0e0, #b8c8ff, #a8f0e0, #fff2b0); opacity: .7; }
      #dn-artbar .mk { font-weight: 800; letter-spacing: .14em; font-size: 13px; background: linear-gradient(90deg, #ffd6a0, #ffb0e0, #b8c8ff, #a8f0e0); -webkit-background-clip: text; background-clip: text; color: transparent; }
      #dn-artbar input { flex: 1; -webkit-appearance: none; appearance: none; height: 2px; background: #3a3f55; outline: none; }
      #dn-artbar input::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #d4aa52; border: 1px solid #6b5a2e; }
      #dn-artbar input::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #d4aa52; border: 1px solid #6b5a2e; }
      #dn-artbar button { font: 600 12px 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: .08em; color: #0a0e1c; background: #d4aa52; border: 0; border-radius: 14px; padding: 7px 12px; cursor: pointer; white-space: nowrap; }
      #dn-artbar .when { font-size: 11px; letter-spacing: .1em; opacity: .6; font-variant-numeric: tabular-nums; min-width: 34px; }
      #dn-art article { max-width: 680px; margin: 0 auto; padding: 22px 20px 40vh; }
      #dn-art .kick { font: 600 11px 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #d4aa52; }
      #dn-art h1 { font-weight: normal; font-size: clamp(28px, 7vw, 44px); line-height: 1.08; margin: 8px 0 6px; }
      #dn-art .dek { font-style: italic; opacity: .7; font-size: 16px; line-height: 1.45; }
      #dn-art .by { font: 11px 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: .08em; opacity: .5; margin-top: 10px; }
      #dn-art h2 { font: 600 12px 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #d4aa52; margin: 40px 0 6px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.08); }
      #dn-art p.b { font-size: 19px; line-height: 1.6; margin: 0 0 14px; opacity: .5; transition: opacity .3s; }
      #dn-art p.b.on { opacity: 1; }
      #dn-art .strip { margin: 6px 0 18px; padding: 12px 14px; border-left: 2px solid #d4aa52; font-size: 17px; line-height: 1.45; background: rgba(255,255,255,.03); }
      #dn-art .m3pfig { position: relative; margin: 8px 0 22px; border-radius: 10px; overflow: hidden; background: linear-gradient(160deg, rgba(14,20,40,.9), rgba(6,9,20,.95)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); font-size: 0; }
      #dn-art .m3pfig::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 2px; pointer-events: none; opacity: .5;
        background: conic-gradient(from 210deg, #ffd6a0, #ffb0e0, #b8c8ff, #a8f0e0, #fff2b0, #ffd6a0); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
      #dn-art .m3pfig .scr { position: relative; padding: 14px 16px 16px; }
      #dn-art .m3pfig { --u: 6.8px; }
    `;
    // the M3P's own screen styles, re-scoped to the figures (the screens are the same functions in both readings), at
    // article sizes: vmin on the show (it scales with the frame), fixed on the page (it scales with the column)
    artCSS.textContent += m3pCSS.textContent.split('}').filter(r => /#dn-m3p \.(k|big|mid|sm|gold|blue|grey|fire|row|svg|bar|mk|ttl|sw)\b|#dn-m3p svg/.test(r))
      .map(r => r.replace(/#dn-m3p/g, '#dn-art .m3pfig').replace(/([\d.]+)vmin/g, (m, n) => Math.round(parseFloat(n) * 6.8) + 'px') + '}').join('\n')
      + '\n#dn-art .m3pfig .bar { display: flex; position: relative; } ';
    document.head.appendChild(artCSS);
    const artEl = document.createElement('div'); artEl.id = 'dn-art';
    const artBar = document.createElement('div'); artBar.id = 'dn-artbar';
    artBar.innerHTML = '<span class="mk">M3P</span><span class="when">0:00</span><input type="range" min="0" max="1000" value="0"><button title="back to the show">▶ WATCH</button>';
    (document.getElementById('dn') || document.body).appendChild(artEl); (document.getElementById('dn') || document.body).appendChild(artBar);
    const fmtA = x => { x = Math.max(0, x); return Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0'); };
    const artBeats = beats.filter(b => b.type === 'text');
    function artBuild() {
      if (ART.built) return; ART.built = true;
      let html = `<article><div class="kick">The Parallelogram Report${EP.kicker ? ' · ' + EP.kicker : ''}</div><h1>${(EP.headline || EP.title || '').replace(/^Explainer · /, '')}</h1>`
        + (EP.dek ? `<div class="dek">${EP.dek}</div>` : '') + `<div class="by">Ted Turner · a sonnetbot of Sailor's · read with the M3P</div>`;
      let lastBlock = null, lastFig = '', lastStrip = '';
      artBeats.forEach((b, i) => {
        if (b.block !== lastBlock) { lastBlock = b.block; html += `<h2>${b.block.title || ''}</h2>`; }
        html += `<p class="b" data-i="${i}">${b.read || b.text}</p>`;
        const place = carry('m3p', b, 'off'), scr = carry('m3pScreen', b, null);
        if (place === 'low' && b.m3pText && b.m3pText !== lastStrip) { lastStrip = b.m3pText; html += `<div class="strip">${b.m3pText}</div>`; }
        const fk = scr ? scr + '|' + carry('m3pHi', b, -1) : '';
        if (place !== 'off' && place !== 'low' && scr && fk !== lastFig) { lastFig = fk;
          const [ttl, body] = m3pScreen(scr, b); html += `<div class="m3pfig"><div class="bar"><span class="mk">M3P</span><span class="ttl">${ttl}</span><span class="sw"></span></div><div class="scr">${body}</div></div>`; }
      });
      artEl.innerHTML = html + '</article>';
      // the reading line: whichever paragraph crosses a third of the way down the copy is "now"
      artEl.addEventListener('scroll', () => { if (performance.now() < ART.lock) return; artSync(); }, { passive: true });
      const sl = artBar.querySelector('input');
      sl.addEventListener('input', () => { const t = DURATION * sl.value / 1000; let k = 0; artBeats.forEach((b, i) => { if (t >= b.start) k = i; });
        ART.lock = performance.now() + 400; const p = artEl.querySelector(`p.b[data-i="${k}"]`); if (p) artEl.scrollTop = p.offsetTop - artEl.clientHeight * 0.3; artSet(k, t); });
      artBar.querySelector('button').onclick = () => artClose();
    }
    function artSet(k, t) {
      ART.active = k;
      artEl.querySelectorAll('p.b').forEach(p => p.classList.toggle('on', +p.dataset.i === k));
      const tt = t != null ? t : artBeats[k].start + 0.05;
      artBar.querySelector('.when').textContent = fmtA(tt);
      artBar.querySelector('input').value = Math.round(1000 * tt / DURATION);
      if (window.__ctl) window.__ctl.go(tt); else seek(tt);
    }
    function artSync() {
      const line = artEl.scrollTop + artEl.clientHeight * 0.33; let k = 0;
      artEl.querySelectorAll('p.b').forEach(p => { if (p.offsetTop <= line) k = +p.dataset.i; });
      if (k !== ART.active) artSet(k);
    }
    function artOpen() {
      if (window.__ctl) window.__ctl.pause();
      artBuild(); ART.on = true; document.body.classList.add('dn-article');
      if (rig) tedHolder.visible = false;
      const t = window.__ctl ? window.__ctl.now() : showT; let k = 0; artBeats.forEach((b, i) => { if (t >= b.start) k = i; });
      requestAnimationFrame(() => { ART.lock = performance.now() + 400; const p = artEl.querySelector(`p.b[data-i="${k}"]`); if (p) artEl.scrollTop = p.offsetTop - artEl.clientHeight * 0.3; artSet(k); });
    }
    function artClose() { ART.on = false; document.body.classList.remove('dn-article'); if (rig) tedHolder.visible = true; if (window.__ctl) window.__ctl.go(artBeats[Math.max(0, ART.active)].start + 0.001); }
    // the article's camera: the globe alone, in the top of the frame — on the place a section points at, or whole
    const _ao = new THREE.Vector3();
    function articleCamera(t) {
      const H = (d) => 2 * d * Math.tan((camera.fov || 36) / 2 * Math.PI / 180);
      const f = carry('globeFocus', cur, null);
      if (f && typeof trackerLatLon === 'function') {
        const R = (typeof TRACKER_R !== 'undefined') ? TRACKER_R : 1.15, d = (f[2] || 2.0) * (WIDE ? 1.2 : 1.7);
        trackerGlobe.updateMatrixWorld(true); _fP.copy(trackerLatLon(f[0], f[1], R)); trackerSpin.localToWorld(_fP); trackerGlobe.getWorldPosition(_fC);
        _fN.copy(_fP).sub(_fC).normalize(); camFrom.copy(_fP).addScaledVector(_fN, d); camFrom.y += 0.15 * d; camAt.copy(_fP); camAt.y -= 0.28 * H(d);
      } else {
        trackerGlobe.getWorldPosition(_fC); _ao.copy(walkPath ? walkPath.out : toDesk);
        const d = WIDE ? 6.5 : 9.0; camFrom.copy(_fC).addScaledVector(_ao, d); camFrom.y += 0.6; camAt.copy(_fC); camAt.y -= 0.28 * H(d);
      }
    }
    function stillFrame(t, b) {
      const st = epv(b, 'still'); const cap = epv(b, 'stillCaption');
      if (!st) { stillEl.style.opacity = '0'; setTimeout(() => { if (stillEl.style.opacity === '0') stillEl.style.display = 'none'; }, 380); return; }
      const img = stillEl.querySelector('img'); const src = '../data/show/' + ID + '/stills/' + st + '.jpg';
      if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; stillEl.querySelector('.c').textContent = cap || ''; }
      stillEl.style.display = 'flex'; requestAnimationFrame(() => { stillEl.style.opacity = '1'; });
    }
    // the cue times for `map.cue`: each [pinId, word] matched in order against the beat's spoken words
    function cueTimes(b) {
      const m = (b && b.map) || {}; if (!Array.isArray(m.cue) || !b.words) return null;
      if (b._cueT) return b._cueT; const out = {}; const nw = x => String(x).toLowerCase().replace(/[^a-z0-9']/g, '');
      let from = 0; m.cue.forEach(([pid, word]) => { const k = b.words.findIndex((w, i) => i >= from && nw(w.w).startsWith(nw(word))); if (k >= 0) { out[pid] = b.words[k].s - 0.05; from = k + 1; } });
      return (b._cueT = out);
    }
    function pinsFrame(t, b) {
      const m = (b && b.map) || {};
      // put any gathered line dots back home first, so the rest of the show never sees them moved
      Object.keys(lineHome).forEach(i => { const d = dotMesh[i]; if (d) d.position.copy(lineHome[i]); delete lineHome[i]; });
      if (!m.pins) { PINS.forEach(P => { P.mesh.visible = P.lb.visible = P.stem.visible = false; }); return; }
      const u = Math.max(0, Math.min(1, (t - b.start - 0.8) / 2.6)), g_ = ease3(u);
      const prev = beats[beats.indexOf(b) - 1], wasFlat = !!(prev && prev.map && prev.map.flat);
      const fu = Math.max(0, Math.min(1, (t - b.start) / 0.9));
      PINS.forEach(P => {
        let zNow = P.pos.z;
        if (m.flat) zNow = wasFlat ? 0 : P.pos.z * (1 - easeBack(fu));            // down to the plane, a little bounce
        else if (wasFlat) zNow = P.pos.z * easeBack(fu);                            // and back up to its z
        const gathering = m.pins === 'gather' && u < 1;
        P.lines.forEach(i => { const d = dotMesh[i]; if (!d) return;
          if (gathering) { lineHome[i] = d.position.clone(); d.position.lerpVectors(lineHome[i], new THREE.Vector3(P.pos.x, P.pos.y, zNow), g_); g.setDotVisible(i, true); }
          else g.setDotVisible(i, false); });
        const only = Array.isArray(m.pins) ? m.pins : null;   // ep 1.1: `map.pins: [ids]` shows just those pins
        const show = (!gathering || u > 0.85) && (!only || only.includes(P.pid));
        P.mesh.visible = show; P.lb.visible = show && (m.pinLabels === 'all' || (Array.isArray(m.pinLabels) && m.pinLabels.includes(P.pid))); P.stem.visible = show && Math.abs(zNow) > 0.02;
        P.mesh.position.set(P.pos.x, P.pos.y, zNow); P.mesh.scale.setScalar(m.pins === 'gather' ? 0.4 + 0.6 * ease3(Math.max(0, (u - 0.7) / 0.3)) : 1);
        // the glow (10-28): named pins (`map.glow: [pieceIds]`, or the labelled ones) pulse and swell; the rest sit quiet
        const named = Array.isArray(m.glow) ? m.glow.includes(P.pid) : (Array.isArray(m.pinLabels) && m.pinLabels.includes(P.pid));
        const anyNamed = Array.isArray(m.glow) ? m.glow.length > 0 : Array.isArray(m.pinLabels) && m.pinLabels.length > 0;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + P.pos.x * 7);
        P.mesh.material.emissiveIntensity = named ? 0.9 + 0.9 * pulse : anyNamed ? 0.3 : 0.55;
        if (named) P.mesh.scale.multiplyScalar(1.25 + 0.2 * pulse);
        P.mesh.material.transparent = anyNamed && !named; P.mesh.material.opacity = (anyNamed && !named) ? 0.5 : 1;
        // ep 1.1 (11-03, Sailor: "have them light up and pulse as he mentions each one"): `map.cue: [[pinId, word], …]` —
        // each pin waits dim until Ted says its word (the beat's own word timings), then flashes and keeps a pulse
        const cueT = cueTimes(b);
        if (cueT) { const tc = cueT[P.pid], on = tc != null && t >= tc, fl = on ? Math.exp(-(t - tc) / 0.45) : 0;
          P.mesh.material.emissiveIntensity = on ? 0.9 + 0.8 * pulse + 2.6 * fl : 0.22;
          P.mesh.scale.setScalar(on ? 1.2 + 0.18 * pulse + 0.8 * fl : 0.8);
          P.mesh.material.transparent = !on; P.mesh.material.opacity = on ? 1 : 0.4;
          P.lb.visible = show && on; }
        P.lb.position.set(P.pos.x + P.lo.x, P.pos.y + P.lo.y, zNow + 0.14);
        const a = P.stem.geometry.attributes.position; a.setXYZ(0, P.pos.x, P.pos.y, zNow); a.setXYZ(1, P.pos.x, P.pos.y, 0); a.needsUpdate = true; P.stem.computeLineDistances();
      });
      if (m.pins) speakers.forEach(w => g.setPath(w, []));
    }
    // the flying words: one sprite per caught word, its whole path a function of t
    const wordSprite = (text, color) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
      x.font = '700 64px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14; x.fillStyle = color; x.fillText(text, 256, 64);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false, fog: false }));
      sp.renderOrder = 1060; sp.visible = false; scene.add(sp); return sp; };
    const FLY = [];   // { sp, src, tw, i, k }
    Object.values(RUNS).forEach(run => run.lines.forEach(l => { const i = flatIdx(run.piece, l.i); if (i < 0) return;
      const S = STATION[l.station]; l.caught.forEach((c, k) => FLY.push({ sp: wordSprite(c[0].toLowerCase(), S ? S[2] : '#ffb13d'), src: run.clip, tw: c[1], tOut: l.t_out, i, k })); }));
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
    const ease3 = u => u * u * (3 - 2 * u);
    function readingFrame(t) {
      // called every seek; sets the reading state and everything that hangs off it
      const b = cur; READ.on = isReading(b); document.body.classList.toggle('reading', READ.on);
      G4.visible = READ.on;
      if (!READ.on) { FLY.forEach(f => f.sp.visible = false); Object.values(stems).forEach(s => s.visible = false); return; }
      const run = RUNS[b.src]; READ.b = b; READ.run = run; if (!run) return;
      const local = b.in + (t - b.start); READ.local = local;
      // float in at the beat's start (or straight on, when the beat follows another reading beat)
      const prev = beats[beats.indexOf(b) - 1]; const fresh = !(prev && isReading(prev));
      const u = fresh ? Math.min(1, (t - b.start) / 0.9) : 1, e = ease3(u);
      G4.scale.setScalar(0.25 + 0.75 * e); G4.position.copy(G4_HOME); G4.position.y += (1 - e) * 0.9 + Math.sin(t * 0.8) * 0.025; G4.rotation.z = Math.sin(t * 0.55) * 0.012;
      bezel.material.opacity = 0.94 * e; screen.material.opacity = e; screen.material.transparent = e < 1;
      // who's speaking: the nearest line at or before now
      let ln = null; run.lines.forEach(l => { if (l.t_in <= local + 0.2) ln = l; }); if (!ln) ln = run.lines[0];
      if (ln) drawName(run, ln.station);
      // THE UNDERSIDE (10-29, Sailor: "have the graphmap flip so we can see the −z side when the subject is speaking on that
      // side"): the map tips under over 1.2 s from the start of a line whose z is negative, and back when it turns positive
      { const neg = l => !!(l && l.z != null && l.z < -0.05); const li_ = run.lines.indexOf(ln); const prevL = li_ > 0 ? run.lines[li_ - 1] : null;
        const a = prevL ? (neg(prevL) ? 1 : 0) : (neg(ln) ? 1 : 0), c = neg(ln) ? 1 : 0; const k = ln ? ease3(Math.max(0, Math.min(1, (local - ln.t_in) / 1.2))) : 0;
        READ.under = a + (c - a) * k; }
      drawCaption(run, local);
      // landings: a line lands when its speaker finishes it (t_out); the latest landing within 3 s is the focus
      let focus = -1, age = 99;
      run.lines.forEach(l => { if (l.t_out >= b.in - 0.3 && l.t_out <= local) { const a = local - l.t_out; if (a < age) { age = a; focus = flatIdx(run.piece, l.i); } } });
      READ.focus = age < 6.0 ? focus : -1; READ.landAge = age;
      // stems for every reading line that has landed so far in the episode (seek-safe: by revealAt)
      L.forEach((p, i) => { const s = (revealAt[i] != null && t >= revealAt[i] && READ_LINES.has(i)) ? stemFor(i) : stems[i]; if (s) s.visible = revealAt[i] != null && t >= revealAt[i] && READ_LINES.has(i); });
      // the words fly from the caption strip to their dot, then rest beside it, the newest largest
      G4.updateMatrixWorld(true);
      FLY.forEach(f => {
        if (f.src !== b.src) { f.sp.visible = false; return; }
        const dt = local - f.tw; const m = dotMesh[f.i];
        if (dt < 0 || !m || local - f.tOut > 14) { f.sp.visible = false; return; }
        f.sp.visible = true;
        _a.set((f.k ? 0.38 : -0.38), -G4H / 2 - 0.15, 0.05); G4.localToWorld(_a);           // off the caption strip
        m.getWorldPosition(_b);
        const fl = Math.min(1, dt / 1.25), fe = ease3(fl);
        _c.lerpVectors(_a, _b, fe); _c.y += Math.sin(fe * Math.PI) * 0.55;                    // an arc over the desk
        if (fl >= 1) { _c.copy(_b); _c.x += (f.k ? 0.62 : -0.62) * stageIn.scale.x; _c.y += (0.2 + f.k * 0.22) * stageIn.scale.x; }
        f.sp.position.copy(_c);
        const rest = Math.max(0, local - Math.max(f.tw + 1.25, f.tOut));
        const sc = (fl < 1 ? 0.95 : 0.62) * (1 - Math.min(0.5, rest / 20));
        f.sp.scale.set(sc, sc / 4, 1); f.sp.material.opacity = fl < 1 ? 1 : Math.max(0.25, 1 - rest / 14);
      });
      // the map: over at frame left, turning slowly to show its depth; on a landing it swings toward the line's corner,
      // tips down to show the stem, and swells, then eases back
      const land = READ.focus >= 0 ? Math.max(0, 1 - READ.landAge / 3.6) : 0, lk = ease3(land);
      const q = READ.focus >= 0 ? (STATION[L[READ.focus].station] || [, , , 'A'])[3] : null;
      const cornerYaw = { A: 0.45, B: -0.45, C: 0.55, D: -0.55 }[q] || 0;
      mapWant.near = 1;
      mapWant.yaw = Math.sin(t * 0.21) * 0.55 * (1 - lk) + cornerYaw * lk;
      const basePitch = -0.62 - 0.32 * Math.sin(t * 0.13) * (1 - lk) - 0.25 * lk; mapWant.pitch = basePitch + (-2.05 - basePitch) * (READ.under || 0);   // under: seen from beneath
      mapWant.zoom = 0.86 + 0.26 * lk + 0.05 * Math.sin(t * 0.3);
      L.forEach((p, i) => { if (READ_LINES.has(i)) g.setDotEmphasis && g.setDotEmphasis(i, i === READ.focus ? 1 + 1.6 * Math.max(0, 1 - READ.landAge / 0.45) + 0.5 * land : 1); });
      // the landing card, for three seconds after each line lands
      if (READ.focus >= 0) { const l = L[READ.focus]; setLand({ piece: l.pid, line: l.li }); $('dn-land').style.display = 'flex'; $('dn-land').style.opacity = String(Math.min(1, (6.0 - READ.landAge) * 2)); }
      else { $('dn-land').style.display = 'none'; }
    }
    // THE MAP PIERCES THE ART (10-26, Sailor): the villa draws its pictures and statues without depth testing at draw orders
    // up to ~200, so they painted over the plane. Everything on the stage draws after them (+1000) — it still depth-tests,
    // so a column in front still covers it, but no picture behind it can.
    function liftStage() { stageIn.traverse(o => { if (!o.userData.__lifted) { o.renderOrder = (o.renderOrder || 0) + 1000; o.userData.__lifted = true; } }); }
    liftStage();
    const READ_LINES = new Set();
    Object.values(RUNS).forEach(run => run.lines.forEach(l => { const i = flatIdx(run.piece, l.i); if (i >= 0) READ_LINES.add(i); }));
    // the camera for a reading: a wide three-shot (map · Ted · g4) on a slow arc; on each landing it leans toward the map and
    // pushes in; between landings it drifts toward the g4 so the speaker reads
    const rcFrom = new THREE.Vector3(), rcAt = new THREE.Vector3(), mapLocal = new THREE.Vector3();
    function readingCamera(t) {
      const land = READ.focus >= 0 ? ease3(Math.max(0, 1 - READ.landAge / 3.2)) : 0;
      const drift = 0.5 + 0.5 * Math.sin(t * 0.11);                         // 0 = favour the map side, 1 = favour the g4
      const arc = (Math.sin(t * 0.07) * 0.1) + (drift - 0.5) * 0.08 - land * 0.12;
      const dist = (WIDE ? 8.6 : 10.2) - land * 1.1 - drift * 0.35;
      const pivot = new THREE.Vector3(0, WIDE ? 1.95 : 2.2, -1.0);
      mapLocal.copy(stage.position); DN.worldToLocal(mapLocal);
      rcAt.copy(pivot); rcAt.x += (drift - 0.5) * 0.5; rcAt.lerp(mapLocal, land * 0.35);
      rcFrom.set(Math.sin(arc) * dist, (WIDE ? 1.75 : 1.9) + land * 0.3 + Math.sin(t * 0.09) * 0.1, -1.0 + Math.cos(arc) * dist);
      DN.localToWorld(rcFrom); DN.localToWorld(rcAt);
      camFrom.copy(rcFrom); camAt.copy(rcAt);
    }

    // ── the lines' arrival on the map, seek-safe: for every flat line, the earliest show time at which a clip or a
    //    landing reveals it (a clip reveals its line when the line's own second passes inside the cut; a landing at its start)
    const revealAt = new Array(L.length).fill(null);
    const earlier = (i, at) => { if (at != null && (revealAt[i] == null || at < revealAt[i])) revealAt[i] = at; };
    beats.forEach(b => {
      if (isReading(b) && RUNS[b.src]) { const run = RUNS[b.src];
        run.lines.forEach(l => { const i = flatIdx(run.piece, l.i); if (i < 0) return; if (l.t_out < b.in - 0.3 || l.t_out > b.out + 0.3) return; earlier(i, b.start + Math.max(0, l.t_out - b.in)); });
        return; }
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
    const vid = $('dn-clip'); let capSeek = null;
    function applyMap(t, b) {
      const m = b.map || {};
      const pid = b.piece || (P0 && P0.id);
      if (b.type === 'land') { const o = b.orbit || [0, -40]; mapWant.yaw = o[0] * Math.PI / 180; mapWant.pitch = -(90 + o[1]) * Math.PI / 180 * 0.35; if (b.zoom) mapWant.zoom = Math.min(1.35, Math.max(0.8, 7 / b.zoom)); mapWant.near = LAND_PED ? 0 : 1; if (LAND_PED) mapWant.yaw += LAND_YAW; }
      else {
        if (m.orbit) { mapWant.yaw = m.orbit[0] * Math.PI / 180; mapWant.pitch = -(90 + m.orbit[1]) * Math.PI / 180 * 0.9; }
        if (m.zoom) mapWant.zoom = Math.min(2.4, Math.max(0.8, 7 / m.zoom));
        mapWant.near = (b.ted === 'map') ? 1 : 0;
        mapWant.focus = m.focusPin ? 1 : 0; if (m.focusPin) focusPid = m.focusPin;
        mapWant.drop = m.drop || 0;
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
      el.querySelector('.zn .n').textContent = li.z == null ? '—' : (li.z > 0 ? '+' : '') + li.z.toFixed(1); el.querySelector('.zn .n').style.color = li.z == null ? '#fff' : li.z > 0.05 ? '#f3d58a' : li.z < -0.05 ? '#9cc2ff' : '#fff';
      el.querySelector('.lum .n').textContent = li.lumens == null ? '—' : li.lumens;
      el.querySelector('.who').textContent = li.who;
      el.querySelector('.what').innerHTML = (S ? `<span class="st" style="color:${S[2]};font-weight:800">■ ${S[0]} · ${S[1]}</span> · ` : '') + li.what;
      el.querySelector('.quote').textContent = li.quote ? '“' + li.quote + '”' : '';
    }
    function showClip(b, t) {
      const url = clipURL(b.src); if (vid.dataset.src !== url) { vid.dataset.src = url; vid.src = url; }
      vid.style.display = isReading(b) ? 'none' : 'block';
      const want = b.in + (t - b.start);
      if (CAPTURE) { if (Math.abs((vid.currentTime || 0) - want) > 0.04) { vid.currentTime = want;   // under capture the renderer awaits the seek (10-29): the g4's video texture is frame-accurate
        capSeek = new Promise(res => { let d = false; const done = () => { if (d) return; d = true; vid.removeEventListener('seeked', done); res(); }; vid.addEventListener('seeked', done); setTimeout(done, 600); }); } }
      else if (!LIVE.playing) { if (Math.abs((vid.currentTime || 0) - want) > 0.04) vid.currentTime = want; if (!vid.paused) vid.pause(); }
      else { if (vid.paused || Math.abs(vid.currentTime - want) > 0.35) { vid.currentTime = want; vid.play().catch(() => {}); } }
    }
    function hideClip() { if (vid.style.display !== 'none') vid.style.display = 'none'; if (!vid.paused) vid.pause(); }
    function seek(t) {
      showT = t;
      const b = beatAt(t);
      const over = TL && TL.duration ? t >= TL.duration : (b && b === beats[beats.length - 1] && t >= b.end);
      $('dn-end').style.display = (over && EP.endcard) ? 'flex' : 'none';
      $('dn-black').style.display = (!b && beats.length && CAPTURE) ? 'block' : 'none';   // the lead: black until the first beat (in a render only — 11-07: a live page paused at 0 sat black with nothing to press)
      if (!b && !CAPTURE) { try { m3pFrame(t, null); } catch (e) {} }   // before the first beat: the M3P's controls still show
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
          $('dn-land').style.display = isLand ? 'flex' : 'none'; $('dn-land').style.opacity = '1'; if (isLand) setLand(b);
          DN.visible = !isLand; backing.visible = isLand && !LAND_PED; if (isLand && !LAND_PED) stageToLayer();
          if (!isClip && !isReading(b)) hideClip();
          if (isReading(b)) { $('dn-lower').style.display = 'none'; $('dn-sub').textContent = ''; }
          applyMap(t, b);
          if (prevType !== b.type) Object.assign(mapPose, mapWant);   // a hard cut: no easing into the new pose
        } else applyMap(t, b);
        if (b.type === 'clip' && ((b.layout || 'full') === 'full' || b.layout === 'reading')) showClip(b, t);
        readingFrame(t); bandsFrame(b, t); zPlanesFrame(t, b); pinsFrame(t, b); measureFrame(t, b); arcFrame(t, b); splitFrame(t, b); landIsoFrame(t, b); boundaryFrame(t, b); stillFrame(t, b); quoteFrame(t, b); tableFrame(t, b); flyFrame(t, b); m3pFrame(t, b); tedFrameLayers(t, b); creditsFrame(t, b); landFrame(t, b); bigFrame(t, b); rippleFrame(rippleEvents(b), t);
        if (b.card === 'score' && b.piece) { if ($('dn-score').dataset.p !== b.piece) { setScore(b); $('dn-score').dataset.p = b.piece; } $('dn-score').style.display = 'block'; }
        else { $('dn-score').style.display = 'none'; $('dn-score').dataset.p = ''; }
        const pb = beats[beats.indexOf(b) - 1], eb = (b.elephant && elephant) ? b : (pb && pb.elephant && elephant && t < pb.end + 12) ? pb : null;   // the walk carries past its beat
        if (eb) {
          const e = eb.elephant === true ? {} : eb.elephant, from = e.from || [10.5, -7.5], to = e.to || [-10.5, -6.5];
          const lead = e.lead != null ? e.lead : 0.02, WD = 3.2;
          // the pause for the wave: the word "elephant" in Ted's line (from the timeline); the walk is paced so he's
          // just past the middle (over Ted's shoulder, where the ground is high enough to show above the desk) when he stops to wave, and carries on into the next beat after
          if (eb.waveAt == null) { const w = (eb.words || []).find(x => /^elephant/i.test(x.w)); eb.waveAt = w ? w.s - 0.35 : -1; }
          const spanA = eb.waveAt >= 0 ? Math.max(4, (eb.waveAt - eb.start - lead * (eb.end - eb.start)) / 0.33) : Math.max(0.1, (eb.end - eb.start) * (e.span != null ? e.span : 1)), spanB = 8.5;   // after the wave he picks up the pace and is gone in eight seconds
          let tt = t - eb.start - lead * (eb.end - eb.start), wave = 0;
          if (eb.waveAt >= 0 && t >= eb.waveAt) { const into = t - eb.waveAt; wave = into < WD ? into / WD : 0; tt -= Math.min(WD, into); }
          const u = (eb.waveAt >= 0 && tt > spanA * 0.33) ? 0.33 + (tt - spanA * 0.33) / spanB * 0.67 : tt / spanA;
          if (u >= 0 && u <= 1) { const x = from[0] + (to[0] - from[0]) * u, z = from[1] + (to[1] - from[1]) * u; elephantAt = { x, z, heading: Math.atan2(to[0] - from[0], to[1] - from[1]), wave }; }
          else elephantAt = null;
        } else if (b.layout === 'fly' && elephant) elephantAt = { x: ELEPHANT_HILL[0], z: ELEPHANT_HILL[2], heading: 0.55, idle: true };
        else elephantAt = null;
        if (b.words) { const lit = b.words.filter(w => w.s <= t).slice(-9); $('dn-sub').innerHTML = lit.map((w, i) => i === lit.length - 1 ? `<b>${w.w}</b>` : w.w).join(' '); } else $('dn-sub').textContent = '';
      }
      if (TL && TL.envelope && TL.envelope.length && TL.fps) level = TL.envelope[Math.floor(t * TL.fps)] || 0;
      else if (b && !CAPTURE) level = (b.type === 'text' && t < b.end) ? 0.35 + 0.35 * Math.abs(Math.sin(t * 9)) : 0;
      tape.style.transform = `translateX(${-((t * 110) % (tape.scrollWidth / 2))}px)`;

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
    // THE DIM (10-28, Sailor: "dim the background… this is how far the x, the y, the z, the lumens"): on a `map.dim` beat a
    // dark sheet is drawn between the villa's two passes, so the world goes down and the stage (pass 2) stays lit
    const dimScene = new THREE.Scene(), dimCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const dimMat = new THREE.MeshBasicMaterial({ color: 0x05060c, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMat)); let dimK = 0;
    renderer.render = function (s, c) {
      const t = CAPTURE ? showT : (clock.getElapsedTime());
      hillShaders.forEach(sh => { sh.uniforms.uBreeze.value = t; });
      const villaMask = camera.layers.mask;                 // the villa's own two passes: 1 = the world, 2 = the living (pierce) layer
      const pass2 = villaMask === 2;
      if (!pass2) { tickStage(t); try { g.update && g.update(t); } catch (e) {} }
      placeCamera(showT);                                   // first: Ted's gaze reads the show's camera, not the villa's
      if (!pass2) { try { if (typeof trackerResolveShow === 'function') { const W = walkState(showT); trackerResolveShow(W.mode === 'there' ? W.since : null, 'globe'); } } catch (e) {} }   // ex01: the picture resolves as Ted arrives at the globe
      if (!pass2) { landWordsFrame(showT, beatAt(showT));   // the words fly from in front of the lens, so after the camera
        poseTed(t); driftDesk(t); poseElephant(t); posePassersby(showT, beatAt(showT)); }
      if (pass2) {
        // the stage lives on the pierce layer too: drawn again here over a cleared depth, it is the top layer on everything
        // (10-28, Sailor: "the pins and the graphmap — make sure they're the top layer; the artwork is piercing through")
        const b = beatAt(showT), want = (b && b.map && b.map.dim) ? 0.72 : 0; dimK += (want - dimK) * 0.1;
        if (dimK > 0.005) { dimMat.opacity = dimK; const ac = renderer.autoClear; renderer.autoClear = false; origRender(dimScene, dimCam); renderer.autoClear = ac; }
        camera.layers.mask = villaMask;
      }
      origRender(s, c);
    };

    stageToLayer();
    seek(0);
    window.SHOW = {
      ready: true, duration: DURATION, fps: EP.fps || 24, seek: t => { capSeek = null; seek(t); const p = capSeek; capSeek = null; return p || Promise.resolve(); }, level: v => { level = v; }, overlay, overlayHTML, aspect: ASPECT, width: WIDE ? 1920 : 1080, height: WIDE ? 1080 : 1920, scale: 1,
      blocks: (TL && TL.blocks) || blocks.map(blk => ({ id: blk.id, title: blk.title, clip: !!blk.clip, start: beats.find(b => b.block === blk).start, end: beats.filter(b => b.block === blk).slice(-1)[0].end })),
      beats: beats.map(b => ({ id: b.id, type: b.type, block: b.block.id, start: b.start, end: b.end, src: b.src, in: b.in, out: b.out, layout: b.type === 'clip' ? (b.layout || 'full') : undefined, piece: b.piece, line: b.line })),
      clipsDir: CLIPS_DIR,
      dbg: () => ({ cur: cur && cur.id, look, mapPose: Object.assign({}, mapPose), mapWant: Object.assign({}, mapWant), stage: stage.position.toArray().map(v => +v.toFixed(2)), deskSpot: DESK_SPOT.toArray().map(v => +v.toFixed(2)), nearLocal: DN.worldToLocal(stage.position.clone()).toArray().map(v => +v.toFixed(2)), cam: camera.position.toArray().map(v => +v.toFixed(2)) }),   // for a look under capture: the map's pose and where it is in the desk's frame
    };

    // ── the console (live mode, 2026-10-26): the Report as an event — play, pause, step, talk it through
    if (!CAPTURE) {
      const BL = window.SHOW.blocks, BT = window.SHOW.beats;
      let audio = new Audio('../data/show/' + ID + '/audio.mp3?v=' + Date.now()); audio.preload = 'auto'; audio.onerror = () => { audio = null; };
      let raf = null, base = 0, t0 = 0, lastT = 0;
      const fmt = x => { x = Math.max(0, x); const m = Math.floor(x / 60), r = Math.floor(x % 60); return m + ':' + String(r).padStart(2, '0'); };
      $('dn-dur').textContent = fmt(DURATION);
      const bar = $('dn-bar');
      bar.innerHTML = BL.map((b, i) => `<div class="seg" data-i="${i}" style="flex:${Math.max(0.5, b.end - b.start)} 0 0" title="${b.title || b.id}">${b.title || b.id}</div>`).join('') + '<div class="fill"></div><div class="head"></div>';
      const blockAt = t => { let k = 0; BL.forEach((b, i) => { if (t >= b.start - 0.001) k = i; }); return k; };
      const beatAt2 = t => { let k = 0; BT.forEach((b, i) => { if (t >= b.start - 0.001) k = i; }); return k; };
      const now = () => LIVE.playing ? (audio && !audio.paused ? audio.currentTime : base + (performance.now() - t0) / 1000) : base;
      function paint(t) {
        $('dn-t').textContent = fmt(t);
        const f = Math.min(1, t / DURATION); bar.querySelector('.fill').style.width = (f * 100) + '%'; bar.querySelector('.head').style.left = 'calc(' + (f * 100) + '% - 1px)';
        const bi = blockAt(t); bar.querySelectorAll('.seg').forEach((el, i) => el.classList.toggle('on', i === bi));
        const bt = BT[beatAt2(t)]; $('dn-now').textContent = (BL[bi] ? (BL[bi].title || BL[bi].id) : '') + (bt ? '  ·  ' + bt.id + (bt.type !== 'text' ? ' (' + bt.type + (bt.src ? ' · ' + bt.src : '') + ')' : '') : '');
        $('dn-play').textContent = LIVE.playing ? '❚❚ pause' : '▶ play';
      }
      function go(t) { base = Math.max(0, Math.min(DURATION, t)); t0 = performance.now(); lastT = base; if (audio) { try { audio.currentTime = base; } catch (e) {} } seek(base); paint(base); }
      function loop() {
        let t = now();
        if ($('dn-hold').checked) { const b = BL[blockAt(lastT)]; if (b && lastT < b.end - 0.02 && t >= b.end - 0.02) { pause(); go(b.end); return; } }
        lastT = t; seek(t); paint(t);
        if (t < DURATION) raf = requestAnimationFrame(loop); else { pause(); go(DURATION); }
      }
      function play() { if (LIVE.playing) return; if (base >= DURATION - 0.05) base = 0; LIVE.playing = true; t0 = performance.now(); if (audio) { try { audio.currentTime = base; } catch (e) {} audio.play().catch(() => {}); } cancelAnimationFrame(raf); loop(); }
      function pause() { if (!LIVE.playing) return; base = now(); LIVE.playing = false; cancelAnimationFrame(raf); if (audio) audio.pause(); const v = $('dn-clip'); if (v && !v.paused) v.pause(); seek(base); paint(base); }
      const toggle = () => LIVE.playing ? pause() : play();
      window.__ctl = { toggle, play, pause, go: x => go(x), now: () => now(), playing: () => LIVE.playing, skip: d => { const wasP = LIVE.playing; const x = now() + d; pause(); go(x); if (wasP) play(); } };   // the M3P's buttons (11-06)
      const jumpBeat = d => { const wasP = LIVE.playing; const t = now(); let i = beatAt2(t); if (d < 0 && t - BT[i].start > 1.0) d = 0; i = Math.max(0, Math.min(BT.length - 1, i + d)); pause(); go(BT[i].start + 0.001); if (wasP) play(); };
      const jumpBlock = d => { const wasP = LIVE.playing; const t = now(); let i = blockAt(t); if (d < 0 && t - BL[i].start > 1.5) d = 0; i = Math.max(0, Math.min(BL.length - 1, i + d)); pause(); go(BL[i].start + 0.001); if (wasP) play(); };
      $('dn-play').onclick = toggle; $('dn-prev').onclick = () => jumpBeat(-1); $('dn-next').onclick = () => jumpBeat(1); $('dn-prevb').onclick = () => jumpBlock(-1); $('dn-nextb').onclick = () => jumpBlock(1);
      bar.addEventListener('click', e => { const r = bar.getBoundingClientRect(); const wasP = LIVE.playing; pause(); go((e.clientX - r.left) / r.width * DURATION); if (wasP) play(); });
      let idle = null; const wake = () => { const c = $('dn-ctl'); if (c.dataset.hide === '1') return; c.classList.remove('hidden'); clearTimeout(idle); idle = setTimeout(() => { if (LIVE.playing) c.classList.add('hidden'); }, 3000); };
      document.addEventListener('mousemove', wake);
      window.addEventListener('keydown', e => {
        const k = e.key; let used = true;
        if (k === ' ') toggle(); else if (k === 'ArrowRight') jumpBeat(1); else if (k === 'ArrowLeft') jumpBeat(-1);
        else if (k === ']') jumpBlock(1); else if (k === '[') jumpBlock(-1);
        else if (k === 'p' || k === 'P') $('dn-hold').checked = !$('dn-hold').checked;
        else if (k === 'h' || k === 'H') { const c = $('dn-ctl'); const h = c.dataset.hide === '1'; c.dataset.hide = h ? '0' : '1'; c.classList.toggle('hidden', !h); }
        else used = false;
        if (used) { e.preventDefault(); e.stopImmediatePropagation(); wake(); }
      }, true);
      const q = new URLSearchParams(location.search); if (q.get('at')) { const a = q.get('at'); const b = BL.find(x => x.id === a); go(b ? b.start + 0.001 : parseFloat(a) || 0); } else go(M3P_ON && BT[0] ? BT[0].start + 0.001 : 0);   // 11-07: an M3P episode opens on its first beat, controls showing
      // inside the g4 shell: say ready, start on g4:go (the glass has crossfaded away), pause on g4:hide, Esc / ⟵ glass goes back
      if (window.parent !== window) {
        const back = () => { pause(); try { window.parent.postMessage({ type: 'dg:glass' }, '*'); } catch (e) {} };
        const gb = $('dn-glass'); if (gb) gb.onclick = back;
        window.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); back(); } }, true);
        window.addEventListener('message', e => { const m = e.data || {}; if (m.type === 'g4:go') setTimeout(play, 600); else if (m.type === 'g4:hide') pause(); });
        try { window.parent.postMessage({ type: 'dg:ready' }, '*'); } catch (e) {}
      }
      window.SHOW.live = { play, pause, go, toggle, now };
      wake();
    }
  })().catch(e => { console.error('[dream-news]', e); });
})();
