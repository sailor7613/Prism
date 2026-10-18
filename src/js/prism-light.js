// ============================================================
// prism-light.js — THE LIGHT: the beam and the spectrum, drawn in the
// graphmap plane's language (2026-10-18 design pass).
//
// What the plane taught us (the vertex-coloured base plane of the graphmap
// factory, March 2026): colour is a soft field, never a stripe. The four
// quadrant colours meet without a seam; seen from behind, they settle into
// one even, milky blend with a sheen. So here:
//   · the BEAM is white light — a cream shaft with a soft core and a halo,
//     brightening as it nears the glass; a faint shimmer travels along it.
//   · inside the glass the light is still white, widening a little.
//   · the SPECTRUM is ONE surface, not six ribbons. It leaves the prism's
//     far face nearly white and opens into Prism's four colours (red, gold,
//     green, blue, top to bottom — the order light really bends), each
//     colour falling into the next. Edges are feathered; the colour stays
//     dense out to the display's edge (Sailor's 10-14 rule).
//   · tilt the prism and the spectrum takes on the Venus's thin-film sheen
//     — the plane's backside, brought to the light.
//
// Use (three.js r128, any orthographic or perspective scene):
//   const light = PrismLight.create(THREE);  group.add(light.group);
//   light.layout({ left: -4, right: 4 });   // the edges, in the group's space
//   light.update(seconds, tilt);            // every frame; tilt ≈ −1..1
// The prism it fits is the navtool's: Shape (−.5,−.42)(.5,−.42)(0,.5),
// extruded .34 and centred. Draw the prism AFTER (renderOrder 1, edges 2).
// Keep the light flat on the glass: put light.group in a group that only
// follows the prism's x — turn the prism, not the light (a turned ray ten
// units long swings off the band).
// In a 3D room: create(THREE, { depthTest: true, fadeEnds: true, ghost: 0.35 })
// — the rays respect depth, come out of and die into the air, and show
// faintly through whatever stands in front of them.
// ============================================================
(function (root) {
  'use strict';

  // the prism's faces, after ExtrudeGeometry.center() (y runs −.46 … .46)
  const xRight = y => 0.5 - (y + 0.46) * (0.5 / 0.92);
  const xLeft = y => -xRight(y);

  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';

  // shared GLSL: the Venus's thin film, and cream
  const FILM = [
    'vec3 film(float t){ return 0.5 + 0.5 * cos(6.2831853 * t * 1.3 / vec3(0.65, 0.532, 0.473)); }',
    'const vec3 CREAM = vec3(0.965, 0.945, 0.905);',
  ].join('\n');

  const BEAM_FRAG = [
    'varying vec2 vUv; uniform float uT; uniform float uA; uniform float uFade;', FILM,
    'void main(){',
    '  float u = vUv.x, d = vUv.y - 0.5;',
    '  float core = exp(-d*d / 0.012);',            // the shaft
    '  float halo = exp(-d*d / 0.09) * 0.28;',      // the air around it
    '  float a = (core + halo) * mix(0.42, 1.0, smoothstep(0.0, 1.0, u));',
    '  a *= smoothstep(0.0, 0.04, u) * mix(1.0, smoothstep(0.0, 0.55, u), uFade);',   // in a room the beam comes out of the air
    '  vec3 col = mix(CREAM, film(u * 0.6 - uT * 1.6), 0.035 + 0.06 * halo);',
    '  col = mix(col, vec3(1.0), core * 0.35);',
    '  gl_FragColor = vec4(col, a * uA);',
    '}'].join('\n');

  const INNER_FRAG = [
    'varying vec2 vUv; uniform float uT; uniform float uA;', FILM,
    'void main(){',
    '  float u = vUv.x, d = vUv.y - 0.5;',
    '  float w = mix(0.010, 0.05, u);',
    '  float a = exp(-d*d / w) * mix(0.95, 0.7, u);',
    '  vec3 col = mix(CREAM, film(vUv.y * 0.5 + u * 0.2 + uT), 0.05 + 0.15 * u);',
    '  gl_FragColor = vec4(col, a * uA);',
    '}'].join('\n');

  // Prism's four colours, softened the way the plane softens them
  const FAN_FRAG = [
    'varying vec2 vUv; uniform float uT; uniform float uA; uniform float uTilt; uniform float uLen; uniform float uFade;',
    'uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;', FILM,
    'void main(){',
    '  float u = vUv.x, v = vUv.y;',                // u: prism → edge; v: top → bottom
    '  float uu = u * uLen;',                         // distance from the glass, in units
    '  float part = min(2.2, uLen * 0.55), clear = min(1.1, uLen * 0.22);',   // short throws part sooner
    '  float s = mix(0.40, 0.16, smoothstep(0.05, part, uu));',   // colours overlap near the glass, part as they go
    '  float w0 = exp(-pow((v - 0.13) / s, 2.0)), w1 = exp(-pow((v - 0.38) / s, 2.0));',
    '  float w2 = exp(-pow((v - 0.62) / s, 2.0)), w3 = exp(-pow((v - 0.87) / s, 2.0));',
    '  vec3 col = (uC0 * w0 + uC1 * w1 + uC2 * w2 + uC3 * w3) / (w0 + w1 + w2 + w3);',
    '  col = mix(CREAM, col, smoothstep(0.0, clear, uu));',      // leaves the glass white
    '  col = mix(col, CREAM, 0.10);',                             // the milky veil
    '  float tilt = clamp(abs(uTilt), 0.0, 1.0);',
    '  vec3 f = film(u * 0.8 + v * 0.45 - uT + uTilt * 0.6);',
    '  col = mix(col, f * 0.55 + CREAM * 0.45, 0.08 + 0.26 * tilt);',   // the backside sheen
    '  float a = smoothstep(0.0, 0.2, v) * smoothstep(1.0, 0.8, v);',  // feathered, never cut
    '  a *= smoothstep(0.0, 0.06, uu) * mix(0.92, 0.86, u);',           // dense out to the edge
    '  a *= mix(1.0, 1.0 - smoothstep(0.45, 1.0, u), uFade);',            // in a room it dies into the air
    '  gl_FragColor = vec4(col, a * uA);',
    '}'].join('\n');

  // a strip of quads whose four corners we move each frame
  function strip(THREE, segs) {
    const g = new THREE.BufferGeometry();
    const n = (segs + 1) * 2, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i <= segs; i++) {
      uv[i * 4] = i / segs; uv[i * 4 + 1] = 0;      // top
      uv[i * 4 + 2] = i / segs; uv[i * 4 + 3] = 1;  // bottom
      if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.userData.segs = segs;
    return g;
  }
  // corners: a = start top, b = start bottom, c = end top, d = end bottom
  function setStrip(g, a, b, c, d, z) {
    const p = g.attributes.position.array, segs = g.userData.segs;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, k = i * 6;
      p[k] = a[0] + (c[0] - a[0]) * t; p[k + 1] = a[1] + (c[1] - a[1]) * t; p[k + 2] = z;
      p[k + 3] = b[0] + (d[0] - b[0]) * t; p[k + 4] = b[1] + (d[1] - b[1]) * t; p[k + 5] = z;
    }
    g.attributes.position.needsUpdate = true;
    g.computeBoundingSphere();
  }

  function create(THREE, opts) {
    opts = opts || {};
    const P = Object.assign({ red: 0xdc7f7a, gold: 0xdcae6a, green: 0x7fbf92, blue: 0x7f9fd8 }, opts.palette || {});
    const col = h => new THREE.Color(h);
    const mat = (frag, extra) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag,
      uniforms: Object.assign({ uT: { value: 0 }, uA: { value: opts.alpha != null ? opts.alpha : 1 }, uFade: { value: opts.fadeEnds ? 1 : 0 } }, extra || {}),
      transparent: true, depthWrite: false, depthTest: !!opts.depthTest, side: THREE.DoubleSide,
    });
    const beamM = mat(BEAM_FRAG), innerM = mat(INNER_FRAG);
    const fanM = mat(FAN_FRAG, {
      uTilt: { value: 0 }, uLen: { value: 5 },
      uC0: { value: col(P.red) }, uC1: { value: col(P.gold) }, uC2: { value: col(P.green) }, uC3: { value: col(P.blue) },
    });
    const beamG = strip(THREE, 8), innerG = strip(THREE, 8), fanG = strip(THREE, 48);
    const beam = new THREE.Mesh(beamG, beamM), inner = new THREE.Mesh(innerG, innerM), fan = new THREE.Mesh(fanG, fanM);
    [beam, inner, fan].forEach(m => { m.renderOrder = 0; m.frustumCulled = false; });
    inner.renderOrder = 1.5;   // the light inside the glass draws over the glass body (prism = 1, its edges = 2)
    const group = new THREE.Group(); group.add(fan, beam, inner);
    // opts.ghost (a 3D room): the light is drawn again, quieter, wherever something stands in front of
    // it (depthFunc Greater) — so it pierces walls and plastic the way the Venus's ghost pierces the columns.
    // Normal blending by default (a tint that reads on pale plastic); opts.ghostBlend 'add' for dark surroundings.
    // The ghost shares every uniform with its ray except its own strength.
    const ghostU = [];
    if (opts.ghost) [beam, inner, fan].forEach(m => {
      const gu = {}; for (const k in m.material.uniforms) gu[k] = m.material.uniforms[k];
      gu.uA = { value: opts.ghost }; ghostU.push(gu.uA);
      const gm = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: m.material.fragmentShader, uniforms: gu,
        transparent: true, depthWrite: false, depthTest: true, depthFunc: THREE.GreaterDepth, blending: opts.ghostBlend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
      const g = new THREE.Mesh(m.geometry, gm); g.renderOrder = 998; g.frustumCulled = false; group.add(g);
    });

    const L = Object.assign({ beamY: -0.02, beamW: opts.beamW || 0.16, exitTop: 0.08, exitBot: -0.13, spread: opts.spread || 0.46, drop: opts.drop != null ? opts.drop : 0.05, z: opts.z != null ? opts.z : -0.05 }, opts.layout || {});
    function layout(o) {
      Object.assign(L, o || {});
      const ex = xLeft(L.beamY), hw = L.beamW / 2;
      setStrip(beamG, [L.left, L.beamY + hw], [L.left, L.beamY - hw], [ex, L.beamY + hw], [ex, L.beamY - hw], L.z);
      const tTop = [xRight(L.exitTop), L.exitTop], tBot = [xRight(L.exitBot), L.exitBot];
      setStrip(innerG, [ex, L.beamY + 0.05], [ex, L.beamY - 0.05], [tTop[0], tTop[1] + 0.03], [tBot[0], tBot[1] - 0.03], L.z);
      const mid = -L.drop;
      setStrip(fanG, tTop, tBot, [L.right, mid + L.spread], [L.right, mid - L.spread], L.z);
      fanM.uniforms.uLen.value = Math.max(0.5, L.right - tTop[0]);
    }
    function update(t, tilt) {
      const s = (t || 0) * 0.05;
      beamM.uniforms.uT.value = s; innerM.uniforms.uT.value = s; fanM.uniforms.uT.value = s;
      fanM.uniforms.uTilt.value = tilt || 0;
    }
    // setAlpha(a): the whole light, ghosts included, at a (0 = out, 1 = as built) — for fading it in and out
    const baseA = opts.alpha != null ? opts.alpha : 1;
    function setAlpha(a) { [beamM, innerM, fanM].forEach(m => { m.uniforms.uA.value = baseA * a; }); ghostU.forEach(u => { u.value = opts.ghost * a; }); group.visible = a > 0.001; }
    return { group, beam, inner, fan, layout, update, setAlpha };
  }

  root.PrismLight = { create, xLeft, xRight };
})(typeof window !== 'undefined' ? window : this);
