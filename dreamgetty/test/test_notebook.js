// The notebooks: a pedestal and a book in each wing, pages not stones, and
// the exedra's book takes files.
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
  await p.waitForTimeout(8000);

  console.log('\n── the pedestals ──');
  const ped = await p.evaluate(() => {
    const lib = NOTEBOOKS.library, exe = NOTEBOOKS.exedra;
    const wp = m => { const v = new THREE.Vector3(); m.getWorldPosition(v); return [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)]; };
    return {
      lib: wp(lib), exe: wp(exe),
      libInWing: lib.parent.name === 'library', exeInWing: exe.parent.name === 'annex',
      libOnStone: onVillaStone(wp(lib)[0], wp(lib)[2]), exeOnStone: onVillaStone(wp(exe)[0], wp(exe)[2]),
    };
  });
  check('a pedestal stands in the library', ped.libInWing && ped.libOnStone, JSON.stringify(ped.lib));
  check('…and one in the exedra', ped.exeInWing && ped.exeOnStone, JSON.stringify(ped.exe));

  console.log('\n── pages, not stones ──');
  const page = await p.evaluate(() => {
    const mk = (id, room, text, t) => sanitizeFeedEntry({
      id, author: 'emilia', kind: 'statement', text,
      t, pos: [(room === 'library' ? -26 : 26), 1.5, 3], place: 'the ' + room,
      replyTo: 'dg:note:' + room, to: null,
    });
    feedState.entries = [
      mk('n1', 'library', 'shelves for the north wall?', '2026-08-09T01:00:00.000Z'),
      mk('n2', 'exedra', 'the pool statue should have a name', '2026-08-09T02:00:00.000Z'),
      sanitizeFeedEntry({ id: 's1', author: 'emilia', kind: 'statement', text: 'an ordinary remark',
        t: '2026-08-09T03:00:00.000Z', pos: [2, 1, 3], place: 'the lawn', replyTo: null }),
    ];
    renderStatementField();
    let stones = 0;
    scene.traverse(o => { if (o.userData && o.userData.statementId) stones++; });
    return {
      isNote: isNotebookEntry(feedState.entries[0]),
      room: notebookRoom(feedState.entries[0]),
      remarkIsNot: !isNotebookEntry(feedState.entries[2]),
      stones,
    };
  });
  check('a note knows its book', page.isNote && page.room === 'library');
  check('an ordinary remark is not a note', page.remarkIsNot);
  check('notes never stand as stones — only the remark does', page.stones <= 1, page.stones + ' stone(s)');

  console.log('\n── the book opens ──');
  const open = await p.evaluate(() => {
    const out = {};
    openNotebook('library');
    out.opens = document.getElementById('notebook-panel').classList.contains('open');
    out.title = document.getElementById('nb-title').textContent;
    out.libEntries = document.querySelectorAll('#nb-list .nb-entry').length;
    out.libText = document.getElementById('nb-list').textContent;
    out.libFileRow = document.getElementById('nb-file-row').style.display;
    openNotebook('exedra');
    out.exeTitle = document.getElementById('nb-title').textContent;
    out.exeEntries = document.querySelectorAll('#nb-list .nb-entry').length;
    out.exeFileRow = document.getElementById('nb-file-row').style.display;
    closeNotebook();
    out.closes = !document.getElementById('notebook-panel').classList.contains('open');
    return out;
  });
  check('the library book opens with its own pages', open.opens && open.libEntries === 1 &&
        /shelves/.test(open.libText), open.title);
  check('…and no file slot — words only in the library', open.libFileRow === 'none');
  check('the exedra book has its own page', open.exeEntries === 1, open.exeTitle);
  check('…and the file slot — the exedra takes files', open.exeFileRow === 'flex');
  check('the book closes', open.closes);

  console.log('\n── writing in it ──');
  const write = await p.evaluate(() => {
    const out = {};
    const realId = window.feedIdentity;
    const realFetch = window.fetch;
    window.feedIdentity = () => ({ avatar: 'emilia', pass: 'x' });
    let said = null;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('/say') >= 0) {
        said = JSON.parse(opts.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: {
          id: 'srv1', author: 'emilia', kind: 'statement', text: said.text,
          t: '2026-08-09T04:00:00.000Z', pos: [0, 0, 0], place: 'the library', replyTo: said.replyTo } }) });
      }
      return realFetch(url, opts);
    };
    openNotebook('library');
    document.getElementById('nb-text').value = 'a thought for the book';
    postNote();
    out.said = said;
    window.fetch = realFetch; window.feedIdentity = realId;
    closeNotebook();
    return out;
  });
  await p.waitForTimeout(300);
  check('a note posts through the same door as speech',
        write.said && write.said.kind === 'note' && write.said.replyTo === 'dg:note:library',
        write.said && (write.said.kind + ' → ' + write.said.replyTo));

  console.log('\n── the file, into the exedra ──');
  const up = await p.evaluate(async () => {
    const out = {};
    const realId = window.feedIdentity;
    const realFetch = window.fetch;
    window.feedIdentity = () => ({ avatar: 'emilia', pass: 'x' });
    const calls = [];
    window.fetch = function (url, opts) {
      calls.push(String(url));
      if (String(url).indexOf('/upload') >= 0) {
        const body = JSON.parse(opts.body);
        out.uploadBody = { name: body.name, hasData: !!body.data, pass: !!body.pass };
        return Promise.resolve({ ok: true, status: 200,
          json: () => Promise.resolve({ ok: true, path: 'feed/files/123-emilia-abc-sketch.png' }) });
      }
      if (String(url).indexOf('/say') >= 0) {
        const body = JSON.parse(opts.body);
        out.noteBody = { text: body.text, replyTo: body.replyTo };
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entry: {
          id: 'srv2', author: 'emilia', kind: 'statement', text: body.text,
          t: '2026-08-09T05:00:00.000Z', pos: [26, 1.5, 3], place: 'the exedra', replyTo: body.replyTo } }) });
      }
      return realFetch(url, opts);
    };
    openNotebook('exedra');
    // hand the input a file
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'sketch.png', { type: 'image/png' }));
    document.getElementById('nb-file').files = dt.files;
    document.getElementById('nb-text').value = 'first sketch for the archive';
    uploadToNotebook();
    await new Promise(r => setTimeout(r, 600));
    out.noteText = document.getElementById('nb-note').textContent;
    // and the rendered page carries an image, not a bracket
    feedState.entries.unshift(sanitizeFeedEntry({
      id: 'f1', author: 'emilia', kind: 'statement',
      text: '[file:feed/files/123-emilia-abc-sketch.png] first sketch for the archive',
      t: '2026-08-09T06:00:00.000Z', pos: [26, 1.5, 3], place: 'the exedra',
      replyTo: 'dg:note:exedra', to: null }));
    renderNotebook();
    out.imgInPage = !!document.querySelector('#nb-list .nb-entry img');
    out.noBracketShown = document.getElementById('nb-list').textContent.indexOf('[file:') < 0;
    window.fetch = realFetch; window.feedIdentity = realId;
    closeNotebook();
    return out;
  });
  check('the file goes through the gate\'s /upload with the key',
        up.uploadBody && up.uploadBody.name === 'sketch.png' && up.uploadBody.hasData && up.uploadBody.pass);
  check('…then a note referencing it goes through /say, bound to the exedra',
        up.noteBody && /^\[file:feed\/files\//.test(up.noteBody.text) && up.noteBody.replyTo === 'dg:note:exedra',
        up.noteBody && up.noteBody.text);
  check('an image page renders the image', up.imgInPage);
  check('…and the raw bracket is never shown', up.noBracketShown);

  // no key: reading is free, writing asks for the key
  const anon = await p.evaluate(() => {
    const realId = window.feedIdentity;
    window.feedIdentity = () => null;
    openNotebook('library');
    const hint = document.getElementById('nb-note').textContent;
    const pages = document.querySelectorAll('#nb-list .nb-entry').length;
    closeNotebook();
    window.feedIdentity = realId;
    return { hint, pages };
  });
  check('without a key the pages still read', anon.pages >= 1, anon.pages + ' pages');
  check('…and the note says writing needs one', /key/.test(anon.hint), anon.hint);

  // ── photograph ──
  await p.evaluate(() => {
    parallaxEnd(); approach.active = false; autoOrbit = false; followAnimal.key = null;
    camTarget.set(-26, 2.2, 3.2);
    camTheta = -Math.PI / 2 + 0.5; targetTheta = camTheta;
    camPhi = 1.25; targetPhi = camPhi; camRadius = 4.5; targetRadius = camRadius;
  });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/claude/dg/shot_notebook.png' });
  await p.evaluate(() => {
    feedState.entries.unshift(sanitizeFeedEntry({ id: 'n9', author: 'trout', kind: 'statement',
      text: 'we should race the length of the pool', t: '2026-08-09T07:00:00.000Z',
      pos: [-26, 1.5, 3], place: 'the library', replyTo: 'dg:note:library', to: null }));
    openNotebook('library');
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/home/claude/dg/shot_notebook_open.png' });

  console.log('\npageerrors: ' + errs.length);
  errs.slice(0, 6).forEach(e => console.log('  ' + e));
  const failed = CHECKS.filter(c => !c.ok);
  console.log('\n' + (CHECKS.length - failed.length) + '/' + CHECKS.length + ' checks green, ' + errs.length + ' pageerrors');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name + '   ' + (f.detail || ''))); }
  await b.close();
  process.exit(failed.length || errs.length ? 1 : 0);
})();
