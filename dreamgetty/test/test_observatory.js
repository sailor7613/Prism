// The observatory, phase 1: the true sky (villa-wide), the hidden registry
// row, and the shell on the east peak. The sky's rotation is checked against
// the textbook alt-az formulas IN THE PAGE, at a fixed instant — assert
// state, not motion.
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
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + '\n      ' + (e.stack || '').split('\n')[1]));
  await p.goto('http://localhost:8899/index.html?q=high', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(9000);

  // ── the data ──
  const data = await p.evaluate(() => ({
    stars: DG_STARS.length, names: Object.keys(DG_STAR_NAMES).length,
    figs: DG_CONST.length, lat: DG_LAT, lon: DG_LON,
    count: starCount, tier: QUALITY.tier, starMag: QUALITY.starMag,
  }));
  check('every star to mag 5 is aboard', data.stars === 1627, data.stars);
  check('all 89 figures are aboard', data.figs === 89, data.figs);
  check('the bright ones have their names', data.names > 150, data.names);
  check('the villa observes from the ruled position', data.lat === 33.59 && data.lon === -117.88);
  check('the tier chose the star count', data.count === 1627 && data.starMag === 5.0,
    data.count + ' stars at tier ' + data.tier);

  // ── the sky is true — checked against the textbook at a fixed instant ──
  const astro = await p.evaluate(() => {
    const D2R = Math.PI / 180;
    const ms = 1786500000000; // a fixed instant, so the formula and the scene agree exactly
    dgSkySpin.rotation.y = dgSpinAngle(ms);
    dgSkyTilt.updateMatrixWorld(true);
    function altazTruth(ra, dec) { // the textbook, independent of the scene graph
      const H = (((dgLstDeg(ms) - ra) % 360) + 360) % 360 * D2R;
      const d = dec * D2R, phi = DG_LAT * D2R;
      const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
      const az = Math.atan2(-Math.sin(H) * Math.cos(d),
        Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.sin(phi) * Math.cos(H));
      return [alt / D2R, (((az / D2R) % 360) + 360) % 360];
    }
    function altazScene(i) {
      const a = stars.geometry.attributes.position;
      const v = new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i));
      stars.localToWorld(v).normalize();
      return [Math.asin(v.y) / (Math.PI / 180),
        (((Math.atan2(v.x, -v.z) / (Math.PI / 180)) % 360) + 360) % 360];
    }
    function findByName(n) {
      for (const k in DG_STAR_NAMES) if (DG_STAR_NAMES[k] === n) return +k;
      return -1;
    }
    const out = [];
    const polaris = DG_STARS.findIndex(s => s[1] > 89);
    [['Polaris', polaris], ['Vega', findByName('Vega')], ['Sirius', findByName('Sirius')],
     ['Arcturus', findByName('Arcturus')]].forEach(([name, i]) => {
      if (i < 0 || i >= starCount) { out.push({ name, missing: true }); return; }
      const t = altazTruth(DG_STARS[i][0], DG_STARS[i][1]);
      const s = altazScene(i);
      const dz = Math.min(Math.abs(t[1] - s[1]), 360 - Math.abs(t[1] - s[1]));
      out.push({ name, altT: t[0], altS: s[0], azT: t[1], azS: s[1],
        errAlt: Math.abs(t[0] - s[0]), errAz: dz * Math.cos(t[0] * Math.PI / 180) });
    });
    // sidereal pace: a quarter sidereal day turns the sky a quarter turn
    const q = 86164090.5 / 4;
    let d = (dgSpinAngle(ms) - dgSpinAngle(ms + q)) % (2 * Math.PI);
    if (d < 0) d += 2 * Math.PI;
    return { out, quarter: d, polarisIdx: polaris };
  });
  astro.out.forEach(r => {
    if (r.missing) { check('star found: ' + r.name, false, 'missing from catalog'); return; }
    check(r.name + ' stands where the textbook puts it', r.errAlt < 0.05 && r.errAz < 0.05,
      'alt ' + r.altS.toFixed(2) + '/' + r.altT.toFixed(2) + ' az ' + r.azS.toFixed(2) + '/' + r.azT.toFixed(2));
  });
  const pol = astro.out[0];
  check('Polaris holds the north at the villa\'s latitude',
    pol && Math.abs(pol.altS - 33.59) < 1.0 && (pol.azS < 1.6 || pol.azS > 358.4),
    pol && 'alt ' + pol.altS.toFixed(2) + ' az ' + pol.azS.toFixed(2));
  check('a quarter sidereal day is a quarter turn',
    Math.abs(astro.quarter - Math.PI / 2) < 0.001, astro.quarter.toFixed(5));

  // ── the old dome is gone; the wiring holds ──
  const wiring = await p.evaluate(() => {
    const r = {};
    r.notEight = starCount !== 800;
    r.parent = stars.parent === dgSkySpin && dgSkySpin.parent === dgSkyTilt;
    r.tilt = Math.abs(dgSkyTilt.rotation.x - (DG_LAT * Math.PI / 180 - Math.PI / 2)) < 1e-9;
    starMaterial.opacity = 0.42;
    r.opacityRoutes = Math.abs(starMaterial.uniforms.uOpacity.value - 0.42) < 1e-9;
    starMaterial.opacity = 1.0;
    const sz = stars.geometry.attributes.size;
    let okSizes = true;
    for (let i = 0; i < starCount; i += 97) {
      if (!(sz.array[i] > 0 && sz.array[i] <= dgStarBase[i] * 1.2 + 1e-6)) okSizes = false;
    }
    r.twinkleModulates = okSizes;
    const fig = scene.getObjectByName('dgConstFigures');
    r.figsHidden = !!fig && fig.visible === false;
    r.figSegs = fig ? fig.children[0].geometry.attributes.position.count : 0;
    return r;
  });
  check('the 800 random points have retired', wiring.notEight);
  check('the sky hangs on tilt → spin, latitude pinned', wiring.parent && wiring.tilt);
  check('the Skylight tween still reaches the stars', wiring.opacityRoutes);
  check('the twinkle modulates true size, never replaces it', wiring.twinkleModulates);
  check('the figures wait, invisible, on the same sphere',
    wiring.figsHidden && wiring.figSegs > 2000, wiring.figSegs + ' line verts');

  // ── the registry row, hidden; discovery; the shell ──
  const place = await p.evaluate(() => {
    const row = PLACE_REGISTRY.find(p => p.key === 'observatory');
    const r = { row: !!row, hidden: row && row.hidden === true, icon: PLACE_ICONS.observatory === '🔭' };
    r.unknownBefore = row ? !compassPlaceKnown(row) : false;
    r.nearest = nearestPlace({ x: 18, z: -74 });
    r.mountainStillOwns = nearestPlace({ x: 0, z: -70 });
    compassMarkVisited('observatory');
    r.knownAfter = row ? compassPlaceKnown(row) : false;
    r.persisted = (localStorage.getItem('dg_compass_visited') || '').indexOf('observatory') >= 0;
    const shell = scene.getObjectByName('observatoryShell');
    r.shell = !!shell;
    r.shellY = shell ? shell.position.y : null;
    r.terrainY = getTerrainHeight(18, -74);
    r.domeTopY = shell ? shell.position.y + 0.78 + 3.66 + 4.4 : null;
    return r;
  });
  check('one registry row, hidden, with its glyph', place.row && place.hidden && place.icon);
  check('the Compass does not know it yet', place.unknownBefore);
  check('standing on the peak names the observatory', place.nearest === 'the observatory', place.nearest);
  check('the mountain keeps its own ground', place.mountainStillOwns === 'the mountain', place.mountainStillOwns);
  check('being there teaches the Compass, forever', place.knownAfter && place.persisted);
  check('the shell stands on the peak\'s real ground',
    place.shell && Math.abs(place.shellY - place.terrainY) < 0.01,
    'peak y ' + (place.terrainY !== null && place.terrainY.toFixed(2)) + ' — dome top y ' +
    (place.domeTopY !== null && place.domeTopY.toFixed(2)) + ' (bake into the row\'s look)');

  console.log('\npageerrors: ' + errs.length);
  errs.forEach(e => console.log('  PAGEERROR: ' + e));
  const green = CHECKS.filter(c => c.ok).length;
  console.log('\n' + green + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (green < CHECKS.length) {
    console.log('FAILED:');
    CHECKS.filter(c => !c.ok).forEach(c => console.log('  - ' + c.name + '   ' + (c.detail || '')));
  }
  await b.close();
  process.exit(green === CHECKS.length && errs.length === 0 ? 0 : 1);
})();
