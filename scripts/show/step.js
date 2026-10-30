/* step.js — step the set frame by frame the way render.js does, and screenshot chosen moments (2026-10-25).
 *   node scripts/show/step.js ep01 309.4 316 310 313.9 316      # from 309.4 s to 316 s at the episode's fps; PNGs at 310, 313.9, 316
 *   --url <base>   the served page (default http://localhost:5500/Prism/dreamgetty/)
 *   --width N      viewport width (default 960; the page keeps the episode's aspect)
 * Writes data/show/<id>/stills/step_<t>.png and prints SHOW.dbg() at each shot (the map's pose, the desk spot, the map in the desk's frame).
 * Why not jump straight to a time: the villa's own loop keeps running between jumps and settles every pose, so a jump
 * hides what continuous stepping shows (and what the load order does — the desk-spot race was found this way). */
const fs = require('fs'), path = require('path');
const puppeteer = require(path.join(__dirname, '..', '..', 'node_modules', 'puppeteer'));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [sid, t0, t1, ...shots] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).map((v, i) => i ? Number(v) : v);
if (!sid || isNaN(t0) || isNaN(t1)) { console.error('usage: node scripts/show/step.js <episode> <t0> <t1> [shot times…]'); process.exit(1); }
const base = opt('--url', 'http://localhost:5500/Prism/dreamgetty/'), W = +opt('--width', 960);
const out = path.join(__dirname, '..', '..', 'data', 'show', sid, 'stills'); fs.mkdirSync(out, { recursive: true });
const chrome = process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
(async () => {
  const browser = await puppeteer.launch({ headless: true, executablePath: chrome,
    args: ['--use-gl=angle', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []), '--ignore-gpu-blocklist', '--no-sandbox', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.setViewport({ width: W, height: Math.round(W * 9 / 16), deviceScaleFactor: 1 });
  await page.goto(`${base}?show=${sid}&capture=1&aspect=16:9`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.SHOW && window.SHOW.ready', { timeout: 180000 });
  const info = await page.evaluate(() => ({ fps: SHOW.fps, aspect: SHOW.aspect, w: SHOW.width, h: SHOW.height }));
  if (info.aspect !== '16:9') await page.setViewport({ width: W, height: Math.round(W * info.h / info.w), deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 1500));
  const rAF = () => page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
  const fps = info.fps || 30; let next = 0;
  for (let f = Math.round(t0 * fps); f <= Math.round(t1 * fps); f++) {
    const t = f / fps;
    await page.evaluate(t => SHOW.seek(t), t); await rAF();
    if (next < shots.length && t >= shots[next] - 1e-6) {
      const fn = path.join(out, `step_${shots[next].toFixed(2)}.png`); await page.screenshot({ path: fn, type: 'png' });
      const d = await page.evaluate(() => (SHOW.dbg ? SHOW.dbg() : null));
      console.log(`${t.toFixed(2)} → ${fn}` + (d ? `\n   ${JSON.stringify(d)}` : '')); next++;
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
