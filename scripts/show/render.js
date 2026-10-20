#!/usr/bin/env node
/**
 * The export — the set page stepped frame by frame in headless Chromium, muxed with the voice.
 *
 *   node scripts/show/render.js ep01_reduced_diesel                 # Dream News in the villa, 9:16 (1080×1920)
 *   node scripts/show/render.js ep01_reduced_diesel --clip reduced  # one block as its own file (the social cut)
 *   node scripts/show/render.js ep01_reduced_diesel --set desk      # the black-box set (show/index.html)
 *   node scripts/show/render.js ep01_reduced_diesel --aspect 16:9   # 1920×1080, YouTube
 *   node scripts/show/render.js ep01_reduced_diesel --fps 24 --quick  # every 4th frame, for a fast look
 *
 * Needs: node, ffmpeg, and puppeteer (npm i puppeteer in Prism/ — downloads its own Chromium; if that
 * download is blocked where you are, set PUPPETEER_EXECUTABLE_PATH to any Chrome/Chromium) and the
 * workspace served (`Serve the Workspace.command`, port 5500; or --url to point elsewhere).
 * Run tts.py first so data/show/<id>/audio.mp3 + timeline.json exist; without them the page estimates
 * timing and the video is silent.
 *
 * Software GL (no GPU) takes ~3 s a frame at 1080×1920: a 2-minute segment is ~2.5 h at 24 fps. Use --quick
 * and/or --scale .5 while iterating; run the full one unattended.
 *
 * Writes data/show/<id>/frames/*.png (deleted after) and data/show/<id>/<id>_<aspect>.mp4
 * (H.264, yuv420p, AAC) — upload as-is. captions.srt sits beside it if the platform wants a file.
 */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const sid = args[0];
if (!sid) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const aspect = opt('--aspect', null);
const set = opt('--set', 'villa');   // villa (Dream News, the desk in the Plaza) or desk (show/index.html, the black-box set)
const url = opt('--url', set === 'villa' ? 'http://localhost:5500/Prism/dreamgetty/' : 'http://localhost:5500/Prism/show/');
const quick = args.includes('--quick'), scale = +opt('--scale', 1);
const clip = opt('--clip', null);   // a block id: render only that block's span (+ the end card) as its own file   // --scale .5 → 540×960, ~4× faster; for a look, not for posting

(async () => {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { try { puppeteer = require('puppeteer-core'); } catch (e2) { console.error('npm i puppeteer (in Prism/) first'); process.exit(2); } }
  const out = path.join(ROOT, 'data', 'show', sid); const frames = path.join(out, 'frames');
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[page]', e.message));
  const q = `?${set === 'villa' ? 'show' : 's'}=${sid}&capture=1` + (aspect ? `&aspect=${aspect}` : '') + (scale !== 1 && set !== 'villa' ? `&scale=${scale}` : '');
  if (set === 'villa') await page.setViewport({ width: aspect === '16:9' ? 1920 : 1080, height: aspect === '16:9' ? 1080 : 1920, deviceScaleFactor: 1 });
  await page.goto(url + q, { waitUntil: 'networkidle2', timeout: 180000 });
  await page.waitForFunction('window.SHOW && window.SHOW.ready', { timeout: 60000 });
  const info = await page.evaluate(() => ({ duration: SHOW.duration, fps: SHOW.fps, w: SHOW.width, h: SHOW.height, aspect: SHOW.aspect }));
  const fps = +opt('--fps', info.fps || 24);
  if (set === 'villa' && scale !== 1) { info.w = Math.round(info.w * scale); info.h = Math.round(info.h * scale); }   // the villa fills the viewport; scale = a smaller viewport
  await page.setViewport({ width: info.w, height: info.h, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 1500));           // let the graphmap settle after the resize
  let t0s = 0, t1s = info.duration;
  if (clip) { const blks = await page.evaluate(() => SHOW.blocks || []); const blk = blks.find(b => b.id === clip); if (!blk) { console.error('no block ' + clip + '; have: ' + blks.map(b => b.id).join(', ')); process.exit(4); }
    t0s = Math.max(0, blk.start - 0.4); t1s = Math.min(info.duration, blk.end + 0.6); console.log(`clip ${clip}: ${t0s.toFixed(1)} → ${t1s.toFixed(1)} s`); }
  const step = quick ? 4 : 1, first = Math.floor(t0s * fps), total = Math.ceil(t1s * fps);
  console.log(`${sid} · ${info.aspect} ${info.w}×${info.h} · ${info.duration.toFixed(1)} s · ${fps} fps · ${total} frames`);
  const t0 = Date.now();
  for (let i = first; i < total; i += step) {
    await page.evaluate(t => SHOW.seek(t), i / fps);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(6, '0')}.png`), type: 'png', clip: { x: 0, y: 0, width: info.w, height: info.h } });
    if (i % (fps * 5) === 0) process.stdout.write(`\r  ${(((i - first) / (total - first)) * 100).toFixed(0)}%  ${(((Date.now() - t0) / 1000) | 0)} s`);
  }
  console.log('\r  100%');
  await browser.close();
  const audio = path.join(out, 'audio.mp3'), mp4 = path.join(out, `${sid}_${(info.aspect).replace(':', 'x')}${clip ? '_' + clip : ''}${quick ? '_quick' : ''}${scale !== 1 ? '_' + info.w + 'p' : ''}.mp4`);
  const ff = ['-y', '-loglevel', 'error', '-framerate', String(fps / step), '-pattern_type', 'glob', '-i', path.join(frames, 'f*.png')];
  if (fs.existsSync(audio)) { if (clip) ff.push('-ss', String(t0s)); ff.push('-i', audio); }
  ff.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (fs.existsSync(audio)) ff.push('-c:a', 'aac', '-b:a', '160k', '-shortest');
  ff.push(mp4);
  const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(3); }
  fs.rmSync(frames, { recursive: true, force: true });
  console.log(`→ ${mp4}`);
})();
