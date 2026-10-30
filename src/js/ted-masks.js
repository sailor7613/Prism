// masks.js — two animal-head masks in Ted's low-poly style (2026-10-20).
// Each builder returns a THREE.Group centred on the skull, facing +z, about
// Ted's head size (skull radius ~0.17). Original designs: a red fox and a
// Shiba Inu, built from the same spheres-and-cones vocabulary as Ted.
(function (g) {
  const THREE = g.THREE;
  const mat = (c, r = .85, e) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r }, e || {}));
  function add(parent, geo, m, p, s, r) {
    const o = new THREE.Mesh(geo, m); if (p) o.position.set(...p); if (s) o.scale.set(...s); if (r) o.rotation.set(...r); parent.add(o); return o;
  }
  const S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
  const K = (r, h, n = 6) => new THREE.ConeGeometry(r, h, n);
  function eyes(gp, x, y, z, iris, size) {
    [-1, 1].forEach(sd => {
      add(gp, S(size * 1.15, 6, 4), mat(0x1c120c), [sd * x, y - .003, z - .008]);
      add(gp, S(size, 8, 6), mat(iris, .2, { emissive: iris, emissiveIntensity: .2 }), [sd * x, y, z]);
      const pg = new THREE.SphereGeometry(size * .5, 6, 4); pg.scale(.7, 1, 1);
      add(gp, pg, mat(0x050505, .3), [sd * x, y, z + size * .78]);
      add(gp, S(size * .22, 3, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), [sd * x - sd * size * .25, y + size * .35, z + size * .95]);
    });
  }

  // Red fox: long tapering snout, tall black-backed ears, white cheeks and muzzle underside
  function buildFox() {
    const gp = new THREE.Group();
    const red = mat(0xc4622c), redDark = mat(0x9a4520), white = mat(0xeee4d4, .8), black = mat(0x1a1210, .7), nose = mat(0x111111, .15, { metalness: .15 });
    add(gp, S(.17), red, [0, 0, 0], [.92, .9, 1.0]);
    add(gp, S(.07, 6, 4), red, [0, .1, .05], [1.8, .6, 1]);                      // brow ridge
    add(gp, K(.08, .30, 6), red, [0, -.035, .22], null, [Math.PI / 2, 0, 0]);       // upper snout
    add(gp, K(.06, .22, 6), white, [0, -.07, .19], [1, 1, .55], [Math.PI / 2, 0, 0]); // muzzle underside
    add(gp, S(.024, 6, 5), nose, [0, -.03, .37]);
    [-1, 1].forEach(sd => {
      add(gp, S(.075, 8, 6), white, [sd * .1, -.06, .07], [.8, .7, .9]);             // cheek ruff
      add(gp, S(.05, 6, 4), white, [sd * .145, -.1, 0], [.7, .9, .8], [0, 0, sd * .6]);
      const ear = new THREE.Group(); ear.position.set(sd * .095, .13, -.02); ear.rotation.set(-.12, 0, sd * -.28); gp.add(ear);
      add(ear, K(.07, .24, 4), black, [0, .12, -.004], null, [0, Math.PI / 4, 0]);
      add(ear, K(.05, .18, 4), white, [0, .10, .02], [1, 1, .5], [0, Math.PI / 4, 0]);
      add(ear, K(.072, .14, 4), red, [0, .06, -.002], null, [0, Math.PI / 4, 0]);
      add(gp, S(.03, 6, 4), redDark, [sd * .068, .07, .135], [1.6, .6, .8]);          // brow
    });
    eyes(gp, .068, .035, .145, 0xd99a1c, .022);
    return gp;
  }

  // Shiba Inu: round skull, short muzzle, small rounded ears, cream "urajiro" mask, brow dots
  function buildShiba() {
    const gp = new THREE.Group();
    const tan = mat(0xd08a45), cream = mat(0xf3e7d2, .8), dark = mat(0x2a1a10, .6), nose = mat(0x111111, .15, { metalness: .15 }), pink = mat(0x9a4a44, .6);
    add(gp, S(.175, 12, 10), tan, [0, .01, 0], [1, .95, .98]);
    add(gp, S(.11, 10, 8), cream, [0, -.06, .1], [1.25, .85, .9]);                  // cheeks
    add(gp, S(.075, 10, 8), cream, [0, -.05, .2], [1, .8, 1.15]);                   // muzzle
    add(gp, S(.075, 8, 6), tan, [0, .0, .19], [.55, .55, 1.0]);                     // bridge
    add(gp, S(.024, 6, 5), nose, [0, -.02, .285], [1.2, .85, 1]);
    add(gp, S(.03, 6, 4), pink, [0, -.095, .235], [1.1, .4, .6]);                   // smile
    [-1, 1].forEach(sd => {
      const ear = new THREE.Group(); ear.position.set(sd * .11, .12, -.02); ear.rotation.set(-.05, 0, sd * -.38); gp.add(ear);
      add(ear, K(.07, .13, 4), tan, [0, .055, 0], [1, 1, .55], [0, Math.PI / 4, 0]);
      add(ear, K(.045, .09, 4), cream, [0, .045, .02], [1, 1, .4], [0, Math.PI / 4, 0]);
      add(gp, S(.016, 6, 4), cream, [sd * .06, .085, .15], [1.3, .8, .6]);          // brow dots
      add(gp, S(.05, 6, 4), cream, [sd * .13, -.07, .02], [.7, .9, .8]);
    });
    eyes(gp, .062, .035, .148, 0x2a160c, .02);
    return gp;
  }
  g.TedMasks = { buildFox, buildShiba };
})(typeof window !== 'undefined' ? window : globalThis);
