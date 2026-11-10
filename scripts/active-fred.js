#!/usr/bin/env node
// ============================================================
// THE OBJECT'S BODY — the standing measures beyond energy (2026-11-10, Sailor: "I want to make sure that we are
// tracking the object as being more than just the war").
//
// Eight public series from FRED (Federal Reserve Bank of St. Louis), by its keyless CSV route — no key, no account:
//   CPIAUCSL        the cost of living   — CPI, all items, monthly (BLS)
//   CUSR0000SAF11   groceries            — CPI, food at home, monthly (BLS)
//   CES0500000003   wages                — average hourly earnings, private, monthly (BLS)
//   UNRATE          jobs                 — the unemployment rate, monthly (BLS)
//   MORTGAGE30US    the mortgage         — 30-year fixed average, weekly (Freddie Mac)
//   SP500           the market           — S&P 500, daily
//   DGS10           the ten-year         — 10-year Treasury yield, daily
//   UMCSENT         the mood             — consumer sentiment, monthly (University of Michigan)
//
// Writes data/active/fred.json; scripts/object-build.py reads it into object.json as standing measures.
// Every series fails soft: an error is written into the file and the rest still runs. Nothing here scores z.
// Usage: node scripts/active-fred.js        (or double-click "Fetch the Body.command")
// ============================================================
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'active', 'fred.json');
const START = process.env.FRED_START || '2022-01-01';   // a year before the charts begin, so a year-on-year change can be drawn from 2023
const SERIES = [
  ['CPIAUCSL', 'the cost of living', 'CPI, all items (index, 1982-84 = 100), monthly — BLS'],
  ['CUSR0000SAF11', 'groceries', 'CPI, food at home (index), monthly — BLS'],
  ['CES0500000003', 'wages', 'average hourly earnings, all private employees ($), monthly — BLS'],
  ['UNRATE', 'jobs', 'the unemployment rate (%), monthly — BLS'],
  ['MORTGAGE30US', 'the mortgage', '30-year fixed mortgage average (%), weekly — Freddie Mac'],
  ['SP500', 'the market', 'S&P 500 (index), daily'],
  ['DGS10', 'the ten-year', '10-year Treasury yield (%), daily'],
  ['UMCSENT', 'the mood', 'consumer sentiment (index, 1966 Q1 = 100), monthly — University of Michigan'],
];
const log = (...a) => console.log('[fred]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the CSV is two columns: a date, a value. A missing day is a "."; the header's names have changed before, so neither is assumed.
function parse(csv) {
  const out = [];
  for (const line of String(csv).split(/\r?\n/)) {
    const [d, v] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test((d || '').trim())) continue;
    const n = Number((v || '').trim());
    if ((v || '').trim() === '' || (v || '').trim() === '.' || !isFinite(n)) continue;
    out.push([d.trim(), n]);
  }
  return out;
}
async function get(id, tries = 3) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${START}`;
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'prism-object-body (keyless CSV)' } });
      const txt = await res.text();
      if (res.status === 429 || res.status >= 500) { last = 'HTTP ' + res.status; await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + txt.slice(0, 120));
      if (/^\s*</.test(txt)) throw new Error('the server answered with a page, not data');
      const pts = parse(txt);
      if (!pts.length) throw new Error('no rows in the answer: ' + txt.slice(0, 80).replace(/\s+/g, ' '));
      return pts;
    } catch (e) { last = e.message; if (i === tries - 1) break; await sleep(1500 * (i + 1)); }
  }
  throw new Error(String(last));
}
async function main() {
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  const doc = { what: "the object's standing body beyond energy — eight public series from FRED's keyless CSV route. Nothing here scores z.",
                source: 'https://fred.stlouisfed.org (Federal Reserve Bank of St. Louis)', fetched: new Date().toISOString(), start: START, series: {}, errors: [] };
  for (const [id, label, what] of SERIES) {
    try {
      const pts = await get(id);
      doc.series[id] = { label, what, points: pts, last: pts[pts.length - 1] };
      log(id.padEnd(14), label.padEnd(20), pts.length, 'points →', pts[pts.length - 1].join(' '));
    } catch (e) {
      doc.errors.push({ id, error: e.message });
      if (prev.series && prev.series[id]) { doc.series[id] = Object.assign({}, prev.series[id], { stale: true }); log(id, 'failed —', e.message, '— kept the last copy'); }
      else log(id, 'failed —', e.message);
    }
    await sleep(400);
  }
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
  log(Object.keys(doc.series).length + ' of ' + SERIES.length + ' series written to data/active/fred.json' + (doc.errors.length ? ' · ' + doc.errors.length + ' failed' : ''));
  if (!Object.keys(doc.series).length) process.exit(1);
}
if (require.main === module) main().catch(e => { console.error('[fred] stopped:', e.message); process.exit(1); });
module.exports = { parse };
