// ============================================================
// PRISM GRAPHMAP — Standalone 3D Quadrant Graph
// Extracted from the gallery scene. Same geometry, lighting, renderer.
// Usage: PrismGraphmap.mount(containerEl); PrismGraphmap.unmount();
// Requires: Three.js r128
// ============================================================
const PrismGraphmap = (function() {

// ── Constants (gallery-matched) ──
const C = {
  authLeft: 0x3a5a8c, authRight: 0xc94040,
  libLeft:  0x4a8c5a, libRight:  0xc87a30,
  cream:    0xf5f0e8, bg:        0x0c0b09,
};
const GRAPH_SIZE = 2.8, GH = GRAPH_SIZE / 2;

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);

// ── Camera (gallery: FOV 36, front-lock view of graphmap) ──
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
// Graph sits at origin. Camera in front, framing the 2.8-unit plane.
camera.position.set(0, 0, 4.8);
camera.lookAt(0, 0, 0);

// ── Renderer (gallery-matched settings) ──
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(C.bg, 1);
const canvas = renderer.domElement;
canvas.className = 'graphmap-canvas';

// ── Lighting (gallery's exact recipe) ──
// Main spot: warm overhead, aimed at graph center
const spotMain = new THREE.SpotLight(0xfff3e0, 1.6, 18, Math.PI * 0.22, 0.65, 1.6);
spotMain.position.set(0, 6, 2);
spotMain.target.position.set(0, 0, 0);
spotMain.castShadow = true;
spotMain.shadow.mapSize.set(1024, 1024);
spotMain.shadow.radius = 4;
scene.add(spotMain); scene.add(spotMain.target);

// Warm fill 1: left-back
const spotWarm1 = new THREE.SpotLight(0xffe8cc, 0.55, 16, Math.PI * 0.28, 0.7, 1.8);
spotWarm1.position.set(-4, 5, -3);
spotWarm1.target.position.set(0, 0, 0);
scene.add(spotWarm1); scene.add(spotWarm1.target);

// Warm fill 2: right-front
const spotWarm2 = new THREE.SpotLight(0xffe8cc, 0.4, 16, Math.PI * 0.28, 0.7, 1.8);
spotWarm2.position.set(4, 5, 3);
spotWarm2.target.position.set(0, 0, 0);
scene.add(spotWarm2); scene.add(spotWarm2.target);

// Ambient (very dim, gallery-matched)
const ambient = new THREE.AmbientLight(C.bg, 0.7);
scene.add(ambient);

// ── Graph Group ──
const group = new THREE.Group();

// Vertex-colored base plane
(function() {
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
    c.multiplyScalar(0.25);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.65, metalness: 0.08,
    transparent: true, opacity: 0.88, side: THREE.DoubleSide,
  })));
})();

// Grid lines (10 divisions)
(function() {
  const divs = 10, step = GRAPH_SIZE / divs;
  for (let i = 0; i <= divs; i++) {
    const p = -GH + i * step, isAxis = (i === divs / 2);
    const mat = new THREE.LineBasicMaterial({ color: C.cream, transparent: true, opacity: isAxis ? 0.2 : 0.05 });
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-GH, p, 0.003), new THREE.Vector3(GH, p, 0.003)
    ]), mat));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p, -GH, 0.003), new THREE.Vector3(p, GH, 0.003)
    ]), mat));
  }
})();

// Border
group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-GH, -GH, 0.004), new THREE.Vector3(GH, -GH, 0.004),
  new THREE.Vector3(GH, GH, 0.004), new THREE.Vector3(-GH, GH, 0.004),
  new THREE.Vector3(-GH, -GH, 0.004),
]), new THREE.LineBasicMaterial({ color: C.cream, transparent: true, opacity: 0.1 })));

