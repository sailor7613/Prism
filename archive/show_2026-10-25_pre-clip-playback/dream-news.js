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
// over the frame. window.SHOW = { ready, duration, seek(t), level(v) } is
// what scripts/show/render.js steps.
//
//   /Prism/dreamgetty/?show=ep01_reduced_diesel                plays (audio if tts.py has run)
//   /Prism/dreamgetty/?show=ep01_reduced_diesel&capture=1      stepped by the renderer
//   &aspect=16:9                                                wide framing
//
// Everything it touches is the villa's own: PLACE_REGISTRY (the Plaza),
// getTedHeight (the paving), buildCoyote (the same animal), PrismGraphmap
// (external-parent mode, as the pedestal does it), scene, camera, renderer,
// clock. Nothing in the villa is changed; this only adds and, in show mode,
// hides.
// ============================================================
(function () {
  const Q = new URLSearchParams(location.search);
  const ID = Q.get('show'); if (!ID) return;
  const CAPTURE = Q.get('capture') === '1';
  const ASPECT = Q.get('aspect') || '9:16';
  const WIDE = ASPECT === '16:9';
  document.body.classList.add('dream-news');

  // ── the overlay: everything of the villa's HUD goes; the frame gets a bug, a chyron, subtitles, a ticker
  const css = document.createElement('style');
  css.textContent = `
    body.dream-news > :not(#scene-container):not(#dn):not(script):not(style) { display: none !important; }
    body.dream-news { cursor: none; }
    #dn { position: fixed; inset: 0; pointer-events: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #fff; z-index: 2000; }
    #dn * { box-sizing: border-box; }
    #dn-bug { position: absolute; left: 4vw; top: 3vh; display: flex; align-items: center; gap: 0.8vw; }
    #dn-bug .mark { width: 2.6vw; height: 2.6vw; min-width: 22px; min-height: 22px; background: linear-gradient(135deg, #ff4f3d, #ffb13d); transform: skewX(-12deg); }
    #dn-bug .name { font-weight: 800; letter-spacing: .18em; font-size: clamp(13px, 1.3vw, 26px); white-space: nowrap; }
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
    #dn-ctl { position: fixed; left: 12px; top: 12px; z-index: 2100; font: 13px system-ui; color: #ccc; background: rgba(0,0,0,.7); padding: 8px 10px; border-radius: 6px; pointer-events: auto; cursor: default; }
    #dn-ctl button { font: 13px system-ui; margin-right: 8px; }
    body.dream-news.capture #dn-ctl { display: none; }
    ${WIDE ? '#dn-sub { bottom: 33vh; font-size: clamp(16px, 1.9vw, 38px); } #dn-chyron { right: 34vw; } #dn-chyron .h { font-size: clamp(18px, 2vw, 40px); }' : ''}
  `;
  document.head.appendChild(css);
  const dn = document.createElement('div'); dn.id = 'dn';
  dn.innerHTML = `
    <div id="dn-bug"><div class="mark"></div><div class="name">THE PARALLELOGRAM REPORT</div><div class="live">● LIVE FROM THE PLAZA</div></div>
    <div id="dn-clock"></div>
    <div id="dn-sub"></div>
    <div id="dn-chyron"><div class="tag"></div><div class="text"><div class="h"></div><div class="s"></div></div></div>
    <div id="dn-ticker"><div class="lbl">THE TAPE</div><div class="run"><div id="dn-tape"></div></div></div>
    <div id="dn-end"><div class="a"></div><div class="b"></div><div class="c"></div></div>`;
  document.body.appendChild(dn);
  if (!CAPTURE) { const c = document.createElement('div'); c.id = 'dn-ctl'; c.innerHTML = '<button id="dn-play">play</button><button id="dn-stop">stop</button><span id="dn-t">0.0</span> s'; document.body.appendChild(c); }
  else document.body.classList.add('capture');

  const $ = id => document.getElementById(id);

  (async function () {
    const EP = await fetch('../data/show/' + ID + '.json').then(r => r.json());
    const P = await fetch('../data/press/' + EP.piece + '.json').then(r => r.json());
    let TL = null; try { const r = await fetch('../data/show/' + ID + '/timeline.json'); if (r.ok) TL = await r.json(); } catch (e) {}

    const blocks = EP.blocks || [{ id: 'all', title: EP.segment || 'The Reduced', clip: true, beats: EP.beats }];
    const beats = []; blocks.forEach(blk => blk.beats.forEach(b => beats.push({ ...b, block: blk })));
    if (TL && TL.beats) { const by = Object.fromEntries(TL.beats.map(b => [b.id, b])); beats.forEach(b => { const t = by[b.id]; if (t) { b.start = t.start; b.end = t.end; b.words = t.words || null; } }); }
    else { let t = 0.4; beats.forEach(b => { b.start = t; t += b.text.split(/\s+/).length / 2.6 + 0.6; b.end = t; b.words = null; }); }
    const END_HOLD = 3;
    const DURATION = (TL && TL.duration ? TL.duration : beats[beats.length - 1].end) + END_HOLD;

    $('dn-bug').querySelector('.name').textContent = (EP.show || 'The Parallelogram Report').toUpperCase();
    $('dn-clock').textContent = `${P.source.program.toUpperCase()} · ${P.source.date}`;
    if (EP.endcard) { const e = EP.endcard.lines; $('dn-end').children[0].textContent = (e[0] || EP.show || 'The Parallelogram Report').toUpperCase(); $('dn-end').children[1].textContent = e[1] || ''; $('dn-end').children[2].textContent = e[2] || ''; }
    const zs = z => z == null ? '—' : (z > 0 ? '+' : '') + z.toFixed(1);
    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const tapeHTML = P.lines.map(p => `<span class="${p.station}">${p.station === 'O' ? '@O' : p.station}</span> ${P.names[p.who] || p.who} ${fmt(p.t)}${p.dia == null ? '' : ' · Dia ' + p.dia}${p.z == null ? '' : ' · z ' + zs(p.z)}<span class="sep">◆</span>`).join('');
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
    const STATION = { LI: ['LI', 'Left · Institutional', '#ff6b6b', 'A'], RI: ['RI', 'Right · Institutional', '#6ea4ff', 'B'], LP: ['LP', 'Left · Popular', '#7fd69a', 'C'], RP: ['RP', 'Right · Popular', '#ffb13d', 'D'] };
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
    g.loadTrace(P.trace);
    g.setBoundaryMode && g.setBoundaryMode('dual');
    g.setBoundaryVisible && g.setBoundaryVisible(false);
    const L = P.lines;
    L.forEach((p, i) => { g.addDot(p.normX, p.normY, p.quadrant, p.normZ, { color: p.station === 'O' ? COL.O : COL[p.station], radius: p.station === 'O' ? 0.035 : 0.06, shape: p.station === 'O' ? 'diamond' : undefined, label: '', meta: { i } }); g.setDotVisible(i, false); });
    const speakers = [...new Set(L.filter(p => p.station !== 'O').map(p => p.who))];
    speakers.forEach(w => { const st0 = L.find(p => p.who === w).station; g.addPath([], { id: w, color: COL[st0], opacity: .55, dashed: true }); });
    // the stage faces the desk at rest; orbit cues turn it from there
    const faceDesk = Math.atan2(toDesk.x, toDesk.z);
    // Where the map goes when Ted turns to it: off the pedestal and over to the desk, into the frame beside him
    // (the pedestal's kind of impossible — it floats across the Plaza and back). `near` is 0 at home, 1 at the desk.
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
    function poseTed(t) {
      ted.position.y = 0.0 + Math.sin(t * 1.3) * 0.006; ted.position.z = -0.95;
      if (U.head) {
        const want = look === 'map' ? { x: -0.2, y: -1.05 } : { x: 0.02, y: 0 };
        U.head.rotation.y += (want.y - U.head.rotation.y) * 0.08; U.head.rotation.x += (want.x - U.head.rotation.x) * 0.08;
      }
      if (U.jaw && jawRest != null) U.jaw.position.y = jawRest - level * 0.05;
      if (U.tail) U.tail.rotation.y = Math.sin(t * 2.2) * 0.1;
    }

    // ── the camera, pinned to the desk, a slow push-in over the episode
    const camFrom = new THREE.Vector3(), camAt = new THREE.Vector3();
    function placeCamera(t) {
      const k = Math.min(1, t / Math.max(1, DURATION));
      const dist = (WIDE ? 5.0 : 5.8) - k * 0.5;
      camFrom.set(0.12, 1.38, dist); camAt.set(0, WIDE ? 1.7 : 1.95, -0.9);
      DN.localToWorld(camFrom); DN.localToWorld(camAt);
      camera.position.copy(camFrom); camera.lookAt(camAt);
      if (typeof camTarget !== 'undefined' && camTarget.copy) camTarget.copy(camAt);
    }

    // ── one seek(t) sets everything for that moment
    let showT = 0, cur = null;
    if (CAPTURE) clock.getElapsedTime = () => showT;   // the villa's own clock runs on the renderer's time under capture
    function beatAt(t) { let b = null; for (const x of beats) if (t >= x.start) b = x; return b; }
    function applyMap(m, t, b) {
      if (!m) return;
      if (m.orbit) { mapWant.yaw = m.orbit[0] * Math.PI / 180; mapWant.pitch = -(90 + m.orbit[1]) * Math.PI / 180 * 0.9; }
      if (m.zoom) mapWant.zoom = Math.min(1.35, Math.max(0.8, 7 / m.zoom));
      const present = (b.ted === 'map');
      mapWant.near = present ? 1 : 0;
      g.setTraceVisible && g.setTraceVisible(!!m.trace);
      let upto;
      if (m.reveal === 'all') upto = 1e9;
      else { const i = beats.indexOf(b); let prev = 0; for (let k = i - 1; k >= 0; k--) { const r = beats[k].map && beats[k].map.reveal; if (r != null) { prev = r === 'all' ? 1e9 : r; break; } }
        const f = Math.min(1, Math.max(0, (t - b.start) / Math.max(0.1, (b.end - b.start) * 0.6))); upto = prev + (m.reveal - prev) * f; }
      const seen = {};
      L.forEach((p, i) => { const on = p.t <= upto; g.setDotVisible(i, on); g.setDotEmphasis && g.setDotEmphasis(i, m.focus === i ? 2.4 : 1); if (on && p.station !== 'O') (seen[p.who] = seen[p.who] || []).push({ x: p.normX, y: p.normY, z: p.normZ }); });
      speakers.forEach(w => g.setPath(w, m.paths ? (seen[w] || []) : []));
    }
    function seek(t) {
      showT = t;
      const b = beatAt(t);
      const over = TL && TL.duration ? t >= TL.duration : (b && b === beats[beats.length - 1] && t >= b.end);
      $('dn-end').style.display = over ? 'flex' : 'none';
      if (b) {
        if (b !== cur) { cur = b; $('dn-chyron').querySelector('.h').textContent = b.caption || ''; $('dn-chyron').querySelector('.tag').textContent = (b.block.title || '').toUpperCase();
          const st = (b.map && b.map.focus != null && L[b.map.focus]) ? L[b.map.focus].station : null; const S = st && STATION[st];
          $('dn-chyron').querySelector('.s').innerHTML = (S ? `<span class="st" style="color:${S[2]}">■ ${S[0]} · ${S[1]}</span> · ` : '') + `${P.title} · ${P.source.program}`;
          look = b.ted || 'camera';
          Object.keys(stageLabels).forEach(k => { stageLabels[k].material.opacity = (!st || st === k) ? 1 : 0.7; }); }
        applyMap(b.map, t, b);
        if (b.words) { const lit = b.words.filter(w => w.s <= t).slice(-9); $('dn-sub').innerHTML = lit.map((w, i) => i === lit.length - 1 ? `<b>${w.w}</b>` : w.w).join(' '); } else $('dn-sub').textContent = '';
      }
      if (TL && TL.envelope && TL.envelope.length && TL.fps) level = TL.envelope[Math.floor(t * TL.fps)] || 0;
      else if (b && !CAPTURE) level = t < b.end ? 0.35 + 0.35 * Math.abs(Math.sin(t * 9)) : 0;
      tape.style.transform = `translateX(${-((t * 110) % (tape.scrollWidth / 2))}px)`;
      const ctl = $('dn-t'); if (ctl) ctl.textContent = t.toFixed(1);
    }
    // every drawn frame: the map eases to its pose, Ted moves, the camera holds — hooked on the villa's own render call
    const origRender = renderer.render.bind(renderer);
    renderer.render = function (s, c) {
      const t = CAPTURE ? showT : (clock.getElapsedTime());
      tickStage(t); try { g.update && g.update(t); } catch (e) {}
      poseTed(t); driftDesk(t);
      placeCamera(showT);
      origRender(s, c);
    };

    // ── preview clock
    if (!CAPTURE) {
      let raf = null, t0 = 0, audio = new Audio('../data/show/' + ID + '/audio.mp3'); audio.onerror = () => { audio = null; };
      const tick = () => { const t = audio && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000; seek(t); if (t < DURATION) raf = requestAnimationFrame(tick); };
      $('dn-play').onclick = () => { t0 = performance.now(); if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } cancelAnimationFrame(raf); tick(); };
      $('dn-stop').onclick = () => { cancelAnimationFrame(raf); if (audio) audio.pause(); };
    }
    seek(0);
    window.SHOW = { ready: true, duration: DURATION, blocks: (TL && TL.blocks) || blocks.map(blk => ({ id: blk.id, title: blk.title, clip: !!blk.clip, start: beats.find(b => b.block === blk).start, end: beats.filter(b => b.block === blk).slice(-1)[0].end })), fps: EP.fps || 24, seek, level: v => { level = v; }, aspect: ASPECT, width: WIDE ? 1920 : 1080, height: WIDE ? 1080 : 1920, scale: 1 };
  })().catch(e => { console.error('[dream-news]', e); });
})();
