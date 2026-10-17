// tracker-core.js — the Supply Shock Tracker's determination, shared.
// Lifted verbatim from DreamGetty/dreamgetty/index.html (trackerDeclare · trackerCompute · trackerVerdict and
// their constants) so BloomBurger's needle and the villa's G4 read the same number. If either changes, change both
// — or move the villa onto this file. Rules are passed in (settlement.json), not fetched.
(function (root) {
  'use strict';
  let trackerRules = null;
const KBD_TO_KT_MONTH = 4.08;   // 1 kb/d ≈ 1,000 bbl × 30 d × 0.136 t = 4,080 t a month

// Where things are. One table for both sources: EIA labels by ISO-3, Comtrade by name.
const TRACKER_PLACES = {
  'United States': { iso: 'U.S.', lat: 29.7, lon: -95.0, major: true },
  'Canada':        { iso: 'CAN', lat: 53.5, lon: -113.5, major: true },
  'Mexico':        { iso: 'MEX', lat: 22.2, lon: -97.9 },
  'Venezuela':     { iso: 'VEN', lat: 10.5, lon: -66.9, major: true },
  'Brazil':        { iso: 'BRA', lat: -22.9, lon: -43.2, major: true },
  'Colombia':      { iso: 'COL', lat: 10.4, lon: -75.5 },
  'Ecuador':       { iso: 'ECU', lat: -0.2, lon: -78.5 },
  'Peru':          { iso: 'PER', lat: -12.0, lon: -77.0 },
  'Argentina':     { iso: 'ARG', lat: -34.6, lon: -58.4 },
  'Guyana':        { iso: 'GUY', lat: 6.8, lon: -58.2 },
  'Trinidad':      { iso: 'TTO', lat: 10.7, lon: -61.5 },
  'Guatemala':     { iso: 'GTM', lat: 14.6, lon: -90.5 },
  'Panama':        { iso: 'PAN', lat: 9.0, lon: -79.5 },
  'Saudi Arabia':  { iso: 'SAU', lat: 26.6, lon: 50.2, major: true },
  'Iraq':          { iso: 'IRQ', lat: 30.5, lon: 47.8 },
  'Kuwait':        { iso: 'KWT', lat: 29.4, lon: 48.0 },
  'UAE':           { iso: 'ARE', lat: 25.1, lon: 56.3, major: true },
  'Qatar':         { iso: 'QAT', lat: 25.3, lon: 51.5 },
  'Oman':          { iso: 'OMN', lat: 23.6, lon: 58.6 },
  'Bahrain':       { iso: 'BHR', lat: 26.2, lon: 50.6 },
  'Iran':          { iso: 'IRN', lat: 29.2, lon: 50.3, major: true },
  'Russia':        { iso: 'RUS', lat: 44.7, lon: 37.8, major: true },
  'Kazakhstan':    { iso: 'KAZ', lat: 47.1, lon: 51.9 },
  'Nigeria':       { iso: 'NGA', lat: 4.8, lon: 7.0 },
  'Angola':        { iso: 'AGO', lat: -8.8, lon: 13.2 },
  'Libya':         { iso: 'LBY', lat: 32.9, lon: 13.2 },
  'Algeria':       { iso: 'DZA', lat: 36.8, lon: 3.0 },
  'Gabon':         { iso: 'GAB', lat: 0.4, lon: 9.4 },
  'Cameroon':      { iso: 'CMR', lat: 4.0, lon: 9.7 },
  'Ghana':         { iso: 'GHA', lat: 5.6, lon: -0.2 },
  'Ivory Coast':   { iso: 'CIV', lat: 5.3, lon: -4.0 },
  'Congo':         { iso: 'COD', lat: -4.8, lon: 11.9 },
  'Senegal':       { iso: 'SEN', lat: 14.7, lon: -17.5 },
  'Chad':          { iso: 'TCD', lat: 12.1, lon: 15.0 },
  'Tunisia':       { iso: 'TUN', lat: 36.8, lon: 10.2 },
  'United Kingdom': { iso: 'GBR', lat: 57.5, lon: 1.0 },
  // the EIA's export destinations (2026-10-12: "add as much data")
  'Netherlands':   { iso: 'NLD', lat: 51.9, lon: 4.3 },
  'Belgium':       { iso: 'BEL', lat: 51.3, lon: 4.3 },
  'Germany':       { iso: 'DEU', lat: 53.5, lon: 9.9 },
  'France':        { iso: 'FRA', lat: 49.5, lon: 0.1 },
  'Spain':         { iso: 'ESP', lat: 36.1, lon: -5.4 },
  'Italy':         { iso: 'ITA', lat: 44.4, lon: 8.9 },
  'Greece':        { iso: 'GRC', lat: 37.9, lon: 23.7 },
  'Portugal':      { iso: 'PRT', lat: 38.7, lon: -9.1 },
  'Ireland':       { iso: 'IRL', lat: 51.9, lon: -8.5 },
  'Denmark':       { iso: 'DNK', lat: 55.7, lon: 12.6 },
  'Sweden':        { iso: 'SWE', lat: 58.4, lon: 11.3 },
  'Finland':       { iso: 'FIN', lat: 60.2, lon: 25.0 },
  'Poland':        { iso: 'POL', lat: 54.4, lon: 18.6 },
  'Lithuania':     { iso: 'LTU', lat: 55.7, lon: 21.1 },
  'Croatia':       { iso: 'HRV', lat: 45.3, lon: 14.4 },
  'Switzerland':   { iso: 'CHE', lat: 47.4, lon: 8.5 },
  'Israel':        { iso: 'ISR', lat: 32.1, lon: 34.8 },
  'Pakistan':      { iso: 'PAK', lat: 24.9, lon: 67.0 },
  'Sri Lanka':     { iso: 'LKA', lat: 6.9, lon: 79.9 },
  'Thailand':      { iso: 'THA', lat: 13.7, lon: 100.5 },
  'Vietnam':       { iso: 'VNM', lat: 10.8, lon: 106.7 },
  'Singapore':     { iso: 'SGP', lat: 1.3, lon: 103.8 },
  'Indonesia':     { iso: 'IDN', lat: -6.2, lon: 106.8 },
  'Taiwan':        { iso: 'TWN', lat: 25.0, lon: 121.5 },
  'Hong Kong':     { iso: 'HKG', lat: 22.3, lon: 114.2 },
  'Australia':     { iso: 'AUS', lat: -33.9, lon: 151.2 },
  'New Zealand':   { iso: 'NZL', lat: -36.8, lon: 174.8 },
  'South Africa':  { iso: 'ZAF', lat: -33.9, lon: 18.4 },
  'Liberia':       { iso: 'LBR', lat: 6.3, lon: -10.8 },
  'Chile':         { iso: 'CHL', lat: -33.0, lon: -71.6 },
  'Uruguay':       { iso: 'URY', lat: -34.9, lon: -56.2 },
  'Costa Rica':    { iso: 'CRI', lat: 10.0, lon: -84.0 },
  'Honduras':      { iso: 'HND', lat: 15.5, lon: -88.0 },
  'Nicaragua':     { iso: 'NIC', lat: 12.1, lon: -86.3 },
  'El Salvador':   { iso: 'SLV', lat: 13.7, lon: -89.2 },
  'Dominican Rep.': { iso: 'DOM', lat: 18.5, lon: -69.9 },
  'Jamaica':       { iso: 'JAM', lat: 18.0, lon: -76.8 },
  'Bahamas':       { iso: 'BHS', lat: 25.0, lon: -77.4 },
  'Aruba':         { iso: 'ABW', lat: 12.5, lon: -70.0 },
  'Norway':        { iso: 'NOR', lat: 60.4, lon: 5.3 },
  'Malaysia':      { iso: 'MYS', lat: 2.6, lon: 101.8 },
  'India':         { iso: 'IND', lat: 22.5, lon: 70.1, major: true },
  'China':         { iso: 'CHN', lat: 29.9, lon: 121.6, major: true },
  'Japan':         { iso: 'JPN', lat: 35.4, lon: 139.7, major: true },
  'Korea':         { iso: 'KOR', lat: 35.1, lon: 129.0 },
  'EU-27':         { iso: 'EU', lat: 51.9, lon: 4.5, major: true },
  'Türkiye':       { iso: 'TUR', lat: 36.9, lon: 35.9 },
};
const TRACKER_BY_ISO = {}; Object.keys(TRACKER_PLACES).forEach(function (n) { TRACKER_BY_ISO[TRACKER_PLACES[n].iso] = n; });
const TRACKER_GULF = ['Saudi Arabia', 'Iraq', 'Kuwait', 'UAE', 'Qatar', 'Oman', 'Bahrain'];
const TRACKER_HEMI = ['Canada', 'Mexico', 'Venezuela', 'Brazil', 'Colombia', 'Ecuador', 'Peru', 'Argentina', 'Guyana', 'Trinidad', 'Guatemala', 'Panama'];
// The panel the determination is read over: stations that report every month
// of the window. Korea stops at 2025-12 and Türkiye at 2025-09 in the data
// we hold; counting a station that drops out would move the share for no
// reason in the world. They are still DRAWN when they report.
const TRACKER_PANEL = ['United States', 'EU-27', 'India', 'Japan', 'Brazil'];
function trackerDeclare(from, to) {
  if (from === 'United States' || to === 'United States') {
    return { declared: 'dollar', confidence: 'official', basis: 'US crude and product trade is dollar-invoiced (EIA official series; the counterparty sells into or buys from the US market in dollars).' };
  }
  const rules = (trackerRules && trackerRules.rules) || [];
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if ((r.from === '*' || r.from === from) && (r.to === '*' || r.to === to)) return r;
  }
  return { declared: 'unknown', confidence: 'none', basis: 'no rule declared for this edge' };
}

// ── the months, reduced: every edge, every month, with its money ──
function trackerCompute(d) {
  try {
    const months = {};
    const edge = function (period, from, to, cmd, value, units, official, uncounted) {
      if (!from || !to || from === to || !(value > 0)) return;
      const m = months[period] = months[period] || { period: period, edges: [], reporters: {} };
      const dec = trackerDeclare(from, to);
      m.edges.push({ from: from, to: to, cmd: cmd, kt: units === 'kb/d' ? value * KBD_TO_KT_MONTH : value, raw: value, units: units,
                     declared: dec.declared, confidence: dec.confidence, basis: dec.basis, official: !!official, uncounted: !!uncounted });
      if (!uncounted) m.reporters[to] = true;
    };
    // the US edges — official, EIA, by origin (crude). kb/d → kt a month.
    const imp = d.realization.importsByOrigin.series;
    Object.values(imp).forEach(function (s) {
      const name = TRACKER_BY_ISO[s.label]; if (!name || name === 'United States') return;
      s.points.forEach(function (p) { edge(p[0], name, 'United States', 'crude', p[1], 'kb/d', true); });
    });
    // the US's diesel, by origin — products into the US (EIA, official)
    const dist = d.realization.distillateImportsByOrigin && d.realization.distillateImportsByOrigin.series;
    if (dist) Object.values(dist).forEach(function (s) {
      const name = TRACKER_BY_ISO[s.label]; if (!name || name === 'United States') return;
      s.points.forEach(function (p) { edge(p[0], name, 'United States', 'products', p[1], 'kb/d', true); });
    });
    // the US's exports, by destination (EIA, official, dollar). DRAWN, NOT COUNTED:
    // the importers on the panel already report these barrels from their side,
    // and a barrel counted twice is a share moved for no reason in the world.
    const exp = d.realization.exportsByDestination && d.realization.exportsByDestination.series;
    if (exp) Object.values(exp).forEach(function (s) {
      const name = TRACKER_BY_ISO[s.label]; if (!name || name === 'United States') return;
      s.points.forEach(function (p) { edge(p[0], 'United States', name, 'crude', p[1], 'kb/d', true, true); });
    });
    // everyone else — importer-reported, Comtrade, crude and products (kt)
    ((d.bilateral && d.bilateral.edges) || []).forEach(function (e) {
      if (e.reporter === 'United States') return;        // the EIA is the US's own record; never twice
      if (!TRACKER_PLACES[e.partner] || !TRACKER_PLACES[e.reporter]) return;
      edge(e.period, e.partner, e.reporter, e.cmd, e.kt, 'kt', true);
    });
    const periods = Object.keys(months).sort();
    // the window: the thirteen months ending at the last month the EIA reports
    const eiaLast = (function () { const t = imp['NUS-Z00']; return t && t.points.length ? t.points[t.points.length - 1][0] : periods[periods.length - 1]; })();
    const window = periods.filter(function (p) { return p <= eiaLast; }).slice(-13);
    const rows = window.map(function (p) {
      const m = months[p];
      const panel = m.edges.filter(function (e) { return !e.uncounted && TRACKER_PANEL.indexOf(e.to) !== -1; });
      const tot = panel.reduce(function (a, e) { return a + e.kt; }, 0);
      const dollar = panel.filter(function (e) { return e.declared === 'dollar'; }).reduce(function (a, e) { return a + e.kt; }, 0);
      const non = panel.filter(function (e) { return e.declared === 'non-dollar'; }).reduce(function (a, e) { return a + e.kt; }, 0);
      const byDefault = panel.filter(function (e) { return e.confidence === 'default'; }).reduce(function (a, e) { return a + e.kt; }, 0);
      const named = dollar + non;
      // the US view, in the US's own units
      const us = m.edges.filter(function (e) { return e.to === 'United States'; });
      const usTot = us.reduce(function (a, e) { return a + e.raw; }, 0);
      const usGulf = us.filter(function (e) { return TRACKER_GULF.indexOf(e.from) !== -1; }).reduce(function (a, e) { return a + e.raw; }, 0);
      const usHemi = us.filter(function (e) { return TRACKER_HEMI.indexOf(e.from) !== -1; }).reduce(function (a, e) { return a + e.raw; }, 0);
      const usVen = us.filter(function (e) { return e.from === 'Venezuela'; }).reduce(function (a, e) { return a + e.raw; }, 0);
      return { period: p, edges: m.edges, reporters: Object.keys(m.reporters),
               total: tot, dollar: dollar, nonDollar: non, named: named, byDefault: byDefault,
               dollarShare: named ? dollar / named : null, namedShare: tot ? named / tot : 0, defaultShare: named ? byDefault / named : 0,
               panelPresent: TRACKER_PANEL.filter(function (s) { return m.reporters[s]; }),
               us: { total: usTot, gulf: usGulf, hemi: usHemi, ven: usVen, gulfShare: usTot ? usGulf / usTot : 0, hemiShare: usTot ? usHemi / usTot : 0 } };
    });
    // the reading compares the latest month the whole panel reports with the
    // earliest such month in the window — never a month a station sat out
    const full = rows.filter(function (r) { return r.panelPresent.length === TRACKER_PANEL.length; });
    const now = full.length ? full[full.length - 1] : rows[rows.length - 1];
    const ago = full.length ? full[0] : rows[0];
    const brentS = d.price && d.price.series && d.price.series.RBRTE;
    const brent = brentS && brentS.points.length ? brentS.points[brentS.points.length - 1] : null;
    const hypRows = (d.hypotheses && d.hypotheses.rows) || [];
    const hyp = hypRows.find(function (r) { return r.id === 'P3'; }) || hypRows[0];
    const hyps = hypRows.filter(function (r) { return r !== hyp; });   // the Press's H1–H4 (2026-10-15): principals' statements as hypotheses, after Sailor's bet
    const said = d.statements && d.statements.rows ? d.statements.rows.slice(0, 4) : [];
    const accruals = (d.accruals && d.accruals.rows) || [];
    return { months: rows, now: now, ago: ago, nowIndex: rows.indexOf(now), brent: brent, hyp: hyp, hyps: hyps, said: said, accruals: accruals,
             delta: (now.dollarShare != null && ago.dollarShare != null) ? now.dollarShare - ago.dollarShare : 0, builtAt: d.builtAt };
  } catch (e) { console.warn('[tracker] compute', e); return null; }
}
// The reading's word. ±3 points of the dollar's share across the window.
function trackerVerdict(T) {
  if (!T || T.now.dollarShare == null) return { word: '—', line: 'the share cannot be read yet' };
  const d = T.delta;
  if (d > 0.03)  return { word: 'RISING',  line: 'more of the world’s energy is being sold in dollars' };
  if (d < -0.03) return { word: 'FALLING', line: 'less of the world’s energy is being sold in dollars' };
  return { word: 'HOLDING', line: 'the share of the world’s energy sold in dollars is holding' };
}
// What Ted says — built from the numbers, so he is never a month stale.
  root.PrismTracker = {
    compute: function (active, settlement) { trackerRules = settlement || { rules: [] }; return trackerCompute(active); },
    verdict: trackerVerdict,
    PANEL: TRACKER_PANEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
