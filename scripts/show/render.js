#!/usr/bin/env node
/**
 * The export — the set page stepped frame by frame in Chrome, the clips cut in by ffmpeg, muxed with the sound.
 *
 *   node scripts/show/render.js ep01 --aspect 16:9            # 1920×1080 on this machine's GPU (Chrome, Metal)
 *   node scripts/show/render.js ep01 --aspect 16:9 --quick    # every 4th frame, for a fast look
 *   node scripts/show/render.js ep01 --aspect 16:9 --scale .5 # 960×540, for a look
 *   node scripts/show/render.js ep01 --clip coldopen          # one block as its own file (the social cut)
 *   node scripts/show/render.js ep01 --to welcome              # the top of the episode through that block (the plain file name; for a cut before the whole episode is written)
 *   node scripts/show/render.js ep01_reduced_diesel           # the earlier episodes still render (9:16 default)
 *   --software      SwiftShader instead of the GPU (the sandbox; ~10× slower)
 *   --window        a visible Chrome window instead of headless (if headless can't reach the GPU)
 *   --set desk      the black-box set (show/index.html) instead of the villa
 *   --fps N         override the episode's fps
 *   --keep          keep the per-segment files in data/show/<id>/segments/
 *   --url <base>    the served page, if not http://localhost:5500/…
 *
 * Needs: node, Chrome (PUPPETEER_EXECUTABLE_PATH, else /Applications/Google Chrome.app, else puppeteer's own),
 * ffmpeg (FFMPEG, else on PATH, else imageio-ffmpeg's: pip install --user imageio-ffmpeg), and the workspace
 * served from its root (`Serve the Workspace.command`, port 5500 — range-capable, which the clip <video> needs).
 * Run tts.py first so data/show/<id>/audio.mp3 + timeline.json exist; without them the page estimates timing and the video is silent.
 *
 * HOW THE CLIPS GO IN (2026-10-25). The page (window.SHOW) lists its beats. A beat of type 'clip' with layout
 * 'full' is not rendered by the page at all: ffmpeg cuts that span straight out of the clip file (frame-exact on
 * the show's grid), with the page's own lower third and bug laid over it (SHOW.overlay(beatId) gives a transparent
 * frame of just those). Everything else — Ted, the map, the landings — is stepped by SHOW.seek(t) and the frames
 * are piped straight into ffmpeg (nothing is written to disk but the segment files). The segments are joined and
 * the mixed track (tts.py: voice + clip sound, every part on the frame grid) is muxed on.
 *
 * Speed: the GPU Chrome on an M1 does ~0.4 s a frame at 1920×1080; SwiftShader ~4 s.
 * Writes data/show/<id>/<id>_<aspect>[_<block>][_quick][_<w>p].mp4 (H.264 yuv420p + AAC, faststart) — upload as-is.
 */
