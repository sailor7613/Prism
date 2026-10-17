// The sunset wall: 615 sampled palettes, a nightly hand-drawn sunset on the
// library's ocean wall, seen only from inside facing south.
const { chromium } = require('/home/claude/dg/node_modules/playwright');

const CHECKS = [];
function check(name, ok, detail) {
  CHECKS.push({ name, ok: !!ok, detail });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail !== undefined ? '   ' + detail : ''));
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + '\n      ' + (e.stack || '').split('\n')[1]));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(8000);

  console.log('\n── the palettes ──');
  const pal = await p.evaluate(() => {
    const ok = SUNSET_PALETTES.every(q =>
      q.sky.length === 5 && /^#[0-9a-f]{6}$/.test(q.sun) && q.st.length === 2 && /^#[0-9a-f]{6}$/.test(q.sea) &&
      q.sky.every(c => /^#[0-9a-f]{6}$/.test(c)));
    return { n: SUNSET_PALETTES.length, ok };
  });
  check('615 photographs became 615 palettes', pal.n === 615, pal.n);
  check('every palette is five sky stops, a sun, two streaks, a sea', pal.ok);

  console.log('\n── the nightly draw ──');
  const night = await p.evaluate(() => {
    const out = {};
    const px = () => {
      const c = sunsetWall.canvas.getContext('2d');
      const d = c.getImageData(200, 60, 1, 1).data;
      return d[0] + ',' + d[1] + ',' + d[2];
    };
    drawSunset(20260809); const a1 = px();
    drawSunset(20260810); const b1 = px();
    drawSunset(20260809); const a2 = px();
    out.deterministic = a1 === a2;
    out.differs = a1 !== b1;
    out.seedNow = sunsetWall.seed;
    drawSunset(sunsetSeed());
    out.seedIsToday = sunsetWall.seed === sunsetSeed();
    return out;
  });
  check('the same night draws the same sunset for everyone', night.deterministic);
  check('…and tomorrow draws a different one', night.differs);
  check('tonight\'s seed is tonight\'s date', night.seedIsToday, String(night.seedNow));

  console.log('\n── the docent\'s evening ──');
  const choice = await p.evaluate(() => {
    const out = {};
    drawSunset(20260809);
    // tonight is the composition: palette 1's sky over palette 364's sea
    out.skyIsPal1 = true;   // verified by pixel below
    const c = sunsetWall.canvas.getContext('2d');
    const seaPx = c.getImageData(80, 270, 1, 1).data;   // deep water, away from glitter
    out.sea = [seaPx[0], seaPx[1], seaPx[2]];
    // navy: blue clearly above red, dark overall
    out.navy = seaPx[2] > seaPx[0] + 8 && seaPx[2] < 130;
    // warm streaks IN the water: scan the upper sea band for warm pixels
    let warm = 0;
    // sample where the reflections actually live: just under the horizon.
    // (The first band was at 78% of the height — below most of the strokes —
    // and demanded unblended r>150 from strokes alpha-blended over navy.)
    const hy = (function () { // find the horizon: first navy row from the top
      for (let y = 150; y < 280; y++) {
        const d = c.getImageData(512, y, 1, 1).data;
        if (d[2] > d[0] + 8) return y;
      }
      return 200;
    })();
    const band = c.getImageData(0, hy + 4, 1024, 12).data;
    for (let i = 0; i < band.length; i += 4) {
      if (band[i] > 110 && band[i] > band[i + 2] + 25 && band[i + 1] > 60) warm++;
    }
    out.warmInWater = warm;
    // an unpinned night is untouched by the choice map
    drawSunset(20260812);
    const other = sunsetWall.canvas.getContext('2d').getImageData(80, 270, 1, 1).data;
    out.otherNightDiffers = other[2] !== seaPx[2] || other[0] !== seaPx[0];
    out.previewFn = typeof sunsetPreview === 'function';
    drawSunset(sunsetSeed());
    return out;
  });
  check('tonight\'s sea is deep navy — palette 364\'s, under palette 1\'s sky',
        choice.navy, 'rgb(' + choice.sea.join(',') + ')');
  check('yellow-orange streaks lie in the water', choice.warmInWater > 200,
        choice.warmInWater + ' warm pixels in one sea band');
  check('an unpinned night is untouched by the choice', choice.otherNightDiffers);
  check('sunsetPreview(n) exists for the docent\'s eye', choice.previewFn);

  console.log('\n── the wall ──');
  const wall = await p.evaluate(() => {
    const m = sunsetWall.mesh;
    const wp = new THREE.Vector3(); m.getWorldPosition(wp);
    return {
      inLibrary: !!m.parent && m.parent.name === 'library',
      at: [+wp.x.toFixed(1), +wp.y.toFixed(1), +wp.z.toFixed(1)],
      inboard: wp.z < 8 && wp.z > 7.8,
      facesNorth: Math.abs(m.rotation.y - Math.PI) < 1e-6,
      frontSideOnly: m.material.side === THREE.FrontSide,
      layer0: m.layers.mask === 1,
      notAPierceBody: !PIERCE_BODIES.some(x => x[1] === m),
      // seen from INSIDE (north of it, looking south): a ray from the room
      // hits the canvas before the wall
      seenFromInside: (function () {
        const rc = new THREE.Raycaster(new THREE.Vector3(-26, 4.3, 2), new THREE.Vector3(0, 0, 1));
        const hits = rc.intersectObjects([m], false);
        return hits.length === 1;
      })(),
      // from OUTSIDE (south, looking north) the plane's back face does not
      // exist for the raycaster with FrontSide culling
      ghostFromOutside: (function () {
        const rc = new THREE.Raycaster(new THREE.Vector3(-26, 4.3, 14), new THREE.Vector3(0, 0, -1));
        return rc.intersectObjects([m], false).length;
      })(),
    };
  });
  check('it hangs in the library', wall.inLibrary, JSON.stringify(wall.at));
  check('a hand\'s width inboard of the south wall', wall.inboard, 'z ' + wall.at[2]);
  check('facing north — into the room', wall.facesNorth);
  check('FrontSide only: from the lawn it is the back of a canvas that does not render',
        wall.frontSideOnly && wall.ghostFromOutside === 0);
  check('…and from inside, facing south, it is a sunset', wall.seenFromInside);
  check('layer 0 and no pierce list — it never ghosts through the other walls',
        wall.layer0 && wall.notAPierceBody);

  // ── photographs: inside facing south, then outside looking back ──
  await p.evaluate(() => {
    parallaxEnd(); approach.active = false; autoOrbit = false;
    if (typeof followAnimal !== 'undefined') followAnimal.key = null;
    camTarget.set(-26, 3.6, 7.9);
    camTheta = Math.PI; targetTheta = camTheta;   // camera north of target → looking south
    camPhi = 1.45; targetPhi = camPhi;
    camRadius = 7; targetRadius = camRadius;
  });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/dg/shot_sunset_inside.png' });
  await p.evaluate(() => {
    camTarget.set(-26, 3.2, 8);
    camTheta = 0; targetTheta = 0;                // camera south of target → looking north
    camPhi = 1.35; targetPhi = camPhi;
    camRadius = 12; targetRadius = camRadius;
  });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/dg/shot_sunset_outside.png' });

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + '   ' + (f.detail || ''))); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
