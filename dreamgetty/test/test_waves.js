// The waves: the speech artifact beside the compass — soft ring of voices,
// hard unfold of talks, and the split finally cut.
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
  await p.waitForTimeout(7000);

  // ── THE SPLIT ──────────────────────────────────────────────────────────
  console.log('\n── the split, finally cut ──');
  const split = await p.evaluate(() => ({
    hud: !!document.getElementById('wave-hud'),
    img: (document.getElementById('wave-img') || {}).src || '',
    talksInWaves: document.getElementById('feed-panel').contains(document.getElementById('cmp-talks')),
    profileInWaves: document.getElementById('feed-panel').contains(document.getElementById('profile-btn')),
    addressInWaves: document.getElementById('feed-panel').contains(document.getElementById('docent-btn')),
    talksRowGoneFromCompass: !Array.from(document.querySelectorAll('#cmp-root .cmp-row'))
      .some(el => /Talks/.test(el.textContent)),
    companyStays: Array.from(document.querySelectorAll('#cmp-root .cmp-row'))
      .some(el => /Company/.test(el.textContent)),
    placesStay: Array.from(document.querySelectorAll('#cmp-root .cmp-row'))
      .some(el => /Places/.test(el.textContent)),
  }));
  check('the waves stand beside the compass', split.hud);
  check('…wearing art/icons/waves.png', /art\/icons\/waves\.png/.test(split.img));
  check('Talks live inside the feed panel', split.talksInWaves);
  check('…and profile', split.profileInWaves);
  check('…and the docent\'s address', split.addressInWaves);
  check('the compass no longer carries Talks', split.talksRowGoneFromCompass);
  check('…but keeps Places and Company — space stays space', split.companyStays && split.placesStay);

  // ── SOFT: THE VOICES ───────────────────────────────────────────────────
  console.log('\n── the soft ring of voices ──');
  const soft = await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    camTarget.set(0, 1.5, 20);
    await sleep(100);
    waveSoftBegin();
    const out = {};
    out.soft = document.getElementById('wave-hud').classList.contains('soft');
    const pills = Array.from(document.querySelectorAll('#wave-ring .cmp-bearing'));
    out.n = pills.length;
    out.here = document.getElementById('wave-here').textContent;
    // nearest-first: the first pill's resident should be nearer than the last's
    const me = summonerPoint();
    const dist = k => { const a = AVATARS[k] && AVATARS[k]();
      return (a && a.visible) ? Math.hypot(a.position.x - me.x, a.position.z - me.z) : 9999; };
    const keys = pills.map(el => Object.keys(PROFILES).find(k => el.textContent.indexOf(PROFILES[k].name.replace(/^The /, '')) >= 0)).filter(Boolean);
    out.firstD = dist(keys[0]); out.lastD = dist(keys[keys.length - 1]);
    // a voice is a door: click one, their card opens
    const first = pills[0];
    first.click();
    out.followed = followAnimal.key;
    out.cardOpen = document.getElementById('follow-card').classList.contains('open');
    out.softEnded = !document.getElementById('wave-hud').classList.contains('soft');
    out.ringEmptyAfterEnd = document.querySelectorAll('#wave-ring .cmp-bearing').length;
    stopFollow();
    // standing still, no rebuild under the hand
    waveSoftBegin();
    const node = document.querySelector('#wave-ring .cmp-bearing');
    waveRefreshSoft(); waveRefreshSoft();
    out.sameNode = document.querySelector('#wave-ring .cmp-bearing') === node;
    // the gap between waves and pill is still the waves — the hit disc
    const hud = document.getElementById('wave-hud');
    const r = hud.getBoundingClientRect();
    const el = document.elementFromPoint((r.left + r.right) / 2 - 70, r.top - 30);
    out.gapIsStillTheWaves = el === hud || hud.contains(el);
    waveSoftEnd();
    return out;
  });
  check('hovering gathers the company', soft.n >= 12, soft.n + ' voices');
  check('…named for who is near', /company/.test(soft.here), soft.here);
  check('nearest to you innermost', soft.firstD <= soft.lastD,
        soft.firstD.toFixed(0) + ' ≤ ' + (soft.lastD === 9999 ? 'absent' : soft.lastD.toFixed(0)));
  check('a voice is a door — their card opens', soft.followed && soft.cardOpen, soft.followed);
  check('…and the ring stands down', soft.softEnded);
  check('minimized means GONE — the ring is emptied, not just faded',
        soft.ringEmptyAfterEnd === 0, soft.ringEmptyAfterEnd + ' pills left behind');
  check('standing still, no rebuild under the hand', soft.sameNode);
  check('the hit disc holds the hover across the gap', soft.gapIsStillTheWaves);

  // ── HARD: THE FEED ─────────────────────────────────────────────────────
  console.log('\n── the hard activation is the feed ──');
  const hard = await p.evaluate(() => {
    const out = {};
    const mk = (id, kind, text, t, replyTo, place) => sanitizeFeedEntry({
      id, author: 'emilia', kind, text, t, pos: [2, 1, 3],
      place: place || 'the lawn', replyTo: replyTo || null, to: null });
    feedState.entries = [
      sanitizeFeedEntry({ id: 'a1', author: 'ted', kind: 'address', text: 'The introduction. Welcome.',
        t: '2026-08-01T00:00:00.000Z', pos: [0,0,0], place: 'x', replyTo: null, to: null }),
      mk('s1', 'statement', 'a stone on the lawn', '2026-08-09T01:00:00.000Z'),
      mk('p1', 'statement', 'Em ⁂ a stoat', '2026-08-09T02:00:00.000Z', 'dg:profile'),
      mk('n1', 'statement', 'a page in the book', '2026-08-09T03:00:00.000Z', 'dg:note:library'),
      mk('g1', 'statement', 'hello to everyone at once', '2026-08-09T04:00:00.000Z', 'dg:feed'),
    ];
    heardTalks.clear();
    localStorage.removeItem('dg_wave_opens');
    const panel = document.getElementById('feed-panel');
    const nav = document.getElementById('nav-menu');
    nav.classList.add('open');                      // the compass is open…
    document.getElementById('wave-hud').click();
    out.opens = panel.classList.contains('open');
    out.compassYields = !nav.classList.contains('open');   // …one unfold at a time
    const rows = Array.from(document.querySelectorAll('#fp-list .fp-entry'));
    out.n = rows.length;
    out.text = document.getElementById('fp-list').textContent;
    out.newestFirst = rows[0].textContent.indexOf('everyone at once') >= 0;
    out.hasAddressRow = rows.some(r => r.classList.contains('fp-address'));
    out.registers = {
      general: /to the villa ·/.test(out.text),
      note: /in the library notebook/.test(out.text),
      profile: /wrote their own profile/.test(out.text),
      stone: /at the lawn/.test(out.text),
      address: /addressed the house/.test(out.text),
    };
    out.noRawMarkers = out.text.indexOf('dg:') < 0 && out.text.indexOf('⁂') < 0;
    // the talks fold out inside the feed
    out.talksHidden = document.getElementById('cmp-talks').style.display === 'none';
    toggleFeedTalks();
    out.talksShown = document.getElementById('cmp-talks').style.display !== 'none' &&
                     document.querySelectorAll('#feed-panel .cmp-talk').length === 1;
    toggleFeedTalks();
    // an address row replays the talk
    rows.find(r => r.classList.contains('fp-address')).click();
    out.rewatch = threshold.showing && !panel.classList.contains('open');
    endThreshold();
    // and the compass closes the feed the other way
    document.getElementById('wave-hud').click();
    document.getElementById('compass-hud').click();
    out.feedYields = !panel.classList.contains('open');
    document.getElementById('compass-hud').click();
    return out;
  });
  check('clicking the waves opens the whole feed', hard.opens && hard.n === 5, hard.n + ' entries');
  check('every register of speech in one aggregate',
        Object.values(hard.registers).every(Boolean), JSON.stringify(hard.registers));
  check('newest first', hard.newestFirst);
  check('no raw marker or separator ever shown', hard.noRawMarkers);
  check('the talks fold out inside the feed', hard.talksHidden && hard.talksShown);
  check('an address row replays the talk', hard.rewatch);
  check('the compass yields — one unfold at a time', hard.compassYields);
  check('…and yields back the other way', hard.feedYields);

  // ── THE GENERAL POST ───────────────────────────────────────────────────
  console.log('\n── the general post ──');
  const gen = await p.evaluate(async () => {
    const out = {};
    const realId = window.feedIdentity;
    const realFetch = window.fetch;
    window.feedIdentity = () => ({ avatar: 'emilia', pass: 'x' });
    let said = null;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('/say') >= 0) {
        said = JSON.parse(opts.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: {
          id: 'srvg', author: 'emilia', kind: 'statement', text: said.text,
          t: '2026-08-09T05:00:00.000Z', pos: [2, 1, 3], place: 'the lawn', replyTo: said.replyTo } }) });
      }
      return realFetch(url, opts);
    };
    document.getElementById('wave-hud').click();
    document.getElementById('fp-text').value = 'a thought for everyone';
    postGeneral();
    await new Promise(r => setTimeout(r, 300));
    out.said = said;
    renderStatementField();
    let stones = 0;
    scene.traverse(o => { if (o.userData && o.userData.statementId) stones++; });
    out.stones = stones;
    window.fetch = realFetch; window.feedIdentity = realId;
    closeWaveMenu();
    return out;
  });
  check('a general post goes through the door with the dg:feed marker',
        gen.said && gen.said.replyTo === 'dg:feed' && gen.said.kind === 'note',
        gen.said && (gen.said.kind + ' → ' + gen.said.replyTo));
  check('…and stands NOWHERE — no stone on any lawn', gen.stones <= 1, gen.stones + ' stone(s)');

  // ── THE HINT — three times, then never ─────────────────────────────────
  console.log('\n── the hint ──');
  const hint = await p.evaluate(() => {
    const out = {};
    localStorage.removeItem('dg_wave_opens');
    waveHintRefresh();
    const h = document.getElementById('wave-hint');
    out.fresh = h.classList.contains('on');
    // three hard activations
    for (let i = 0; i < 3; i++) {
      document.getElementById('wave-hud').click();   // open (counts)
      document.getElementById('wave-hud').click();   // close (does not)
    }
    out.count = localStorage.getItem('dg_wave_opens');
    out.gone = !h.classList.contains('on');
    waveHintRefresh();
    out.staysGone = !h.classList.contains('on');
    // and a second-visit device (count 2) still sees it
    localStorage.setItem('dg_wave_opens', '2');
    waveHintRefresh();
    out.secondVisit = h.classList.contains('on');
    localStorage.setItem('dg_wave_opens', '9');
    waveHintRefresh();
    return out;
  });
  check('a fresh device is shown the hint', hint.fresh);
  check('only OPENINGS count — three opens, count is 3', hint.count === '3', hint.count);
  check('the third opening retires it for good', hint.gone && hint.staysGone);
  check('a device on its second visit still gets it', hint.secondVisit);

  // ── THE EMBER ──────────────────────────────────────────────────────────
  console.log('\n── the unheard ember ──');
  const ember = await p.evaluate(() => {
    const out = {};
    heardTalks.clear();
    waveUnheardTick();
    out.lit = document.getElementById('wave-hud').classList.contains('unheard');
    ['a1'].forEach(id => heardTalks.add(id));
    waveUnheardTick();
    out.dark = !document.getElementById('wave-hud').classList.contains('unheard');
    return out;
  });
  check('a waiting talk lights the ember', ember.lit);
  check('…and hearing it puts it out', ember.dark);

  // ── PHOTOGRAPH ─────────────────────────────────────────────────────────
  await p.evaluate(() => { heardTalks.clear(); waveUnheardTick(); camTarget.set(0, 1.5, 20); });
  await p.mouse.move(838, 848);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: '/home/claude/dg/shot_waves.png' });

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + '   ' + (f.detail || ''))); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
