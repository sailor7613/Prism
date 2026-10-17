// The room and the instrument, REBUILT (2026-08-11, after Sailor's walk):
// the open ring, the dome-as-ceiling, the Eames, the floating panel with a
// telescope for a face, full screen as the throw, the moon observable.
// Assert state, not motion — obsTick cranked by hand.
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

  // ── THE WALK PLAYS ON LOAD NOW (2026-08-16) ──
  // A suite that wants a pristine villa has to ASK for one: mark the walk
  // seen, then reload. Standing it down in place is not enough — by the time
  // a suite gets control the walk has already gathered nineteen residents
  // onto the sand and taken the wheel, so every check that reads a live
  // position (the staging, the routes, who is where) would be measuring the
  // walk's leftovers. Two suites said so.
  await p.evaluate(() => { try { localStorage.setItem('dg_tour_seen_v2', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(7000);

  // ── build: once, and the new bones ──
  const built = await p.evaluate(() => {
    const before = !!scene.getObjectByName('observatoryInterior');
    buildObservatoryInterior();
    const kids = scene.getObjectByName('observatoryInterior').children.length;
    buildObservatoryInterior();
    const kids2 = scene.getObjectByName('observatoryInterior').children.length;
    const rings = [];
    observatoryShell.children.forEach(c => { if (c.geometry && c.geometry.type === 'RingGeometry') rings.push(c.geometry.parameters.innerRadius); });
    return { before, kids, kids2,
      chair: !!obsChair, chairKids: obsChair ? obsChair.children.length : 0,
      panel: !!obsPanel, cushion: !!scene.getObjectByName('obsEdburgCushion'),
      ringsOpen: rings.length === 2 && rings.every(r => r === 3.0),
      satDomeWaits: !!obsSatDome && obsSatDome.visible === false,
      domeIsGlobe: !!obsDomeMesh && obsGeoGroup.parent === observatoryShell,
      lampHandle: !!obsLampGroup && obsLampGroup.name === 'obsLamp',
    };
  });
  check('the room does not exist until approached', built.before === false);
  check('a second approach builds nothing', built.kids === built.kids2, built.kids + ' children');
  check('the entablature opens — two annulus caps, 3-unit eye', built.ringsOpen);
  check('the dome IS the globe — one sphere on the building', built.domeIsGlobe);
  check('the satellites\' dome waits, invisible', built.satDomeWaits);
  check('the chandelier is the seated hand-hold', built.lampHandle);
  check('the Eames stands at the centre, ottoman and all',
    built.chair && built.chairKids >= 12, built.chairKids + ' pieces');
  check('the panel rests beside it; the cushion waits', built.panel && built.cushion);

  // ── the inverted Earth ──
  const globe = await p.evaluate(() => {
    const D2R = Math.PI / 180;
    const lon = DG_LON * D2R, lat = DG_LAT * D2R, cl = Math.cos(lat);
    const villa = new THREE.Vector3(cl * Math.cos(lon), Math.sin(lat), -cl * Math.sin(lon)).normalize();
    const up = villa.clone().applyQuaternion(obsGeoGroup.quaternion);
    const q0 = obsGeoGroup.quaternion.clone();
    obsGlobeSpinBy(150, -80);
    const turned = obsGeoGroup.quaternion.angleTo(q0);
    const r = { zenithY: +up.y.toFixed(5),
      gridVerts: obsGeoGrid.geometry.attributes.position.count,
      hasMap: !!obsDomeMesh.material.map,
      inFade: observatoryShell.userData.fadeMats.indexOf(obsDomeMesh.material) < 0
        && obsGlobeMat === obsDomeMesh.material,   // the VEIL drives it by hand now
      fullSphere: Math.abs(obsDomeMesh.geometry.parameters.thetaLength - Math.PI) < 1e-6,
      turned: +turned.toFixed(4),
      clipped: obsDomeMesh.material.clippingPlanes.length === 1
        && obsGeoGrid.material.clippingPlanes.length === 1,
      base: !!obsPanelBase, baseChrome: 0 };
    obsPanelBase.traverse(o => { if (o.isMesh && o.material.metalness > 0.7) r.baseChrome++; });
    obsGeoGroup.quaternion.copy(q0);   // put the villa back overhead
    return r;
  });
  check('the villa opens at its own zenith', globe.zenithY > 0.9999, 'up·villa ' + globe.zenithY);
  check('the globe wears a true map; the veil holds its reins',
    globe.hasMap && globe.inFade, globe.gridVerts + ' graticule verts');
  check('a whole Earth, clipped at the spring line — not a half', globe.fullSphere);
  check('a hand turns the Earth', globe.turned > 0.4, globe.turned + ' rad');

  // ── the grab is honest: only the visible face takes the pointer ──
  const grab = await p.evaluate(() => {
    const c = obsRoomCentre();
    const springY = c.y + 0.78 + 3.66;
    const ray = new THREE.Raycaster();
    const inRoom = new THREE.Vector3(c.x, c.y + 2, c.z);
    // up through the ring at the visible dome: GRAB
    ray.set(inRoom, new THREE.Vector3(0.1, 1, 0.05).normalize());
    const up = obsGlobeGrabHit(ray);
    const dbg = ray.intersectObject(observatoryShell, true).filter(h => h.object.isMesh)
      .slice(0, 3).map(h => (h.object.name || h.object.type) + '@' + h.point.y.toFixed(2));
    // horizontally at the wall: the wall is nearer — NO grab
    ray.set(inRoom, new THREE.Vector3(1, 0.05, 0).normalize());
    const wall = obsGlobeGrabHit(ray);
    // from outside, at the sphere's clipped lower half: NO grab
    ray.set(new THREE.Vector3(c.x + 12, springY - 1.5, c.z),
            new THREE.Vector3(-1, 0.02, 0).normalize());
    const lower = obsGlobeGrabHit(ray);
    // from outside, at the visible crown: GRAB
    ray.set(new THREE.Vector3(c.x + 12, springY + 6, c.z),
            new THREE.Vector3(-1, -0.35, 0).normalize());
    const crown = obsGlobeGrabHit(ray);
    return { up, wall, lower, crown, dbg };
  });
  check('pointing up through the ring grabs the Earth', grab.up === true, JSON.stringify(grab.dbg));
  check('pointing at the wall does NOT — the room keeps its pointer', grab.wall === false);
  check('the clipped lower hemisphere never grabs', grab.lower === false);
  check('the visible crown grabs from outside', grab.crown === true);
  check('below the horizon the Earth is clipped, not deleted', globe.clipped);
  check('the G4 body stands by the chair — chrome arm and all',
    globe.base && globe.baseChrome >= 4, globe.baseChrome + ' chrome pieces');

  // ── the telescope's plumbing ──
  const tel = await p.evaluate(() => {
    const L5 = 1 | (1 << 5);
    return {
      camLayer: obsTelCam.layers.mask === (1 << 5),
      starsOn: stars.layers.mask === L5,
      moonOn: moonDisc.layers.mask === L5 && moonGlow.layers.mask === L5,
      figsOn: dgConstGroup.children[0].layers.mask === L5,
      faceIsPlate: obsPanelFace.material.map === obsTelRT.texture,
    };
  });
  check('the telescope sees only the sky\'s layer', tel.camLayer);
  check('stars, moon, and figures join that layer', tel.starsOn && tel.moonOn && tel.figsOn);
  check('the panel\'s face IS the telescope\'s plate', tel.faceIsPlate);

  // ── sit: the eye IS the chair's; the panel WAITS; the moon: observable ──
  const seat = await p.evaluate(() => {
    obsSit();
    let t = 1000;
    const crank = (sec) => { for (let i = 0; i < sec * 20; i++) { t += 0.05; obsTick(t); } };
    crank(2);
    updateCamera();
    const head = obsChairHead();
    const eyeAtChair = camera.position.distanceTo(head) < 0.05;
    const waits = obsState.panelFloating === false && obsPanel.position.y < 2.0;
    obsPanelToggle();               // the armrest summons it
    crank(4);
    const risen = obsState.panelFloating && obsPanel.position.y > 2.0;
    const world = new THREE.Vector3();
    obsPanel.getWorldPosition(world);
    const distFromHead = world.distanceTo(head);
    const toMoon = moonDisc.position.clone().sub(head).normalize();
    obsPanelSph.phi = Math.acos(toMoon.y);
    obsPanelSph.theta = Math.atan2(toMoon.x, toMoon.z);
    crank(4);
    const telDir = new THREE.Vector3();
    obsTelCam.getWorldDirection(telDir);
    const offMoonDeg = telDir.angleTo(toMoon) * 180 / Math.PI;
    return { eyeAtChair, waits, risen, distFromHead: +distFromHead.toFixed(2),
      offMoonDeg: +offMoonDeg.toFixed(3),
      console: document.getElementById('obs-console').classList.contains('open') };
  });
  check('the eye sits IN the chair — no phantom orbit', seat.eyeAtChair);
  check('the panel WAITS to be asked', seat.waits && seat.console);
  check('asked, it rises to its shell', seat.risen && Math.abs(seat.distFromHead - 2.25) < 0.15,
    seat.distFromHead + ' from the eyes');
  check('swept to the moon, the plate holds the moon',
    seat.offMoonDeg < 1.0, seat.offMoonDeg + '° off');

  // ── the veil: the anthro-atmospheric layer, and the satellites in it ──
  const veil = await p.evaluate(() => {
    let t = 3000;
    const crank = (sec) => { for (let i = 0; i < sec * 20; i++) { t += 0.05; obsTick(t); } };
    // stand the eye under the dome so no peek-fade muddies the numbers
    const c = obsRoomCentre();
    camera.position.set(c.x + 1.2, c.y + 2.2, c.z);
    camTarget.set(0, 5, 20);
    const r = { sats: obsSats.length, names: obsSats.map(s2 => s2.name) };
    // truth check at a fixed instant, against satellite.js itself
    const ms = 1786510000000;
    obsSatTick(ms);
    const now = new Date(ms), gmst = satellite.gstime(now);
    r.satTruth = obsSats.map(s2 => {
      const pv = satellite.propagate(s2.rec, now);
      const gd = satellite.eciToGeodetic(pv.position, gmst);
      const want = obsGeoUnit(gd.longitude, gd.latitude).multiplyScalar(4.33);
      const offGround = s2.gDot.position.distanceTo(want);
      const la = satellite.ecfToLookAngles(obsObserverGd, satellite.eciToEcf(pv.position, gmst));
      const skyOk = (la.elevation > 0) === s2.sky.visible;
      const pathPts = s2.path.geometry.attributes.position.count;
      return { offGround: +offGround.toFixed(5), skyOk, pathPts };
    });
    const m = obsMoonRaDec(ms), aa = obsAltAz(m.ra, m.dec, ms);
    r.moonOk = (aa.alt > 0) === obsMoonMark.visible;
    // now raise the veil
    obsVeilToggle();
    crank(6);
    r.veilT = +obsState.veilT.toFixed(3);
    r.marbleThin = obsGlobeMat.opacity < 0.2;
    r.outlines = obsGeoCoast.visible && obsGeoCoast.material.opacity > 0.7;
    r.figures = dgConstGroup.visible && dgConstGroup.children[0].material.opacity > 0.4;
    r.marks = obsSkyMarks.visible && obsSats.every(s2 => s2.gDot.visible && s2.path.visible);
    obsVeilToggle();
    crank(6);
    r.earthBack = obsGlobeMat.opacity > 0.9 && !obsGeoCoast.visible
      && !dgConstGroup.visible && !obsSkyMarks.visible;
    obsStand();
    crank(3);
    r.stood = !obsState.seated && obsState.lamp
      && !document.getElementById('obs-console').classList.contains('open');
    return r;
  });
  check('three residents of the layer above', veil.sats === 3, veil.names.join(' · '));
  veil.satTruth.forEach((st, i) => {
    check(veil.names[i] + ' rides its true ground, path drawn',
      st.offGround < 0.001 && st.skyOk && st.pathPts === 91,
      'ground off ' + st.offGround + ', ' + st.pathPts + ' path points');
  });
  check('the moon is tracked', veil.moonOk);
  check('the veil thins the marble to translucence', veil.veilT > 0.9 && veil.marbleThin);
  check('the continents hold as gilt outline', veil.outlines);
  check('the figures stand among the real stars', veil.figures);
  check('the satellites surface — marks and paths', veil.marks);
  check('the earth returns whole when the veil lowers', veil.earthBack);
  check('standing restores the room', veil.stood);

  // ── the ontology: the tack, the terminator, the inspector ──
  const onto = await p.evaluate(() => {
    let t = 9000;
    const crank = (sec) => { for (let i = 0; i < sec * 20; i++) { t += 0.05; obsTick(t); } };
    const r = {};
    // the tack: turn the Earth, backdate the touch, watch it come home
    obsGlobeSpinBy(400, -200);
    const away = obsGeoGroup.quaternion.angleTo(obsGeoHome);
    obsGlobeTouchMs = Date.now() - 60000;
    crank(14);
    r.wandered = +away.toFixed(3);
    r.homed = +obsGeoGroup.quaternion.angleTo(obsGeoHome).toFixed(4);
    // the terminator: painted, plausible — the subsolar point must sit
    // where the independent formula puts it
    const ms = 1786510000000;
    obsPaintNight(ms);
    const sub = obsSubsolar(ms);
    const sun = obsSunRaDec(ms);
    const aaS = obsAltAz(sun.ra, sun.dec, ms);
    r.subDecSane = Math.abs(sub.decDeg) < 23.6;
    r.nightFresh = obsNightAt === ms;
    r.shade = !!observatoryShell.getObjectByName('obsNightShade');
    // the sun's OWN altitude from the subsolar frame must agree with the
    // alt-az route: at the subsolar point the sun is at the zenith
    const zen = Math.sin(DG_LAT * DG_D2R) * Math.sin(sub.decDeg * DG_D2R) +
      Math.cos(DG_LAT * DG_D2R) * Math.cos(sub.decDeg * DG_D2R) *
      Math.cos((DG_LON - sub.lonDeg) * DG_D2R);
    r.sunAgrees = Math.abs(Math.asin(zen) - aaS.alt) < 0.01;
    // the inspector: forge a crossing in the panel's cone → the card fills
    obsSit(); obsPanelToggle();
    crank(4);
    const s0 = obsSats[0];
    s0.sky.visible = true;
    s0.sky.position.copy(obsPanelDir().multiplyScalar(252));
    obsPanelInspectTick(Date.now());
    const card = document.getElementById('obs-sat-card');
    r.cardShows = card.classList.contains('open') && card.innerHTML.indexOf(s0.name) >= 0;
    r.cardFacts = card.innerHTML.indexOf('km up') > 0 && card.innerHTML.indexOf('next pass') > 0;
    // sweep away → the card yields
    obsPanelSph.theta += 1.2;
    crank(1);
    obsPanelInspectTick(Date.now());
    r.cardHides = !card.classList.contains('open');
    obsStand(); crank(2);
    return r;
  });
  check('a wandered Earth tacks home to its truth',
    onto.wandered > 1 && onto.homed < 0.05, onto.wandered + ' → ' + onto.homed + ' rad');
  check('the terminator keeps the hour — sun checked two ways',
    onto.nightFresh && onto.shade && onto.subDecSane && onto.sunAgrees);
  check('a crossing in the cone fills the inspector\'s card',
    onto.cardShows && onto.cardFacts);
  check('swept away, the card yields', onto.cardHides);

  // ── the portraits: actual machines on the plate, selected by a click ──
  const port = await p.evaluate(() => {
    let t = 12000;
    const crank = (sec) => { for (let i = 0; i < sec * 20; i++) { t += 0.05; obsTick(t); } };
    const r = {};
    r.models = obsSats.every(s2 => s2.model && s2.model.children.length >= 6);
    r.layer7 = obsSats.every(s2 => {
      let ok = true;
      s2.model.traverse(o => { if (o.isMesh && o.layers.mask !== (1 << 7)) ok = false; });
      return ok;
    });
    r.parked = !!scene.getObjectByName('obsSatPark');
    // click selection: forge a ray at Hubble's path (make it visible first)
    const s1 = obsSats[1];
    s1.path.visible = true;
    const pt = new THREE.Vector3().fromBufferAttribute(s1.path.geometry.attributes.position, 45);
    const world = s1.path.localToWorld(pt.clone());
    const origin = obsRoomCentre(); origin.y += 2;
    const ray = new THREE.Raycaster();
    ray.set(origin, world.clone().sub(origin).normalize());
    const hit = obsSatClickHit(ray);
    r.clickFinds = hit === s1;
    // selection turns the plate to the portrait and fills the card deep
    obsSit(); obsPanelToggle(); crank(3);
    obsInspectSat = s1;
    obsSatTick(Date.now());
    obsPanelInspectTick(Date.now());
    const card = document.getElementById('obs-sat-card');
    r.deepCard = card.classList.contains('open')
      && card.innerHTML.indexOf('Hubble') >= 0
      && card.innerHTML.indexOf('min around') > 0
      && card.innerHTML.indexOf('inclined') > 0
      && card.innerHTML.indexOf('aloft since 1990') > 0
      && card.innerHTML.indexOf('mirror') > 0;
    const spin0 = obsModelSpin;
    crank(2);
    r.portraitTurns = obsModelSpin > spin0 && Math.abs(s1.model.rotation.y - obsModelSpin) < 1e-9;
    obsInspectSat = null;
    obsStand(); crank(2);
    return r;
  });
  check('three machines modelled, parked under the world',
    port.models && port.layer7 && port.parked);
  check('a click on a path finds its satellite', port.clickFinds);
  check('selection fills the card to full depth — orbit, history, lore', port.deepCard);
  check('the portrait turns on the plate', port.portraitTurns);

  // ── the eye moves freely in a small room ──
  const comfort = await p.evaluate(() => {
    let t = 8000;
    const crank = (sec) => { for (let i = 0; i < sec * 20; i++) { t += 0.05; obsTick(t); } };
    const c = obsRoomCentre();
    camTarget.set(c.x, c.y + 2, c.z);
    camera.position.set(c.x + 9, c.y + 6, c.z);    // eye beyond the dome, peering in
    const floorIn = obsZoomFloor(2.5);
    crank(4);
    const shellThin = observatoryShell.userData.fadeMats.every(m => m.opacity < 0.3);
    camera.position.set(c.x + 1.5, c.y + 2.2, c.z);  // eye truly under the dome
    crank(4);
    const domeHolds = observatoryShell.userData.fadeMats.every(m => m.opacity > 0.8);
    camTarget.set(0, 5, 20);   // back to the villa
    camera.position.set(9, 12, 37);
    const floorOut = obsZoomFloor(2.5);
    crank(4);
    const shellBack = observatoryShell.userData.fadeMats.every(m => m.opacity > 0.8);
    return { floorIn, floorOut, shellThin, shellBack, domeHolds };
  });
  check('inside, the zoom floor drops to arm\'s length', comfort.floorIn === 0.7, comfort.floorIn);
  check('peering in from outside, the shell thins', comfort.shellThin);
  check('truly under it, the dome stands — it IS the ceiling', comfort.domeHolds);
  check('outside, both come back', comfort.floorOut === 2.5 && comfort.shellBack);

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
