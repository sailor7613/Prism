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
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(7000);

  // ── 1. THE CUE SYNTAX, AT BOTH SANITIZER BOUNDARIES ────────────────────
  console.log('\n── cues ──');
  const cue = await p.evaluate(() => {
    const src = 'Welcome. [[library]] Over there is the library. [[mountain]] And behind it, the peak.';
    const segs = parseAddress(src);
    const plain = addressPlainText(src);
    // the client boundary
    const survivedSafeStr = safeStr(src, 6000);
    // the entry boundary the Worker's output goes through on the way back in
    const round = sanitizeFeedEntry({
      id: 'x', author: 'ted', kind: 'address', text: src,
      t: new Date().toISOString(), pos: [0, 0, 0], place: 'the galleria',
    });
    return {
      n: segs.length,
      cues: segs.map(s => s.cue),
      texts: segs.map(s => s.text),
      plain, survivedSafeStr,
      roundText: round && round.text,
    };
  });
  check('parseAddress splits into sentences', cue.n === 3, JSON.stringify(cue.texts));
  check('a cue rides the segment it precedes', JSON.stringify(cue.cues) === JSON.stringify([null, 'library', 'mountain']), JSON.stringify(cue.cues));
  check('no bracket ever reaches Ted\'s mouth', !/\[\[/.test(cue.texts.join(' ')) && !/\[\[/.test(cue.plain));
  check('cues survive safeStr untouched', cue.survivedSafeStr.includes('[[library]]'));
  check('cues survive sanitizeFeedEntry untouched', (cue.roundText || '').includes('[[mountain]]'));

  // ── 2. THE SERIES ──────────────────────────────────────────────────────
  console.log('\n── the series ──');
  const series = await p.evaluate(() => {
    const mk = (id, t, text, replyTo) => ({
      id, author: 'ted', kind: 'address', text, t, pos: [0, 0, 0],
      place: 'the galleria', replyTo: replyTo || null, to: null,
    });
    feedState.entries = [
      mk('a1', '2026-08-01T00:00:00.000Z', 'The introduction. Welcome to the Dream Getty.'),
      mk('b1', '2026-08-05T00:00:00.000Z', 'A second talk, about the Iran redraft.'),
      mk('a2', '2026-08-09T00:00:00.000Z', 'The introduction, rewritten. Welcome again.', 'a1'),
    ];
    const s = talkSeries();
    return {
      order: s.map(x => x.entry.id),
      roots: s.map(x => x.root),
      chains: s.map(x => x.chain),
      titles: s.map(x => talkTitle(x.entry)),
      newest: newestAddress().id,
    };
  });
  check('a revision replaces its original', !series.order.includes('a1'), JSON.stringify(series.order));
  check('a revision KEEPS its place in the series', series.order[0] === 'a2', JSON.stringify(series.order));
  check('the chain reaches the root', JSON.stringify(series.chains[0]) === JSON.stringify(['a2', 'a1']), JSON.stringify(series.chains[0]));
  check('titles read as sentences', series.titles[0] === 'The introduction, rewritten.', series.titles[0]);

  // ── 3. GATING: the introduction, once, and never again ─────────────────
  console.log('\n── gating ──');
  const gate = await p.evaluate(() => {
    const out = {};
    localStorage.removeItem('dg_heard_talks'); localStorage.removeItem('dg_heard_address');
    heardTalks.clear();
    considerThreshold();
    out.freshGates = threshold.showing && threshold.entry.id === 'a2';
    endThreshold();
    out.markedHeard = heardTalks.has('a2');
    // the second talk must NOT gate
    considerThreshold();
    out.secondGates = threshold.showing;
    out.secondAnnounces = document.getElementById('announce').classList.contains('open');
    out.bannerText = document.getElementById('an-text').textContent;
    announceDismiss();
    considerThreshold();
    out.quietAfterDismiss = !threshold.showing && !document.getElementById('announce').classList.contains('open');
    return out;
  });
  check('a fresh device is stopped by the introduction', gate.freshGates);
  check('crossing the threshold marks it heard', gate.markedHeard);
  check('a LATER talk never gates', !gate.secondGates);
  check('a later talk announces instead', gate.secondAnnounces, gate.bannerText);
  check('dismissing it leaves the villa quiet', gate.quietAfterDismiss);

  const revised = await p.evaluate(() => {
    // heard a1 only — the old introduction. The rewrite must reach him, and
    // must not stop him at the door for it.
    localStorage.removeItem('dg_heard_talks');
    heardTalks.clear(); heardTalks.add('a1'); heardTalks.add('b1');
    announceHide();
    considerThreshold();
    return {
      gated: threshold.showing,
      banner: document.getElementById('announce').classList.contains('open'),
      text: document.getElementById('an-text').textContent,
    };
  });
  check('a rewritten introduction does not re-gate an old hand', !revised.gated);
  check('…it reaches him in the banner', revised.banner && /rewritten/.test(revised.text), revised.text);

  // ── 4 & 5. THE POSE, THE GATHERING AND THE RELEASE ────────────────────
  // These live in test_pose.js, which cranks the frame clock by hand. This
  // sandbox renders at ~1 fps on software GL, so measuring them by waiting
  // measures the harness (Residents Pipeline §2.8: assert state, not motion).
  // The first draft of this file did wait, and reported that Ted never got
  // up while a later check in the same run found him fully reared.

  // ── 6. THE CAMERA'S SCORE ──────────────────────────────────────────────
  console.log('\n── the camera ──');
  const cam = await p.evaluate(() => {
    const lib = PLACE_REGISTRY.find(x => x.key === 'library');
    addressApplyCue('library');
    const a = approach.endLook.clone();
    const known = compassVisited.has('library');
    addressApplyCue('mountain');
    const mt = PLACE_REGISTRY.find(x => x.key === 'mountain');
    const bm = approach.endLook.clone();
    const bad = addressApplyCue('notaplace');
    return {
      library: a.toArray(), libraryWant: lib.look,
      mountain: bm.toArray(), mountainWant: mt.look,
      taughtByCamera: known, unknownIgnored: bad === false,
    };
  });
  check('[[library]] turns the camera to the library',
        JSON.stringify(cam.library) === JSON.stringify(cam.libraryWant), JSON.stringify(cam.library));
  check('[[mountain]] turns it to the peak',
        JSON.stringify(cam.mountain) === JSON.stringify(cam.mountainWant));
  check('being SHOWN a place does not teach the Compass it', !cam.taughtByCamera);
  check('an unknown cue is ignored, not thrown', cam.unknownIgnored);

  // ── 7 & 8. THE CAPTION AND THE RELEASE — also test_pose.js, and for a
  // sharper reason: measured here the panel was CLOSED, so the column read
  // 0px wide and 0% tall and both checks passed on nothing at all.

  // ── 9. THE CONSOLE ─────────────────────────────────────────────────────
  console.log('\n── the docent\'s console ──');
  const con = await p.evaluate(() => {
    const out = {};
    // pretend to be the docent
    const realId = window.feedIdentity;
    window.feedIdentity = () => ({ avatar: 'ted', pass: 'x' });
    localStorage.removeItem('dg_address_draft');
    openDocentConsole();
    out.opensEmptyForANewTalk = document.getElementById('dc-text').value === '';
    out.cueButtons = document.getElementById('dc-cues').querySelectorAll('button').length;
    document.getElementById('dc-text').value = 'A rough cut. ';
    document.getElementById('dc-text').selectionStart = document.getElementById('dc-text').selectionEnd = 13;
    insertCue('exedra');
    out.inserted = document.getElementById('dc-text').value;
    saveDraft();
    out.draftKept = localStorage.getItem('dg_address_draft') === out.inserted;
    out.nothingPosted = !feedState.entries.some(e => /rough cut/.test(e.text));
    closeDocentConsole();
    openDocentConsole();
    out.draftComesBack = document.getElementById('dc-text').value === out.inserted;
    closeDocentConsole();
    // revise mode
    openDocentConsole('b1');
    out.revisePrefills = document.getElementById('dc-text').value === feedState.entries.find(e => e.id === 'b1').text;
    out.reviseTarget = dcRevising && dcRevising.id;
    closeDocentConsole();
    // the talks list
    compassRenderTalks();
    const rows = document.getElementById('cmp-talks').querySelectorAll('.cmp-talk');
    out.talkRows = rows.length;
    out.hasEditButtons = document.getElementById('cmp-talks').querySelectorAll('.cmp-edit').length;
    out.introLabelled = /introduction/.test(document.getElementById('cmp-talks').textContent);
    window.feedIdentity = realId;
    return out;
  });
  check('a new talk opens on an empty page, not the last one', con.opensEmptyForANewTalk);
  check('the cue rail is there', con.cueButtons === 8, con.cueButtons + ' buttons');
  check('a cue lands at the cursor', con.inserted === 'A rough cut. [[exedra]] ', JSON.stringify(con.inserted));
  check('the draft is kept on the device', con.draftKept);
  check('and NOTHING was broadcast', con.nothingPosted);
  check('the draft comes back next time', con.draftComesBack);
  check('✎ prefills the talk it revises', con.revisePrefills);
  check('…and remembers what it is revising', con.reviseTarget === 'b1', con.reviseTarget);
  check('Compass → Talks lists the series', con.talkRows === 2, con.talkRows + ' rows');
  check('the docent gets a ✎ on each', con.hasEditButtons === 2, con.hasEditButtons);
  check('the introduction is named as such', con.introLabelled);

  // ── 10. A GUEST SEES NO EDIT AFFORDANCE ────────────────────────────────
  const guest = await p.evaluate(() => {
    const real = window.feedIdentity;
    window.feedIdentity = () => ({ avatar: 'trout', pass: 'x' });
    compassRenderTalks();
    const n = document.getElementById('cmp-talks').querySelectorAll('.cmp-edit').length;
    const rows = document.getElementById('cmp-talks').querySelectorAll('.cmp-talk').length;
    window.feedIdentity = real;
    return { n, rows };
  });
  check('a guest can rewatch every talk', guest.rows === 2, guest.rows);
  check('…and cannot revise any of them', guest.n === 0);

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 8).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name)); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
