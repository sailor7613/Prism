// ============================================================
// DG ROOM — the early DreamGetty, remembered (2026-07-03)
// One room, ionic columns, the pedestal, Ted Turner, a vase that
// falls and un-falls, and an acacia tree that renders through the
// wall — plus the frames, an elephant, and a y2k AV cart.
//
// Design ruling (Prism_Admin_Surface_Direction_Handoff.md §3¾):
//   lazy-load only · default off · no hard coupling (this file is
//   fully procedural — no GLTF, no textures fetched, no DG-repo
//   assets) · backdrop-only (pointer-events:none; authoring stays
//   flat) · does not touch bands or Z.
//
// Expects window.THREE (r128-era API). Exposes window.DGRoom:
//   DGRoom.mount()   — build scene + start render loop
//   DGRoom.unmount() — stop, dispose everything, remove canvas
//   DGRoom.active    — bool
// ============================================================
(function () {
  'use strict';
  let ctx = null; // live scene context, null when off

  // ----------------------------------------------------------
  // small helpers
  // ----------------------------------------------------------
  function std(opts) { return new THREE.MeshStandardMaterial(opts); }
  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function disposeObject(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  // ----------------------------------------------------------
  // ROOM — floor, translucent walls, ceiling, skylight rim
  // (walls are translucent by design: the page's space field —
  //  or paper sky in daytime — bleeds through, and the acacia
  //  renders through the west wall exactly like v1j did)
  // ----------------------------------------------------------
  const ROOM_W = 36, ROOM_D = 36, ROOM_H = 11;
  const WD = ROOM_D / 2, WW = ROOM_W / 2;
  const PAL = {
    dark:  { wall: 0x13120f, wallOp: 0.55, floor: 0x12110e, ambient: 0.7, hemi: 0.25, warm: 0.45 },
    light: { wall: 0xd8d2c8, wallOp: 0.90, floor: 0xcfc8ba, ambient: 1.4, hemi: 0.6,  warm: 0.25 },
  };

  function buildRoom(parent, reg) {
    const g = new THREE.Group();
    reg.floorMat = std({ color: PAL.dark.floor, roughness: 0.8, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, ROOM_D * 2), reg.floorMat);
    floor.rotation.x = -Math.PI / 2; g.add(floor);

    // floor tile lines (sparser than the original — backdrop duty)
    const lineMat = new THREE.LineBasicMaterial({ color: 0xf5f0e8, transparent: true, opacity: 0.02 });
    for (let i = -WW; i <= WW; i += 4.8) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-WW, 0.001, i), new THREE.Vector3(WW, 0.001, i)]), lineMat));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, 0.001, -WD), new THREE.Vector3(i, 0.001, WD)]), lineMat));
    }

    // translucent walls
    reg.wallMats = [];
    [
      { w: ROOM_W, x: 0, z: -WD, ry: 0 }, { w: ROOM_W, x: 0, z: WD, ry: Math.PI },
      { w: ROOM_D, x: -WW, z: 0, ry: Math.PI / 2 }, { w: ROOM_D, x: WW, z: 0, ry: -Math.PI / 2 },
    ].forEach(cfg => {
      const mat = std({ color: PAL.dark.wall, roughness: 0.92, metalness: 0,
        transparent: true, opacity: PAL.dark.wallOp, depthWrite: false, side: THREE.DoubleSide });
      reg.wallMats.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, ROOM_H), mat);
      m.position.set(cfg.x, ROOM_H / 2, cfg.z); m.rotation.y = cfg.ry; m.renderOrder = 0;
      g.add(m);
    });

    // ceiling panels around the skylight opening
    const skylightSize = 14, sH = skylightSize / 2;
    const ceilMat = std({ color: 0x0a0908, roughness: 1.0, transparent: true, opacity: 0.75, depthWrite: false });
    [
      { w: ROOM_W, d: (ROOM_D - skylightSize) / 2, x: 0, z: -(WD - (ROOM_D - skylightSize) / 4) },
      { w: ROOM_W, d: (ROOM_D - skylightSize) / 2, x: 0, z: (WD - (ROOM_D - skylightSize) / 4) },
      { w: (ROOM_W - skylightSize) / 2, d: skylightSize, x: -(WW - (ROOM_W - skylightSize) / 4), z: 0 },
      { w: (ROOM_W - skylightSize) / 2, d: skylightSize, x: (WW - (ROOM_W - skylightSize) / 4), z: 0 },
    ].forEach(p => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), ceilMat);
      m.rotation.x = Math.PI / 2; m.position.set(p.x, ROOM_H, p.z); g.add(m);
    });
    const rimMat = new THREE.LineBasicMaterial({ color: 0xf5f0e8, transparent: true, opacity: 0.06 });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-sH, ROOM_H - 0.02, -sH), new THREE.Vector3(sH, ROOM_H - 0.02, -sH),
      new THREE.Vector3(sH, ROOM_H - 0.02, sH), new THREE.Vector3(-sH, ROOM_H - 0.02, sH),
      new THREE.Vector3(-sH, ROOM_H - 0.02, -sH)]), rimMat));

    parent.add(g);
    return g;
  }

  // ----------------------------------------------------------
  // IONIC COLUMNS — fluted shafts, volute capitals (from v2/v5)
  // ----------------------------------------------------------
  function buildColumn(group, x, z) {
    const colMat = std({ color: 0x1a1814, roughness: 0.45, metalness: 0.08 });
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.06, 24), colMat);
    base1.position.set(x, 0.03, z); group.add(base1);
    const baseTorus = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 24), colMat);
    baseTorus.rotation.x = Math.PI / 2; baseTorus.position.set(x, 0.1, z); group.add(baseTorus);
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.05, 24), colMat);
    base2.position.set(x, 0.15, z); group.add(base2);

    const shaftH = ROOM_H - 1.2;
    const shaftGeo = new THREE.CylinderGeometry(0.16, 0.19, shaftH, 20);
    const pos = shaftGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), pz = pos.getZ(i);
      const angle = Math.atan2(pz, px);
      const fluteDepth = 0.012 * (1 + Math.cos(angle * 20));
      const r = Math.sqrt(px * px + pz * pz);
      if (r > 0.001) { const nr = r - fluteDepth; pos.setX(i, px * (nr / r)); pos.setZ(i, pz * (nr / r)); }
    }
    shaftGeo.computeVertexNormals();
    const shaft = new THREE.Mesh(shaftGeo, colMat);
    shaft.position.set(x, 0.18 + shaftH / 2, z); group.add(shaft);

    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24), colMat);
    neck.rotation.x = Math.PI / 2; neck.position.set(x, 0.18 + shaftH + 0.02, z); group.add(neck);
    const capPlate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.52), colMat);
    capPlate.position.set(x, 0.18 + shaftH + 0.175, z); group.add(capPlate);
    [-1, 1].forEach(side => {
      const volute = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), colMat);
      volute.position.set(x + side * 0.24, 0.18 + shaftH + 0.12, z); volute.rotation.y = Math.PI / 2; group.add(volute);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.015, 8, 12), colMat);
      inner.position.set(x + side * 0.24, 0.18 + shaftH + 0.12, z); inner.rotation.y = Math.PI / 2; group.add(inner);
    });
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.56), colMat);
    abacus.position.set(x, ROOM_H - 0.025, z); group.add(abacus);
  }

  // ----------------------------------------------------------
  // THE PEDESTAL — classical, fluted, center of the room
  // (from gallery-interior.js buildClassicalPedestal)
  // ----------------------------------------------------------
  function buildPedestal(group, height, baseRadius, shaftRadius, x, z) {
    const pMat = std({ color: 0x1a1814, roughness: 0.45, metalness: 0.08, transparent: true, opacity: 0.85 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(baseRadius * 2.6, 0.08, baseRadius * 2.6), pMat);
    plinth.position.set(x, 0.04, z); group.add(plinth);
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius * 0.9, baseRadius, 0.06, 20), pMat);
    base1.position.set(x, 0.11, z); group.add(base1);
    const baseTorus = new THREE.Mesh(new THREE.TorusGeometry(baseRadius * 0.78, 0.03, 8, 20), pMat);
    baseTorus.rotation.x = Math.PI / 2; baseTorus.position.set(x, 0.17, z); group.add(baseTorus);
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius * 0.72, baseRadius * 0.82, 0.05, 20), pMat);
    base2.position.set(x, 0.22, z); group.add(base2);

    const shaftH = height - 0.7;
    const shaftGeo = new THREE.CylinderGeometry(shaftRadius * 0.85, shaftRadius, shaftH, 16);
    const spos = shaftGeo.attributes.position;
    for (let i = 0; i < spos.count; i++) {
      const px = spos.getX(i), pz = spos.getZ(i);
      const angle = Math.atan2(pz, px);
      const fluteDepth = 0.008 * (1 + Math.cos(angle * 16));
      const r = Math.sqrt(px * px + pz * pz);
      if (r > 0.001) { const nr = r - fluteDepth; spos.setX(i, px * (nr / r)); spos.setZ(i, pz * (nr / r)); }
    }
    shaftGeo.computeVertexNormals();
    const shaft = new THREE.Mesh(shaftGeo, pMat);
    shaft.position.set(x, 0.25 + shaftH / 2, z); group.add(shaft);

    const neck = new THREE.Mesh(new THREE.TorusGeometry(shaftRadius * 0.9, 0.02, 8, 20), pMat);
    neck.rotation.x = Math.PI / 2; neck.position.set(x, 0.25 + shaftH + 0.02, z); group.add(neck);
    const capPlate = new THREE.Mesh(new THREE.BoxGeometry(baseRadius * 1.8, 0.1, baseRadius * 1.8), pMat);
    capPlate.position.set(x, 0.25 + shaftH + 0.13, z); group.add(capPlate);
    [-1, 1].forEach(side => {
      const volute = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 12), pMat);
      volute.position.set(x + side * baseRadius * 0.85, 0.25 + shaftH + 0.08, z);
      volute.rotation.y = Math.PI / 2; group.add(volute);
    });
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(baseRadius * 2, 0.04, baseRadius * 2), pMat);
    abacus.position.set(x, height - 0.02, z); group.add(abacus);
    return height;
  }

  // ----------------------------------------------------------
  // GRECO-ROMAN VASE — shatter and reverse cycle (verbatim port
  // from gallery-interior.js; the object falls, breaks, and the
  // pieces reverse back through the air onto the pedestal)
  // ----------------------------------------------------------
  function buildVase(group) {
    const V = {
      state: 'whole', timer: 0,
      stateTimers: { whole: 12, falling: 0.6, shattered: 12, reversing: 2.5, resting: 2 },
      fragments: [], vaseGroup: new THREE.Group(), pedestalY: 0,
    };
    const VASE_POS = { x: -12, z: -10 };

    const pedMat = std({ color: 0x1a1814, roughness: 0.45, metalness: 0.08 });
    const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.08, 16), pedMat);
    pedBase.position.set(VASE_POS.x, 0.04, VASE_POS.z); group.add(pedBase);
    const pedShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.0, 12), pedMat);
    pedShaft.position.set(VASE_POS.x, 0.58, VASE_POS.z); group.add(pedShaft);
    const pedTop = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.06, 16), pedMat);
    pedTop.position.set(VASE_POS.x, 1.11, VASE_POS.z); group.add(pedTop);

    V.pedestalY = 1.14;
    V.vaseGroup.position.set(VASE_POS.x, V.pedestalY, VASE_POS.z);
    group.add(V.vaseGroup);

    const vaseMat = std({ color: 0xb85a30, roughness: 0.55, metalness: 0.08, side: THREE.DoubleSide });
    const decorMat = std({ color: 0x1a1208, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });

    const profile = [
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.08, 0.01), new THREE.Vector2(0.12, 0.04),
      new THREE.Vector2(0.16, 0.12), new THREE.Vector2(0.20, 0.25), new THREE.Vector2(0.22, 0.35),
      new THREE.Vector2(0.20, 0.48), new THREE.Vector2(0.15, 0.58), new THREE.Vector2(0.10, 0.64),
      new THREE.Vector2(0.07, 0.70), new THREE.Vector2(0.06, 0.75), new THREE.Vector2(0.09, 0.78),
      new THREE.Vector2(0.10, 0.80), new THREE.Vector2(0.08, 0.81),
    ];
    const wholeMesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), vaseMat);
    V.wholeMesh = wholeMesh; V.vaseGroup.add(wholeMesh);

    const bandGeo = new THREE.TorusGeometry(0.215, 0.008, 6, 24);
    const band1 = new THREE.Mesh(bandGeo, decorMat);
    band1.rotation.x = Math.PI / 2; band1.position.y = 0.30; V.vaseGroup.add(band1);
    const band2 = new THREE.Mesh(bandGeo.clone(), decorMat);
    band2.rotation.x = Math.PI / 2; band2.position.y = 0.40; V.vaseGroup.add(band2);
    const keyBand = new THREE.Mesh(new THREE.CylinderGeometry(0.221, 0.221, 0.06, 24, 1, true), decorMat);
    keyBand.position.y = 0.35; V.vaseGroup.add(keyBand);
    V.wholeBands = [band1, band2, keyBand];

    const FRAG_COUNT = 28;
    for (let i = 0; i < FRAG_COUNT; i++) {
      const angle = (i / FRAG_COUNT) * Math.PI * 2 + Math.random() * 0.2;
      const nextAngle = angle + (Math.PI * 2 / FRAG_COUNT) * (0.6 + Math.random() * 0.8);
      const yBase = Math.random() * 0.7;
      const yHeight = 0.08 + Math.random() * 0.25;
      const fragVerts = [];
      const steps = 3;
      for (let s = 0; s <= steps; s++) {
        const a = angle + (nextAngle - angle) * (s / steps);
        for (let h = 0; h <= 2; h++) {
          const y = yBase + yHeight * (h / 2);
          const profileIdx = Math.min(profile.length - 1, Math.floor(y / 0.81 * (profile.length - 1)));
          const r = profile[profileIdx].x + (Math.random() - 0.5) * 0.01;
          fragVerts.push(Math.cos(a) * r, y, Math.sin(a) * r);
        }
      }
      const fragGeo = new THREE.BufferGeometry();
      const indices = [];
      for (let s = 0; s < steps; s++) {
        for (let h = 0; h < 2; h++) {
          const a = s * 3 + h, b = a + 1, c = (s + 1) * 3 + h, d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      fragGeo.setAttribute('position', new THREE.Float32BufferAttribute(fragVerts, 3));
      fragGeo.setIndex(indices);
      fragGeo.computeVertexNormals();
      const colorShift = Math.random() * 0.1;
      const fragMesh = new THREE.Mesh(fragGeo, std({
        color: new THREE.Color(0.72 + colorShift, 0.35 + colorShift * 0.5, 0.19),
        roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide,
      }));
      fragMesh.visible = false;
      V.vaseGroup.add(fragMesh);
      const scatterAngle = angle + (Math.random() - 0.5) * 1.5;
      const scatterDist = 0.4 + Math.random() * 1.2;
      V.fragments.push({
        mesh: fragMesh,
        restPos: new THREE.Vector3(0, 0, 0),
        scatterPos: new THREE.Vector3(
          Math.cos(scatterAngle) * scatterDist,
          -V.pedestalY + 0.02 + Math.random() * 0.05,
          Math.sin(scatterAngle) * scatterDist),
        scatterRot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        fallDelay: Math.random() * 0.15,
      });
    }
    return V;
  }

  function updateVase(V, t, dt) {
    V.timer += dt;
    const stateTime = V.stateTimers[V.state];
    switch (V.state) {
      case 'whole':
        V.wholeMesh.visible = true;
        V.wholeBands.forEach(b => b.visible = true);
        V.fragments.forEach(f => f.mesh.visible = false);
        if (V.timer >= stateTime) { V.state = 'falling'; V.timer = 0; }
        break;
      case 'falling': {
        const fallProg = Math.min(V.timer / stateTime, 1);
        const fallEase = fallProg * fallProg;
        V.wholeMesh.rotation.z = fallEase * Math.PI * 0.5;
        V.wholeMesh.position.x = fallEase * 0.4;
        V.wholeMesh.position.y = -fallEase * V.pedestalY;
        V.wholeBands.forEach(b => { b.rotation.z = V.wholeMesh.rotation.z; b.position.x = V.wholeMesh.position.x; });
        if (V.timer >= stateTime) {
          V.wholeMesh.visible = false;
          V.wholeBands.forEach(b => b.visible = false);
          V.fragments.forEach(f => {
            f.mesh.visible = true;
            f.mesh.position.copy(f.scatterPos);
            f.mesh.rotation.copy(f.scatterRot);
          });
          V.wholeMesh.rotation.z = 0; V.wholeMesh.position.set(0, 0, 0);
          V.wholeBands.forEach(b => { b.rotation.z = 0; b.position.x = 0; });
          V.state = 'shattered'; V.timer = 0;
        }
        break;
      }
      case 'shattered':
        V.fragments.forEach((f, i) => {
          f.mesh.position.y = f.scatterPos.y + Math.sin(t * 0.1 + i) * 0.002;
        });
        if (V.timer >= stateTime) { V.state = 'reversing'; V.timer = 0; }
        break;
      case 'reversing': {
        const revProg = Math.min(V.timer / stateTime, 1);
        V.fragments.forEach((f, i) => {
          const delayedProg = Math.max(0, Math.min(1, (revProg - f.fallDelay * 0.5) / (1 - f.fallDelay * 0.5)));
          const dp = delayedProg < 0.5
            ? 2 * delayedProg * delayedProg
            : 1 - Math.pow(-2 * delayedProg + 2, 2) / 2;
          const liftArc = Math.sin(dp * Math.PI) * 0.5;
          f.mesh.position.lerpVectors(f.scatterPos, f.restPos, dp);
          f.mesh.position.y += liftArc;
          f.mesh.rotation.x = f.scatterRot.x * (1 - dp);
          f.mesh.rotation.y = f.scatterRot.y * (1 - dp);
          f.mesh.rotation.z = f.scatterRot.z * (1 - dp);
          f.mesh.position.x += Math.sin(dp * Math.PI * 2 + i) * 0.1 * (1 - dp);
          f.mesh.position.z += Math.cos(dp * Math.PI * 2 + i) * 0.1 * (1 - dp);
        });
        if (V.timer >= stateTime) {
          V.fragments.forEach(f => f.mesh.visible = false);
          V.wholeMesh.visible = true;
          V.wholeBands.forEach(b => b.visible = true);
          V.state = 'resting'; V.timer = 0;
        }
        break;
      }
      case 'resting':
        if (V.timer >= stateTime) { V.state = 'whole'; V.timer = 0; }
        break;
    }
  }

  // ----------------------------------------------------------
  // WALL FRAMES — photographs, procedurally painted (no fetches;
  // little canvas evocations of the originals: the coast, the
  // mountains, the Getty, the yacht, the tweet, Ted's portrait)
  // ----------------------------------------------------------
  const ART = {
    coast(ctx, w, h) { // golden hour coastal sunset
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
      sky.addColorStop(0, '#2a3a6e'); sky.addColorStop(0.55, '#c96a3a'); sky.addColorStop(1, '#f0c060');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.62);
      ctx.fillStyle = '#f8e0a0'; ctx.beginPath(); ctx.arc(w * 0.62, h * 0.5, h * 0.09, 0, Math.PI * 2); ctx.fill();
      const sea = ctx.createLinearGradient(0, h * 0.62, 0, h);
      sea.addColorStop(0, '#c07040'); sea.addColorStop(1, '#26304e');
      ctx.fillStyle = sea; ctx.fillRect(0, h * 0.62, w, h * 0.38);
      ctx.strokeStyle = 'rgba(248,224,160,0.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const y = h * (0.66 + i * 0.06); ctx.beginPath(); ctx.moveTo(w * (0.5 - i * 0.05), y); ctx.lineTo(w * (0.74 + i * 0.03), y); ctx.stroke(); }
      ctx.fillStyle = '#141020'; ctx.beginPath();
      ctx.moveTo(0, h * 0.62); ctx.lineTo(w * 0.22, h * 0.44); ctx.lineTo(w * 0.34, h * 0.62); ctx.closePath(); ctx.fill();
    },
    mountains(ctx, w, h) { // snowy range
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8ab0d8'); sky.addColorStop(1, '#e8eef5');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      [[0.15, 0.32, '#5a6a80'], [0.5, 0.2, '#48586e'], [0.85, 0.36, '#5a6a80']].forEach(([cx, top, col]) => {
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(w * (cx - 0.32), h * 0.85); ctx.lineTo(w * cx, h * top); ctx.lineTo(w * (cx + 0.32), h * 0.85); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2f5f8'; ctx.beginPath();
        ctx.moveTo(w * (cx - 0.09), h * (top + 0.15)); ctx.lineTo(w * cx, h * top); ctx.lineTo(w * (cx + 0.09), h * (top + 0.15));
        ctx.lineTo(w * (cx + 0.04), h * (top + 0.12)); ctx.lineTo(w * (cx - 0.04), h * (top + 0.13)); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = '#3a4a3a'; ctx.fillRect(0, h * 0.85, w, h * 0.15);
    },
    getty(ctx, w, h) { // the villa colonnade
      ctx.fillStyle = '#e8dfc8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c8b890'; ctx.fillRect(0, 0, w, h * 0.16);
      ctx.fillStyle = '#8a7a5a'; ctx.fillRect(0, h * 0.16, w, h * 0.03);
      ctx.fillStyle = '#d8ccb0';
      for (let i = 0; i < 6; i++) {
        const x = w * (0.06 + i * 0.16);
        ctx.fillRect(x, h * 0.19, w * 0.055, h * 0.62);
        ctx.fillStyle = '#b8a880'; ctx.fillRect(x - 2, h * 0.19, w * 0.055 + 4, h * 0.03); ctx.fillRect(x - 2, h * 0.78, w * 0.055 + 4, h * 0.03);
        ctx.fillStyle = '#d8ccb0';
      }
      ctx.fillStyle = '#6a8a9a'; ctx.fillRect(0, h * 0.81, w, h * 0.08); // the pool
      ctx.fillStyle = '#a89878'; ctx.fillRect(0, h * 0.89, w, h * 0.11);
    },
    yacht(ctx, w, h) { // the coolest yacht
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, '#b8d4e8'); sky.addColorStop(1, '#e8f0f5');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.6);
      ctx.fillStyle = '#3a6a8a'; ctx.fillRect(0, h * 0.6, w, h * 0.4);
      ctx.fillStyle = '#f5f5f2'; ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.6); ctx.lineTo(w * 0.8, h * 0.6); ctx.lineTo(w * 0.72, h * 0.7); ctx.lineTo(w * 0.26, h * 0.7); ctx.closePath(); ctx.fill();
      ctx.fillRect(w * 0.32, h * 0.48, w * 0.3, h * 0.12);
      ctx.fillRect(w * 0.4, h * 0.4, w * 0.14, h * 0.08);
      ctx.strokeStyle = '#2a3a4a'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(w * 0.47, h * 0.4); ctx.lineTo(w * 0.47, h * 0.28); ctx.stroke();
      ctx.strokeStyle = 'rgba(245,245,242,0.4)';
      for (let i = 0; i < 4; i++) { const y = h * (0.74 + i * 0.06); ctx.beginPath(); ctx.moveTo(w * 0.1, y); ctx.lineTo(w * 0.9, y); ctx.stroke(); }
    },
    tweet(ctx, w, h) { // the tweet
      ctx.fillStyle = '#f5f8fa'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8);
      ctx.strokeStyle = '#d0d8de'; ctx.strokeRect(w * 0.06, h * 0.1, w * 0.88, h * 0.8);
      ctx.fillStyle = '#7a9ab8'; ctx.beginPath(); ctx.arc(w * 0.16, h * 0.24, h * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a3a4a'; ctx.fillRect(w * 0.26, h * 0.19, w * 0.24, h * 0.035);
      ctx.fillStyle = '#8899a6'; ctx.fillRect(w * 0.26, h * 0.25, w * 0.16, h * 0.028);
      ctx.fillStyle = '#3a4a5a';
      [[0.12, 0.38, 0.76], [0.12, 0.46, 0.7], [0.12, 0.54, 0.73], [0.12, 0.62, 0.42]].forEach(([x, y, len]) => {
        ctx.fillRect(w * x, h * y, w * len, h * 0.032);
      });
      ctx.fillStyle = '#8899a6'; ctx.fillRect(w * 0.12, h * 0.76, w * 0.3, h * 0.026);
    },
    ted(ctx, w, h) { // Ted Turner, portrait — the coyote himself
      const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#c9a86a'); bg.addColorStop(1, '#8a6a3a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8a7a60'; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.58, w * 0.2, h * 0.24, 0, 0, Math.PI * 2); ctx.fill(); // head
      ctx.beginPath(); ctx.moveTo(w * 0.36, h * 0.42); ctx.lineTo(w * 0.42, h * 0.16); ctx.lineTo(w * 0.5, h * 0.4); ctx.closePath(); ctx.fill(); // ear L
      ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.4); ctx.lineTo(w * 0.58, h * 0.16); ctx.lineTo(w * 0.64, h * 0.42); ctx.closePath(); ctx.fill(); // ear R
      ctx.fillStyle = '#5a4a38'; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.72, w * 0.08, h * 0.1, 0, 0, Math.PI * 2); ctx.fill(); // snout
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.78, w * 0.025, 0, Math.PI * 2); ctx.fill(); // nose
      ctx.fillStyle = '#c8a030';
      ctx.beginPath(); ctx.arc(w * 0.43, h * 0.56, w * 0.022, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.57, h * 0.56, w * 0.022, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.arc(w * 0.43, h * 0.56, w * 0.009, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.57, h * 0.56, w * 0.009, 0, Math.PI * 2); ctx.fill();
    },
    surf(ctx, w, h) { // the wave, the board
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45); sky.addColorStop(0, '#7ab0d0'); sky.addColorStop(1, '#c8e0ee');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.45);
      ctx.fillStyle = '#2a6a8a'; ctx.fillRect(0, h * 0.45, w, h * 0.55);
      ctx.fillStyle = '#3a8aaa'; ctx.beginPath();
      ctx.moveTo(0, h * 0.75); ctx.quadraticCurveTo(w * 0.3, h * 0.3, w * 0.55, h * 0.62);
      ctx.quadraticCurveTo(w * 0.4, h * 0.56, w * 0.34, h * 0.66); ctx.lineTo(0, h * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2f5f2'; ctx.beginPath();
      ctx.moveTo(w * 0.55, h * 0.62); ctx.quadraticCurveTo(w * 0.48, h * 0.5, w * 0.36, h * 0.56);
      ctx.quadraticCurveTo(w * 0.45, h * 0.6, w * 0.5, h * 0.66); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f5f2ea'; ctx.save();
      ctx.translate(w * 0.68, h * 0.72); ctx.rotate(-0.4);
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.03, h * 0.14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    acaciaArt(ctx, w, h) { // the tree, again — a picture of the thing outside
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#e07a3a'); sky.addColorStop(0.7, '#f0b060'); sky.addColorStop(1, '#c07a40');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f8e0a0'; ctx.beginPath(); ctx.arc(w * 0.3, h * 0.42, h * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a0e';
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
      ctx.fillRect(w * 0.62, h * 0.4, w * 0.02, h * 0.44); // trunk
      ctx.beginPath(); ctx.ellipse(w * 0.63, h * 0.36, w * 0.2, h * 0.07, 0, 0, Math.PI * 2); ctx.fill(); // canopy
      ctx.beginPath(); ctx.moveTo(w * 0.63, h * 0.55); ctx.lineTo(w * 0.5, h * 0.42); ctx.stroke();
    },
  };

  function buildFrame(group, wallDir, lateralPos, yPos, artKey) {
    const frameGroup = new THREE.Group();
    const frameDepth = 0.06, barThick = 0.05, matBorder = 0.18;
    const frameMat = std({ color: 0x1c1810, roughness: 0.4, metalness: 0.06 });
    const matMat = std({ color: 0xf0ebe0, roughness: 0.95 });
    const artW = 1.9, artH = 1.42; // fixed 4:3 — canvases are known at build time
    const fw = artW + matBorder * 2, fh = artH + matBorder * 2;

    function bar(w2, h2, d2, x2, y2, z2) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), frameMat);
      m.position.set(x2, y2, z2); return m;
    }
    frameGroup.add(bar(fw + barThick * 2, barThick, frameDepth, 0, fh / 2 + barThick / 2, frameDepth / 2));
    frameGroup.add(bar(fw + barThick * 2, barThick, frameDepth, 0, -fh / 2 - barThick / 2, frameDepth / 2));
    frameGroup.add(bar(barThick, fh, frameDepth, -fw / 2 - barThick / 2, 0, frameDepth / 2));
    frameGroup.add(bar(barThick, fh, frameDepth, fw / 2 + barThick / 2, 0, frameDepth / 2));
    frameGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), matMat));

    const tex = canvasTexture(256, 192, ART[artKey]);
    const artMesh = new THREE.Mesh(new THREE.PlaneGeometry(artW, artH),
      std({ map: tex, roughness: 0.85, metalness: 0 }));
    artMesh.position.z = 0.008;
    frameGroup.add(artMesh);

    const offset = 0.08, lp = lateralPos || 0, y = yPos || 3.2;
    if (wallDir === 'back') { frameGroup.position.set(lp, y, -WD + offset); }
    else if (wallDir === 'front') { frameGroup.position.set(lp, y, WD - offset); frameGroup.rotation.y = Math.PI; }
    else if (wallDir === 'left') { frameGroup.position.set(-WW + offset, y, lp); frameGroup.rotation.y = Math.PI / 2; }
    else { frameGroup.position.set(WW - offset, y, lp); frameGroup.rotation.y = -Math.PI / 2; }
    group.add(frameGroup);

    // accent light
    const fp = frameGroup.position;
    const lightPos = wallDir === 'back' ? [fp.x, fp.y + 1.8, fp.z + 1.2]
      : wallDir === 'front' ? [fp.x, fp.y + 1.8, fp.z - 1.2]
      : wallDir === 'left' ? [fp.x + 1.2, fp.y + 1.8, fp.z]
      : [fp.x - 1.2, fp.y + 1.8, fp.z];
    const frameLight = new THREE.PointLight(0xfff0dd, 0.25, 5, 2);
    frameLight.position.set(lightPos[0], lightPos[1], lightPos[2]);
    group.add(frameLight);
  }

  // ----------------------------------------------------------
  // TED TURNER — coyote presence, gallery patrol (from
  // gallery-exterior.js, condensed but recognizably him)
  // ----------------------------------------------------------
  function buildCoyote() {
    const g = new THREE.Group();
    const furMat = std({ color: 0x8a7a60, roughness: 0.85 });
    const darkFur = std({ color: 0x5a4a38, roughness: 0.9 });
    const lightFur = std({ color: 0xc8b898, roughness: 0.8 });
    const warmFur = std({ color: 0x9a8868, roughness: 0.88 });
    const dorsalFur = std({ color: 0x4a3a28, roughness: 0.92 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), furMat);
    body.scale.set(0.7, 0.65, 1.4); body.position.set(0, 0.9, 0); g.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), lightFur);
    chest.scale.set(0.6, 0.7, 0.8); chest.position.set(0, 0.85, 0.35); g.add(chest);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), lightFur);
    belly.scale.set(0.5, 0.3, 1.0); belly.position.set(0, 0.72, 0.05); g.add(belly);
    const ridgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.08, -0.35), new THREE.Vector3(0, 1.12, -0.1),
      new THREE.Vector3(0, 1.14, 0.15), new THREE.Vector3(0, 1.12, 0.35)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(ridgeCurve, 6, 0.04, 4, false), dorsalFur));
    [-1, 1].forEach(side => {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), warmFur);
      shoulder.scale.set(0.8, 0.7, 1.0); shoulder.position.set(side * 0.15, 0.98, 0.2); g.add(shoulder);
      const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), furMat);
      haunch.scale.set(0.7, 0.8, 0.9); haunch.position.set(side * 0.14, 0.88, -0.28); g.add(haunch);
    });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), furMat);
    head.scale.set(0.85, 0.9, 1.1); head.position.set(0, 1.2, 0.45);
    g.add(head); g.userData.head = head;
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 5), darkFur);
    snout.rotation.x = Math.PI / 2; snout.position.set(0, 1.16, 0.68); g.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4),
      std({ color: 0x1a1a1a, roughness: 0.15, metalness: 0.1 }));
    nose.position.set(0, 1.17, 0.82); g.add(nose);
    [-1, 1].forEach(side => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 5), furMat);
      ear.position.set(side * 0.1, 1.44, 0.4); ear.rotation.z = side * -0.18; ear.rotation.x = -0.12; g.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 4), lightFur);
      inner.position.set(side * 0.1, 1.43, 0.42); inner.rotation.z = side * -0.18; inner.rotation.x = -0.12; g.add(inner);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4),
        std({ color: 0xc8a030, emissive: 0xc8a030, emissiveIntensity: 0.15, roughness: 0.2 }));
      eye.position.set(side * 0.08, 1.24, 0.6); g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 4, 4), std({ color: 0x0a0a0a }));
      pupil.position.set(side * 0.08, 1.24, 0.625); g.add(pupil);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), lightFur);
      cheek.scale.set(1.0, 0.8, 0.7); cheek.position.set(side * 0.13, 1.18, 0.52); g.add(cheek);
    });

    const legs = [];
    [{ x: 0.15, z: 0.25 }, { x: -0.15, z: 0.25 }, { x: 0.15, z: -0.3 }, { x: -0.15, z: -0.3 }].forEach(lp => {
      const lg = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.45, 5), furMat);
      upper.position.y = 0.45; lg.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.35, 5), darkFur);
      lower.position.y = 0.18; lg.add(lower);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), darkFur);
      paw.scale.set(0.8, 0.5, 1.2); paw.position.y = 0.02; lg.add(paw);
      lg.position.set(lp.x, 0, lp.z); g.add(lg); legs.push({ group: lg });
    });
    g.userData.legs = legs;

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.85, -0.4), new THREE.Vector3(0, 0.75, -0.65),
      new THREE.Vector3(0, 0.6, -0.8), new THREE.Vector3(0, 0.55, -0.9)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 8, 0.07, 5, false), darkFur));
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), std({ color: 0x2a2218, roughness: 0.85 }));
    tailTip.scale.set(0.7, 0.7, 1.2); tailTip.position.set(0, 0.55, -0.9); g.add(tailTip);
    return g;
  }

  const TED_WAYPOINTS = [
    { x: -8, z: -8, pause: 4 }, { x: 8, z: -10, pause: 2 },
    { x: 10, z: 5, pause: 6 }, { x: -5, z: 12, pause: 3 },
    { x: -14, z: -6, pause: 5 },   // detours past the vase — he watches it
    { x: 0, z: -4, pause: 5 },
  ];

  function updateTed(ted, patrol, t, dt) {
    const p = patrol;
    const curr = p.waypoints[p.currentWP], next = p.waypoints[p.nextWP];
    if (p.state === 'pausing') {
      p.pauseTimer -= dt;
      if (ted.userData.head) {
        ted.userData.head.rotation.y = Math.sin(t * 0.5 + p.currentWP) * 0.3;
        ted.userData.head.rotation.x = Math.sin(t * 0.3) * 0.05;
      }
      if (p.pauseTimer <= 0) {
        p.state = 'walking'; p.currentWP = p.nextWP;
        p.nextWP = (p.nextWP + 1) % p.waypoints.length; p.progress = 0;
      }
      return;
    }
    p.progress += p.speed * (dt * 60);
    if (p.progress >= 1) { p.progress = 1; p.state = 'pausing'; p.pauseTimer = next.pause; }
    const ease = p.progress * p.progress * (3 - 2 * p.progress);
    ted.position.set(curr.x + (next.x - curr.x) * ease, 0, curr.z + (next.z - curr.z) * ease);
    ted.rotation.y = Math.atan2(next.x - curr.x, next.z - curr.z);
    const wc = t * 4;
    ted.userData.legs.forEach((leg, i) => {
      const phase = i < 2 ? 0 : Math.PI; const side = i % 2 === 0 ? 0 : Math.PI;
      leg.group.rotation.x = Math.sin(wc + phase + side) * 0.2;
    });
    ted.position.y = Math.abs(Math.sin(wc * 0.5)) * 0.03;
    if (ted.userData.head) { ted.userData.head.rotation.y = 0; ted.userData.head.rotation.x = Math.sin(t * 2) * 0.02 - 0.05; }
  }

  // ----------------------------------------------------------
  // ACACIA — outside, but rendered through the translucent wall
  // (fog:false, exactly the v1j behavior; there is no outside
  // scene — just the tree, and now the elephant beside it)
  // ----------------------------------------------------------
  function buildAcacia(group) {
    const tree = new THREE.Group();
    // transparent:true on the bark too — it moves the whole tree into the
    // transparent render pass, where renderOrder can put it AFTER the walls.
    // That's the 100%-pop: the tree paints fully over the translucent wall,
    // no tint, exactly the remembered render-through.
    const trunkMat = std({ color: 0x3d2a18, roughness: 0.85, fog: false, transparent: true });
    const darkBarkMat = std({ color: 0x2a1c10, roughness: 0.9, fog: false, transparent: true });
    const leafMat = std({ color: 0x3a5525, roughness: 0.8, transparent: true, opacity: 0.75, fog: false, side: THREE.DoubleSide });
    const leafMatLight = std({ color: 0x4a6830, roughness: 0.75, transparent: true, opacity: 0.6, fog: false, side: THREE.DoubleSide });

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 2, 0.1),
      new THREE.Vector3(0.1, 4, -0.2), new THREE.Vector3(-0.2, 5.5, 0.1), new THREE.Vector3(0, 7, 0)]);
    tree.add(new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 12, 0.25, 6, false), trunkMat));
    const branch1 = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 3, 0), new THREE.Vector3(1.5, 5, 0.5), new THREE.Vector3(3, 6.2, 0.3)]);
    tree.add(new THREE.Mesh(new THREE.TubeGeometry(branch1, 8, 0.12, 5, false), darkBarkMat));
    const branch2 = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.1, 4, -0.1), new THREE.Vector3(-1.8, 5.5, -0.4), new THREE.Vector3(-2.5, 6.5, -0.2)]);
    tree.add(new THREE.Mesh(new THREE.TubeGeometry(branch2, 8, 0.10, 5, false), darkBarkMat));
    const branch3 = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 5.5, 0), new THREE.Vector3(0.8, 7, 1), new THREE.Vector3(1.5, 7.5, 1.5)]);
    tree.add(new THREE.Mesh(new THREE.TubeGeometry(branch3, 6, 0.08, 5, false), trunkMat));

    [
      { x: 0, y: 7.2, z: 0, rx: 4.5, rz: 5.5, mat: leafMat },
      { x: 2.5, y: 6.5, z: 0.3, rx: 3, rz: 3.5, mat: leafMatLight },
      { x: -2, y: 6.8, z: -0.2, rx: 2.8, rz: 3, mat: leafMat },
      { x: 1, y: 7.8, z: 1, rx: 2.5, rz: 2.5, mat: leafMatLight },
      { x: -0.5, y: 7.5, z: -0.5, rx: 3.5, rz: 3, mat: leafMat },
    ].forEach(c => {
      const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), c.mat);
      disc.scale.set(c.rx, 0.35, c.rz);
      disc.position.set(c.x, c.y, c.z);
      disc.rotation.set(Math.random() * 0.1, Math.random() * 0.2, Math.random() * 0.1);
      tree.add(disc);
    });
    tree.position.set(-28, 0, 6); tree.scale.set(1.2, 1.2, 1.2);
    tree.traverse(o => { if (o.isMesh) o.renderOrder = 6; }); // after the walls (renderOrder 0) — full pop
    group.add(tree);

    const treeLight = new THREE.PointLight(0xe8e0d0, 0.5, 35);
    treeLight.position.set(-34, 10, 7); group.add(treeLight);
    return tree;
  }

  function buildElephant(group) {
    const g = new THREE.Group();
    const m = std({ color: 0x5a5550, roughness: 0.85, fog: false });
    const md = std({ color: 0x4a4540, roughness: 0.9, fog: false });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), m);
    body.scale.set(1.6, 1.1, 1.1); body.position.set(0, 2.2, 0); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), m);
    head.position.set(1.6, 2.6, 0); g.add(head);
    const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xe8e0d0, fog: false });
    const eyeDark = new THREE.MeshBasicMaterial({ color: 0x1a1008, fog: false });
    [-1, 1].forEach(side => {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), eyeWhite);
      eyeW.position.set(1.95, 2.72, side * 0.32); g.add(eyeW);
      const eyeP = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), eyeDark);
      eyeP.position.set(1.97, 2.72, side * 0.32); g.add(eyeP);
    });
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.1, 2.3, 0), new THREE.Vector3(2.6, 1.8, 0),
      new THREE.Vector3(2.4, 1.0, 0.1), new THREE.Vector3(2.2, 0.3, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 12, 0.12, 6, false), md));
    [-1, 1].forEach(side => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), md);
      ear.scale.set(0.3, 0.7, 0.6); ear.position.set(1.3, 2.8, side * 0.7); g.add(ear);
    });
    const tuskMat = std({ color: 0xf0ece0, roughness: 0.3, fog: false });
    [-1, 1].forEach(side => {
      const tuskCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.8, 2.1, side * 0.25), new THREE.Vector3(2.2, 1.6, side * 0.3), new THREE.Vector3(2.3, 1.2, side * 0.2)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(tuskCurve, 6, 0.04, 4, false), tuskMat));
    });
    function leg(x, z) {
      const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 1.6, 6), m);
      lm.position.set(x, 0.8, z); return lm;
    }
    g.add(leg(0.7, 0.5)); g.add(leg(-0.7, 0.5)); g.add(leg(0.7, -0.5)); g.add(leg(-0.7, -0.5));
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.5, 2.0, 0), new THREE.Vector3(-1.9, 1.6, 0), new THREE.Vector3(-2.0, 1.2, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 4, 0.03, 4, false), md));

    // beside the acacia, in the shade — faces the tree
    g.position.set(-25.5, 0, 12.5); g.rotation.y = Math.PI * 0.75;
    group.add(g);
    const eLight = new THREE.PointLight(0xe8e0d0, 0.4, 30);
    eLight.position.set(-25, 8, 11); group.add(eLight);
    return g;
  }

  // ----------------------------------------------------------
  // THE AV CART — y2k ed-tech. A beige CRT on a school
  // television cart, wheeled up next to the pedestal, running
  // VASE CAM 01. When the vase shatters, the signal drops.
  // ----------------------------------------------------------
  function buildAvCart(group) {
    const cart = new THREE.Group();
    const CART_POS = { x: -9.4, z: -8.2 }; // near the vase, watching it
    const steelMat = std({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.4 });
    const beige = std({ color: 0xd8cdb4, roughness: 0.6, metalness: 0.02 });
    const beigeDark = std({ color: 0xb8ad94, roughness: 0.65, metalness: 0.02 });

    // two shelves + posts + casters
    [0.55, 1.15].forEach(y => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.66), steelMat);
      shelf.position.set(0, y, 0); cart.add(shelf);
    });
    [[-0.41, -0.29], [0.41, -0.29], [-0.41, 0.29], [0.41, 0.29]].forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.15, 8), steelMat);
      post.position.set(px, 0.575, pz); cart.add(post);
      const caster = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std({ color: 0x111111, roughness: 0.4 }));
      caster.position.set(px, 0.045, pz); cart.add(caster);
    });
    // VHS deck on the lower shelf (of course there is one)
    const vcr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.4), std({ color: 0x1a1a1a, roughness: 0.6 }));
    vcr.position.set(0, 0.63, 0); cart.add(vcr);
    const vcrLight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x30ff60 }));
    vcrLight.position.set(-0.18, 0.64, 0.2); cart.add(vcrLight);

    // the CRT — beige shell, curved face implied by a slightly bulged plane
    const crt = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.62, 0.62), beige);
    shell.position.set(0, 1.49, -0.04); crt.add(shell);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.22), beigeDark);
    rear.position.set(0, 1.49, -0.42); crt.add(rear);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.03), beigeDark);
    bezel.position.set(0, 1.49, 0.28); crt.add(bezel);

    // the screen — live canvas texture
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 192; screenCanvas.height = 144;
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    if (THREE.sRGBEncoding !== undefined) screenTex.encoding = THREE.sRGBEncoding;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46),
      new THREE.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 1.49, 0.30); crt.add(screen);
    // power LED
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    led.position.set(0.3, 1.24, 0.3); crt.add(led);
    cart.add(crt);

    cart.position.set(CART_POS.x, 0, CART_POS.z);
    cart.rotation.y = Math.atan2(0 - CART_POS.x, 0 - CART_POS.z); // screen faces the ROOM — the camera watches the vase, the monitor shows you
    group.add(cart);

    const visitorBase = 41 + Math.floor(Math.random() * 9); // № varies per visit, obviously
    return { canvas: screenCanvas, tex: screenTex, ctx2d: screenCanvas.getContext('2d'), lastDraw: 0, visitorBase };
  }

  const TED_TIPS = [
    'TED TIP #1: MIND THE VASES', 'TED TIP #2: THE TREE IS OUTSIDE',
    'TED TIP #3: DENOMINATION RADIATES', 'TED TIP #4: THE VASE ALWAYS COMES BACK',
    'TED TIP #5: AUTHOR ON THE COUCH', 'TED TIP #6: PUBLISH FROM THE DESK',
  ];

  function drawScreen(S, V, t) {
    const c = S.ctx2d, w = 192, h = 144;
    const phase = Math.floor(t / 9) % 3; // 0 vase-cam · 1 boot · 2 ted tip

    if (V.state === 'falling' || V.state === 'shattered') {
      // SIGNAL LOST — static
      const img = c.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 40 + Math.random() * 160;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, h / 2 - 14, w, 28);
      c.fillStyle = '#f0f0f0'; c.font = 'bold 13px monospace'; c.textAlign = 'center';
      c.fillText('SIGNAL LOST', w / 2, h / 2 + 5);
    } else if (phase === 1) {
      // boot screen — loading knowledge, perpetually
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#003a4a'); g.addColorStop(1, '#001a2a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#30e0c0'; c.font = 'bold 14px monospace'; c.textAlign = 'center';
      c.fillText('PRISM EDU-STATION', w / 2, 34);
      c.fillStyle = '#a0f0e0'; c.font = 'bold 22px monospace';
      c.fillText('2000', w / 2, 60);
      c.strokeStyle = '#30e0c0'; c.strokeRect(28, 84, 136, 14);
      const prog = 0.06 + ((t * 7) % 81) / 100; // fills to 87%, resets. it never finishes.
      c.fillStyle = '#30e0c0'; c.fillRect(30, 86, 132 * Math.min(prog, 0.87), 10);
      c.fillStyle = '#70c0b0'; c.font = '9px monospace';
      c.fillText('LOADING KNOWLEDGE…', w / 2, 112);
      if (Math.floor(t * 2) % 2) { c.fillStyle = '#30e0c0'; c.fillRect(w / 2 + 58, 105, 5, 8); }
    } else if (phase === 2) {
      // ted tip + visitor counter
      c.fillStyle = '#0a0a2a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#8060d0'; c.font = 'bold 10px monospace'; c.textAlign = 'center';
      const tip = TED_TIPS[Math.floor(t / 27) % TED_TIPS.length];
      c.fillText(tip, w / 2, 56);
      c.fillStyle = '#f0d060'; c.font = '9px monospace';
      const visitors = String(S.visitorBase + Math.floor(t / 60)).padStart(6, '0');
      c.fillText('YOU ARE VISITOR № ' + visitors, w / 2, 96);
      // marquee underline
      const mx = (t * 40) % (w + 60) - 30;
      c.fillStyle = '#30e0c0'; c.fillRect(mx, 106, 24, 2);
    } else {
      // VASE CAM 01 — a pixel portrait of the vase, live-ish
      c.fillStyle = '#08120a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1a3a20'; c.fillRect(0, h - 26, w, 26); // floor line
      // the vase, in pixels
      c.fillStyle = '#b85a30';
      const cx = w / 2, base = h - 30;
      c.fillRect(cx - 4, base - 8, 8, 8);      // foot
      c.fillRect(cx - 10, base - 26, 20, 18);  // belly
      c.fillRect(cx - 6, base - 34, 12, 8);    // shoulder
      c.fillRect(cx - 3, base - 42, 6, 8);     // neck
      c.fillRect(cx - 6, base - 46, 12, 4);    // lip
      c.fillStyle = '#1a1208'; c.fillRect(cx - 10, base - 22, 20, 3); // the band
      // pedestal
      c.fillStyle = '#202020'; c.fillRect(cx - 12, base, 24, 4); c.fillRect(cx - 7, base + 4, 14, 18);
      // hud
      c.fillStyle = '#d0ffd0'; c.font = '9px monospace'; c.textAlign = 'left';
      c.fillText('VASE CAM 01', 8, 14);
      if (Math.floor(t * 1.5) % 2) { c.fillStyle = '#ff4040'; c.beginPath(); c.arc(w - 40, 11, 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#d0ffd0'; c.textAlign = 'right'; c.fillText('REC', w - 8, 14);
      const secs = Math.floor(t) % 60, mins = Math.floor(t / 60) % 60;
      c.textAlign = 'left';
      c.fillText('00:' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0'), 8, h - 8);
    }
    // scanlines, always
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    S.tex.needsUpdate = true;
  }

  // ----------------------------------------------------------
  // THE STAGE — diatribe / quadrants rendered above the pedestal,
  // rebuilt live (the surface debounces) as the editor types.
  // Keywords and cloud words live on the graphmap surface as
  // floating sprites. Editing input remains DOM (orb modal / flat
  // stage) — tap-picking routes back to those editors.
  // ----------------------------------------------------------
  const BAND_COLOR = { fluid: 0x60a880, coalition: 0xc49c48, denominated: 0xd45c5c };
  const STAGE_Y = 2.55;
  let pickCb = null;

  function roundRect(c2, x, y, w, h, r) {
    c2.beginPath();
    c2.moveTo(x + r, y);
    c2.arcTo(x + w, y, x + w, y + h, r);
    c2.arcTo(x + w, y + h, x, y + h, r);
    c2.arcTo(x, y + h, x, y, r);
    c2.arcTo(x, y, x + w, y, r);
    c2.closePath();
  }

  // text sprite with word-wrap; words matching kws glow shimmer
  function makeTextSprite(text, o) {
    o = o || {};
    const kws = (o.kws || []).map(k => String(k).toLowerCase());
    const px = o.px || 26;
    const font = (o.italic ? 'italic ' : '') + px + 'px Georgia';
    const maxW = o.maxWidth || 440;
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = font;
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = []; let line = [], lw = 0;
    words.forEach(word => {
      const ww = meas.measureText(word + ' ').width;
      if (lw + ww > maxW && line.length) { lines.push(line); line = []; lw = 0; }
      line.push(word); lw += ww;
    });
    if (line.length) lines.push(line);
    if (!lines.length) lines.push(['']);
    const lh = px * 1.4, pad = 20;
    const c = document.createElement('canvas');
    c.width = 512; c.height = Math.ceil(lines.length * lh + pad * 2);
    const x2 = c.getContext('2d');
    if (o.bg) {
      x2.fillStyle = o.bg;
      roundRect(x2, 4, 4, c.width - 8, c.height - 8, 16); x2.fill();
      if (o.border) { x2.strokeStyle = o.border; x2.lineWidth = 3; x2.stroke(); }
    }
    x2.font = font; x2.textBaseline = 'middle';
    const kwWord = w2 => {
      const wl = w2.toLowerCase().replace(/[^\w'-]/g, '');
      return !!wl && kws.some(k => k === wl || k.split(/\s+/).indexOf(wl) >= 0);
    };
    lines.forEach((ln, li) => {
      let cx = (c.width - meas.measureText(ln.join(' ')).width) / 2;
      const cy = pad + li * lh + lh / 2;
      ln.forEach(word => {
        const hot = kwWord(word);
        x2.shadowBlur = hot ? 10 : 0;
        x2.shadowColor = 'rgba(255,246,226,0.85)';
        x2.fillStyle = hot ? (o.kwColor || '#fff6e2') : (o.color || '#dfe4ee');
        x2.fillText(word, cx, cy);
        cx += meas.measureText(word + ' ').width;
      });
    });
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    const scale = o.scale || 1.5;
    sp.scale.set(scale, scale * c.height / c.width, 1);
    sp.renderOrder = 8;
    return sp;
  }

  function clearStage() {
    if (ctx && ctx.stage) {
      if (ctx.stage.gm) { try { ctx.stage.gm.destroy(); } catch (_) {} }
      ctx.root.remove(ctx.stage.group);
      disposeObject(ctx.stage.group);
      ctx.stage = null;
    }
  }

  function syncStage(data) {
    if (!ctx || !data) return;
    clearStage();
    const st = { group: new THREE.Group(), floaters: [], pickables: [], gm: null };
    st.group.position.set(0, STAGE_Y, 0);

    function floater(sp, y) { sp.position.y = y; st.floaters.push({ sp, base: y, phase: Math.random() * 6.28 }); }

    if (data.view === 'quad') {
      // ---- THE FACTORY ITSELF — DG is the graphmap factory, so the stage
      // IS a PrismGraphmap instance (externalParent mode), standing vertical
      // over the pedestal like the original v1i graph sculpture. Same
      // conventions as v2: GM_QUAD fixes the X-mirror, rings are band-
      // colored, orbs at fluid .17 / coalition .30 / denominated .42.
      if (typeof PrismGraphmap === 'undefined') {
        // factory js didn't load — a bare dim plane so the view isn't silent
        const ph = new THREE.Mesh(new THREE.PlaneGeometry(3, 3),
          std({ color: 0x0a1226, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
        ph.position.y = 0.95; st.group.add(ph);
      } else {
        const holder = new THREE.Group();
        holder.position.y = 0.95;             // plane center ≈ the sculpture's GRAPH_CENTER_Y
        holder.scale.set(1.35, 1.35, 1.35);   // GRAPH_SIZE 2.8 → ~3.8 world units
        st.group.add(holder);
        const gm = PrismGraphmap.create({
          externalParent: holder,
          mode: 'readonly',
          capabilities: { orbit: false, zInput: false, zRender: false },
          moody: true, spectrumAxes: true, artifacts: false, ted: false,
        });
        st.gm = gm;
        const GM_QUAD = { A: 'B', B: 'A', C: 'C', D: 'D' };
        const BAND_RING = { fluid: 'rgba(96,168,128,0.7)', coalition: 'rgba(196,156,72,0.7)', denominated: 'rgba(212,92,92,0.7)' };
        const OFF = { fluid: 0.17, coalition: 0.30, denominated: 0.42 };
        const DIR = { A: [-1, 1], B: [1, 1], C: [-1, -1], D: [1, -1] };
        const R = data.responses || {};
        const corners = {};
        ['A', 'B', 'C', 'D'].forEach(q => {
          const rq = R[q] || {};
          ['fluid', 'coalition', 'denominated'].forEach(band => {
            const v = rq[band] || {};
            const filled = !!(v.text && v.text.trim());
            const o = OFF[band], d = DIR[q];
            try {
              gm.addDot(0.5 + d[0] * o, 0.5 - d[1] * o, GM_QUAD[q], 0,
                filled ? { label: 'cs:' + q + ':' + band, ring: BAND_RING[band] }
                       : { label: 'cs:' + q + ':' + band, color: 0x3a4258, radius: 0.035 });
            } catch (_) {}
          });
          // corner labels — the quadrant's axis terms, deepest authored band first
          const cv = ['denominated', 'coalition', 'fluid'].map(b => rq[b]).find(v2 => v2 && (v2.xWord || v2.yWord));
          if (cv) corners[GM_QUAD[q]] = (cv.xWord || '') + ' · ' + (cv.yWord || '');
        });
        try { gm.setCornerLabels(corners); } catch (_) {}
        const P = data.poles || {};
        try { gm.setAxisLabels({ xNeg: P.xneg || ' ', xPos: P.xpos || ' ', yPos: P.ypos || ' ', yNeg: P.yneg || ' ' }); } catch (_) {}
        // on-plane keyword field — v2's quadrantCloudWords shape (recurrence
        // across bands weighs more), plus this side's live diatribe keywords
        // at low weight, so the cloud grows on the surface as you write
        try {
          ['A', 'B', 'C', 'D'].forEach(q => {
            const counts = {};
            const add = (text, w) => {
              if (!text) return;
              if (!counts[text]) counts[text] = { text, weight: w };
              else counts[text].weight = Math.min(0.98, counts[text].weight + 0.18);
            };
            const rq = R[q] || {};
            ['fluid', 'coalition', 'denominated'].forEach(band => {
              const v = rq[band]; if (!v) return;
              add(v.xWord, 0.55); add(v.yWord, 0.55);
              (v.words || []).forEach(w2 => add(typeof w2 === 'string' ? w2 : (w2 && (w2.t || w2.word)), 0.5));
            });
            const sideCells = (q === 'A' || q === 'C') ? ['LF', 'LC', 'LD'] : ['RF', 'RC', 'RD'];
            sideCells.forEach(c => {
              const cd = (data.cells || {})[c];
              if (cd && cd.kws) cd.kws.forEach(k => add(k, 0.34));
            });
            const words = Object.keys(counts).map(k => counts[k])
              .sort((a, b) => b.weight - a.weight).slice(0, 9);
            if (words.length) gm.setQuadrantWords(GM_QUAD[q], words);
          });
        } catch (_) {}
      }
    } else {
      // ---- the diatribe — track + tablets over the pedestal ----
      const TRACK_L = 3.6;
      // band segments: denominated · coalition · fluid · coalition · denominated
      const segs = [[0, 0.17, 'denominated'], [0.17, 0.33, 'coalition'], [0.33, 0.67, 'fluid'], [0.67, 0.83, 'coalition'], [0.83, 1, 'denominated']];
      segs.forEach(sg => {
        const w = (sg[1] - sg[0]) * TRACK_L;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.028, 0.11),
          std({ color: BAND_COLOR[sg[2]], transparent: true, opacity: 0.5, emissive: BAND_COLOR[sg[2]], emissiveIntensity: 0.12 }));
        m.position.set((sg[0] + sg[1]) / 2 * TRACK_L - TRACK_L / 2, 0, 0);
        st.group.add(m);
      });
      [0.17, 0.33, 0.5, 0.67, 0.83].forEach(th => {
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.13),
          std({ color: 0xf5f0e8, transparent: true, opacity: 0.4 }));
        tick.position.set(th * TRACK_L - TRACK_L / 2, 0.02, 0);
        st.group.add(tick);
      });
      // thumbs — real (cream) and the ghost (dim), mirrored
      const pct = typeof data.pct === 'number' ? data.pct : 38;
      [[pct, 0xf5f0e8, 0.9], [100 - pct, 0x8892a8, 0.55]].forEach(tv => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 10),
          std({ color: tv[1], emissive: tv[1], emissiveIntensity: 0.4, transparent: true, opacity: tv[2] }));
        cone.rotation.x = Math.PI; // point down at the track
        cone.position.set(tv[0] / 100 * TRACK_L - TRACK_L / 2, 0.16, 0);
        st.group.add(cone);
      });
      // pole names at the rail ends
      [[data.spine && data.spine.neg, -TRACK_L / 2 - 0.5], [data.spine && data.spine.pos, TRACK_L / 2 + 0.5]].forEach(pl => {
        if (!pl[0]) return;
        const sp = makeTextSprite(pl[0], { px: 30, color: '#c9d2e4', scale: 1.0 });
        sp.position.set(pl[1], 0.05, 0); st.group.add(sp);
      });
      // two tablets, the DOM stage's own shape: the real voice above the
      // rail, the ghost beneath it. Just the pair the thumb is on — the
      // six-tablet cloud was nutty and is retired.
      const cur = data.cur || {};
      const tablet = (cell, ghost, y) => {
        if (!cell) return;
        const cd = (data.cells || {})[cell] || {};
        const sp = makeTextSprite(cd.text || 'type this voice…', {
          px: 24, kws: cd.kws, scale: 1.7,
          italic: !cd.text,
          color: cd.text ? (ghost ? '#aab2c4' : '#e8ecf5') : '#77809a',
          bg: ghost ? 'rgba(9,15,32,0.6)' : 'rgba(9,15,32,0.85)',
          border: ghost ? 'rgba(150,168,200,0.18)' : 'rgba(150,168,200,0.35)',
        });
        sp.position.set(0, y, 0);
        sp.userData.pick = { type: 'cell', cell };
        st.group.add(sp); st.pickables.push(sp);
      };
      tablet(cur.real, false, 0.95);
      tablet(cur.ghost, true, -0.72);
    }

    ctx.stage = st;
    ctx.root.add(st.group);
  }

  // ----------------------------------------------------------
  // MOUNT / UNMOUNT
  // ----------------------------------------------------------
  function mount() {
    if (ctx) return;
    if (typeof THREE === 'undefined') throw new Error('THREE not loaded');

    const container = document.createElement('div');
    container.id = 'dgRoom';
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
    const spaceField = document.getElementById('spaceField');
    if (spaceField && spaceField.parentNode) spaceField.insertAdjacentElement('afterend', container);
    else document.body.prepend(container);

    const scene = new THREE.Scene(); // background stays null — the space field (or paper sky) bleeds through the walls
    const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // backdrop duty — save the battery
    renderer.setClearColor(0x000000, 0);
    if (renderer.outputEncoding !== undefined && THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping !== undefined) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9; }
    container.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);
    const reg = {}; // registry of theme-reactive materials

    buildRoom(root, reg);

    const CD = 10;
    buildColumn(root, -CD, -CD); buildColumn(root, CD, -CD);
    buildColumn(root, -CD, CD); buildColumn(root, CD, CD);

    buildPedestal(root, 1.0, 0.5, 0.18, 0, 0); // THE pedestal, center — empty; the surface's flat stage floats above it

    const vase = buildVase(root);
    const avScreen = buildAvCart(root);

    const ted = buildCoyote();
    ted.scale.set(0.85, 0.85, 0.85);
    root.add(ted);
    const tedPatrol = { waypoints: TED_WAYPOINTS, currentWP: 0, nextWP: 1, progress: 0, speed: 0.006, pauseTimer: 0, state: 'walking' }; // trimmed from .008 — he ambles now

    buildAcacia(root);
    buildElephant(root);

    // frames — eight photographs
    buildFrame(root, 'back', -8, 3.5, 'getty');
    buildFrame(root, 'back', 8, 3.4, 'coast');
    buildFrame(root, 'front', -8, 3.4, 'mountains');
    buildFrame(root, 'front', 8, 3.5, 'surf');
    buildFrame(root, 'left', -6, 3.5, 'ted');
    buildFrame(root, 'left', 7, 3.3, 'acaciaArt');
    buildFrame(root, 'right', -6, 3.4, 'yacht');
    buildFrame(root, 'right', 7, 3.5, 'tweet');

    // lighting — no shadow maps (backdrop duty)
    const lights = {};
    lights.ambient = new THREE.AmbientLight(0xf0e8d8, PAL.dark.ambient);
    root.add(lights.ambient);
    lights.hemi = new THREE.HemisphereLight(0x30406a, 0x12110e, PAL.dark.hemi);
    root.add(lights.hemi);
    lights.warm1 = new THREE.PointLight(0xffe8cc, PAL.dark.warm, 16, 1.8);
    lights.warm1.position.set(-4, ROOM_H - 1, -3); root.add(lights.warm1);
    lights.warm2 = new THREE.PointLight(0xffe8cc, PAL.dark.warm * 0.8, 16, 1.8);
    lights.warm2.position.set(4, ROOM_H - 1, 3); root.add(lights.warm2);
    lights.vase = new THREE.PointLight(0xf0e0c8, 0.5, 10, 2);
    lights.vase.position.set(-11, 4, -8); root.add(lights.vase);

    // theme — follow the surface's day/night (◐)
    function applyTheme() {
      const light = document.body.classList.contains('light');
      const p = light ? PAL.light : PAL.dark;
      reg.wallMats.forEach(m => { m.color.setHex(p.wall); m.opacity = p.wallOp; });
      reg.floorMat.color.setHex(p.floor);
      lights.ambient.intensity = p.ambient;
      lights.hemi.intensity = p.hemi;
      lights.warm1.intensity = p.warm; lights.warm2.intensity = p.warm * 0.8;
    }
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // camera — orbit rig. Idles in a slow lap (starts facing west so the
    // acacia and elephant greet through the wall); in orbit mode the user
    // drives: one finger drags theta/phi, pinch or wheel zooms.
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cam = { theta: 0, phi: 0.13, radius: 13.5, target: new THREE.Vector3(0, 2.9, 0) };
    const orbit = { enabled: false };
    function placeCamera() {
      cam.phi = Math.max(0.04, Math.min(1.25, cam.phi));
      cam.radius = Math.max(4.5, Math.min(16.5, cam.radius));
      const hr = cam.radius * Math.cos(cam.phi);
      camera.position.set(Math.cos(cam.theta) * hr,
        cam.target.y + cam.radius * Math.sin(cam.phi), Math.sin(cam.theta) * hr);
      camera.lookAt(cam.target);
    }
    placeCamera();

    // pointer controls + tap picking (only reachable in orbit mode —
    // the container is pointer-events:none otherwise)
    const pointers = new Map();
    let downInfo = null, pinchDist = 0;
    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function tryPick(x, y) {
      if (!ctx || !ctx.stage || !pickCb) return;
      let list = ctx.stage.pickables.slice();
      if (ctx.stage.gm && ctx.stage.gm.dotsGroup) list = list.concat(ctx.stage.gm.dotsGroup.children);
      if (!list.length) return;
      ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(list, true);
      for (let i = 0; i < hits.length; i++) {
        let o = hits[i].object;
        while (o) {
          if (o.userData && o.userData.pick) { pickCb(o.userData.pick); return; }
          if (o.userData && o.userData.isGraphmapDot && String(o.userData.label).indexOf('cs:') === 0) {
            const parts = o.userData.label.split(':');
            pickCb({ type: 'orb', quad: parts[1], band: parts[2] }); return;
          }
          o = o.parent;
        }
      }
    }
    function onDown(e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) downInfo = { moved: 0 };
      else if (pointers.size === 2) {
        const a = Array.from(pointers.values());
        pinchDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      }
      if (renderer.domElement.setPointerCapture) { try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {} }
      e.preventDefault();
    }
    function onPtrMove(e) {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 1) {
        if (downInfo) downInfo.moved += Math.abs(dx) + Math.abs(dy);
        cam.theta += dx * 0.0055;
        cam.phi -= dy * 0.004;
      } else if (pointers.size === 2) {
        const a = Array.from(pointers.values());
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinchDist > 0 && d > 0) cam.radius *= pinchDist / d;
        pinchDist = d;
      }
      e.preventDefault();
    }
    function onUp(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0 && downInfo && downInfo.moved < 10) tryPick(e.clientX, e.clientY);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) downInfo = null;
    }
    function onWheel(e) { cam.radius *= 1 + e.deltaY * 0.001; e.preventDefault(); }
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onPtrMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    function setOrbit(on) {
      orbit.enabled = !!on;
      container.style.pointerEvents = on ? 'auto' : 'none';
      pointers.clear(); downInfo = null; pinchDist = 0;
    }

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // render loop — throttled to ~30fps; CRT updates at 4fps
    let raf = 0, last = 0, t0 = performance.now();
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (now - last < 32) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = (now - t0) / 1000;
      updateVase(vase, t, dt);
      updateTed(ted, tedPatrol, t, dt);
      if (t - avScreen.lastDraw > 0.25) { avScreen.lastDraw = t; drawScreen(avScreen, vase, t); }
      if (!reducedMotion && !orbit.enabled) cam.theta += dt * 0.021; // idle lap, ~5 min
      if (ctx && ctx.stage) {
        ctx.stage.floaters.forEach(f => {
          f.sp.position.y = f.base + Math.sin(t * 1.1 + f.phase) * 0.045;
        });
        if (ctx.stage.gm) { try { ctx.stage.gm.update(t); } catch (_) {} } // factory's own pulse/breathe
      }
      placeCamera();
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    ctx = { scene, camera, renderer, container, stop: () => cancelAnimationFrame(raf),
      onResize, themeObserver, root, stage: null, setOrbit };
  }

  function unmount() {
    if (!ctx) return;
    ctx.stop();
    window.removeEventListener('resize', ctx.onResize);
    ctx.themeObserver.disconnect();
    disposeObject(ctx.scene);
    ctx.renderer.dispose();
    if (ctx.container.parentNode) ctx.container.parentNode.removeChild(ctx.container);
    ctx = null;
  }

  window.DGRoom = {
    mount, unmount,
    get active() { return !!ctx; },
    syncStage,
    setOrbit(on) { if (ctx) ctx.setOrbit(on); },
    onPick(fn) { pickCb = fn; },
  };
})();
