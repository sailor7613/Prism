// ted-rig.js — Ted the coyote, upright and articulated (2026-10-20)
//
// Same low-poly face as buildTedCoyote() (identical skull, snout, brows, eyes,
// ears), on a person-shaped skeleton so he can sit at a desk, use his paws and
// talk. Every joint is a THREE.Group; limb segments hang along the joint's
// local -y. Poses are functions that set joints (directly, by IK, or by
// look-at); the rig blends from the current pose to the next one.
//
//   const ted = TedRig.build();            scene.add(ted.root);
//   ted.setPose('deskPoint', { guest: new THREE.Vector3(-1.2, 1, .9) });
//   ted.update(dt, t);                      // every frame
//   ted.setTalk(true); ted.setSuit(true); ted.showJoints(true);
//
// Joints: hips, spine, chest, neck, head, jaw, browL/R, eyeL/R, earL/R,
// shoulderL/R, elbowL/R, wristL/R, fingersL/R, thumbL/R, hipL/R, kneeL/R,
// ankleL/R, tail0-2.  L = his left (+x), R = his right (-x). He faces +z.
(function (global) {
  const THREE = global.THREE;
  const D2R = Math.PI / 180;
  const ARM_A = 0.26, ARM_B = 0.23;      // upper arm, forearm
  const LEG_A = 0.27, LEG_B = 0.25;      // thigh, shin

  function furTex(top, bottom) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, top); g.addColorStop(0.5, bottom); g.addColorStop(1, top);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    let v = 7; const r = () => (v = (v * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 300; i++) { x.fillStyle = r() > .5 ? 'rgba(180,165,130,0.12)' : 'rgba(50,40,25,0.15)'; x.fillRect(r() * 64, r() * 64, 1 + r() * 2, 1 + r() * 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  function build() {
    const M = {
      body: new THREE.MeshStandardMaterial({ map: furTex('#4a3a28', '#8a7a60'), roughness: .88 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: .92 }),
      tawny: new THREE.MeshStandardMaterial({ color: 0xa08050, roughness: .85 }),
      light: new THREE.MeshStandardMaterial({ color: 0xd0c0a0, roughness: .82 }),
      pad: new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: .7 }),
      nose: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .1, metalness: .15 }),
      eye: new THREE.MeshStandardMaterial({ color: 0xd4a020, emissive: 0xd4a020, emissiveIntensity: .25, roughness: .15 }),
      pupil: new THREE.MeshStandardMaterial({ color: 0x050505 }),
      catch: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      mouth: new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: .9 }),
      // suit
      jacket: new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: .75 }),
      trousers: new THREE.MeshStandardMaterial({ color: 0x262a33, roughness: .8 }),
      shirt: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: .6 }),
      tie: new THREE.MeshStandardMaterial({ color: 0x8a1f24, roughness: .5 }),
    };
    const root = new THREE.Group(); root.name = 'Ted';
    const J = {}; const markers = [];
    const furMeshes = [];   // {mesh, role}
    function joint(name, parent, x, y, z) {
      const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); J[name] = g;
      const mk = new THREE.Mesh(new THREE.SphereGeometry(.016, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff9a3c, depthTest: false }));
      mk.renderOrder = 10; mk.visible = false; g.add(mk); markers.push(mk);
      return g;
    }
    function mesh(geo, mat, parent, p, s, role) {
      const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (s) m.scale.set(s[0], s[1], s[2]);
      m.castShadow = true; parent.add(m); if (role) furMeshes.push({ mesh: m, role, fur: mat }); return m;
    }
    const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
    const cyl = (r1, r2, len, s = 8) => new THREE.CylinderGeometry(r1, r2, len, s);
    const seg = (parent, r1, r2, len, mat, role) => mesh(cyl(r1, r2, len), mat, parent, [0, -len / 2, 0], null, role);

    // ── torso
    const hips = joint('hips', root, 0, .60, 0);
    mesh(sph(.16), M.body, hips, [0, 0, -.01], [1.05, .85, .9], 'pelvis');
    const spine = joint('spine', hips, 0, .10, 0);
    mesh(sph(.15), M.body, spine, [0, .07, 0], [1, 1.3, .85], 'torso');
    mesh(sph(.11, 8, 6), M.light, spine, [0, .09, .085], [.62, 1.5, .45], 'bib');
    const chest = joint('chest', spine, 0, .18, 0);
    mesh(sph(.165), M.body, chest, [0, .05, 0], [1.12, 1.0, .82], 'torso');
    mesh(sph(.12, 8, 6), M.light, chest, [0, .05, .09], [.68, 1.05, .5], 'bib');
    const neck = joint('neck', chest, 0, .15, .02);
    mesh(cyl(.065, .085, .16), M.tawny, neck, [0, .06, 0]);
    mesh(sph(.08, 8, 6), M.light, neck, [0, .015, .045], [.8, .85, .6], 'ruff');
    const head = joint('head', neck, 0, .13, .01);

    // ── face: buildTedCoyote() coordinates, re-centred on the skull
    const SK = new THREE.Vector3(0, .11, .02), C = new THREE.Vector3(0, 1.20, .46);
    const hp = (x, y, z) => [x - C.x + SK.x, y - C.y + SK.y, z - C.z + SK.z];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const part = (name, x, y, z) => { const p = hp(x, y, z); return joint(name, head, p[0], p[1], p[2]); };
    mesh(sph(.17), M.tawny, head, hp(0, 1.20, .46), [.82, .88, 1.05]);
    mesh(sph(.06, 6, 4), M.tawny, head, hp(0, 1.30, .50), [1.8, .6, 1]);
    const snout = mesh(new THREE.ConeGeometry(.075, .30, 6), M.dark, head, hp(0, 1.165, .72)); snout.rotation.x = Math.PI / 2;
    mesh(sph(.03, 6, 4), M.tawny, head, hp(0, 1.20, .62), [.9, .5, 2.2]);
    mesh(sph(.028, 6, 5), M.nose, head, hp(0, 1.17, .85));
    [-1, 1].forEach(sd => mesh(sph(.035, 6, 4), M.light, head, hp(sd * .10, 1.17, .55), [.8, .7, .9]));
    // jaw hinges under the ears; the mouth's dark inside shows when it opens
    const jawO = hp(0, 1.135, .54);
    const jaw = part('jaw', 0, 1.135, .54);
    mesh(sph(.04, 6, 4), M.mouth, head, sub(hp(0, 1.13, .66), [0, 0, 0]), [.9, .25, 2.2]);
    mesh(new THREE.ConeGeometry(.05, .17, 6), M.tawny, jaw, sub(hp(0, 1.12, .66), jawO), [1, 1, .5]).rotation.x = Math.PI / 2;
    mesh(sph(.03, 6, 4), M.light, jaw, sub(hp(0, 1.115, .60), jawO), [.9, .5, 1.4]);
    [-1, 1].forEach(sd => {
      const s = sd > 0 ? 'L' : 'R';
      const brow = part('brow' + s, sd * .065, 1.285, .56);
      mesh(sph(.035, 6, 4), M.dark, brow, null, [2, .7, .9]);
      const eye = part('eye' + s, sd * .08, 1.245, .59);
      mesh(sph(.030, 6, 4), M.dark, eye, [0, -.005, -.01]);
      mesh(sph(.026, 8, 6), M.eye, eye, [0, 0, .015]);
      const pg = new THREE.SphereGeometry(.013, 6, 4); pg.scale(.7, 1, 1);
      mesh(pg, M.pupil, eye, [0, 0, .035]);
      mesh(sph(.006, 3, 2), M.catch, eye, [-sd * .006, .01, .04]);
      const ear = part('ear' + s, sd * .10, 1.35, .40);
      const e1 = mesh(new THREE.ConeGeometry(.06, .22, 6), M.dark, ear, [0, .11, 0]); e1.rotation.set(-.10, 0, sd * -.20);
      const e2 = mesh(new THREE.ConeGeometry(.038, .16, 5), M.tawny, ear, [0, .10, .02]); e2.rotation.set(-.10, 0, sd * -.20);
    });

    // ── arms
    [-1, 1].forEach(sd => {
      const s = sd > 0 ? 'L' : 'R';
      const sh = joint('shoulder' + s, chest, sd * .15, .10, 0);
      mesh(sph(.05, 8, 6), M.body, sh, [-sd * .01, 0, 0], null, 'shoulder');
      seg(sh, .042, .036, ARM_A, M.tawny, 'arm');
      const el = joint('elbow' + s, sh, 0, -ARM_A, 0);
      mesh(sph(.037, 6, 5), M.tawny, el, null, null, 'arm');
      seg(el, .036, .03, ARM_B, M.tawny, 'arm');
      const wr = joint('wrist' + s, el, 0, -ARM_B, 0);
      // paw: palm faces local +z, fingers run along local -y
      mesh(sph(.046, 8, 6), M.dark, wr, [0, -.035, 0], [1.05, 1, .55]);
      mesh(sph(.03, 6, 4), M.pad, wr, [0, -.04, .018], [.8, .8, .35]);
      const fi = joint('fingers' + s, wr, 0, -.068, 0);
      mesh(sph(.042, 8, 6), M.dark, fi, [0, -.03, 0], [1.05, .95, .5]);
      [-1, 0, 1].forEach(k => mesh(sph(.011, 4, 3), M.light, fi, [k * .022, -.066, .004], [1, 1.2, .8]));  // claw tips
      const th = joint('thumb' + s, wr, sd * .042, -.025, .012);
      mesh(cyl(.016, .013, .055, 6), M.dark, th, [0, -.0275, 0]);
      // suit cuff
      const cuff = mesh(cyl(.04, .04, .045, 10), M.shirt, el, [0, -ARM_B + .03, 0]); cuff.userData.suit = true;
    });

    // ── legs
    [-1, 1].forEach(sd => {
      const s = sd > 0 ? 'L' : 'R';
      const hip = joint('hip' + s, hips, sd * .09, -.03, 0);
      mesh(sph(.085, 8, 6), M.body, hip, [0, -.03, 0], [1, 1.25, 1.1], 'leg');
      seg(hip, .06, .045, LEG_A, M.body, 'leg');
      const kn = joint('knee' + s, hip, 0, -LEG_A, 0);
      mesh(sph(.043, 6, 5), M.tawny, kn, null, null, 'leg');
      seg(kn, .041, .031, LEG_B, M.tawny, 'leg');
      const an = joint('ankle' + s, kn, 0, -LEG_B, 0);
      mesh(sph(.05, 8, 6), M.dark, an, [0, -.025, .06], [.95, .5, 1.9]);
    });

    // ── tail (rest: back and down, curling up at the end)
    let tp = hips;
    [[0, -.02, -.15, .16, .05, .06], [0, -.16, 0, .16, .065, .075], [0, -.16, 0, 0, 0, 0]].forEach((t, i) => {
      const g = joint('tail' + i, tp, t[0], t[1], t[2]);
      if (i < 2) mesh(cyl(t[4], t[5], t[3], 7), M.body, g, [0, -t[3] / 2, 0]);
      else mesh(sph(.07, 7, 5), M.dark, g, [0, -.06, 0], [.8, 1.4, .8]);
      tp = g;
    });
    J.tail0.rotation.x = 1.0; J.tail1.rotation.x = -.35; J.tail2.rotation.x = -.35;

    // ── suit extras (hidden until setSuit(true))
    const suit = new THREE.Group(); suit.visible = false; chest.add(suit);
    mesh(cyl(.075, .085, .05, 12), M.shirt, J.neck, [0, .0, 0]).userData.suit = true;           // collar
    mesh(sph(.028, 8, 6), M.tie, suit, [0, .14, .12], [1, 1.1, .8]);                               // knot
    const blade = mesh(new THREE.ConeGeometry(.04, .30, 4), M.tie, suit, [0, -.02, .13], [1, 1, .35]); blade.rotation.set(0, Math.PI / 4, Math.PI);
    const blade2 = mesh(new THREE.ConeGeometry(.04, .10, 4), M.tie, spine, [0, .16, .125], [1, 1, .35]); blade2.rotation.set(0, Math.PI / 4, 0); blade2.userData.suit = true;
    [-1, 1].forEach(sd => { const l = mesh(new THREE.BoxGeometry(.06, .24, .025), M.jacket, suit, [sd * .07, .03, .115]); l.rotation.set(-.15, sd * .35, sd * .28); });
    mesh(new THREE.BoxGeometry(.045, .02, .015), M.shirt, suit, [.12, .06, .1]).rotation.y = .5;  // pocket square
    root.traverse(o => { if (o.userData && o.userData.suit) o.visible = false; });

    // ── rest pose
    const rest = {};
    for (const k in J) rest[k] = { p: J[k].position.clone(), q: J[k].quaternion.clone() };
    const base = {}, target = {};
    for (const k in J) { base[k] = J[k].quaternion.clone(); target[k] = J[k].quaternion.clone(); }
    const baseHips = J.hips.position.clone(), targetHips = J.hips.position.clone();
    const baseRoot = { p: root.position.clone(), q: root.quaternion.clone() }, targetRoot = { p: root.position.clone(), q: root.quaternion.clone() };
    const shapes = { blink: 0, lids: 0, curlL: .25, curlR: .25, thumbL: .3, thumbR: .3 };
    const shapeT = Object.assign({}, shapes);

    // ── pose tools (work on the live joints; evaluate() captures and restores)
    const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
    function resetToRest() { for (const k in J) { J[k].position.copy(rest[k].p); J[k].quaternion.copy(rest[k].q); } }
    function rot(name, x, y, z, order) { J[name].quaternion.copy(rest[name].q).multiply(_q.setFromEuler(new THREE.Euler(x * D2R, (y || 0) * D2R, (z || 0) * D2R, order || 'XYZ'))); }
    function addRot(name, x, y, z) { J[name].quaternion.multiply(_q.setFromEuler(new THREE.Euler(x * D2R, (y || 0) * D2R, (z || 0) * D2R))); }
    function wpos(name) { root.updateMatrixWorld(true); return J[name].getWorldPosition(new THREE.Vector3()); }
    // point a joint's local -y along a world direction (minimal twist)
    function aim(name, dir) {
      const j = J[name]; j.parent.updateMatrixWorld(true);
      const pq = j.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      j.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize().applyQuaternion(pq));
      j.updateMatrixWorld(true);
    }
    // set a joint's world orientation from "fingers point along" + "palm faces"
    function orientPaw(name, along, palm) {
      const j = J[name]; const y = along.clone().normalize().negate();
      const z = palm.clone().sub(y.clone().multiplyScalar(palm.dot(y))).normalize();
      const x = new THREE.Vector3().crossVectors(y, z);
      const wq = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
      j.parent.updateMatrixWorld(true);
      j.quaternion.copy(j.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));
    }
    // two-bone IK: wrist to `wrist`, elbow toward `elbowHint` (world points)
    function twoBone(upper, lower, end, a, b, goal, hint) {
      const S = wpos(upper); const T = goal.clone();
      let d = T.clone().sub(S); let len = d.length();
      len = Math.min(Math.max(len, Math.abs(a - b) + 1e-3), a + b - 1e-3);
      const n = d.normalize();
      const u = hint.clone().sub(S); u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
      const ca = (a * a + len * len - b * b) / (2 * a * len); const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
      const E = S.clone().add(n.clone().multiplyScalar(a * ca)).add(u.clone().multiplyScalar(a * sa));
      const Tc = S.clone().add(n.clone().multiplyScalar(len));
      aim(upper, E.clone().sub(S)); aim(lower, Tc.clone().sub(E));
      return { S, E, T: Tc };
    }
    function armIK(s, wrist, elbow, along, palm) {
      twoBone('shoulder' + s, 'elbow' + s, 'wrist' + s, ARM_A, ARM_B, v3(wrist), v3(elbow));
      if (along) orientPaw('wrist' + s, v3(along), v3(palm));
    }
    function legIK(s, ankle, knee) { twoBone('hip' + s, 'knee' + s, 'ankle' + s, LEG_A, LEG_B, v3(ankle), v3(knee)); }
    // turn neck + head toward a world point; `roll` tilts the head
    function look(pt, amt = 1, roll = 0, neckShare = .35) {
      const P = v3(pt);
      ['neck', 'head'].forEach((nm, i) => {
        const j = J[nm]; j.quaternion.copy(rest[nm].q); j.parent.updateMatrixWorld(true);
        const from = (nm === 'head') ? j.localToWorld(new THREE.Vector3(SK.x, SK.y, SK.z)) : j.getWorldPosition(new THREE.Vector3());
        const dir = P.clone().sub(from).applyQuaternion(j.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
        const share = (i === 0 ? neckShare : 1) * amt;
        const yaw = Math.atan2(dir.x, dir.z) * share, pitch = Math.atan2(-dir.y, Math.hypot(dir.x, dir.z)) * share;
        j.quaternion.multiply(_q.setFromEuler(new THREE.Euler(pitch, yaw, i === 1 ? roll * D2R : 0, 'YXZ')));
        j.updateMatrixWorld(true);
      });
    }
    const v3 = a => a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]);
    const tools = { J, rot, addRot, aim, armIK, legIK, look, wpos, orientPaw, v3, shapes: shapeT,
      hips: (x, y, z) => J.hips.position.set(x, y, z),
      root: (x, y, z, yaw) => { root.position.set(x, y, z); root.rotation.set(0, yaw || 0, 0); } };

    // ── presets
    const presets = window.TedPoses || {};
    let current = null, opts = {}, talk = false, suitOn = false, blend = 1;
    function evaluate(name, t) {
      const keepQ = {}; for (const k in J) keepQ[k] = J[k].quaternion.clone();
      const keepH = J.hips.position.clone(), keepRP = root.position.clone(), keepRQ = root.quaternion.clone();
      resetToRest(); root.position.set(0, 0, 0); root.quaternion.identity();
      Object.assign(shapeT, { blink: 0, lids: 0, curlL: .25, curlR: .25, thumbL: .3, thumbR: .3 });
      presets[name].fn(tools, t, opts);
      for (const k in J) target[k].copy(J[k].quaternion);
      targetHips.copy(J.hips.position); targetRoot.p.copy(root.position); targetRoot.q.copy(root.quaternion);
      for (const k in J) J[k].quaternion.copy(keepQ[k]); J.hips.position.copy(keepH); root.position.copy(keepRP); root.quaternion.copy(keepRQ);
    }
    function setPose(name, o) { if (!presets[name]) return; current = name; opts = o || {}; if (presets[name].talk !== undefined) talk = presets[name].talk; blend = 0; evaluate(name, 0); }
    function snapPose(name, o) { setPose(name, o); for (const k in J) base[k].copy(target[k]); baseHips.copy(targetHips); baseRoot.p.copy(targetRoot.p); baseRoot.q.copy(targetRoot.q); Object.assign(shapes, shapeT); blend = 1; apply(0); }

    // ── per-frame life: breath, blinks, ears, tail, talking
    let nextBlink = 1.5, blinkT = -1, ear = { s: 'L', t: -1, next: 3 }, talkEnv = 0;
    function apply(t) {
      for (const k in J) J[k].quaternion.copy(base[k]);
      J.hips.position.copy(baseHips); root.position.copy(baseRoot.p); root.quaternion.copy(baseRoot.q);
      // breathing
      addRot('chest', Math.sin(t * 1.4) * 1.2, 0, 0);
      addRot('head', -Math.sin(t * 1.4) * .8, Math.sin(t * .37) * 1.5, Math.sin(t * .29) * 1.2);
      // tail sway
      addRot('tail0', 0, 0, Math.sin(t * 1.9) * 8); addRot('tail1', 0, 0, Math.sin(t * 1.9 - .6) * 10);
      // ear flick
      if (t > ear.next && ear.t < 0) { ear.t = t; ear.s = Math.random() > .5 ? 'L' : 'R'; }
      if (ear.t >= 0) { const k = (t - ear.t) / .35; if (k > 1) { ear.t = -1; ear.next = t + 2 + Math.random() * 5; } else addRot('ear' + ear.s, -Math.sin(k * Math.PI) * 22, 0, (ear.s === 'L' ? -1 : 1) * Math.sin(k * Math.PI) * 10); }
      // talking: jaw + small nods + brows
      talkEnv += ((talk ? 1 : 0) - talkEnv) * .15;
      if (talkEnv > .01) {
        const syl = Math.max(0, Math.sin(t * 13.0) * .6 + Math.sin(t * 7.3 + 1) * .4);
        addRot('jaw', syl * 20 * talkEnv, 0, 0);
        addRot('head', Math.sin(t * 3.1) * 3 * talkEnv, 0, Math.sin(t * 1.7) * 2 * talkEnv);
        const br = Math.max(0, Math.sin(t * 1.3)) * .012 * talkEnv; J.browL.position.y = rest.browL.p.y + br; J.browR.position.y = rest.browR.p.y + br * .6;
      } else { J.browL.position.y = rest.browL.p.y; J.browR.position.y = rest.browR.p.y; }
      // blinks (on top of any held lid level)
      if (t > nextBlink && blinkT < 0) blinkT = t;
      let b = shapes.lids;
      if (blinkT >= 0) { const k = (t - blinkT) / .16; if (k > 1) { blinkT = -1; nextBlink = t + 2 + Math.random() * 4; } else b = Math.max(b, Math.sin(k * Math.PI)); }
      const ey = 1 - .9 * Math.max(b, shapes.blink); J.eyeL.scale.y = ey; J.eyeR.scale.y = ey;
      // paws
      ['L', 'R'].forEach(s => {
        const c = shapes['curl' + s]; J['fingers' + s].quaternion.copy(rest['fingers' + s].q).multiply(_q.setFromEuler(new THREE.Euler(-c * 95 * D2R, 0, 0)));
        const th = shapes['thumb' + s], sd = s === 'L' ? 1 : -1;
        J['thumb' + s].quaternion.copy(rest['thumb' + s].q).multiply(_q.setFromEuler(new THREE.Euler(-th * 60 * D2R, 0, sd * (35 - th * 45) * D2R)));
      });
    }
    function update(dt, t) {
      if (current && presets[current].live) evaluate(current, t);
      blend = Math.min(1, blend + dt * 2.2);
      const k = 1 - Math.pow(.0009, dt);        // ease toward the target pose
      for (const n in J) base[n].slerp(target[n], k);
      baseHips.lerp(targetHips, k); baseRoot.p.lerp(targetRoot.p, presets[current] && presets[current].live ? 1 : k); baseRoot.q.slerp(targetRoot.q, presets[current] && presets[current].live ? 1 : k);
      for (const s in shapes) shapes[s] += (shapeT[s] - shapes[s]) * k;
      apply(t);
    }
    function setSuit(on) {
      suitOn = on; suit.visible = on;
      root.traverse(o => { if (o.userData && o.userData.suit) o.visible = on; });
      furMeshes.forEach(f => {
        let m = f.fur;
        if (on) m = { pelvis: M.trousers, leg: M.trousers, torso: M.jacket, shoulder: M.jacket, arm: M.jacket, bib: M.shirt, ruff: M.shirt }[f.role] || f.fur;
        f.mesh.material = m;
      });
    }
    function showJoints(on) { markers.forEach(m => m.visible = on); }
    return { root, joints: J, setPose, snapPose, update, setTalk: v => talk = v, getTalk: () => talk, setSuit, getSuit: () => suitOn, showJoints, tools, presets };
  }
  global.TedRig = { build };
})(typeof window !== 'undefined' ? window : globalThis);
