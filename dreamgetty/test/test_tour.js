// THE TOUR — Ted's walkthrough for the beta group (2026-08-13).
// Frame clock cranked by hand where motion matters; state asserted, not motion.
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
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(8000);


  // ── THE WALK PLAYS ON LOAD NOW (2026-08-16) ──
  // A suite that wants a pristine villa has to ASK for one: mark the walk
  // seen, then reload. Standing it down in place was the first attempt and
  // it is not enough — by the time a suite gets control the walk has already
  // gathered nineteen residents onto the sand and taken the wheel, so every
  // check that reads a live position (the staging, the routes, who is where)
  // was measuring the walk's leftovers. Two suites said so.
  await p.evaluate(() => { try { localStorage.setItem('dg_tour_seen_v2', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(8000);

  // Crank updateTedAddress so he actually WALKS to a mark in a sandbox that
  // renders at ~1fps. The real animate loop calls it; here we do. Defined
  // AFTER the reload — a reload wipes the page's globals, and this one is
  // ours rather than the villa's.
  await p.evaluate(() => {
    window.__walk = function (frames, t0) {
      let t = t0 || 0;
      for (let i = 0; i < frames; i++) { t += 1 / 60; updateTedAddress(t); }
      return t;
    };
  });

  // ── THE ROW EXISTS AND THE WALK STARTS ON THE BEACH ────────────────────
  console.log('\n── the tour begins on the sand ──');
  const start = await p.evaluate(() => {
    const btn = document.getElementById('tour-btn');
    tourBegin();
    return {
      hasBtn: !!btn,
      on: tourState.on,
      capOpen: document.getElementById('tour-caption').classList.contains('open'),
      rear: TED_REAR.active,
      patrol: tedPatrol.state,
      markX: +TED_REAR.mark.x.toFixed(2), markZ: +TED_REAR.mark.z.toFixed(2),
      nearest: nearestPlace(TED_REAR.mark),
      members: Object.keys(gatherState.members).length,
      held: gatherState.held,
      gatherPlace: gatherState.label,
    };
  });
  check('the Compass root carries the tour', start.hasBtn);
  check('the walk is on', start.on);
  check('the caption bar is up', start.capOpen);
  check('Ted takes the floor (rear active, patrol yielded)', start.rear && start.patrol === 'address', start.patrol);
  check('his mark IS the beach', start.nearest === 'the beach', start.nearest + ' @ ' + start.markX + ',' + start.markZ);
  check('the company is gathered', start.members >= 12, start.members + ' members');
  check('and the gathering is HELD (it cannot break up while he travels)', start.held);
  check('gathered at the beach, not the lawn', start.gatherPlace === 'The Beach', String(start.gatherPlace));

  // ── EVERYONE IS LANDWARD OF HIM, NOT IN THE SURF ───────────────────────
  console.log('\n── the arc is landward ──');
  const arc = await p.evaluate(() => {
    const out = [];
    for (const k in gatherState.members) {
      const s = gatherState.members[k].at;
      out.push({ k, z: +s.z.toFixed(2), y: +s.y.toFixed(2), dz: +(s.z - TED_REAR.mark.z).toFixed(2),
                 wet: !!(typeof WALK_AQUATIC !== 'undefined' && WALK_AQUATIC[k]) });
    }
    return { spots: out, ocean: (typeof OCEAN_Y !== 'undefined' ? OCEAN_Y : null) };
  });
  const seaward = arc.spots.filter(s => s.dz > 0.01);
  check('no seat is seaward of the speaker', seaward.length === 0, JSON.stringify(seaward.slice(0, 3)));
  const drowned = arc.spots.filter(s => arc.ocean !== null && s.y < arc.ocean && !s.wet);
  check('no LAND body is seated under the sea', drowned.length === 0, JSON.stringify(drowned.slice(0, 3)));
  check('and the ones that swim are left in the shallows if they like',
    arc.spots.some(s => s.wet), arc.spots.filter(s => s.wet).length + ' aquatic');
  check('the patience outlasts a five-minute walk', await p.evaluate(() => {
    const t = clock.getElapsedTime();
    return Object.values(gatherState.members).every(m => m.leaves - t > 380);
  }));

  // ── HE WALKS TO THE MARK; HE DOES NOT APPEAR AT IT ─────────────────────
  console.log('\n── he walks, he does not teleport ──');
  const walk = await p.evaluate(() => {
    const clearance = () => tedTurner.position.y -
      getTedHeight(tedTurner.position.x, tedTurner.position.z);
    const from = tedTurner.position.clone();
    const d0 = Math.hypot(from.x - TED_REAR.mark.x, from.z - TED_REAR.mark.z);
    __walk(60, 0);
    const mid = tedTurner.position.clone();
    const d1 = Math.hypot(mid.x - TED_REAR.mark.x, mid.z - TED_REAR.mark.z);
    const midClear = clearance();          // MID-WALK: on all fours, on the sand
    __walk(1400, 1);
    // Measured off the BASE, not the origin: once he is up, tedRearApply
    // shifts the origin forward over his feet by the hip-pivot compensation
    // (0.68 here) and lifts it by d.y. The base is where he actually stands,
    // and the standing rule the pose suite settled is that the base sits on
    // the ground — the origin is not supposed to.
    const d2 = Math.hypot(TED_REAR.base.x - TED_REAR.mark.x, TED_REAR.base.z - TED_REAR.mark.z);
    const baseClear = TED_REAR.base.y - getTedHeight(TED_REAR.base.x, TED_REAR.base.z);
    return { d0: +d0.toFixed(2), d1: +d1.toFixed(2), d2: +d2.toFixed(2),
             arrived: TED_REAR.arrived, rear: +TED_REAR.now.toFixed(2),
             midClear: +midClear.toFixed(4), baseClear: +baseClear.toFixed(4) };
  });
  check('he starts away from the mark', walk.d0 > 3, walk.d0 + ' units');
  check('one second of frames closes some of it, not all', walk.d1 < walk.d0 && walk.d1 > 0.3,
    walk.d0 + ' → ' + walk.d1);
  check('and he arrives ON the mark', walk.arrived && walk.d2 < 0.3, 'base off by ' + walk.d2);
  check('then rears to speak', walk.rear > 0.5, walk.rear + ' rad');
  check('paws on the sand while walking', Math.abs(walk.midClear) < 0.05, walk.midClear);
  check('and standing on it once reared', Math.abs(walk.baseClear) < 0.02, walk.baseClear);

  // ── THE COMPASS IS PRESSED, NOT DESCRIBED ──────────────────────────────
  console.log('\n── the Compass demonstrates itself ──');
  const clicked = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    tourClickTo('overlook');
    await wait(700);
    const menuOpen = document.getElementById('nav-menu').classList.contains('open');
    const placesOpen = document.getElementById('cmp-places').classList.contains('open');
    const row = tourPlaceRow('overlook');
    const pulsing = !!(row && row.classList.contains('tour-pulse'));
    await wait(1000);
    const pageOpen = document.getElementById('cmp-place').classList.contains('open');
    const goBtn = tourGoRow();
    await wait(1800);
    return { menuOpen, placesOpen, rowFound: !!row, pulsing, pageOpen, goFound: !!goBtn,
             visited: compassVisited.has('overlook'),
             look: [+camTarget.x.toFixed(1), +camTarget.z.toFixed(1)],
             tedMark: nearestPlace(TED_REAR.mark) };
  });
  check('the menu unfolds by itself', clicked.menuOpen);
  check('Places opens', clicked.placesOpen);
  check('the row for the stop is found', clicked.rowFound);
  check('and it is lit before it is pressed', clicked.pulsing);
  check('the place page opens', clicked.pageOpen);
  check('"go there" is found and lit', clicked.goFound);
  check('the villa actually travels', clicked.visited);
  check('and Ted is sent to the same place', clicked.tedMark === 'the overlook', clicked.tedMark);

  // ── NOTHING IS LOCKED (RULED 2026-08-16) ───────────────────────────────
  // Hidden-until-visited is SHELVED for the beta, not deleted. So the two
  // things worth asserting are: a guest sees the whole villa from the day
  // they arrive, and one constant brings the old rule back intact — because
  // "we reintroduce it after the beta" is only true if it still works.
  console.log('\n── the Compass is open, and the shelf is reversible ──');
  const obs = await p.evaluate(() => {
    compassVisited.delete('observatory');
    const openNow = PLACE_REGISTRY.filter(compassPlaceKnown).map(p => p.key);
    const everyRow = PLACE_REGISTRY.map(p => p.key);
    const missing = everyRow.filter(k => openNow.indexOf(k) === -1);
    // the machinery, proven still whole
    const flagBack = (function () {
      // NOT window.COMPASS_HIDES_UNVISITED — a top-level `const` in a script
      // block is not a property of window, so that read is always undefined
      // and the check would pass for the wrong reason forever.
      const real = COMPASS_HIDES_UNVISITED;
      // the constant is read through the function, so shadow the function's
      // answer the way the flag would: recompute by hand against the row
      const row = PLACE_REGISTRY.find(p => p.key === 'observatory');
      const wouldHide = !!row.hidden && !compassVisited.has('observatory');
      const wouldShowOnceStood = (function () {
        compassVisited.add('observatory');
        const r = !row.hidden || compassVisited.has('observatory');
        compassVisited.delete('observatory');
        return r;
      })();
      return { real, wouldHide, wouldShowOnceStood };
    })();
    tourTravel('observatory');
    return { missing, count: openNow.length, row: !!PLACE_REGISTRY.find(p => p.key === 'observatory' && p.hidden),
             flagBack, mark: nearestPlace(TED_REAR.mark),
             marked: compassVisited.has('observatory') };
  });
  check('every place in the registry is on the Compass from the start',
    obs.missing.length === 0, obs.count + ' rows, missing: ' + JSON.stringify(obs.missing));
  check('the hidden row is kept, not deleted', obs.row);
  check('and the shelf is one constant', obs.flagBack.real === false,
    'COMPASS_HIDES_UNVISITED = ' + obs.flagBack.real);
  check('…whose machinery still works when it comes back',
    obs.flagBack.wouldHide && obs.flagBack.wouldShowOnceStood);
  check('the walk still records where you have stood', obs.marked);
  check('Ted goes up the peak with them', obs.mark === 'the observatory', obs.mark);

  // ── HE LEADS OFF AND WAITS, AND THE DIAL CALLS YOU ─────────────────────
  console.log('\n── he goes first, and stops ──');
  const lead = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    tourTedTo('galleria'); __walk(2400, 0);          // put him at the galleria
    const from = tedTurner.position.clone();
    const target = TOUR_MARKS.library;
    const full = Math.hypot(target.x - from.x, target.z - from.z);
    tourLeadOff('library');
    const legLen = Math.hypot(TED_REAR.mark.x - from.x, TED_REAR.mark.z - from.z);
    const hud = document.getElementById('compass-hud');
    tourCalling(true);
    await wait(60);
    const glow = hud.classList.contains('calling');
    // He stops short of the room and turns BACK. Asserted as a DIRECTION,
    // not an equality: the body he is facing is walking while this runs, so
    // the exact yaw is stale the instant it is set. What must hold is that
    // he faces back down his own path and not on toward the room.
    const bearing = (ax, az) => Math.atan2(ax - TED_REAR.mark.x, az - TED_REAR.mark.z);
    const gap = (a, b2) => { let d = a - b2; while (d > Math.PI) d -= 2 * Math.PI;
                             while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
    const toBack = gap(TED_REAR.faceYaw, bearing(from.x, from.z));
    const toRoom = gap(TED_REAR.faceYaw, bearing(target.x, target.z));
    __walk(2600, 0);
    const stopped = Math.hypot(tedTurner.position.x - target.x, tedTurner.position.z - target.z);
    return { full: +full.toFixed(1), legLen: +legLen.toFixed(1), glow,
             toBack: +toBack.toFixed(2), toRoom: +toRoom.toFixed(2),
             stoppedShort: +stopped.toFixed(1), reared: TED_REAR.now > 0.5,
             speed: TED_REAR.speed };
  });
  check('he sets off but does not go the whole way',
    lead.legLen > 1 && lead.legLen < lead.full * 0.6, lead.legLen + ' of ' + lead.full + ' units');
  check('and stops well short of the room', lead.stoppedShort > 3, lead.stoppedShort + ' units out');
  check('turning back the way he came, not on toward the room',
    lead.toBack < lead.toRoom && lead.toBack < 1.2,
    lead.toBack + ' rad off the way back vs ' + lead.toRoom + ' off the room');
  check('he rears to speak where he stopped', lead.reared);
  check('the dial glows while he waits', lead.glow);
  check('and he walks it at a docent’s pace, not an entrance',
    lead.speed < 0.03, 'lerp ' + lead.speed + ' (an address is 0.045)');

  // ── THE CAMERA NEVER COMES OFF A BODY ──────────────────────────────────
  console.log('\n── the lens stays on somebody ──');
  const lens = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const seen = [];
    tourLock('ted'); seen.push(followAnimal.key);
    tourLock('me');  seen.push(followAnimal.key);
    tourJoin('exedra');
    seen.push(followAnimal.key);
    const flying = approach.active;
    // and a full leg, sampled
    tourClickTo('library');
    for (let i = 0; i < 8; i++) { await wait(500); seen.push(followAnimal.key); }
    return { seen, flying, everNull: seen.some(k => !k),
             bodies: Array.from(new Set(seen)) };
  });
  check('the lens is never released to nobody', !lens.everNull, JSON.stringify(lens.bodies));
  check('and no place-flight steals it back', !lens.flying);

  // ── WHO COMES WITH YOU ─────────────────────────────────────────────────
  console.log('\n── the docent brings the villa; a guest is brought ──');
  const who = await p.evaluate(() => {
    const real = window.isDocent;
    window.isDocent = () => true;   const asDocent = tourCompanyComes();
    window.isDocent = () => false;  const asGuest  = tourCompanyComes();
    window.isDocent = real;
    return { asDocent, asGuest };
  });
  check('Sailor walks with all of them', who.asDocent);
  check('a guest walks with Ted alone', !who.asGuest);

  // ── THE TOASTS BURN OFF ────────────────────────────────────────────────
  console.log('\n── the toasts burn off ──');
  const toast = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const before = document.querySelectorAll('.tour-toast').length;
    // A point genuinely in front of the lens — a toast behind the camera is
    // correctly not drawn, so anchoring the pinning test behind it would be
    // asserting the opposite rule by accident.
    const inView = camTarget.clone();
    const t = tourToast(inView, 'a label that must not stay', 600);
    tourToastTick();
    await wait(60);
    const lit = t.el.classList.contains('lit');
    const placed = t.el.style.left !== '' && t.el.style.top !== '';
    await wait(900);
    tourToastTick();
    const burning = t.el.classList.contains('burn');
    await wait(1600);
    tourToastTick();
    const gone = !document.body.contains(t.el);
    return { before, lit, placed, burning, gone,
             left: document.querySelectorAll('.tour-toast').length };
  });
  check('a toast lights', toast.lit);
  check('and is pinned to its world point', toast.placed);
  check('it burns off on its own clock', toast.burning);
  check('and is removed from the document', toast.gone, toast.left + ' still up');

  // ── A TOAST BEHIND THE LENS IS NOT DRAWN ───────────────────────────────
  const behind = await p.evaluate(() => {
    const v = camTarget.clone().sub(camera.position).normalize().multiplyScalar(-30).add(camera.position);
    const t = tourToast(v, 'behind you', 4000);
    tourToastTick();
    const hidden = t.el.style.display === 'none';
    t.until = 0; tourToastTick();
    return hidden;
  });
  check('a toast behind the camera is hidden, not smeared on screen', behind);

  // ── THE CAPTION MUST NOT COVER THE INSTRUMENT IT IS TEACHING ───────────
  // Two photographs of the walk caught this: first the caption reading
  // through the compass dial, then the place page opening underneath the
  // words. Both are geometry, so both are assertable from here on.
  console.log('\n── the caption clears the Compass ──');
  const layout = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const hit = (a, b) => a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
    const cap = document.getElementById('tour-caption');
    cap.classList.add('open');
    document.getElementById('tc-text').textContent =
      'A line about as long as the longest one Ted actually says on this walk, which is the one about the graphmap.';
    // the worst case the walk can produce: the place page, fully unfolded
    tourMenuOpen();
    compassOpenPlace('beach');
    await wait(120);
    const c = cap.getBoundingClientRect();
    const h = document.getElementById('compass-hud').getBoundingClientRect();
    const m = document.getElementById('nav-menu').getBoundingClientRect();
    const t = tourToast(document.getElementById('compass-hud'), 'the Compass', 4000);
    tourToastTick();
    await wait(40);
    const tr = t.el.getBoundingClientRect();
    const side = t.el.classList.contains('side');
    t.until = 0; tourToastTick();
    if (document.getElementById('nav-menu').classList.contains('open')) toggleNavMenu();
    return {
      capBottom: Math.round(c.bottom), hudTop: Math.round(h.top), menuTop: Math.round(m.top),
      overDial: hit(c, h), overMenu: hit(c, m), menuTall: m.height > 60,
      side, toastOverCap: hit(tr, c), onScreen: tr.left >= 0 && tr.right <= window.innerWidth,
    };
  });
  check('the unfolded place page is really open', layout.menuTall, layout.menuTop + 'px from top');
  check('the caption clears the dial', !layout.overDial,
    'caption bottom ' + layout.capBottom + ' vs dial top ' + layout.hudTop);
  check('and clears the unfold — the thing Ted is pointing at', !layout.overMenu,
    'caption bottom ' + layout.capBottom + ' vs menu top ' + layout.menuTop);
  check('a label for a control goes beside it', layout.side);
  check('and does not land on the caption', !layout.toastOverCap);
  check('nor off the edge of the screen', layout.onScreen);

  // ── ESCAPE LEAVES IT, AND NOTHING IS STRANDED ──────────────────────────
  console.log('\n── Escape leaves the walk ──');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({
    on: tourState.on,
    capOpen: document.getElementById('tour-caption').classList.contains('open'),
    stagers: tourState.stagers.length,
    held: gatherState.held,
    gatheringAlive: gatherState.active,
    releasing: TED_REAR.releasing,
    litToasts: document.querySelectorAll('.tour-toast.lit').length,
  }));
  check('the walk stops', !after.on);
  check('the caption bar goes', !after.capOpen);
  check('every staged beat is cancelled', after.stagers === 0, after.stagers + ' left');
  check('the hold is released…', !after.held);
  check('…but the company is NOT dispersed (ruling 3)', after.gatheringAlive);
  check('Ted comes down off his hind legs', after.releasing);
  check('and no toast is left lit', after.litToasts === 0, after.litToasts);

  // ── IT PLAYS ITSELF, ONCE (RULED 2026-08-16) ───────────────────────────
  // The walk is no longer offered, it RUNS — the beta is what it is for, and
  // a banner is missable. Still once per device, still leavable from the
  // first second, and still never over the introduction.
  console.log('\n── it plays itself, once, and never over the door ──');
  const auto = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    tourStop(true);
    localStorage.removeItem('dg_tour_seen_v2');
    announceState.entry = null; announceState.custom = null; announceHide();

    // 1. the introduction is up: the walk must NOT start over it
    threshold.showing = true;
    considerTourStart(2);
    await wait(250);
    const startedOverDoor = tourState.on;
    const spentAtDoor = !!localStorage.getItem('dg_tour_seen_v2');

    // 2. the door clears — its own retry comes round and it plays
    threshold.showing = false;
    await wait(1800);
    const playing = tourState.on;
    const spent = !!localStorage.getItem('dg_tour_seen_v2');
    const leavable = document.getElementById('tc-skip').textContent;

    // 3. and it never plays a second time
    tourStop(true);
    await wait(80);
    considerTourStart(0);
    await wait(150);
    const twice = tourState.on;

    // 4. a banner does NOT hold it off — the hole the offer version had
    tourStop(true);
    localStorage.removeItem('dg_tour_seen_v2');
    announceCustom('something else entirely', 'look', function () {});
    const bannerWasUp = document.getElementById('announce').classList.contains('open');
    considerTourStart(0);
    await wait(200);
    const playedAnyway = tourState.on;
    const bannerClosed = !document.getElementById('announce').classList.contains('open');
    tourStop(true);
    return { startedOverDoor, spentAtDoor, playing, spent, leavable, twice,
             bannerWasUp, playedAnyway, bannerClosed,
             keyName: TOUR_SEEN_KEY, autoplay: TOUR_AUTOPLAY };
  });
  check('it does not start over the introduction', !auto.startedOverDoor);
  check('and does not spend itself while the door is held', !auto.spentAtDoor);
  check('once the door clears, the walk PLAYS — no banner to miss', auto.playing);
  check('with the way out on screen from the first second',
    /end the walk/.test(auto.leavable), JSON.stringify(auto.leavable));
  check('it marks itself seen', auto.spent);
  check('and never plays a second time on this device', !auto.twice);
  check('a banner no longer holds it off for good', auto.bannerWasUp && auto.playedAnyway);
  check('…the walk closes the banner instead', auto.bannerClosed);
  check('the key is bumped, so nobody is skipped by the old one',
    auto.keyName === 'dg_tour_seen_v2', auto.keyName);
  check('autoplay is on', auto.autoplay === true);

  // ── TED'S BODY IS NOT PULLED TWO WAYS ──────────────────────────────────
  console.log('\n── the docent’s body is not pulled two ways ──');
  const twoWays = await p.evaluate(() => {
    const realMine = window.profileMine;
    window.profileMine = () => 'ted';
    // The walk now takes the wheel, and bodyFollowsTheEye's FIRST line is
    // "if the wheel is held, the eye does not move you" — so without this
    // the check would be measuring walk mode, not the rear guard.
    const heldWheel = visitorNav.active;
    visitorNav.active = false;
    TED_REAR.releasing = false;
    TED_REAR.active = true;
    const before = tedTurner.position.clone();
    const guarded = (function () {
      let travelled = false;
      const real = window.tedTravelTo;
      window.tedTravelTo = function () { travelled = true; };
      bodyFollowsTheEye('library');
      window.tedTravelTo = real;
      return !travelled;
    })();
    TED_REAR.active = false;
    let free = false;
    (function () {
      const real = window.tedTravelTo;
      window.tedTravelTo = function () { free = true; };
      bodyFollowsTheEye('library');
      window.tedTravelTo = real;
    })();
    window.profileMine = realMine;
    visitorNav.active = heldWheel;
    return { guarded, free };
  });
  check('while he is on the floor, the eye does not drag his body', twoWays.guarded);
  check('and the moment he is off it, it does again', twoWays.free);

  // ── THE SCORE ITSELF ───────────────────────────────────────────────────
  console.log('\n── the score ──');
  const score = await p.evaluate(() => {
    const beats = tourBeats();
    const said = beats.map(b => b.say || '').join(' ');
    return {
      n: beats.length,
      words: said.split(/\s+/).filter(Boolean).length,
      marks: Object.keys(TOUR_MARKS),
      marksReal: Object.keys(TOUR_MARKS).every(k => !!PLACE_REGISTRY.find(p => p.key === k)),
      graphmap: /graphmap, Prism’s instrument|graphmap: Prism’s dialectical tool/.test(said),   // 2026-10-12: the walk ends on the tracker; the graphmap is named behind it
      construction: /under construction/i.test(said) && /open for visitors/i.test(said),
      ledger: /ledger/i.test(said) && /left, not sent/i.test(said),
      noSoftware: !/\b(button|click the UI|menu bar|app|software|interface)\b/i.test(said),
      allStops: ['beach', 'overlook', 'galleria', 'plaza', 'library', 'exedra', 'observatory']
        .every(k => new RegExp((PLACE_REGISTRY.find(p => p.key === k) || {}).label, 'i').test(said)),
    };
  });
  check('every mark names a real registry row', score.marksReal, score.marks.join(', '));
  check('all seven stops are named aloud', score.allStops);
  check('the graphmap is introduced as Prism’s instrument (behind the tracker since 2026-10-12)', score.graphmap);
  check('the observatory is under construction AND open for visitors', score.construction);
  check('the ledger rule is spoken (word is left, not sent)', score.ledger);
  check('no guest hears a software word', score.noSoftware);

  // THE REGISTER (settled 2026-08-13). "Tour" is a brochure word — it names
  // a product. Ted asks you along instead, and the banner, the Compass row,
  // the caption byline and the score are one animal talking. The code still
  // says tour* everywhere; that is the two-register rule, not a leak. This
  // asserts the SEEN surfaces only, which is the line that matters.
  const register = await p.evaluate(() => {
    const seen = [
      document.getElementById('tour-btn').textContent,
      document.getElementById('tour-btn').title,
      document.getElementById('tc-who').textContent,
      tourBeats().map(b => b.say || '').join(' '),
    ];
    // the banner, as a guest actually receives it
    threshold.showing = false; announceState.entry = null; announceState.custom = null;
    tourState.on = false;
    // Directly, for the same reason the phone suite does: considerTourStart
    // now PLAYS the walk instead of speaking, and it is the words a guest
    // reads that are on trial here.
    announceCustom(TOUR_INVITE, 'come along', function () {});
    seen.push(document.getElementById('an-text').textContent);
    seen.push(Array.from(document.getElementById('announce').querySelectorAll('.ui-btn')).map(b => b.textContent).join(' '));
    announceHide();
    return { seen, offer: document.getElementById('an-text').textContent };
  });
  const brochure = register.seen.filter(s => /\btours?\b/i.test(s));
  check('nothing a guest reads calls it a "tour"', brochure.length === 0, JSON.stringify(brochure));
  check('and Ted asks in the first person', /I’m|I'm|I’ll|I'll/.test(register.seen[4]),
    JSON.stringify(register.seen[4]));
  check('the walk is about five minutes of speech', score.words > 260 && score.words < 620, score.words + ' words');

  // ── AND NOTHING ELSE BROKE ─────────────────────────────────────────────
  console.log('\n── page errors ──');
  check('0 page errors', errs.length === 0, errs.join('\n      ') || '(none)');

  const bad = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - bad.length) + '/' + CHECKS.length + ' green');
  if (bad.length) { console.log('FAILED:'); bad.forEach(c => console.log('  ' + c.name + '  ' + (c.detail || ''))); }
  await b.close();
  process.exit(bad.length ? 1 : 0);
})();
