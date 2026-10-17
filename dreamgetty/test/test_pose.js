// The sandbox renders at ~1 fps on software GL, so anything measured by
// WAITING measures the harness, not the villa (Residents Pipeline §2.8:
// "assert state, not motion"). This drives the frame clock by hand.
const { chromium } = require('/home/claude/dg/node_modules/playwright');

const CHECKS = [];
function check(name, ok, detail) {
  CHECKS.push({ name, ok: !!ok, detail });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail !== undefined ? '   ' + detail : ''));
}

const LONG = 'Hello, and welcome to the Dream Getty. My name is Ted Turner and I am the docent here. '
  + '[[house]] Everyone you see gathered here lives in this villa. '
  + '[[library]] Behind me, past the west court, is the library. '
  + '[[mountain]] North of us the ground climbs to the peak. '
  + '[[exedra]] And on the east side, the exedra. '
  + '[[ted]] That is the whole house. Go anywhere you like.';

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + '\n      ' + (e.stack||'')));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(7000);

  // Install the measuring tape and a hand-cranked frame clock.
  await p.evaluate(() => {
    window.__hindClearance = function () {
      tedTurner.updateMatrixWorld(true);
      let lo = Infinity;
      const v = new THREE.Vector3();
      [2, 3].forEach(i => {
        tedTurner.userData.legs[i].group.traverse(o => {
          if (!o.isMesh) return;
          const pos = o.geometry.attributes.position;
          for (let k = 0; k < pos.count; k++) {
            v.fromBufferAttribute(pos, k); o.localToWorld(v);
            if (v.y < lo) lo = v.y;
          }
        });
      });
      return lo - getTedHeight(tedTurner.position.x, tedTurner.position.z);
    };
    window.__lowestVertex = function () {
      tedTurner.updateMatrixWorld(true);
      let lo = Infinity;
      const v = new THREE.Vector3();
      tedTurner.traverse(o => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k); o.localToWorld(v);
          if (v.y < lo) lo = v.y;
        }
      });
      return lo - getTedHeight(tedTurner.position.x, tedTurner.position.z);
    };
    window.__crank = function (frames, t0) {
      let t = t0 || 0;
      for (let i = 0; i < frames; i++) { t += 1 / 60; updateTedAddress(t); }
      return t;
    };
    window.__mkFeed = function (text) {
      feedState.entries = [{
        id: 'intro', author: 'ted', kind: 'address', text: text,
        t: '2026-08-09T00:00:00.000Z', pos: [0, 0, 0], place: 'the galleria', replyTo: null, to: null,
      }];
      localStorage.removeItem('dg_heard_talks'); localStorage.removeItem('dg_heard_address');
      heardTalks.clear();
    };
  });

  // ── THE REAR, CRANKED BY HAND ──────────────────────────────────────────
  console.log('\n── ted rears (frame clock driven) ──');
  const rear = await p.evaluate((LONG) => {
    __mkFeed(LONG);
    // Take the baseline from a CLEAN stand. Read straight off the patrol it
    // is whatever the gait cycle happens to be doing to his paws that frame,
    // which swung this measurement by 28mm between runs and failed a check
    // that was measuring the walk, not the rear.
    tedTurner.rotation.set(0, 0, 0);
    (tedTurner.userData.legs || []).forEach(function (l, i) {
      l.group.rotation.x = 0; l.group.position.copy(TED_LEG_REST[i]);
    });
    tedTurner.position.y = getTedHeight(tedTurner.position.x, tedTurner.position.z);
    const standing = { hind: __hindClearance(), low: __lowestVertex() };
    openThreshold(feedState.entries[0], { rewatch: true });
    addressPlay.ended = true;                 // freeze the script; the POSE is the subject here
    if (addressPlay.timer) clearTimeout(addressPlay.timer);
    let t = __crank(600, 100);                // ten seconds of 60fps in one go
    const walked = tedTurner.position.clone();
    return {
      standing, t,
      theta: TED_REAR.now, arrived: TED_REAR.arrived,
      hind: __hindClearance(), low: __lowestVertex(),
      pitch: tedTurner.rotation.x,
      onMark: walked.distanceTo(TED_REAR.mark) < 1.2,
      headY: (function () {
        tedTurner.updateMatrixWorld(true);
        const v = new THREE.Vector3(); let hi = -Infinity;
        tedTurner.traverse(o => {
          if (!o.isMesh) return;
          const pos = o.geometry.attributes.position;
          for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k); o.localToWorld(v); if (v.y > hi) hi = v.y; }
        });
        return hi - getTedHeight(tedTurner.position.x, tedTurner.position.z);
      })(),
    };
  }, LONG);
  check('he walks to the mark rather than teleporting', rear.arrived && rear.onMark);
  check('he gets all the way up', rear.theta > 1.05,
        'θ = ' + rear.theta.toFixed(3) + ' rad (' + (rear.theta * 57.3).toFixed(0) + '°)');
  check('the hind paws stay planted — measured, not tuned, no correction applied',
        Math.abs(rear.hind - rear.standing.hind) < 0.002,
        'standing ' + rear.standing.hind.toFixed(4) + ' → reared ' + rear.hind.toFixed(4));
  check('nothing of him goes below the floor', rear.low > -0.01,
        'lowest vertex ' + rear.low.toFixed(4));
  check('he is visibly taller on two legs', rear.headY > rear.standing.low + 1.35,
        'crown at ' + rear.headY.toFixed(2) + ' (standing on four: ' + rear.standing.hind.toFixed(2) + ' at the paw)');

  // the euler fix, at the angle that would have rolled him
  //
  // up.y is a USELESS probe here and it took a failing run to see why: at
  // yaw 90° with the old 'XYZ' order the composition is Rx·Ry, and Ry does
  // not move the y-axis at all — so both orders report the same up vector
  // while one of them has him lying on his side. The honest probes are the
  // NOSE (does it rise?) and the SIDE axis (does it tilt? that is roll).
  const yaw = await p.evaluate(() => {
    const probe = () => {
      tedTurner.updateMatrixWorld(true);
      const q = tedTurner.quaternion;
      return {
        nose: +new THREE.Vector3(0, 0, 1).applyQuaternion(q).y.toFixed(3),
        roll: +new THREE.Vector3(1, 0, 0).applyQuaternion(q).y.toFixed(3),
        hind: +__hindClearance().toFixed(4),
      };
    };
    const out = { want: +Math.sin(TED_REAR.now).toFixed(3), at: [] };
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(function (y) {
      TED_REAR.faceYaw = y; tedTurner.rotation.y = y; tedRearApply(TED_REAR.now);
      out.at.push(probe());
    });
    tedTurner.rotation.order = 'XYZ';
    tedTurner.rotation.y = Math.PI / 2; tedRearApply(TED_REAR.now);
    out.oldOrder = probe();
    tedTurner.rotation.order = 'YXZ';
    tedTurner.rotation.y = 0; TED_REAR.faceYaw = 0; tedRearApply(TED_REAR.now);
    return out;
  });
  check('his nose rises by the same angle at every facing',
        yaw.at.every(a => Math.abs(a.nose - yaw.want) < 0.02),
        yaw.at.map(a => a.nose).join(' · ') + '  (want ' + yaw.want + ')');
  check('and he never rolls',
        yaw.at.every(a => Math.abs(a.roll) < 0.03), yaw.at.map(a => a.roll).join(' · '));
  check('paws planted at every facing',
        yaw.at.every(a => Math.abs(a.hind) < 0.015), yaw.at.map(a => a.hind).join(' · '));
  check('…and the OLD euler order would have laid him on his side at yaw 90°',
        Math.abs(yaw.oldOrder.roll) > 0.6 && Math.abs(yaw.oldOrder.nose) < 0.05,
        'nose ' + yaw.oldOrder.nose + ' (want ' + yaw.want + '), roll ' + yaw.oldOrder.roll);

  // ── THE RELEASE ────────────────────────────────────────────────────────
  console.log('\n── letting go ──');
  const rel = await p.evaluate(() => {
    tedRearRelease();
    __crank(900, 500);
    return {
      off: !TED_REAR.active,
      pitch: +tedTurner.rotation.x.toFixed(5), roll: +tedTurner.rotation.z.toFixed(5),
      legs: (tedTurner.userData.legs || []).map(l => +l.group.rotation.x.toFixed(4)),
      tail: (tedTurner.userData.tailMeshes || []).map(m => +m.rotation.x.toFixed(4)),
      head: +tedHeadGroup.rotation.x.toFixed(3),
      patrol: tedPatrol.state,
      clearance: +__lowestVertex().toFixed(4),
    };
  });
  check('he comes back down', rel.off && Math.abs(rel.pitch) < 1e-4, 'pitch ' + rel.pitch);
  check('no roll left behind', Math.abs(rel.roll) < 1e-4);
  check('legs, tail and head all reset', rel.legs.every(v => v === 0) && rel.tail.every(v => v === 0) && Math.abs(rel.head + 0.05) < 0.001,
        'legs ' + JSON.stringify(rel.legs) + ' tail ' + JSON.stringify(rel.tail) + ' head ' + rel.head);
  check('the patrol has him again', rel.patrol === 'pausing', rel.patrol);
  check('and he is standing on the floor', Math.abs(rel.clearance) < 0.02, rel.clearance);

  // ── THE GATHERING, CHECKED THE INSTANT IT IS CALLED ────────────────────
  console.log('\n── the gathering ──');
  const g = await p.evaluate((LONG) => {
    __mkFeed(LONG);
    openThreshold(feedState.entries[0], { rewatch: true });
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
    const keys = Object.keys(gatherState.members);
    const before = gatherState.held;
    // the camera goes to the mountain, 88 units off, for a whole sentence
    camTarget.set(-4, 44, -76);
    for (let i = 0; i < 5; i++) gatherTick(clock.getElapsedTime() + i * 5);
    const heldAway = gatherState.hostAway;
    const stillActive = gatherState.active;
    // and now the talk ends — the host rule comes back
    addressStop();
    gatherTick(clock.getElapsedTime() + 100);
    const releasedAway = gatherState.hostAway;
    return { keys, before, heldAway, stillActive, releasedAway };
  }, LONG);
  check('the gathering is held for the duration of a talk', g.before === true);
  check('the camera at the peak does NOT break it up', g.heldAway === 0 && g.stillActive,
        'hostAway ' + g.heldAway);
  check('…and the host rule returns the moment the talk ends', g.releasedAway !== 0);
  check('the whole cast, minus the one who sleeps', g.keys.length === 16 && !g.keys.includes('raven'),
        g.keys.length + ': ' + g.keys.join(' '));

  // ── THE CAPTION, MEASURED WHILE IT IS OPEN ─────────────────────────────
  console.log('\n── the caption band ──');
  const cap = await p.evaluate((LONG) => {
    __mkFeed(LONG);
    openThreshold(feedState.entries[0], {});
    const th = document.getElementById('threshold');
    const inner = document.getElementById('th-inner');
    const txt = document.getElementById('th-text');
    const cs = getComputedStyle(th);
    const vh = window.innerHeight;
    const r = inner.getBoundingClientRect();
    return {
      inset: cs.inset, pos: cs.position, pointerEvents: cs.pointerEvents,
      skipClickable: getComputedStyle(document.getElementById('th-skip')).pointerEvents,
      font: getComputedStyle(txt).fontSize,
      colWidth: Math.round(r.width),
      bandTop: +(1 - r.top / vh).toFixed(3),      // fraction of the screen it occupies
      shown: txt.textContent, whole: LONG.length,
      segs: addressPlay.segs.length,
    };
  }, LONG);
  check('the scrim still covers the viewport', cap.pos === 'fixed' && cap.inset === '0px', cap.inset);
  check('…but no longer eats the pointer — drag and wheel reach the canvas',
        cap.pointerEvents === 'none', cap.pointerEvents);
  check('…and the skip button is still clickable through it',
        cap.skipClickable === 'auto', cap.skipClickable);
  check('quieter type', cap.font === '15px', cap.font);
  check('a narrower column', cap.colWidth <= 560, cap.colWidth + 'px');
  check('the band occupies the bottom sliver only', cap.bandTop < 0.16,
        (cap.bandTop * 100).toFixed(1) + '% of the viewport height');
  check('one line on screen, not the speech', cap.shown.length < cap.whole / 3,
        cap.shown.length + ' of ' + cap.whole + ' chars, in ' + cap.segs + ' segments');

  // ── A PHOTOGRAPH, because 0 pageerrors has never caught a bad model ────
  console.log('\n── photographs ──');
  await p.evaluate(() => {
    addressPlay.ended = true; if (addressPlay.timer) clearTimeout(addressPlay.timer);
    __crank(900, 900);                              // Ted up on his hind legs
  });
  await p.waitForTimeout(22000);                     // let the cast actually travel
  // WHAT A VISITOR ACTUALLY SEES: the opening shot the address itself calls
  // for, not a camera the test placed by hand.
  await p.evaluate(() => { __crank(300, 2000); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/dg/shot_opening.png' });
  await p.evaluate(() => {
    __crank(60, 2600);
    // a three-quarter view of the speaker and the front rank
    const o = placePoint('galleria');
    camera.position.set(o.x + 7.5, 4.2, o.z + 13.5);
    camTarget.set(o.x, 1.9, o.z + 1.0);
    camera.lookAt(camTarget);
    approach.active = false;
  });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: '/home/claude/dg/shot_gathering.png' });

  await p.evaluate(() => {
    const t = tedTurner.position;
    camera.position.set(t.x + 2.2, t.y + 1.5, t.z + 3.6);
    camTarget.set(t.x, t.y + 1.0, t.z);
    camera.lookAt(camTarget);
    document.getElementById('threshold').classList.remove('open');
  });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/dg/shot_ted_reared.png' });

  const near = await p.evaluate(() => {
    const o = placePoint('galleria');
    const arrived = Object.keys(gatherState.members).filter(k => {
      const a = AVATARS[k] && AVATARS[k]();
      return a && a.visible && a.position.distanceTo(gatherState.members[k].at) < 9;
    });
    return { arrived: arrived.length, total: Object.keys(gatherState.members).length, who: arrived };
  });
  console.log('  · ' + near.arrived + ' of ' + near.total + ' had reached the galleria after 25s of sandbox time');

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 8).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + '  ' + (f.detail || ''))); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
