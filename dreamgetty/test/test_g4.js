// The G4's desktop, BloomBurger, the default Iran trace, and Adlib's notice.
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
  await p.waitForTimeout(9000);   // past the 3.5s default-trace timer

  console.log('\n── the exhibition hangs itself ──');
  const iran = await p.evaluate(() => ({
    loaded: parchState.loadedTraceData && parchState.loadedTraceData.id,
    label: parchState.loadedTraceData && parchState.loadedTraceData.label,
    graphmapOn: graphmapVisible || (typeof pedestalMode !== 'undefined' && pedestalMode === 'tracker' && trackerBoard.visible),   // 2026-10-12: the tracker holds the pedestal at open; the trace still hangs
    storyBuilt: g4State.story.steps.length > 0,
    g4StillOnDesktop: g4State.app === null,
  }));
  check('TS01 stands on the graphmap at open', iran.loaded === 'TS01', iran.label);
  check('…with the pedestal holding the tracker (graphmap one ask away) and the story built', iran.graphmapOn && iran.storyBuilt);
  check('…and the G4 still boots to its DESKTOP — the Workstation is an app now',
        iran.g4StillOnDesktop);

  console.log('\n── the desktop ──');
  const desk = await p.evaluate(() => {
    const out = {};
    g4State.app = null; redrawG4Screen();
    const regions = () => g4Screen.hitRegions.map(r => r.action);
    out.deskRegions = regions();
    out.twoApps = g4Screen.hitRegions.filter(r => r.action === 'openApp').length === 3;   // 2026-10-14: Prism · BloomBurger · Codex
    out.noTabs = !regions().includes('tab');
    // open the Workstation
    handleG4ScreenClick(g4Screen.hitRegions.find(r => r.action === 'openApp' && r.data === 'prism'));
    out.prismOpen = g4State.app === 'prism';
    out.tabsBack = g4Screen.hitRegions.some(r => r.action === 'tab');
    // back to the desktop
    handleG4ScreenClick(g4Screen.hitRegions.find(r => r.action === 'desktop'));
    out.backToDesk = g4State.app === null && g4Screen.hitRegions.filter(r => r.action === 'openApp').length === 3;
    return out;
  });
  check('the desktop offers three applications and no tabs', desk.twoApps && desk.noTabs);
  check('Prism Workstation opens — the tabs are its furniture', desk.prismOpen && desk.tabsBack);
  check('DESKTOP brings you home', desk.backToDesk);

  console.log('\n── BloomBurger ──');
  const bloom = await p.evaluate(() => {
    const out = {};
    feedState.entries.unshift(sanitizeFeedEntry({
      id: 'bb1', author: 'adlib', kind: 'statement',
      text: 'petrogas-dollar exposure per resident — chartable?',
      t: '2026-08-09T05:00:00.000Z', pos: [0, 1.5, -14], place: 'the galleria',
      replyTo: 'dg:note:bloomburger', to: null }));
    g4State.app = null; redrawG4Screen();
    handleG4ScreenClick(g4Screen.hitRegions.find(r => r.action === 'openApp' && r.data === 'bloomburger'));
    out.open = g4State.app === 'bloomburger';
    out.opensOnPaper = (g4State.bloomFn || 'pg') === 'pg' && g4Screen.hitRegions.filter(r => r.action === 'bloomFn').length === 3;   // 2026-10-14: the terminal opens on the paper
    handleG4ScreenClick(g4Screen.hitRegions.find(r => r.action === 'bloomFn' && r.data === 'sst'));
    out.sstIsTracker = g4State.bloomFn === 'sst' && g4Screen.activeTab === 'trackerApp' && g4Screen.hitRegions.some(r => r.action === 'trackerPedestal' || r.action === 'bloomFn');
    g4State.app = 'tracker'; redrawG4Screen();
    out.trackerFolds = g4State.app === 'bloomburger' && g4State.bloomFn === 'sst';
    handleG4ScreenClick(g4Screen.hitRegions.find(r => r.action === 'bloomFn' && r.data === 'wire'));
    out.writeBtn = g4Screen.hitRegions.some(r => r.action === 'bloomWrite');
    // the write button opens the notebook panel on the bloomburger book
    handleG4ScreenClick(g4Screen.hitRegions.find(r => r.action === 'bloomWrite'));
    out.panelOpen = document.getElementById('notebook-panel').classList.contains('open');
    out.panelTitle = document.getElementById('nb-title').textContent;
    out.pages = document.querySelectorAll('#nb-list .nb-entry').length;
    out.noFileSlot = document.getElementById('nb-file-row').style.display === 'none';
    closeNotebook();
    g4State.app = null; redrawG4Screen();
    return out;
  });
  check('BloomBurger opens on the glass', bloom.open && bloom.writeBtn);
  check('…on the paper, with PG · SST · WIRE', bloom.opensOnPaper);
  check('…SST is the tracker; an old \'tracker\' open folds into it', bloom.sstIsTracker && bloom.trackerFolds);
  check('WRITE IN IT opens the BloomBurger notebook', bloom.panelOpen && bloom.panelTitle === 'BloomBurger');
  check('…showing its page', bloom.pages === 1, bloom.pages + ' page(s)');
  check('…words only — files stay the exedra\'s', bloom.noFileSlot);

  console.log('\n── the feed knows the register ──');
  const feed = await p.evaluate(() => {
    document.getElementById('wave-hud').click();
    const t = document.getElementById('fp-list').textContent;
    closeWaveMenu();
    return { line: /in the bloomburger notebook/.test(t) };
  });
  check('a BloomBurger page reads "in the bloomburger notebook"', feed.line);

  console.log('\n── word for adlib ──');
  const word = await p.evaluate(async () => {
    const out = {};
    const realId = window.feedIdentity;
    localStorage.removeItem('dg_bloom_note');
    window.feedIdentity = () => ({ avatar: 'adlib', pass: 'x' });
    // fire the check by hand rather than waiting out the interval
    out.shown = announceCustom('something new on the G4 — a notebook called BloomBurger',
      'have a look', function () { navTo('iMac G4'); });
    out.text = document.getElementById('an-text').textContent;
    out.btn = document.querySelector('#announce .ui-btn').textContent;
    out.neutral = out.text.indexOf('adlib') < 0 && out.text.indexOf('Adlib') < 0 &&
                  out.text.indexOf('for you') < 0;
    approach.active = false;
    announceOpen();
    out.travels = approach.active;                 // navTo flies to the G4
    out.bannerGone = !document.getElementById('announce').classList.contains('open');
    // and a talk-banner afterwards is unpolluted by the custom handler
    feedState.entries.unshift(sanitizeFeedEntry({ id: 'tk1', author: 'ted', kind: 'address',
      text: 'A talk.', t: '2026-08-09T06:00:00.000Z', pos: [0,0,0], place: 'x', replyTo: null }));
    heardTalks.clear();
    announceShow(feedState.entries[0]);
    out.talkBtnRestored = document.querySelector('#announce .ui-btn').textContent === 'listen';
    announceDismiss();
    window.feedIdentity = realId;
    return out;
  });
  check('the notice shows, worded for the thing and not the recipient',
        word.shown && word.neutral, word.text);
  check('its button says have a look', word.btn === 'have a look');
  check('…and taking it flies you to the G4', word.travels && word.bannerGone);
  check('the talk banner\'s own buttons come back after', word.talkBtnRestored);

  console.log('\n── the label ──');
  const label = await p.evaluate(() =>
    Array.from(document.querySelectorAll('#fp-row .ui-btn')).map(b => b.textContent));
  check('the general post says "speak in the villa"', label[0] === 'speak in the villa',
        JSON.stringify(label));

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + '   ' + (f.detail || ''))); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
