// ============================================================
// PRISM GRAPHMAP — Factory Pattern
// Creates independent 3D quadrant graph instances.
// Usage:
//   const g = PrismGraphmap.create({ container: el, mode: 'analytical' });
//   g.setPin(0.3, 0.4, 'B');
//   g.destroy();
//
// Backward compat (singleton style):
//   PrismGraphmap.mount(el);   // auto-creates default instance
//   PrismGraphmap.setPin(…);
//   PrismGraphmap.unmount();
//
// Requires: Three.js r128
// ============================================================
const PrismGraphmap = (function () {

  // ── Shared constants (no per-instance state here) ──
  const C = {
    authLeft: 0x3868a8, authRight: 0xb83a3a,
    libLeft:  0x3a8a52, libRight:  0xb87828,
    cream:    0xf5f0e8, bg:        0x0c0b09,
  };
  const GRAPH_SIZE = 2.8, GH = GRAPH_SIZE / 2;
  const Z_EXTENT = 2.2;   // gallery-matched: max Z displacement from plane
  const PIN_COLORS = { A: C.authRight, B: C.authLeft, C: C.libLeft, D: C.libRight, T: C.cream };

  // ── Default config ──
  const DEFAULTS = {
    container: null,
    externalParent: null,        // THREE.Group or THREE.Scene — if set, factory skips
                                 // scene/camera/renderer creation and adds group here.
                                 // Caller owns the render loop and calls instance.update(t).
    mode: 'analytical',          // 'analytical' | 'readonly' | 'embed'
    capabilities: {
      orbit: true,
      zInput: true,
      zRender: true,
      diatribeSlider: true,
      clustering: 'auto',        // 'auto' | 'individual' | 'clustered'
    },
    data: {
      source: 'live',            // 'live' | 'static'
      responses: null,
      aggregate: null,
      diatribePosition: 0.5,
    },
    lifecycle: {
      activateOnViewport: false,
      deactivateOnExit: false,
    },
  };

  // ── Geometry builders (return fresh objects each call) ──

  function buildScene() {
    const scene = new THREE.Scene();
    // No background — transparent, composites over parent UI
    return scene;
  }

  function buildCamera() {
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    camera.position.set(0, 0, 5.4);
    camera.lookAt(0, 0, 0);
    return camera;
  }

  function buildRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0); // fully transparent
    const canvas = renderer.domElement;
    canvas.className = 'graphmap-canvas';
    return { renderer, canvas };
  }

  function buildLighting(scene) {
    // Main spot: warm overhead
    const spotMain = new THREE.SpotLight(0xfff3e0, 1.6, 18, Math.PI * 0.22, 0.65, 1.6);
    spotMain.position.set(0, 6, 2);
    spotMain.target.position.set(0, 0, 0);
    spotMain.castShadow = true;
    spotMain.shadow.mapSize.set(1024, 1024);
    spotMain.shadow.radius = 4;
    scene.add(spotMain);
    scene.add(spotMain.target);

    // Warm fill 1: left-back
    const spotWarm1 = new THREE.SpotLight(0xffe8cc, 0.55, 16, Math.PI * 0.28, 0.7, 1.8);
    spotWarm1.position.set(-4, 5, -3);
    spotWarm1.target.position.set(0, 0, 0);
    scene.add(spotWarm1);
    scene.add(spotWarm1.target);

    // Warm fill 2: right-front
    const spotWarm2 = new THREE.SpotLight(0xffe8cc, 0.4, 16, Math.PI * 0.28, 0.7, 1.8);
    spotWarm2.position.set(4, 5, 3);
    spotWarm2.target.position.set(0, 0, 0);
    scene.add(spotWarm2);
    scene.add(spotWarm2.target);

    // Ambient — warm neutral for light background compositing
    const ambient = new THREE.AmbientLight(0xf5f0e8, 0.9);
    scene.add(ambient);

    return { spotMain, spotWarm1, spotWarm2, ambient };
  }

  function buildGraphGroup() {
    const group = new THREE.Group();

    // Vertex-colored base plane
    const geo = new THREE.PlaneGeometry(GRAPH_SIZE, GRAPH_SIZE, 2, 2);
    const colors = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      let c;
      if (x <= 0 && y >= 0) c = new THREE.Color(C.authLeft);
      else if (x > 0 && y >= 0) c = new THREE.Color(C.authRight);
      else if (x <= 0 && y < 0) c = new THREE.Color(C.libLeft);
      else c = new THREE.Color(C.libRight);
      c.multiplyScalar(0.52);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.55, metalness: 0.15,
      emissive: 0x080818, emissiveIntensity: 0.20,
      side: THREE.DoubleSide,
      transparent: false,
    })));

    // Grid lines (10 divisions)
    const divs = 10, step = GRAPH_SIZE / divs;
    for (let i = 0; i <= divs; i++) {
      const p = -GH + i * step, isAxis = (i === divs / 2);
      const mat = new THREE.LineBasicMaterial({
        color: 0xf5f0e8, transparent: true, opacity: isAxis ? 0.25 : 0.08,
      });
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-GH, p, 0.003), new THREE.Vector3(GH, p, 0.003),
      ]), mat));
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p, -GH, 0.003), new THREE.Vector3(p, GH, 0.003),
      ]), mat));
    }

    // Border
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-GH, -GH, 0.004), new THREE.Vector3(GH, -GH, 0.004),
      new THREE.Vector3(GH, GH, 0.004), new THREE.Vector3(-GH, GH, 0.004),
      new THREE.Vector3(-GH, -GH, 0.004),
    ]), new THREE.LineBasicMaterial({ color: 0xf5f0e8, transparent: true, opacity: 0.15 })));

    // Quadrant shading overlays
    [
      { color: C.authLeft,  x: -GH / 2, y:  GH / 2 },
      { color: C.authRight, x:  GH / 2, y:  GH / 2 },
      { color: C.libLeft,   x: -GH / 2, y: -GH / 2 },
      { color: C.libRight,  x:  GH / 2, y: -GH / 2 },
    ].forEach(cfg => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(GH, GH),
        new THREE.MeshStandardMaterial({
          color: cfg.color, transparent: true, opacity: 0.15,
          side: THREE.DoubleSide, roughness: 0.8,
        })
      );
      m.position.set(cfg.x, cfg.y, 0.001);
      group.add(m);
    });

    return group;
  }

  function buildPinGroup() {
    const pinGroup = new THREE.Group();
    pinGroup.visible = false;
    return pinGroup;
  }

  // ── Billboard label helpers (gallery-matched THREE.Sprite, always face camera) ──

  function makeLabelSprite(text, color, fontSize) {
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d');
    cvs.width = 512; cvs.height = 64;
    ctx.font = (fontSize || 20) + 'px Georgia';
    ctx.fillStyle = color || 'rgba(245,240,232,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 32);
    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.18, 1);
    return { sprite, material: mat, texture: tex, canvas: cvs };
  }

  // Ring sprite (additive, v2) — the Diatribe aperture-band halo. A canvas-
  // stroked circle as a billboard sprite, so it always faces the camera.
  function makeRingSprite(color) {
    const css = (typeof color === 'number')
      ? '#' + color.toString(16).padStart(6, '0')
      : (color || 'rgba(245,240,232,0.9)');
    const cvs = document.createElement('canvas');
    cvs.width = 128; cvs.height = 128;
    const ctx = cvs.getContext('2d');
    ctx.strokeStyle = css;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    return { sprite, material: mat, texture: tex };
  }

  function buildLabels(group) {
    const labelsGroup = new THREE.Group();

    // ── Quadrant corner letters (billboard sprites in quadrant colors) ──
    // A = upper left, B = upper right, C = lower left, D = lower right
    const cornerDefs = [
      { key: 'A', text: 'A', x: -GH + 0.45, y:  GH - 0.2, color: 'rgba(184,58,58,0.75)' },
      { key: 'B', text: 'B', x:  GH - 0.45, y:  GH - 0.2, color: 'rgba(56,104,168,0.75)' },
      { key: 'C', text: 'C', x: -GH + 0.45, y: -GH + 0.2, color: 'rgba(58,138,82,0.75)' },
      { key: 'D', text: 'D', x:  GH - 0.45, y: -GH + 0.2, color: 'rgba(184,120,40,0.75)' },
    ];
    const cornerEntries = {};
    cornerDefs.forEach(function (c) {
      const lbl = makeLabelSprite(c.text, c.color, 20);
      lbl.sprite.position.set(c.x, c.y, 0.15);
      labelsGroup.add(lbl.sprite);
      cornerEntries[c.key] = { label: lbl, pos: new THREE.Vector3(c.x, c.y, 0.15), color: c.color };
    });

    // ── Axis endpoint labels (billboard sprites, dim cream, outside graph edges) ──
    const axisDefs = [
      { key: 'xNeg', text: 'Left',  x: -GH - 0.5, y: 0 },
      { key: 'xPos', text: 'Right', x:  GH + 0.5, y: 0 },
      { key: 'yNeg', text: 'Down',  x: 0,          y: -GH - 0.3 },
      { key: 'yPos', text: 'Up',    x: 0,          y:  GH + 0.3 },
    ];
    const axisEntries = {};
    axisDefs.forEach(function (a) {
      const lbl = makeLabelSprite(a.text, 'rgba(245,240,232,0.4)', 15);
      lbl.sprite.scale.set(1.1, 0.14, 1);
      lbl.sprite.position.set(a.x, a.y, 0);
      labelsGroup.add(lbl.sprite);
      axisEntries[a.key] = { label: lbl, pos: new THREE.Vector3(a.x, a.y, 0) };
    });

    // ── Z-axis reference line (positive + negative space) ──
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -Z_EXTENT),
      new THREE.Vector3(0, 0, Z_EXTENT),
    ]);
    const zAxisLine = new THREE.Line(zAxisGeo, new THREE.LineBasicMaterial({
      color: 0xf5f0e8, transparent: true, opacity: 0.12,
    }));
    labelsGroup.add(zAxisLine);

    // Tick marks along Z-axis (every 0.25 in normalized space)
    for (let zt = -1.0; zt <= 1.0; zt += 0.25) {
      if (Math.abs(zt) < 0.01) continue; // skip origin
      const zWorld = zt * Z_EXTENT * 0.8;
      const tickLen = 0.06;
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-tickLen, 0, zWorld),
        new THREE.Vector3(tickLen, 0, zWorld),
      ]);
      labelsGroup.add(new THREE.Line(tickGeo, new THREE.LineBasicMaterial({
        color: 0xf5f0e8, transparent: true, opacity: 0.08,
      })));
    }

    // ── Z depth label (above plane) ──
    const zLbl = makeLabelSprite('Z · Depth', 'rgba(245,240,232,0.2)', 13);
    zLbl.sprite.scale.set(0.9, 0.12, 1);
    zLbl.sprite.position.set(0.2, 0.15, Z_EXTENT + 0.3);
    labelsGroup.add(zLbl.sprite);

    // ── Negative Z label (below plane) ──
    const zNegLbl = makeLabelSprite('Z · Below Surface', 'rgba(160,120,220,0.25)', 12);
    zNegLbl.sprite.scale.set(1.1, 0.12, 1);
    zNegLbl.sprite.position.set(0.25, 0.15, -Z_EXTENT * 0.7);
    labelsGroup.add(zNegLbl.sprite);

    group.add(labelsGroup);
    return { labelsGroup, cornerEntries, axisEntries, zLabel: zLbl, zNegLabel: zNegLbl, zAxisLine };
  }

  // ── Z Boundary Planes builder ──
  // Two translucent quads at z = ±Z_EXTENT×0.8 with text labels + optional photo textures.
  // The positive plane = "Winner" (the determining force succeeds).
  // The negative plane = "Loser" (the determining force is constrained/defeated).

  function buildBoundaryPlanes(group) {
    var bpGroup = new THREE.Group();
    var zWorld = Z_EXTENT * 0.8;              // ±1.76
    var planeSize = GRAPH_SIZE * 0.82;        // slightly smaller than base plane

    // ── Helper: create one boundary quad + label + photo surface ──
    function makeBoundary(zPos, labelText) {
      // Translucent cream quad
      var geo = new THREE.PlaneGeometry(planeSize, planeSize);
      var mat = new THREE.MeshStandardMaterial({
        color: C.cream,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, zPos);
      mesh.renderOrder = 2;
      bpGroup.add(mesh);

      // Text label sprite — positioned at upper edge of boundary plane
      var lbl = makeLabelSprite(labelText, 'rgba(245,240,232,0.35)', 18);
      lbl.sprite.scale.set(1.6, 0.20, 1);
      var labelYOffset = planeSize * 0.42;
      lbl.sprite.position.set(0, labelYOffset, zPos + (zPos > 0 ? 0.05 : -0.05));
      lbl.sprite.renderOrder = 10;
      bpGroup.add(lbl.sprite);

      // Photo surface — same size as boundary, starts invisible.
      // Uses a canvas texture composited with alpha for translucency.
      var photoCvs = document.createElement('canvas');
      photoCvs.width = 512;
      photoCvs.height = 512;
      var photoTex = new THREE.CanvasTexture(photoCvs);
      photoTex.encoding = THREE.sRGBEncoding;
      var photoGeo = new THREE.PlaneGeometry(planeSize, planeSize);
      var photoMat = new THREE.MeshBasicMaterial({
        map: photoTex,
        transparent: true,
        opacity: 0,           // starts invisible — set by setBoundaryContent
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      var photoMesh = new THREE.Mesh(photoGeo, photoMat);
      photoMesh.position.set(0, 0, zPos + (zPos > 0 ? 0.02 : -0.02));
      photoMesh.renderOrder = 3;
      photoMesh.visible = false;
      bpGroup.add(photoMesh);

      return {
        mesh: mesh,
        mat: mat,
        label: lbl,
        photoMesh: photoMesh,
        photoMat: photoMat,
        photoCvs: photoCvs,
        photoTex: photoTex,
      };
    }

    var positive = makeBoundary(zWorld, 'Winner');
    var negative = makeBoundary(-zWorld, 'Loser');

    group.add(bpGroup);

    return {
      bpGroup: bpGroup,
      positive: positive,
      negative: negative,
      zWorld: zWorld,
      planeSize: planeSize,
    };
  }

  // ── Boundary plane photo loader ──
  // Loads an image (URL or base64 data URI) into a boundary's canvas texture.
  // Draws the image centered with configurable alpha, optionally tinted.

  function loadBoundaryPhoto(boundary, src, opts) {
    opts = opts || {};
    var alpha = opts.alpha != null ? opts.alpha : 0.25;
    var tint = opts.tint || null;   // optional: 'rgba(r,g,b,a)' overlay
    var cvs = boundary.photoCvs;
    var ctx = cvs.getContext('2d');

    // Clear
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    if (!src) {
      boundary.photoMesh.visible = false;
      boundary.photoMat.opacity = 0;
      boundary.photoTex.needsUpdate = true;
      return;
    }

    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.globalAlpha = alpha;

      // Draw image fitted to canvas (contain — no crop, no stretch)
      var aspect = img.width / img.height;
      var dw, dh, dx, dy;
      if (aspect > 1) {
        // Landscape: fit width, letterbox top/bottom
        dw = cvs.width;
        dh = dw / aspect;
        dx = 0;
        dy = (cvs.height - dh) / 2;
      } else {
        // Portrait: fit height, pillarbox left/right
        dh = cvs.height;
        dw = dh * aspect;
        dx = (cvs.width - dw) / 2;
        dy = 0;
      }
      ctx.drawImage(img, dx, dy, dw, dh);

      // Optional color tint overlay
      if (tint) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, cvs.width, cvs.height);
      }

      boundary.photoTex.needsUpdate = true;
      boundary.photoMesh.visible = true;
      boundary.photoMat.opacity = 1;  // alpha is baked into canvas
    };
    img.onerror = function () {
      console.warn('[PrismGraphmap] Boundary photo failed to load:', src);
      boundary.photoMesh.visible = false;
    };
    img.src = src;
  }

  // ── Pin mesh builder (per instance, called on setPin) ──

  function rebuildPin(pinGroup, quadrant, style) {
    // Dispose existing children
    while (pinGroup.children.length) {
      const child = pinGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      pinGroup.remove(child);
    }

    const baseColor = PIN_COLORS[quadrant] || 0xb83a3a;
    const col = new THREE.Color(baseColor);

    // ── Iridescent square halo (sits on the plane surface) ──
    // Uses the "backside" palette — opposite quadrant color blended with neighbors
    const OPP = { A: C.libLeft, B: C.libRight, C: C.authRight, D: C.authLeft };
    const ADJ = { A: C.authLeft, B: C.authRight, C: C.libLeft, D: C.libRight };
    const oppColor = new THREE.Color(OPP[quadrant] || C.cream);
    const adjColor = new THREE.Color(ADJ[quadrant] || C.cream);
    const haloColor = oppColor.clone().lerp(adjColor, 0.35);

    const haloGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const haloMat = new THREE.MeshStandardMaterial({
      color: haloColor,
      emissive: haloColor,
      emissiveIntensity: 0.3,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = 0.005; // just above plane surface
    pinGroup.add(halo);

    // ── Orb style (additive, v2): BONDI GLASS — the user pin as a translucent
    // iMac-era candy shell, visibly lit from within. The only translucent
    // specimen among the opaque crowd. ──
    if (style === 'orb') {
      halo.visible = false;   // the square halo plate reads boxy around glass
      // the candy shell
      const glassCol = col.clone();
      glassCol.offsetHSL(0, 0.05, 0.18);                  // lifted toward candy
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: glassCol,
        transparent: true, opacity: 0.38,
        roughness: 0.12, metalness: 0,
        clearcoat: 1.0, clearcoatRoughness: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 18), shellMat);
      pinGroup.add(shell);
      // the light inside
      const coreCol = col.clone();
      coreCol.offsetHSL(0, 0.15, 0.10);
      const coreMat = new THREE.MeshStandardMaterial({
        color: coreCol, emissive: coreCol, emissiveIntensity: 1.4,
        roughness: 0.4, metalness: 0,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), coreMat);
      pinGroup.add(core);
      // soft bloom
      const orbGlowMat = new THREE.SpriteMaterial({
        color: baseColor, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const orbGlow = new THREE.Sprite(orbGlowMat);
      orbGlow.scale.set(0.5, 0.5, 1);
      pinGroup.add(orbGlow);
      return { pin: shell, pinMat: shellMat, core, coreMat, glow: orbGlow, glowMat: orbGlowMat, halo, haloMat };
    }

    // ── User pin — ConeGeometry (gallery-matched) ──
    // Cone default: tip at +Y. rotation.x = -PI/2 rotates tip to -Z (toward plane).
    // Same rotation as gallery: graphUserPin.rotation.x = -Math.PI/2
    const pinGeo = new THREE.ConeGeometry(0.06, 0.16, 8);
    const brightPin = col.clone();
    brightPin.offsetHSL(0, 0.2, -0.02); // saturate, slight darken
    const pinMat = new THREE.MeshStandardMaterial({
      color: brightPin, emissive: brightPin, emissiveIntensity: 0.35,
      roughness: 0.25, metalness: 0.1,
    });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.rotation.x = -Math.PI / 2;   // tip points -Z (toward plane surface)
    pin.position.z = 0.08;           // tip near plane, base at ~0.16
    pin.castShadow = true;
    pinGroup.add(pin);

    // ── Glow sprite (gallery-matched) ──
    const glowMat = new THREE.SpriteMaterial({
      color: baseColor, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.35, 0.35, 1);
    glow.position.z = 0.08;
    pinGroup.add(glow);

    return { pin, pinMat, glow, glowMat, halo, haloMat };
  }

  // ── Disposal helper ──

  function disposeGroup(obj) {
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // ============================================================
  // INSTANCE FACTORY
  // ============================================================

  function createInstance(userConfig) {
    // ── Merge config ──
    const config = {
      ...DEFAULTS,
      ...userConfig,
      capabilities: { ...DEFAULTS.capabilities, ...(userConfig.capabilities || {}) },
      data: { ...DEFAULTS.data, ...(userConfig.data || {}) },
      lifecycle: { ...DEFAULTS.lifecycle, ...(userConfig.lifecycle || {}) },
    };

    // ── Instance state ──
    const isExternal = !!config.externalParent;

    // In external mode, the caller owns the scene/camera/renderer.
    // The factory only builds the group + data objects.
    const scene = isExternal ? null : buildScene();
    const camera = isExternal ? null : buildCamera();
    const rendererBundle = isExternal ? { renderer: null, canvas: null } : buildRenderer();
    const renderer = rendererBundle.renderer;
    const canvas = rendererBundle.canvas;
    const lights = isExternal ? null : buildLighting(scene);
    const group = buildGraphGroup();

    // ── Moody surface (additive, v2): the plane stays — dimmed so the velvet
    // breathes through it — and the real "window" problem is solved upstream
    // by the oversized render surface (the canvas is far larger than the
    // visible graph, so nothing clips at a viewport edge). ──
    if (config.moody) {
      group.traverse(o => {
        if (o.isMesh && o.material) {
          if (o.material.vertexColors) {           // the quadrant-gradient plane
            o.material.transparent = true;
            o.material.opacity = 0.55;             // present, but the velvet breathes through
            o.material.emissiveIntensity = 0.12;
            o.material.needsUpdate = true;
          } else if (o.geometry && o.geometry.type === 'PlaneGeometry' && o.material.opacity === 0.15) {
            o.material.opacity = 0.10;             // quadrant shading overlays
          }
        } else if (o.isLine && o.material && o.material.transparent && o.material.opacity === 0.15) {
          o.material.opacity = 0.12;               // border softened
        }
      });
    }

    // ── Spectrum axes (additive, v2): iridescent gradient axis lines laid
    // over the plane axes — x: blue→cream→red, y: green→cream→gold. ──
    // Refs kept so setAxisOffset() can slide the crosshair (v2 additive).
    var spectrumAxisX = null, spectrumAxisY = null;
    var axisOffset = { x: 0.5, y: 0.5 };   // normalized crosshair position (0.5 = center)
    if (config.spectrumAxes) {
      const mkAxis = (pts, cols) => {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const arr = [];
        cols.forEach(c => { const cc = new THREE.Color(c); arr.push(cc.r, cc.g, cc.b); });
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(arr), 3));
        return new THREE.Line(geo, new THREE.LineBasicMaterial({
          vertexColors: true, transparent: true, opacity: 0.75,
          blending: THREE.AdditiveBlending,
        }));
      };
      spectrumAxisX = mkAxis(
        [new THREE.Vector3(-GH, 0, 0.006), new THREE.Vector3(0, 0, 0.006), new THREE.Vector3(GH, 0, 0.006)],
        [0x6094dc, 0xfff6e2, 0xdc6060]
      );
      spectrumAxisY = mkAxis(
        [new THREE.Vector3(0, -GH, 0.006), new THREE.Vector3(0, 0, 0.006), new THREE.Vector3(0, GH, 0.006)],
        [0x60a880, 0xfff6e2, 0xc49c48]
      );
      group.add(spectrumAxisX);
      group.add(spectrumAxisY);
    }
    // v2 additive: slide the spectrum crosshair to a normalized position —
    // lets the committed graph open with the pad's migrated (skewed) axes
    // and re-migrate to center via migrateAll(). No-op without spectrumAxes.
    function applyAxisOffset() {
      if (spectrumAxisX) spectrumAxisX.position.y = (0.5 - axisOffset.y) * GRAPH_SIZE;
      if (spectrumAxisY) spectrumAxisY.position.x = (axisOffset.x - 0.5) * GRAPH_SIZE;
    }
    function setAxisOffset(nx, ny) {
      axisOffset.x = (nx != null ? nx : 0.5);
      axisOffset.y = (ny != null ? ny : 0.5);
      applyAxisOffset();
      return instance;
    }
    const pinGroup = buildPinGroup();

    if (isExternal) {
      config.externalParent.add(group);
    } else {
      scene.add(group);
    }
    group.add(pinGroup);

    // ── Labels (billboard sprites, gallery-matched) ──
    const labels = buildLabels(group);

    // Gate: hide Z depth label when zRender disabled
    if (!config.capabilities.zRender && labels.zLabel) {
      labels.zLabel.sprite.visible = false;
      if (labels.zNegLabel) labels.zNegLabel.sprite.visible = false;
      if (labels.zAxisLine) labels.zAxisLine.visible = false;
    }

    // ── Z Boundary Planes (translucent quads at ±Z ceiling) ──
    const boundaries = buildBoundaryPlanes(group);

    // Gate: hide boundary planes when zRender disabled
    if (!config.capabilities.zRender) {
      boundaries.bpGroup.visible = false;
    }

    let mounted = false;
    let animId = null;
    let active = true;          // viewport lifecycle: false = offscreen, rAF paused
    let intersectionObserver = null;
    let pinT = 0;
    let pinMeshes = null;
    let containerEl = null;
    let resizeObserver = null;

    // ── Pin data (stored for inspect callback) ──
    let pinData = null;  // { normX, normY, quadrant }

    // ── Hold-to-inspect state ──
    let holdTimer = null;
    const HOLD_MS = config.holdMs || 400;   // hold duration to trigger inspect (configurable, v2)
    const HOLD_MOVE_TOLERANCE = 5; // px — movement beyond this cancels hold
    let holdStartX = 0;
    let holdStartY = 0;
    let onInspectCallback = null;

    // ── Orbit / drag-to-rotate state ──
    const orbit = {
      yaw: 0,                    // Y-axis rotation (radians) — full 360°
      pitch: 0,                  // X-axis rotation (radians) — clamped ±50°
      dragging: false,
      lastX: 0,
      lastY: 0,
      velocityX: 0,              // momentum
      velocityY: 0,
      sensitivity: 0.005,        // radians per pixel
      friction: 0.92,            // momentum decay per frame
      pitchClamp: Math.PI * 50 / 180, // ±50° elevation
      zoom: config.zoom || 5.4,          // camera Z distance — matches buildCamera default
      zoomMin: config.zoomMin || 3.2,    // closest zoom (large graph)
      zoomMax: config.zoomMax || 9.0,    // farthest zoom (small graph) — configurable (v2 overscan)
      zoomSensitivity: 0.003,    // scroll delta multiplier
      pinchDist: 0,              // last pinch distance for touch zoom
      focusX: 0,                 // graph-local X offset for orbit pivot (0 = center)
      focusY: 0,                 // graph-local Y offset for orbit pivot (0 = center)
    };

    // Morph rotation offset — composed with orbit in animation loop
    const morphOffset = { x: 0, y: 0 };

    // ── Beat engine state (scripted orbit choreography) ──
    let beatState = null;
    // When active: { sequence, options, index, phase, phaseStart,
    //                startYaw, startPitch, targetYaw, targetPitch,
    //                startFocusX, startFocusY, targetFocusX, targetFocusY,
    //                startZoom, targetZoom }

    // ── Beat engine tick (called from animate loop) ──

    function tickBeats(now) {
      if (!beatState) return;

      // User drag interrupts beat sequence
      if (orbit.dragging) {
        var cb = beatState.options.onComplete;
        beatState = null;
        if (cb) cb('interrupted');
        return;
      }

      var beat = beatState.sequence[beatState.index];
      var elapsed = now - beatState.phaseStart;

      if (beatState.phase === 'transition') {
        var dur = beat.duration || 0;
        if (dur <= 0) {
          // Instant snap
          orbit.yaw = beatState.targetYaw;
          orbit.pitch = beatState.targetPitch;
          orbit.focusX = beatState.targetFocusX;
          orbit.focusY = beatState.targetFocusY;
          orbit.zoom = beatState.targetZoom;
          beatState.phase = 'hold';
          beatState.phaseStart = now;
        } else {
          var t = Math.min(elapsed / dur, 1);
          // Cubic ease in-out
          var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          orbit.yaw = beatState.startYaw + (beatState.targetYaw - beatState.startYaw) * ease;
          orbit.pitch = beatState.startPitch + (beatState.targetPitch - beatState.startPitch) * ease;
          orbit.focusX = beatState.startFocusX + (beatState.targetFocusX - beatState.startFocusX) * ease;
          orbit.focusY = beatState.startFocusY + (beatState.targetFocusY - beatState.startFocusY) * ease;
          orbit.zoom = beatState.startZoom + (beatState.targetZoom - beatState.startZoom) * ease;
          if (t >= 1) {
            orbit.yaw = beatState.targetYaw;
            orbit.pitch = beatState.targetPitch;
            orbit.focusX = beatState.targetFocusX;
            orbit.focusY = beatState.targetFocusY;
            orbit.zoom = beatState.targetZoom;
            beatState.phase = 'hold';
            beatState.phaseStart = now;
          }
        }
      } else if (beatState.phase === 'hold') {
        var holdDur = beat.hold || 0;
        if (elapsed >= holdDur) {
          // Advance to next beat
          beatState.index++;
          if (beatState.index >= beatState.sequence.length) {
            // Sequence complete — loop or finish
            if (beatState.options.loop) {
              beatState.index = 0;
            } else {
              var cb2 = beatState.options.onComplete;
              beatState = null;
              if (cb2) cb2('complete');
              return;
            }
          }
          // Set up next beat transition
          var next = beatState.sequence[beatState.index];
          beatState.startYaw = orbit.yaw;
          beatState.startPitch = orbit.pitch;
          beatState.startFocusX = orbit.focusX;
          beatState.startFocusY = orbit.focusY;
          beatState.startZoom = orbit.zoom;
          beatState.targetYaw = (next.yaw || 0) * Math.PI / 180;
          beatState.targetPitch = Math.max(-orbit.pitchClamp,
            Math.min(orbit.pitchClamp, (next.pitch || 0) * Math.PI / 180));
          // Focus: if beat specifies focus, convert normalized→graph coords; else hold current
          if (next.focus) {
            beatState.targetFocusX = (next.focus.x - 0.5) * GRAPH_SIZE;
            beatState.targetFocusY = (0.5 - next.focus.y) * GRAPH_SIZE;
          } else {
            beatState.targetFocusX = orbit.focusX;
            beatState.targetFocusY = orbit.focusY;
          }
          // Zoom: if beat specifies zoom, use it; else hold current
          beatState.targetZoom = (next.zoom != null) ? next.zoom : orbit.zoom;
          beatState.phase = 'transition';
          beatState.phaseStart = now;
        }
      }
    }

    // ── Animation loop (per-instance) ──

    function animate() {
      if (!mounted || !active) return;
      animId = requestAnimationFrame(animate);
      pinT += 0.016;

      // ── v2 additive: field migration tween (dots/pin/axes → home) ──
      if (migration) tickMigration(performance.now());

      // ── Beat engine (takes priority over momentum when active) ──
      if (beatState && !orbit.dragging) {
        tickBeats(performance.now());
        orbit.velocityX = 0;
        orbit.velocityY = 0;
      }

      // ── Orbit momentum (when not dragging and no beats playing, velocity decays) ──
      else if (!orbit.dragging && (Math.abs(orbit.velocityX) > 0.0001 || Math.abs(orbit.velocityY) > 0.0001)) {
        orbit.yaw += orbit.velocityX;
        orbit.pitch -= orbit.velocityY;
        orbit.pitch = Math.max(-orbit.pitchClamp, Math.min(orbit.pitchClamp, orbit.pitch));
        orbit.velocityX *= orbit.friction;
        orbit.velocityY *= orbit.friction;
      }

      // ── Apply orbit to graph group ──
      // Always apply rotation so spinTo() works even when user drag is disabled.
      // The orbit capability only gates pointer-drag input, not rotation itself.
      group.rotation.y = orbit.yaw + morphOffset.y;
      group.rotation.x = orbit.pitch + morphOffset.x;

      // ── Apply focus (shift group so focus point is at rotation center) ──
      group.position.x = -orbit.focusX;
      group.position.y = -orbit.focusY;

      // ── Apply zoom ──
      camera.position.z = orbit.zoom;

      // ── Pin hover animation ──
      if (pinGroup.visible && pinMeshes) {
        // Gentle bob along Z (perpendicular to plane)
        const bob = Math.sin(pinT * 2) * 0.005;
        const baseZ = (pinData && pinData.normZ) ? (pinData.normZ * Z_EXTENT * 0.8) : 0.02;
        pinGroup.position.z = baseZ + bob;

        // Shimmer
        if (pinMeshes.core) {
          // Orb style (v2): a breathing beacon — the glass pin pulses from
          // within, clearly apart from the aggregate whisper-pulses.
          pinMeshes.coreMat.emissiveIntensity = 1.1 + Math.sin(pinT * 1.6) * 0.5;
          if (pinMeshes.glowMat) {
            pinMeshes.glowMat.opacity = 0.22 + Math.sin(pinT * 1.2) * 0.14;
            var gpulse = 0.46 + Math.sin(pinT * 1.2) * 0.08;
            pinMeshes.glow.scale.set(gpulse, gpulse, 1);
          }
          if (pinRing) pinRing.material.opacity = 0.62 + Math.sin(pinT * 0.9) * 0.25;
        } else {
          const shimmer = 0.15 + Math.sin(pinT * 1.5) * 0.08;
          if (pinMeshes.pinMat) {
            pinMeshes.pinMat.emissiveIntensity = shimmer;
          }
          if (pinMeshes.glowMat) {
            pinMeshes.glowMat.opacity = 0.06 + Math.sin(pinT * 0.8) * 0.04;
          }
        }

        // Halo iridescent pulse
        if (pinMeshes.haloMat) {
          pinMeshes.haloMat.emissiveIntensity = 0.1 + Math.sin(pinT * 0.6) * 0.08;
          pinMeshes.haloMat.opacity = 0.28 + Math.sin(pinT * 1.1) * 0.07;
        }
      }

      // ── Aggregate dot proximity pulse ──
      for (var di = 0; di < dots.length; di++) {
        var dot = dots[di];
        if (dot.pulseSpeed > 0 && dot.glowMat) {
          var pulse = Math.sin(pinT * dot.pulseSpeed + dot.pulsePhase);
          // Opacity scales with speed — pulse mode (fast) glows brighter, cluster mode (slow) whispers
          var maxOpacity = Math.min(0.22, dot.pulseSpeed * 0.03);
          dot.glowMat.opacity = maxOpacity * (0.5 + 0.5 * pulse);
          var s = 0.15 + 0.05 * (0.5 + 0.5 * pulse);
          dot.glow.scale.set(s, s, 1);
        }
      }

      // ── Word cloud pulse — logarithmic breathe based on nearby dot density ──
      var wt = pinT;
      ['A', 'B', 'C', 'D'].forEach(function (q) {
        var wg = wordCloudGroups[q];
        if (!wg || !wg.visible) return;
        // Count dots in this quadrant for density factor
        var qDotCount = 0;
        for (var dj = 0; dj < dots.length; dj++) {
          if (dots[dj].data && dots[dj].data.quadrant === q) qDotCount++;
        }
        // Logarithmic intensity: log2(1 + count) / 4, capped at 1.0
        // Base pulse of 0.3 so words always breathe a little
        var density = Math.min(1.0, 0.3 + Math.log2(1 + qDotCount) / 4);

        wg.children.forEach(function (sprite) {
          var ud = sprite.userData;
          if (!ud || !ud.baseScaleX) return;
          // Breathe: slow sine wave, amplitude scaled by density and word weight
          var breathe = Math.sin(wt * (0.6 + ud.weight * 0.4) + ud.phase);
          // Scale pulse: 0-15% growth based on density
          var pulse = 1.0 + breathe * 0.15 * density;
          sprite.scale.x = ud.baseScaleX * pulse;
          sprite.scale.y = ud.baseScaleY * pulse;
          // Opacity breathe: 0.65-1.0 range
          if (sprite.material) {
            sprite.material.opacity = 0.65 + breathe * 0.35 * density;
          }
        });
      });

      // ── Keyword sprite pulse (children of dot meshes, gentle breathe) ──
      for (var dki = 0; dki < dots.length; dki++) {
        var dkEntry = dots[dki];
        if (!dkEntry.keywordSprites || !dkEntry.keywordSprites.length) continue;
        for (var ksi = 0; ksi < dkEntry.keywordSprites.length; ksi++) {
          var ksSprite = dkEntry.keywordSprites[ksi].sprite;
          var ksUd = ksSprite.userData;
          if (!ksUd || !ksUd.baseScaleX) continue;
          var ksBreathe = Math.sin(wt * (0.5 + ksUd.weight * 0.3) + ksUd.phase);
          var ksPulse = 1.0 + ksBreathe * 0.10;
          ksSprite.scale.x = ksUd.baseScaleX * ksPulse;
          ksSprite.scale.y = ksUd.baseScaleY * ksPulse;
          if (ksSprite.material) {
            ksSprite.material.opacity = 0.6 + ksBreathe * 0.3;
          }
        }
      }

      // ── Trace animation ──
      updateTrace(pinT);

      renderer.render(scene, camera);
    }

    // ── External update tick (called by host render loop when externalParent is set) ──
    // Drives pin bob, dot pulse, word cloud breathe, keyword sprite pulse.
    // Does NOT touch orbit, camera, or renderer — host owns those.

    function update(elapsed) {
      pinT = elapsed;  // use host's clock directly

      // ── Pin hover animation ──
      if (pinGroup.visible && pinMeshes) {
        const bob = Math.sin(pinT * 2) * 0.005;
        const baseZ = (pinData && pinData.normZ) ? (pinData.normZ * Z_EXTENT * 0.8) : 0.02;
        pinGroup.position.z = baseZ + bob;
        const shimmer = 0.15 + Math.sin(pinT * 1.5) * 0.08;
        if (pinMeshes.pinMat) pinMeshes.pinMat.emissiveIntensity = shimmer;
        if (pinMeshes.glowMat) pinMeshes.glowMat.opacity = 0.06 + Math.sin(pinT * 0.8) * 0.04;
        if (pinMeshes.haloMat) {
          pinMeshes.haloMat.emissiveIntensity = 0.1 + Math.sin(pinT * 0.6) * 0.08;
          pinMeshes.haloMat.opacity = 0.28 + Math.sin(pinT * 1.1) * 0.07;
        }
      }

      // ── Aggregate dot proximity pulse ──
      for (var di = 0; di < dots.length; di++) {
        var dot = dots[di];
        if (dot.pulseSpeed > 0 && dot.glowMat) {
          var pulse = Math.sin(pinT * dot.pulseSpeed + dot.pulsePhase);
          var maxOpacity = Math.min(0.22, dot.pulseSpeed * 0.03);
          dot.glowMat.opacity = maxOpacity * (0.5 + 0.5 * pulse);
          var s = 0.15 + 0.05 * (0.5 + 0.5 * pulse);
          dot.glow.scale.set(s, s, 1);
        }
      }

      // ── Word cloud pulse ──
      var wt = pinT;
      ['A', 'B', 'C', 'D'].forEach(function (q) {
        var wg = wordCloudGroups[q];
        if (!wg || !wg.visible) return;
        var qDotCount = 0;
        for (var dj = 0; dj < dots.length; dj++) {
          if (dots[dj].data && dots[dj].data.quadrant === q) qDotCount++;
        }
        var density = Math.min(1.0, 0.3 + Math.log2(1 + qDotCount) / 4);
        wg.children.forEach(function (sprite) {
          var ud = sprite.userData;
          if (!ud || !ud.baseScaleX) return;
          var breathe = Math.sin(wt * (0.6 + ud.weight * 0.4) + ud.phase);
          var pulseFactor = 1.0 + breathe * 0.15 * density;
          sprite.scale.x = ud.baseScaleX * pulseFactor;
          sprite.scale.y = ud.baseScaleY * pulseFactor;
          if (sprite.material) {
            sprite.material.opacity = 0.65 + breathe * 0.35 * density;
          }
        });
      });

      // ── Keyword sprite pulse ──
      for (var dki = 0; dki < dots.length; dki++) {
        var dkEntry = dots[dki];
        if (!dkEntry.keywordSprites || !dkEntry.keywordSprites.length) continue;
        for (var ksi = 0; ksi < dkEntry.keywordSprites.length; ksi++) {
          var ksSprite = dkEntry.keywordSprites[ksi].sprite;
          var ksUd = ksSprite.userData;
          if (!ksUd || !ksUd.baseScaleX) continue;
          var ksBreathe = Math.sin(wt * (0.5 + ksUd.weight * 0.3) + ksUd.phase);
          var ksPulse = 1.0 + ksBreathe * 0.10;
          ksSprite.scale.x = ksUd.baseScaleX * ksPulse;
          ksSprite.scale.y = ksUd.baseScaleY * ksPulse;
          if (ksSprite.material) {
            ksSprite.material.opacity = 0.6 + ksBreathe * 0.3;
          }
        }
      }

      // ── Trace animation ──
      updateTrace(pinT);
    }

    // ── Resize (per-instance, uses ResizeObserver on container) ──

    function resize() {
      if (!containerEl) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    // ── Viewport lifecycle (activate / deactivate) ──
    // Pauses/resumes the rAF loop without touching DOM, events, or state.
    // The graph freezes in place when offscreen, resumes seamlessly when visible.

    function activate() {
      if (active || !mounted) return;
      active = true;
      animate();
    }

    function deactivate() {
      if (!active) return;
      active = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      // Kill momentum and beats so graph doesn't lurch when reactivated
      orbit.velocityX = 0;
      orbit.velocityY = 0;
      beatState = null;
      // Render one final frame so the frozen state looks clean
      renderer.render(scene, camera);
    }

    function bindViewportObserver() {
      if (!config.lifecycle.activateOnViewport) return;
      if (typeof IntersectionObserver === 'undefined') return;

      // Start deactivated — observer will fire immediately if already visible
      if (config.lifecycle.deactivateOnExit) {
        active = false;
      }

      intersectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            activate();
          } else if (config.lifecycle.deactivateOnExit) {
            deactivate();
          }
        });
      }, { threshold: 0.05 });   // 5% visible triggers activation

      intersectionObserver.observe(containerEl);
    }

    function unbindViewportObserver() {
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
    }

    // ── Drag-to-rotate + hold-to-inspect interaction ──

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getClientCoords(e) {
      const cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      return { cx, cy };
    }

    function hitTest(cx, cy) {
      // Returns { type: 'pin'|'dot', data: {...} } or null
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Check pin first (higher priority)
      if (pinGroup.visible && pinData) {
        const pinHits = raycaster.intersectObjects(pinGroup.children, true);
        if (pinHits.length > 0) return { type: 'pin', data: { ...pinData, instance } };
      }

      // Check aggregate dots
      if (dots.length > 0) {
        const dotMeshes = dots.map(d => d.mesh);
        const dotHits = raycaster.intersectObjects(dotMeshes, true);
        if (dotHits.length > 0) {
          const hitMesh = dotHits[0].object;
          const dotEntry = dots.find(d => d.mesh === hitMesh);
          if (dotEntry) return { type: 'dot', data: { ...dotEntry.data, instance } };
        }
      }

      // Check member pins (Phase 6.1.5)
      if (memberPins.length > 0) {
        const pinMeshes = memberPins.map(p => p.mesh);
        const pinHits = raycaster.intersectObjects(pinMeshes, true);
        if (pinHits.length > 0) {
          const hitMesh = pinHits[0].object;
          const pinEntry = memberPins.find(p => p.mesh === hitMesh);
          if (pinEntry) return { type: 'member', data: { ...pinEntry.data, instance } };
        }
      }

      return null;
    }

    function cancelHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    }

    function onPointerDown(e) {
      const { cx, cy } = getClientCoords(e);
      holdStartX = cx;
      holdStartY = cy;

      // Start hold-to-inspect timer (works for both pins and dots)
      cancelHold();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        const hit = hitTest(holdStartX, holdStartY);
        if (hit && onInspectCallback) {
          onInspectCallback(hit.data);
        }
      }, HOLD_MS);

      // Orbit drag
      if (!config.capabilities.orbit) return;
      orbit.dragging = true;
      orbit.lastX = cx;
      orbit.lastY = cy;
      orbit.velocityX = 0;
      orbit.velocityY = 0;
      canvas.style.cursor = 'grabbing';
    }

    function onPointerMove(e) {
      const { cx, cy } = getClientCoords(e);

      // Cancel hold if moved too far
      if (holdTimer) {
        const dist = Math.hypot(cx - holdStartX, cy - holdStartY);
        if (dist > HOLD_MOVE_TOLERANCE) cancelHold();
      }

      if (!orbit.dragging) return;
      const dx = cx - orbit.lastX;
      const dy = cy - orbit.lastY;
      orbit.lastX = cx;
      orbit.lastY = cy;

      orbit.velocityX = dx * orbit.sensitivity;
      orbit.velocityY = dy * orbit.sensitivity;

      orbit.yaw += orbit.velocityX;
      orbit.pitch -= orbit.velocityY;
      orbit.pitch = Math.max(-orbit.pitchClamp, Math.min(orbit.pitchClamp, orbit.pitch));
    }

    function onPointerUp() {
      cancelHold();
      orbit.dragging = false;
      canvas.style.cursor = config.capabilities.orbit ? 'grab' : 'default';
    }

    // ── Zoom handlers ──

    function onWheel(e) {
      e.preventDefault();
      orbit.zoom += e.deltaY * orbit.zoomSensitivity;
      orbit.zoom = Math.max(orbit.zoomMin, Math.min(orbit.zoomMax, orbit.zoom));
    }

    function onTouchStart(e) {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch start — record initial distance
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        orbit.pinchDist = Math.hypot(dx, dy);
      } else {
        onPointerDown(e);
      }
    }

    function onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 2 && orbit.pinchDist > 0) {
        // Pinch zoom
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        var dist = Math.hypot(dx, dy);
        var delta = orbit.pinchDist - dist; // positive = pinch in = zoom out
        orbit.zoom += delta * 0.015;
        orbit.zoom = Math.max(orbit.zoomMin, Math.min(orbit.zoomMax, orbit.zoom));
        orbit.pinchDist = dist;
      } else {
        onPointerMove(e);
      }
    }

    function onTouchEnd(e) {
      orbit.pinchDist = 0;
      onPointerUp(e);
    }

    function bindDragEvents() {
      if (config.capabilities.orbit) {
        canvas.style.cursor = 'grab';
      }
      // Always bind pointer events (orbit + hold-to-inspect)
      // mousedown stopPropagation prevents parent pin-placement; mousemove uses veilState guards in consuming page
      canvas.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      // Wheel zoom
      canvas.addEventListener('wheel', onWheel, { passive: false });
      // Touch (orbit + pinch zoom)
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd);
    }

    function unbindDragEvents() {
      cancelHold();
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.style.cursor = 'default';
    }

    // ── Mount / Unmount ──

    function mount(container) {
      // External mode: group is already parented. Just mark as mounted.
      if (isExternal) {
        mounted = true;
        active = true;
        console.log('[PrismGraphmap] External instance activated (' + config.mode + ')');
        return instance;
      }

      if (mounted) unmount();
      containerEl = container || config.container;
      if (!containerEl) {
        console.error('[PrismGraphmap] No container provided');
        return instance;
      }
      // Only force `position:relative` when the container is actually static —
      // `element.style.position` reads only inline style, so the old `|| 'relative'`
      // fallback would silently override a stylesheet-set `position:absolute`
      // (which is how the v2 `.gm3d-stage` `inset:-40%` sizing trick is built).
      if (getComputedStyle(containerEl).position === 'static') {
        containerEl.style.position = 'relative';
      }
      canvas.style.cssText = 'position:absolute;inset:-12%;width:124%!important;height:124%!important;';
      containerEl.appendChild(canvas);
      mounted = true;
      active = true;  // reset — bindViewportObserver may override to false

      // Use ResizeObserver instead of global window.resize
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => { if (mounted) resize(); });
        resizeObserver.observe(containerEl);
      }

      resize();
      bindDragEvents();
      bindViewportObserver();
      // Always render one frame so canvas isn't blank, even if viewport-gated
      renderer.render(scene, camera);
      animate();
      console.log('[PrismGraphmap] Instance mounted (' + config.mode + ')');
      return instance;
    }

    function unmount() {
      mounted = false;
      active = false;

      // External mode: remove group from parent, reset transforms
      if (isExternal) {
        if (group.parent) group.parent.remove(group);
        group.rotation.set(0, 0, 0);
        group.position.set(0, 0, 0);
        clearPin();
        clearDots();
        console.log('[PrismGraphmap] External instance deactivated');
        return instance;
      }

      if (animId) { cancelAnimationFrame(animId); animId = null; }
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      unbindViewportObserver();
      unbindDragEvents();
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      group.rotation.set(0, 0, 0);
      group.position.set(0, 0, 0);
      morphOffset.x = 0;
      morphOffset.y = 0;
      orbit.yaw = 0;
      orbit.pitch = 0;
      orbit.velocityX = 0;
      orbit.velocityY = 0;
      orbit.zoom = 5.4;
      orbit.focusX = 0;
      orbit.focusY = 0;
      orbit.pinchDist = 0;
      beatState = null;
      clearPin();
      clearDots();
      containerEl = null;
      console.log('[PrismGraphmap] Instance unmounted');
      return instance;
    }

    // ── Reparent: move canvas to a new container without destroying WebGL context ──
    // Events stay bound to canvas. Only DOM parent, ResizeObserver, and size update.

    function reparent(newContainer) {
      if (!mounted || !newContainer) return instance;

      // Move canvas
      newContainer.style.position = newContainer.style.position || 'relative';
      newContainer.appendChild(canvas);
      containerEl = newContainer;

      // Switch ResizeObserver
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver.observe(newContainer);
      }

      // Switch IntersectionObserver
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver.observe(newContainer);
      }

      // Resize to new container dimensions
      resize();
      // Render immediately so it's not blank during transition
      renderer.render(scene, camera);
      return instance;
    }

    // ── Pin API ──

    let zConnector = null; // line from plane surface to pin

    let pinRing = null, pinRingColor = null;   // Diatribe aperture ring (v2, additive)

    function setPin(normX, normY, quadrant, normZ, opts) {
      // Gate: if zInput disabled, clamp to plane surface
      if (!config.capabilities.zInput) normZ = 0;

      const x = (normX - 0.5) * GRAPH_SIZE;
      const y = (0.5 - normY) * GRAPH_SIZE;
      const z = (normZ || 0) * Z_EXTENT * 0.8;  // gallery-matched: gz * zExtent * 0.8



      // Fast path: skip geometry rebuild if quadrant/style unchanged and pin exists
      const pinStyle = (opts && opts.style) || 'cone';
      const needsRebuild = !pinMeshes || !pinData || pinData.quadrant !== quadrant || pinData.style !== pinStyle;
      if (needsRebuild) {
        pinMeshes = rebuildPin(pinGroup, quadrant, pinStyle);
      }

      // For negative Z: flip cone so tip still points toward plane (+Z from below)
      // (no-op for the orb style — spheres are rotation-invariant)
      if (pinMeshes.pin && pinStyle !== 'orb') {
        pinMeshes.pin.rotation.x = (normZ && normZ < 0) ? Math.PI / 2 : -Math.PI / 2;
      }

      // v2 additive: opts.at = display override (normalized, z in normZ units).
      // The pin SPAWNS there — e.g. its position in the pad's skewed frame —
      // and migrateAll() later carries it home to its true coordinates.
      // pinData.normZ tracks the DISPLAY z (the animate-loop bob reads it);
      // homeNormZ remembers the true z for the migration target.
      var px = x, py = y, pz = z;
      var displayNormZ = normZ || 0;
      if (opts && opts.at) {
        if (opts.at.x != null) px = (opts.at.x - 0.5) * GRAPH_SIZE;
        if (opts.at.y != null) py = (0.5 - opts.at.y) * GRAPH_SIZE;
        if (opts.at.z != null) { displayNormZ = opts.at.z; pz = displayNormZ * Z_EXTENT * 0.8; }
      }
      pinGroup.position.set(px, py, pz || 0.02);
      pinGroup.visible = true;
      pinData = { normX, normY, quadrant, normZ: displayNormZ, homeNormZ: normZ || 0, style: pinStyle };

      // Diatribe ring (v2, additive): aperture-band halo around the pin.
      // Recreated only when the ring color actually changes (setPin is hot).
      const ringCol = opts && opts.ring;
      if (ringCol !== pinRingColor) {
        if (pinRing) {
          pinRing.material.dispose(); pinRing.texture.dispose();
          pinGroup.remove(pinRing.sprite); pinRing = null;
        }
        if (ringCol) {
          pinRing = makeRingSprite(ringCol);
          pinRing.sprite.scale.set(0.34, 0.34, 1);
          pinGroup.add(pinRing.sprite);
        }
        pinRingColor = ringCol || null;
      }

      // Z connector line (plane surface → pin) — only when zRender enabled
      if (zConnector) {
        zConnector.geometry.dispose();
        group.remove(zConnector);
        zConnector = null;
      }
      if (config.capabilities.zRender && normZ && Math.abs(normZ) > 0.01) {
        const baseColor = PIN_COLORS[quadrant] || 0xb83a3a;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(px, py, 0),
          new THREE.Vector3(px, py, pz),
        ]);
        zConnector = new THREE.Line(lineGeo,
          new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.3 })
        );
        group.add(zConnector);
      }

      return instance;
    }

    function clearPin() {
      pinGroup.visible = false;
      pinData = null;
      if (zConnector) {
        zConnector.geometry.dispose();
        group.remove(zConnector);
        zConnector = null;
      }
      return instance;
    }

    // ── Aggregate Dots API ──
    // Gallery-matched: SphereGeometry(0.05, 14, 10) with glow sprite + Z connector

    const dots = [];       // { mesh, connector, glow, data }
    const dotsGroup = new THREE.Group();
    group.add(dotsGroup);

    function addDot(normX, normY, quadrant, normZ, opts) {
      opts = opts || {};
      // Gate: if zInput disabled, clamp to plane surface
      if (!config.capabilities.zInput) normZ = 0;

      const baseColor = PIN_COLORS[quadrant] || C.cream;
      const col = new THREE.Color(opts.color || baseColor);
      const x = (normX - 0.5) * GRAPH_SIZE;
      const y = (0.5 - normY) * GRAPH_SIZE;
      const z = (normZ || 0) * Z_EXTENT * 0.8;

      // v2 additive: opts.at = display override (normalized, z in normZ
      // units). The dot SPAWNS there — e.g. in the skewed/log-floated frame —
      // and migrateAll() later tweens it home to (x, y, z).
      var atX = x, atY = y, atZ = z;
      if (opts.at) {
        if (opts.at.x != null) atX = (opts.at.x - 0.5) * GRAPH_SIZE;
        if (opts.at.y != null) atY = (0.5 - opts.at.y) * GRAPH_SIZE;
        if (opts.at.z != null) atZ = opts.at.z * Z_EXTENT * 0.8;
      }

      // Sphere — deep base with emissive inner glow (Getty style)
      const brightCol = col.clone();
      brightCol.offsetHSL(0, 0.2, -0.05); // saturate but darken
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(opts.radius || 0.05, 14, 10),
        new THREE.MeshStandardMaterial({
          color: brightCol,
          emissive: brightCol,
          emissiveIntensity: 0.4,
          roughness: 0.3,
          metalness: 0.2,
        })
      );
      mesh.position.set(atX, atY, atZ);
      mesh.userData = { isGraphmapDot: true, label: opts.label || '', desc: opts.desc || '', quadrant, normX, normY, normZ: normZ || 0 };
      dotsGroup.add(mesh);

      // Pulse glow sprite — starts invisible, activated by computeProximity()
      const glowMat = new THREE.SpriteMaterial({
        color: baseColor, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(0.18, 0.18, 1);
      mesh.add(glow);

      // Z connector line (plane → dot) — only when zRender enabled
      let connector = null;
      if (config.capabilities.zRender && normZ && Math.abs(normZ) > 0.01) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(atX, atY, 0),
          new THREE.Vector3(atX, atY, atZ),
        ]);
        connector = new THREE.Line(lineGeo,
          new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.15 })
        );
        dotsGroup.add(connector);
      }

      const dotEntry = {
        mesh, connector, glow, glowMat,
        homePos: new THREE.Vector3(x, y, z),   // true coordinates — migrateAll() target
        ringSprite: null,     // Diatribe band ring (v2, additive)
        keywordSprites: [],   // { sprite, material, texture } — children of mesh
        pulseSpeed: 0,    // 0 = no pulse, set by computeProximity()
        pulsePhase: Math.random() * Math.PI * 2, // random offset so neighbors don't sync
        data: { normX, normY, quadrant, normZ: normZ || 0, label: opts.label || '', desc: opts.desc || '' },
      };

      // Diatribe band ring (v2, additive) — billboard halo around the orb
      if (opts.ring) {
        const ring = makeRingSprite(opts.ring);
        const rr = (opts.radius || 0.05) * 4;
        ring.sprite.scale.set(rr, rr, 1);
        mesh.add(ring.sprite);
        dotEntry.ringSprite = ring;
      }

      // ── Keyword sprites (orbit around the dot in 3D) ──
      if (opts.keywords && opts.keywords.length > 0) {
        var kwColor = WORD_COLORS[quadrant] || 'rgba(245,240,232,0.7)';
        var count = opts.keywords.length;
        for (var ki = 0; ki < count; ki++) {
          var kw = opts.keywords[ki];
          var text = typeof kw === 'string' ? kw : kw.text;
          var weight = (typeof kw === 'object' && kw.weight != null) ? kw.weight : 0.6;
          var fs = Math.round(22 + weight * 18);
          var kwSprite = makeWordSprite(text, kwColor, fs);

          // Position in a ring around the orb — slight Z scatter for depth
          var angle = (ki / count) * Math.PI * 2 + ki * 0.3;
          var ringR = (opts.radius || 0.05) * 4 + 0.12;
          kwSprite.sprite.position.set(
            Math.cos(angle) * ringR,
            Math.sin(angle) * ringR,
            (Math.random() - 0.5) * 0.08
          );
          kwSprite.sprite.renderOrder = 100;
          kwSprite.sprite.userData = {
            baseScaleX: kwSprite.sprite.scale.x,
            baseScaleY: kwSprite.sprite.scale.y,
            weight: weight,
            phase: ki * 1.2 + Math.random(),
            quadrant: quadrant,
          };
          mesh.add(kwSprite.sprite);
          dotEntry.keywordSprites.push(kwSprite);
        }
      }

      dots.push(dotEntry);
      return dotEntry;
    }

    function clearDots() {
      dots.forEach(d => {
        // Dispose keyword sprites (children of mesh)
        if (d.keywordSprites) {
          d.keywordSprites.forEach(function (ks) {
            if (ks.material) ks.material.dispose();
            if (ks.texture) ks.texture.dispose();
            d.mesh.remove(ks.sprite);
          });
          d.keywordSprites.length = 0;
        }
        if (d.ringSprite) {
          d.ringSprite.material.dispose();
          d.ringSprite.texture.dispose();
          d.mesh.remove(d.ringSprite.sprite);
        }
        if (d.glowMat) d.glowMat.dispose();
        if (d.mesh.geometry) d.mesh.geometry.dispose();
        if (d.mesh.material) d.mesh.material.dispose();
        dotsGroup.remove(d.mesh);
        if (d.connector) {
          d.connector.geometry.dispose();
          d.connector.material.dispose();
          dotsGroup.remove(d.connector);
        }
      });
      dots.length = 0;
      return instance;
    }

    // ── Contrast line (additive API, v2) ─────────────────────
    // A single bright line between two normalized points (each {x, y, z}
    // with x/y in 0..1 pad space and z in -1..1). Used by the v2 contrast
    // function to tether the user's pin to an inspected aggregate dot.
    let contrastLineObj = null;
    function setContrastLine(a, b, opts) {
      opts = opts || {};
      clearContrastLine();
      const ax = (a.x - 0.5) * GRAPH_SIZE, ay = (0.5 - a.y) * GRAPH_SIZE, az = (a.z || 0) * Z_EXTENT * 0.8;
      const bx = (b.x - 0.5) * GRAPH_SIZE, by = (0.5 - b.y) * GRAPH_SIZE, bz = (b.z || 0) * Z_EXTENT * 0.8;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax, ay, az),
        new THREE.Vector3(bx, by, bz),
      ]);
      contrastLineObj = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: opts.color != null ? opts.color : 0xfff6e2,
        transparent: true,
        opacity: opts.opacity != null ? opts.opacity : 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      group.add(contrastLineObj);
      return instance;
    }
    function clearContrastLine() {
      if (contrastLineObj) {
        contrastLineObj.geometry.dispose();
        contrastLineObj.material.dispose();
        group.remove(contrastLineObj);
        contrastLineObj = null;
      }
      return instance;
    }

    // ── Member Pin API (Phase 6.1.5) ──
    // Distinct from aggregate dots: party color, larger sphere, thin
    // vertical stem to the plane (reads as "pinned token" vs floating dot).
    // Does NOT participate in computeProximity — members have their own
    // visual logic (no pulse, no cluster shrink).
    const PARTY_COLORS = {
      D: 0x3a6fb8,   // brighter than B-quadrant blue
      R: 0xd64a4a,   // brighter than A-quadrant red
      I: 0xb8a878,   // warm grey-gold
    };

    const memberPins = [];   // { mesh, stem, data }
    const memberPinsGroup = new THREE.Group();
    group.add(memberPinsGroup);

    function addMemberPin(normX, normY, party, opts) {
      opts = opts || {};
      const partyKey = (party || 'I').toUpperCase();
      const color = PARTY_COLORS[partyKey] || PARTY_COLORS.I;

      const normZ = (config.capabilities.zInput && opts.normZ != null) ? opts.normZ : 0;
      const x = (normX - 0.5) * GRAPH_SIZE;
      const y = (0.5 - normY) * GRAPH_SIZE;
      const z = normZ * Z_EXTENT * 0.8;

      // Sphere — slightly larger than aggregate dots, lower emissive so
      // they read as "solid pinned tokens" rather than "glowing cloud."
      const baseColor = new THREE.Color(color);
      const radius = opts.radius || 0.07;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 12),
        new THREE.MeshStandardMaterial({
          color: baseColor,
          emissive: baseColor,
          emissiveIntensity: 0.22,   // dimmer than aggregate dots (which use 0.4)
          roughness: 0.45,
          metalness: 0.15,
        })
      );
      mesh.position.set(x, y, z);
      mesh.userData = {
        isMemberPin: true,
        bioguideId: opts.bioguideId || null,
        name: opts.name || '',
        party: partyKey,
        chamber: opts.chamber || '',
        method: opts.method || '',
        confidence: opts.confidence != null ? opts.confidence : null,
        normX, normY, normZ,
      };
      memberPinsGroup.add(mesh);

      // Stem — thin vertical line from plane up to the pin. Makes the
      // pin read as planted in the surface rather than floating.
      let stem = null;
      if (config.capabilities.zRender) {
        const stemGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(x, y, z),
        ]);
        stem = new THREE.Line(stemGeo,
          new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.55 })
        );
        memberPinsGroup.add(stem);
      }

      const entry = { mesh, stem, data: mesh.userData };
      memberPins.push(entry);
      return entry;
    }

    function clearMemberPins() {
      memberPins.forEach(p => {
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
        memberPinsGroup.remove(p.mesh);
        if (p.stem) {
          p.stem.geometry.dispose();
          p.stem.material.dispose();
          memberPinsGroup.remove(p.stem);
        }
      });
      memberPins.length = 0;
      return instance;
    }

    function setMemberPinsVisible(visible) {
      memberPinsGroup.visible = !!visible;
      return instance;
    }

    function getMemberPinAt(intersected) {
      // Helper for hold-to-inspect integration. Caller passes a hit
      // result; we return the member metadata if it's a pin.
      if (!intersected || !intersected.userData) return null;
      return intersected.userData.isMemberPin ? intersected.userData : null;
    }

    // ── Proximity computation: two modes ──
    // 'pulse' — dots stay full size, glow shimmers faster with more neighbors
    // 'cluster' — dots shrink logarithmically, very faint shimmer
    function computeProximity(threshold, mode) {
      threshold = threshold || 0.55;
      mode = mode || 'pulse';
      var len = dots.length;
      for (var i = 0; i < len; i++) {
        var neighbors = 0;
        var pi = dots[i].mesh.position;
        for (var j = 0; j < len; j++) {
          if (i === j) continue;
          var pj = dots[j].mesh.position;
          var dx = pi.x - pj.x, dy = pi.y - pj.y, dz = pi.z - pj.z;
          if (dx * dx + dy * dy + dz * dz < threshold * threshold) {
            neighbors++;
          }
        }

        if (mode === 'cluster') {
          // Logarithmic shrink
          var k = 0.5;
          var scale = 1.0 / (1.0 + k * Math.log(1 + neighbors));
          dots[i].mesh.scale.setScalar(scale);
          // Whisper pulse only
          dots[i].pulseSpeed = neighbors === 0 ? 0 : 0.6 + neighbors * 0.3;
          if (dots[i].pulseSpeed > 4) dots[i].pulseSpeed = 4;
        } else {
          // Pulse mode — full size, shimmer scales with density
          dots[i].mesh.scale.setScalar(1.0);
          dots[i].pulseSpeed = neighbors === 0 ? 0 : 1.0 + neighbors * 0.8;
          if (dots[i].pulseSpeed > 8) dots[i].pulseSpeed = 8;
        }
      }
      return instance;
    }

    function getDots() {
      return dots.map(d => d.data);
    }

    // ── Orbit API (programmatic control) ──

    function setOrbit(yawDeg, pitchDeg) {
      orbit.yaw = (yawDeg || 0) * Math.PI / 180;
      orbit.pitch = (pitchDeg || 0) * Math.PI / 180;
      orbit.pitch = Math.max(-orbit.pitchClamp, Math.min(orbit.pitchClamp, orbit.pitch));
      orbit.velocityX = 0;
      orbit.velocityY = 0;
      return instance;
    }

    function getOrbit() {
      return {
        yaw: orbit.yaw * 180 / Math.PI,
        pitch: orbit.pitch * 180 / Math.PI,
      };
    }

    function setZoom(z) {
      orbit.zoom = Math.max(orbit.zoomMin, Math.min(orbit.zoomMax, z));
      return instance;
    }

    function getZoom() {
      return orbit.zoom;
    }

    // Focus: set the orbit pivot point in normalized coords (0-1)
    // (0.5, 0.5) = graph center. Shift is immediate (no animation).
    function setFocus(normX, normY) {
      orbit.focusX = ((normX != null ? normX : 0.5) - 0.5) * GRAPH_SIZE;
      orbit.focusY = (0.5 - (normY != null ? normY : 0.5)) * GRAPH_SIZE;
      return instance;
    }

    function getFocus() {
      return {
        x: orbit.focusX / GRAPH_SIZE + 0.5,
        y: 0.5 - orbit.focusY / GRAPH_SIZE,
      };
    }

    function spinTo(yawDeg, pitchDeg, durationMs) {
      // Animated transition to target rotation
      // Stops any running beat sequence — spinTo is a manual override
      if (beatState) beatState = null;

      const startYaw = orbit.yaw;
      const startPitch = orbit.pitch;
      const targetYaw = (yawDeg || 0) * Math.PI / 180;
      const targetPitch = Math.max(-orbit.pitchClamp,
        Math.min(orbit.pitchClamp, (pitchDeg || 0) * Math.PI / 180));
      const duration = durationMs || 800;
      const startTime = performance.now();
      orbit.velocityX = 0;
      orbit.velocityY = 0;

      function tick(now) {
        const t = Math.min((now - startTime) / duration, 1);
        // Ease in-out cubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        orbit.yaw = startYaw + (targetYaw - startYaw) * ease;
        orbit.pitch = startPitch + (targetPitch - startPitch) * ease;
        if (t < 1 && mounted) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      return instance;
    }

    // ── Beat engine API (scripted orbit choreography) ──
    // Sequence of { yaw, pitch, duration, hold } — all in degrees / ms.
    // Driven by main animate loop. User drag interrupts.

    function playBeats(sequence, opts) {
      if (!sequence || !sequence.length) return instance;
      opts = opts || {};
      var first = sequence[0];
      // Focus: convert normalized coords to graph-local; hold current if unspecified
      var tFocusX = orbit.focusX;
      var tFocusY = orbit.focusY;
      if (first.focus) {
        tFocusX = (first.focus.x - 0.5) * GRAPH_SIZE;
        tFocusY = (0.5 - first.focus.y) * GRAPH_SIZE;
      }
      beatState = {
        sequence: sequence,
        options: { loop: !!opts.loop, onComplete: opts.onComplete || null },
        index: 0,
        phase: 'transition',
        phaseStart: performance.now(),
        startYaw: orbit.yaw,
        startPitch: orbit.pitch,
        targetYaw: (first.yaw || 0) * Math.PI / 180,
        targetPitch: Math.max(-orbit.pitchClamp,
          Math.min(orbit.pitchClamp, (first.pitch || 0) * Math.PI / 180)),
        startFocusX: orbit.focusX,
        startFocusY: orbit.focusY,
        targetFocusX: tFocusX,
        targetFocusY: tFocusY,
        startZoom: orbit.zoom,
        targetZoom: (first.zoom != null) ? first.zoom : orbit.zoom,
      };
      orbit.velocityX = 0;
      orbit.velocityY = 0;
      return instance;
    }

    function stopBeats() {
      if (beatState) {
        var cb = beatState.options.onComplete;
        beatState = null;
        if (cb) cb('stopped');
      }
      return instance;
    }

    // ── v2 additive: field migration — carry the whole committed field home ──
    // Every dot (and the pin) tweens from its display/spawn position (opts.at)
    // to its true coordinates while the spectrum crosshair eases back to
    // center. This is the second half of the commit choreography: the skewed
    // frame holds through the commit, then the graph re-migrates to the
    // un-skewed plane. Smoothstepped; connectors track their dots per frame.
    var migration = null;
    function migrateAll(durationMs, onComplete) {
      var items = [];
      for (var mi = 0; mi < dots.length; mi++) {
        var md = dots[mi];
        if (md.homePos && !md.mesh.position.equals(md.homePos)) {
          items.push({ type: 'dot', d: md, from: md.mesh.position.clone(), to: md.homePos.clone() });
        }
      }
      if (pinData && pinGroup.visible) {
        var hx = (pinData.normX - 0.5) * GRAPH_SIZE;
        var hy = (0.5 - pinData.normY) * GRAPH_SIZE;
        var toNormZ = (pinData.homeNormZ != null) ? pinData.homeNormZ : pinData.normZ;
        items.push({
          type: 'pin',
          from: pinGroup.position.clone(),
          toX: hx, toY: hy,
          fromNormZ: pinData.normZ, toNormZ: toNormZ,
        });
      }
      migration = {
        start: performance.now(), dur: durationMs || 1400,
        items: items,
        axisFrom: { x: axisOffset.x, y: axisOffset.y },
        onComplete: onComplete || null,
      };
      return instance;
    }

    function tickMigration(now) {
      var t = Math.min(1, (now - migration.start) / migration.dur);
      var e = t * t * (3 - 2 * t);   // smoothstep
      for (var ti = 0; ti < migration.items.length; ti++) {
        var it = migration.items[ti];
        if (it.type === 'dot') {
          it.d.mesh.position.lerpVectors(it.from, it.to, e);
          if (it.d.connector) {
            var p = it.d.mesh.position;
            it.d.connector.geometry.setFromPoints([
              new THREE.Vector3(p.x, p.y, 0),
              new THREE.Vector3(p.x, p.y, p.z),
            ]);
          }
        } else {  // pin: x/y here; z via pinData.normZ (the bob branch owns position.z)
          pinGroup.position.x = it.from.x + (it.toX - it.from.x) * e;
          pinGroup.position.y = it.from.y + (it.toY - it.from.y) * e;
          pinData.normZ = it.fromNormZ + (it.toNormZ - it.fromNormZ) * e;
          if (zConnector) {
            zConnector.geometry.setFromPoints([
              new THREE.Vector3(pinGroup.position.x, pinGroup.position.y, 0),
              new THREE.Vector3(pinGroup.position.x, pinGroup.position.y, pinData.normZ * Z_EXTENT * 0.8),
            ]);
          }
        }
      }
      // the crosshair eases home to center alongside the field
      axisOffset.x = migration.axisFrom.x + (0.5 - migration.axisFrom.x) * e;
      axisOffset.y = migration.axisFrom.y + (0.5 - migration.axisFrom.y) * e;
      applyAxisOffset();
      if (t >= 1) {
        var mcb = migration.onComplete;
        migration = null;
        if (mcb) mcb();
      }
    }

    function isPlaying() {
      return !!beatState;
    }

    // ── Destroy (full cleanup) ──

    function destroy() {
      unmount();
      clearAllWords();
      clearBoundaryPhotos();
      disposeGroup(group);
      disposeGroup(pinGroup);
      if (renderer) renderer.dispose();
      console.log('[PrismGraphmap] Instance destroyed');
    }

    // ── Axis Labels API (per-event customization) ──

    function setAxisLabels(cfg) {
      // cfg: { xPos: 'Individual', xNeg: 'Collective', yPos: 'Authority', yNeg: 'Liberty' }
      const ae = labels.axisEntries;
      ['xPos', 'xNeg', 'yPos', 'yNeg'].forEach(function (key) {
        if (cfg[key] != null && ae[key]) {
          const entry = ae[key];
          const savedPos = entry.pos;

          // Dispose old sprite
          labels.labelsGroup.remove(entry.label.sprite);
          entry.label.material.dispose();
          entry.label.texture.dispose();

          // Build replacement billboard sprite
          var newLbl = makeLabelSprite(cfg[key], 'rgba(245,240,232,0.4)', 15);
          newLbl.sprite.scale.set(1.1, 0.14, 1);
          newLbl.sprite.position.copy(savedPos);
          labels.labelsGroup.add(newLbl.sprite);
          ae[key] = { label: newLbl, pos: savedPos };
        }
      });
      return instance;
    }

    function setCornerLabels(cfg) {
      // cfg: { A: 'Auth · Left', B: 'Auth · Right', C: 'Lib · Left', D: 'Lib · Right' }
      var ce = labels.cornerEntries;
      ['A', 'B', 'C', 'D'].forEach(function (key) {
        if (cfg[key] != null && ce[key]) {
          var entry = ce[key];
          var savedPos = entry.pos;
          var savedColor = entry.color;

          // Dispose old sprite
          labels.labelsGroup.remove(entry.label.sprite);
          entry.label.material.dispose();
          entry.label.texture.dispose();

          // Build replacement
          var newLbl = makeLabelSprite(cfg[key], savedColor, 17);
          newLbl.sprite.position.copy(savedPos);
          labels.labelsGroup.add(newLbl.sprite);
          ce[key] = { label: newLbl, pos: savedPos, color: savedColor };
        }
      });
      return instance;
    }

    // ── Word Cloud System (3D sprites per quadrant) ──

    var wordCloudGroups = { A: null, B: null, C: null, D: null };
    var wordCloudVisible = { A: true, B: true, C: true, D: true };

    var QUAD_CENTERS = {
      A: { x:  GH / 2, y:  GH / 2 },
      B: { x: -GH / 2, y:  GH / 2 },
      C: { x: -GH / 2, y: -GH / 2 },
      D: { x:  GH / 2, y: -GH / 2 },
    };

    var WORD_COLORS = {
      A: 'rgba(190,40,35,1)',
      B: 'rgba(35,75,170,1)',
      C: 'rgba(40,130,65,1)',
      D: 'rgba(195,120,20,1)',
    };

    function makeWordSprite(text, color, fontSize) {
      var cvs = document.createElement('canvas');
      var ctx = cvs.getContext('2d');
      var fs = fontSize || 32;
      cvs.width = 1024;
      cvs.height = 128;
      ctx.font = 'bold italic ' + fs + 'px Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // White glow halo for contrast against the dark metallic plane
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = fs * 0.7;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      // Soft white stroke behind the fill
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeText(text, 512, 64);
      // Colored fill on top
      ctx.fillStyle = color || 'rgba(245,240,232,0.6)';
      ctx.fillText(text, 512, 64);
      var tex = new THREE.CanvasTexture(cvs);
      var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      var sprite = new THREE.Sprite(mat);
      var charW = text.length * 0.18;
      sprite.scale.set(Math.max(charW, 0.9), 0.28, 1);
      return { sprite: sprite, material: mat, texture: tex };
    }

    function setQuadrantWords(q, words) {
      // words: [{ text: string, weight: number (0-1) }]
      // Clear existing
      if (wordCloudGroups[q]) {
        wordCloudGroups[q].children.slice().forEach(function (child) {
          if (child.material) { child.material.map.dispose(); child.material.dispose(); }
          wordCloudGroups[q].remove(child);
        });
        group.remove(wordCloudGroups[q]);
      }

      var wg = new THREE.Group();
      wordCloudGroups[q] = wg;

      var center = QUAD_CENTERS[q];
      var color = WORD_COLORS[q];
      var spread = GH * 0.38;

      words.forEach(function (w, i) {
        var weight = typeof w.weight === 'number' ? w.weight : 0.5;
        // Font size: 28-56 based on weight
        var fs = Math.round(28 + weight * 28);
        var wordSprite = makeWordSprite(w.text, color, fs);

        // Position: scatter within quadrant area with some structure
        // Higher weight words closer to center, lower weight toward edges
        var angle = (i / Math.max(words.length, 1)) * Math.PI * 2 + (i * 1.618);
        var radius = spread * (0.25 + (1 - weight) * 0.65);
        var px = center.x + Math.cos(angle) * radius;
        var py = center.y + Math.sin(angle) * radius;
        // Clamp to stay within graph bounds with margin
        px = Math.max(-GH + 0.2, Math.min(GH - 0.2, px));
        py = Math.max(-GH + 0.2, Math.min(GH - 0.2, py));
        // Z: float above plane, heavier words higher
        var pz = 0.22 + weight * 0.3;

        wordSprite.sprite.position.set(px, py, pz);
        wordSprite.sprite.renderOrder = 100; // always draw on top of plane
        // Store animation metadata for logarithmic pulse
        wordSprite.sprite.userData = {
          baseScaleX: wordSprite.sprite.scale.x,
          baseScaleY: wordSprite.sprite.scale.y,
          weight: weight,
          phase: i * 0.7 + Math.random() * 1.5,  // stagger pulse phases
          quadrant: q,
        };
        wg.add(wordSprite.sprite);
      });

      wg.visible = wordCloudVisible[q];
      group.add(wg);
      return instance;
    }

    function showQuadrantWords(q, visible) {
      wordCloudVisible[q] = visible;
      if (wordCloudGroups[q]) {
        wordCloudGroups[q].visible = visible;
      }
      return instance;
    }

    function clearAllWords() {
      ['A', 'B', 'C', 'D'].forEach(function (q) {
        if (wordCloudGroups[q]) {
          wordCloudGroups[q].children.slice().forEach(function (child) {
            if (child.material) { child.material.map.dispose(); child.material.dispose(); }
            wordCloudGroups[q].remove(child);
          });
          group.remove(wordCloudGroups[q]);
          wordCloudGroups[q] = null;
        }
      });
      return instance;
    }

    // ── Z Boundary Planes API ──
    // setBoundaryContent({ positive: { text, photo, photoAlpha }, negative: { text, photo, photoAlpha } })
    //   text: string — label text (replaces "Winner"/"Loser")
    //   photo: string — URL or base64 data URI for portrait
    //   photoAlpha: number — 0-1, controls portrait translucency (default 0.25)
    // clearBoundaryPhotos() — removes all portrait textures, keeps planes + labels

    function setBoundaryContent(cfg) {
      if (!cfg) return instance;

      ['positive', 'negative'].forEach(function (side) {
        var data = cfg[side];
        if (!data) return;
        var bp = boundaries[side];

        // Update label text if provided
        if (data.text != null) {
          var oldSprite = bp.label.sprite;
          var oldPos = oldSprite.position.clone();
          boundaries.bpGroup.remove(oldSprite);
          bp.label.material.dispose();
          bp.label.texture.dispose();

          var newLbl = makeLabelSprite(data.text, 'rgba(245,240,232,0.35)', 18);
          newLbl.sprite.scale.set(1.6, 0.20, 1);
          newLbl.sprite.position.copy(oldPos);
          newLbl.sprite.renderOrder = 10;
          boundaries.bpGroup.add(newLbl.sprite);
          bp.label = newLbl;
        }

        // Update photo if provided (null/empty string clears)
        if (data.photo !== undefined) {
          loadBoundaryPhoto(bp, data.photo || null, {
            alpha: data.photoAlpha != null ? data.photoAlpha : 0.25,
          });
        }
      });

      return instance;
    }

    function clearBoundaryPhotos() {
      ['positive', 'negative'].forEach(function (side) {
        var bp = boundaries[side];
        loadBoundaryPhoto(bp, null);
      });
      return instance;
    }

    function setBoundaryVisible(visible) {
      boundaries.bpGroup.visible = visible;
      return instance;
    }

    // ── Instance object ──

    // ============================================================
    // TRACE SYSTEM — Refraction-Diffraction Visualization
    // ============================================================

    const traceGroup = new THREE.Group();
    traceGroup.visible = false;
    group.add(traceGroup);

    let traceData = null;
    let traceObjects = null;

    const PRED_COLORS = {
      T: 0xf5f0e8, B: 0x8a7a5a, M: 0x4488cc,
      V: 0x665588, C: 0xcc6644, F: 0x9060c0,
    };

    function traceToWorld(tx, ty, tz) {
      return new THREE.Vector3(tx * GH, ty * GH, (tz || 0) * Z_EXTENT * 0.8);
    }

    function buildObjectMarker(pos, size) {
      var s = size || 0.09;
      var geo = new THREE.OctahedronGeometry(s);
      var mat = new THREE.MeshStandardMaterial({
        color: C.cream, emissive: C.cream, emissiveIntensity: 0.5,
        roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos); mesh.castShadow = true;
      mesh.userData = { isTraceObject: true };
      var glowMat = new THREE.SpriteMaterial({
        color: C.cream, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      var glow = new THREE.Sprite(glowMat);
      glow.scale.set(s * 5, s * 5, 1);
      mesh.add(glow);
      return { mesh: mesh, mat: mat, glow: glow, glowMat: glowMat };
    }

    function buildShadowMarker(pos, size) {
      var s = size || 0.08;
      var geo = new THREE.OctahedronGeometry(s);
      var edges = new THREE.EdgesGeometry(geo);
      var wireMat = new THREE.LineBasicMaterial({ color: 0x9060c0, transparent: true, opacity: 0.7 });
      var wireframe = new THREE.LineSegments(edges, wireMat);
      wireframe.position.copy(pos);
      wireframe.userData = { isTraceShadow: true };
      var fillMat = new THREE.MeshStandardMaterial({
        color: 0x9060c0, emissive: 0x9060c0, emissiveIntensity: 0.3,
        roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
      });
      var fill = new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.95), fillMat);
      wireframe.add(fill);
      var glowMat = new THREE.SpriteMaterial({
        color: 0x9060c0, transparent: true, opacity: 0.08,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      var glow = new THREE.Sprite(glowMat);
      glow.scale.set(s * 4, s * 4, 1);
      wireframe.add(glow);
      return { mesh: wireframe, wireMat: wireMat, fillMat: fillMat, glow: glow, glowMat: glowMat };
    }

    function buildTransformationVector(fromPos, toPos) {
      var dir = toPos.clone().sub(fromPos);
      var len = dir.length();
      if (len < 0.001) return null;
      var points = [fromPos.clone(), toPos.clone()];
      var lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      var lineMat = new THREE.LineDashedMaterial({
        color: 0xf5f0e8, transparent: true, opacity: 0.4, dashSize: 0.06, gapSize: 0.04,
      });
      var line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      var arrowGeo = new THREE.ConeGeometry(0.025, 0.08, 6);
      var arrowMat = new THREE.MeshStandardMaterial({
        color: 0x9060c0, emissive: 0x9060c0, emissiveIntensity: 0.3,
        roughness: 0.3, transparent: true, opacity: 0.7,
      });
      var arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.copy(toPos);
      var dirNorm = dir.clone().normalize();
      var up = new THREE.Vector3(0, 1, 0);
      var quat = new THREE.Quaternion().setFromUnitVectors(up, dirNorm);
      arrow.quaternion.copy(quat);
      return { line: line, lineMat: lineMat, arrow: arrow, arrowMat: arrowMat };
    }

    function buildPredicateMarker(predData, objectCoords) {
      var refX, refY, refZ;
      if (predData.type === 'F') {
        refX = objectCoords.shadowX || 0; refY = objectCoords.shadowY || 0; refZ = objectCoords.shadowZ || 0;
      } else {
        refX = objectCoords.x; refY = objectCoords.y; refZ = objectCoords.z;
      }
      var px = (predData.x || 0) * refX, py = (predData.y || 0) * refY, pz = (predData.z || 0) * refZ;
      if (predData.tension) { px *= 0.5; py *= 0.5; pz *= 0.5; }
      var radius = 0.035;
      if (predData.instances && predData.instances > 1) radius = 0.035 + Math.min(predData.instances, 8) * 0.004;
      var pos = traceToWorld(px, py, pz);
      var color = PRED_COLORS[predData.type] || C.cream;
      var geo = new THREE.SphereGeometry(radius, 10, 8);
      var mat = new THREE.MeshStandardMaterial({
        color: color, emissive: color, emissiveIntensity: 0.4,
        roughness: 0.3, metalness: 0.15, transparent: true, opacity: 0.85,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData = { isTracePredicate: true, predType: predData.type, predId: predData.id, label: predData.label || '' };
      var targetPos = predData.type === 'F'
        ? traceToWorld(objectCoords.shadowX || 0, objectCoords.shadowY || 0, objectCoords.shadowZ || 0)
        : traceToWorld(objectCoords.x, objectCoords.y, objectCoords.z);
      var connGeo = new THREE.BufferGeometry().setFromPoints([pos, targetPos]);
      var connMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.12 });
      var connector = new THREE.Line(connGeo, connMat);
      var lblSprite = makeLabelSprite(predData.id,
        'rgba(' + ((color >> 16) & 0xff) + ',' + ((color >> 8) & 0xff) + ',' + (color & 0xff) + ',0.7)', 14);
      lblSprite.sprite.scale.set(0.5, 0.07, 1);
      lblSprite.sprite.position.set(0, radius + 0.04, 0);
      mesh.add(lblSprite.sprite);
      return { mesh: mesh, mat: mat, connector: connector, connMat: connMat, labelSprite: lblSprite, data: predData };
    }

    var boundaryMode = 'threshold';

    function buildDiagnosticBoundary(posData) {
      if (boundaryMode === 'field') return buildBoundaryField(posData);
      if (boundaryMode === 'dual') return buildBoundaryDual(posData);
      return buildBoundaryThreshold(posData);
    }

    function buildBoundaryThreshold(posData) {
      var boundaryGroup = new THREE.Group();
      var distMap = { 'Low': 0.012, 'Moderate': 0.04, 'High': 0.08, 'Very high': 0.14 };
      var warpAmp = distMap[posData.distinguishability] || 0.04;
      var objectZWorld = (traceData.object.z || 0) * Z_EXTENT * 0.8;
      var shadowZWorld = (traceData.shadow.z || 0) * Z_EXTENT * 0.8;
      var zMidpoint = (objectZWorld + shadowZWorld) / 2;
      var surfaceSize = 0.55;
      var cornerPos = {
        A: { x: -GH + 0.35, y: GH - 0.35 }, B: { x: GH - 0.35, y: GH - 0.35 },
        C: { x: -GH + 0.35, y: -GH + 0.35 }, D: { x: GH - 0.35, y: -GH + 0.35 },
      };
      var cp = cornerPos[posData.quadrant] || cornerPos.A;
      var quadColors = {
        A: { r: 56/255, g: 104/255, b: 168/255 }, B: { r: 184/255, g: 58/255, b: 58/255 },
        C: { r: 58/255, g: 138/255, b: 82/255 }, D: { r: 184/255, g: 120/255, b: 40/255 },
      };
      var qc = quadColors[posData.quadrant] || quadColors.A;
      var segsW = 16, segsH = 16;
      var geo = new THREE.PlaneGeometry(surfaceSize, surfaceSize, segsW, segsH);
      var posAttr = geo.attributes.position;
      var colors = [];
      var creamR = 245/255, creamG = 240/255, creamB = 232/255;
      for (var vi = 0; vi < posAttr.count; vi++) {
        var vx = posAttr.getX(vi), vy = posAttr.getY(vi);
        var dist = Math.min(1, Math.sqrt(vx * vx + vy * vy) / (surfaceSize * 0.7));
        colors.push(qc.r*(1-dist)+creamR*dist, qc.g*(1-dist)+creamG*dist, qc.b*(1-dist)+creamB*dist);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      var origPositions = new Float32Array(posAttr.array.length);
      origPositions.set(posAttr.array);
      var mat = new THREE.MeshStandardMaterial({
        vertexColors: true, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
        roughness: 0.4, metalness: 0.15,
        emissive: new THREE.Color(qc.r*0.4, qc.g*0.4, qc.b*0.4), emissiveIntensity: 0.25, depthWrite: false,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { isDiagnosticBoundary: true, positionId: posData.id, quadrant: posData.quadrant };
      boundaryGroup.add(mesh);
      boundaryGroup.position.set(cp.x, cp.y, zMidpoint);
      boundaryGroup.userData = { isDiagnosticBoundary: true, positionId: posData.id, quadrant: posData.quadrant };
      var idColor = posData.quadrant === 'A' ? 'rgba(56,104,168,0.85)' : posData.quadrant === 'B' ? 'rgba(184,58,58,0.85)' : posData.quadrant === 'C' ? 'rgba(58,138,82,0.85)' : 'rgba(184,120,40,0.85)';
      var posLabel = makeLabelSprite(posData.id, idColor, 18);
      posLabel.sprite.scale.set(0.55, 0.08, 1);
      posLabel.sprite.position.set(0, -surfaceSize/2 - 0.08, 0);
      boundaryGroup.add(posLabel.sprite);
      var fluidLabel = makeLabelSprite(posData.fluid || '', 'rgba(245,240,232,0.6)', 12);
      fluidLabel.sprite.scale.set(0.7, 0.07, 1);
      fluidLabel.sprite.position.set(0, 0, 0.12);
      boundaryGroup.add(fluidLabel.sprite);
      var denomLabel = makeLabelSprite(posData.denominated || '', 'rgba(144,96,192,0.6)', 12);
      denomLabel.sprite.scale.set(0.7, 0.07, 1);
      denomLabel.sprite.position.set(0, 0, -0.12);
      boundaryGroup.add(denomLabel.sprite);
      return { group: boundaryGroup, mesh: mesh, geo: geo, mat: mat, origPositions: origPositions, warpAmp: warpAmp, boundaryHeight: surfaceSize, segsW: segsW, segsH: segsH, mode: 'threshold', data: posData };
    }

    function buildBoundaryField(posData) {
      var boundaryGroup = new THREE.Group();
      var distMap = { 'Low': 0.08, 'Moderate': 0.3, 'High': 0.6, 'Very high': 1.0 };
      var warpAmp = distMap[posData.distinguishability] || 0.3;
      var objectZWorld = (traceData.object.z || 0) * Z_EXTENT * 0.8;
      var shadowZWorld = (traceData.shadow.z || 0) * Z_EXTENT * 0.8;
      var zBottom = Math.min(objectZWorld, shadowZWorld), zTop = Math.max(objectZWorld, shadowZWorld);
      var boundaryHeight = Math.max(0.2, zTop - zBottom);
      var zMidpoint = (zTop + zBottom) / 2, boundaryWidth = 0.45;
      var cornerPos = {
        A: { x: -GH+0.30, y: GH-0.30, angle: -Math.PI*0.25 }, B: { x: GH-0.30, y: GH-0.30, angle: -Math.PI*0.75 },
        C: { x: -GH+0.30, y: -GH+0.30, angle: Math.PI*0.25 }, D: { x: GH-0.30, y: -GH+0.30, angle: Math.PI*0.75 },
      };
      var cp = cornerPos[posData.quadrant] || cornerPos.A;
      var quadColors = { A:{r:56/255,g:104/255,b:168/255}, B:{r:184/255,g:58/255,b:58/255}, C:{r:58/255,g:138/255,b:82/255}, D:{r:184/255,g:120/255,b:40/255} };
      var qc = quadColors[posData.quadrant] || quadColors.A;
      var segsW = 6, segsH = 20;
      var geo = new THREE.PlaneGeometry(boundaryWidth, boundaryHeight, segsW, segsH);
      var posAttr = geo.attributes.position;
      var colors = [];
      var creamR=245/255,creamG=240/255,creamB=232/255, purpleR=144/255,purpleG=96/255,purpleB=192/255;
      for (var vi=0; vi<posAttr.count; vi++) {
        var vy = posAttr.getY(vi);
        var t = (vy + boundaryHeight/2) / boundaryHeight;
        var midBlend = Math.sin(t * Math.PI) * 0.35;
        colors.push(Math.min(1,purpleR*(1-t)+creamR*t+qc.r*midBlend), Math.min(1,purpleG*(1-t)+creamG*t+qc.g*midBlend), Math.min(1,purpleB*(1-t)+creamB*t+qc.b*midBlend));
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      var origPositions = new Float32Array(posAttr.array.length);
      origPositions.set(posAttr.array);
      var mat = new THREE.MeshStandardMaterial({
        vertexColors: true, transparent: true, opacity: 0.22, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.1,
        emissive: new THREE.Color(qc.r*0.3,qc.g*0.3,qc.b*0.3), emissiveIntensity: 0.2, depthWrite: false,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { isDiagnosticBoundary: true, positionId: posData.id, quadrant: posData.quadrant };
      mesh.rotation.x = Math.PI/2; mesh.rotation.z = cp.angle;
      boundaryGroup.add(mesh);
      boundaryGroup.position.set(cp.x, cp.y, zMidpoint);
      boundaryGroup.userData = { isDiagnosticBoundary: true, positionId: posData.id, quadrant: posData.quadrant };
      var idColor = posData.quadrant==='A'?'rgba(56,104,168,0.85)':posData.quadrant==='B'?'rgba(184,58,58,0.85)':posData.quadrant==='C'?'rgba(58,138,82,0.85)':'rgba(184,120,40,0.85)';
      var posLabel = makeLabelSprite(posData.id, idColor, 18);
      posLabel.sprite.scale.set(0.55,0.08,1); posLabel.sprite.position.set(0,0,0); boundaryGroup.add(posLabel.sprite);
      var fluidLabel = makeLabelSprite(posData.fluid||'','rgba(245,240,232,0.6)',13);
      fluidLabel.sprite.scale.set(0.8,0.08,1); fluidLabel.sprite.position.set(0,0,boundaryHeight/2+0.06); boundaryGroup.add(fluidLabel.sprite);
      var denomLabel = makeLabelSprite(posData.denominated||'','rgba(144,96,192,0.6)',13);
      denomLabel.sprite.scale.set(0.8,0.08,1); denomLabel.sprite.position.set(0,0,-boundaryHeight/2-0.06); boundaryGroup.add(denomLabel.sprite);
      return { group: boundaryGroup, mesh:mesh, geo:geo, mat:mat, origPositions:origPositions, warpAmp:warpAmp, boundaryHeight:boundaryHeight, segsW:segsW, segsH:segsH, mode:'field', data:posData };
    }

    function buildBoundaryDual(posData) {
      var boundaryGroup = new THREE.Group();
      var distMap = { 'Low': 0.008, 'Moderate': 0.025, 'High': 0.05, 'Very high': 0.09 };
      var warpAmp = distMap[posData.distinguishability] || 0.025;
      var objectZWorld = (traceData.object.z||0)*Z_EXTENT*0.8, shadowZWorld = (traceData.shadow.z||0)*Z_EXTENT*0.8;
      var surfaceSize = 0.48;
      var cornerPos = { A:{x:-GH+0.35,y:GH-0.35}, B:{x:GH-0.35,y:GH-0.35}, C:{x:-GH+0.35,y:-GH+0.35}, D:{x:GH-0.35,y:-GH+0.35} };
      var cp = cornerPos[posData.quadrant] || cornerPos.A;
      var quadColors = { A:{r:56/255,g:104/255,b:168/255}, B:{r:184/255,g:58/255,b:58/255}, C:{r:58/255,g:138/255,b:82/255}, D:{r:184/255,g:120/255,b:40/255} };
      var qc = quadColors[posData.quadrant] || quadColors.A;
      var creamR=245/255,creamG=240/255,creamB=232/255, purpleR=144/255,purpleG=96/255,purpleB=192/255;
      var segsW=12, segsH=12;
      // Object surface
      var objGeo = new THREE.PlaneGeometry(surfaceSize,surfaceSize,segsW,segsH);
      var objPosAttr = objGeo.attributes.position; var objColors = [];
      for (var vi=0;vi<objPosAttr.count;vi++) { var vx=objPosAttr.getX(vi),vy=objPosAttr.getY(vi); var dist=Math.min(1,Math.sqrt(vx*vx+vy*vy)/(surfaceSize*0.7)); objColors.push(creamR*(1-dist*0.3)+qc.r*dist*0.3,creamG*(1-dist*0.3)+qc.g*dist*0.3,creamB*(1-dist*0.3)+qc.b*dist*0.3); }
      objGeo.setAttribute('color', new THREE.Float32BufferAttribute(objColors,3));
      var objOrigPositions = new Float32Array(objPosAttr.array.length); objOrigPositions.set(objPosAttr.array);
      var objMat = new THREE.MeshStandardMaterial({ vertexColors:true, transparent:true, opacity:0.30, side:THREE.DoubleSide, roughness:0.35, metalness:0.15, emissive:new THREE.Color(creamR*0.3,creamG*0.3,creamB*0.3), emissiveIntensity:0.2, depthWrite:false });
      var objMesh = new THREE.Mesh(objGeo, objMat); objMesh.position.set(0,0,objectZWorld);
      objMesh.userData = { isDiagnosticBoundary:true, positionId:posData.id, quadrant:posData.quadrant }; boundaryGroup.add(objMesh);
      // Shadow surface
      var shdGeo = new THREE.PlaneGeometry(surfaceSize,surfaceSize,segsW,segsH);
      var shdPosAttr = shdGeo.attributes.position; var shdColors = [];
      for (var vi=0;vi<shdPosAttr.count;vi++) { var vx=shdPosAttr.getX(vi),vy=shdPosAttr.getY(vi); var dist=Math.min(1,Math.sqrt(vx*vx+vy*vy)/(surfaceSize*0.7)); shdColors.push(purpleR*(1-dist*0.3)+qc.r*dist*0.3,purpleG*(1-dist*0.3)+qc.g*dist*0.3,purpleB*(1-dist*0.3)+qc.b*dist*0.3); }
      shdGeo.setAttribute('color', new THREE.Float32BufferAttribute(shdColors,3));
      var shdOrigPositions = new Float32Array(shdPosAttr.array.length); shdOrigPositions.set(shdPosAttr.array);
      var shdMat = new THREE.MeshStandardMaterial({ vertexColors:true, transparent:true, opacity:0.25, side:THREE.DoubleSide, roughness:0.5, metalness:0.1, emissive:new THREE.Color(purpleR*0.3,purpleG*0.3,purpleB*0.3), emissiveIntensity:0.2, depthWrite:false });
      var shdMesh = new THREE.Mesh(shdGeo, shdMat); shdMesh.position.set(0,0,shadowZWorld);
      shdMesh.userData = { isDiagnosticBoundary:true, positionId:posData.id, quadrant:posData.quadrant }; boundaryGroup.add(shdMesh);
      // Gap connector
      var gapGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,objectZWorld),new THREE.Vector3(0,0,shadowZWorld)]);
      boundaryGroup.add(new THREE.Line(gapGeo, new THREE.LineBasicMaterial({color:new THREE.Color(qc.r,qc.g,qc.b),transparent:true,opacity:0.15})));
      // Labels
      var idColor = posData.quadrant==='A'?'rgba(56,104,168,0.85)':posData.quadrant==='B'?'rgba(184,58,58,0.85)':posData.quadrant==='C'?'rgba(58,138,82,0.85)':'rgba(184,120,40,0.85)';
      var zMid = (objectZWorld+shadowZWorld)/2;
      var posLabel = makeLabelSprite(posData.id,idColor,18); posLabel.sprite.scale.set(0.55,0.08,1); posLabel.sprite.position.set(0,-surfaceSize/2-0.08,zMid); boundaryGroup.add(posLabel.sprite);
      var fluidLabel = makeLabelSprite(posData.fluid||'','rgba(245,240,232,0.7)',13); fluidLabel.sprite.scale.set(0.7,0.08,1); fluidLabel.sprite.position.set(0,0,objectZWorld+0.06); boundaryGroup.add(fluidLabel.sprite);
      var denomLabel = makeLabelSprite(posData.denominated||'','rgba(144,96,192,0.7)',13); denomLabel.sprite.scale.set(0.7,0.08,1); denomLabel.sprite.position.set(0,0,shadowZWorld-0.06); boundaryGroup.add(denomLabel.sprite);
      var oSurfLabel = makeLabelSprite('O','rgba(245,240,232,0.35)',10); oSurfLabel.sprite.scale.set(0.35,0.05,1); oSurfLabel.sprite.position.set(surfaceSize/2-0.05,surfaceSize/2-0.05,objectZWorld+0.03); boundaryGroup.add(oSurfLabel.sprite);
      var sSurfLabel = makeLabelSprite("O'",'rgba(144,96,192,0.35)',10); sSurfLabel.sprite.scale.set(0.35,0.05,1); sSurfLabel.sprite.position.set(surfaceSize/2-0.05,surfaceSize/2-0.05,shadowZWorld-0.03); boundaryGroup.add(sSurfLabel.sprite);
      boundaryGroup.position.set(cp.x, cp.y, 0);
      boundaryGroup.userData = { isDiagnosticBoundary:true, positionId:posData.id, quadrant:posData.quadrant };
      return { group:boundaryGroup, mesh:objMesh, geo:objGeo, mat:objMat, origPositions:objOrigPositions, shadowMesh:shdMesh, shadowGeo:shdGeo, shadowMat:shdMat, shadowOrigPositions:shdOrigPositions, warpAmp:warpAmp, boundaryHeight:surfaceSize, segsW:segsW, segsH:segsH, mode:'dual', data:posData };
    }

    function buildCoordinateSubjectMarker(posData, type) {
      var isFluid = type === 'fluid';
      var label = isFluid ? posData.fluid : posData.denominated;
      var objectZWorld = (traceData.object.z||0)*Z_EXTENT*0.8, shadowZWorld = (traceData.shadow.z||0)*Z_EXTENT*0.8;
      var zPos = isFluid ? objectZWorld : shadowZWorld;
      var cornerPos = { A:{x:-GH+0.35,y:GH-0.35}, B:{x:GH-0.35,y:GH-0.35}, C:{x:-GH+0.35,y:-GH+0.35}, D:{x:GH-0.35,y:-GH+0.35} };
      var cp = cornerPos[posData.quadrant] || cornerPos.A;
      var xOffset = isFluid ? -0.12 : 0.12;
      var color = isFluid ? C.cream : 0x9060c0, size = 0.035;
      var geo = new THREE.OctahedronGeometry(size);
      var mat = new THREE.MeshStandardMaterial({ color:color, emissive:color, emissiveIntensity:isFluid?0.5:0.35, roughness:0.2, metalness:0.2, transparent:true, opacity:0.85 });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cp.x+xOffset, cp.y, zPos);
      mesh.userData = { isCoordinateSubject:true, csType:type, positionId:posData.id, quadrant:posData.quadrant, label:label };
      var glowMat = new THREE.SpriteMaterial({ color:color, transparent:true, opacity:isFluid?0.12:0.08, blending:THREE.AdditiveBlending, depthWrite:false });
      var glow = new THREE.Sprite(glowMat); glow.scale.set(size*5,size*5,1); mesh.add(glow);
      var connGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cp.x+xOffset,cp.y,0),new THREE.Vector3(cp.x+xOffset,cp.y,zPos)]);
      var connMat = new THREE.LineBasicMaterial({ color:color, transparent:true, opacity:0.12 });
      var connector = new THREE.Line(connGeo, connMat);
      var lblColor = isFluid ? 'rgba(245,240,232,0.6)' : 'rgba(144,96,192,0.6)';
      var lbl = makeLabelSprite(label||'',lblColor,11); lbl.sprite.scale.set(0.6,0.06,1); lbl.sprite.position.set(0,size+0.04,0); mesh.add(lbl.sprite);
      var tagText = isFluid ? 'fluid' : 'denom';
      var tag = makeLabelSprite(tagText,isFluid?'rgba(245,240,232,0.3)':'rgba(144,96,192,0.3)',8); tag.sprite.scale.set(0.4,0.04,1); tag.sprite.position.set(0,-(size+0.04),0); mesh.add(tag.sprite);
      var keywordSprites = [];
      var keywords = isFluid ? (posData.fluidKeywords||[]) : (posData.denomKeywords||[]);
      if (keywords.length > 0) {
        var kwColor = isFluid ? 'rgba(245,240,232,0.7)' : 'rgba(144,96,192,0.7)';
        var count = keywords.length;
        for (var ki=0;ki<count;ki++) { var kw=keywords[ki]; var text=typeof kw==='string'?kw:kw.text; var weight=(typeof kw==='object'&&kw.weight!=null)?kw.weight:0.5; var fs=Math.round(18+weight*14); var kwSprite=makeWordSprite(text,kwColor,fs); var angle=(ki/count)*Math.PI*2+ki*0.4; var ringR=size*4+0.10; kwSprite.sprite.position.set(Math.cos(angle)*ringR,Math.sin(angle)*ringR,(Math.random()-0.5)*0.06); kwSprite.sprite.renderOrder=100; kwSprite.sprite.userData={baseScaleX:kwSprite.sprite.scale.x,baseScaleY:kwSprite.sprite.scale.y,weight:weight,phase:ki*1.0+Math.random()*1.2,quadrant:posData.quadrant}; mesh.add(kwSprite.sprite); keywordSprites.push(kwSprite); }
      }
      return { mesh:mesh, mat:mat, glow:glow, glowMat:glowMat, connector:connector, connMat:connMat, keywordSprites:keywordSprites, pulsePhase:Math.random()*Math.PI*2, type:type, data:posData };
    }

    function buildTraceZConnector(worldPos, color, opacity) {
      if (Math.abs(worldPos.z) < 0.02) return null;
      var surfacePos = new THREE.Vector3(worldPos.x, worldPos.y, 0);
      var geo = new THREE.BufferGeometry().setFromPoints([surfacePos, worldPos]);
      return new THREE.Line(geo, new THREE.LineBasicMaterial({ color:color||C.cream, transparent:true, opacity:opacity||0.15 }));
    }

    function buildShadowProjection(worldPos) {
      var geo = new THREE.RingGeometry(0.04, 0.06, 16);
      var mat = new THREE.MeshBasicMaterial({ color:0x9060c0, transparent:true, opacity:0.2, side:THREE.DoubleSide, depthWrite:false });
      var ring = new THREE.Mesh(geo, mat);
      ring.position.set(worldPos.x, worldPos.y, 0.005);
      return ring;
    }

    function loadTrace(data) {
      clearTrace(); if (!data) return instance;
      traceData = data; traceGroup.visible = true;
      var objs = { objectMarker:null, shadowMarker:null, vector:null, predicates:[], diagnostics:[], zConnectors:[], projections:[] };
      var oPos = traceToWorld(data.object.x, data.object.y, data.object.z);
      objs.objectMarker = buildObjectMarker(oPos); traceGroup.add(objs.objectMarker.mesh);
      var oConn = buildTraceZConnector(oPos, C.cream, 0.2); if (oConn) { traceGroup.add(oConn); objs.zConnectors.push(oConn); }
      var oProj = buildShadowProjection(oPos); oProj.material.color.set(C.cream); oProj.material.opacity=0.15; traceGroup.add(oProj); objs.projections.push(oProj);
      var sPos = traceToWorld(data.shadow.x, data.shadow.y, data.shadow.z);
      objs.shadowMarker = buildShadowMarker(sPos); traceGroup.add(objs.shadowMarker.mesh);
      var sConn = buildTraceZConnector(sPos, 0x9060c0, 0.15); if (sConn) { traceGroup.add(sConn); objs.zConnectors.push(sConn); }
      var sProj = buildShadowProjection(sPos); traceGroup.add(sProj); objs.projections.push(sProj);
      objs.vector = buildTransformationVector(oPos, sPos);
      if (objs.vector) { traceGroup.add(objs.vector.line); traceGroup.add(objs.vector.arrow); }
      var oLabel = makeLabelSprite('O','rgba(245,240,232,0.7)',16); oLabel.sprite.scale.set(0.4,0.06,1); oLabel.sprite.position.set(0,0.14,0); objs.objectMarker.mesh.add(oLabel.sprite);
      var sLabel = makeLabelSprite("O'",'rgba(144,96,192,0.7)',16); sLabel.sprite.scale.set(0.4,0.06,1); sLabel.sprite.position.set(0,0.12,0); objs.shadowMarker.mesh.add(sLabel.sprite);
      if (data.predicates) {
        var allPreds = (data.predicates.operative||[]).concat(data.predicates.stated||[]);
        var coordRef = { x:data.object.x, y:data.object.y, z:data.object.z, shadowX:data.shadow.x, shadowY:data.shadow.y, shadowZ:data.shadow.z };
        allPreds.forEach(function(pred) { var pm=buildPredicateMarker(pred,coordRef); traceGroup.add(pm.mesh); traceGroup.add(pm.connector); objs.predicates.push(pm); });
      }
      if (data.positions) { data.positions.forEach(function(pos) { var diag=buildDiagnosticBoundary(pos); traceGroup.add(diag.group); objs.diagnostics.push(diag); }); }
      objs.csMarkers = [];
      if (data.positions) { data.positions.forEach(function(pos) { var fluidCS=buildCoordinateSubjectMarker(pos,'fluid'); traceGroup.add(fluidCS.mesh); traceGroup.add(fluidCS.connector); objs.csMarkers.push(fluidCS); var denomCS=buildCoordinateSubjectMarker(pos,'denominated'); traceGroup.add(denomCS.mesh); traceGroup.add(denomCS.connector); objs.csMarkers.push(denomCS); }); }
      traceObjects = objs; return instance;
    }

    function setBoundaryMode(mode) {
      if (mode!=='threshold'&&mode!=='field'&&mode!=='dual') return instance;
      if (mode===boundaryMode) return instance;
      boundaryMode = mode;
      if (traceData && traceObjects) {
        traceObjects.diagnostics.forEach(function(d) { d.group.traverse(function(child) { if(child.geometry)child.geometry.dispose(); if(child.material){if(Array.isArray(child.material))child.material.forEach(function(m){m.dispose();});else child.material.dispose();} }); traceGroup.remove(d.group); });
        traceObjects.diagnostics = [];
        if (traceData.positions) { traceData.positions.forEach(function(pos) { var diag=buildDiagnosticBoundary(pos); traceGroup.add(diag.group); traceObjects.diagnostics.push(diag); }); }
      }
      return instance;
    }
    function getBoundaryMode() { return boundaryMode; }

    function clearTrace() {
      if (traceObjects) {
        traceGroup.traverse(function(child) { if(child.geometry)child.geometry.dispose(); if(child.material){if(Array.isArray(child.material))child.material.forEach(function(m){m.dispose();});else child.material.dispose();} });
        while (traceGroup.children.length>0) traceGroup.remove(traceGroup.children[0]);
        traceObjects = null;
      }
      traceData = null; traceGroup.visible = false; return instance;
    }
    function getTrace() { return traceData; }
    function setTraceVisible(v) { traceGroup.visible = v; return instance; }
    function setTraceLayerVisible(layer, v) {
      if (!traceObjects) return instance;
      switch(layer) {
        case 'object': if(traceObjects.objectMarker) traceObjects.objectMarker.mesh.visible=v; break;
        case 'shadow': if(traceObjects.shadowMarker) traceObjects.shadowMarker.mesh.visible=v; break;
        case 'vector': if(traceObjects.vector){traceObjects.vector.line.visible=v;traceObjects.vector.arrow.visible=v;} break;
        case 'predicates': traceObjects.predicates.forEach(function(p){p.mesh.visible=v;p.connector.visible=v;}); break;
        case 'diagnostics': traceObjects.diagnostics.forEach(function(d){d.group.visible=v;}); break;
        case 'csMarkers': if(traceObjects.csMarkers){traceObjects.csMarkers.forEach(function(cs){cs.mesh.visible=v;cs.connector.visible=v;});} break;
      }
      return instance;
    }

    function updateTrace(t) {
      if (!traceObjects) return;
      if (traceObjects.objectMarker) { var om=traceObjects.objectMarker; om.mesh.rotation.y=t*0.3; om.mesh.rotation.x=Math.sin(t*0.2)*0.1; if(om.glowMat)om.glowMat.opacity=0.10+Math.sin(t*1.2)*0.06; }
      if (traceObjects.shadowMarker) { var sm=traceObjects.shadowMarker; sm.mesh.rotation.y=-t*0.25; sm.mesh.rotation.x=Math.sin(t*0.15+1.0)*0.08; if(sm.glowMat)sm.glowMat.opacity=0.05+Math.sin(t*0.9)*0.04; }
      traceObjects.predicates.forEach(function(p,i) { if(p._baseY==null)p._baseY=p.mesh.position.y; p.mesh.position.y=p._baseY+Math.sin(t*0.8+i*1.1)*0.008; if(p.mat)p.mat.emissiveIntensity=0.3+Math.sin(t*0.6+i*0.9)*0.15; });
      traceObjects.diagnostics.forEach(function(d,di) {
        if(!d.origPositions||!d.geo) return;
        var posAttr=d.geo.attributes.position; var orig=d.origPositions; var amp=d.warpAmp;
        if(d.mode==='threshold'||d.mode==='dual') {
          var halfSize=(d.geo.parameters?d.geo.parameters.width/2:0.275);
          for(var vi=0;vi<posAttr.count;vi++){var ox=orig[vi*3],oy=orig[vi*3+1],oz=orig[vi*3+2];var rad=Math.min(1,Math.sqrt(ox*ox+oy*oy)/halfSize);var angle=Math.atan2(oy,ox);var r1=Math.sin(rad*Math.PI*3.0-t*0.6+di*1.7)*0.5;var r2=Math.sin(angle*2.0+rad*Math.PI*2.0+t*0.35+di*0.8)*0.3;var r3=Math.sin(t*0.2+di*2.3)*0.2;var env=1.0-rad*rad*0.6;posAttr.setZ(vi,oz+(r1+r2+r3)*amp*env);}
          posAttr.needsUpdate=true; d.geo.computeVertexNormals();
          if(d.mode==='dual'&&d.shadowGeo&&d.shadowOrigPositions){var sAttr=d.shadowGeo.attributes.position;var sOrig=d.shadowOrigPositions;var sHalf=(d.shadowGeo.parameters?d.shadowGeo.parameters.width/2:0.24);for(var svi=0;svi<sAttr.count;svi++){var sox=sOrig[svi*3],soy=sOrig[svi*3+1],soz=sOrig[svi*3+2];var srad=Math.min(1,Math.sqrt(sox*sox+soy*soy)/sHalf);var sangle=Math.atan2(soy,sox);var sr1=Math.sin(srad*Math.PI*2.5-t*0.4+di*2.1)*0.5;var sr2=Math.sin(sangle*3.0+srad*Math.PI*1.5+t*0.25+di*1.2)*0.3;var sr3=Math.sin(t*0.15+di*1.8)*0.2;var senv=1.0-srad*srad*0.6;sAttr.setZ(svi,soz+(sr1+sr2+sr3)*amp*0.7*senv);}sAttr.needsUpdate=true;d.shadowGeo.computeVertexNormals();if(d.shadowMat){var sBr=Math.sin(t*0.25+di*1.5);d.shadowMat.opacity=0.20+sBr*0.06*amp;d.shadowMat.emissiveIntensity=0.15+sBr*0.08*amp;}}
        } else {
          var h=d.boundaryHeight;var halfW=(d.geo.parameters?d.geo.parameters.width/2:0.225);
          for(var vi=0;vi<posAttr.count;vi++){var ox=orig[vi*3],oy=orig[vi*3+1],oz=orig[vi*3+2];var ht=(oy+h/2)/h;var wt=ox/halfW;var w1=Math.sin(ht*Math.PI*2.5+t*0.4+di*1.7)*0.06;var w2=Math.sin(ht*Math.PI*4.0+wt*Math.PI*1.5+t*0.9+di*0.8)*0.025;var w3=Math.sin(ht*Math.PI*1.0+t*0.15+di*2.3)*0.035;var env=Math.sin(ht*Math.PI)*(0.5+Math.abs(wt)*0.5);posAttr.setZ(vi,oz+(w1+w2+w3)*amp*env);}
          posAttr.needsUpdate=true; d.geo.computeVertexNormals();
        }
        if(d.mat){var br=Math.sin(t*0.3+di*1.2);var baseOp=d.mode==='threshold'?0.28:d.mode==='dual'?0.24:0.18;d.mat.opacity=baseOp+br*0.08*amp;d.mat.emissiveIntensity=0.2+br*0.1*amp;}
      });
      if (traceObjects.csMarkers) {
        traceObjects.csMarkers.forEach(function(cs,ci) {
          cs.mesh.rotation.y=t*0.4+ci*0.8; cs.mesh.rotation.x=Math.sin(t*0.25+ci*1.3)*0.12;
          if(cs.mat){var be=cs.type==='fluid'?0.4:0.25;cs.mat.emissiveIntensity=be+Math.sin(t*0.7+ci*1.1)*0.15;}
          if(cs.glowMat){var bg=cs.type==='fluid'?0.10:0.06;var gp=Math.sin(t*1.0+cs.pulsePhase)*0.5+0.5;cs.glowMat.opacity=bg+gp*0.08;var gs=(cs.type==='fluid'?0.18:0.15)+gp*0.04;cs.glow.scale.set(gs,gs,1);}
          if(cs.keywordSprites&&cs.keywordSprites.length>0){for(var ksi=0;ksi<cs.keywordSprites.length;ksi++){var ksSprite=cs.keywordSprites[ksi].sprite;var ksUd=ksSprite.userData;if(!ksUd||!ksUd.baseScaleX)continue;var ksBr=Math.sin(t*(0.5+ksUd.weight*0.3)+ksUd.phase);var ksP=1.0+ksBr*0.12;ksSprite.scale.x=ksUd.baseScaleX*ksP;ksSprite.scale.y=ksUd.baseScaleY*ksP;if(ksSprite.material)ksSprite.material.opacity=0.55+ksBr*0.30;}}
        });
      }
    }

    const instance = {
      // Lifecycle
      mount,
      unmount,
      reparent,
      resize,
      destroy,
      activate,
      deactivate,

      // Pin
      setPin,
      clearPin,

      // Aggregate dots
      addDot,
      clearDots,
      getDots,
      computeProximity,

      // Contrast line (v2 — tether between two normalized points)
      setContrastLine,
      clearContrastLine,

      // Member pins (Phase 6.1.5)
      addMemberPin,
      clearMemberPins,
      setMemberPinsVisible,
      getMemberPinAt,

      // Orbit
      setOrbit,
      getOrbit,
      setZoom,
      getZoom,
      setFocus,
      getFocus,
      spinTo,

      // Morph rotation offset (composed with orbit)
      setMorphRotation(x, y) { morphOffset.x = x; morphOffset.y = y; },

      // Beat engine (scripted orbit choreography)
      playBeats,
      stopBeats,
      isPlaying,

      // v2 additive: skewed-frame commit choreography
      setAxisOffset,
      migrateAll,

      // Labels
      setAxisLabels,
      setCornerLabels,

      // Word clouds (3D sprites per quadrant)
      setQuadrantWords,
      showQuadrantWords,
      clearAllWords,

      // Z boundary planes (translucent quads at ±Z ceiling)
      setBoundaryContent,
      clearBoundaryPhotos,
      setBoundaryVisible,

      // Trace system (refraction-diffraction visualization)
      loadTrace,
      clearTrace,
      getTrace,
      setTraceVisible,
      setTraceLayerVisible,
      setBoundaryMode,
      getBoundaryMode,

      // Inspect — register a callback for hold-to-inspect on pins
      // Callback receives: { normX, normY, quadrant, instance }
      onInspect(fn) {
        onInspectCallback = fn;
        return instance;
      },

      // External mode: host calls update(elapsedSeconds) each frame
      update,

      // Visibility toggle (convenience for host scene management)
      setVisible(v) {
        group.visible = v;
        return instance;
      },

      // Internals (exposed for downstream consumers — orbit engine, etc.)
      scene,
      camera,
      renderer,
      group,
      dotsGroup,
      traceGroup,
      canvas,
      boundaries,

      // Config (read-only reference)
      config,
      isExternal,

      // Constants
      GRAPH_SIZE,
      GH,
      Z_EXTENT,
      C,
    };

    // Auto-mount: container mode attaches to DOM, external mode just activates
    if (isExternal) {
      mount();  // lightweight — sets mounted=true, logs activation
    } else if (config.container) {
      mount(config.container);
    }

    return instance;
  }

  // ============================================================
  // BACKWARD COMPATIBILITY — Singleton shim
  // ============================================================
  //
  // PrismGraphmap.mount(el) / .setPin() / .unmount() still work.
  // They operate on a lazily-created default instance.

  let _default = null;

  function getDefault() {
    if (!_default) {
      _default = createInstance({ mode: 'analytical' });
    }
    return _default;
  }

  // ── Public module ──
  return {
    // Factory (new API)
    create: createInstance,

    // Singleton shim (backward compat)
    mount(container) {
      return getDefault().mount(container);
    },
    unmount() {
      if (_default) _default.unmount();
    },
    resize() {
      if (_default) _default.resize();
    },
    setPin(normX, normY, quadrant, normZ) {
      getDefault().setPin(normX, normY, quadrant, normZ);
    },
    clearPin() {
      if (_default) _default.clearPin();
    },

    // Singleton internals (backward compat — gallery, etc.)
    get scene()    { return getDefault().scene; },
    get camera()   { return getDefault().camera; },
    get renderer() { return getDefault().renderer; },
    get group()    { return getDefault().group; },
    get canvas()   { return getDefault().canvas; },

    // Constants (always available)
    GRAPH_SIZE,
    GH,
    Z_EXTENT,
    C,
  };

})();
