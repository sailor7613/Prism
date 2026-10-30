// dream-elephant.js — the elephant in the room (2026-10-25). A low-poly elephant in Ted's own vocabulary
// (scaled spheres and cones, MeshStandardMaterial, a canvas skin with a grain) that walks slowly through the
// background of the Plaza on the welcome beat: "Before we get into tonight's clips, let's address the elephant in the room."
// Loaded on demand by dream-news.js. buildElephant() returns a THREE.Group centred between the feet, facing +z,
// about 2.8 units tall; group.userData.walk(t, u) poses it — t = seconds (the stride), u = 0..1 along its path.
(function (g) {
  const THREE = g.THREE;
  function skinTex(top, bottom) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, top); gr.addColorStop(1, bottom); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    let v = 11; const rnd = () => { v = (v * 9301 + 49297) % 233280; return v / 233280; };
    for (let i = 0; i < 260; i++) { x.fillStyle = rnd() > 0.5 ? 'rgba(200,200,210,0.10)' : 'rgba(30,30,40,0.14)'; x.fillRect(rnd() * 64, rnd() * 64, 1 + rnd() * 2, 1 + rnd() * 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const S = (r, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);
  const K = (r, h, n = 8) => new THREE.ConeGeometry(r, h, n);
  function add(parent, geo, m, p, s, r) { const o = new THREE.Mesh(geo, m); if (p) o.position.set(...p); if (s) o.scale.set(...s); if (r) o.rotation.set(...r); parent.add(o); return o; }

  function buildElephant() {
    const gp = new THREE.Group();
    const hide = new THREE.MeshStandardMaterial({ map: skinTex('#4f5158', '#6b6d74'), roughness: 0.92, metalness: 0, emissive: 0x111216, emissiveIntensity: 0.35 });
    const hideDark = new THREE.MeshStandardMaterial({ color: 0x3f4147, roughness: 0.94, emissive: 0x0e0f12, emissiveIntensity: 0.35 });
    const hideLight = new THREE.MeshStandardMaterial({ color: 0x74767d, roughness: 0.9, emissive: 0x111216, emissiveIntensity: 0.35 });
    const ivory = new THREE.MeshStandardMaterial({ color: 0xefe6d0, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.4 });
    // the body: a great sphere, long and deep, the back a little higher at the shoulders
    add(gp, S(1.0, 14, 12), hide, [0, 1.75, 0], [1.25, 1.05, 1.65]);
    add(gp, S(0.7, 12, 10), hide, [0, 2.0, 0.55], [1.2, 0.9, 1.0]);        // the shoulders
    add(gp, S(0.6, 12, 10), hideDark, [0, 1.85, -0.95], [1.1, 0.95, 0.9]);  // the rump
    add(gp, S(0.75, 10, 8), hideLight, [0, 1.3, 0.1], [1.2, 0.55, 1.5]);    // the belly, lighter
    // the head, forward and a little low, two domes on the crown
    const head = new THREE.Group(); head.position.set(0, 2.1, 1.45); gp.add(head);
    add(head, S(0.58, 14, 12), hide, [0, 0, 0], [1.0, 1.05, 1.0]);
    [-1, 1].forEach(sd => add(head, S(0.3, 10, 8), hide, [sd * 0.26, 0.42, -0.05], [1, 0.85, 1]));
    add(head, S(0.3, 10, 8), hide, [0, -0.1, 0.42], [1.0, 0.8, 0.9]);        // the face, where the trunk roots
    // the ears: two broad flattened spheres hung off the sides, swung back a little
    const ears = [];
    [-1, 1].forEach(sd => {
      const ear = new THREE.Group(); ear.position.set(sd * 0.5, 0.12, -0.12); ear.rotation.set(0, sd * -0.55, sd * 0.15); head.add(ear); ears.push(ear);
      add(ear, S(0.55, 12, 10), hideDark, [sd * 0.25, -0.1, 0], [0.12, 1.0, 0.8]);
      add(ear, S(0.4, 10, 8), hideLight, [sd * 0.24, -0.12, 0.02], [0.08, 0.85, 0.7]);   // the inner ear, lighter
    });
    // the eyes: small, dark, a glint
    [-1, 1].forEach(sd => { add(head, S(0.06, 8, 6), dark, [sd * 0.36, 0.08, 0.44]); add(head, S(0.018, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }), [sd * 0.34, 0.1, 0.49]); });
    // the tusks: two cones, forward and down, from under the face
    [-1, 1].forEach(sd => add(head, K(0.07, 0.75, 7), ivory, [sd * 0.2, -0.38, 0.55], null, [-1.9, 0, sd * 0.25]));
    // the trunk: a chain of spheres, each smaller, each hung off the last so the whole thing sways from the root
    const trunk = []; let parent = head; let r = 0.21, y = -0.32, z = 0.62;
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Group(); seg.position.set(0, i === 0 ? y : -0.19, i === 0 ? z : 0.06); parent.add(seg);
      add(seg, S(r, 10, 8), i % 2 ? hide : hideDark, [0, 0, 0], [1, 1.25, 1]);
      trunk.push(seg); parent = seg; r *= 0.86;
    }
    // the legs: four columns (a tall cone stood on its point would be a stiletto — a cylinder reads as an elephant's leg), a round foot
    const legs = [];
    [[-0.55, 0.65], [0.55, 0.65], [-0.5, -0.75], [0.5, -0.75]].forEach(([x, z], i) => {
      const leg = new THREE.Group(); leg.position.set(x, 1.45, z); gp.add(leg); legs.push(leg);
      add(leg, new THREE.CylinderGeometry(0.24, 0.3, 1.45, 10), i < 2 ? hide : hideDark, [0, -0.72, 0]);
      add(leg, S(0.33, 10, 8), hideDark, [0, -1.4, 0.02], [1, 0.45, 1]);
      [-1, 0, 1].forEach(k => add(leg, S(0.07, 6, 5), ivory, [k * 0.17, -1.5, 0.27], [1, 0.6, 0.8]));   // toenails
    });
    // the tail: a thin cone off the rump, a tuft
    const tail = new THREE.Group(); tail.position.set(0, 2.1, -1.5); gp.add(tail);
    add(tail, K(0.06, 1.1, 6), hideDark, [0, -0.5, -0.05], null, [0.25, 0, 0]);
    add(tail, S(0.1, 6, 5), dark, [0, -1.05, -0.2], [1, 1.5, 1]);
    gp.userData = { head, ears, trunk, legs, tail,
      // the walk: the legs swing in diagonal pairs, the body rolls and bobs, the trunk and ears swing with the stride, the head nods
      walk(t, u) {
        const w = t * 1.7, s = Math.sin(w);
        legs.forEach((l, i) => { const ph = (i === 0 || i === 3) ? 0 : Math.PI; l.rotation.x = Math.sin(w + ph) * 0.32; });
        gp.position.y = Math.abs(Math.sin(w)) * 0.05; gp.rotation.z = s * 0.025;
        head.rotation.x = 0.12 + Math.sin(w * 0.5) * 0.04; head.rotation.y = Math.sin(w * 0.5 + 1) * 0.05;
        trunk.forEach((seg, i) => { seg.rotation.x = (i === 0 ? 0.5 : 0.16) + Math.sin(w * 0.5 - i * 0.5) * 0.06; seg.rotation.z = Math.sin(w * 0.5 - i * 0.6) * 0.05; });
        ears.forEach((e, i) => { e.rotation.y += 0; e.rotation.z = (i ? -1 : 1) * (0.15 + Math.sin(w * 0.5 + i) * 0.12); });
        tail.rotation.z = Math.sin(w * 0.7) * 0.25;
      } };
    return gp;
  }
  g.buildElephant = buildElephant;
})(typeof window !== 'undefined' ? window : globalThis);
