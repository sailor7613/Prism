// THE PHONE — the villa's chrome at the sizes a beta invite actually opens
// on. Every guest link goes to a phone first; until 2026-08-13 there was not
// one @media rule in the file. Layout is arithmetic, so all of this is
// assertable and none of it should ever be a matter of eye again.
const { chromium } = require('/home/claude/dg/node_modules/playwright');

const CHECKS = [];
function check(name, ok, detail) {
  CHECKS.push({ name, ok: !!ok, detail });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail !== undefined ? '   ' + detail : ''));
}

const SIZES = [
  { n: 'iPhone SE 375', w: 375, h: 667 },
  { n: 'iPhone 14 390', w: 390, h: 844 },
  { n: 'Pro Max 430', w: 430, h: 932 },
  { n: 'landscape 844', w: 844, h: 390, land: true },
];

// Everything a guest can see at once, and must be able to see WHOLE.
const CHROME = ['compass-hud', 'wave-hud', 'wave-hint', 'announce', 'nav-menu', 'tour-caption'];

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const allErrs = [];

  for (const s of SIZES) {
    console.log('\n── ' + s.n + ' (' + s.w + '×' + s.h + ') ──');
    const p = await b.newPage({ viewport: { width: s.w, height: s.h }, hasTouch: true, isMobile: true });
    p.on('pageerror', e => allErrs.push(s.n + ': ' + e.message));
    await p.goto('http://localhost:8899/index.html', { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(7000);


  // ── THE WALK PLAYS ON LOAD NOW (2026-08-16) ──
  // A suite that wants a pristine villa has to ASK for one: mark the walk
  // seen, then reload. Standing it down in place was the first attempt and
  // it is not enough — by the time a suite gets control the walk has already
  // gathered nineteen residents onto the sand and taken the wheel, so every
  // check that reads a live position (the staging, the routes, who is where)
  // was measuring the walk's leftovers. Two suites said so.
  await p.evaluate(() => { try { localStorage.setItem('dg_tour_seen_v2', '1'); } catch (e) {} });
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(7000);
    const r = await p.evaluate(async (CHROME) => {
      const wait = ms => new Promise(x => setTimeout(x, ms));
      const box = id => {
        const e = document.getElementById(id);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { l: b.left, r: b.right, t: b.top, bo: b.bottom, w: b.width, h: b.height };
      };
      // Put every piece of chrome up AT ONCE — the worst case a guest can
      // reach, not a convenient one.
      document.getElementById('wave-hint').classList.add('on');
      threshold.showing = false; announceState.entry = null; announceState.custom = null;
      tourState.on = false;
      // Raise the banner DIRECTLY. Going through considerTourStart would now
      // PLAY the walk rather than show anything, and the banner is what this
      // suite measures. Same string a guest reads, so the width it needs is
      // the width it is asked for.
      announceCustom(TOUR_INVITE, 'come along', function () {});
      if (!document.getElementById('nav-menu').classList.contains('open')) toggleNavMenu();
      compassShow('places'); compassOpenPlace('beach');
      const cap = document.getElementById('tour-caption');
      cap.classList.add('open');
      document.getElementById('tc-text').textContent =
        'The instrument on the pedestal is the graphmap: Prism’s dialectical tool. A claim stands in the field with its counters and its evidence around it, and you read the argument by walking it.';
      await wait(150);

      const out = { W: innerWidth, H: innerHeight, boxes: {} };
      CHROME.forEach(id => { out.boxes[id] = box(id); });
      out.hover = matchMedia('(hover: hover)').matches;
      // the override actually reached #announce — the end-of-sheet lesson
      const cs = getComputedStyle(document.getElementById('announce'));
      out.announceLeft = cs.left;
      out.announceBottom = cs.bottom;
      out.announceTop = cs.top;
      // did the words get a line of their own?
      const at = document.getElementById('an-text').getBoundingClientRect();
      const btns = Array.from(document.getElementById('announce').querySelectorAll('.ui-btn'))
        .map(x => x.getBoundingClientRect());
      out.textOwnLine = btns.every(x => x.top >= at.bottom - 1);
      out.textWidth = at.width;
      out.wordsPerLine = at.width / 7;   // ~7px per char at 12px Georgia, rough floor
      return out;
    }, CHROME);

    const clipped = CHROME.filter(id => {
      const x = r.boxes[id];
      return x && x.w > 0 && (x.l < -0.5 || x.r > r.W + 0.5);
    });
    check('nothing a guest sees is clipped by the screen', clipped.length === 0,
      clipped.map(id => id + ' ' + Math.round(r.boxes[id].l) + '..' + Math.round(r.boxes[id].r) +
        ' in ' + r.W).join(' · ') || '(all inside)');

    const hit = (a, c) => a && c && a.w > 0 && c.w > 0 &&
      a.bo > c.t && a.t < c.bo && a.r > c.l && a.l < c.r;
    check('the banner does not stand on the dial',
      !hit(r.boxes.announce, r.boxes['compass-hud']));
    check('the banner does not stand on the unfold',
      !hit(r.boxes.announce, r.boxes['nav-menu']));
    check('the walk’s caption clears the unfold',
      !hit(r.boxes['tour-caption'], r.boxes['nav-menu']),
      r.boxes['tour-caption'] ? 'cap x ' + Math.round(r.boxes['tour-caption'].l) + '..' +
        Math.round(r.boxes['tour-caption'].r) + ' / menu x ' +
        Math.round(r.boxes['nav-menu'].l) + '..' + Math.round(r.boxes['nav-menu'].r) : '');

    if (s.w <= 470) {
      // THE END-OF-SHEET LESSON, pinned. The phone block first sat 300 lines
      // above #announce's own rule; same specificity, later wins, so every
      // colliding declaration was dropped and only `top` survived — leaving
      // the banner with a top AND a bottom, stretched down the whole phone.
      // Asserted on GEOMETRY, not on computed strings: getComputedStyle
      // resolves `bottom` to a used pixel value on a fixed element even
      // when the sheet says auto, so the string tells you nothing. The box
      // does: if the override were lost the banner would be narrow, and
      // carrying both a top and the base rule's bottom it would stretch.
      const a = r.boxes.announce;
      check('the phone override actually reaches the banner',
        Math.abs(a.l - 12) < 1.5 && Math.abs(a.w - (r.W - 24)) < 2 && Math.abs(a.t - 12) < 1.5,
        'x ' + Math.round(a.l) + '..' + Math.round(a.r) + ' top ' + Math.round(a.t) +
        ' of ' + r.W);
      check('and the banner is a banner, not a column',
        r.boxes.announce.h < r.H * 0.35, Math.round(r.boxes.announce.h) + 'px of ' + r.H);
      check('Ted’s invitation gets a line of its own', r.textOwnLine);
      check('and enough width to read as sentences',
        r.textWidth > r.W * 0.7, Math.round(r.textWidth) + 'px of ' + r.W);
    }

    if (s.land) {
      check('in landscape the caption takes width, not height',
        r.boxes['tour-caption'].r < r.boxes['nav-menu'].l,
        'caption ends ' + Math.round(r.boxes['tour-caption'].r) +
        ', menu starts ' + Math.round(r.boxes['nav-menu'].l));
    }

    // Not a failure — the standing record of why the gesture is owed.
    check('(recorded) a phone reports no hover, so the soft ring is owed a gesture',
      r.hover === false, 'hover:' + r.hover);

    await p.close();
  }

  console.log('\n── page errors ──');
  check('0 page errors across every size', allErrs.length === 0, allErrs.join('\n      ') || '(none)');

  const bad = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - bad.length) + '/' + CHECKS.length + ' green');
  if (bad.length) { console.log('FAILED:'); bad.forEach(c => console.log('  ' + c.name + '  ' + (c.detail || ''))); }
  await b.close();
  process.exit(bad.length ? 1 : 0);
})();
