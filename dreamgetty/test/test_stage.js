// The staging: where everyone stands, how they get there, the fly-over, and
// the parallax. Frame clock driven where motion is involved.
const { chromium } = require('/home/claude/dg/node_modules/playwright');

const CHECKS = [];
function check(name, ok, detail) {
  CHECKS.push({ name, ok: !!ok, detail });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail !== undefined ? '   ' + detail : ''));
}
const LONG = 'Hello, and welcome to the Dream Getty. [[house]] Everyone here lives in this villa. '
  + '[[library]] Behind me is the library. [[mountain]] North of us, the peak. '
  + '[[exedra]] And east, the exedra. [[ted]] Go anywhere you like.';

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + '\n      ' + (e.stack || '').split('\n')[1]));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(7000);

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
  await p.evaluate(() => {
    window.__mk = function (extra) {
      feedState.entries = [{
        id: 'intro', author: 'ted', kind: 'address', text: arguments[1] || 'Hello. Welcome.',
        t: '2026-08-01T00:00:00.000Z', pos: [0, 0, 0], place: 'the galleria', replyTo: null, to: null,
      }].concat(extra || []);
      localStorage.removeItem('dg_heard_talks'); heardTalks.clear();
    };
    window.__crank = function (frames, t0) {
      let t = t0 || 0;
      for (let i = 0; i < frames; i++) { t += 1 / 60; updateTedAddress(t); }
      return t;
    };
  });

  // ── THE CONSOLE SAYS SAVE ──────────────────────────────────────────────
  console.log('\n── save ──');
  const con = await p.evaluate(() => {
    const real = window.feedIdentity;
    window.feedIdentity = () => ({ avatar: 'ted', pass: 'x' });
    localStorage.removeItem('dg_address_draft');
    openDocentConsole();
    const labels = Array.from(document.getElementById('dc-row').querySelectorAll('button'))
      .map(x => x.textContent);
    const box = document.getElementById('dc-text');
    box.value = 'A line typed, never pressed.';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const auto = localStorage.getItem('dg_address_draft');
    const posted = feedState.entries.some(e => /never pressed/.test(e.text));
    closeDocentConsole();
    window.feedIdentity = real;
    return { labels, auto, posted };
  });
  check('the button says save', con.labels[0] === 'save', JSON.stringify(con.labels));
  check('no separate "keep the draft" button', !con.labels.includes('keep the draft'));
  check('typing keeps the draft by itself', con.auto === 'A line typed, never pressed.', JSON.stringify(con.auto));
  check('and typing broadcasts nothing', !con.posted);

  // ── WHERE TED STANDS ───────────────────────────────────────────────────
  console.log('\n── ted\'s mark ──');
  const mark = await p.evaluate((LONG) => {
    __mk(null, LONG);
    openThreshold(feedState.entries[0], { rewatch: true });
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
    flyoverStop();
    __crank(600, 100);
    const t = tedTurner.position;
    return {
      mark: [TED_MARK.x, TED_MARK.z],
      at: [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)],
      onStone: onVillaStone(t.x, t.z),
      // His PAWS, not his transform origin — reared, the group origin sits
      // 0.64 above the stone because the hip holds its standing height while
      // the body turns around it. Checking t.y here measured the pose, not
      // the footing.
      BUILDING_Y,
      pawY: (function () {
        tedTurner.updateMatrixWorld(true);
        let lo = Infinity; const v = new THREE.Vector3();
        [2, 3].forEach(function (i) {
          tedTurner.userData.legs[i].group.traverse(function (o) {
            if (!o.isMesh) return;
            const pos = o.geometry.attributes.position;
            for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k); o.localToWorld(v); if (v.y < lo) lo = v.y; }
          });
        });
        return +lo.toFixed(3);
      })(),
      dropAhead: getVisitorHeight(t.x, t.z + 5) - BUILDING_Y,
      facing: +tedTurner.rotation.y.toFixed(3),
      wantFacing: +Math.atan2(ADDRESS_STAGE.x - TED_MARK.x, ADDRESS_STAGE.z - TED_MARK.z).toFixed(3),
      // Not a centre-to-centre distance — the boxes. He clears her plinth by
      // 8cm and that is the whole margin.
      venusGap: (function () {
        let st = null; scene.traverse(function (o) { if (o.userData && o.userData.isStatue) st = o; });
        if (!st) return null;
        tedTurner.updateMatrixWorld(true);
        const tb = new THREE.Box3().setFromObject(tedTurner);
        const sb = new THREE.Box3().setFromObject(st);
        return { overlaps: tb.intersectsBox(sb), gap: +(sb.min.z - tb.max.z).toFixed(3) };
      })(),
      reared: +TED_REAR.now.toFixed(2),
    };
  }, LONG);
  check('he stands at the far lip of the causeway', mark.onStone && mark.mark[1] === 27.0,
        'z ' + mark.mark[1] + ', standing at ' + JSON.stringify(mark.at));
  check('his hind paws are on the stone, above the lawn',
        Math.abs(mark.pawY - mark.BUILDING_Y) < 0.05,
        'paws at y ' + mark.pawY + ', terrace ' + mark.BUILDING_Y + ' (his origin rides at ' + mark.at[1] + ', reared)');
  check('he turns to the house, not to a compass bearing',
        Math.abs(mark.facing - mark.wantFacing) < 0.05,
        'yaw ' + mark.facing + ' (want ' + mark.wantFacing + ')');
  check('and he does not stand inside the Venus',
        mark.venusGap && !mark.venusGap.overlaps && mark.venusGap.gap > 0.02,
        (mark.venusGap ? mark.venusGap.gap : '?') + ' clear of her plinth');
  check('and up on his hind legs there', mark.reared > 1.05, 'θ ' + mark.reared);

  // ── ONE PLANE, AND EVERY ONE OF THEM IN HIS SIGHTLINE ──────────────────
  console.log('\n── the house in session ──');
  const seat = await p.evaluate(() => {
    const keys = Object.keys(gatherState.members);
    const rows = keys.map(k => {
      const v = gatherState.members[k].seat;
      return { k, rank: (ADDRESS_SEATING[k] || {}).rank,
               x: +v.x.toFixed(1), z: +v.z.toFixed(1), y: +v.y.toFixed(2),
               ground: +getVisitorHeight(v.x, v.z).toFixed(2) };
    });
    // THE measurement: a ray from his eye to every seat, against every solid
    // mesh in the scene. This is what "obscured" means, made checkable.
    const eye = new THREE.Vector3(TED_MARK.x, getVisitorHeight(TED_MARK.x, TED_MARK.z) + 1.55, TED_MARK.z);
    const rc = new THREE.Raycaster();
    // THE FILTER MATTERS MORE THAN THE RAY. addFocusTarget builds invisible
    // hitboxes with MeshBasicMaterial({visible:false}) — the MATERIAL is
    // invisible, the OBJECT is not — so `o.visible` is true and they count as
    // solid. The Venus's is a 2.6 x 4 x 2.5 box on the axis; with it in the
    // list, a mid-session probe reported Ted as hidden from all sixteen and
    // nearly moved the whole staging again on the strength of it.
    const blockers = [];
    scene.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const m = o.material;
      if (!m || m.visible === false) return;
      if (o.userData && o.userData.focusTarget) return;
      if (Array.isArray(m) ? m.some(x => x.transparent && x.opacity < 0.5)
                           : (m.transparent && m.opacity < 0.5)) return;
      blockers.push(o);
    });
    const hidden = rows.filter(r => {
      const t = new THREE.Vector3(r.x, r.ground + 0.5, r.z);
      const d = t.clone().sub(eye); const L = d.length(); d.normalize();
      rc.set(eye, d); rc.far = L - 0.4;
      return rc.intersectObjects(blockers, false).length > 0;
    }).map(r => r.k);
    // …and the reverse, which is the half that actually matters to a
    // visitor: can each of THEM see the speaker?
    const cannotSeeHim = rows.filter(r => {
      const from = new THREE.Vector3(r.x, r.ground + 0.6, r.z);
      const gy = getVisitorHeight(TED_MARK.x, TED_MARK.z);
      return ![0.9, 1.6].some(h => {
        const t = new THREE.Vector3(TED_MARK.x, gy + h, TED_MARK.z);
        const d = t.clone().sub(from); const L = d.length(); d.normalize();
        rc.set(from, d); rc.far = L - 0.5;
        return rc.intersectObjects(blockers, false).length === 0;
      });
    }).map(r => r.k);
    let minGap = Infinity;
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      minGap = Math.min(minGap, Math.hypot(rows[i].x - rows[j].x, rows[i].z - rows[j].z));
    }
    const ys = rows.map(r => r.y);
    return {
      rows, hidden, cannotSeeHim, minGap, label: gatherState.label,
      spread: +(Math.max(...ys) - Math.min(...ys)).toFixed(2),
      inFront: rows.filter(r => r.z > TED_MARK.z + 2).length,
      grounded: rows.filter(r => Math.abs(r.y - r.ground) < 0.01).length,
      inTheChannel: rows.filter(r => Math.abs(r.x) < ADDRESS_CHANNEL - 1.0).length,
      frontRankZ: rows.filter(r => r.rank === 0).map(r => r.z),
      backRankZ: rows.filter(r => r.rank === 1).map(r => r.z),
      identicalX: new Set(rows.map(r => r.x)).size,
    };
  });
  check('the gathering is named for the lawn', seat.label === 'The Lawn', seat.label);
  check('EVERY ONE OF THEM IS IN HIS SIGHTLINE',
        seat.hidden.length === 0,
        (seat.rows.length - seat.hidden.length) + '/' + seat.rows.length +
        (seat.hidden.length ? ' — hidden: ' + seat.hidden.join(' ') : ' (was 9/16)'));
  check('…and every one of them can see HIM', seat.cannotSeeHim.length === 0,
        (seat.rows.length - seat.cannotSeeHim.length) + '/' + seat.rows.length +
        (seat.cannotSeeHim.length ? ' — cannot see him: ' + seat.cannotSeeHim.join(' ') : ''));
  check('and they are on one plane', seat.spread < 0.7,
        'height spread ' + seat.spread + ' (was 4.05)');
  check('every seat is in front of him', seat.inFront === seat.rows.length);
  check('every seat sits on the ground it stands on', seat.grounded === seat.rows.length);
  check('nobody is left standing in the river', seat.inTheChannel === 0,
        seat.inTheChannel + ' in the channel');
  check('the short rank is in front of the tall one',
        Math.max(...seat.frontRankZ) < Math.min(...seat.backRankZ),
        'front z ' + Math.min(...seat.frontRankZ).toFixed(1) + '–' + Math.max(...seat.frontRankZ).toFixed(1) +
        ', back ' + Math.min(...seat.backRankZ).toFixed(1) + '–' + Math.max(...seat.backRankZ).toFixed(1));
  check('nobody stands inside anybody', seat.minGap > 1.4, 'closest pair ' + seat.minGap.toFixed(2));
  check('it is a scatter, not a firing line', seat.identicalX === seat.rows.length);

  // ── HOW THEY GET THERE ─────────────────────────────────────────────────
  console.log('\n── the procession ──');
  const route = await p.evaluate(() => {
    const legs = k => (gatherState.members[k] ? gatherState.members[k].route.map(v => [Math.round(v.x), Math.round(v.z)]) : null);
    const start = k => { const a = AVATARS[k] && AVATARS[k](); return a ? Math.round(a.position.z) : null; };
    // and force a leg hand-over
    const key = Object.keys(gatherState.members).find(k => gatherState.members[k].route.length > 1);
    let advanced = null;
    if (key) {
      const m = gatherState.members[key];
      const before = m.leg, at0 = m.at.clone();
      processionTick(clock.getElapsedTime() + 999);       // past the 45s patience
      advanced = { key, before, after: m.leg, moved: !m.at.equals(at0) };
    }
    return {
      seaward: Object.keys(gatherState.members).filter(k => ADDRESS_FROM[k] === 'sea'),
      ridge: Object.keys(gatherState.members).filter(k => ADDRESS_FROM[k] === 'ridge'),
      house: Object.keys(gatherState.members).filter(k => !ADDRESS_FROM[k]),
      routes: Object.fromEntries(Object.keys(gatherState.members).map(k => [k, legs(k)])),
      starts: Object.fromEntries(Object.keys(gatherState.members).map(k => [k, start(k)])),
      advanced,
      river: ADDRESS_RIVER.map(w => w.z),
    };
  });
  const seawardRouted = route.seaward.filter(k => route.routes[k].length > 1);
  check('the ones who live seaward are given the river',
        route.seaward.length === 0 || seawardRouted.length === route.seaward.length,
        route.seaward.map(k => k + ' z' + route.starts[k] + ' → ' + JSON.stringify(route.routes[k])).join('  '));
  check('the back range is brought down the north side',
        route.ridge.every(k => route.routes[k].length > 1 && route.routes[k][0][1] < 0),
        route.ridge.map(k => k + ' → ' + JSON.stringify(route.routes[k])).join('  '));
  check('a resident who already lives here walks straight to its seat',
        route.house.every(k => route.routes[k].length === 1),
        route.house.map(k => k + ':' + route.routes[k].length).join(' '));
  check('the river legs run inland, never back out to sea',
        route.seaward.every(k => {
          const zs = route.routes[k].map(w => w[1]);
          return zs.every((z, i) => i === 0 || z < zs[i - 1]);
        }),
        route.seaward.map(k => route.routes[k].map(w => w[1]).join('→')).join('  '));
  check('a leg is handed over on patience alone',
        route.advanced && route.advanced.after === route.advanced.before + 1 && route.advanced.moved,
        route.advanced ? route.advanced.key + ' leg ' + route.advanced.before + '→' + route.advanced.after : 'no multi-leg traveller');

  // ── THE FLY-OVER ───────────────────────────────────────────────────────
  console.log('\n── the fly-over ──');
  const fly = await p.evaluate((LONG) => {
    const out = {};
    __mk([{ id: 'later', author: 'ted', kind: 'address', text: 'A short announcement.',
            t: '2026-08-20T00:00:00.000Z', pos: [0, 0, 0], place: 'the galleria', replyTo: null, to: null }], LONG);
    // the introduction
    openThreshold(feedState.entries[0], { rewatch: true });
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
    out.introFlies = flyover.active === true;
    out.startsAtSea = flyover.lookCurve.getPointAt(0).z > 80;
    // ONE spline, not six glides: sample the whole path and assert the
    // camera never stops mid-flight (the old sickness) and the look-target
    // never jumps (the old recenter)
    let maxStep = 0, minStep = Infinity, maxLookJump = 0;
    let prevP = flyover.posCurve.getPointAt(0), prevL = flyover.lookCurve.getPointAt(0);
    for (let i = 1; i <= 200; i++) {
      const s2 = flyoverProgress(i / 200);
      const pp = flyover.posCurve.getPointAt(s2), ll = flyover.lookCurve.getPointAt(s2);
      const st = pp.distanceTo(prevP);
      if (i > 24 && i < 176) { maxStep = Math.max(maxStep, st); minStep = Math.min(minStep, st); }
      maxLookJump = Math.max(maxLookJump, ll.distanceTo(prevL));
      prevP = pp; prevL = ll;
    }
    out.cruiseSteady = minStep > 0 && maxStep / minStep < 2.2;   // no full stops mid-flight
    out.lookNeverJumps = maxLookJump < 3.5;                      // no recentering snatch
    out.minStep = minStep; out.maxStep = maxStep; out.maxLookJump = maxLookJump;
    out.legs = ADDRESS_FLYOVER.length;
    out.span = ADDRESS_FLYOVER[0].look[2] - ADDRESS_FLYOVER[ADDRESS_FLYOVER.length - 1].look[2];
    out.total = ADDRESS_FLYOVER.reduce((a, l) => a + l.dur, 0);
    out.endsOnTed = Math.abs(ADDRESS_FLYOVER[ADDRESS_FLYOVER.length - 1].look[2] - TED_MARK.z) < 2;
    // a cue outranks the tour
    addressApplyCue('library');
    out.cueStopsIt = flyover.active === false;
    endThreshold();
    // a LATER talk does not fly
    const later = talkSeries().find(x => x.entry.id === 'later');
    openThreshold(later.entry, { rewatch: true });
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
    out.laterDoesNotFly = flyover.active === false;
    out.laterOpensOnTheSpeaker = Math.abs(approach.endLook.z - TED_MARK.z) < 3;
    endThreshold();
    return out;
  }, LONG);
  check('the introduction opens with the fly-over', fly.introFlies);
  check('…starting out at sea', fly.startsAtSea);
  check('ONE breath — the camera never stops mid-flight',
        fly.cruiseSteady, 'step ' + fly.minStep.toFixed(3) + '…' + fly.maxStep.toFixed(3));
  check('…and the look never snatches — no recentering',
        fly.lookNeverJumps, 'max look jump ' + fly.maxLookJump.toFixed(2) + ' per sample');
  check('…crossing the villa end to end', fly.span > 60,
        fly.span + ' units of z over ' + fly.total + 's, ' + fly.legs + ' legs');
  check('…and landing on the speaker', fly.endsOnTed);
  check('a cue in the speech outranks the tour', fly.cueStopsIt);
  check('a later announcement does NOT fly the coast again', fly.laterDoesNotFly);
  check('…it opens straight on the speaker', fly.laterOpensOnTheSpeaker);

  // ── THE PARALLAX ───────────────────────────────────────────────────────
  console.log('\n── the parallax ──');
  const par = await p.evaluate(() => {
    const out = {};
    parallaxEnd();
    approach.active = false; stopFollow(); activeFocus = null;
    if (visitorNav.active) toggleVisitor();
    camTarget.set(0, 1.5, 19); camTheta = 0.3; camRadius = 18; camPhi = 1.0;
    targetTheta = camTheta;
    parallaxBegin({ span: 1.15, speed: 5 });     // sped up so a tick is visible
    parallaxTick();                              // frame 1: re-base
    out.rebased = Math.abs(parallax.base - 0.3) < 1e-6 && !parallax.blocked;
    out.focus = parallax.focus.toArray().map(v => +v.toFixed(1));
    const t0 = targetTheta;
    parallax.last -= 1;                          // pretend a second passed
    parallaxTick();
    out.drifted = Math.abs(targetTheta - t0) > 0.01;
    out.stillPointingAtTheGathering = camTarget.distanceTo(parallax.focus) < 1;
    // it yields to a glide
    const t1 = targetTheta;
    approach.active = true;
    parallax.last -= 1; parallaxTick();
    out.yieldsToAGlide = targetTheta === t1 && parallax.blocked;
    approach.active = false;
    // it re-bases on whatever the glide left us looking at, not on a
    // subject chosen in advance
    camTarget.set(-26, 3.2, 0); camTheta = 2.0; camRadius = 22;
    parallaxTick();
    out.rebasesOnTheNewView = Math.abs(parallax.base - 2.0) < 1e-6 &&
                              Math.abs(parallax.focus.x + 26) < 0.01;
    // the first touch hands it back — and it does not retake it
    parallaxRelease();
    const t2 = targetTheta;
    parallax.last -= 1; parallaxTick(); parallax.last -= 1; parallaxTick();
    out.releasedStaysReleased = parallax.released && targetTheta === t2;
    // …but a talk's shield means a stray hand never takes it
    parallax.released = false; threshold.showing = true;
    parallaxRelease();
    out.aTalkKeepsIt = !parallax.released;
    threshold.showing = false;
    // it drives the orbit variables, never the camera
    out.driversOnly = true;
    return out;
  });
  check('it re-bases on the bearing it inherited', par.rebased);
  check('…and on whatever you are looking at', par.stillPointingAtTheGathering, JSON.stringify(par.focus));
  check('it drifts', par.drifted);
  check('it yields to a glide', par.yieldsToAGlide);
  check('after a cue it parallaxes around the CUE, not the gathering', par.rebasesOnTheNewView);
  check('the first touch hands the camera back, for good', par.releasedStaysReleased);
  check('a talk keeps the camera — the shield means no hand reached the canvas', par.aTalkKeepsIt);

  const anyGathering = await p.evaluate(() => {
    parallaxEnd();
    gatherDisperse();
    gather(['y2k', 'houston'], 'plaza');          // not an address. an ordinary meet-up.
    const on = parallax.active;
    const flew = approach.active;
    gatherDisperse();
    return { on, flew, off: !parallax.active };
  });
  check('an ordinary gathering parallaxes too', anyGathering.on);
  check('…without flying you to it', !anyGathering.flew);
  check('and dispersing stops the drift', anyGathering.off);

  // ── ORBIT, THE LOCK, AND THE DRAFT ─────────────────────────────────────
  console.log('\n── the camera during a talk ──');
  const cam = await p.evaluate((LONG) => {
    const out = {};
    out.offAtDefault = orbitKilled === true;
    out.buttonAgrees = document.getElementById('orbit-btn').textContent === 'Orbit: Off';
    __mk(null, LONG);
    openThreshold(feedState.entries[0], { rewatch: true });
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
    flyoverStop();
    out.locked = followAnimal.key === 'ted';
    out.orbiting = autoOrbit === true && addressOrbitHeld === true;
    out.parallaxStoodDown = parallax.active === false;
    out.cardStayedShut = !document.getElementById('follow-card').classList.contains('open');
    // the user zooms and pans: the orbit variables are theirs…
    targetRadius = 44; targetTheta = 2.2; targetPhi = 0.7;
    approach.active = false;
    for (let i = 0; i < 200; i++) updateCamera();
    const d = camTarget.distanceTo(tedTurner.position);
    out.centreHeldOnTed = d < 1.6;
    out.zoomObeyed = Math.abs(camRadius - 44) < 4;
    out.panObeyed = Math.abs(camTheta - 2.2) < 0.15;
    // …and a cue does not break the lock
    addressApplyCue('library');
    out.cueKeepsTheLock = followAnimal.key === 'ted' && approach.active;
    // the draft, 30s in
    out.delay = ADDRESS_DRAFT_DELAY;
    out.traceExists = !!(typeof PrismTraces !== 'undefined' && PrismTraces.get(ADDRESS_DRAFT_TRACE));
    out.traceLabel = out.traceExists ? PrismTraces.get(ADDRESS_DRAFT_TRACE).label : null;
    out.scheduled = true;
    const before = parchState.loadedTraceData ? parchState.loadedTraceData.id : null;
    addressShowDraft();
    out.after = parchState.loadedTraceData ? parchState.loadedTraceData.id : null;
    out.graphmapOn = graphmapVisible;
    out.storyBuilt = g4State.story.steps.length > 0;
    out.before = before;
    // and letting go gives the camera back
    endThreshold();
    out.releasedLock = followAnimal.key !== 'ted';
    out.orbitStopped = autoOrbit === false && addressOrbitHeld === false;
    return out;
  }, LONG);
  check('orbit is off at default', cam.offAtDefault);
  check('…and the button says so', cam.buttonAgrees);
  check('a talk locks the centre on Ted', cam.locked);
  check('…and orbits anyway, with orbit switched off', cam.orbiting);
  check('…with the follow card left shut', cam.cardStayedShut);
  check('the parallax pendulum stands down — one hand on the wheel', cam.parallaxStoodDown);
  check('you can zoom out', cam.zoomObeyed, 'radius ' + Math.round(cam.zoomObeyed));
  check('you can pan', cam.panObeyed);
  check('…and the centre never leaves him', cam.centreHeldOnTed);
  check('a cue outranks the lock without breaking it', cam.cueKeepsTheLock);
  check('the Iran draft is a trace the villa already carries', cam.traceExists, cam.traceLabel);
  check('…it comes up 30 seconds in', cam.delay === 30000);
  check('…on the graphmap and the easel', cam.after === 'TS01' && cam.graphmapOn,
        (cam.before || 'nothing') + ' → ' + cam.after);
  check('…and it builds its story', cam.storyBuilt);
  check('ending the talk gives the camera back', cam.releasedLock && cam.orbitStopped);

  // ── AND NOBODY AT HIS SHOULDER ─────────────────────────────────────────
  const shoulder = await p.evaluate((LONG) => {
    __mk(null, LONG);
    openThreshold(feedState.entries[0], { rewatch: true });
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
    flyoverStop();
    const rows = Object.keys(gatherState.members).map(k => ({
      k, d: +Math.hypot(gatherState.members[k].seat.x - TED_MARK.x,
                        gatherState.members[k].seat.z - TED_MARK.z).toFixed(1),
    })).sort((a, b) => a.d - b.d);
    return { nearest: rows[0], trout: rows.find(r => r.k === 'trout'), rows: rows.slice(0, 4) };
  }, LONG);
  check('nobody is seated at the speaker\'s shoulder',
        shoulder.nearest.d > 4, 'nearest is ' + shoulder.nearest.k + ' at ' + shoulder.nearest.d);
  check('and the fish is not the deuteragonist',
        shoulder.trout.d > 5.5, 'trout at ' + shoulder.trout.d + '; front row: ' +
        shoulder.rows.map(r => r.k + ' ' + r.d).join(', '));

  // ── PHOTOGRAPHS ────────────────────────────────────────────────────────
  console.log('\n── photographs ──');
  await p.evaluate((LONG) => {
    __mk(null, LONG);
    openThreshold(feedState.entries[0], {});
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
  }, LONG);
  await p.waitForTimeout(30000);                 // let the procession actually climb
  await p.evaluate(() => { __crank(900, 3000); });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: '/home/claude/dg/shot_flyover.png' });

  // The [[house]] shot, framed by the villa rather than by the test.
  await p.evaluate(() => { flyoverStop(); parallaxEnd(); addressApplyCue('house'); });
  await p.waitForTimeout(9000);
  await p.screenshot({ path: '/home/claude/dg/shot_house.png' });
  // And the last leg of the fly-over: the speaker on his step.
  await p.evaluate(() => {
    const leg = ADDRESS_FLYOVER[ADDRESS_FLYOVER.length - 1];
    cameraGlide(leg.look, leg.off, 2);
  });
  await p.waitForTimeout(8000);
  await p.screenshot({ path: '/home/claude/dg/shot_step.png' });

  const arrived = await p.evaluate(() => {
    const ks = Object.keys(gatherState.members);
    const near = ks.filter(k => {
      const a = AVATARS[k] && AVATARS[k]();
      return a && a.visible && a.position.distanceTo(gatherState.members[k].seat) < 10;
    });
    return { n: near.length, total: ks.length,
             legs: ks.map(k => k + ':' + gatherState.members[k].leg).join(' ') };
  });
  console.log('  · ' + arrived.n + ' of ' + arrived.total + ' had reached their seat after 30s of sandbox time');
  console.log('  · legs: ' + arrived.legs);

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + '   ' + (f.detail || ''))); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
