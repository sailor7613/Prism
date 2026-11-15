// ============================================================================
//  THE FLEET — the sailboats (2026-11-12)
//
//  Sailor, 10-13: "a few tankers and sailboats passing on the ocean … some
//  un-explained logic that related to energy flows and markets … make sure we
//  build the boats/ships out well."  11-12: "Lets build the sailboats."
//
//  This file is the sailboats. The tankers are not built yet.
//
//  THE BOAT is an International Star, built to the class numbers and not to a
//  photograph: 6.922 m long, 1.734 m across the deck and 1.372 m at the chine,
//  a hard chine with a slight curve to the bottom, long overhangs (4.72 m on
//  the water), a fin and bulb to 1.016 m, a tall bendy mast, a long low boom,
//  a small jib that does not overlap. Upwind the mast rakes aft and bends and
//  the two crew hang over the weather rail. Downwind the mast is let forward
//  and the jib is poled out to windward, wing and wing, which is how a Star
//  runs. The red star at the head of the main is the class's own mark.
//
//  THE RULE (Specs/Prism_G4_Shell_and_the_Veil_Direction_v1.md §5). It is
//  written here and in the spec and nowhere on screen:
//    · how many boats  = last week's move in Brent, one boat per $3 (1 to 9)
//    · how hard they heel = how unsteady the last four weeks were
//    · which way they sail = up or down. A rising week has them beating to
//      weather. A falling week has them running.
//  The numbers come from data/active/price.json (the weekly Brent series).
//  With no data there are three boats beating in a moderate breeze.
//
//  To look at either state by hand:  ?fleet=beat  ?fleet=run
//  and, with either,  &sails=6  &heel=20
// ============================================================================
(function () {
  'use strict';
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  var LOW   = (typeof QUALITY !== 'undefined' && QUALITY && QUALITY.tier === 'low');
  var SEA_Y = (typeof OCEAN_Y !== 'undefined') ? OCEAN_Y : -12;
  var SEA_Z = (typeof CLIFF_Z !== 'undefined' ? CLIFF_Z : 40) + 150;   // where the ocean plane sits

  // ── the class ─────────────────────────────────────────────────────────────
  var LOA = 6.922, BEAM = 1.734, CHINE = 1.372, DRAFT = 1.016;
  var MAST_U = 0.361;            // mast step, as a share of the length back from the stem
  var MAST_H = 9.25;             // mast above the deck
  var FOOT = 4.05;               // foot of the main
  var HOUNDS = 0.74;             // where the jib meets the mast, as a share of its height

  // ── the water they sail ───────────────────────────────────────────────────
  var X_EDGE = 150, FADE = 30;   // they appear and are lost at the edges of the bay
  var Z_NEAR = 150, Z_FAR = 285; // the lane: beyond the break, inside the fog
  var WIND = { x: 1, z: 0 };     // the afternoon westerly: it blows toward +x (east)

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function hex(c) { return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); return l < 1e-9 ? [0, 1, 0] : [a[0] / l, a[1] / l, a[2] / l]; }
  function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  // The same four waves the ocean's shader adds, so a boat rides the water
  // that is actually drawn under it.
  function seaHeight(x, z, t) {
    var lz = z - SEA_Z, sh = clamp((30 - lz) / 160, 0, 1);
    return SEA_Y + Math.sin(lz * 0.09 + t * 1.35) * (0.35 + sh * 0.85) + Math.sin(x * 0.04 + t * 0.8) * 0.45 +
      Math.sin(lz * 0.06 + t * 0.6 + 1.3) * 0.3 + Math.sin((x + lz) * 0.03 + t * 1.1) * 0.2;
  }

  // ── a small geometry builder: everything on a boat is one of two meshes ───
  function Builder() { this.p = []; this.n = []; this.c = []; }
  // a surface drawn from a function of two numbers, each from 0 to 1
  Builder.prototype.grid = function (fn, nu, nv, col) {
    var e = 1e-3, P = [], N = [], i, j;
    for (i = 0; i <= nu; i++) for (j = 0; j <= nv; j++) {
      var u = i / nu, v = j / nv;
      P.push(fn(u, v));
      N.push(norm(cross(sub(fn(Math.min(1, u + e), v), fn(Math.max(0, u - e), v)), sub(fn(u, Math.min(1, v + e)), fn(u, Math.max(0, v - e))))));
    }
    var W = nv + 1, self = this;
    function put(k) { var q = P[k], m = N[k]; self.p.push(q[0], q[1], q[2]); self.n.push(m[0], m[1], m[2]); self.c.push(col[0], col[1], col[2]); }
    for (i = 0; i < nu; i++) for (j = 0; j < nv; j++) {
      var a = i * W + j, b = (i + 1) * W + j, c = i * W + j + 1, d = (i + 1) * W + j + 1;
      put(a); put(b); put(c); put(c); put(b); put(d);
    }
  };
  // a ready-made THREE geometry, moved into place
  Builder.prototype.add = function (geo, m, col) {
    var g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m);
    var pos = g.attributes.position.array, nor = g.attributes.normal.array;
    for (var i = 0; i < pos.length; i += 3) {
      this.p.push(pos[i], pos[i + 1], pos[i + 2]); this.n.push(nor[i], nor[i + 1], nor[i + 2]); this.c.push(col[0], col[1], col[2]);
    }
  };
  Builder.prototype.tri = function (a, b, c, n, col) {
    var s = [a, b, c];
    for (var i = 0; i < 3; i++) { this.p.push(s[i][0], s[i][1], s[i][2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0], col[1], col[2]); }
  };
  Builder.prototype.build = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  };
  function place(x, y, z, rx, ry, rz, sx, sy, sz) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
      new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
  }

  // ── the Star's lines. u runs from the stem (0) to the transom (1). The bow
  //    points down +z, y is up, and y = 0 is the waterline. ───────────────────
  function zAt(u) { return LOA / 2 - LOA * u; }
  function deckHalf(u) {
    var m = 0.55, s = u < m ? Math.pow(Math.sin(Math.PI / 2 * u / m), 0.85) : 1 - 0.64 * Math.pow((u - m) / (1 - m), 2);
    return 0.012 + (BEAM / 2 - 0.012) * s;
  }
  function chineHalf(u) { return deckHalf(u) * (CHINE / BEAM) * (0.6 + 0.4 * Math.min(1, u / 0.22)); }
  function sheerY(u) { return 0.52 - 0.17 * Math.sin(Math.PI * u) - 0.07 * u; }
  function keelY(u) { return 0.30 - 0.50 * Math.pow(Math.sin(Math.PI * u), 0.7); }      // on the water for 4.7 m of her 6.9
  function chineY(u) { var k = keelY(u), s = sheerY(u); return k + Math.min(0.14, (s - k) * 0.5); }
  // the height of the hull's skin at a given half-breadth x, at station u
  function skinY(u, x) {
    var bc = chineHalf(u), bd = deckHalf(u), k = keelY(u), yc = chineY(u), s = sheerY(u);
    if (x <= bc) return k + (yc - k) * Math.pow(x / bc, 1.5);
    return yc + (s - yc) * ((x - bc) / Math.max(1e-6, bd - bc));
  }
  function deckY(u, w) { return sheerY(u) + 0.035 * (1 - w * w) * (deckHalf(u) / (BEAM / 2)); }   // w from -1 to 1 across

  // the mast: a point at a share h of its height. Raked aft and bent when
  // beating; let forward and straight when running.
  function mastAt(h, running) {
    var y0 = deckY(MAST_U, 0), zm = zAt(MAST_U);
    var rake = running ? -0.12 : 0.045, bend = running ? 0 : 0.22;
    return [0, y0 + MAST_H * h * Math.cos(rake), zm - MAST_H * h * Math.sin(rake) - bend * h * h];
  }

  // ── build one Star ────────────────────────────────────────────────────────
  //  hull: the topsides' colour. running: which suit of sails she carries.
  //  What comes back is a group with the bow down +z, sitting on y = 0.
  function buildStar(opts) {
    opts = opts || {};
    var running = !!opts.running;
    var topside = hex(opts.hull == null ? 0xf2f0ea : opts.hull);
    var bottom = hex(0xe9e7e0), deckCol = hex(0xdedbd0), well = hex(0x3b4047);
    var spar = hex(0xb9bcc0), sail = hex(opts.sail == null ? 0xf4f1e6 : opts.sail), red = hex(0xb3261e);
    var NS = LOW ? 14 : 26;

    // ---- what does not change sides: hull, deck, keel, mast -----------------
    var B = new Builder();
    [1, -1].forEach(function (side) {
      // the bottom, keel to chine, with its slight curve
      B.grid(function (u, v) { var x = chineHalf(u) * v; return [side * x, skinY(u, x), zAt(u)]; }, NS, 3, bottom);
      // the topsides, chine to sheer
      B.grid(function (u, v) { var x = lerp(chineHalf(u), deckHalf(u), v); return [side * x, lerp(chineY(u), sheerY(u), v), zAt(u)]; }, NS, 2, topside);
    });
    B.grid(function (u, v) { var w = 2 * v - 1; return [w * deckHalf(u), deckY(u, w), zAt(u)]; }, NS, 4, deckCol);
    // the transom
    B.grid(function (u, v) { var w = 2 * u - 1, x = Math.abs(w) * deckHalf(1); return [w * deckHalf(1), lerp(skinY(1, x), deckY(1, w), v), zAt(1)]; }, 6, 2, topside);
    // the cockpit, a long narrow well
    B.add(new THREE.BoxGeometry(0.60, 0.05, 2.35), place(0, deckY(0.6, 0) + 0.012, -0.80), well);
    // fin, bulb, rudder
    B.add(new THREE.BoxGeometry(0.05, 0.80, 1.30), place(0, -0.56, 0.25), bottom);
    B.add(new THREE.SphereGeometry(0.125, 8, 6), place(0, -DRAFT + 0.125, 0.25, 0, 0, 0, 1, 1, 5.6), hex(0x5a5d62));
    B.add(new THREE.BoxGeometry(0.035, 0.56, 0.30), place(0, -0.36, zAt(0.74)), bottom);
    // the mast, tapering above the hounds
    B.grid(function (a, h) {
      var c = mastAt(h, running), r = 0.055 - 0.028 * Math.max(0, (h - HOUNDS) / (1 - HOUNDS)), an = a * Math.PI * 2;
      return [c[0] + Math.cos(an) * r, c[1], c[2] + Math.sin(an) * r];
    }, 6, 8, spar);
    var fixedGeo = B.build();

    // ---- what changes sides on a tack: boom, sails, the two crew ------------
    //  Built with the leeward side at +x. The other tack is the mirror.
    var S = new Builder();
    var hg = 0.045;                                           // the gooseneck: the boom is carried low
    var beta = running ? 1.33 : 0.14, twist = running ? 0.22 : 0.24, depth = running ? 0.13 : 0.085;
    var luffLen = MAST_H * (0.985 - hg);
    function chord(h) { return FOOT * Math.pow(1 - h, 0.85) + 0.16 * Math.sin(Math.PI * h); }   // a little roach
    function mainAt(s, h) {
      var L = mastAt(hg + (0.985 - hg) * h, running), b = beta + twist * h, c = chord(h);
      var belly = depth * c * Math.sin(Math.PI * Math.pow(s, 0.8));
      return [L[0] + Math.sin(b) * c * s + Math.cos(b) * belly, L[1], L[2] - Math.cos(b) * c * s + Math.sin(b) * belly];
    }
    S.grid(mainAt, 8, LOW ? 8 : 14, sail);
    // the boom
    var G = mastAt(hg, running);
    S.grid(function (a, s) {
      var an = a * Math.PI * 2, r = 0.035, d = FOOT * 1.02 * s;
      return [G[0] + Math.sin(beta) * d + Math.cos(an) * r * Math.cos(beta), G[1] - 0.05 + Math.sin(an) * r, G[2] - Math.cos(beta) * d + Math.cos(an) * r * Math.sin(beta)];
    }, 5, 1, spar);
    // the class's red star, near the head of the main, on both faces
    (function () {
      var s0 = 0.40, h0 = 0.72, R = 0.33, c0 = chord(h0), e = 0.01;
      var n = norm(cross(sub(mainAt(s0 + e, h0), mainAt(s0 - e, h0)), sub(mainAt(s0, h0 + e), mainAt(s0, h0 - e))));
      [1, -1].forEach(function (face) {
        function at(r, an) { var q = mainAt(s0 + r * Math.cos(an) / c0, h0 + r * Math.sin(an) / luffLen); return [q[0] + n[0] * 0.035 * face, q[1], q[2] + n[2] * 0.035 * face]; }
        var ctr = at(0, 0), nn = [n[0] * face, n[1] * face, n[2] * face];
        for (var k = 0; k < 10; k++) {
          var a0 = Math.PI / 2 + k * Math.PI / 5, a1 = a0 + Math.PI / 5;
          S.tri(ctr, at(k % 2 ? R * 0.4 : R, a0), at(k % 2 ? R : R * 0.4, a1), nn, red);
        }
      });
    })();
    // the jib
    var tack = [0, deckY(0.045, 0) + 0.04, zAt(0.045)], head = mastAt(HOUNDS, running), zm = zAt(MAST_U), y0 = deckY(MAST_U, 0);
    var clew = running ? [-2.05, y0 + 0.80, zm + 0.55] : [0.40, y0 + 0.28, zm + 0.12];
    var jn = norm(cross(sub(head, tack), sub(clew, tack)));
    if ((running ? jn[2] : jn[0]) < 0) jn = [-jn[0], -jn[1], -jn[2]];                   // belly forward when running, to leeward when beating
    var jd = running ? 0.42 : 0.20;
    S.grid(function (s, h) {
      var a = lerp3(tack, head, h), b = lerp3(clew, head, h), q = lerp3(a, b, s), belly = jd * Math.sin(Math.PI * s) * (1 - h) * (0.6 + 0.4 * Math.sin(Math.PI * h) + 0.4);
      return [q[0] + jn[0] * belly, q[1] + jn[1] * belly, q[2] + jn[2] * belly];
    }, 6, LOW ? 6 : 10, sail);
    // the whisker pole that holds the jib out to windward on the run
    if (running) {
      var pa = [0, y0 + 0.62, zm + 0.05];
      S.grid(function (a, s) { var q = lerp3(pa, clew, s), an = a * Math.PI * 2; return [q[0], q[1] + Math.sin(an) * 0.022, q[2] + Math.cos(an) * 0.022]; }, 4, 1, spar);
    }
    // skipper and crew. Beating, they hang over the weather rail (-x here).
    if (!LOW) {
      var gear = [hex(0xa3352b), hex(0x26364d)], skin = hex(0xc9a183);
      [{ z: -1.45, c: 0 }, { z: -0.25, c: 1 }].forEach(function (m, i) {
        var x = running ? (i ? 0.18 : -0.16) : -(deckHalf(0.62) + 0.08), lean = running ? 0 : 0.95;
        var y = deckY(0.62, 0) + (running ? 0.22 : 0.16);
        S.add(new THREE.BoxGeometry(0.30, 0.56, 0.24), place(x - Math.sin(lean) * 0.22, y + Math.cos(lean) * 0.22, m.z, 0, 0, lean), gear[m.c]);
        S.add(new THREE.SphereGeometry(0.105, 6, 5), place(x - Math.sin(lean) * 0.60, y + Math.cos(lean) * 0.60, m.z), skin);
      });
    }
    var sideGeo = S.build();

    // ---- the wires: forestay, shrouds, the two backstays --------------------
    var cp = deckHalf(MAST_U + 0.02), ch = sheerY(MAST_U + 0.02), top = mastAt(1, running), bs = deckHalf(0.80), bsy = sheerY(0.80);
    var wires = [tack, head,
      [cp, ch, zm - 0.14], head, [-cp, ch, zm - 0.14], head,
      [cp, ch, zm - 0.14], mastAt(0.42, running), [-cp, ch, zm - 0.14], mastAt(0.42, running),
      [bs, bsy, zAt(0.80)], top, [-bs, bsy, zAt(0.80)], top];
    var wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], wires), 3));

    var group = new THREE.Group();
    var matFixed = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
    var matSide = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x23262b, emissiveIntensity: 0.5 });
    var matWire = new THREE.LineBasicMaterial({ color: 0x8f959c, transparent: true, opacity: 0.55 });
    var fixed = new THREE.Mesh(fixedGeo, matFixed), side = new THREE.Mesh(sideGeo, matSide);
    group.add(fixed); group.add(side);
    if (!LOW) group.add(new THREE.LineSegments(wg, matWire));
    group.userData = { side: side, mats: [matFixed, matSide], wire: matWire, running: running };
    return group;
  }

  // ── the wake: a soft V laid on the water astern ───────────────────────────
  var wakeTex = null;
  function wakeTexture() {
    if (wakeTex) return wakeTex;
    var c = document.createElement('canvas'); c.width = 64; c.height = 64;
    var x = c.getContext('2d'), img = x.createImageData(64, 64);
    for (var j = 0; j < 64; j++) for (var i = 0; i < 64; i++) {
      var v = 1 - j / 63, u = Math.abs(i / 63 - 0.5) * 2;                // v: 1 at the stern, 0 at the far end
      var a = Math.pow(v, 1.6) * (0.25 + 0.75 * Math.pow(u, 2.2)) * (1 - Math.pow(u, 9));
      var k = (j * 64 + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * clamp(a, 0, 1));
    }
    x.putImageData(img, 0, 0);
    wakeTex = new THREE.CanvasTexture(c);
    return wakeTex;
  }
  function buildWake() {
    var g = new THREE.BufferGeometry(), L = 15;
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.28, 0, 0, 0.28, 0, 0, 1.9, 0, -L, -0.28, 0, 0, 1.9, 0, -L, -1.9, 0, -L], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0.42, 1, 0.58, 1, 1, 0, 0.42, 1, 1, 0, 0, 0], 2));
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 3;
    return m;
  }

  // ── the reading: Brent's last four weeks ──────────────────────────────────
  function readPrice(j) {
    try {
      var p = j.series.RBRTE.points, n = p.length;
      if (n < 6) return null;
      var move = p[n - 1][1] - p[n - 2][1], ch = [], i, mean = 0, sd = 0;
      for (i = n - 4; i < n; i++) ch.push(p[i][1] / p[i - 1][1] - 1);
      ch.forEach(function (c) { mean += c / 4; });
      ch.forEach(function (c) { sd += (c - mean) * (c - mean) / 4; });
      sd = Math.sqrt(sd);
      return { asOf: p[n - 1][0], move: move, unsteady: sd,
        sails: clamp(Math.round(Math.abs(move) / 3), 1, 9),
        heel: 6 + 20 * Math.min(1, sd / 0.08),
        running: move < 0 };
    } catch (e) { return null; }
  }

  // ── the fleet ─────────────────────────────────────────────────────────────
  var HULLS = [0xf2f0ea, 0x1f2f4a, 0xf2f0ea, 0x9db7c9, 0x8c2a24, 0xf2f0ea, 0x4a4f55, 0xe8dca8, 0x1c1e22];
  var SAILS = [0xf4f1e6, 0xefe8d5, 0xf5eede, 0xf1efe9, 0xece6d6];
  var fleet = new THREE.Group(); fleet.name = 'fleet';
  scene.add(fleet);
  var boats = [], reading = null, lastT = null, seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  var UP = Math.atan2(-WIND.x, -WIND.z);            // the heading that points straight into the wind
  function courseFor(b) { return wrapAngle(reading.running ? UP + Math.PI + b.tack * 0.22 : UP + b.tack * 0.75); }
  function shallow(x, z) { return typeof getTerrainHeight === 'function' && getTerrainHeight(x, z) > SEA_Y - 1.6; }

  function muster(r) {
    while (boats.length) { var old = boats.pop(); fleet.remove(old.root); }
    reading = r;
    var n = LOW ? Math.min(r.sails, 5) : r.sails;
    for (var i = 0; i < n; i++) {
      var star = buildStar({ hull: HULLS[i % HULLS.length], sail: SAILS[i % SAILS.length], running: r.running });
      var root = new THREE.Group(), trim = new THREE.Group(), heelG = new THREE.Group(), wake = buildWake();
      heelG.add(star); trim.add(heelG); trim.add(wake); root.add(trim); fleet.add(root);
      wake.position.set(0, 0.07, -LOA / 2 + 0.25);
      var b = { root: root, trim: trim, heelG: heelG, star: star, wake: wake,
        x: lerp(-X_EDGE + 25, X_EDGE - 25, (i + 0.5) / n) + (rnd() - 0.5) * 30, z: lerp(Z_NEAR + 10, Z_FAR - 10, rnd()),
        tack: rnd() < 0.5 ? 1 : -1, ph: rnd() * 6.28, pace: 0.9 + rnd() * 0.22,
        next: 20 + rnd() * 50, look: rnd() * 0.7, heel: 0, lee: 1, op: -1 };
      b.h = courseFor(b);
      boats.push(b);
    }
  }

  function setOpacity(b, op) {
    if (Math.abs(op - b.op) < 0.01) return;
    b.op = op;
    b.root.visible = op > 0.01;
    b.star.userData.mats.forEach(function (m) {
      var tr = op < 0.995;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = op;
    });
    b.star.userData.wire.opacity = 0.55 * op;
  }

  function goAbout(b) { b.tack = -b.tack; b.next = 25 + rnd() * 55; }

  function tick(t) {
    var dt = lastT == null ? 0.016 : clamp(t - lastT, 0, 0.1); lastT = t;
    if (!reading) return;
    var run = reading.running, heelMax = reading.heel * Math.PI / 180;
    for (var i = 0; i < boats.length; i++) {
      var b = boats[i];
      // ---- the course: tack (or gybe) at the edges of the lane, off the shallows, and now and then
      var want = courseFor(b), vzWant = Math.cos(want);
      if ((b.z > Z_FAR && vzWant > 0) || (b.z < Z_NEAR && vzWant < 0)) { goAbout(b); want = courseFor(b); }
      b.next -= dt;
      if (b.next <= 0) {
        var other = Math.cos(wrapAngle(run ? UP + Math.PI - b.tack * 0.22 : UP - b.tack * 0.75));
        if ((other > 0 && b.z < Z_FAR - 25) || (other < 0 && b.z > Z_NEAR + 25)) { goAbout(b); want = courseFor(b); } else b.next = 10;
      }
      b.look -= dt;
      if (b.look <= 0) {
        b.look = 0.7;
        if (shallow(b.x + Math.sin(want) * 16, b.z + Math.cos(want) * 16) && Math.cos(want) < 0) { goAbout(b); want = courseFor(b); }
      }
      var dh = wrapAngle(want - b.h), turn = clamp(dh, -0.5 * dt, 0.5 * dt);
      b.h = wrapAngle(b.h + turn);
      var turning = Math.min(1, Math.abs(dh) / 0.5);
      var speed = (run ? 3.3 : 2.6) * b.pace * (1 - 0.45 * turning);
      b.x += Math.sin(b.h) * speed * dt; b.z += Math.cos(b.h) * speed * dt;
      // ---- lost at one edge of the bay, found again at the other
      if (run ? b.x > X_EDGE : b.x < -X_EDGE) { b.x = run ? -X_EDGE : X_EDGE; b.z = lerp(Z_NEAR + 10, Z_FAR - 10, rnd()); b.tack = rnd() < 0.5 ? 1 : -1; b.h = courseFor(b); }
      setOpacity(b, clamp((X_EDGE - Math.abs(b.x)) / FADE, 0, 1));
      if (!b.root.visible) continue;
      // ---- which side the wind is on, and so which way she leans
      var leeDot = WIND.x * Math.cos(b.h) - WIND.z * Math.sin(b.h);       // the wind along the boat's own +x
      if (Math.abs(leeDot) > 0.06) b.lee = leeDot > 0 ? 1 : -1;
      b.star.userData.side.scale.x = b.lee;
      var target = run
        ? -b.lee * 0.04 + Math.sin(t * 0.85 + b.ph) * heelMax * 0.45                       // running: she rolls
        : -clamp(leeDot / 0.35, -1, 1) * heelMax * (0.86 + 0.14 * Math.sin(t * 0.31 + b.ph));   // beating: she leans and holds it
      b.heel += (target - b.heel) * Math.min(1, dt * 1.6);
      // ---- on the water that is drawn
      var fx = Math.sin(b.h), fz = Math.cos(b.h);
      var yb = seaHeight(b.x + fx * 2.6, b.z + fz * 2.6, t), ys = seaHeight(b.x - fx * 2.6, b.z - fz * 2.6, t);
      var yp = seaHeight(b.x + fz * 1.2, b.z - fx * 1.2, t), yq = seaHeight(b.x - fz * 1.2, b.z + fx * 1.2, t);
      b.root.position.set(b.x, (yb + ys) / 2 + 0.02, b.z);
      b.root.rotation.y = b.h;
      b.trim.rotation.x = -Math.atan2(yb - ys, 5.2) * 0.9 + Math.sin(t * 1.7 + b.ph * 2) * 0.012;
      b.trim.rotation.z = Math.atan2(yp - yq, 2.4) * 0.5;
      b.heelG.rotation.z = b.heel;
      // ---- the wake shortens as she heels, and in a turn
      b.wake.scale.z = (run ? 1.0 : 0.8) * (1 - 0.45 * Math.min(1, Math.abs(b.heel) / 0.45)) * (1 - 0.4 * turning);
      b.wake.material.opacity = 0.45 * b.op;
    }
    chaseTick(dt);
  }

  // ── the camera goes out to them (the binnacle's THE FLEET course) ─────────
  //  shot() picks the boat with the most water left ahead of her and says where
  //  the eye should end up: low, off her leeward bow, looking back at her.
  //  ride() is how far she has sailed since the shot was planned, so the
  //  flight can land on her wherever she has got to. After the landing the
  //  villa's own orbit keeps the camera, and chase() keeps its centre on her:
  //  drag still turns the view round the boat, the wheel still zooms.
  var chase = { boat: null };
  function roomAhead(b) { return reading.running ? X_EDGE - b.x : b.x + X_EDGE; }
  function shot() {
    if (!reading || !boats.length) return null;
    var b = null;
    boats.forEach(function (k) { if (k.op > 0.99 && (!b || roomAhead(k) > roomAhead(b))) b = k; });
    if (!b) b = boats[0];
    b.next = Math.max(b.next, 30);                      // she holds her course while the camera comes out
    var run = reading.running, fx = Math.sin(b.h), fz = Math.cos(b.h), sx = fz * b.lee, sz = -fx * b.lee;   // s: toward her leeward side
    var y = b.root.position.y, ahead = run ? 21 : 17, abeam = run ? 11 : 13, x0 = b.x, z0 = b.z, d = new THREE.Vector3();
    return { boat: b,
      end: [b.x + fx * ahead + sx * abeam, y + (run ? 2.3 : 1.9), b.z + fz * ahead + sz * abeam],
      look: [b.x, y + 4.2, b.z],
      sweep: [b.x - fx * 30 + sx * 26, y + 7.5, b.z - fz * 30 + sz * 26],     // astern and to leeward: the eye comes up her side
      ride: function () { return d.set(b.x - x0, 0, b.z - z0); } };
  }
  function chaseTick(dt) {
    var b = chase.boat;
    if (!b) return;
    var busy = false;
    try { busy = approach.active || !!activeFocus || !!followAnimal.key || visitorNav.active; } catch (e) {}
    if (busy) { chase.boat = null; return; }
    if (boats.indexOf(b) < 0 || b.op < 0.55) {          // she is leaving the bay: go to another
      chase.boat = null;
      try { if (window.villaBinnacle) window.villaBinnacle.go('fleet'); } catch (e) {}
      return;
    }
    try {
      var k = 1 - Math.exp(-dt * 6);
      camTarget.x += (b.x - camTarget.x) * k; camTarget.z += (b.z - camTarget.z) * k;
      camTarget.y += (b.root.position.y + 4.2 - camTarget.y) * (1 - Math.exp(-dt * 1.5));
    } catch (e) { chase.boat = null; }
  }

  // ── start ─────────────────────────────────────────────────────────────────
  var q = {};
  try { location.search.replace(/[?&]([^=&]+)=?([^&]*)/g, function (_, k, v) { q[k] = v; }); } catch (e) {}
  function apply(r) {
    r = r || { asOf: null, move: 0, unsteady: 0, sails: 3, heel: 13, running: false, fallback: true };
    if (q.fleet === 'beat') r.running = false;
    if (q.fleet === 'run') r.running = true;
    if (q.sails) r.sails = clamp(parseInt(q.sails, 10) || r.sails, 1, 9);
    if (q.heel) r.heel = clamp(parseFloat(q.heel) || r.heel, 0, 35);
    muster(r);
  }
  apply(null);   // three boats beating until the price arrives
  if (typeof fetch === 'function') {
    var base = (typeof g4ActiveBase === 'function') ? g4ActiveBase() + '../data/active/' : '../data/active/';
    fetch(base + 'price.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { var r = readPrice(j); if (r) apply(r); })
      .catch(function () {});
  }

  window.VillaFleet = { shot: shot, chase: function (b) { chase.boat = b; }, release: function () { chase.boat = null; }, chasing: function () { return chase.boat; }, tick: tick, buildStar: buildStar, group: fleet, boats: boats, reading: function () { return reading; }, readPrice: readPrice, seaHeight: seaHeight };
})();
