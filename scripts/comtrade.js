#!/usr/bin/env node
// ============================================================
// BILATERAL FLOWS — UN Comtrade (PG01 §6.2a, the hub problem · 2026-10-10)
//
// Sailor: "Does it actually make sense to have the US as the central hub?
// Isn't that somewhat overdetermined?" It was — by the data: EIA only
// reports edges that touch the US. Comtrade reports what each IMPORTER
// says it bought from whom, so Russia → India, "Malaysia" → China and
// Venezuela → China become official edges and the US becomes one node.
//
// Reporters (M49): India 699 · China 156 · Türkiye 792 · EU-27 97 ·
//   Japan 392 · Korea 410 · Brazil 76 · United States 842
// Commodities (HS): 2709 crude petroleum · 2710 petroleum products
// Flow: M (imports, as reported by the importer) · monthly
//
// THE RULE, before any row lands (PG01 §6.2a): Comtrade's primaryValue is
// in US dollars as a UNIT OF ACCOUNT (customs valuation). It is NOT evidence
// of dollar SETTLEMENT. The map must never color an edge gold because
// Comtrade priced it in dollars; settlement stays a declared layer with a
// basis, per edge. Quantities are netWgt in kg → kt here.
//
// Endpoints:
//   preview (no key, ≤500 rows/call, rate-limited):
//     https://comtradeapi.un.org/public/v1/preview/C/M/HS?...
//   full (free key from comtradeplus.un.org, header Ocp-Apim-Subscription-Key):
//     https://comtradeapi.un.org/data/v1/get/C/M/HS?...
// Comtrade lags ~2–3 months; China's "Malaysian" crude is Iranian (a
// mislabel the record performs on itself — arc material, filed as such).
//
//   node scripts/comtrade.js                 # last 18 months, preview or keyed
//   COMTRADE_KEY=… node scripts/comtrade.js  # keyed (or scripts/secrets.local.js)
//   node scripts/comtrade.js --months 6
// Writes data/active/bilateral.json. Runs in the Action (unreachable from
// the Cowork shells) or via "Fetch Active Layer.command" (which calls this).
// ============================================================
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'data', 'active');
fs.mkdirSync(OUT, { recursive: true });
let localSecrets = {}; try { localSecrets = require('./secrets.local.js'); } catch (e) {}
const KEY = process.env.COMTRADE_KEY || localSecrets.COMTRADE_KEY || '';

const REPORTERS = { 699: 'India', 156: 'China', 792: 'Türkiye', 97: 'EU-27', 392: 'Japan', 410: 'Korea', 76: 'Brazil', 842: 'United States' };
// partners we name on the map; everything else folds into "other" per reporter
const PARTNERS = { 643: 'Russia', 364: 'Iran', 862: 'Venezuela', 682: 'Saudi Arabia', 368: 'Iraq', 414: 'Kuwait', 784: 'UAE', 398: 'Kazakhstan', 458: 'Malaysia', 566: 'Nigeria', 24: 'Angola', 124: 'Canada', 484: 'Mexico', 578: 'Norway', 842: 'United States', 76: 'Brazil', 328: 'Guyana', 634: 'Qatar', 512: 'Oman', 12: 'Algeria', 434: 'Libya', 699: 'India', 156: 'China', 792: 'Türkiye', 0: 'World' };
const CMDS = { 2709: 'crude', 2710: 'products' };
const args = process.argv.slice(2), mi = args.indexOf('--months');
const MONTHS = mi >= 0 ? Number(args[mi + 1]) : 18;
const log = (...a) => console.log('[comtrade]', ...a), errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function periods(n) { const out = []; const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 2); for (let i = 0; i < n; i++) { out.unshift(d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0')); d.setUTCMonth(d.getUTCMonth() - 1); } return out; }
async function getJSON(url) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: Object.assign({ 'user-agent': 'prism-active-layer (PG01 §6)' }, KEY ? { 'Ocp-Apim-Subscription-Key': KEY } : {}) });
    if (res.status === 429 || res.status >= 500) { await sleep(8000 * (i + 1)); continue; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  throw new Error('gave up (rate limit)');
}
async function fetchReporter(rep, cmd, pers) {
  const base = KEY ? 'https://comtradeapi.un.org/data/v1/get/C/M/HS' : 'https://comtradeapi.un.org/public/v1/preview/C/M/HS';
  const q = ['reporterCode=' + rep, 'cmdCode=' + cmd, 'flowCode=M', 'period=' + pers.join(','), 'partnerCode=' + Object.keys(PARTNERS).filter(p => p !== '0').join(','), 'partner2Code=0', 'motCode=0', 'customsCode=C00', 'includeDesc=false'];
  const j = await getJSON(base + '?' + q.join('&'));
  const rows = (j && j.data) || [];
  if (j && j.count && j.count > rows.length) log('truncated', rep, cmd, pers[0] + '…' + pers[pers.length - 1], j.count, '>', rows.length, '(preview cap — fewer months per call, or a key)');
  return rows.map(r => ({ period: String(r.period).slice(0, 4) + '-' + String(r.period).slice(4, 6), reporter: REPORTERS[r.reporterCode] || String(r.reporterCode), reporterCode: r.reporterCode, partner: PARTNERS[r.partnerCode] || String(r.partnerCode), partnerCode: r.partnerCode, cmd: CMDS[String(r.cmdCode)] || String(r.cmdCode), kt: r.netWgt ? +(r.netWgt / 1e6).toFixed(1) : null, usdM: r.primaryValue ? +(r.primaryValue / 1e6).toFixed(1) : null }));
}
(async () => {
  const pers = periods(MONTHS), chunk = KEY ? 12 : 6;   // preview: ≤500 rows → ~6 months × ~25 partners
  log('reporters', Object.values(REPORTERS).join(' · '), '· periods', pers[0], '→', pers[pers.length - 1], KEY ? '· keyed' : '· preview (no key)');
  const edges = [];
  for (const rep of Object.keys(REPORTERS)) for (const cmd of Object.keys(CMDS)) for (let i = 0; i < pers.length; i += chunk) {
    const slice = pers.slice(i, i + chunk);
    try { const rows = await fetchReporter(rep, cmd, slice); edges.push(...rows); log(REPORTERS[rep], CMDS[cmd], slice[0] + '…' + slice[slice.length - 1], rows.length, 'rows'); }
    catch (e) { errors.push(REPORTERS[rep] + ' ' + CMDS[cmd] + ' ' + slice[0] + ': ' + e.message); }
    await sleep(KEY ? 800 : 2500);
  }
  const out = {
    column: 'realization', what: 'Bilateral oil flows as reported by the IMPORTER (UN Comtrade, HS 2709 crude · 2710 products, monthly, kt and USD millions). Official for the reporters listed; lags 2–3 months.',
    rule: 'primaryValue is US dollars as a unit of account (customs valuation), NOT evidence of dollar settlement. Settlement stays a declared layer with a basis, per edge (PG01 §6.2a). Never color an edge by this field.',
    reporters: REPORTERS, partners: PARTNERS, periods: pers, fetchedAt: new Date().toISOString(), keyed: !!KEY, errors, edges,
  };
  fs.writeFileSync(path.join(OUT, 'bilateral.json'), JSON.stringify(out, null, 1) + '\n');
  log('wrote data/active/bilateral.json ·', edges.length, 'edges', errors.length ? '· errors ' + errors.length : '');
  errors.forEach(e => console.error('  ✗', e));
})();
