/* dg-pierce.js — the DreamGetty pierces the graphmap (2026-10-17, Sailor).
   The graphmap is itself a piercing object; when the user starts placing a pin,
   three things from the villa come through it: the columns, the Venus de Milo,
   and Ted Turner the coyote. They fade in with an iridescent shimmer. Ted walks
   in from off-screen over ten seconds, then goes about his business (sits,
   lies down, sniffs around, cleans himself, scratches, yawns, watches your pin).

   Usage:  const dg = DGPierce.attach(graphmapInstance, { venus: '../dreamgetty/venus_de_milo_aphrodite_of_milos/scene.gltf' });
           dg.start();      // idempotent
   Needs THREE (r128), PrismGraphmap (for Ted), and THREE.GLTFLoader for the Venus. */
(function (root) {
  'use strict';
  const FLOOR = -1.7;                       // the graphmap's gallery floor (scene space), Ted's floor
  const FADE = 2.6;                         // seconds to fade in
  const WALK = 10;                          // Ted's walk-in, seconds

  // ── the villa's Ionic column, dark stone with gilt beading (ported from dreamgetty buildColumn) ──
  function column(x, z, H) {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x1a1814, roughness: 0.45, metalness: 0.08 });
    const gilt = new THREE.MeshStandardMaterial({ color: 0xc9a55f, metalness: 0.7, roughness: 0.32, emissive: 0x3a2c10, emissiveIntensity: 0.55 });
    const put = (geo, mat, y, rx) => { const m = new THREE.Mesh(geo, mat); m.position.set(0, y, 0); if (rx) m.rotation.x = rx; g.add(m); return m; };
    put(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 24), stone, 0.03);
    put(new THREE.TorusGeometry(0.30, 0.04, 8, 24), stone, 0.085, Math.PI / 2);
    put(new THREE.CylinderGeometry(0.26, 0.30, 0.045, 24), stone, 0.125);
    const shaftH = H - 0.5, geo = new THREE.CylinderGeometry(0.16, 0.22, shaftH, 48, 8), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), pz = pos.getZ(i), r = Math.hypot(px, pz); if (r < 0.001) continue; const c = Math.cos(Math.atan2(pz, px) * 24); const nr = r - (c > 0 ? 0.025 * c * c : 0.002 * Math.abs(c)); pos.setX(i, px * nr / r); pos.setZ(i, pz * nr / r); }
    geo.computeVertexNormals(); put(geo, stone, 0.14 + shaftH / 2);
    put(new THREE.TorusGeometry(0.17, 0.024, 8, 24), stone, H - 0.36, Math.PI / 2);
    [[0.168, H - 0.40, 1.3], [0.235, 0.16, 1.5]].forEach(([R, y, s]) => { for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 6, 5), gilt); b.scale.set(1.6, 1, 1); b.position.set(Math.cos(a) * R, y, Math.sin(a) * R); b.rotation.y = -(a + Math.PI / 2); g.add(b); } });
    put(new THREE.BoxGeometry(0.5, 0.15, 0.5), stone, H - 0.18);
    [-1, 1].forEach(side => { const v = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 16), stone); v.position.set(side * 0.24, H - 0.18, 0); v.rotation.y = Math.PI / 2; g.add(v); const v2 = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.015, 6, 12), stone); v2.position.copy(v.position); v2.rotation.y = Math.PI / 2; g.add(v2); });
    put(new THREE.BoxGeometry(0.54, 0.05, 0.54), stone, H + 0.01);
    g.position.set(x, FLOOR, z);
    return g;
  }

  // ── the Venus's nacre (ported from dreamgetty applyVenusIridescence), with a strength we can swell during the fade ──
  const iri = { uIriStrength: { value: 0.825 }, uIriFilmNm: { value: 420 }, uIriPower: { value: 1.4 } };
  function nacre(mat) {
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, iri);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIriWorld;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvIriWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vIriWorld;\nuniform float uIriStrength;\nuniform float uIriFilmNm;\nuniform float uIriPower;').replace('#include <lights_fragment_end>', [
        '#include <lights_fragment_end>', '{',
        '  vec3 iriV = normalize(vViewPosition); float iriNdV = clamp(dot(normal, iriV), 0.0, 1.0);',
        '  float iriRim = pow(1.0 - iriNdV, uIriPower);',
        '  float iriTh = uIriFilmNm * (1.0 + 0.16 * sin(vIriWorld.y * 2.7 + vIriWorld.x * 1.9) + 0.09 * sin(vIriWorld.y * 6.1 + vIriWorld.z * 3.3));',
        '  float iriCosT = sqrt(max(0.0, 1.0 - (1.0 - iriNdV * iriNdV) / 1.9044)); float iriOpd = 2.0 * 1.38 * iriTh * iriCosT;',
        '  vec3 iriFilm = mix(vec3(1.0), 0.5 + 0.5 * cos(6.2831853 * vec3(iriOpd) / vec3(650.0, 532.0, 473.0)), 0.9);',
        '  vec3 iriLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + vec3(0.06);',
        '  float iriF = clamp(iriRim * uIriStrength, 0.0, 1.0);',
        '  reflectedLight.directDiffuse *= 1.0 - iriF * 0.85; reflectedLight.indirectDiffuse *= 1.0 - iriF * 0.85;',
        '  reflectedLight.indirectSpecular += iriFilm * iriF * 1.5 * iriLight;', '}'].join('\n'));
    };
    mat.needsUpdate = true;
  }

  function attach(gm, opts) {
    opts = opts || {};
    const scene = gm.scene; if (!scene || !root.THREE) return { start() {}, stop() {} };
    const rig = new THREE.Group(); rig.visible = false; scene.add(rig);
    const fadeMats = [];        // { mat, base } — every material that fades in, with its resting emissive
    function track(obj) { obj.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.__dg) return; m.__dg = true; m.transparent = true; m.opacity = 0; fadeMats.push({ mat: m, t: performance.now() / 1000, em: m.emissive ? m.emissive.clone() : null, ei: m.emissiveIntensity || 0 }); }); }); }
    // a little light of their own so the villa reads in the graphmap's dark
    const key = new THREE.DirectionalLight(0xfff1dc, 0.3); key.position.set(-2, 5, 4); rig.add(key);
    rig.add(new THREE.AmbientLight(0x8090b0, 0.18));
    // the columns: two behind the plane, two forward at the sides — tall enough to run out of frame
    [[-2.7, -3.0], [2.9, -3.0], [-2.25, 1.55], [2.35, 1.55]].forEach(([x, z]) => { const c = column(x, z, 5.2); rig.add(c); track(c); });
    // the Venus, right of the plane, turned toward it
    if (opts.venus && THREE.GLTFLoader) {
      new THREE.GLTFLoader().load(opts.venus, gltf => {
        const v = gltf.scene, box = new THREE.Box3().setFromObject(v), s = 2.5 / (box.max.y - box.min.y);
        v.scale.setScalar(s); box.setFromObject(v); v.position.set(2.05, FLOOR - box.min.y, -1.3); v.rotation.y = -Math.PI * 0.3;
        v.traverse(o => { if (o.isMesh) nacre(o.material); });
        rig.add(v); track(v);
      }, undefined, e => console.warn('[dg-pierce] Venus did not load', e && e.message));
    }
    // Ted, from the factory's own coyote
    let ted = null;
    try { ted = (typeof PrismGraphmap !== 'undefined' && PrismGraphmap.buildCoyote) ? PrismGraphmap.buildCoyote() : null; } catch (e) {}
    if (ted) { ted.scale.setScalar(0.5); rig.add(ted); track(ted); }

    // ── Ted's path and business ──
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.3, FLOOR, 1.95), new THREE.Vector3(-3.1, FLOOR, 1.7), new THREE.Vector3(-2.1, FLOOR, 1.45), new THREE.Vector3(-1.45, FLOOR, 1.25), new THREE.Vector3(-0.95, FLOOR, 1.15)]);
    const POSES = {   // [frontHip, frontKnee, hindHip, hindKnee, bodyPitch, drop]
      stand: [0, 0, 0, 0, 0, 0],
      sit:   [0.42, 0, -0.10, -1.04, -0.30, 0.10],
      lie:   [-1.25, 0.35, -1.15, 1.55, 0.06, 0.27],
    };
    const st = { phase: 'walk', act: 'sit', until: 0, t0: 0, from: null, pose: POSES.stand.slice(), yaw: 0, x: 0, z: 0, sniff: null };
    const state = { t0: null, k: 0 };
    function lerp(a, b, t) { return a + (b - a) * t; }
    function choose(now) {
      const r = Math.random(), prev = st.act;
      let act = r < 0.26 ? 'watch' : r < 0.44 ? 'lie' : r < 0.60 ? 'sniff' : r < 0.76 ? 'clean' : r < 0.86 ? 'scratch' : r < 0.94 ? 'yawn' : 'wag';
      if (act === prev) act = 'watch';
      st.act = act; st.t0 = now;
      st.until = now + ({ watch: 4 + Math.random() * 3, lie: 7 + Math.random() * 5, sniff: 6, clean: 4.5, scratch: 1.8, yawn: 2.4, wag: 2.6 })[act];
      if (act === 'sniff') { const a = Math.random() * Math.PI * 2; st.sniff = { x0: st.x, z0: st.z, x1: Math.max(-1.45, Math.min(-0.5, st.x + Math.cos(a) * 0.45)), z1: Math.max(0.85, Math.min(1.5, st.z + Math.sin(a) * 0.35)) }; }
    }
    function animateTed(now, dt) {
      if (!ted) return;
      const U = ted.userData, legs = U.legs || [], head = U.head, tail = U.tail, ears = U.ears || [];
      let target = POSES.stand, gait = 0, hx = 0, hy = 0, hz = 0, wag = 0.35, earL = 0, earR = 0;
      const tw = now - state.t0;
      if (st.phase === 'walk') {
        const u = Math.min(1, tw / WALK), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;   // ease in-out over the ten seconds
        const p = path.getPointAt(e), q = path.getTangentAt(Math.min(0.999, e));
        st.x = p.x; st.z = p.z; st.yaw = Math.atan2(q.x, q.z);
        gait = 1 - Math.pow(Math.abs(2 * u - 1), 6);            // legs swing, slowing at either end
        hx = 0.12; wag = 0.6;
        if (u >= 1) { st.phase = 'home'; st.t0 = now; st.act = 'sit'; st.until = now + 3; }
      } else {
        // turn to face the plane, then the business
        const faceYaw = 0.55; st.yaw += (faceYaw - st.yaw) * Math.min(1, dt * 2);
        if (now > st.until) choose(now);
        const a = now - st.t0;
        if (st.act === 'sit' || st.act === 'watch' || st.act === 'wag' || st.act === 'yawn' || st.act === 'scratch') target = POSES.sit;
        if (st.act === 'lie' || st.act === 'clean') target = POSES.lie;
        if (st.act === 'sniff') {
          const s = st.sniff, u = Math.min(1, a / 4), w = a < 4.2 ? 1 : 0;
          st.x = lerp(s.x0, s.x1, u); st.z = lerp(s.z0, s.z1, u); if (w) st.yaw = Math.atan2(s.x1 - s.x0, s.z1 - s.z0);
          gait = w * 0.55; hx = 0.62 + Math.sin(a * 9) * 0.05; hy = Math.sin(a * 1.7) * 0.35;        // nose to the floor, sweeping
        }
        if (st.act === 'watch' || st.act === 'sit') {
          try { const tp = gm.group ? gm.group.localToWorld(new THREE.Vector3(0, 0, 0.3)) : new THREE.Vector3(0, 0, 0.3); const l = ted.worldToLocal(tp.clone()); l.y -= 1.2; hy = Math.max(-0.95, Math.min(0.95, Math.atan2(l.x, l.z))); hx = -Math.max(-0.45, Math.min(0.5, Math.atan2(l.y, Math.hypot(l.x, l.z)))); } catch (e) {}
        }
        if (st.act === 'wag') { wag = 1.1; hz = Math.sin(a * 2.2) * 0.06; }
        if (st.act === 'yawn') { const k = Math.sin(Math.min(1, a / 2.4) * Math.PI); hx = -0.55 * k; if (U.jaw) U.jaw.position.y = (1.11 - 1.20) - 0.04 * k; }
        if (st.act === 'clean') {                                // head round to the flank, licking
          const k = Math.min(1, a / 0.6) * Math.min(1, (4.5 - a) / 0.6);
          hy = 1.5 * k; hx = 0.45 * k + Math.sin(a * 11) * 0.07 * k; hz = 0.2 * k; earL = 0.2 * k;
        }
        if (st.act === 'lie') { hx = 0.15 + Math.sin(a * 0.4) * 0.05; hy = Math.sin(a * 0.25) * 0.4; wag = 0.12; }
        if (st.act === 'scratch' && legs[2]) {
          const k = Math.min(1, a / 0.25) * Math.min(1, (1.8 - a) / 0.25);
          legs[2].hip.rotation.z = -0.9 * k; hz = -0.32 * k; hy = 0.25 * k; earR = 0.5 * k;
        } else if (legs[2]) legs[2].hip.rotation.z = 0;
        if (U.jaw && st.act !== 'yawn') U.jaw.position.y = 1.11 - 1.20;
      }
      // ease the body toward its pose; the gait rides on top
      for (let i = 0; i < 6; i++) st.pose[i] += (target[i] - st.pose[i]) * Math.min(1, dt * 2.2);
      const P = st.pose, ph = now * 7.5;
      const sw = (o) => Math.sin(ph + o) * 0.55 * gait;
      if (legs[0]) { legs[0].hip.rotation.x = P[0] + sw(0); legs[0].knee.rotation.x = P[1] + Math.max(0, -sw(0)) * 0.6; }
      if (legs[1]) { legs[1].hip.rotation.x = P[0] + sw(Math.PI); legs[1].knee.rotation.x = P[1] + Math.max(0, -sw(Math.PI)) * 0.6; }
      if (legs[2]) { legs[2].hip.rotation.x = P[2] + sw(Math.PI); legs[2].knee.rotation.x = P[3] + Math.max(0, sw(Math.PI)) * 0.5; }
      if (legs[3]) { legs[3].hip.rotation.x = P[2] + sw(0); legs[3].knee.rotation.x = P[3] + Math.max(0, sw(0)) * 0.5; }
      const bob = Math.abs(Math.sin(ph)) * 0.025 * gait + Math.sin(now * 1.3) * 0.006;
      ted.position.set(st.x, FLOOR - P[5] + bob, st.z);
      ted.rotation.set(P[4], st.yaw, 0);
      if (head) { head.rotation.y += (hy - head.rotation.y) * 0.1; head.rotation.x += (hx - head.rotation.x) * 0.1; head.rotation.z += (hz - head.rotation.z) * 0.12; }
      if (tail) tail.rotation.y = Math.sin(now * (wag > 0.9 ? 9 : 2.2)) * wag;
      if (ears[0]) ears[0].rotation.x += (earL - ears[0].rotation.x) * 0.25;
      if (ears[1]) ears[1].rotation.x += (earR - ears[1].rotation.x) * 0.25;
    }

    let raf = 0, last = 0;
    function frame(ms) {
      raf = requestAnimationFrame(frame);
      const now = ms / 1000, dt = Math.min(0.05, last ? now - last : 0.016); last = now;
      if (state.t0 == null) return;
      // the fade: opacity up, an iridescent shimmer washing through the emissive and swelling the Venus's nacre, then settling
      const k = Math.min(1, (now - state.t0) / FADE); state.k = k;
      const ease = k * k * (3 - 2 * k), shimmer = Math.sin(k * Math.PI);
      const hue = (now * 0.35) % 1, film = new THREE.Color().setHSL(hue, 0.65, 0.55);
      fadeMats.forEach(f => { if (f.done) return; const kk = Math.min(1, (now - Math.max(state.t0, f.t)) / FADE), ease = kk * kk * (3 - 2 * kk), shimmer = Math.sin(kk * Math.PI); f.mat.opacity = ease; if (f.em) { f.mat.emissive.copy(f.em).lerp(film, shimmer * 0.85); f.mat.emissiveIntensity = f.ei + shimmer * 0.9; } if (kk >= 1) { f.done = true; f.mat.transparent = false; f.mat.opacity = 1; f.mat.needsUpdate = true; } });
      iri.uIriStrength.value = 0.825 + shimmer * 1.6; iri.uIriFilmNm.value = 420 + shimmer * 140 * Math.sin(now * 2);
      animateTed(now, dt);
    }
    raf = requestAnimationFrame(frame);
    return {
      start() { if (state.t0 != null) return; rig.visible = true; state.t0 = performance.now() / 1000; st.phase = 'walk'; },
      stop() { cancelAnimationFrame(raf); rig.visible = false; },
      get started() { return state.t0 != null; },
      rig,
    };
  }
  root.DGPierce = { attach };
})(typeof window !== 'undefined' ? window : globalThis);
