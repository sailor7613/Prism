// ============================================================
// prism-model.js — Prism's physical model, as something a room can hold (2026-11-10, late).
//
// The same scene as press/model.html, written for the villa (three.js r128, a classic script):
//   THE OBJECT  a sphere. Its own light. The body is drawn on its skin, never inside it.
//   THE PRISM   the closed form. Only the light goes through it.
//   THE MAP     lies on water. The water is zero: delivered stands above, frustrated hangs below.
//
// Nothing here needs the room's lamps: every surface carries its own light, so it reads the same
// by day and by night and in the pass that draws through walls.
//
// Use:
//   const m = PrismModel.create(THREE, {
//     object: new THREE.Vector3(0, 4.3, 0), objectR: 1.15,      // where the Object stands
//     map:    new THREE.Vector3(0, 1.67, 19.5), mapSize: 5,     // the centre of the map, at the water; its width
//     prism:  null,                                             // left out: it floats where the scene's proportions put it
//     right:  new THREE.Vector3(1, 0, 0), near: new THREE.Vector3(0, 0, 1),   // the map's right (R stations) and near (populist) sides
//     layer:  1, data: '../data/', set: 'tucker_record', sheets: 7 });
//   scene.add(m.group);  m.show(true);            // loads the set the first time, then replays it
//   m.update(seconds, camera);                    // every frame
//   m.play() · m.setWhen(day) · m.callUp('pump') · m.load('the_crystal')
//   m.setMode('history' | 'chamber' | 'lives' | 'globe') · m.setVote(i | -1) · m.onMode = (mode, caption) => …
//   m.onFace = (name, open) => …   the globe itself belongs to the room: show yours while open > 0, just inside the Object's radius
//   (the chamber reads data/active/chamber.json, the lives data/active/lives.json, the globe's needle object.json's dollar)
// ============================================================
(function (root) {
  'use strict';

  const ST = { LI: 0x8fb0e0, RI: 0xe0948f, LP: 0x8cc79f, RP: 0xe0b77a };
  const CREAM = 0xf6f1e6;
  const BODYCOL = { war: 0xe8e2d6, barrel: 0xc9a06a, pump: 0xd4a94e, dollar: 0x7fa3c0, vote: 0xb9a7d8, law: 0x9fc7a8, prices: 0xd98f6a, jobs: 0xa9a9d6, mood: 0xd6c98a, lives: 0xb0523a, direction: 0xc7b8e6 };
  const PINCOL = { right: 0xe0b77a, wrong: 0xd9604a, open: 0x8a8f9c };
  const FILM = [
    'vec3 film(float t){ return 0.5 + 0.5 * cos(6.2831853 * t * 1.3 / vec3(0.65, 0.532, 0.473)); }',
    'const vec3 CREAM = vec3(0.965, 0.945, 0.905);',
    'float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
    'float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }'].join('\n');
  const day = s => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t, ease = t => t * t * (3 - 2 * t);
  const std = a => { if (!a || a.length < 2) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };

  function create(THREE, opts) {
    opts = opts || {};
    const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
    const lin = h => new THREE.Color(h).convertSRGBToLinear();          // for the built-in materials, so the screen shows the colour as written
    const basic = (h, o) => new THREE.MeshBasicMaterial(Object.assign({ color: lin(h), toneMapped: false, fog: false }, o || {}));
    const lineM = (h, opacity, o) => new THREE.LineBasicMaterial(Object.assign({ color: lin(h), transparent: true, opacity: opacity == null ? 1 : opacity, toneMapped: false, fog: false, depthWrite: false }, o || {}));
    const shader = o => new THREE.ShaderMaterial(Object.assign({ transparent: true, depthWrite: false }, o));
    const uT = { value: 0 }, uVeil = { value: 0 }, uClear = { value: 0 }, uAir = { value: opts.air || 0 };   // uAir: 0 = light adds to what is behind it (a dark room) · 1 = it also veils it (a bright one)
    const LIGHT = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

    // ── where things stand ──
    const O = new V3().copy(opts.object || new V3(0, 3, -4.35)), R = opts.objectR || 0.86;
    const C = new V3().copy(opts.map || new V3(0, 0, 0)), M = opts.mapSize || 2.8, S = M / 2.8, HALF = M / 2, ZH = 1.32 * S;
    const EX = new V3().copy(opts.right || new V3(1, 0, 0)).normalize(), EZ = new V3().copy(opts.near || new V3(0, 0, 1)).normalize();
    let d = new V3(C.x - O.x, 0, C.z - O.z); if (d.lengthSq() < 1e-6) d.set(1, 0, 0); d.normalize();      // downstream: from the Object toward the map, along the ground
    const P = opts.prism ? new V3().copy(opts.prism) : C.clone().addScaledVector(d, -1.95 * S).addScaledVector(UP, 2.9 * S);
    const c = new V3().crossVectors(d, UP).normalize();                  // across the light
    const TILT = opts.tilt != null ? opts.tilt : -0.5, PK = opts.prismScale || 1, PS = 1.5 * S * PK, PD = 1.15 * S * PK;
    const basis = new THREE.Matrix4().makeBasis(d, UP, c);
    const pTop = 0.46 * PS, pBot = -0.46 * PS;
    const faceR = y => new V3(0.5 * PS - (y - pBot) * (0.5 * PS / (pTop - pBot)), y, 0);
    const faceL = y => { const v = faceR(y); v.x = -v.x; return v; };
    const toWorld = v => v.clone().applyAxisAngle(new V3(0, 0, 1), TILT).applyMatrix4(basis).add(P);
    const ENTRY = toWorld(faceL(0.02 * PS));
    const exitTop = 0.24 * PS, exitBot = -0.20 * PS, exitDepth = 0.5 * S * PK;
    const exitAt = (a, b) => toWorld(faceR(lerp(exitBot, exitTop, a))).addScaledVector(c, (b - 0.5) * exitDepth);
    const footAt = (a, b) => C.clone().addScaledVector(d, (a - 0.5) * M).addScaledVector(c, (b - 0.5) * M);
    const mapAt = (nx, ny, y) => C.clone().addScaledVector(EX, (nx - 0.5) * M).addScaledVector(EZ, (ny - 0.5) * M).addScaledVector(UP, y || 0);
    const abOf = p => { const q = p.clone().sub(C); return [clamp(q.dot(d) / M + 0.5, 0, 1), clamp(q.dot(c) / M + 0.5, 0, 1)]; };
    const SRC = O.clone().add(ENTRY.clone().sub(O).normalize().multiplyScalar(R * 0.985));
    const EXITC = exitAt(0.5, 0.5);

    const group = new THREE.Group(); group.name = 'prismModel'; group.visible = false;
    const BRIGHT = !!opts.bright;
    const LAYER = opts.layer;
    const add = (o, parent) => { (parent || group).add(o); if (LAYER != null) o.traverse(x => x.layers.set(LAYER)); return o; };

    const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.42)'); g.addColorStop(0.6, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
    const glow = (h, size, opacity) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lin(h), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); s.scale.setScalar(size); return s; };
    const text = (str, h, size) => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x = cv.getContext('2d'); x.font = '44px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(4,8,20,.95)'; x.shadowBlur = 12; x.fillStyle = '#' + h.toString(16).padStart(6, '0'); x.fillText(str, 256, 50);
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
      s.scale.set(size * 5.33, size, 1); s.renderOrder = 20; return s; };

    // ── THE OBJECT ──
    const object = new THREE.Group(); object.position.copy(O); add(object);
    const skin = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), new THREE.ShaderMaterial({ transparent: true, uniforms: { uT, uAir, uVeil, uClear },
      vertexShader: 'varying vec3 vN; varying vec3 vW; varying vec3 vO; void main(){ vO = position; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: ['varying vec3 vN; varying vec3 vW; varying vec3 vO; uniform float uT; uniform float uAir; uniform float uVeil; uniform float uClear;', FILM,
        'void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); float ndv = clamp(dot(N, V), 0.0, 1.0), fr = pow(1.0 - ndv, 2.0);',
        '  vec3 q = vO / ' + R.toFixed(3) + ' * 0.86;',
        '  float th = 0.30 + 0.55 * noise(q * 1.5 + vec3(0.0, uT * 0.035, uT * 0.02)) + 0.16 * noise(q * 4.0 - uT * 0.05);',
        '  vec3 f = mix(film(th + (1.0 - ndv) * 0.42), CREAM, 0.38);',
        '  vec3 col = mix(vec3(0.030, 0.046, 0.105), vec3(0.105, 0.135, 0.235), pow(ndv, 0.8));',
        '  col += f * (0.10 + 0.50 * fr);',
        '  col += CREAM * (0.07 * ndv + 0.22 * pow(fr, 2.5));',
        '  vec3 pearl = mix(vec3(0.20, 0.25, 0.46), vec3(0.46, 0.52, 0.78), ndv) + f * (0.10 + 0.42 * fr) + CREAM * (0.10 * ndv + 0.30 * pow(fr, 2.5));',
        '  vec3 outc = mix(col, pearl, uAir); outc += f * uVeil * (0.16 + 0.30 * fr) + CREAM * uVeil * 0.05;',      // between modes the film closes over
        '  gl_FragColor = vec4(mix(outc, f * 0.9 + CREAM * 0.2, uClear * 0.6), mix(1.0, clamp(0.05 + 0.80 * fr, 0.0, 1.0), uClear)); }'].join('\n') }));       // cleared, only the film at its edge is left
    skin.renderOrder = -1; add(skin, object);
    const skinLines = new THREE.Group(); add(skinLines, object);
    const aura = glow(0xe6ebff, R * 6.4, 0.5); aura.position.copy(O); aura.renderOrder = -5; add(aura);
    const srcGlow = glow(0xfff6e6, 0.9 * S, 0.8); srcGlow.position.copy(SRC); srcGlow.material.depthTest = false; add(srcGlow);      // not cut by the sphere it sits on; it fades as that side turns away from you (update)
    const srcDir = SRC.clone().sub(O).normalize(), toCam = new V3();

    // ── THE OBJECT'S MODES (2026-11-11) ──────────────────────────────────────────────────────────────────────────
    // The Object is always a perfect sphere and it never opens. A mode is one part of the body, shown on the skin,
    // with one element that has come out through the skin. Nothing is drawn inside: what you see is what has surfaced.
    // Between modes the film closes over, the old mode sinks under the skin, the new one comes up.
    //   history   every measure as a line round the sphere (built with the set, below)
    //   chamber   Congress: each sitting member a point, gathered round their party's end of a balance beam.
    //             Two beams, crossed: the Senate and the House. A beam tilts by the seat margin, heavier side lower.
    //             Call up a vote and that chamber's beam swings to the count; yeas are lit, those not voting go dark.
    const face = new THREE.Group(); face.position.copy(O); add(face);            // holds what does not turn with time
    const PARTY = { D: 0x8fb0e0, R: 0xe0948f, I: 0xf6f1e6 }, UNPLACED = 0x8a8f9c;
    const MODES = { history: { open: 1 }, chamber: { open: 0 }, lives: { open: 0 }, globe: { open: 0 } };
    let mode = 'history', modeTo = null, autoMode = false;
    const chamber = { data: null, loading: null, built: false, vote: -1, k: {}, pts: null, n: 0, rows: [] };
    const label = (size) => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, fog: false })); sp.scale.set(size * 5.33, size, 1); sp.renderOrder = 21;   // these hide behind the sphere like anything else outside it
      sp.userData.set = (str, h) => { if (sp.userData.str === str + h) return; sp.userData.str = str + h; const x = cv.getContext('2d'); x.clearRect(0, 0, 512, 96); x.font = '46px Georgia'; const w = x.measureText(str).width; if (w > 490) x.font = Math.floor(46 * 490 / w) + 'px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.shadowColor = 'rgba(4,8,20,.95)'; x.shadowBlur = 12; x.fillStyle = '#' + h.toString(16).padStart(6, '0'); x.fillText(str, 256, 50); t.needsUpdate = true; };
      return sp; };
    const yawed = (v, a) => v.clone().applyAxisAngle(UP, a);
    function buildChamber() { const C2 = chamber.data; if (!C2 || chamber.built) return; chamber.built = true;
      const g = new THREE.Group(); chamber.group = g; const rows = []; const tmp = new THREE.Object3D();
      [['senate', 0.5, 1.62, 0.0072, 0.034], ['house', -0.5, 1.42, 0.0055, 0.026]].forEach(([ch, yaw, reach, area, dot]) => { const cd = C2.chambers[ch]; if (!cd) return;
        const h = yawed(EX, yaw), fwd = new V3().crossVectors(h, UP).multiplyScalar(EZ.dot(new V3().crossVectors(h, UP)) < 0 ? -1 : 1);   // h: toward the R end, level · fwd: toward the viewer's side
        const seats = cd.seats, nR = seats.R || 0, nD = seats.D || 0, tilt0 = clamp((nR - nD) / Math.max(1, cd.total) * 2.5, -0.6, 0.6);
        const dirR = t => h.clone().multiplyScalar(Math.cos(t)).addScaledVector(UP, -Math.sin(t));
        const K = chamber.k[ch] = { ch, cd, h, fwd, reach, tilt0, tilt: tilt0, to: tilt0, dirR, ends: {}, idx: {} };
        // the beam: only its two ends, outside the skin
        ['R', 'D'].forEach(pp => { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * R, 0.011 * R, 1, 8), basic(CREAM, { transparent: true, opacity: 0.9 }));
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05 * R, 14, 10), basic(PARTY[pp])); const hl = glow(PARTY[pp], 0.5 * R, 0.5); const num = label(0.27 * R), nm = label(0.17 * R);
          g.add(rod, tip, hl, num, nm); K.ends[pp] = { rod, tip, hl, num, nm }; });
        // the members: a party's points gather round its end, the far end of the party at the pole, the aisle at the rim
        const by = { R: [], D: [], other: [] }; cd.members.forEach(m => (by[m.party] || by.other).push(m));
        by.R.sort((a, b) => (b.d1 == null ? -9 : b.d1) - (a.d1 == null ? -9 : a.d1)); by.D.sort((a, b) => (a.d1 == null ? 9 : a.d1) - (b.d1 == null ? 9 : b.d1));
        const place = (list, pole, areaEach) => { const n = list.length, tmax = Math.acos(clamp(1 - n * areaEach / 6.2832, -1, 1));
          const e1 = new V3().crossVectors(pole, Math.abs(pole.y) > 0.9 ? EX : UP).normalize(), e2 = new V3().crossVectors(pole, e1).normalize();
          list.forEach((m, i) => { const th = tmax * Math.sqrt((i + 0.5) / n), ph = i * 2.39996;
            const v = pole.clone().multiplyScalar(Math.cos(th)).addScaledVector(e1, Math.sin(th) * Math.cos(ph)).addScaledVector(e2, Math.sin(th) * Math.sin(ph)).normalize();
            rows.push({ m, ch, v, dot: dot * R, party: m.party }); }); };
        place(by.R, dirR(tilt0), area); place(by.D, dirR(tilt0).negate(), area);
        place(by.other, UP.clone().addScaledVector(fwd, 0.6).normalize(), area * 1.4);     // independents and the unplaced: up on the aisle, on neither end
      });
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), basic(0xffffff), rows.length);
      rows.forEach((r, i) => { tmp.position.copy(r.v).multiplyScalar(R * 1.012); tmp.scale.setScalar(r.dot); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); chamber.k[r.ch].idx[r.m.id] = i; });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; chamber.pts = im; chamber.rows = rows; g.add(im);
      chamber.note = label(0.19 * R); chamber.note.position.set(0, R * 1.36, 0); g.add(chamber.note);
      add(g, face); paintChamber(); layChamber(0); g.visible = false; }
    function paintChamber() { if (!chamber.pts) return; const C2 = chamber.data, v = chamber.vote >= 0 ? C2.votes[chamber.vote] : null, col = new THREE.Color(), dark = new THREE.Color(0x1c2233), white = new THREE.Color(0xffffff);
      chamber.rows.forEach((r, i) => { const base = new THREE.Color(PARTY[r.party] || UNPLACED);
        if (!v) col.copy(base);
        else if (v.chamber !== r.ch) col.copy(base).lerp(dark, 0.72);
        else { const p = v.pos[r.m.id]; if (p === 'y') col.copy(base).lerp(white, 0.45); else if (p === 'n') col.copy(base).lerp(dark, 0.55); else col.copy(dark); }
        chamber.pts.setColorAt(i, col.convertSRGBToLinear()); });
      chamber.pts.instanceColor.needsUpdate = true;
      Object.keys(chamber.k).forEach(ch => { const K = chamber.k[ch], s = K.cd.seats, e = K.ends, name = ch === 'senate' ? 'Senate' : 'House';
        if (v && v.chamber === ch) { let yR = 0, yD = 0; K.cd.members.forEach(m => { if (v.pos[m.id] === 'y') { if (m.party === 'R') yR++; else if (m.party === 'D') yD++; } });
          const yeaAtR = yR >= yD, tot = Math.max(1, (v.yea || 0) + (v.nay || 0)), heavy = (v.yea || 0) >= (v.nay || 0) ? 'yea' : 'nay';
          // the end that holds more of the yeas carries the yeas; the heavier count hangs lower
          const down = (heavy === 'yea') === yeaAtR ? 1 : -1; K.to = clamp(down * Math.abs((v.yea || 0) - (v.nay || 0)) / tot * 2.5, -0.6, 0.6);
          e.R.num.userData.set((yeaAtR ? 'yea ' + v.yea : 'nay ' + v.nay), PARTY.R); e.D.num.userData.set((yeaAtR ? 'nay ' + v.nay : 'yea ' + v.yea), PARTY.D);
          e.R.nm.userData.set(name, CREAM); e.D.nm.userData.set(name, CREAM);
        } else { K.to = K.tilt0; e.R.num.userData.set('R ' + (s.R || 0), PARTY.R); e.D.num.userData.set('D ' + (s.D || 0), PARTY.D); e.R.nm.userData.set(name, CREAM); e.D.nm.userData.set(name, CREAM); }
        const dim = v && v.chamber !== ch ? 0.3 : 1; ['R', 'D'].forEach(pp => { e[pp].rod.material.opacity = 0.9 * dim; e[pp].num.material.opacity = dim; e[pp].nm.material.opacity = 0.8 * dim; e[pp].hl.material.opacity = 0.5 * dim; }); });
      const oth = []; Object.keys(chamber.k).forEach(ch => { const s = chamber.k[ch].cd.seats; Object.keys(s).forEach(k => { if (k !== 'R' && k !== 'D') oth.push((ch === 'senate' ? 'Senate ' : 'House ') + (k === 'I' ? s[k] + ' independent' : s[k] + ' not placed')); }); });
      chamber.note.userData.set(oth.join('  ·  '), CREAM); }
    function layChamber(open) { Object.keys(chamber.k).forEach(ch => { const K = chamber.k[ch], dr = K.dirR(K.tilt);
      [['R', 1], ['D', -1]].forEach(([pp, sg]) => { const e = K.ends[pp], dir = dr.clone().multiplyScalar(sg), len = (K.reach - 1) * R * open;
        e.rod.position.copy(dir).multiplyScalar(R + len / 2); e.rod.scale.set(1, Math.max(0.001, len), 1); e.rod.quaternion.setFromUnitVectors(UP, dir);
        e.tip.position.copy(dir).multiplyScalar(R * (0.96 + (K.reach - 0.96) * open)); e.hl.position.copy(e.tip.position);
        const side = K.ch === 'senate' ? 1 : -1;      // the Senate's words sit above its beam, the House's below, so the two never cover each other
        e.num.position.copy(dir).multiplyScalar(R * K.reach + 0.24 * R).addScaledVector(UP, side * 0.20 * R); e.nm.position.copy(e.num.position).addScaledVector(UP, side * 0.25 * R);
        e.num.visible = e.nm.visible = open > 0.6; e.tip.visible = e.hl.visible = e.rod.visible = open > 0.02; }); });
      if (chamber.pts) chamber.pts.scale.setScalar(0.952 + 0.048 * open); if (chamber.note) chamber.note.visible = open > 0.6; }
    function chamberCaption() { const C2 = chamber.data; if (!C2) return ''; const v = chamber.vote >= 0 ? C2.votes[chamber.vote] : null;
      if (!v) { const s = C2.chambers.senate, h = C2.chambers.house; const f = c => c ? Object.keys(c.seats).sort().map(k => (k === '?' ? 'not placed' : k) + ' ' + c.seats[k]).join(' · ') + ' (as of ' + c.asOf + ')' : '';
        return 'The seats — Senate: ' + f(s) + '  |  House: ' + f(h); }
      return (v.chamber === 'senate' ? 'Senate' : 'House') + ' · ' + v.date + ' · ' + (v.question || '') + ' · ' + v.yea + '–' + v.nay + ' · ' + (v.result || '') + (v.title ? ' — ' + v.title : ''); }
    function loadChamber() { if (chamber.data) return Promise.resolve(); if (!chamber.loading) chamber.loading = fetch((opts.data || '../data/') + 'active/chamber.json?' + Date.now()).then(r => { if (!r.ok) throw new Error('chamber.json'); return r.json(); }).then(j => { chamber.data = j; buildChamber(); });
      return chamber.loading; }
    function setVote(i) { if (!chamber.data) return; const n = chamber.data.votes.length; chamber.vote = i == null || i < 0 ? -1 : Math.min(n - 1, i); paintChamber(); tell(); }
    // ── the lives: one ray for each service member killed, leaving the skin where the day falls; the wounded, small points on it.
    //    It turns with time like the history. Nothing here has a z, and this mode does not give it one. ──
    const lives = { data: null, loading: null, group: null, rays: [], pts: null, note: null, killed: 0, wounded: 0, to: null };
    const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    function buildLives() { const Lv = lives.data; if (!Lv || lives.group || !D) return; const g = new THREE.Group(); lives.group = g; let k = 0;
      (Lv.killed || []).forEach(row => { const d0 = day(row.date); for (let j = 0; j < (row.n || 0); j++, k++) {
          const lon = lonOf(d0) + (rnd(k) - 0.5) * 0.10, lat = (rnd(k + 91) - 0.5) * 1.5, n = onSkin(lon, lat).normalize();
          const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([n.x * R, n.y * R, n.z * R, n.x * R * 1.34, n.y * R * 1.34, n.z * R * 1.34], 3));
          const ray = new THREE.Line(geo, lineM(CREAM, 0.85)), tip = glow(0xfff4e0, 0.34 * R, 0.9), foot = new THREE.Mesh(new THREE.SphereGeometry(0.02 * R, 8, 6), basic(CREAM));
          foot.position.copy(n).multiplyScalar(R * 1.008); g.add(ray, tip, foot); lives.rays.push({ ray, tip, foot, n, d: d0 }); } });
      lives.killed = k;
      // the wounded: the count is on file by date, not by person, so each rise is spread over the days since the count before it
      const counts = (Lv.counts || []).filter(c => c.wounded != null).sort((a, b) => a.date.localeCompare(b.date)); let prev = 0, prevD = B.topic && B.topic.zero ? day(B.topic.zero) : (counts[0] ? day(counts[0].date) - 30 : 0), w = 0; const rows = [];
      counts.forEach(c => { const dd = day(c.date), add_ = Math.max(0, c.wounded - prev); for (let j = 0; j < add_; j++, w++) rows.push({ d: Math.round(lerp(prevD, dd, (j + 0.5) / add_)), i: w }); prev = Math.max(prev, c.wounded); prevD = dd; });
      lives.wounded = w; lives.to = counts.length ? counts[counts.length - 1].date : null;
      if (rows.length) { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), basic(0xffffff), rows.length), tmp = new THREE.Object3D(), col = new THREE.Color(0xb9b3a6).convertSRGBToLinear();
        rows.forEach((r, i) => { tmp.position.copy(onSkin(lonOf(r.d) + (rnd(i + 500) - 0.5) * 0.05, (rnd(i + 900) - 0.5) * 2.2)).normalize().multiplyScalar(R * 1.006); tmp.scale.setScalar(0.0085 * R); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); im.setColorAt(i, col); });
        im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.userData.rows = rows; lives.pts = im; g.add(im); }
      add(g, object); g.visible = false; whenLives(); }
    function whenLives() { if (!lives.group) return; let k = 0; lives.rays.forEach(r => { r.on = r.d <= when; if (r.on) k++; }); lives.shownKilled = k;
      if (lives.pts) { let n = 0; lives.pts.userData.rows.forEach(r => { if (r.d <= when) n++; }); lives.pts.count = n; lives.shownWounded = n; } }
    function layLives(o) { if (!lives.group) return; lives.group.visible = o > 0.01; const len = 1 + 0.34 * o;
      lives.rays.forEach(r => { const on = r.on && o > 0.02; r.ray.visible = r.tip.visible = r.foot.visible = on; if (!on) return; r.ray.scale.setScalar(1); const p = r.ray.geometry.attributes.position; p.setXYZ(1, r.n.x * R * len, r.n.y * R * len, r.n.z * R * len); p.needsUpdate = true; r.tip.position.copy(r.n).multiplyScalar(R * len); r.tip.material.opacity = 0.9 * o; });
      if (lives.pts) lives.pts.scale.setScalar(0.955 + 0.045 * o); }
    function livesCaption() { if (!lives.data) return ''; return (lives.shownKilled != null ? lives.shownKilled : lives.killed) + ' killed · ' + (lives.shownWounded != null ? lives.shownWounded : lives.wounded) + ' wounded — US service members, as the Pentagon counted and the press reported' + (lives.to ? ', on file to ' + lives.to : '') + '. No z.'; }
    function loadLives() { const ready = loaded ? Promise.resolve() : (loading || load()); return ready.then(() => { if (lives.data) { buildLives(); return; }
        if (!lives.loading) lives.loading = fetch((opts.data || '../data/') + 'active/lives.json?' + Date.now()).then(r => { if (!r.ok) throw new Error('lives.json'); return r.json(); }).then(j => { lives.data = j; buildLives(); });
        return lives.loading; }); }

    // ── the globe: the dollar and the barrel. The room owns the globe itself (the villa's, with its routes); the Object's skin clears
    //    over it, and the element is the dollar's needle: upright when the dollar's share stands where it stood when the topic began,
    //    leaning as the share has moved. Only its ends show. ──
    const globe = { group: null, to: 0, lean: 0, lbl: null };
    function buildGlobe() { if (globe.group) return; const g = new THREE.Group(); globe.group = g;
      globe.top = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * R, 0.011 * R, 1, 8), basic(CREAM, { transparent: true, opacity: 0.9 })); globe.bot = globe.top.clone();
      globe.tip = new THREE.Mesh(new THREE.SphereGeometry(0.045 * R, 14, 10), basic(0x7fa3c0)); globe.hl = glow(0x7fa3c0, 0.5 * R, 0.55); globe.lbl = label(0.2 * R);
      g.add(globe.top, globe.bot, globe.tip, globe.hl, globe.lbl); add(g, face); g.visible = false; whenGlobe(); }
    function whenGlobe() { if (!globe.group || !B) return; const m = B.body.find(x => x.id === 'dollar'), r = m && asOf(m.readings, when), nfo = r && r[3] && typeof r[3] === 'object' ? r[3] : null;
      globe.to = nfo && nfo.pointsSinceWar != null ? clamp(-nfo.pointsSinceWar * 0.045, -0.5, 0.5) : 0;      // 3.3 points down → about 8.5°
      globe.cap = nfo ? 'The dollar — ' + (nfo.share * 100).toFixed(1) + '% of the barrel is sold in dollars, ' + (nfo.pointsSinceWar > 0 ? '+' : '') + nfo.pointsSinceWar + ' points since the war began (as of ' + r[0] + '). The needle leans as the share has moved.' : 'The dollar and the barrel — where the oil goes, and in what money.';
      globe.lbl.userData.set(nfo ? 'the dollar ' + (nfo.share * 100).toFixed(1) + '%' : 'the dollar', 0x9fc0dc); }
    function layGlobe(o, dt) { uClear.value = o; if (api.onFace) try { api.onFace('globe', o); } catch (e) {}
      if (!globe.group) return; globe.group.visible = o > 0.01; globe.lean += (globe.to - globe.lean) * Math.min(1, (dt || 0.016) * 2.2);
      const dir = UP.clone().multiplyScalar(Math.cos(globe.lean)).addScaledVector(EX, -Math.sin(globe.lean));      // fallen share: it leans to the viewer's left
      const set = (rod, sg, reach) => { const dd = dir.clone().multiplyScalar(sg), len = (reach - 1) * R * o; rod.position.copy(dd).multiplyScalar(R + len / 2); rod.scale.set(1, Math.max(0.001, len), 1); rod.quaternion.setFromUnitVectors(UP, dd); };
      set(globe.top, 1, 1.5); set(globe.bot, -1, 1.2); globe.tip.position.copy(dir).multiplyScalar(R * (0.96 + 0.54 * o)); globe.hl.position.copy(globe.tip.position);
      globe.lbl.position.copy(dir).multiplyScalar(R * 1.5 + 0.26 * R); globe.lbl.visible = o > 0.6; }

    MODES.history.lay = o => { skinLines.scale.setScalar(0.955 + 0.045 * o); skinLines.visible = o > 0.01; }; MODES.history.load = () => Promise.resolve(); MODES.history.caption = () => 'Every measure as a line round the Object. Time runs round it; a line rises where the measure delivered and falls where it frustrated.';
    MODES.chamber.lay = (o, dt) => { if (!chamber.group) return; chamber.group.visible = o > 0.01; Object.keys(chamber.k).forEach(ch => { const K = chamber.k[ch]; K.tilt += (K.to - K.tilt) * Math.min(1, dt * 2.2); }); layChamber(o); };
    MODES.chamber.load = loadChamber; MODES.chamber.caption = chamberCaption;
    MODES.lives.lay = layLives; MODES.lives.load = loadLives; MODES.lives.caption = livesCaption;
    MODES.globe.lay = layGlobe; MODES.globe.load = () => (loaded ? Promise.resolve() : (loading || load())).then(buildGlobe); MODES.globe.caption = () => globe.cap || '';
    const tell = () => { if (api.onMode) try { api.onMode(mode, MODES[mode].caption()); } catch (e) {} };
    function setMode(name, auto) { if (!MODES[name]) return; autoMode = !!auto;
      MODES[name].load().then(() => { if (name === mode && !modeTo) { tell(); return; } modeTo = name; }).catch(e => { try { console.warn('[prism-model] the ' + name + ' could not be read', e); } catch (x) {} }); }
    function stepModes(dt) { const sp = dt / 0.9;
      if (modeTo && modeTo !== mode) { MODES[mode].open = Math.max(0, MODES[mode].open - sp); uVeil.value = Math.min(1, uVeil.value + sp);
        if (MODES[mode].open <= 0) { mode = modeTo; modeTo = null; tell(); } }
      else { modeTo = null; MODES[mode].open = Math.min(1, MODES[mode].open + sp); uVeil.value = Math.max(0, uVeil.value - sp); }
      Object.keys(MODES).forEach(k => { const m = MODES[k]; if (m.lay) m.lay(ease(m.open), dt); }); }

    // ── THE PRISM: the navtool's triangle with depth, wearing the navtool's own film ──
    const prismFrame = new THREE.Group(); prismFrame.position.copy(P); prismFrame.quaternion.setFromRotationMatrix(basis); add(prismFrame);
    const prism = new THREE.Group(); prism.rotation.z = TILT; prismFrame.add(prism);
    { const s = new THREE.Shape(); s.moveTo(-0.5 * PS, -0.42 * PS); s.lineTo(0.5 * PS, -0.42 * PS); s.lineTo(0, 0.5 * PS); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: PD, bevelEnabled: false }); g.center();
      const body = new THREE.Mesh(g, shader({ uniforms: { uT, uAir }, side: THREE.DoubleSide,
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform float uT; uniform float uAir; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float t = f * 1.1 + uT * 0.02; vec3 c = 0.5 + 0.5 * cos(6.2831853 * t * 1.3 / vec3(0.65, 0.532, 0.473)); vec3 col = mix(vec3(0.75, 0.82, 1.0), c, 0.5 - 0.12 * uAir); gl_FragColor = vec4(col, 0.16 + (0.52 - 0.12 * uAir) * f); }' }));
      body.renderOrder = 2; add(body, prism);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), lineM(0xffffff, 0.6)); e.renderOrder = 3; add(e, prism); }

    // a shaft of light between two points: a ribbon that always turns to face you
    function shaft(a, b, w0, w1, frag, order, depthTest) {
      const segs = 24, pos = [], uv = [], idx = [];
      for (let i = 0; i <= segs; i++) { const t = i / segs; pos.push(t, -1, 0, t, 1, 0); uv.push(t, 0, t, 1); if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      const m = new THREE.Mesh(g, shader(Object.assign({ uniforms: { uT, uAir, uA: { value: a }, uB: { value: b }, uW: { value: new THREE.Vector2(w0, w1) }, uAlpha: { value: 1 } }, depthTest: depthTest !== false, side: THREE.DoubleSide,
        vertexShader: 'uniform vec3 uA; uniform vec3 uB; uniform vec2 uW; varying vec2 vUv; void main(){ vUv = uv; vec3 p = mix(uA, uB, position.x); vec3 ax = normalize(uB - uA); vec3 side = normalize(cross(ax, cameraPosition - p)); p += side * position.y * mix(uW.x, uW.y, position.x); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'varying vec2 vUv; uniform float uT; uniform float uAlpha; uniform float uAir;\n' + FILM + '\n' + frag }, LIGHT)));
      m.frustumCulled = false; m.renderOrder = order; return add(m);
    }
    shaft(SRC, ENTRY, 0.34 * S, 0.26 * S, ['void main(){ float u = vUv.x, d = vUv.y - 0.5; float core = exp(-d*d / 0.006), halo = exp(-d*d / 0.07) * 0.30;',
      '  float a = (core + halo) * mix(0.55, 1.0, u) * smoothstep(0.0, 0.03, u);',
      '  vec3 col = mix(CREAM, film(u * 0.6 - uT * 0.08), 0.05 + 0.10 * halo); float A = a * 0.85 * uAlpha; gl_FragColor = vec4(col * A, min(1.0, A) * uAir); }'].join('\n'), 1);
    shaft(ENTRY, EXITC, 0.10 * S, 0.34 * S, ['void main(){ float u = vUv.x, d = vUv.y - 0.5; float a = exp(-d*d / mix(0.02, 0.09, u)) * mix(0.8, 0.5, u);',
      '  vec3 col = mix(CREAM, film(vUv.y * 0.5 + u * 0.3 + uT * 0.05), 0.08 + 0.2 * u); float A = a * 0.7 * uAlpha; gl_FragColor = vec4(col * A, min(1.0, A) * uAir); }'].join('\n'), 4, false);

    // ── the light after the glass: one volume, opening onto the whole map ──
    const stationU = { cLI: { value: new THREE.Color(ST.LI) }, cRI: { value: new THREE.Color(ST.RI) }, cLP: { value: new THREE.Color(ST.LP) }, cRP: { value: new THREE.Color(ST.RP) } };
    const FIELD = 'uniform vec3 cLI; uniform vec3 cRI; uniform vec3 cLP; uniform vec3 cRP;\nvec3 field(vec2 n){ vec2 s = smoothstep(0.08, 0.92, n); return mix(mix(cLI, cRI, s.x), mix(cLP, cRP, s.x), s.y); }';
    let fan;
    { const N = opts.sheets || 7, SU = 14, SV = 10, pos = [], nm = [], uv = [], idx = []; let base = 0;
      for (let fam = 0; fam < 2; fam++) for (let k = 0; k < N; k++) { const fx = k / (N - 1);
        for (let iv = 0; iv <= SV; iv++) for (let iu = 0; iu <= SU; iu++) { const v = iv / SV, u = iu / SU, a = fam ? fx : v, b = fam ? v : fx;
          const f = footAt(a, b), p = exitAt(a, b).lerp(f, u), q = f.sub(C); pos.push(p.x, p.y, p.z); nm.push(q.dot(EX) / M + 0.5, q.dot(EZ) / M + 0.5); uv.push(u, v); }
        for (let iv = 0; iv < SV; iv++) for (let iu = 0; iu < SU; iu++) { const i0 = base + iv * (SU + 1) + iu, i1 = i0 + 1, i2 = i0 + SU + 1, i3 = i2 + 1; idx.push(i0, i2, i1, i1, i2, i3); }
        base += (SV + 1) * (SU + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('nm', new THREE.Float32BufferAttribute(nm, 2)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      fan = new THREE.Mesh(g, shader(Object.assign({ uniforms: Object.assign({ uT, uAir, uAlpha: { value: opts.fan != null ? opts.fan : 1 } }, stationU), side: THREE.DoubleSide,
        vertexShader: 'attribute vec2 nm; varying vec2 vN2; varying vec2 vUv; void main(){ vN2 = nm; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: ['varying vec2 vN2; varying vec2 vUv; uniform float uT; uniform float uAlpha; uniform float uAir;', FILM, FIELD,
          'void main(){ float u = vUv.x, v = vUv.y; vec3 col = mix(CREAM, field(vN2), smoothstep(0.02, 0.62, u)); col = mix(col, CREAM, 0.14);',
          '  col = mix(col, film(u * 0.9 + v * 0.4 - uT * 0.03) * 0.6 + CREAM * 0.4, 0.07);',
          '  float a = smoothstep(0.0, 0.12, v) * smoothstep(1.0, 0.88, v) * smoothstep(0.0, 0.05, u) * mix(1.7 - 0.6 * uAir, 0.55, smoothstep(0.0, 0.8, u));',
          '  float A = a * ' + (0.052 * 9 / N).toFixed(4) + ' * uAlpha; gl_FragColor = vec4(col * A, A * uAir); }'].join('\n') }, LIGHT)));
      fan.renderOrder = 1; fan.frustumCulled = false; add(fan); }

    // ── THE MAP, lying on the water: a field of four colours with no seam; from below, the film ──
    const mapFrame = new THREE.Group(); mapFrame.position.copy(C); mapFrame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(EX, UP, EZ)); add(mapFrame);
    { const plane = new THREE.Mesh(new THREE.PlaneGeometry(M, M), shader({ uniforms: Object.assign({ uT }, stationU), side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: ['varying vec2 vUv; varying vec3 vW; uniform float uT;', FILM, FIELD,
          'float ring(float r, float at){ return smoothstep(0.014, 0.0, abs(r - at)); }',
          'void main(){ vec2 n = vec2(vUv.x, 1.0 - vUv.y); vec2 q = (n - 0.5) * 2.8; float r = length(q);',
          '  vec3 col = mix(field(n), CREAM, 0.12); float edge = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x) * smoothstep(0.0, 0.07, vUv.y) * smoothstep(1.0, 0.93, vUv.y);',
          '  float a = 0.36 * edge;',
          '  float lines = max(ring(r, 0.5051), ring(r, 0.8562)) * 0.5;',          // Dia 33 and 66
          '  lines = max(lines, (smoothstep(0.008, 0.0, abs(q.x)) + smoothstep(0.008, 0.0, abs(q.y))) * 0.35);',
          '  if (!gl_FrontFacing) { vec3 V = normalize(cameraPosition - vW); float g = 1.0 - abs(V.y);',
          '    col = mix(mix(col, vec3(dot(col, vec3(0.333))), 0.55) * vec3(0.97, 0.98, 1.04), mix(film(r * 0.10 + g * 0.55 + uT * 0.01), CREAM, 0.45), 0.34); a = 0.34 * edge; }',
          '  col = mix(col, CREAM, lines); a = max(a, lines * edge * 0.8);',
          '  gl_FragColor = vec4(col, a); }'].join('\n') }));
      plane.rotation.x = -Math.PI / 2; plane.position.y = 0.01; plane.renderOrder = 6; add(plane, mapFrame);
      // the depth under the water, as fine lines, so what hangs below hangs in something
      const h = HALF, y = -ZH - 0.08 * S, pts = [], k = [[-h, -h], [h, -h], [h, h], [-h, h]];
      k.forEach((p, i) => { const q = k[(i + 1) % 4]; pts.push(p[0], 0, p[1], p[0], y, p[1], p[0], y, p[1], q[0], y, q[1]); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); add(new THREE.LineSegments(g, lineM(0x8fa0c8, 0.22)), mapFrame);
      // the mast: the one axis the body has
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute([0, -ZH, 0, 0, ZH, 0], 3)); add(new THREE.Line(mg, lineM(CREAM, 0.6)), mapFrame);
      [-1, -0.5, 0.5, 1].forEach(z => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.035 * S, 0.006 * S, 6, 20), basic(CREAM, { transparent: true, opacity: 0.6 })); t.rotation.x = Math.PI / 2; t.position.y = z * ZH; add(t, mapFrame); });
      [['LI', 0, 0], ['RI', 1, 0], ['LP', 0, 1], ['RP', 1, 1]].forEach(a => { const s = text(a[0], ST[a[0]], 0.34 * S); s.position.set((a[1] * 1.14 - 0.57) * M, 0.12 * S, (a[2] * 1.14 - 0.57) * M); add(s, mapFrame); });
      const up = text('+1  delivered', CREAM, 0.26 * S); up.position.set(0, ZH + 0.16 * S, 0); add(up, mapFrame);
      const dn = text('−1  frustrated', CREAM, 0.26 * S); dn.position.set(0, -ZH - 0.16 * S, 0); add(dn, mapFrame); }
    const local = (nx, ny, y) => new V3((nx - 0.5) * M, y || 0, (ny - 0.5) * M);       // a place on the map, in the map's own frame

    // ── what the data fills ──
    const rings = {}, skinOf = {}; let pins = [], notes = [], ripples = [], dyn = new THREE.Group(), room = null;
    add(dyn, mapFrame);
    let D = null, B = null, MOM = {}, NOW = 0, T0 = 0, when = 0, called = null, lastLedger = -1, ledger = [];
    let playing = false, tPlay = 0, GAP = 0.2, lastT = null, objTo = 0, loading = null, loaded = null, lastLine = -1;
    const DUR = 2.6, SPAN = 5.2;
    const dir0 = ENTRY.clone().sub(O), BETA0 = Math.atan2(-dir0.z, dir0.x);
    const lonOf = dd => (dd - T0) / Math.max(1, NOW - T0) * SPAN;
    const onSkin = (lon, lat) => new V3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)).multiplyScalar(R * 1.004);
    const asOf = (rs, dd) => { let best = null; for (let i = 0; i < rs.length; i++) if (day(rs[i][0]) <= dd) best = rs[i]; return best; };
    const get = u => fetch(u + '?' + Date.now()).then(r => { if (!r.ok) throw new Error(u); return r.json(); });

    function clear() { while (dyn.children.length) dyn.remove(dyn.children[0]); while (skinLines.children.length) skinLines.remove(skinLines.children[0]);
      notes.forEach(n => group.remove(n)); ripples.forEach(m => mapFrame.remove(m)); pins = []; notes = []; ripples = []; Object.keys(rings).forEach(k => delete rings[k]); Object.keys(skinOf).forEach(k => delete skinOf[k]); room = null;
      if (lives.group) { object.remove(lives.group); lives.group = null; lives.rays = []; lives.pts = null; } }      // the lives are placed by the set's dates: rebuilt with it

    function build() {
      clear();
      const L = D.lines.filter(l => l.dia != null).sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.i - b.i);
      const where = {}; D.cloud.forEach(w => { if (!where[w.line]) where[w.line] = w; });
      const dates = L.map(l => l.date).concat(B.room.readings.map(r => r[0]), [(D.at || '').slice(0, 10), B.built]); B.body.forEach(m => m.readings.forEach(r => dates.push(r[0])));
      const ds = dates.filter(Boolean).map(day); NOW = Math.max.apply(null, ds); T0 = Math.min.apply(null, ds); ledger = (B.topic && B.topic.ledger) || [];
      // the body on the Object's skin: each measure a line of latitude, time running round, the line rising where it delivered
      B.body.forEach((m, n) => { if (!m.readings.length) return; const lat0 = lerp(0.92, -0.92, n / Math.max(1, B.body.length - 1)), pts = [];
        const zAt = dd => { const rs = m.readings; let i = -1; for (let k = 0; k < rs.length; k++) if (day(rs[k][0]) <= dd) i = k; if (i < 0) return null;
          if (m.kind === 'state' || i === rs.length - 1) return rs[i][1]; const a = day(rs[i][0]), b = day(rs[i + 1][0]); return lerp(rs[i][1], rs[i + 1][1], (dd - a) / Math.max(1, b - a)); };
        for (let dd = T0; dd <= NOW; dd += Math.max(1, Math.round((NOW - T0) / 220))) { const z = zAt(dd); if (z == null) continue; const p = onSkin(lonOf(dd), lat0 + z * 0.075); pts.push(p.x, p.y, p.z); }
        if (pts.length < 6) { const z = m.readings[m.readings.length - 1][1], d0 = day(m.readings[0][0]); pts.length = 0; for (let k = 0; k <= 6; k++) { const p = onSkin(lonOf(lerp(d0, NOW, k / 6)), lat0 + z * 0.075); pts.push(p.x, p.y, p.z); } }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const line = new THREE.Line(g, lineM(BODYCOL[m.id] || 0xd4a94e, 0.7, { depthWrite: false }));
        add(line, skinLines); skinOf[m.id] = line;
        // and on the mast: a ring at its height
        const t = new THREE.Mesh(new THREE.TorusGeometry((0.055 + 0.013 * n) * S, 0.007 * S, 6, 36), basic(BODYCOL[m.id] || 0xd4a94e, { transparent: true, opacity: 0.95 })); t.rotation.x = Math.PI / 2;
        const wide = new THREE.Mesh(new THREE.TorusGeometry(HALF * 1.02, 0.008 * S, 6, 96), basic(BODYCOL[m.id] || 0xd4a94e, { transparent: true, opacity: 0.85 })); wide.rotation.x = Math.PI / 2; wide.visible = false;
        const g2 = new THREE.Group(); g2.add(t, wide); add(g2, dyn); rings[m.id] = { g: g2, small: t, wide, m }; });
      // the room: the day's average of the talk, as a level
      { const h = HALF * 0.98, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h, -h, 0, -h], 3));
        const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: lin(CREAM), transparent: true, opacity: 0.6, dashSize: 0.07 * S, gapSize: 0.05 * S, toneMapped: false, fog: false, depthWrite: false })); l.computeLineDistances();
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(h * 2, h * 2), basic(CREAM, { transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false })); sheet.rotation.x = -Math.PI / 2;
        room = new THREE.Group(); room.add(l, sheet); add(room, dyn); }
      // the lines
      L.forEach((l, k) => { const w = where[l.i] || { normX: 0.5, normY: 0.5 }, hx = ST[l.station] || CREAM, col = new THREE.Color(hx);
        const pos = local(w.normX, w.normY, (l.z == null ? 0 : l.z) * ZH), lum = typeof l.lumens === 'number' ? l.lumens : 0, g = new THREE.Group(); g.position.copy(pos);
        const p = { l, g, pos, d: day(l.date), shown: 1, world: mapAt(w.normX, w.normY, pos.y) };
        if (l.z == null) {   // a line about who is to blame: a ring lying on the water, unlit
          const r = new THREE.Mesh(new THREE.RingGeometry(0.04 * S, 0.058 * S, 24), basic(0, { color: col.clone().lerp(new THREE.Color(0x7c8499), 0.45).convertSRGBToLinear(), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
          r.rotation.x = -Math.PI / 2; r.position.y = 0.03 * S; g.add(r);
        } else {
          // Lumens is the light it holds: in the dark, brightness; in a bright room, colour (a pale dot, never a dark one)
          p.cBright = new THREE.Color(0xe4e1da).lerp(col, 0.12 + 0.88 * lum).multiplyScalar(0.92 + 0.2 * lum).convertSRGBToLinear();
          p.cDark = new THREE.Color(0x8d93a6).lerp(col, 0.22 + 0.78 * lum).multiplyScalar(0.55 + 0.75 * lum).convertSRGBToLinear();
          p.dot = new THREE.Mesh(new THREE.SphereGeometry(0.052 * S, 14, 10), basic(0, { color: (BRIGHT ? p.cBright : p.cDark).clone() })); g.add(p.dot);
          const spread = std(l.runs) / 100; p.haloA = 0.16 + 0.8 * lum; p.halo = glow(hx, (0.26 + spread * 2.2 + lum * 0.3) * S, p.haloA); g.add(p.halo);
          const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -pos.y, 0], 3)); g.add(new THREE.Line(sg, lineM(hx, 0.3)));
          if (l.runs && l.dia && spread > 0) { const r0 = Math.hypot(pos.x, pos.z), ux = pos.x / r0, uz = pos.z / r0, rOf = run => (0.055 + run / 100 * 0.38) * M * (r0 / ((0.055 + l.dia / 100 * 0.38) * M));
            l.runs.forEach(run => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.014 * S, 6, 5), basic(hx, { transparent: true, opacity: 0.45 })); m.position.set(ux * rOf(run) - pos.x, 0, uz * rOf(run) - pos.z); g.add(m); });
            const a0 = rOf(Math.min.apply(null, l.runs)), a1 = rOf(Math.max.apply(null, l.runs)), tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([ux * a0 - pos.x, 0, uz * a0 - pos.z, ux * a1 - pos.x, 0, uz * a1 - pos.z], 3)); g.add(new THREE.Line(tg, lineM(hx, 0.25))); }
        }
        const f = l.forecast, at = f && (f.atDue || f.latest);
        if (f && at && at.z != null) { const wd = (f.result || 'open').replace(' so far', ''), pc = PINCOL[wd] || PINCOL.open, dy = at.z * ZH - pos.y;
          const fd = new THREE.Mesh(new THREE.OctahedronGeometry(0.036 * S), basic(pc, { transparent: true, opacity: f.cameDue ? 1 : 0.6 })); fd.position.y = dy;
          const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, dy, 0], 3));
          const tie = new THREE.Line(tg, new THREE.LineDashedMaterial({ color: lin(pc), transparent: true, opacity: 0.8, dashSize: 0.05 * S, gapSize: 0.04 * S, toneMapped: false, fog: false })); tie.computeLineDistances();
          p.fc = new THREE.Group(); p.fc.add(fd, tie); g.add(p.fc); p.fcDay = f.cameDue && f.due && /^\d{4}-/.test(f.due) ? day(f.due) : NOW; }
        add(g, dyn); pins.push(p);
        // its parallelogram, for the replay
        const ng = new THREE.BufferGeometry(), nw = 0.125 * S, nh = 0.072 * S, sk = 0.033 * S;
        ng.setAttribute('position', new THREE.Float32BufferAttribute([-nw - sk, -nh, 0, nw - sk, -nh, 0, nw + sk, nh, 0, -nw + sk, nh, 0], 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); ng.setIndex([0, 1, 2, 0, 2, 3]);
        const note = new THREE.Mesh(ng, shader({ uniforms: { uT, uMix: { value: 0 }, uC: { value: new THREE.Color(hx) }, uAlpha: { value: 0 } }, depthTest: false, side: THREE.DoubleSide,
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec2 vUv; uniform float uT; uniform float uMix; uniform float uAlpha; uniform vec3 uC;\n' + FILM + '\nvoid main(){ vec3 c = mix(CREAM, film(vUv.x * 0.8 + vUv.y * 0.5 + uT * 0.2), ' + (BRIGHT ? '0.22' : '0.45') + '); c = mix(c, uC, uMix); float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)); gl_FragColor = vec4(c, (0.34 + 0.5 * smoothstep(0.12, 0.0, e)) * uAlpha); }' }));
        note.visible = false; note.renderOrder = 9; note.frustumCulled = false; add(note); notes.push(note); p.ab = abOf(p.world); });
      // a boundary: a film standing between a line and the earlier line it turns on, the track through it
      Object.keys(MOM).forEach(i => { const m = MOM[i], a = pins.find(p => p.l.i === +m.turnsOn), b = pins.find(p => p.l.i === +i); if (!a || !b) return;
        const mid = a.pos.clone().lerp(b.pos, 0.5), dir = b.pos.clone().sub(a.pos); if (dir.length() < 0.02 * S) dir.set(0.01, 0.2, 0.01);
        const g = new THREE.Group(), tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z], 3)); g.add(new THREE.Line(tg, lineM(0xe0b77a, 0.8)));
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16 * S, 32), shader({ uniforms: { uT }, side: THREE.DoubleSide,
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec2 vUv; uniform float uT;\n' + FILM + '\nvoid main(){ float r = length(vUv - 0.5) * 2.0; vec3 c = film(r * 0.7 + uT * 0.04 + noise(vec3(vUv * 5.0, uT * 0.2)) * 0.5); gl_FragColor = vec4(c * 0.8 + 0.2, (0.16 + 0.5 * smoothstep(0.6, 1.0, r)) * smoothstep(1.0, 0.93, r)); }' }));
        disc.position.copy(mid); disc.lookAt(mid.clone().add(dir)); g.add(disc); add(g, dyn); b.boundary = g; });
      GAP = clamp(9 / Math.max(1, pins.length), 0.07, 0.4); lastLedger = -1; if (lives.data) buildLives(); setWhen(NOW, true); object.rotation.y = objTo;
    }

    function showPin(p, a) { p.shown = a; p.g.visible = a > 0.01; p.g.scale.setScalar(0.4 + 0.6 * a); if (p.halo) p.halo.material.opacity = p.haloA * a; }
    function ripple() { const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64), basic(CREAM, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.04 * S; m.userData.t = 0; add(m, mapFrame); ripples.push(m); }
    function setWhen(dd, quiet) { if (!D) return; when = dd;
      B.body.forEach(m => { const r = rings[m.id]; if (!r) return; const rd = asOf(m.readings, dd); r.g.visible = !!rd; if (rd) r.g.position.y = rd[1] * ZH; });
      const rr = asOf(B.room.readings, dd), near = rr && dd - day(rr[0]) <= 3; if (room) { room.visible = !!near; if (near) room.position.y = rr[1] * ZH; }
      let li = -1; ledger.forEach((e, i) => { if (day(e[0]) <= dd) li = i; }); if (li !== lastLedger && li >= 0 && !quiet) ripple(); lastLedger = li;
      objTo = BETA0 - lonOf(dd);                       // the Object turns so that this day faces the glass
      if (!playing) pins.forEach(p => showPin(p, p.d <= dd ? 1 : 0));
      pins.forEach(p => { if (p.fc) p.fc.visible = p.fcDay <= dd && p.shown > 0.5; if (p.boundary) p.boundary.visible = p.d <= dd && p.shown > 0.5; });
      whenLives(); whenGlobe(); if ((mode === 'lives' || mode === 'globe') && !modeTo) tell();
      if (api.onWhen) try { api.onWhen(dd, li >= 0 ? ledger[li] : null); } catch (e) {} }
    function callUp(id) { called = called === id ? null : id;
      Object.keys(rings).forEach(k => { const on = k === called; rings[k].wide.visible = on; rings[k].small.material.opacity = called && !on ? 0.3 : 0.95; if (skinOf[k]) skinOf[k].material.opacity = on ? 1 : called ? 0.2 : 0.7; });
      pins.forEach(p => { if (p.halo) p.halo.material.opacity = p.haloA * p.shown * (called && p.l.measure !== called ? 0.2 : 1); }); }
    function play() { if (!D) return; playing = true; tPlay = 0; lastLine = -1; pins.forEach(p => showPin(p, 0)); setWhen(pins.length ? pins[0].d : NOW, true); }
    function stop() { playing = false; notes.forEach(n => { n.visible = false; }); if (autoMode && mode !== 'history') setMode('history', true); }
    function stepPlay(dt, camera) { tPlay += dt; let latest = -1;
      pins.forEach((p, k) => { const n = notes[k], t = (tPlay - k * GAP) / DUR; if (t <= 0) { n.visible = false; return; } latest = k;
        if (t >= 1) { n.visible = false; if (p.shown < 1) showPin(p, Math.min(1, p.shown + dt * 4)); return; }
        n.visible = true; const ex = exitAt(p.ab[0], p.ab[1]);
        if (t < 0.36) n.position.lerpVectors(SRC, ENTRY, ease(t / 0.36)); else if (t < 0.56) n.position.lerpVectors(ENTRY, ex, (t - 0.36) / 0.2); else n.position.lerpVectors(ex, p.world, ease((t - 0.56) / 0.44));
        n.material.uniforms.uMix.value = clamp((t - 0.56) / 0.3, 0, 1) * 0.85; n.material.uniforms.uAlpha.value = Math.min(1, t * 12) * (t > 0.92 ? (1 - t) / 0.08 : 1); if (camera) n.quaternion.copy(camera.quaternion); });
      if (latest >= 0 && pins[latest].d !== when) setWhen(pins[latest].d);
      if (latest >= 0 && latest !== lastLine) { lastLine = latest; const l = pins[latest].l;      // the Object shows the part of itself the line is about
        if (l.measure === 'law') { setMode('chamber', true); loadChamber().then(() => { let vi = -1; chamber.data.votes.forEach((v, i) => { if (v.why === 'topic' && v.date <= l.date) vi = i; }); setVote(vi); }).catch(() => {}); }
        else if (l.measure === 'lives') setMode('lives', true);
        else if (autoMode && mode !== 'history') setMode('history', true); }
      pins.forEach(p => { if (p.fc) p.fc.visible = p.shown > 0.5 && p.fcDay <= when; if (p.boundary) p.boundary.visible = p.shown > 0.5; });
      if (tPlay > (pins.length - 1) * GAP + DUR + 0.6) { stop(); setWhen(NOW); } }

    function load(id) { id = id || opts.set || 'tucker_record'; const base = opts.data || '../data/';
      loading = Promise.all([get(base + 'parallelograms/' + id + '.json'), get(base + 'active/object.json')]).then(r => { D = r[0]; B = r[1]; MOM = {};
        const sw = ((D.scoreboard || {}).gnostic || []).length; return sw ? get(base + 'parallelograms/' + id + '.gnostic.json').then(g => { MOM = g.moments || {}; }).catch(() => {}) : null;
      }).then(() => { build(); loaded = id; return api; });
      return loading; }
    function show(on) { group.visible = !!on; if (!on) { stop(); return; } (loaded ? Promise.resolve() : (loading || load())).then(() => { if (group.visible && opts.replay !== false) play(); }).catch(e => { try { console.warn('[prism-model] the set could not be read', e); } catch (x) {} }); }
    function update(t, camera) { const dt = lastT == null ? 0.016 : clamp(t - lastT, 0, 0.05); lastT = t; if (!group.visible) return; uT.value = t;
      if (playing) stepPlay(dt, camera);
      stepModes(dt);
      if (camera) { const f = toCam.copy(camera.position).sub(O).normalize().dot(srcDir); srcGlow.material.opacity = 0.8 * clamp((f + 0.25) / 0.85, 0, 1); }
      object.rotation.y += (objTo - object.rotation.y) * Math.min(1, dt * 3);
      prism.rotation.z = TILT + Math.sin(t * 0.4) * 0.012; prism.rotation.x = Math.sin(t * 0.27) * 0.03;
      for (let i = ripples.length - 1; i >= 0; i--) { const m = ripples[i]; m.userData.t += dt; const u = m.userData.t / 2.4; m.scale.setScalar(0.1 + u * HALF * 1.5); m.material.opacity = 0.7 * (1 - u); if (u >= 1) { mapFrame.remove(m); ripples.splice(i, 1); } } }

    const api = { group, show, update, load, play, stop, setWhen, callUp, onWhen: null, onMode: null, onFace: null, setMode, setVote, loadChamber, modes: Object.keys(MODES),
      get mode() { return modeTo || mode; }, get vote() { return chamber.vote; }, get votes() { return chamber.data ? chamber.data.votes : []; }, get caption() { return MODES[mode].caption(); }, setAir: v => { if (Math.abs(v - uAir.value) < 0.004) return; uAir.value = v; if (BRIGHT) { const k = clamp((v - 0.1) / 0.6, 0, 1); pins.forEach(p => { if (p.dot) p.dot.material.color.copy(p.cDark).lerp(p.cBright, k); }); } },
      get now() { return NOW; }, get pins() { return pins; }, get data() { return D; },
      at: { object: O, prism: P, map: C, entry: ENTRY, source: SRC, zh: ZH, scale: S } };
    return api;
  }

  root.PrismModel = { create };
})(typeof window !== 'undefined' ? window : this);
