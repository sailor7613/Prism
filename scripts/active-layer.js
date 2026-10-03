#!/usr/bin/env node
// ============================================================
// THE ACTIVE LAYER — PG01 §6 (ruled 2026-10-02).
// Fetches the arc's time-series columns and writes data/active/.
//
//   (a) realization — where the barrel goes. US crude imports by
//       country of origin, US crude exports by destination, weekly
//       totals. EIA APIv2 (official; dated as-of by period).
//   (b) detection  — when it was read. GDELT DOC timeline volume per
//       theater (Iran · Russia · Venezuela). Dated by DETECTION, filed
//       as such (PG01 §6.2b: filed as as-of it would be a frame leak).
//   (c) price      — the shadow. Brent, WTI, US regular gasoline.
//       EIA, kept last.
//
// Hand-dated files the script NEVER touches (accruals stay accruals):
//   data/active/accruals.json — sanctioned-theater flows, estimated,
//                               with as-of + detected dates + settlement
//   data/active/events.json   — the detection series' dated events
//   data/active/hypotheses.json — the ledger's predictions this page draws (P3)
//
// Guards (PG01 §6.3): no row carries a z; no causal field exists; the
// still frame's axes are drawn by the map, never computed here.
//
// Runs in the GitHub Action (scripts/github-workflows/active-layer.yml)
// because EIA/GDELT are unreachable from the Cowork shells — or on the
// Mac via "Fetch Active Layer.command". Needs EIA_API_KEY (free:
// https://www.eia.gov/opendata/register.php) in the env or in
// scripts/secrets.local.js. GDELT needs no key.
//
//   node scripts/active-layer.js            # all columns
//   node scripts/active-layer.js --eia      # realization + price only
//   node scripts/active-layer.js --gdelt    # detection only
//   node scripts/active-layer.js --bundle   # no fetch; rebundle active.json from disk
// ============================================================
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'active');
fs.mkdirSync(OUT, { recursive: true });

let localSecrets = {};
try { localSecrets = require('./secrets.local.js'); } catch (e) { /* optional */ }
const EIA_KEY = process.env.EIA_API_KEY || localSecrets.EIA_API_KEY || '';

const args = new Set(process.argv.slice(2));
const DO_EIA = !args.has('--gdelt') && !args.has('--bundle');
const DO_GDELT = !args.has('--eia') && !args.has('--bundle');   // --bundle: rebuild active.json from what's on disk, no fetch
const START = process.env.ACTIVE_START || '2024-01';   // the arc's film starts Feb 2025; a year of runway before it

const errors = [];
const log = (...a) => console.log('[active]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'prism-active-layer (PG01 §6)' } });
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url.replace(/api_key=[^&]+/, 'api_key=…'));
      return await res.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(2000 * (i + 1)); }
  }
  throw new Error('gave up: ' + url.replace(/api_key=[^&]+/, 'api_key=…'));
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 1) + '\n');
  log('wrote', path.relative(ROOT, file), Math.round(fs.statSync(file).size / 1024) + ' KB');
}

// ── EIA APIv2 ─────────────────────────────────────────────────
// Rows come back with period + facet ids + their names + value + units.
// We never hard-code area codes: the response names the country.
async function eiaRows(route, facets, frequency, start) {
  const base = 'https://api.eia.gov/v2/' + route + '/data/';
  const rows = [];
  let offset = 0;
  for (;;) {
    const q = ['api_key=' + encodeURIComponent(EIA_KEY), 'frequency=' + frequency, 'data[0]=value',
      'start=' + start, 'sort[0][column]=period', 'sort[0][direction]=asc', 'length=5000', 'offset=' + offset];
    Object.entries(facets).forEach(([k, vs]) => vs.forEach(v => q.push('facets[' + k + '][]=' + encodeURIComponent(v))));
    const j = await getJSON(base + '?' + q.join('&'));
    const d = (j && j.response && j.response.data) || [];
    if (j && j.response && j.response.warnings) log('eia warning', route, JSON.stringify(j.response.warnings).slice(0, 200));
    rows.push(...d);
    const total = Number((j.response && j.response.total) || 0);
    offset += d.length;
    if (!d.length || offset >= total) break;
    await sleep(600);
  }
  return rows;
}

const pick = (r, ...keys) => { for (const k of keys) if (r[k] != null) return r[k]; return undefined; };

