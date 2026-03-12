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
    authLeft: 0x3a5a8c, authRight: 0xc94040,
    libLeft:  0x4a8c5a, libRight:  0xc87a30,
    cream:    0xf5f0e8, bg:        0x0c0b09,
  };
  const GRAPH_SIZE = 2.8, GH = GRAPH_SIZE / 2;
  const Z_EXTENT = 2.2;   // gallery-matched: max Z displacement from plane
  const PIN_COLORS = { A: C.authRight, B: C.authLeft, C: C.libLeft, D: C.libRight };

  // ── Default config ──
  const DEFAULTS = {
    container: null,
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
    camera.position.set(0, 0, 4.8);
    camera.lookAt(0, 0, 0);
    return camera;
  }

  function buildRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
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
      c.multiplyScalar(0.45);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.65, metalness: 0.08,
      transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    })));

    // Grid lines (10 divisions)
    const divs = 10, step = GRAPH_SIZE / divs;
    for (let i = 0; i <= divs; i++) {
      const p = -GH + i * step, isAxis = (i === divs / 2);
      const mat = new THREE.LineBasicMaterial({
        color: 0x1a1a2e, transparent: true, opacity: isAxis ? 0.25 : 0.07,
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
    ]), new THREE.LineBasicMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.15 })));

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
          color: cfg.color, transparent: true, opacity: 0.12,
          side: THREE.DoubleSide, roughness: 1,
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
    ctx.fillStyle = color || 'rgba(26,26,46,0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 32);
    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.18, 1);
    return { sprite, material: mat, texture: tex, canvas: cvs };
  }

  function buildLabels(group) {
    const labelsGroup = new THREE.Group();

    // ── Quadrant corner letters (billboard sprites in quadrant colors) ──
    // A = upper left, B = upper right, C = lower left, D = lower right
    const cornerDefs = [
      { key: 'A', text: 'A', x: -GH + 0.45, y:  GH - 0.2, color: 'rgba(201,64,64,0.5)' },
      { key: 'B', text: 'B', x:  GH - 0.45, y:  GH - 0.2, color: 'rgba(58,90,140,0.5)' },
      { key: 'C', text: 'C', x: -GH + 0.45, y: -GH + 0.2, color: 'rgba(74,140,90,0.5)' },
      { key: 'D', text: 'D', x:  GH - 0.45, y: -GH + 0.2, color: 'rgba(200,122,48,0.5)' },
    ];
    const cornerEntries = {};
    cornerDefs.forEach(function (c) {
      const lbl = makeLabelSprite(c.text, c.color, 20);
      lbl.sprite.position.set(c.x, c.y, 0.05);
      labelsGroup.add(lbl.sprite);
      cornerEntries[c.key] = { label: lbl, pos: new THREE.Vector3(c.x, c.y, 0.05), color: c.color };
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
      const lbl = makeLabelSprite(a.text, 'rgba(26,26,46,0.35)', 15);
      lbl.sprite.scale.set(1.1, 0.14, 1);
      lbl.sprite.position.set(a.x, a.y, 0);
      labelsGroup.add(lbl.sprite);
      axisEntries[a.key] = { label: lbl, pos: new THREE.Vector3(a.x, a.y, 0) };
    });

    // ── Z depth label ──
    const zLbl = makeLabelSprite('Z · Depth', 'rgba(26,26,46,0.18)', 13);
    zLbl.sprite.scale.set(0.9, 0.12, 1);
    zLbl.sprite.position.set(0.2, 0.15, Z_EXTENT + 0.3);
    labelsGroup.add(zLbl.sprite);

    group.add(labelsGroup);
    return { labelsGroup, cornerEntries, axisEntries };
  }

  // ── Pin mesh builder (per instance, called on setPin) ──

  function rebuildPin(pinGroup, quadrant) {
    // Dispose existing children
    while (pinGroup.children.length) {
      const child = pinGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      pinGroup.remove(child);
    }

    const baseColor = PIN_COLORS[quadrant] || 0xc94040;
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
      emissiveIntensity: 0.15,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = 0.005; // just above plane surface
    pinGroup.add(halo);

    // ── User pin — ConeGeometry (gallery-matched) ──
    // Cone default: tip at +Y. rotation.x = -PI/2 rotates tip to -Z (toward plane).
    // Same rotation as gallery: graphUserPin.rotation.x = -Math.PI/2
    const pinGeo = new THREE.ConeGeometry(0.06, 0.16, 8);
    const pinMat = new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 0.5,
      roughness: 0.15, metalness: 0.0,
    });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.rotation.x = -Math.PI / 2;   // tip points -Z (toward plane surface)
    pin.position.z = 0.08;           // tip near plane, base at ~0.16
    pin.castShadow = true;
    pinGroup.add(pin);

    // ── Glow sprite (gallery-matched) ──
    const glowMat = new THREE.SpriteMaterial({
      color: baseColor, transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.25, 0.25, 1);
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
    const scene = buildScene();
    const camera = buildCamera();
    const { renderer, canvas } = buildRenderer();
    const lights = buildLighting(scene);
    const group = buildGraphGroup();
    const pinGroup = buildPinGroup();

    scene.add(group);
    group.add(pinGroup);

    // ── Labels (billboard sprites, gallery-matched) ──
    const labels = buildLabels(group);

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
    const HOLD_MS = 400;          // hold duration to trigger inspect
    const HOLD_MOVE_TOLERANCE = 5; // px — movement beyond this cancels hold
    let holdStartX = 0;
    let holdStartY = 0;
    let onInspectCallback = null;

    // ── Orbit / drag-to-rotate state ──
    const orbit = {
      yaw: 0,                    // Y-axis rotation (radians) — full 360°
      pitch: 0,                  // X-axis rotation (radians) — clamped ±60°
      dragging: false,
      lastX: 0,
      lastY: 0,
      velocityX: 0,              // momentum
      velocityY: 0,
      sensitivity: 0.005,        // radians per pixel
      friction: 0.92,            // momentum decay per frame
      pitchClamp: Math.PI / 3,   // ±60° elevation
    };

    // ── Animation loop (per-instance) ──

    function animate() {
      if (!mounted || !active) return;
      animId = requestAnimationFrame(animate);
      pinT += 0.016;

      // ── Orbit momentum (when not dragging, velocity decays) ──
      if (!orbit.dragging && (Math.abs(orbit.velocityX) > 0.0001 || Math.abs(orbit.velocityY) > 0.0001)) {
        orbit.yaw += orbit.velocityX;
        orbit.pitch -= orbit.velocityY;
        orbit.pitch = Math.max(-orbit.pitchClamp, Math.min(orbit.pitchClamp, orbit.pitch));
        orbit.velocityX *= orbit.friction;
        orbit.velocityY *= orbit.friction;
      }

      // ── Apply orbit to graph group ──
      if (config.capabilities.orbit) {
        group.rotation.y = orbit.yaw;
        group.rotation.x = orbit.pitch;
      }

      // ── Pin hover animation ──
      if (pinGroup.visible && pinMeshes) {
        // Gentle bob along Z (perpendicular to plane)
        const bob = Math.sin(pinT * 2) * 0.005;
        const baseZ = (pinData && pinData.normZ) ? (pinData.normZ * Z_EXTENT * 0.8) : 0.02;
        pinGroup.position.z = baseZ + bob;

        // Shimmer
        const shimmer = 0.15 + Math.sin(pinT * 1.5) * 0.08;
        if (pinMeshes.pinMat) {
          pinMeshes.pinMat.emissiveIntensity = shimmer;
        }
        if (pinMeshes.glowMat) {
          pinMeshes.glowMat.opacity = 0.06 + Math.sin(pinT * 0.8) * 0.04;
        }

        // Halo iridescent pulse
        if (pinMeshes.haloMat) {
          pinMeshes.haloMat.emissiveIntensity = 0.1 + Math.sin(pinT * 0.6) * 0.08;
          pinMeshes.haloMat.opacity = 0.28 + Math.sin(pinT * 1.1) * 0.07;
        }
      }

      renderer.render(scene, camera);
    }

    // ── Resize (per-instance, uses ResizeObserver on container) ──

    function resize() {
      if (!containerEl) return;
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
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
      // Kill momentum so graph doesn't lurch when reactivated
      orbit.velocityX = 0;
      orbit.velocityY = 0;
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

    function bindDragEvents() {
      if (config.capabilities.orbit) {
        canvas.style.cursor = 'grab';
      }
      // Always bind pointer events (orbit + hold-to-inspect)
      // mousedown stopPropagation prevents parent pin-placement; mousemove uses veilState guards in consuming page
      canvas.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      // Touch
      canvas.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(e); }, { passive: false });
      canvas.addEventListener('touchmove', e => { e.preventDefault(); onPointerMove(e); }, { passive: false });
      canvas.addEventListener('touchend', onPointerUp);
    }

    function unbindDragEvents() {
      cancelHold();
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.style.cursor = 'default';
    }

    // ── Mount / Unmount ──

    function mount(container) {
      if (mounted) unmount();
      containerEl = container || config.container;
      if (!containerEl) {
        console.error('[PrismGraphmap] No container provided');
        return instance;
      }
      containerEl.style.position = containerEl.style.position || 'relative';
      canvas.style.cssText = 'position:absolute;inset:0;width:100%!important;height:100%!important;';
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
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      unbindViewportObserver();
      unbindDragEvents();
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      group.rotation.set(0, 0, 0);
      orbit.yaw = 0;
      orbit.pitch = 0;
      orbit.velocityX = 0;
      orbit.velocityY = 0;
      clearPin();
      clearDots();
      containerEl = null;
      console.log('[PrismGraphmap] Instance unmounted');
      return instance;
    }

    // ── Pin API ──

    let zConnector = null; // line from plane surface to pin

    function setPin(normX, normY, quadrant, normZ) {
      const x = (normX - 0.5) * GRAPH_SIZE;
      const y = (0.5 - normY) * GRAPH_SIZE;
      const z = (normZ || 0) * Z_EXTENT * 0.8;  // gallery-matched: gz * zExtent * 0.8

      // Fast path: skip geometry rebuild if quadrant unchanged and pin exists
      const needsRebuild = !pinMeshes || !pinData || pinData.quadrant !== quadrant;
      if (needsRebuild) {
        pinMeshes = rebuildPin(pinGroup, quadrant);
      }

      // For negative Z: flip cone so tip still points toward plane (+Z from below)
      if (pinMeshes.pin) {
        pinMeshes.pin.rotation.x = (normZ && normZ < 0) ? Math.PI / 2 : -Math.PI / 2;
      }

      pinGroup.position.set(x, y, z || 0.02);
      pinGroup.visible = true;
      pinData = { normX, normY, quadrant, normZ: normZ || 0 };

      // Z connector line (plane surface → pin)
      if (zConnector) {
        zConnector.geometry.dispose();
        group.remove(zConnector);
        zConnector = null;
      }
      if (normZ && Math.abs(normZ) > 0.01) {
        const baseColor = PIN_COLORS[quadrant] || 0xc94040;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(x, y, z),
        ]);
        zConnector = new THREE.Line(lineGeo,
          new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.15 })
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
      const baseColor = PIN_COLORS[quadrant] || C.cream;
      const col = new THREE.Color(opts.color || baseColor);
      const x = (normX - 0.5) * GRAPH_SIZE;
      const y = (0.5 - normY) * GRAPH_SIZE;
      const z = (normZ || 0) * Z_EXTENT * 0.8;

      // Sphere (gallery-matched)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(opts.radius || 0.05, 14, 10),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.5,
          roughness: 0.25, metalness: 0.15,
          transparent: true, opacity: opts.opacity || 0.95,
        })
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      dotsGroup.add(mesh);

      // Glow sprite
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        color: baseColor, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending,
      }));
      glow.scale.set(0.25, 0.25, 1);
      mesh.add(glow);

      // Z connector line (plane → dot)
      let connector = null;
      if (normZ && Math.abs(normZ) > 0.01) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(x, y, z),
        ]);
        connector = new THREE.Line(lineGeo,
          new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.06 })
        );
        dotsGroup.add(connector);
      }

      const dotEntry = {
        mesh, connector, glow,
        data: { normX, normY, quadrant, normZ: normZ || 0, label: opts.label || '', desc: opts.desc || '' },
      };
      dots.push(dotEntry);
      return dotEntry;
    }

    function clearDots() {
      dots.forEach(d => {
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

    function spinTo(yawDeg, pitchDeg, durationMs) {
      // Animated transition to target rotation
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

    // ── Destroy (full cleanup) ──

    function destroy() {
      unmount();
      disposeGroup(group);
      disposeGroup(pinGroup);
      renderer.dispose();
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
          var newLbl = makeLabelSprite(cfg[key], 'rgba(26,26,46,0.35)', 15);
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

    // ── Instance object ──

    const instance = {
      // Lifecycle
      mount,
      unmount,
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

      // Orbit
      setOrbit,
      getOrbit,
      spinTo,

      // Labels
      setAxisLabels,
      setCornerLabels,

      // Inspect — register a callback for hold-to-inspect on pins
      // Callback receives: { normX, normY, quadrant, instance }
      onInspect(fn) {
        onInspectCallback = fn;
        return instance;
      },

      // Internals (exposed for downstream consumers — orbit engine, etc.)
      scene,
      camera,
      renderer,
      group,
      canvas,

      // Config (read-only reference)
      config,

      // Constants
      GRAPH_SIZE,
      GH,
      Z_EXTENT,
      C,
    };

    // Auto-mount if container was provided in config
    if (config.container) {
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
