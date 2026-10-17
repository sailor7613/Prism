// THE PUBLIC DOOR (2026-10-12) — Ted leads, Ted is directable, the tracker on
// the pedestal, a resident by email. State asserted, not motion.
//
// The tracker reads ../../Prism/data/active/{active,settlement}.json, so for
// the pedestal checks to pass the villa has to be served from the WORKSPACE
// root (both repos reachable): python3 -m http.server 8899 from PARALLELOGRAM
// PRISM/, then DG_URL=http://localhost:8899/DreamGetty/dreamgetty/index.html.
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
  // a pristine villa, the walk stood down so the room is measurable
  await p.goto(process.env.DG_URL || 'http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('dg_tour_seen_v2', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(9000);

  console.log('\n── the pedestal ──');
  await p.waitForTimeout(2000);
  const ped = await p.evaluate(() => ({
    mode: pedestalMode, globe: trackerGlobe.visible, graph: graphmapVisible, built: trackerRig.built, rules: !!(trackerRules && trackerRules.rules.length),
    data: !!trackerData, months: trackerData ? trackerData.months.length : 0, routes: trackerRig.routes.length, nodes: Object.keys(trackerRig.nodes).length, acc: trackerRig.accrualLines.length,
    now: trackerData ? trackerData.now : null, ago: trackerData ? trackerData.ago : null, verdict: trackerVerdict(trackerData).word,
    month: trackerRig.month, nowIndex: trackerData && trackerData.nowIndex, sphere: !!trackerRig.sphere, focus: !!focusTargets.find(t => t.name === 'Tracker'),
    declared: trackerRig.routes.reduce((o, r) => { o[r.declared] = (o[r.declared] || 0) + 1; return o; }, {}),
    ruIn: (trackerRig.routes.find(r => r.key === 'Russia→India·crude') || {}).declared, canUs: (trackerRig.routes.find(r => r.key === 'Canada→United States·crude') || {}).declared,
    veEu: (trackerRig.routes.find(r => r.key === 'Venezuela→EU-27·crude') || {}).declared, products: trackerRig.routes.filter(r => r.cmd === 'products').length, exports: trackerRig.routes.filter(r => r.uncounted).length, amber: trackerRig.routes.filter(r => r.confidence === 'default').length, card: !!(trackerRig.card && trackerRig.card.frame && trackerRig.card.strip), items: trackerTicker.items.length,
  }));
  check('the globe is up on arrival, the graphmap stood down', ped.mode === 'tracker' && ped.globe && !ped.graph && ped.sphere, JSON.stringify({ mode: ped.mode, globe: ped.globe, graph: ped.graph }));
  check('the settlement layer was read before any route was drawn', ped.rules && ped.built);
  check('thirteen months, every route the window names, the accruals dashed', ped.months === 13 && ped.routes > 100 && ped.nodes > 30 && ped.acc >= 1, JSON.stringify({ months: ped.months, routes: ped.routes, nodes: ped.nodes, acc: ped.acc }));
  check('gold, blue and dashed all stand on the globe', ped.declared.dollar > 0 && ped.declared['non-dollar'] > 0 && ped.declared.unknown > 0, JSON.stringify(ped.declared));
  check('the flows are split: crude and products apart, the US exports drawn uncounted, defaults amber', ped.products > 50 && ped.exports > 20 && ped.amber > 50, JSON.stringify({ products: ped.products, exports: ped.exports, amber: ped.amber }));
  check('the card: the frame behind the globe, the strip beneath it, a ticker with the month\'s story', ped.card && ped.items >= 8, ped.items + ' items');
  check('Russia→India is blue, Canada→US is gold, Venezuela→Europe is unknown', ped.ruIn === 'non-dollar' && ped.canUs === 'dollar' && ped.veEu === 'unknown', ped.ruIn + ' / ' + ped.canUs + ' / ' + ped.veEu);
  check('the one reading: the dollar\'s share, with its denominator', ped.now && ped.now.dollarShare > 0.5 && ped.now.namedShare > 0.5 && ped.now.panelPresent.length === 5, ped.now && (Math.round(ped.now.dollarShare * 100) + '% of ' + Math.round(ped.now.namedShare * 100) + '% named, ' + ped.now.period + ' vs ' + ped.ago.period));
  check('the verdict is a word', ['RISING', 'HOLDING', 'FALLING'].includes(ped.verdict), ped.verdict);
  check('it opens on the latest full-panel month', ped.month === ped.nowIndex, ped.month + '/' + ped.nowIndex);
  check('the globe is a focus target', ped.focus);
  const speech = await p.evaluate(() => trackerSpeech(trackerData));
  check('Ted\'s line is built from the numbers', /sold in dollars/.test(speech) && /needle reads/.test(speech) && /not-knowing/.test(speech), speech.length + ' chars');
  check('Ted never says z', !/\bz\b/i.test(speech));
  const play = await p.evaluate(() => { trackerSetMonth(2); const g0 = trackerRig.routes.find(r => r.key === 'Saudi Arabia→United States·crude').mesh.material.opacity; trackerSetMonth(trackerData.nowIndex); const g12 = trackerRig.routes.find(r => r.key === 'Saudi Arabia→United States·crude').mesh.material.opacity; return { g0, g12, can: trackerRig.routes.find(r => r.key === 'Canada→United States·crude').mesh.material.opacity, dots: trackerRig.routes.find(r => r.key === 'Russia→India·crude').dots.length }; });
  check('a line that goes dark is a fact — the Saudi route to the US fades by the last month', play.g0 > play.g12 && play.g12 < 0.1, JSON.stringify(play));
  check('Canada and Russia→India carry barrels', play.can > 0.8 && play.dots >= 4);
  // the dashboard on the G4's screen
  await p.evaluate(() => trackerRouteSelect('Russia→India'));
  await p.waitForTimeout(500);
  const dash = await p.evaluate(() => ({ float: g4State.floatMode, tab: g4Screen.activeTab, vis: g4State.visible, sel: trackerRig.selected, hits: g4Screen.hitRegions.filter(h => /tracker/.test(h.action)).map(h => h.action + ':' + h.data), pov: trackerRig.pov }));
  check('a route clicked floats the G4 beside the globe, on the Active tab', dash.float && dash.tab === 'active' && dash.vis && dash.sel === 'Russia→India');
  check('the dashboard has a point of view, rows, a scrubber', dash.hits.some(h => /trackerPov:United States/.test(h)) && dash.hits.some(h => /trackerPov:the world/.test(h)) && dash.hits.some(h => /trackerRoute:Canada→United States/.test(h)) && dash.hits.some(h => /trackerStep/.test(h)), dash.hits.length + ' regions');
  check('the US is the default point of view', dash.pov === 'United States');
  await p.evaluate(() => { trackerDashSetPov('India'); });
  const ind = await p.evaluate(() => g4Screen.hitRegions.filter(h => h.action === 'trackerRoute').map(h => h.data));
  check('India\'s view lists its own routes, Russia first', ind[0] === 'Russia→India', ind.slice(0, 3).join(' · '));
  const scrub = await p.evaluate(() => { trackerStripClick({ x: 0.2, y: 0.7 }); const a = trackerRig.month; const held = !trackerRig.playing; trackerStripClick({ x: 0.5, y: 0.05 }); return { a, held, playing: trackerRig.playing }; });
  check('click the timeline to hold a month, the ticker band to play again', scrub.a === 2 && scrub.held && scrub.playing, JSON.stringify(scrub));
  await p.evaluate(() => { trackerDashSetPov('United States'); trackerRouteSelect(null); dockG4Screen(); hideG4Panel(); });
  // the sheet
  await p.evaluate(() => trackerSheetOpen());
  await p.waitForTimeout(300);
  const sheet = await p.evaluate(() => ({
    open: document.getElementById('tracker-sheet').classList.contains('open'),
    h2: document.querySelector('#ts-card h2') && document.querySelector('#ts-card h2').textContent,
    nums: document.querySelectorAll('#ts-card .ts-num').length,
    bars: document.querySelectorAll('#ts-card .ts-months rect').length,
    bet: !!document.querySelector('#ts-card .ts-bet'),
    said: document.querySelectorAll('#ts-card .ts-said').length,
    link: document.querySelector('#ts-card .ts-foot a') && document.querySelector('#ts-card .ts-foot a').getAttribute('href'),
  }));
  check('the sheet opens and reads plainly', sheet.open && /in what money/.test(sheet.h2 || ''), sheet.h2);
  check('four numbers, thirteen months of bars, the bet, the principals', sheet.nums === 4 && sheet.bars === 39 && sheet.bet && sheet.said > 0, JSON.stringify({ nums: sheet.nums, bars: sheet.bars, bet: sheet.bet, said: sheet.said }));
  check('the door to the full instrument', /Prism\/active/.test(sheet.link || ''), sheet.link);
  await p.screenshot({ path: 'shots/sheet.png' });
  await p.evaluate(() => document.body.focus());
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  check('Escape closes the sheet', !(await p.evaluate(() => document.getElementById('tracker-sheet').classList.contains('open'))));

  // the swap
  await p.evaluate(() => pedestalShow('graphmap'));
  check('the graphmap comes back when asked, the globe stands down', await p.evaluate(() => graphmapVisible && !trackerGlobe.visible && pedestalMode === 'graphmap'));
  await p.evaluate(() => pedestalShow('tracker'));
  check('and the globe again', await p.evaluate(() => !graphmapVisible && trackerGlobe.visible));

  console.log('\n── the dock ──');
  await p.evaluate(() => tedDockOpen());
  const dock = await p.evaluate(() => ({
    open: document.getElementById('ted-dock').classList.contains('open'),
    ins: Array.from(document.querySelectorAll('#td-rows-ins .td-row')).map(r => r.textContent),
    places: Array.from(document.querySelectorAll('#td-rows-places .td-row')).map(r => r.textContent),
    btn: document.getElementById('ted-dock-btn') && document.getElementById('ted-dock-btn').textContent.trim(),
  }));
  check('the dock opens from the Compass', dock.open && /ask Ted/.test(dock.btn || ''), dock.btn);
  check('four instruments', dock.ins.length === 4, dock.ins.join(' · '));
  check('every registry place is a row, the Observatory included', dock.places.length === 16 && dock.places.some(x => /Observatory/.test(x)), dock.places.length);
  check('no row calls it a tour', !dock.ins.concat(dock.places).some(x => /tour/i.test(x)));

  // an errand
  await p.evaluate(() => tedShow('library'));
  await p.waitForTimeout(1500);
  const e1 = await p.evaluate(() => ({
    on: tourState.on, errand: tourState.errand, beats: tourState.beats.length,
    who: document.getElementById('tc-who').textContent, skip: document.getElementById('tc-skip').textContent,
    cap: document.getElementById('tour-caption').classList.contains('open'),
    text: document.getElementById('tc-text').textContent,
    rear: TED_REAR.active, lit: !!document.querySelector('#ted-dock .td-row.lit'),
    wheel: visitorNav.active, answer: document.getElementById('td-answer').textContent,
  }));
  check('an errand runs on the walk\'s engine', e1.on && e1.errand === 'library' && e1.beats === 3, JSON.stringify({ on: e1.on, errand: e1.errand, beats: e1.beats }));
  check('the caption says he is showing you round', e1.cap && /showing you round/.test(e1.who) && /thanks, Ted/.test(e1.skip), e1.who + ' / ' + e1.skip);
  check('he sets off and says so', /Library/.test(e1.text) || /Library/.test(e1.answer), e1.text || e1.answer);
  check('Ted is on the move, the row is lit, you have the wheel', e1.rear && e1.lit && e1.wheel);
  // crank the clock: the suite cannot wait for a real walk at 1 fps
  await p.waitForTimeout(6000);
  const e2 = await p.evaluate(() => ({ i: tourState.i, ted: { x: tedTurner.position.x, z: tedTurner.position.z }, mark: { x: TED_REAR.mark.x, z: TED_REAR.mark.z } }));
  check('the second beat sends you both to the Library mark', e2.i >= 1 && Math.abs(e2.mark.x - (-22)) < 0.01 && Math.abs(e2.mark.z - 6) < 0.01, JSON.stringify(e2));
  await p.evaluate(() => tourStop(true));
  const e3 = await p.evaluate(() => ({ on: tourState.on, errand: tourState.errand, lit: !!document.querySelector('#ted-dock .td-row.lit'), label: document.getElementById('nav-label').textContent }));
  check('thanks, Ted — stops it, unlit', !e3.on && !e3.errand && !e3.lit, e3.label);   // the label can be overwritten by an arrival a moment later

  // a new ask ends the one in flight
  await p.evaluate(() => tedShow('beach'));
  await p.waitForTimeout(400);
  await p.evaluate(() => tedShow('tracker'));
  await p.waitForTimeout(400);
  const e4 = await p.evaluate(() => ({ errand: tourState.errand, on: tourState.on, beats: tourState.beats.length }));
  check('a new ask replaces the one in flight', e4.on && e4.errand === 'tracker' && e4.beats >= 3, JSON.stringify(e4));
  await p.evaluate(() => tourStop(true));

  // the line
  const asks = await p.evaluate(() => {
    const out = {};
    const probe = (t) => { tedAsk(t); return { errand: tourState.errand, answer: document.getElementById('td-answer').textContent }; };
    out.beach = probe('where is the beach?'); tourStop(true);
    out.who = probe('who are you');
    out.prism = probe('what is prism');
    out.avatar = probe('how do I get an avatar');
    out.oil = probe('show me the oil thing'); tourStop(true);
    out.none = probe('zzz qqq');
    return out;
  });
  check('"where is the beach?" takes you there', asks.beach.errand === 'beach');
  check('"who are you" answers without moving', !asks.who.errand && /Ted Turner/.test(asks.who.answer), asks.who.answer.slice(0, 60));
  check('"what is prism" answers in plain words', /object permanence/.test(asks.prism.answer));
  check('"how do I get an avatar" points at identity', /identity/.test(asks.avatar.answer));
  check('"the oil thing" is the tracker', asks.oil.errand === 'tracker');
  check('and nonsense gets a polite miss', /didn’t catch that/.test(asks.none.answer));

  console.log('\n── the program on the G4 ──');
  await p.evaluate(() => { navTo('iMac G4'); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { showG4Panel(); g4State.app = null; redrawG4Screen(); });
  const tiles = await p.evaluate(() => g4Screen.hitRegions.filter(h => h.action === 'openApp').map(h => h.data));
  check('a fourth tile on the desk: the Supply Shock Tracker', tiles.includes('tracker') && tiles.length === 4, tiles.join(' · '));
  await p.evaluate(() => { handleG4ScreenClick({ action: 'openApp', data: 'tracker' }); });
  await p.waitForTimeout(600);
  const app = await p.evaluate(() => ({ app: g4State.app, tab: g4Screen.activeTab, hits: g4Screen.hitRegions.map(h => h.action), h: g4Screen.contentHeight.trackerApp }));
  check('it opens: the reading, the months, the stations, the routes — scrollable', app.app === 'tracker' && app.tab === 'trackerApp' && app.hits.includes('trackerPedestal') && app.hits.includes('trackerRoute') && app.hits.includes('trackerStep') && app.h > 1200, JSON.stringify({ h: app.h, pedestal: app.hits.includes('trackerPedestal') }));
  await p.evaluate(() => { handleG4ScreenClick({ action: 'trackerPedestal' }); });
  await p.waitForTimeout(1200);
  const go = await p.evaluate(() => ({ mode: g4Tracker.mode, globe: trackerGlobe.visible, focus: activeFocus && activeFocus.name, leads: trackerRig.routes.filter(r => r.lead).length }));
  check('🌍 sends the screen out to the globe', go.mode === 'coming' && go.globe && go.focus === 'Tracker', JSON.stringify(go));
  check('the lead barrels carry their number and marks', go.leads >= 10, go.leads);
  await p.evaluate(() => { g4Tracker.t = 99; });
  await p.waitForTimeout(1500);
  const beside = await p.evaluate(() => { const sg = imacG4.userData.screenGroup; const h = g4Tracker.head; const local = sg.worldToLocal(h.position.clone()); return { x: local.x, w: g4Tracker.dims.w, tedHasHead: tedTurner.children.indexOf(tedHeadGroup) !== -1 }; });
  check('Ted\'s head floats BESIDE the glass, and the Ted in the room keeps his', beside.x < -beside.w / 2 && beside.tedHasHead, JSON.stringify(beside));
  await p.evaluate(() => { releaseFocus(); });
  await p.waitForTimeout(500);

  console.log('\n── the G4 is the timeline ──');
  await p.evaluate(() => { try { localStorage.removeItem('dg_tracker_intro_v1'); } catch (e) {} releaseFocus(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => navTo('Tracker'));
  await p.waitForTimeout(1200);
  const c1 = await p.evaluate(() => ({ mode: g4Tracker.mode, float: g4State.floatMode, strip: trackerRig.card.strip.visible, parent: imacG4.userData.screenGroup.parent === scene, lines: g4Tracker.lines.length, badge: !!imacG4.userData.screenParts.badge }));
  check('the lens at the globe brings the G4 over — the strip steps aside', c1.mode === 'coming' && c1.float && !c1.strip && c1.parent, JSON.stringify(c1));
  check('it has lines to say, and the Prism badge where the apple was', c1.lines >= 6 && c1.badge);
  await p.evaluate(() => { g4Tracker.t = 99; });
  await p.waitForTimeout(1500);
  const c2 = await p.evaluate(() => ({ mode: g4Tracker.mode, w: g4Tracker.dims.w, line: g4Tracker.line, hits: g4Screen.hitRegions.map(h => h.action) }));
  check('then Ted talks on the glass, with skip on it from the first second', c2.mode === 'intro' && c2.w > 1.9 && c2.hits.includes('trackerIntroSkip'), JSON.stringify(c2));
  const c2b = await p.evaluate(() => ({ head: !!g4Tracker.head, body: g4Tracker.head && g4Tracker.head.children[0].children.every(m => !m.isMesh || m.position.y > 1.0), jaw: !!g4Tracker.headJaw, layer: g4Tracker.head && g4Tracker.head.children[0].children[0].layers.mask, faceSolid: !imacG4.userData.screenFace.material.transparent && imacG4.userData.screenFace.material.depthTest, globeLayer: trackerRig.sphere.layers.mask, tedLayer: tedTurner.children[0].layers.mask }));
  check('his actual head, no body, in the residents\' pass; the glass solid before it', c2b.head && c2b.body && c2b.jaw && c2b.layer === 2 && c2b.faceSolid && c2b.globeLayer === 2, JSON.stringify(c2b));
  const cc = await p.evaluate(() => { const r = document.getElementById('compass-hud').getBoundingClientRect(), w = document.getElementById('wave-hud').getBoundingClientRect(); return { cl: r.left, cb: window.innerHeight - r.bottom, wl: w.left }; });
  check('the compass and the comms sit in the bottom-left corner', cc.cl < 60 && cc.cb < 40 && cc.wl > 100 && cc.wl < 260, JSON.stringify(cc));
  await p.evaluate(() => { g4TrackerSkip(); g4Tracker.t = 99; });
  await p.waitForTimeout(1500);
  const c3 = await p.evaluate(() => ({ mode: g4Tracker.mode, w: g4Tracker.dims.w, h: g4Tracker.dims.h, seen: !!localStorage.getItem('dg_tracker_intro_v1') }));
  check('skip → it morphs into the timeline\'s own shape, and remembers the intro was heard', c3.mode === 'timeline' && Math.abs(c3.w - 4.8) < 0.01 && Math.abs(c3.h - 1.1) < 0.01 && c3.seen, JSON.stringify(c3));
  const c4 = await p.evaluate(() => { g4TrackerClick({ x: 0.2, y: 0.7 }); return { month: trackerRig.month, playing: trackerRig.playing }; });
  check('the glass scrubs like the strip did', c4.month === 2 && !c4.playing, JSON.stringify(c4));
  await p.evaluate(() => { trackerRouteSelect('Russia→India'); });
  check('a route clicked reads out at the head of the ticker, not on a second screen', await p.evaluate(() => /Russia → India/.test(trackerTicker.items[0].t) && g4Tracker.mode === 'timeline'));
  await p.evaluate(() => { trackerRouteSelect(null); trackerRig.playing = true; releaseFocus(); });
  await p.waitForTimeout(500);
  const c5 = await p.evaluate(() => ({ mode: g4Tracker.mode, float: g4State.floatMode, w: g4Tracker.dims.w, strip: trackerRig.card.strip.visible, home: imacG4.userData.screenGroup.parent === imacG4 }));
  check('letting go sends it home at its old shape; the strip comes back', !c5.mode && !c5.float && Math.abs(c5.w - 0.5) < 0.01 && c5.strip && c5.home, JSON.stringify(c5));
  check('and the head is gone, the screen back on layer 0 for the desk\'s own pierce', await p.evaluate(() => !g4Tracker.head && imacG4.userData.screenFace.layers.mask === 1));
  await p.evaluate(() => navTo('Tracker'));
  await p.waitForTimeout(1200);
  const c6 = await p.evaluate(() => ({ next: g4Tracker.next, mode: g4Tracker.mode }));
  check('a second visit skips the talk and comes straight in as the timeline', c6.mode === 'coming' && c6.next === 'morph', JSON.stringify(c6));
  await p.evaluate(() => { releaseFocus(); });
  await p.waitForTimeout(400);

  console.log('\n── the walk ends on the tracker ──');
  const beats = await p.evaluate(() => tourBeats().map(b => b.say || '').join(' | '));
  check('the last leg names the Supply Shock Tracker', /Supply Shock Tracker/.test(beats));
  check('and tells the guest how to ask Ted', /ask Ted/.test(beats));
  check('no guest hears a software word', !/\b(errand|tedShow|pedestalShow|localStorage)\b/.test(beats));

  console.log('\n── identity, for the public ──');
  await p.evaluate(() => openIdentityPanel());
  const id = await p.evaluate(() => ({
    title: document.getElementById('ip-title').textContent,
    visiting: getComputedStyle(document.getElementById('ip-visiting')).display !== 'none',
    req: getComputedStyle(document.getElementById('ip-request')).display !== 'none',
    docent: getComputedStyle(document.getElementById('ip-docent-requests')).display !== 'none',
    email: !!document.getElementById('ip-email'),
  }));
  check('a stranger is a visitor, not locked out', /visitor/.test(id.title) && id.visiting, id.title);
  check('the request form is there, the docent\'s list is not', id.req && id.email && !id.docent);
  await p.evaluate(() => { document.getElementById('ip-email').value = 'not an email'; requestAvatar(); });
  check('a bad email is refused on the spot', /does not look like an email/.test(await p.evaluate(() => document.getElementById('ip-req-note').textContent)));
  // the gate is a stub here: 404 → the mailto fallback
  await p.route('**/request', r => r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' }, body: '{"error":"the villa hears you but cannot remember"}' }));
  await p.evaluate(() => { document.getElementById('ip-email').value = 'friend@example.com'; document.getElementById('ip-wish').value = 'a heron'; requestAvatar(); });
  await p.waitForTimeout(2500);
  const note = await p.evaluate(() => document.getElementById('ip-req-note').innerHTML);
  check('a door without the route falls back to mail', /mailto:/.test(note) && /friend%40example.com|friend@example.com/.test(note), note.slice(0, 80));
  await p.unroute('**/request');
  await p.route('**/request', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' }, body: '{"ok":true}' }));
  await p.evaluate(() => { document.getElementById('ip-email').value = 'friend@example.com'; requestAvatar(); });
  await p.waitForTimeout(2500);
  const note2 = await p.evaluate(() => ({ t: document.getElementById('ip-req-note').textContent, kept: localStorage.getItem('dg_requested') }));
  check('and a door that takes it says so, and remembers', /asked\. Sailor will/.test(note2.t) && note2.kept === 'friend@example.com', note2.t);

  console.log('\n── the picture ──');
  await p.evaluate(() => { document.getElementById('identity-panel').classList.remove('open'); tedDockClose(); navTo('Tracker'); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots/tracker.png' });
  await p.evaluate(() => { releaseFocus(); tedDockOpen(); });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'shots/dock.png' });
  await p.evaluate(() => { tedDockClose(); openIdentityPanel(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/identity.png' });
  await p.evaluate(() => document.getElementById('identity-panel').classList.remove('open'));

  // the phone
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(800);
  await p.evaluate(() => tedDockOpen());
  await p.waitForTimeout(400);
  const ph = await p.evaluate(() => { const r = document.getElementById('ted-dock').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, w: r.width, scrollW: document.documentElement.scrollWidth }; });
  check('on a phone the dock is a sheet at the top, inside the screen', ph.top >= 40 && ph.bottom <= 844 && ph.w <= 390 && ph.scrollW <= 390, JSON.stringify(ph));
  await p.screenshot({ path: 'shots/phone-dock.png' });
  await p.evaluate(() => { tedDockClose(); trackerSheetOpen(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/phone-sheet.png' });

  console.log('\n── page errors ──');
  check('0 page errors', errs.length === 0, errs.length ? errs.join('\n   ') : '(none)');
  const n = CHECKS.filter(c => c.ok).length;
  console.log('\n' + n + '/' + CHECKS.length + ' green');
  if (n < CHECKS.length) console.log('FAILED:\n' + CHECKS.filter(c => !c.ok).map(c => '  ' + c.name).join('\n'));
  await b.close();
})();
