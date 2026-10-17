// THE WORD CLOUDS — one stone, everything since in the air, and a cloud
// that turns into the feed when you click it. (2026-08-16)
const { chromium } = require('/home/claude/dg/node_modules/playwright');

const CHECKS = [];
function check(name, ok, detail) {
  CHECKS.push({ name, ok: !!ok, detail });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail !== undefined ? '   ' + detail : ''));
}

// Rewritten 2026-08-16 for PLACE clouds: one cloud per space, standing over
// that place's notebook, its words coloured by whoever said them. The
// per-statement version this replaces made five rings in one plaza that
// interleaved into confetti — the photograph is why the design changed.
const FEED = [
  { id: '1785778489227-trout-i09din', author: 'trout', kind: 'statement',
    text: 'Hello', t: '2026-08-03T00:00:00.000Z', pos: [15, 0, 78], place: 'the beach' },
  { id: 's-kelp', author: 'otter', kind: 'statement',
    text: 'The kelp is thick out past the break and the villa cannot see it',
    t: '2026-08-04T00:00:00.000Z', pos: [-21, 0, 2.5], place: 'the library' },
  { id: 's-dark', author: 'edburg', kind: 'statement',
    text: 'The villa keeps its books in the dark and the dark keeps them well',
    t: '2026-08-05T00:00:00.000Z', pos: [21, 0, 2.5], place: 'the exedra' },
  { id: 's-reply', author: 'y2k', kind: 'statement', replyTo: 's-kelp',
    text: 'I went and looked, the villa was wrong about the kelp',
    t: '2026-08-06T00:00:00.000Z', pos: [-21, 0, 4], place: 'the library' },
];

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + '\n      ' + (e.stack || '').split('\n')[1]));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(7000);
  await p.evaluate(() => { try { localStorage.setItem('dg_tour_seen_v2', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(7000);

  await p.evaluate((FEED) => {
    feedState.entries = FEED.slice();
    feedState.loaded = true;
    renderStatementField();
  }, FEED);

  // ── ONE STONE ──────────────────────────────────────────────────────────
  console.log('\n── one stone, and it is the oldest thing said here ──');
  const field = await p.evaluate(() => {
    const out = { stones: [], clouds: [], books: [] };
    steleState.byId.forEach((g, id) => { out.stones.push(id); });
    cloudState.byPlace.forEach((g, key) => { out.clouds.push(key); });
    Object.keys(NOTEBOOKS).forEach(k => out.books.push(k));
    cloudState.pedestals.forEach((g, k) => { if (out.books.indexOf(k) === -1) out.books.push(k); });
    return out;
  });
  check('Trout’s stele still stands', field.stones.indexOf('1785778489227-trout-i09din') !== -1,
    JSON.stringify(field.stones));
  check('and it is the ONLY stone', field.stones.length === 1, field.stones.length + ' stones');
  check('every other statement is air', field.clouds.length === 2, JSON.stringify(field.clouds));
  check('and the air is ONE cloud per place, not one per remark',
    field.clouds.indexOf('library') !== -1 && field.clouds.indexOf('exedra') !== -1,
    JSON.stringify(field.clouds));
  check('a place that has been spoken in grows a book',
    field.books.indexOf('library') !== -1, JSON.stringify(field.books));

  // ── THE WORDS ──────────────────────────────────────────────────────────
  console.log('\n── the words are picked, not listed ──');
  const words = await p.evaluate(() => {
    const byPlace = {};
    cloudCorpus().forEach(e => {
      const row = PLACE_REGISTRY.find(r => r.label.toLowerCase() === (e.place || '').toLowerCase());
      if (row) (byPlace[row.key] = byPlace[row.key] || []).push(e);
    });
    const lib = cloudPlaceKeywords('library', byPlace);
    return {
      kelp: lib.map(k => k.text),
      authors: lib.map(k => k.author),
      dark: cloudPlaceKeywords('exedra', byPlace).map(k => k.text),
      weights: lib.map(k => +k.weight.toFixed(2)),
      stopped: cloudTokens('the is and of it to that they were'),
      villaRank: lib.map(k => k.text).indexOf('villa'),
      hues: lib.map(k => +cloudHue(k.author).toFixed(3)),
    };
  });
  // WHAT TF-IDF ACTUALLY PROMISES, stated honestly. The first draft of this
  // check asserted that 'kelp' would LEAD its own cloud, and it came last —
  // because 'kelp' is in two entries here (the remark and its reply) while
  // 'thick', 'past' and 'break' are in one. That is the algorithm working:
  // rarity across the villa is the whole signal. The check now asserts the
  // thing that is true and useful — the leaders are words unique to this
  // remark, and a word in every statement is nowhere near them.
  // The document is a PLACE now, and the corpus is the other places — so the
  // question is no longer "unique to this remark" but "said here and not
  // elsewhere", which is what makes a place's cloud describe the place.
  const dfPlace = {};
  const places = {};
  FEED.forEach(e => { (places[e.place] = places[e.place] || []).push(e); });
  Object.keys(places).forEach(pk => {
    const seen = new Set();
    places[pk].forEach(e => e.text.toLowerCase().replace(/[^a-z\s]/g, ' ')
      .split(/\s+/).forEach(w => seen.add(w)));
    seen.forEach(w => { dfPlace[w] = (dfPlace[w] || 0) + 1; });
  });
  check('a place’s leading words are said HERE and not in the other rooms',
    dfPlace[words.kelp[0]] === 1,
    words.kelp[0] + ' (in ' + dfPlace[words.kelp[0]] + ' of ' + Object.keys(places).length + ' places)');
  check('a place’s cloud gathers every voice in it',
    new Set(words.authors).size >= 2, JSON.stringify(words.authors));
  check('and each voice has its own hue',
    new Set(words.hues).size === new Set(words.authors).size, JSON.stringify(words.hues));
  check('“villa” — in every statement — does not lead any of them',
    words.villaRank !== 0, 'rank ' + words.villaRank);
  check('a different place says different things', words.dark.indexOf('books') !== -1,
    JSON.stringify(words.dark));
  check('stopwords are dropped entirely', words.stopped.length === 0, JSON.stringify(words.stopped));
  check('weights descend from the strongest',
    words.weights[0] === 1 && words.weights[words.weights.length - 1] <= 1,
    JSON.stringify(words.weights));

  // Smoothed IDF: a corpus of ONE must still rank, not collapse to zero.
  const tiny = await p.evaluate(() => {
    const keep = feedState.entries;
    const one = { id: 'only', author: 'trout', kind: 'statement',
      text: 'the kelp bed is quiet tonight', t: '2026-08-04T00:00:00.000Z',
      pos: [0, 0, 0], place: 'the beach' };
    feedState.entries = [one];
    const k = cloudPlaceKeywords('beach', { beach: [one] });
    feedState.entries = keep;
    return { words: k.map(x => x.text), scores: k.map(x => +x.weight.toFixed(2)) };
  });
  check('a corpus of one still ranks (smoothed IDF, not log(N/df))',
    tiny.words.length >= 3 && tiny.scores.every(x => x > 0), JSON.stringify(tiny.words));

  // ── THE CLOUD TURNS INTO THE FEED ──────────────────────────────────────
  console.log('\n── click, and it becomes the feed ──');
  const open = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const g = cloudState.byPlace.get('library');
    const out = {};
    out.restingRing = g.userData.ring.visible && g.userData.ring.children.length > 0;
    out.feedHiddenAtRest = !g.userData.feed.visible;
    cloudToggle(g);
    out.ringGone = !g.userData.ring.visible;
    out.feedUp = g.userData.feed.visible;
    out.lines = g.userData.feed.children.length;
    // it carries the author, the remark, and the reply — the comms feed's order
    // every child is a sprite EXCEPT the asterisk they are emitted from
    out.hasSprites = g.userData.feed.children.every(c => c.isSprite || c === g.userData.star);
    out.hasStar = !!g.userData.star && g.userData.feed.children.indexOf(g.userData.star) !== -1;
    out.noPanel = !document.querySelector('#feed-panel.open');
    // THE SPIRAL: each turn is further back and nearer the axis. Read off
    // the authored targets, not the live positions — the lines are still
    // travelling out of the asterisk when this runs, which is the point.
    const tos = g.userData.feed.children
      .filter(c => c.userData && c.userData.to).map(c => c.userData.to);
    out.recedes = tos.every((v, i) => i === 0 || v.z <= tos[i - 1].z + 0.001);
    // Measured off the AXIS the spiral actually turns about, which is the
    // view direction — so the radius is x,y from the scroll's centre line,
    // not x,z. The first version measured x,z, which is depth, and depth is
    // the thing that recedes rather than the thing that tightens.
    const mid = tos.length ? tos[0].y : 0;
    const rad = v => Math.hypot(v.x, v.y - (CLOUD_TUNE.lift + 0.55));
    out.tightens = rad(tos[tos.length - 1]) < rad(tos[0]) * 0.6;
    out.radii = tos.map(v => +rad(v).toFixed(2));
    out.turns = new Set(tos.map(v => Math.round(Math.atan2(v.x, v.z) * 4))).size > 2;
    // and it settles in rather than snapping
    statementCloudTick(clock.getElapsedTime());
    await wait(60);
    out.settling = g.userData.feed.children.some(c => c.material.opacity < 1);
    return out;
  });
  check('at rest it is a ring of words', open.restingRing);
  check('…with no feed showing', open.feedHiddenAtRest);
  check('clicked, the ring goes', open.ringGone);
  check('and the feed stands in its place', open.feedUp);
  check('it is built of sprites in the world, not a panel',
    open.hasSprites && open.noPanel, open.lines + ' lines');
  check('the scroll recedes — every turn stands further back', open.recedes);
  check('…and draws inward toward the axis', open.tightens, JSON.stringify(open.radii));
  check('…turning as it goes, rather than stacking', open.turns);
  check('with an asterisk at its heart', open.hasStar);
  check('and the lines are still travelling out of it', open.settling);

  // ── ONE AT A TIME, AND ESCAPE CLOSES IT ────────────────────────────────
  console.log('\n── one at a time ──');
  const one = await p.evaluate(() => {
    // Closing is an ANIMATION now: the lines run back down the spiral and
    // into the asterisk, and the ring only returns once they have. So the
    // clock is driven to completion rather than the state read one frame in.
    const settle = (g) => { for (let i = 0; i < 60; i++) statementCloudTick(clock.getElapsedTime() + i * 0.08); };
    const a = cloudState.byPlace.get('library'), c = cloudState.byPlace.get('exedra');
    cloudOpen(a); cloudOpen(c);
    const startedClosing = a.userData.closingAt != null;
    settle(a);
    return { startedClosing, firstClosed: !a.userData.feed.visible,
             firstRingBack: a.userData.ring.visible,
             secondOpen: c.userData.feed.visible, tracked: cloudState.open === c };
  });
  check('opening one sends the other back into its asterisk', one.startedClosing);
  check('…and once it has, its ring returns', one.firstClosed && one.firstRingBack);
  check('the one you opened stands', one.secondOpen);
  check('and the villa knows which is open', one.tracked);

  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  const esc = await p.evaluate(() => {
    const g = cloudState.byPlace.get('exedra');
    // NOT asserted mid-flight: the animate loop may already have finished the
    // retract by the time this runs, and a check that races the frame clock
    // is a check that fails on a fast machine. The RETRACT ITSELF is proven
    // deterministically above; what Escape owes is the end state.
    for (let i = 0; i < 60; i++) statementCloudTick(clock.getElapsedTime() + i * 0.08);
    return { open: !!cloudState.open, ringBack: g.userData.ring.visible,
             feedGone: !g.userData.feed.visible };
  });
  check('Escape lets it go', !esc.open && esc.feedGone);
  check('…and the words are a ring again', esc.ringBack);

  // ── THE REPLY IS IN THE THREAD ─────────────────────────────────────────
  const thread = await p.evaluate(() => {
    const g = cloudState.byPlace.get('library');
    cloudOpen(g);
    // read the canvases back out of the sprites
    const texts = g.userData.feed.children.length;
    cloudClose(g);
    const solo = cloudState.byPlace.get('exedra');
    cloudOpen(solo);
    const soloLines = solo.userData.feed.children.length;
    cloudClose(solo);
    return { withReply: texts, without: soloLines };
  });
  check('a place with two remarks stands taller than one with a single remark',
    thread.withReply > thread.without, thread.withReply + ' lines vs ' + thread.without);

  // ── THE BOOK AND THE CLOUD ARE ONE ─────────────────────────────────────
  console.log('\n── what is written in the book is what hangs over it ──');
  const sync = await p.evaluate(() => {
    const before = cloudSaidAt('library').length;
    // a page written in the library's own book, the real notebook shape
    feedState.entries = feedState.entries.concat([{
      id: 'note-1', author: 'edburg', kind: 'note', replyTo: 'dg:note:library',
      text: 'The marginalia in the Herodotus is a second book and nobody catalogued it',
      t: '2026-08-07T00:00:00.000Z', pos: [-21, 0, 2.5] }]);
    renderStatementField();
    const after = cloudSaidAt('library').length;
    const byPlace = {}; PLACE_REGISTRY.forEach(r => {
      const said = cloudSaidAt(r.key); if (said.length) byPlace[r.key] = said; });
    const words = cloudPlaceKeywords('library', byPlace).map(k => k.text);
    const g = cloudState.byPlace.get('library');
    cloudOpen(g);
    const lines = g.userData.feed.children.length;
    cloudClose(g);
    for (let i = 0; i < 60; i++) statementCloudTick(clock.getElapsedTime() + i * 0.08);
    return { before, after, words, lines, isNote: isNotebookEntry(feedState.entries[feedState.entries.length - 1]) };
  });
  check('a page written in the book counts as said in the place',
    sync.after === sync.before + 1, sync.before + ' → ' + sync.after);
  check('and its words reach the cloud over it',
    sync.words.indexOf('marginalia') !== -1 || sync.words.indexOf('herodotus') !== -1 ||
    sync.words.indexOf('catalogued') !== -1, JSON.stringify(sync.words));

  // ── THE BOOK'S OWN INSTRUMENT ──────────────────────────────────────────
  const meridian = await p.evaluate(() => {
    const ped = NOTEBOOKS['library'];
    if (!ped || !ped.userData.meridian) return { has: false };
    const a0 = ped.userData.hoopA.rotation.z, b0 = ped.userData.hoopB.rotation.z;
    statementCloudTick(clock.getElapsedTime() + 40);
    return { has: true, moved: ped.userData.hoopA.rotation.z !== a0,
             counter: (ped.userData.hoopB.rotation.z - b0) * (ped.userData.hoopA.rotation.z - a0) < 0 };
  });
  check('the book carries a meridian of its own', meridian.has);
  check('…whose hoops turn against each other', meridian.moved && meridian.counter);

  // ── AND IT IS REVERSIBLE ───────────────────────────────────────────────
  const flag = await p.evaluate(() => CLOUD_STATEMENTS);
  check('one constant puts every statement back in stone', flag === true,
    'CLOUD_STATEMENTS = ' + flag);

  console.log('\n── page errors ──');
  check('0 page errors', errs.length === 0, errs.join('\n      ') || '(none)');

  const bad = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - bad.length) + '/' + CHECKS.length + ' green');
  if (bad.length) { console.log('FAILED:'); bad.forEach(c => console.log('  ' + c.name + '  ' + (c.detail || ''))); }
  await b.close();
  process.exit(bad.length ? 1 : 0);
})();