// A normalized flow row: { period, area, areaId, product, value, units, series }
function normFlow(r) {
  return {
    period: r.period,
    area: pick(r, 'area-name', 'areaName', 'duoarea'),
    areaId: pick(r, 'duoarea', 'area'),
    product: pick(r, 'product-name', 'productName', 'product'),
    productId: r.product,
    process: pick(r, 'process-name', 'processName', 'process'),
    value: r.value == null ? null : Number(r.value),
    units: r.units,
    series: r.series,
  };
}

// Group rows into { seriesKey: { label, units, points: [[period, value]] } }
function toSeries(rows, keyOf, labelOf) {
  const out = {};
  for (const r of rows) {
    if (r.value == null || Number.isNaN(r.value)) continue;
    const k = keyOf(r);
    if (!k) continue;
    (out[k] = out[k] || { label: labelOf(r), units: r.units, points: [] }).points.push([r.period, r.value]);
  }
  for (const s of Object.values(out)) {
    const m = new Map(); s.points.forEach(([p, v]) => m.set(p, v));
    s.points = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  return out;
}

async function fetchEIA() {
  if (!EIA_KEY) { errors.push('EIA: no EIA_API_KEY (env or scripts/secrets.local.js) — realization + price skipped'); return; }
  const realization = readJSON(path.join(OUT, 'realization_us.json'), {});
  const price = readJSON(path.join(OUT, 'price.json'), {});

  // (a) US crude imports by country of origin — monthly, Mbbl/d.
  //     route petroleum/move/impcus · product EPC0 (crude) · process IM0 (imports)
  try {
    const rows = (await eiaRows('petroleum/move/impcus', { product: ['EPC0'], process: ['IM0'] }, 'monthly', START)).map(normFlow)
      .filter(r => /MBBL\/D/i.test(r.units || ''));
    realization.importsByOrigin = {
      what: 'US crude oil imports by country of origin, thousand barrels per day, monthly (EIA, official; as-of = period)',
      source: 'EIA APIv2 petroleum/move/impcus · EPC0 · IM0',
      series: toSeries(rows, r => r.areaId || r.area, r => r.area),
    };
    log('imports by origin:', Object.keys(realization.importsByOrigin.series).length, 'origins,', rows.length, 'rows');
  } catch (e) { errors.push('EIA imports by origin: ' + e.message); }

  // (a) US crude exports by destination — monthly, Mbbl/d.
  //     route petroleum/move/expc · product EPC0 · process EEX (exports)
  try {
    const rows = (await eiaRows('petroleum/move/expc', { product: ['EPC0'], process: ['EEX'] }, 'monthly', START)).map(normFlow)
      .filter(r => /MBBL\/D/i.test(r.units || ''));
    realization.exportsByDestination = {
      what: 'US crude oil exports by destination, thousand barrels per day, monthly (EIA, official; as-of = period)',
      source: 'EIA APIv2 petroleum/move/expc · EPC0 · EEX',
      series: toSeries(rows, r => r.areaId || r.area, r => r.area),
    };
    log('exports by destination:', Object.keys(realization.exportsByDestination.series).length, 'destinations,', rows.length, 'rows');
  } catch (e) { errors.push('EIA exports by destination: ' + e.message); }

  // (a) weekly totals — the recent edge. route petroleum/move/wkly · series WCRIMUS2 / WCREXUS2
  try {
    const rows = (await eiaRows('petroleum/move/wkly', { series: ['WCRIMUS2', 'WCREXUS2'] }, 'weekly', START + '-01')).map(normFlow);
    realization.weekly = {
      what: 'US crude imports (WCRIMUS2) and exports (WCREXUS2), thousand barrels per day, weekly (EIA)',
      source: 'EIA APIv2 petroleum/move/wkly',
      series: toSeries(rows, r => r.series, r => r.series === 'WCRIMUS2' ? 'US crude imports (weekly)' : 'US crude exports (weekly)'),
    };
    log('weekly:', rows.length, 'rows');
  } catch (e) { errors.push('EIA weekly: ' + e.message); }

  realization.fetchedAt = new Date().toISOString();
  realization.column = 'realization';
  realization.guard = 'Flows do not score Z; they are the layer Z is scored from (PG01 §6.3.1).';
  writeJSON(path.join(OUT, 'realization_us.json'), realization);

  // (c) the shadow — Brent (RBRTE), WTI (RWTC), US regular gasoline retail (EMM_EPMR_PTE_NUS_DPG), daily/weekly
  try {
    const spot = (await eiaRows('petroleum/pri/spt', { series: ['RBRTE', 'RWTC'] }, 'weekly', START + '-01')).map(normFlow);
    const gas = (await eiaRows('petroleum/pri/gnd', { series: ['EMM_EPMR_PTE_NUS_DPG'] }, 'weekly', START + '-01')).map(normFlow);
    price.series = Object.assign(
      toSeries(spot, r => r.series, r => r.series === 'RBRTE' ? 'Brent spot ($/bbl)' : 'WTI spot ($/bbl)'),
      toSeries(gas, r => r.series, () => 'US regular gasoline, retail ($/gal)'));
    price.what = 'The shadow: what the institutional stations read (PG01 §6.2c). Kept last.';
    price.fetchedAt = new Date().toISOString();
    price.column = 'price';
    writeJSON(path.join(OUT, 'price.json'), price);
    log('price:', spot.length + gas.length, 'rows');
  } catch (e) { errors.push('EIA price: ' + e.message); }
}

// ── GDELT detection volume ───────────────────────────────────
// DOC API timelinevol: share of global English coverage matching the
// theater's query, by day. Dated by DETECTION. Merged into a stored
// series so the history outlives the API's window.
// GDELT DOC syntax (as scan-objects.js learned it, 2026-07): space is AND,
// OR inside parentheses, no AND keyword, no query-side language operator.
const THEATERS = {
  iran: 'iran (oil OR tanker OR hormuz OR sanctions OR strike)',
  russia: 'russia (refinery OR urals OR "oil exports" OR tanker)',
  venezuela: 'venezuela (oil OR chevron OR pdvsa OR sanctions)',
  settlement: '(oil OR crude) (yuan OR petrodollar OR "dollar settlement" OR "non-dollar" OR invoicing)',
};
async function fetchGDELT() {
  const file = path.join(OUT, 'detection_gdelt.json');
  const det = readJSON(file, { column: 'detection', series: {} });
  det.what = 'GDELT DOC timeline volume per theater — share of global English coverage, by day. DATED BY DETECTION (PG01 §6.2b).';
  det.queries = THEATERS;
  const span = process.env.GDELT_TIMESPAN || '90d';
  for (const [name, query] of Object.entries(THEATERS)) {
    try {
      const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(query) +
        '&mode=timelinevol&format=json&timespan=' + span;
      const j = await getJSON(url);
      const tl = (j && j.timeline && j.timeline[0] && j.timeline[0].data) || [];
      const s = det.series[name] = det.series[name] || { label: name, units: '% of coverage', points: [] };
      const m = new Map(s.points);
      for (const p of tl) { const d = String(p.date || '').slice(0, 8); if (d.length === 8) m.set(d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), Number(p.value)); }
      s.points = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      log('gdelt', name + ':', tl.length, 'days merged →', s.points.length);
      await sleep(1500);   // GDELT asks for ~1 req/s
    } catch (e) { errors.push('GDELT ' + name + ': ' + e.message); }
  }
  det.fetchedAt = new Date().toISOString();
  writeJSON(file, det);
}

