// ============================================================
// BAKE IMAGES TEST — pipeline bake + stratum story sweep
// (2026-07-20 build + 2026-07-21 stratum sweep / SKIP_SCORES)
//
// Builds a throwaway working tree, serves fixture images from a
// local HTTP server (hit-counted), and runs the real
// scripts/bake-images.js against it as a child process.
// Also exercises PrismDB.mergeCandidateScores' baked-path carry
// with a localStorage shim (the stamp must ride OUTSIDE LWW or
// the holding device's next push erases it from the file).
//
// Run:  cd Prism && node test/bake_images_test.js
// Exit 0 = all pass.
// ============================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

// ── fixture image + hit-counted server ──
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
  '01f15c4890000000d4944415478da63fcffff3f0300050201cfa07ae5' +
  '0000000049454e44ae426082', 'hex');
const hits = {};
const server = http.createServer((req, res) => {
  hits[req.url] = (hits[req.url] || 0) + 1;
  if (req.url.startsWith('/img/')) {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(PNG);
  } else if (req.url.startsWith('/dead/')) {
    res.writeHead(404); res.end();
  } else { res.writeHead(500); res.end(); }
});

// ── throwaway working tree ──
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bake-test-'));
const SCRIPT = path.join(TMP, 'scripts', 'bake-images.js');
fs.mkdirSync(path.join(TMP, 'scripts'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'data', 'readings'), { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', 'scripts', 'bake-images.js'), SCRIPT);

const D = p => path.join(TMP, ...p.split('/'));
const CAND_HEADER = '// Auto-generated — test fixture\nwindow.PRISM_CANDIDATES = ';
const CAND_TAIL = ';\n';
function writeCandidates(cands) {
  fs.writeFileSync(D('data/candidates.js'),
    CAND_HEADER + JSON.stringify(cands, null, 2) + CAND_TAIL);
}
function readCandidates() {
  const src = fs.readFileSync(D('data/candidates.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
}
function writeScores(records) {
  // browser PUT habit: 2-indent, NO trailing newline
  fs.writeFileSync(D('data/candidate_scores.json'), JSON.stringify(
    { schema: 'candidate_scores/v1', updated: '2026-07-20T02:11:15.556Z', records }, null, 2));
}
function readScores() {
  return JSON.parse(fs.readFileSync(D('data/candidate_scores.json'), 'utf8'));
}
// async — a sync exec would block this process' event loop and starve
// the fixture server (the bake would time out against a frozen socket)
function runBake(env) {
  return new Promise((resolve, reject) => {
    execFile('node', [SCRIPT], { env: { ...process.env, ...(env || {}) }, encoding: 'utf8' },
      (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve(stdout));
  });
}
const totalHits = () => Object.values(hits).reduce((a, b) => a + b, 0);

server.listen(0, '127.0.0.1', async () => {
  const B = 'http://127.0.0.1:' + server.address().port;
  try {

    // ── 1. reading rescue (regression) ──
    console.log('1. reading rescue');
    fs.writeFileSync(D('data/readings/rdg_test1.json'), JSON.stringify({
      rid: 'rdg_test1', images: [{ url: B + '/img/r1', keep: true }]
    }, null, 2));   // no trailing newline — habit must be preserved
    writeCandidates([]);
    await runBake();
    let rdg = JSON.parse(fs.readFileSync(D('data/readings/rdg_test1.json'), 'utf8'));
    ok(!!rdg.images[0].baked, 'reading image gains baked');
    ok(fs.existsSync(D(rdg.images[0].baked)), 'baked file exists on disk');
    ok(!/\n$/.test(fs.readFileSync(D('data/readings/rdg_test1.json'), 'utf8')),
      'no-trailing-newline habit preserved');

    // ── 2. in-window held candidate (regression) ──
    console.log('2. held candidate in candidates.js');
    writeCandidates([{ cid: 'cand_news_alpha', source: 'news', status: 'new', raw: {
      articles: [{ title: 'a', url: 'http://x/a', image: B + '/img/a1' },
                 { title: 'b', url: 'http://x/b', image: B + '/img/a2' }] } }]);
    writeScores({ cand_news_alpha: { mts: 100, status: 'held', title: 'a' } });
    await runBake();
    let cands = readCandidates();
    ok(cands[0].raw.articles.every(a => a.imageBaked), 'scores-held candidate articles stamped');
    ok(fs.readdirSync(D('data/news/images/cand_news_alpha')).length === 2, 'two files baked');
    ok(fs.readFileSync(D('data/candidates.js'), 'utf8').startsWith(CAND_HEADER.slice(0, 30)),
      'candidates.js header preserved');

    // ── 3. stratum story bake (rotated-out held story) ──
    console.log('3. stratum story bake — the hold outlives the scan window');
    writeCandidates([]);   // alpha rotates out entirely
    writeScores({
      cand_news_alpha: { mts: 100, status: 'held', title: 'a', story: { title: 'a', raw: {
        salience: 1, articles: [{ title: 'a', url: 'http://x/a', image: B + '/img/a1' },
                                { title: 'b', url: 'http://x/b', image: B + '/img/a2' }] } } },
      cand_news_gone: { mts: 100, status: 'dismissed', title: 'g' }
    });
    const preHits = totalHits();
    await runBake();
    let sc = readScores();
    ok(sc.records.cand_news_alpha.story.raw.articles.every(a => a.imageBaked),
      'stratum story articles stamped');
    ok(totalHits() === preHits, 'zero fetches — files already baked (same urlhash, shared dir)');
    ok(sc.records.cand_news_alpha.mts === 100, 'mts untouched — LWW undisturbed');
    ok(sc.updated === '2026-07-20T02:11:15.556Z', 'file `updated` untouched');
    ok(!/\n$/.test(fs.readFileSync(D('data/candidate_scores.json'), 'utf8')),
      'scores newline habit preserved');
    ok(fs.existsSync(D('data/news/images/cand_news_alpha')), 'prune keeps stratum-held dir');

    // ── 4. prune drops a dir held nowhere ──
    console.log('4. prune');
    fs.mkdirSync(D('data/news/images/cand_news_dead'), { recursive: true });
    fs.writeFileSync(D('data/news/images/cand_news_dead/aaaa.jpg'), PNG);
    await runBake();
    ok(!fs.existsSync(D('data/news/images/cand_news_dead')), 'unheld dir pruned');
    ok(fs.existsSync(D('data/news/images/cand_news_alpha')), 'stratum-held dir still kept');

    // ── 5. SKIP_SCORES — files yes, stratum write never ──
    console.log('5. SKIP_SCORES (the Action\'s standing rule)');
    writeScores({
      cand_news_beta: { mts: 200, status: 'held', title: 'b', story: { title: 'b', raw: {
        articles: [{ title: 'c', url: 'http://x/c', image: B + '/img/b1' }] } } },
      cand_news_alpha: readScores().records.cand_news_alpha
    });
    const scoresBytes = fs.readFileSync(D('data/candidate_scores.json'));
    const out5 = await runBake({ SKIP_SCORES: '1' });
    ok(fs.existsSync(D('data/news/images/cand_news_beta')), 'file baked under SKIP_SCORES');
    ok(scoresBytes.equals(fs.readFileSync(D('data/candidate_scores.json'))),
      'candidate_scores.json byte-identical');
    ok(/stamp withheld/.test(out5), 'withheld stamp reported');

    // ── 6. next local run stamps offline (zero fetches) ──
    console.log('6. offline stamp after SKIP_SCORES');
    const preHits6 = totalHits();
    await runBake();
    ok(!!readScores().records.cand_news_beta.story.raw.articles[0].imageBaked,
      'stamp lands on the next unrestricted run');
    ok(totalHits() === preHits6, 'zero fetches — stamped from the file the Action baked');

    // ── 7. dead URL decays gracefully ──
    console.log('7. graceful decay');
    writeScores({ cand_news_rot: { mts: 300, status: 'held', title: 'r', story: { title: 'r', raw: {
      articles: [{ title: 'd', url: 'http://x/d', image: B + '/dead/x' }] } } } });
    const out7 = await runBake();
    ok(/hotlinked \(decay\) 1/.test(out7), 'dead URL reported, exit 0');
    ok(!readScores().records.cand_news_rot.story.raw.articles[0].imageBaked, 'no stamp for a failed bake');

    // ── 8. idempotency + DRY ──
    console.log('8. idempotency + DRY');
    writeScores({ cand_news_idem: { mts: 400, status: 'held', title: 'i', story: { title: 'i', raw: {
      articles: [{ title: 'e', url: 'http://x/e', image: B + '/img/i1' }] } } } });
    await runBake();
    const preHits8 = totalHits(), preScores8 = fs.readFileSync(D('data/candidate_scores.json'));
    await runBake();
    ok(totalHits() === preHits8, 'run 2 makes zero fetches');
    ok(preScores8.equals(fs.readFileSync(D('data/candidate_scores.json'))), 'run 2 rewrites nothing');
    writeScores({ cand_news_dry: { mts: 500, status: 'held', title: 'd', story: { title: 'd', raw: {
      articles: [{ title: 'f', url: 'http://x/f', image: B + '/img/d1' }] } } } });
    await runBake({ DRY: '1' });
    ok(!fs.existsSync(D('data/news/images/cand_news_dry')), 'DRY writes no files');
    ok(!readScores().records.cand_news_dry.story.raw.articles[0].imageBaked, 'DRY stamps nothing');

    // ── 9. PrismDB merge — baked-path carry rides OUTSIDE LWW ──
    console.log('9. mergeCandidateScores baked-path carry');
    const _store = new Map();
    global.localStorage = {
      getItem: k => (_store.has(k) ? _store.get(k) : null),
      setItem: (k, v) => _store.set(k, String(v)),
      removeItem: k => _store.delete(k),
    };
    const realLog = console.log; console.log = () => {};
    eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'prismdb.js'), 'utf8') +
      '\nglobal.__PrismDB = PrismDB;');
    console.log = realLog;
    const DB = global.__PrismDB;
    DB.importCandidates([{ cid: 'cand_news_carry', source: 'news', title: 'carry', raw: {
      articles: [{ title: 'a', url: 'http://x/a', image: 'http://i/a.jpg' },
                 { title: 'b', url: 'http://x/b', image: 'http://i/b.jpg', imageBaked: 'data/news/images/cand_news_carry/already.jpg' }] } }]);
    const held = DB.holdCandidate('cand_news_carry');
    const rec = { mts: held.mts, status: 'held', title: 'carry', story: { title: 'carry', raw: {
      articles: [{ title: 'a', url: 'http://x/a', image: 'http://i/a.jpg',
                   imageBaked: 'data/news/images/cand_news_carry/aaaa.png' },
                 { title: 'b', url: 'http://x/b', image: 'http://i/b.jpg',
                   imageBaked: 'data/news/images/cand_news_carry/CLOBBER.png' }] } } };
    const m = DB.mergeCandidateScores({ cand_news_carry: rec });
    const c9 = DB.getCandidate('cand_news_carry');
    ok(c9.raw.articles[0].imageBaked === 'data/news/images/cand_news_carry/aaaa.png',
      'equal-mts record still stamps the store (outside LWW)');
    ok(c9.raw.articles[1].imageBaked === 'data/news/images/cand_news_carry/already.jpg',
      'a present imageBaked is never overwritten');
    ok(m.applied >= 1, 'stamp counts as applied — the store persists');
    const exp = DB.exportCandidateScores().cand_news_carry;
    ok(exp.story.raw.articles[0].imageBaked === 'data/news/images/cand_news_carry/aaaa.png',
      'export carries the stamp — the next push preserves it in-file');

    console.log(`\n${pass} passed, ${fail} failed`);
  } catch (e) {
    console.error('HARNESS ERROR:', e);
    fail++;
  } finally {
    server.close();
    fs.rmSync(TMP, { recursive: true, force: true });
    process.exit(fail ? 1 : 0);
  }
});
