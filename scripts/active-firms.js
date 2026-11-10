#!/usr/bin/env node
// ============================================================
// THE ACTIVE LAYER — refineries seen from orbit (2026-11-06, Sailor: "let's definitely check out FIRMS")
// NASA FIRMS (VIIRS active-fire detections, near real time, free MAP_KEY) read at the world's refineries.
//
//   1. The sites: every refinery OpenStreetMap knows (industrial=refinery), cached in data/active/refineries.json
//      and refreshed monthly. Names and coordinates are OSM's; nothing hand-placed.
//   2. The fires: VIIRS detections (NOAA-20, NOAA-21, Suomi-NPP) over the theaters' boxes, last 5 days per run,
//      merged into a stored history so it outlives the API's window. A detection within 3 km of a site counts for it.
//   3. The flag: refineries flare every day, so a fire is not news. A day is FLAGGED when the site's fire power (FRP)
//      is at least 4× its own median over the 30 days before, and at least 50 MW. Flagged ≠ struck — a flag is a
//      detection to be matched to a reported event, never a fact on its own (accruals stay accruals).
//
// Writes data/active/firms.json; scripts/active-layer.js bundles it as `firms`. Needs FIRMS_MAP_KEY
// (free: firms.modaps.eosdis.nasa.gov/api/map_key) in scripts/secrets.local.js or the env.
// Data: NASA FIRMS. Sites: © OpenStreetMap contributors (ODbL).
// ============================================================
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'data', 'active');
let S = {}; try { S = require('./secrets.local.js'); } catch (e) {}
const KEY = process.env.FIRMS_MAP_KEY || S.FIRMS_MAP_KEY || '';
const log = (...a) => console.log('[firms]', ...a), sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
// the theaters, west,south,east,north
const BOXES = {
  'russia-west':    [27, 42, 62, 66],    // European Russia, Ukraine, the Volga, the Black Sea coast
  'russia-east':    [62, 48, 135, 62],   // Urals to Siberia (Omsk, Achinsk, Angarsk) and the far east
  'gulf':           [44, 22, 60, 32],    // the Persian Gulf, both shores
  'red-sea':        [32, 12, 45, 30],    // Yanbu, Jizan, Aden, the Egyptian coast
  'caribbean':      [-75, 8, -60, 14],   // Venezuela, Aruba, Curaçao, Trinidad
};
const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT'];
const RADIUS_KM = 3, FLAG_X = 4, FLAG_MIN_MW = 50, BASE_DAYS = 30;
function km(a, b, c, d) { const R = 6371, r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return R * Math.sqrt(x * x + y * y); }
async function get(url, tries = 3, body) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(url, body ? { method: 'POST', body, headers: { 'user-agent': 'prism-active-layer (PG01 §6, refineries)', 'content-type': 'application/x-www-form-urlencoded' } }
                                            : { headers: { 'user-agent': 'prism-active-layer (PG01 §6, refineries)' } });
      const t = await res.text(); if (res.status === 429 || res.status >= 500) { last = 'HTTP ' + res.status; await sleep(4000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 120)); return t; }
    catch (e) { last = e.message; await sleep(2000 * (i + 1)); }
  }
  throw new Error(String(last).replace(KEY || '@@', '…'));
}
async function sites() {
  const f = path.join(OUT, 'refineries.json'), have = readJSON(f, null);
  if (have && have.v === 2 && have.sites && have.sites.length && Date.now() - Date.parse(have.fetchedAt) < 30 * 864e5) return have.sites;
  // v2 (11-06): OSM tags few Russian refineries industrial=refinery — most are named only ("…НПЗ", "нефтеперерабатывающий завод").
  // So: the tag worldwide, plus, inside the theaters' boxes, industrial land / works whose NAME says refinery in Russian,
  // English, Spanish, Arabic or Persian. Sugar refineries and the like are dropped by name.
  const NAME = 'НПЗ|[Нн]ефтеперерабатыва|[Rr]efinery|[Rr]efiner[ií]a|[Rr]affinerie|مصفاة|مصفى|پالایشگاه';
  const byName = Object.values(BOXES).map(([w, s, e, n]) => { const bb = '(' + s + ',' + w + ',' + n + ',' + e + ')';
    return 'way["landuse"="industrial"]["name"~"' + NAME + '"]' + bb + ';relation["landuse"="industrial"]["name"~"' + NAME + '"]' + bb + ';' +
           'way["man_made"="works"]["name"~"' + NAME + '"]' + bb + ';relation["man_made"="works"]["name"~"' + NAME + '"]' + bb + ';'; }).join('');
  const q = '[out:json][timeout:180];(way["industrial"="refinery"];relation["industrial"="refinery"];node["industrial"="refinery"];' + byName + ');out center tags;';
  try {
    const t = await get('https://overpass-api.de/api/interpreter', 2, 'data=' + encodeURIComponent(q));   // POST: the query is too long for a URL (414)
    const j = JSON.parse(t);
    const list = (j.elements || []).map(e => ({ id: e.type[0] + e.id, name: (e.tags && (e.tags['name:en'] || e.tags.name)) || null,
      operator: (e.tags && e.tags.operator) || null, lat: e.lat != null ? e.lat : e.center && e.center.lat, lon: e.lon != null ? e.lon : e.center && e.center.lon }))
      .filter(s => s.lat != null && s.lon != null)
      .filter(s => !/sugar|zah[ăa]r|сахар|азукар|azúcar|salt|соль/i.test((s.name || '') + ' ' + (s.operator || '')));
    // one site per plant: a named area often comes back as several ways — keep the first within 2 km of another of the same name
    const kept = []; list.splice(0, list.length, ...list.filter(s => { const dup = kept.find(k => km(k.lat, k.lon, s.lat, s.lon) < 2); if (dup) return false; kept.push(s); return true; }));
    fs.writeFileSync(f, JSON.stringify({ v: 2, what: 'Refinery sites (OpenStreetMap: industrial=refinery worldwide, plus industrial land/works named as a refinery inside the theaters). © OpenStreetMap contributors, ODbL.', fetchedAt: new Date().toISOString(), sites: list }, null, 1) + '\n');
    log('refinery sites from OpenStreetMap:', list.length);
    return list;
  } catch (e) { errors.push('OpenStreetMap sites: ' + e.message); return (have && have.sites) || []; }
}
function parseCSV(t) {
  const L = t.trim().split(/\r?\n/); if (L.length < 2 || !/latitude/.test(L[0])) return [];
  const h = L[0].split(','); return L.slice(1).map(l => { const v = l.split(','), o = {}; h.forEach((k, i) => { o[k] = v[i]; }); return o; });
}
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
(async () => {
  const file = path.join(OUT, 'firms.json');
  const st = readJSON(file, { sites: {} });
  if (!KEY) { errors.push('no FIRMS_MAP_KEY in scripts/secrets.local.js — free at firms.modaps.eosdis.nasa.gov/api/map_key. Skipped.'); }
  else {
    const all = await sites();
    st.sitesV = (readJSON(path.join(OUT, 'refineries.json'), {}).v) || 1;
    // only the sites inside the boxes we read
    const inBox = s => Object.values(BOXES).some(([w, so, e, n]) => s.lon >= w && s.lon <= e && s.lat >= so && s.lat <= n);
    const watch = all.filter(inBox);
    log('watching', watch.length, 'refineries in', Object.keys(BOXES).length, 'theaters');
    const fresh = {};   // siteId → date → {n, frp}
    let det = 0;
    // first run (or after the site list changes): backfill 35 days in 5-day windows so every site has a baseline at once
    const windows = [''];
    if (st.backfilledV !== (st.sitesV || 1)) { for (let k = 7; k >= 1; k--) windows.push('/' + new Date(Date.now() - (k * 5 + 4) * 864e5).toISOString().slice(0, 10)); log('backfilling 35 days for the baseline…'); }
    for (const win of windows) for (const [bname, box] of Object.entries(BOXES)) for (const src of SOURCES) {
      try {
        const rows = parseCSV(await get('https://firms.modaps.eosdis.nasa.gov/api/area/csv/' + KEY + '/' + src + '/' + box.join(',') + '/5' + win));
        det += rows.length;
        for (const r of rows) {
          const la = +r.latitude, lo = +r.longitude, frp = +r.frp || 0, d = r.acq_date;
          for (const s of watch) { if (Math.abs(s.lat - la) > 0.05 || Math.abs(s.lon - lo) > 0.08) continue;
            if (km(s.lat, s.lon, la, lo) <= RADIUS_KM) { const x = ((fresh[s.id] = fresh[s.id] || {})[d] = (fresh[s.id] || {})[d] || { n: 0, frp: 0 }); x.n++; x.frp += frp; break; } }
        }
      } catch (e) { errors.push(bname + ' ' + src + ': ' + e.message); }
      await sleep(400);
    }
    const covered = new Set(Object.values(fresh).flatMap(o => Object.keys(o)));
    if (covered.size) st.backfilledV = st.sitesV || 1;
    log('detections read:', det, '· sites with fire in the last 5 days:', Object.keys(fresh).length);
    // merge: the last 5 days are replaced whole (the API's window is the truth for them); older days kept
    const keep = new Set(); const today = new Date(); for (let i = 0; i < 5; i++) keep.add(new Date(today - i * 864e5).toISOString().slice(0, 10));
    for (const s of watch) {
      const rec = st.sites[s.id] = st.sites[s.id] || { name: s.name, operator: s.operator, lat: s.lat, lon: s.lon, days: {} };
      rec.name = s.name; rec.operator = s.operator;
      keep.forEach(d => { delete rec.days[d]; });
      Object.entries(fresh[s.id] || {}).forEach(([d, v]) => { rec.days[d] = [v.n, Math.round(v.frp * 10) / 10]; });
      // a day the satellites covered with no fire at the site is a zero, not a gap (the baseline needs the quiet days)
      covered.forEach(d => { if (!rec.days[d]) rec.days[d] = [0, 0]; });
    }
    // flags, recomputed over the whole history every run
    const flags = [];
    for (const [id, rec] of Object.entries(st.sites)) {
      const days = Object.keys(rec.days).sort();
      days.forEach(d => {
        const t = Date.parse(d), prior = days.filter(p => { const u = Date.parse(p); return u < t && u >= t - BASE_DAYS * 864e5; }).map(p => rec.days[p][1]);
        const base = median(prior), v = rec.days[d][1];
        if (prior.length >= 5 && v >= FLAG_MIN_MW && v >= FLAG_X * Math.max(base, 1)) flags.push({ site: id, name: rec.name, date: d, frp: v, n: rec.days[d][0], baseline: Math.round(base * 10) / 10 });
      });
    }
    st.flags = flags.sort((a, b) => b.date.localeCompare(a.date));
    log('flagged site-days (fire power ≥ ' + FLAG_X + '× the site\'s own 30-day median):', flags.length);
  }
  st.what = 'Fires at refineries, seen from orbit (NASA FIRMS VIIRS, near real time). days: date → [detections, fire radiative power MW], within ' + RADIUS_KM + ' km of the site. A FLAG is a detection to be matched to a reported event — never a strike on its own. Refineries flare daily; the baseline is each site\'s own. Data: NASA FIRMS. Sites: © OpenStreetMap contributors.';
  st.rule = { radiusKm: RADIUS_KM, flagTimesMedian: FLAG_X, flagMinMW: FLAG_MIN_MW, baselineDays: BASE_DAYS, boxes: BOXES, sources: SOURCES };
  st.fetchedAt = new Date().toISOString(); st.errors = errors;
  fs.writeFileSync(file, JSON.stringify(st) + '\n');
  log('wrote data/active/firms.json');
  if (errors.length) { console.error('[firms] with errors:'); errors.forEach(e => console.error('  ✗', e)); }
})();