// ── the bundle the map reads ─────────────────────────────────
function bundle() {
  const realization = readJSON(path.join(OUT, 'realization_us.json'), {});
  const price = readJSON(path.join(OUT, 'price.json'), {});
  const detection = readJSON(path.join(OUT, 'detection_gdelt.json'), {});
  const accruals = readJSON(path.join(OUT, 'accruals.json'), { rows: [] });
  const events = readJSON(path.join(OUT, 'events.json'), { rows: [] });
  const hypotheses = readJSON(path.join(OUT, 'hypotheses.json'), { rows: [] });
  const out = {
    arc: 'PG01', section: '§6 the active layer (ruled 2026-10-02)',
    frame: { x: ['left', 'right'], y: ['grassroots', 'institutional'], z: ['frustrated', 'realized'],
      note: 'The frame stands still. Drawn in the corner; never recomputed from the data (PG01 §6.3.3).' },
    guards: ['Flows do not score Z.', 'No instrumentality claim.', 'The frame stands still.', 'Accruals stay accruals.', 'Prism sees it through Readings.'],
    builtAt: new Date().toISOString(),
    errors,
    realization, accruals, events, hypotheses, detection, price,
  };
  writeJSON(path.join(OUT, 'active.json'), out);
}

(async () => {
  log('PG01 §6 — the active layer · start', START, '· eia', DO_EIA, '· gdelt', DO_GDELT);
  if (DO_EIA) await fetchEIA();
  if (DO_GDELT) await fetchGDELT();
  bundle();
  if (errors.length) { console.error('\n[active] with errors:'); errors.forEach(e => console.error('  ✗', e)); }
  log('done');
})();