const fs = require('fs'), path = require('path'), { spawn, spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');            // Prism/
const WORKSPACE = path.resolve(ROOT, '..');                   // the folder that holds Prism/ and Transcripts/
const args = process.argv.slice(2);
const sid = args[0];
if (!sid) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const aspect = opt('--aspect', null);
const set = opt('--set', 'villa');   // villa (the desk in the Plaza) or desk (show/index.html, the black-box set)
const url = opt('--url', set === 'villa' ? 'http://localhost:5500/Prism/dreamgetty/' : 'http://localhost:5500/Prism/show/');
const quick = args.includes('--quick'), scale = +opt('--scale', 1), keep = args.includes('--keep');
const software = args.includes('--software'), windowed = args.includes('--window');
const clip = opt('--clip', null);   // a block id: render only that block's span (+ the end hold) as its own file
const to = opt('--to', null);       // a block id: render from 0 through that block's end (+0.6 s), under the plain file name (2026-10-26)

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const w = spawnSync('which', ['ffmpeg']); if (w.status === 0 && w.stdout.toString().trim()) return w.stdout.toString().trim();
  const p = spawnSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']); if (p.status === 0 && p.stdout.toString().trim()) return p.stdout.toString().trim();
  console.error('no ffmpeg: set FFMPEG=/path/to/ffmpeg, or pip install --user imageio-ffmpeg'); process.exit(2);
}
const FFMPEG = findFfmpeg();
function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; if (fs.existsSync(mac)) return mac;
  return undefined;   // puppeteer's own download, if it has one
}
const run = (a, label) => new Promise((res, rej) => { const p = spawn(FFMPEG, a, { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('close', c => c === 0 ? res() : rej(new Error((label || 'ffmpeg') + ' exited ' + c))); });

(async () => {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { try { puppeteer = require('puppeteer-core'); } catch (e2) { console.error('npm i puppeteer (in Prism/) first'); process.exit(2); } }
  const out = path.join(ROOT, 'data', 'show', sid); const segDir = path.join(out, 'segments');
  fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(segDir, { recursive: true });
  const gpuArgs = process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : ['--use-gl=angle'];
  const swArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle'];
  const browser = await puppeteer.launch({ headless: !windowed, executablePath: findChrome(),
    args: [...(software ? swArgs : gpuArgs), '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-webgl', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
      ...(windowed ? ['--window-position=4000,4000', '--window-size=480,320'] : [])] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[page]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  const q = `?${set === 'villa' ? 'show' : 's'}=${sid}&capture=1` + (aspect ? `&aspect=${aspect}` : '') + (scale !== 1 && set !== 'villa' ? `&scale=${scale}` : '');
  if (set === 'villa') await page.setViewport({ width: aspect === '16:9' ? 1920 : 1080, height: aspect === '16:9' ? 1080 : 1920, deviceScaleFactor: 1 });
  await page.goto(url + q, { waitUntil: 'load', timeout: 180000 });   // the page says when it's ready (SHOW.ready); network-idle never comes with videos streaming
  await page.waitForFunction('window.SHOW && window.SHOW.ready', { timeout: 180000 });
  const info = await page.evaluate(() => ({ duration: SHOW.duration, fps: SHOW.fps, w: SHOW.width, h: SHOW.height, aspect: SHOW.aspect, beats: SHOW.beats || [], clipsDir: SHOW.clipsDir || null }));
  const gl = await page.evaluate(() => { try { const c = document.createElement('canvas'); const g = c.getContext('webgl'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl'; } catch (e) { return '?'; } });
  const baseFps = +opt('--fps', info.fps || 24);
  const fps = quick ? baseFps / 4 : baseFps;   // --quick: a quarter of the frames, everywhere, so the clips and the page stay on one grid
  // The villa lays itself out by CSS viewport width (a narrower one is its phone layout, with another camera), so a
  // scaled villa render keeps the full CSS viewport and shrinks the pixels with deviceScaleFactor instead.
  const dsf = (set === 'villa' && scale !== 1) ? scale : 1;
  await page.setViewport({ width: info.w, height: info.h, deviceScaleFactor: dsf });
  const cssW = info.w, cssH = info.h;
  const W = Math.round(info.w * dsf), H = Math.round(info.h * dsf);
  await new Promise(r => setTimeout(r, 1500));           // let the graphmap settle after the resize
  let t0s = 0, t1s = info.duration;
  if (clip) { const blks = await page.evaluate(() => SHOW.blocks || []); const blk = blks.find(b => b.id === clip); if (!blk) { console.error('no block ' + clip + '; have: ' + blks.map(b => b.id).join(', ')); process.exit(4); }
    t0s = Math.max(0, blk.start - 0.4); t1s = Math.min(info.duration, blk.end + 0.6); console.log(`clip ${clip}: ${t0s.toFixed(1)} → ${t1s.toFixed(1)} s`); }
  if (to) { const blks = await page.evaluate(() => SHOW.blocks || []); const blk = blks.find(b => b.id === to); if (!blk) { console.error('no block ' + to + '; have: ' + blks.map(b => b.id).join(', ')); process.exit(4); }
    t1s = Math.min(info.duration, blk.end + 0.6); console.log(`to ${to}: 0 → ${t1s.toFixed(1)} s`); }
  const F = t => Math.round(t * fps);   // a time on the frame grid
  const f0 = F(t0s), f1 = F(t1s);

  // ── the segments: the page's spans, and the clip cuts between them
  const segs = []; let cursor = f0;
  const clipBeats = info.beats.filter(b => b.type === 'clip' && (b.layout || 'full') === 'full' && b.src).sort((a, b) => a.start - b.start);
  for (const b of clipBeats) {
    const bs = Math.max(f0, F(b.start)), be = Math.min(f1, F(b.end)); if (be <= bs) continue;
    if (bs > cursor) segs.push({ kind: 'page', f0: cursor, f1: bs });
    segs.push({ kind: 'clip', f0: bs, f1: be, beat: b }); cursor = be;
  }
  if (cursor < f1) segs.push({ kind: 'page', f0: cursor, f1 });
  const clipsDir = path.join(WORKSPACE, info.clipsDir || 'Transcripts/show/ep01/clips');
  const pageFrames = segs.filter(s => s.kind === 'page').reduce((n, s) => n + s.f1 - s.f0, 0);
  console.log(`${sid} · ${info.aspect} ${W}×${H} · ${info.duration.toFixed(2)} s · ${fps} fps · ${f1 - f0} frames (${pageFrames} from the page, ${f1 - f0 - pageFrames} from ${clipBeats.length} clips) · ${gl}`);

  const VENC = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps)];
  const rAF2 = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shot = (o) => page.screenshot(Object.assign({ type: 'png', clip: { x: 0, y: 0, width: cssW, height: cssH } }, o || {}));
  const t0 = Date.now(); let done = 0, ovPage = null;
  const progress = () => process.stdout.write(`\r  ${((done / Math.max(1, pageFrames)) * 100).toFixed(0)}%  ${(((Date.now() - t0) / 1000) | 0)} s  (${done ? ((Date.now() - t0) / 1000 / done).toFixed(2) : '–'} s/frame)   `);
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k]; s.file = path.join(segDir, `seg${String(k).padStart(3, '0')}.mp4`);
    if (s.kind === 'page') {
      // frames piped straight into ffmpeg
      const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0', ...VENC, s.file], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg (page segment) exited ' + c))));
      for (let i = s.f0; i < s.f1; i++) {
        await page.evaluate(t => SHOW.seek(t), i / fps); await rAF2();
        const png = await shot();
        if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
        done++; if (done % 10 === 0) progress();
      }
      ff.stdin.end(); await closed;
    } else {
      // the clip, cut by ffmpeg; the page's lower third over it
      const b = s.beat; const n = s.f1 - s.f0; const file = path.join(clipsDir, b.src + '.mp4');
      if (!fs.existsSync(file)) { console.error(`\nmissing clip file ${file}`); process.exit(5); }
      // the lower third + bug, drawn in a blank tab of their own so the frame is truly transparent (the villa's page never is)
      const ovm = await page.evaluate(id => SHOW.overlayHTML ? SHOW.overlayHTML(id) : null, b.id);
      const ov = path.join(segDir, `ov${String(k).padStart(3, '0')}.png`);
      if (ovm) {
        if (!ovPage) { ovPage = await browser.newPage(); await ovPage.setViewport({ width: cssW, height: cssH, deviceScaleFactor: dsf }); }
        await ovPage.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}${ovm.css}</style></head><body class="dream-news capture"><div id="dn">${ovm.html}</div></body></html>`, { waitUntil: 'load' });
        await ovPage.evaluate(() => document.fonts && document.fonts.ready);
        fs.writeFileSync(ov, await ovPage.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: cssW, height: cssH } }));
        await page.bringToFront();   // the set's tab must be the front one for its screenshots to work
      } else { await page.evaluate(id => SHOW.overlay(id), b.id); await rAF2(); fs.writeFileSync(ov, await shot({ omitBackground: true })); await page.evaluate(() => SHOW.overlay(null)); await rAF2(); }
      const inT = b.in + (s.f0 - F(b.start)) / fps;   // if --clip trimmed the front of this beat
      const vf = `[0:v]fps=${fps},tpad=stop_mode=clone:stop_duration=2,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1[v];[v][1:v]overlay=0:0:format=auto[o]`;
      await run(['-y', '-loglevel', 'error', '-ss', inT.toFixed(3), '-i', file, '-i', ov, '-filter_complex', vf, '-map', '[o]', '-an', '-frames:v', String(n), ...VENC, s.file], 'ffmpeg (clip ' + b.src + ')');
      process.stdout.write(`\r  clip ${b.src} ${b.in}–${b.out} → ${n} frames                    \n`);
    }
  }
  progress(); console.log('\r  100%' + ' '.repeat(50));
  await browser.close();

  // ── join, and lay the sound on
  const list = path.join(segDir, 'list.txt'); fs.writeFileSync(list, segs.map(s => `file '${s.file.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const audio = path.join(out, 'audio.mp3'), mp4 = path.join(out, `${sid}_${(info.aspect).replace(':', 'x')}${clip ? '_' + clip : ''}${quick ? '_quick' : ''}${scale !== 1 ? '_' + W + 'p' : ''}.mp4`);
  const ff = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (fs.existsSync(audio)) { if (clip) ff.push('-ss', String(t0s)); ff.push('-i', audio); }
  ff.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart');
  if (fs.existsSync(audio)) ff.push('-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-shortest');   // apad: the picture's length rules (the end hold stays)
  ff.push(mp4);
  await run(ff, 'ffmpeg (join)');
  if (!keep) fs.rmSync(segDir, { recursive: true, force: true });
  console.log(`→ ${mp4}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
})().catch(e => { console.error(e); process.exit(3); });