// Quadrant shading overlays
[
  { color: C.authLeft,  x: -GH/2, y:  GH/2 },
  { color: C.authRight, x:  GH/2, y:  GH/2 },
  { color: C.libLeft,   x: -GH/2, y: -GH/2 },
  { color: C.libRight,  x:  GH/2, y: -GH/2 },
].forEach(cfg => {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(GH, GH),
    new THREE.MeshStandardMaterial({ color: cfg.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, roughness: 1 })
  );
  m.position.set(cfg.x, cfg.y, 0.001);
  group.add(m);
});

scene.add(group);

// ── 3D Pin ──
const pinGroup = new THREE.Group();
pinGroup.visible = false;
scene.add(pinGroup);

const PIN_COLORS = { A: C.authRight, B: C.authLeft, C: C.libLeft, D: C.libRight };
let pinMeshes = null;

function buildPin(quadrant) {
  while (pinGroup.children.length) {
    const c = pinGroup.children[0];
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
    pinGroup.remove(c);
  }
  const baseColor = PIN_COLORS[quadrant] || 0xc94040;
  const col = new THREE.Color(baseColor);

  const coneGeo = new THREE.ConeGeometry(0.04, 0.12, 12);
  const coneMat = new THREE.MeshStandardMaterial({
    color: col, emissive: col, emissiveIntensity: 0.25,
    roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.9,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.rotation.x = Math.PI;
  cone.position.y = 0.06;
  pinGroup.add(cone);

  const orbGeo = new THREE.SphereGeometry(0.05, 16, 12);
  const orbMat = new THREE.MeshStandardMaterial({
    color: col, emissive: col, emissiveIntensity: 0.35,
    roughness: 0.15, metalness: 0.7, transparent: true, opacity: 0.92,
  });
  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.y = 0.15;
  pinGroup.add(orb);

  const glowMat = new THREE.SpriteMaterial({
    color: baseColor, transparent: true, opacity: 0.12,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(0.25, 0.25, 1);
  glow.position.y = 0.15;
  pinGroup.add(glow);

  pinMeshes = { cone, coneMat, orb, orbMat, glow, glowMat };
}

function setPin(normX, normY, quadrant) {
  const x = (normX - 0.5) * GRAPH_SIZE;
  const y = (0.5 - normY) * GRAPH_SIZE;
  buildPin(quadrant);
  pinGroup.position.set(x, y, 0.02);
  pinGroup.visible = true;
}

function clearPin() {
  pinGroup.visible = false;
}

// ── Animation ──
let mounted = false;
let animId = null;
let pinT = 0;

function animate() {
  if (!mounted) return;
  animId = requestAnimationFrame(animate);
  pinT += 0.016;

  // Pin animation
  if (pinGroup.visible && pinMeshes) {
    pinGroup.position.z = 0.02 + Math.sin(pinT * 2) * 0.005;
    const shimmer = 0.25 + Math.sin(pinT * 1.5) * 0.1;
    pinMeshes.orbMat.emissiveIntensity = shimmer + 0.1;
    pinMeshes.coneMat.emissiveIntensity = shimmer;
    pinMeshes.glowMat.opacity = 0.08 + Math.sin(pinT * 0.8) * 0.04;
  }

  renderer.render(scene, camera);
}

function resize() {
  if (!canvas.parentElement) return;
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function mount(container) {
  if (mounted) unmount();
  container.style.position = container.style.position || 'relative';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%!important;height:100%!important;';
  container.appendChild(canvas);
  mounted = true;
  resize();
  animate();
  console.log('[PrismGraphmap] Mounted');
}

function unmount() {
  mounted = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
  group.rotation.y = 0;
  clearPin();
  console.log('[PrismGraphmap] Unmounted');
}

window.addEventListener('resize', () => { if (mounted) resize(); });

function setClearAlpha(a) {
  renderer.setClearColor(C.bg, a);
}

// ── Public API ──
return {
  scene, camera, renderer, group, canvas,
  mount, unmount, resize, setClearAlpha,
  setPin, clearPin,
  GRAPH_SIZE, GH, C,
};

})();
