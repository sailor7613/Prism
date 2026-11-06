#!/usr/bin/env node
// ============================================================
// THE ACTIVE LAYER — the recent edge (2026-11-06, Sailor: "is there any way to get more current data?")
// The monthly series (EIA imports by origin, Comtrade) lag 2–3 months. This fetches what runs closer:
//
//   (1) EIA WEEKLY crude imports by country of origin — about a week behind. The Gulf edge into the US (P3).
//   (2) EIA weekly US distillate (diesel) imports, total — the diesel claim's flow side (H1a), no origin.
//   (3) EIA weekly US retail diesel price — the diesel claim's price side (H1c).
//   (4) US Census international trade, monthly by country and HS code — about a month ahead of EIA monthly.
//       HS 271019 (diesel / gas oil and other light-to-heavy oils) and HS 2709 (crude). Russia's row is H1a's
//       closest public record. Census needs no key (CENSUS_API_KEY optional, in env or secrets.local.js).
//
// Writes data/active/recent.json; scripts/active-layer.js bundles it into active.json as `recent`.
// Every part fails soft: an error is written into the file and the rest still runs.
// Guards hold: flows do not score Z; nothing here is a verdict. As-of = the period, always.
// ============================================================
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'active');
let S = {}; try { S = require('./secrets.local.js'); } catch (e) {}
const EIA_KEY = process.env.EIA_API_KEY || S.EIA_API_KEY || '';
const CENSUS_KEY = process.env.CENSUS_API_KEY || S.CENSUS_API_KEY || '';
const START_W = process.env.RECENT_START || '2025-06-01';
const errors = [], notes = [];
const log = (...a) => console.log('[recent]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'prism-active-layer (PG01 §6, recent edge)' } });
      const txt = await res.text();
      if (res.status === 429 || res.status >= 500) { last = 'HTTP ' + res.status; await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + txt.slice(0, 160));
      if (!txt.trim()) return null;   // Census answers 204/empty when nothing matches
      return JSON.parse(txt);
    } catch (e) { last = e.message; if (i === tries - 1) break; await sleep(1500 * (i + 1)); }
  }
  throw new Error(String(last).replace(/api_key=[^&\s]+/, 'api_key=…').replace(/key=[^&\s]+/, 'key=…'));
}
async function eia(route, facets, frequency, start) {
  const rows = []; let offset = 0;
  for (;;) {
    const q = ['api_key=' + encodeURIComponent(EIA_KEY), 'frequency=' + frequency, 'data[0]=value', 'start=' + start,
      'sort[0][column]=period', 'sort[0][direction]=asc', 'length=5000', 'offset=' + offset];
    Object.entries(facets || {}).forEach(([k, vs]) => vs.forEach(v => q.push('facets[' + k + '][]=' + encodeURIComponent(v))));
    const j = await getJSON('https://api.eia.gov/v2/' + route + '/data/?' + q.join('&'));
    const d = (j && j.response && j.response.data) || [];
    rows.push(...d); offset += d.length;
    if (!d.length || offset >= Number((j.response && j.response.total) || 0)) break;
    await sleep(500);
  }
  return rows;
}
const val = r => (r.value == null || r.value === '' ? null : Number(r.value));
function series(rows, keyOf, labelOf) {
  const out = {};
  rows.forEach(r => { const v = val(r); if (v == null || Number.isNaN(v)) return; const k = keyOf(r); if (!k) return;
    (out[k] = out[k] || { label: labelOf(r), units: r.units, points: [] }).points.push([r.period, v]); });
  Object.values(out).forEach(s => { const m = new Map(s.points); s.points = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); });
  return out;
}
// the EIA's own area codes, as the monthly series already carry them (NUS-N** = a country of origin)
const ORIGINS = ['NSA', 'NIZ', 'NKU', 'NTC', 'NCA', 'NMX', 'NVE', 'NBR', 'NCO', 'NGY', 'NEC', 'NNI', 'NNO', 'NLY', 'NAO', 'NAG', 'NUK', 'NAR', 'NKZ', 'NTD'];
async function weeklyByOrigin() {
  // first try the route; if it isn't there, ask series by series (W_EPC0_IM0_NUS-<area>_MBBLD)
  try {
    const rows = await eia('petroleum/move/wimpc', { product: ['EPC0'] }, 'weekly', START_W);
    const s = series(rows.filter(r => /MBBL\/D/i.test(r.units || '')), r => r.duoarea || r['area-name'], r => r['area-name'] || r.duoarea);
    if (Object.keys(s).length) { notes.push('weekly by origin: route petroleum/move/wimpc'); return s; }
    throw new Error('route answered with no MBBL/D rows (' + rows.length + ' rows)');
  } catch (e) { errors.push('EIA weekly by origin, route: ' + e.message + ' — trying series ids'); }
  const out = {};
  for (const a of ORIGINS) {
    const id = 'W_EPC0_IM0_NUS-' + a + '_MBBLD';
    try {
      const j = await getJSON('https://api.eia.gov/v2/seriesid/' + id + '?api_key=' + encodeURIComponent(EIA_KEY));
      const d = ((j && j.response && j.response.data) || []).filter(r => String(r.period) >= START_W);
      if (d.length) out['NUS-' + a] = { label: d[0]['area-name'] || a, units: d[0].units || 'MBBL/D', series: id,
        points: d.map(r => [r.period, val(r)]).filter(p => p[1] != null).sort((x, y) => x[0].localeCompare(y[0])) };
    } catch (e) { errors.push('EIA weekly ' + id + ': ' + e.message); }
    await sleep(300);
  }
  if (Object.keys(out).length) notes.push('weekly by origin: series ids (' + Object.keys(out).length + ' origins)');
  return out;
}
// Census: monthly imports by country, one HS code. Asks with quantity first; if the API refuses those
// fields at this level, asks again for value only.
async function census(hs, lvl) {
  const key = CENSUS_KEY ? '&key=' + encodeURIComponent(CENSUS_KEY) : '';
  const base = 'https://api.census.gov/data/timeseries/intltrade/imports/hs?';
  const tries = [
    'get=CTY_CODE,CTY_NAME,I_COMMODITY,GEN_VAL_MO,GEN_QY1_MO,UNIT_QY1',
    'get=CTY_CODE,CTY_NAME,I_COMMODITY,GEN_VAL_MO',
  ];
  let lastErr;
  for (const g of tries) {
    try {
      const j = await getJSON(base + g + '&I_COMMODITY=' + hs + '&COMM_LVL=' + lvl + '&time=from+2025-06' + key, 2);
      if (!j || !j.length) return { rows: [], fields: g };
      const head = j[0];
      const rows = j.slice(1).map(r => { const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); return o; })
        .filter(o => o.CTY_CODE && !/^[0-9]X|^00|TOTAL/i.test(o.CTY_CODE + ' ' + (o.CTY_NAME || '')))
        .map(o => ({ period: o.time, cty: o.CTY_CODE, country: o.CTY_NAME, hs: o.I_COMMODITY,
                     usd: o.GEN_VAL_MO == null ? null : Number(o.GEN_VAL_MO),
                     qty: o.GEN_QY1_MO == null ? null : Number(o.GEN_QY1_MO), unit: o.UNIT_QY1 || null }));
      return { rows, fields: g };
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(lastErr);
}
(async () => {
  const out = { what: 'The recent edge of the active layer — series that run closer than the monthly ones (2026-11-06). As-of = period. Flows do not score Z.',
    fetchedAt: new Date().toISOString() };
  if (!EIA_KEY) errors.push('EIA: no EIA_API_KEY — weekly series skipped');
  else {
    try { out.weeklyImportsByOrigin = { what: 'US crude imports by country of origin, thousand barrels per day, WEEKLY (EIA; the week ending = period)',
            series: await weeklyByOrigin() }; log('weekly by origin:', Object.keys(out.weeklyImportsByOrigin.series).length, 'origins'); }
    catch (e) { errors.push('EIA weekly by origin: ' + e.message); }
    try { const r = await eia('petroleum/move/wkly', { series: ['WDIIMUS2', 'WCRIMUS2'] }, 'weekly', START_W);
          out.weeklyTotals = { what: 'US distillate imports (WDIIMUS2) and crude imports (WCRIMUS2), thousand barrels per day, weekly (EIA)',
            series: series(r, x => x.series, x => x.series === 'WDIIMUS2' ? 'US distillate imports (weekly)' : 'US crude imports (weekly)') };
          log('weekly totals:', r.length, 'rows'); }
    catch (e) { errors.push('EIA weekly totals: ' + e.message); }
    try { const r = await eia('petroleum/pri/gnd', { series: ['EMD_EPD2D_PTE_NUS_DPG'] }, 'weekly', START_W);
          out.dieselRetail = { what: 'US No. 2 diesel, retail, $/gal, weekly (EIA) — H1c reads this',
            series: series(r, x => x.series, () => 'US diesel, retail ($/gal)') };
          log('diesel retail:', r.length, 'rows'); }
    catch (e) { errors.push('EIA diesel retail: ' + e.message); }
  }
  out.census = { what: 'US imports by country, monthly (US Census international trade, general imports). usd = customs value; qty in UNIT_QY1 where the API gives it. About a month ahead of EIA monthly. A customs value in dollars is a unit of account, not evidence of dollar settlement.' };
  if (!CENSUS_KEY) errors.push('Census: no CENSUS_API_KEY in scripts/secrets.local.js — the Census API now requires one (free: api.census.gov/data/key_signup.html). Skipped.');
  else for (const [name, hs, lvl] of [['diesel_271019', '271019', 'HS6'], ['crude_2709', '2709', 'HS4']]) {
    try { const c = await census(hs, lvl); out.census[name] = c; log('census', name + ':', c.rows.length, 'rows', c.rows.length ? '· last ' + c.rows.map(r => r.period).sort().pop() : ''); }
    catch (e) { errors.push('Census ' + name + ': ' + e.message); }
    await sleep(500);
  }
  out.notes = notes; out.errors = errors;
  fs.writeFileSync(path.join(OUT, 'recent.json'), JSON.stringify(out, null, 1) + '\n');
  log('wrote data/active/recent.json');
  if (errors.length) { console.error('[recent] with errors:'); errors.forEach(e => console.error('  ✗', e)); }
})();
