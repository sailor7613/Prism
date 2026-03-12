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
      c.multiplyScalar(0.55);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.45, metalness: 0.35,
      emissive: 0x0a0a1e, emissiveIntensity: 0.15,
      side: THREE.DoubleSide,
    })));

    // Grid lines (10 divisions)
    const divs = 10, step = GRAPH_SIZE / divs;
    for (let i = 0; i <= divs; i++) {
      const p = -GH + i * step, isAxis = (i === divs / 2);
      const mat = new THREE.LineBasicMaterial({
        color: 0x1a1a2e, transparent: true, opacity: isAxis ? 0.35 : 0.12,
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
    ]), new THREE.LineBasicMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.25 })));

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
          color: cfg.color, transparent: true, opacity: 0.22,
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
      { key: 'A', text: 'A', x: -GH + 0.45, y:  GH - 0.2, color: 'rgba(201,64,64,0.65)' },
      { key: 'B', text: 'B', x:  GH - 0.45, y:  GH - 0.2, color: 'rgba(58,90,140,0.65)' },
      { key: 'C', text: 'C', x: -GH + 0.45, y: -GH + 0.2, color: 'rgba(74,140,90,0.65)' },
      { key: 'D', text: 'D', x:  GH - 0.45, y: -GH + 0.2, color: 'rgba(200,122,48,0.65)' },
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
    return { labelsGroup, cornerEntries, axisEntries, zLabel: zLbl };
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

    // ── User pin — ConeGeometry (gallery-matched) ──
    // Cone default: tip at +Y. rotation.x = -PI/2 rotates tip to -Z (toward plane).
    // Same rotation as gallery: graphUserPin.rotation.x = -Math.PI/2
    const pinGeo = new THREE.ConeGeometry(0.06, 0.16, 8);
    const brightPin = col.clone();
    brightPin.offsetHSL(0, 0.3, 0.08); // extra saturation punch for user pin
    const pinMat = new THREE.MeshStandardMaterial({
      color: brightPin, emissive: brightPin, emissiveIntensity: 0.5,
      roughness: 0.2, metalness: 0.0,
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

    // Gate: hide Z depth label when zRender disabled
    if (!config.capabilities.zRender && labels.zLabel) {
      labels.zLabel.sprite.visible = false;
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
    const HOLD_MS = 400;          // hold duration to trigger inspect
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
      zoom: 5.4,                 // camera Z distance — matches buildCamera default
      zoomMin: 3.2,              // closest zoom (large graph)
      zoomMax: 9.0,              // farthest zoom (small graph)
      zoomSensitivity: 0.003,    // scroll delta multiplier
      pinchDist: 0,              // last pinch distance for touch zoom
    };

    // ── Beat engine state (scripted orbit choreography) ──
    let beatState = null;
    // When active: { sequence, options, index, phase, phaseStart,
    //                startYaw, startPitch, targetYaw, targetPitch }

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
          beatState.phase = 'hold';
          beatState.phaseStart = now;
        } else {
          var t = Math.min(elapsed / dur, 1);
          // Cubic ease in-out
          var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          orbit.yaw = beatState.startYaw + (beatState.targetYaw - beatState.startYaw) * ease;
          orbit.pitch = beatState.startPitch + (beatState.targetPitch - beatState.startPitch) * ease;
          if (t >= 1) {
            orbit.yaw = beatState.targetYaw;
            orbit.pitch = beatState.targetPitch;
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
          beatState.targetYaw = (next.yaw || 0) * Math.PI / 180;
          beatState.targetPitch = Math.max(-orbit.pitchClamp,
            Math.min(orbit.pitchClamp, (next.pitch || 0) * Math.PI / 180));
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
      group.rotation.y = orbit.yaw;
      group.rotation.x = orbit.pitch;

      // ── Apply zoom ──
      camera.position.z = orbit.zoom;

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

      renderer.render(scene, camera);
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
      if (mounted) unmount();
      containerEl = container || config.container;
      if (!containerEl) {
        console.error('[PrismGraphmap] No container provided');
        return instance;
      }
      containerEl.style.position = containerEl.style.position || 'relative';
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
      orbit.zoom = 5.4;
      orbit.pinchDist = 0;
      beatState = null;
      clearPin();
      clearDots();
      containerEl = null;
      console.log('[PrismGraphmap] Instance unmounted');
      return instance;
    }

    // ── Pin API ──

    let zConnector = null; // line from plane surface to pin

    function setPin(normX, normY, quadrant, normZ) {
      // Gate: if zInput disabled, clamp to plane surface
      if (!config.capabilities.zInput) normZ = 0;

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

      // Z connector line (plane surface → pin) — only when zRender enabled
      if (zConnector) {
        zConnector.geometry.dispose();
        group.remove(zConnector);
        zConnector = null;
      }
      if (config.capabilities.zRender && normZ && Math.abs(normZ) > 0.01) {
        const baseColor = PIN_COLORS[quadrant] || 0xc94040;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(x, y, z),
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

      // Sphere — flat-lit, vivid, fully opaque
      const brightCol = col.clone();
      brightCol.offsetHSL(0, 0.35, 0.1); // punch saturation hard
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(opts.radius || 0.05, 14, 10),
        new THREE.MeshBasicMaterial({ color: brightCol })
      );
      mesh.position.set(x, y, z);
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
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(x, y, z),
        ]);
        connector = new THREE.Line(lineGeo,
          new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.15 })
        );
        dotsGroup.add(connector);
      }

      const dotEntry = {
        mesh, connector, glow, glowMat,
        pulseSpeed: 0,    // 0 = no pulse, set by computeProximity()
        pulsePhase: Math.random() * Math.PI * 2, // random offset so neighbors don't sync
        data: { normX, normY, quadrant, normZ: normZ || 0, label: opts.label || '', desc: opts.desc || '' },
      };
      dots.push(dotEntry);
      return dotEntry;
    }

    function clearDots() {
      dots.forEach(d => {
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

    function isPlaying() {
      return !!beatState;
    }

    // ── Destroy (full cleanup) ──

    function destroy() {
      unmount();
      clearAllWords();
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
      ctx.fillStyle = color || 'rgba(26,26,46,0.6)';
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
      computeProximity,

      // Orbit
      setOrbit,
      getOrbit,
      setZoom,
      getZoom,
      spinTo,

      // Beat engine (scripted orbit choreography)
      playBeats,
      stopBeats,
      isPlaying,

      // Labels
      setAxisLabels,
      setCornerLabels,

      // Word clouds (3D sprites per quadrant)
      setQuadrantWords,
      showQuadrantWords,
      clearAllWords,

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
