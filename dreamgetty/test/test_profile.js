// The profile: a third kind, a live PROFILES, and a panel that only ever
// edits your own.
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
  await p.waitForTimeout(7000);

  await p.evaluate(() => {
    window.__as = function (key) {                       // wear an identity
      window.feedIdentity = () => (key ? { avatar: key, pass: 'x' } : null);
    };
    window.__realIdentity = window.feedIdentity;
    // A profile entry as the CURRENT gate would hand it back: kind coerced to
    // 'statement', replyTo intact. That is the case that has to work today.
    window.__coerced = function (author, name, bio, t) {
      return sanitizeFeedEntry({
        id: 'p-' + author + '-' + t, author, kind: 'statement',
        text: name + STELE_FACE_SPLIT + bio, t, pos: [1, 1, 1],
        place: 'the lawn', replyTo: 'dg:profile', to: null,
      });
    };
    // …and as it will come back once villa-gate has learned the kind.
    window.__native = function (author, name, bio, t) {
      return sanitizeFeedEntry({
        id: 'n-' + author + '-' + t, author, kind: 'profile',
        text: name + STELE_FACE_SPLIT + bio, t, pos: [1, 1, 1],
        place: 'the lawn', replyTo: null, to: null,
      });
    };
  });

  // ── THE BOUNDARY ───────────────────────────────────────────────────────
  console.log('\n── the third kind ──');
  const bound = await p.evaluate(() => {
    const c = __coerced('emilia', 'Em', 'A stoat.', '2026-08-09T10:00:00.000Z');
    const n = __native('emilia', 'Em', 'A stoat.', '2026-08-09T11:00:00.000Z');
    return {
      coercedKind: c.kind, coercedIsProfile: isProfileEntry(c), coercedReply: c.replyTo,
      nativeKind: n.kind, nativeIsProfile: isProfileEntry(n),
      statementStaysAStatement: isProfileEntry(sanitizeFeedEntry({
        id: 's', author: 'emilia', kind: 'statement', text: 'hello',
        t: '2026-08-09T10:00:00.000Z', pos: [0, 0, 0], place: 'x', replyTo: null })),
      addressUnaffected: sanitizeFeedEntry({ id: 'a', author: 'ted', kind: 'address',
        text: 'x', t: '2026-08-09T10:00:00.000Z', pos: [0,0,0], place: 'x' }).kind,
      caps: [kindTextCap('statement'), kindTextCap('address'), kindTextCap('profile')],
      split: profileSplit('Em' + STELE_FACE_SPLIT + 'A stoat.'),
      splitNoBio: profileSplit('Em'),
    };
  });
  check('the gate\'s coercion is survived by the replyTo marker',
        bound.coercedIsProfile && bound.coercedReply === 'dg:profile',
        'came back as kind "' + bound.coercedKind + '" and still reads as a profile');
  check('and a native profile kind is read straight',
        bound.nativeKind === 'profile' && bound.nativeIsProfile);
  check('an ordinary statement is untouched', !bound.statementStaysAStatement);
  check('an address is untouched', bound.addressUnaffected === 'address');
  check('each kind gets its own text cap', JSON.stringify(bound.caps) === '[400,6000,800]',
        JSON.stringify(bound.caps));
  check('name and bio split on the separator',
        bound.split.name === 'Em' && bound.split.bio === 'A stoat.');
  check('…and a bare name is still a name', bound.splitNoBio.name === 'Em');

  // ── NOT A STONE ────────────────────────────────────────────────────────
  console.log('\n── a profile is not a stone ──');
  const stone = await p.evaluate(() => {
    feedState.entries = [
      __coerced('emilia', 'Em', 'A stoat.', '2026-08-09T10:00:00.000Z'),
      sanitizeFeedEntry({ id: 'real', author: 'emilia', kind: 'statement', text: 'a real remark',
        t: '2026-08-09T09:00:00.000Z', pos: [2, 1, 3], place: 'the lawn', replyTo: null }),
    ];
    applyProfileOverrides();
    renderStatementField();
    // count the stones the field actually erected
    let stones = 0, texts = [];
    scene.traverse(o => {
      if (o.userData && o.userData.statementId) { stones++; texts.push(o.userData.statementId); }
    });
    return { stones, texts, n: feedState.entries.length };
  });
  check('two entries, and only the remark becomes a stone',
        stone.stones <= 1, stone.stones + ' stone(s) from ' + stone.n + ' entries' +
        (stone.texts.length ? ' — ' + stone.texts.join(', ') : ''));

  // ── PROFILES GOES LIVE ─────────────────────────────────────────────────
  console.log('\n── the override ──');
  const live = await p.evaluate(() => {
    const canonName = PROFILE_CANON.emilia.name, canonBio = PROFILE_CANON.emilia.bio;
    feedState.entries = [__coerced('emilia', 'Emilia Q.', 'Faster than she looks.', '2026-08-09T10:00:00.000Z')];
    applyProfileOverrides();
    const one = { name: PROFILES.emilia.name, bio: PROFILES.emilia.bio };
    // a second edit, newer, wins
    feedState.entries.push(__native('emilia', 'Em', 'Even faster.', '2026-08-09T12:00:00.000Z'));
    applyProfileOverrides();
    const two = { name: PROFILES.emilia.name, bio: PROFILES.emilia.bio };
    // an OLDER one arriving late does not
    feedState.entries.push(__coerced('emilia', 'Old', 'Older.', '2026-08-01T00:00:00.000Z'));
    applyProfileOverrides();
    const three = { name: PROFILES.emilia.name };
    // nobody else moved
    const adlibUntouched = PROFILES.adlib.name === PROFILE_CANON.adlib.name;
    // and clearing the feed puts the villa's own words back
    feedState.entries = [];
    applyProfileOverrides();
    const back = { name: PROFILES.emilia.name, bio: PROFILES.emilia.bio };
    return { canonName, canonBio, one, two, three, adlibUntouched, back,
             edited: (function () { feedState.entries = [__native('emilia','X','Y','2026-08-09T12:00:00.000Z')];
               applyProfileOverrides(); const e = profileIsEdited('emilia');
               feedState.entries = []; applyProfileOverrides(); return e; })() };
  });
  check('an edit reaches PROFILES itself', live.one.name === 'Emilia Q.' && live.one.bio === 'Faster than she looks.');
  check('the newest wins', live.two.name === 'Em' && live.two.bio === 'Even faster.');
  check('…and an older one arriving late does not', live.three.name === 'Em');
  check('nobody else is touched', live.adlibUntouched);
  check('with no override the villa\'s own words are restored',
        live.back.name === live.canonName && live.back.bio === live.canonBio, live.back.name);
  check('profileIsEdited knows the difference', live.edited);

  // and the ~30 read sites get it for free
  const readers = await p.evaluate(() => {
    feedState.entries = [__native('emilia', 'Miss Emilia', 'Dart, freeze, dart.', '2026-08-09T12:00:00.000Z')];
    applyProfileOverrides();
    __as('emilia');
    refreshDocentBtn();
    startFollow('emilia');
    const card = document.getElementById('fc-name').textContent;
    const bio = document.getElementById('fc-bio').textContent;
    const idBtn = document.getElementById('identity-btn').textContent;
    // the Compass roster and Meet read PROFILES too
    const meetName = (PROFILES.emilia || {}).name;
    stopFollow();
    return { card, bio, idBtn, meetName };
  });
  check('the follow card shows the new name', readers.card === 'Miss Emilia', readers.card);
  check('…and the new bio', readers.bio === 'Dart, freeze, dart.');
  check('the ⚿ identity button follows it too', /Miss Emilia/.test(readers.idBtn), readers.idBtn);

  // ── THE PANEL ──────────────────────────────────────────────────────────
  console.log('\n── the panel ──');
  const panel = await p.evaluate(() => {
    __as('emilia');
    openProfilePanel();
    const open = document.getElementById('profile-panel').classList.contains('open');
    const name = document.getElementById('pf-name').value;
    const bio = document.getElementById('pf-bio').value;
    revertProfile();
    const reverted = { name: document.getElementById('pf-name').value,
                       bio: document.getElementById('pf-bio').value };
    const count = document.getElementById('pf-count').textContent;
    closeProfilePanel();
    return { open, name, bio, reverted, count,
             canon: PROFILE_CANON.emilia,
             maxName: document.getElementById('pf-name').maxLength,
             maxBio: document.getElementById('pf-bio').maxLength };
  });
  check('it opens on what the villa currently calls you', panel.open && panel.name === 'Miss Emilia', panel.name);
  check('"the original" puts the villa\'s own words back in the boxes',
        panel.reverted.name === panel.canon.name && panel.reverted.bio === panel.canon.bio,
        panel.reverted.name);
  check('the bio has a counter', /\/ 320/.test(panel.count), panel.count);
  check('and the two fields fit inside the CURRENT gate\'s 400',
        panel.maxName + 3 + panel.maxBio <= 400,
        panel.maxName + ' + 3 + ' + panel.maxBio + ' = ' + (panel.maxName + 3 + panel.maxBio));

  const posted = await p.evaluate(() => {
    __as('emilia');
    let sent = null;
    const realFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('/say') >= 0) {
        sent = JSON.parse(opts.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: {
          id: 'srv', author: 'emilia', kind: 'statement', text: sent.text,
          t: '2026-08-09T13:00:00.000Z', pos: [0,0,0], place: 'x', replyTo: sent.replyTo } }) });
      }
      return realFetch(url, opts);
    };
    window.gateReady = () => true;
    openProfilePanel();
    document.getElementById('pf-name').value = 'Emilia';
    document.getElementById('pf-bio').value = 'A snow stoat who writes her own copy.';
    saveProfile();
    const out = { sent };
    window.fetch = realFetch;
    return out;
  });
  await p.waitForTimeout(400);
  check('saving posts with the profile kind', posted.sent && posted.sent.kind === 'profile',
        posted.sent && posted.sent.kind);
  check('…and with the marker that survives the gate today',
        posted.sent && posted.sent.replyTo === 'dg:profile');
  check('…packing name and bio into the one text field',
        posted.sent && posted.sent.text === 'Emilia' + ' ⁂ ' + 'A snow stoat who writes her own copy.',
        posted.sent && JSON.stringify(posted.sent.text));
  check('…within the gate\'s current limit', posted.sent && posted.sent.text.length <= 400,
        posted.sent && posted.sent.text.length + ' chars');

  const rejected = await p.evaluate(() => {
    __as('emilia');
    openProfilePanel();
    document.getElementById('pf-name').value = '   ';
    saveProfile();
    const blank = document.getElementById('pf-note').textContent;
    document.getElementById('pf-name').value = 'Em ⁂ ilia';
    saveProfile();
    const sep = document.getElementById('pf-note').textContent;
    closeProfilePanel();
    return { blank, sep };
  });
  check('a nameless profile is refused', /call you something/.test(rejected.blank), rejected.blank);
  check('a name containing the separator is refused', /spoken for/.test(rejected.sep), rejected.sep);

  // ── ONLY YOUR OWN ──────────────────────────────────────────────────────
  console.log('\n── only your own ──');
  const own = await p.evaluate(() => {
    __as('emilia');
    startFollow('emilia');
    const mineHasPencil = document.getElementById('fc-head').classList.contains('mine');
    startFollow('adlib');
    const theirsHasPencil = document.getElementById('fc-head').classList.contains('mine');
    stopFollow();
    refreshDocentBtn();
    const rowWithId = document.getElementById('profile-btn').style.display;
    __as(null);
    refreshDocentBtn();
    const rowWithout = document.getElementById('profile-btn').style.display;
    const noKey = profileMine();
    __as('emilia');
    return { mineHasPencil, theirsHasPencil, rowWithId, rowWithout, noKey };
  });
  check('the ✎ appears on your own card', own.mineHasPencil);
  check('…and not on anybody else\'s', !own.theirsHasPencil);
  check('the Compass row appears when you have a key', own.rowWithId !== 'none', JSON.stringify(own.rowWithId));
  check('…and hides when you do not', own.rowWithout === 'none');
  check('and there is no profile to edit without an identity', own.noKey === null);

  // ── THE RECORD ─────────────────────────────────────────────────────────
  const record = await p.evaluate(() => {
    __as('emilia');
    feedState.entries = [__native('emilia', 'Emilia', 'A snow stoat.', '2026-08-09T12:00:00.000Z')];
    applyProfileOverrides();
    startFollow('emilia');
    const html = document.getElementById('fc-feed-list').innerHTML;
    stopFollow();
    window.feedIdentity = window.__realIdentity;
    return { html };
  });
  check('the edit is kept in the record, as a change and not a remark',
        /wrote their own profile/.test(record.html) && !/⁂/.test(record.html),
        /⁂/.test(record.html) ? 'the separator leaked into the card' : 'reads as a change');

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + '   ' + (f.detail || ''))); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
