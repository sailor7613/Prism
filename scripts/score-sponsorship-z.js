/**
 * Prism Data Pipeline — Baseline-Z from Legislative Delivery
 *
 * Turns each member's authored + cosponsored legislative record
 * (data/sponsorship_stats.json) into a baseline z in [-1, +1] that the v2
 * graphmap reads for flat baseline pins, giving the DW-NOMINATE field real
 * depth instead of sitting at z=0.
 *
 * WHAT Z MEANS HERE
 *   Prism z = the promise-delivery dimension ("operates inside a domain with
 *   consistent delivery" = +z; "introduces much that dies in committee" = -z).
 *   We proxy it from how far a member's bills actually travel.
 *
 * TWO SIGNALS, COMBINED
 *   sponsored   — authored. Strong individual delivery signal (weight 0.7).
 *   cosponsored — signed onto. Weaker, broader engagement/alignment signal
 *                 (weight 0.3), but it fills coverage for members who author
 *                 little. Whether bills you merely cosponsor pass is mostly not
 *                 your doing, hence the lower weight.
 *
 * PIPELINE (per signal, then blend)
 *   1. Progression weight per bill status (introduced 0 → enacted 1).
 *   2. Member rate = mean progression across that signal's bills.
 *   3. Bayesian shrinkage toward the global mean (sparse records regress).
 *   4. Standardize WITHIN chamber × majority status — independently for each
 *      signal. This puts sponsor and cosponsor signals on the SAME (z-score)
 *      scale despite different base rates, AND strips the majority-agenda
 *      confound from both (each member is judged against structurally-similar
 *      peers, not against the governing coalition).
 *   5. Blend the available standardized signals (0.7 sponsor / 0.3 cosponsor;
 *      if only one exists, use it alone).
 *   6. Squash through tanh into [-1, 1] → deliveryZ.
 *
 * Members with neither sponsored nor cosponsored bills get deliveryZ = 0.
 *
 * Usage:  node scripts/score-sponsorship-z.js
 * Writes: deliveryZ (+ component diagnostics) into data/prism_members.json
 *         and regenerates data/prism_members.js.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ── Tunables (one place) ────────────────────────────────────────────────
const PROGRESSION = {
  enacted: 1.0,
  presented_to_president: 0.9,
  vetoed: 0.8,            // cleared Congress; president blocked — still high delivery
  conference: 0.8,
  passed_both: 0.8,
  passed_house: 0.55,
  passed_senate: 0.55,
  reported: 0.3,
  floor_action: 0.35,
  committee: 0.12,
  introduced: 0.0,
};
const ALPHA = 3;          // shrinkage strength (prior pseudo-bills toward global mean)
const W_SPONSOR = 0.7;    // blend weights for the two standardized signals
const W_COSPONSOR = 0.3;
const TANH_GAIN = 0.7;    // how hard to squash the blended z-score
const Z_CLAMP = 0.98;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function std(xs, mu) {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / (xs.length - 1));
}
function rawRate(byStatus, total) {
  if (!total) return null;
  let sum = 0;
  for (const [status, n] of Object.entries(byStatus)) {
    sum += (PROGRESSION[status] != null ? PROGRESSION[status] : 0) * n;
  }
  return sum / total;
}

// Generic: shrink rates toward their global mean, then standardize within group.
// Returns { byBio: { bio: zscore|null }, globalMean }.
function standardizeSignal(rows, getRecord) {
  // rows: [{ bio, group, record:{total,byStatus} }]
  const rates = [];
  const shrunkByBio = {};
  for (const r of rows) {
    const rec = getRecord(r);
    const rate = rec ? rawRate(rec.byStatus || {}, rec.total || 0) : null;
    r._rate = rate;
    if (rate != null) rates.push(rate);
  }
  const gMean = rates.length ? mean(rates) : 0;
  for (const r of rows) {
    if (r._rate == null) { shrunkByBio[r.bio] = null; continue; }
    const rec = getRecord(r);
    const sumProg = r._rate * rec.total;
    shrunkByBio[r.bio] = (sumProg + ALPHA * gMean) / (rec.total + ALPHA);
  }
  // group stats on shrunk values
  const groups = {};
  for (const r of rows) {
    const s = shrunkByBio[r.bio];
    if (s == null) continue;
    (groups[r.group] = groups[r.group] || []).push(s);
  }
  const gstat = {};
  for (const [g, xs] of Object.entries(groups)) {
    const mu = mean(xs); gstat[g] = { mu, sd: std(xs, mu), n: xs.length };
  }
  const zByBio = {};
  for (const r of rows) {
    const s = shrunkByBio[r.bio];
    if (s == null) { zByBio[r.bio] = null; continue; }
    const gs = gstat[r.group];
    zByBio[r.bio] = gs.sd > 1e-6 ? (s - gs.mu) / gs.sd : 0;
  }
  return { zByBio, shrunkByBio, gMean, gstat };
}

function main() {
  const statsPath = path.join(DATA_DIR, 'sponsorship_stats.json');
  if (!fs.existsSync(statsPath)) {
    console.error('ERROR: data/sponsorship_stats.json not found.');
    console.error('Run the network step first:  CONGRESS_API_KEY=<key> node scripts/fetch-sponsorship.js');
    process.exit(1);
  }
  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  const members = stats.members || {};

  // ── Majority detection (don't hardcode) ──
  const chamberParty = {};
  for (const m of Object.values(members)) {
    const ch = m.chamber || 'unknown';
    chamberParty[ch] = chamberParty[ch] || {};
    chamberParty[ch][m.party] = (chamberParty[ch][m.party] || 0) + 1;
  }
  const majorityParty = {};
  for (const [ch, parties] of Object.entries(chamberParty)) {
    majorityParty[ch] = Object.entries(parties).sort((a, b) => b[1] - a[1])[0][0];
  }
  console.log('Majority party by chamber:', majorityParty);

  // Build rows with group keys.
  const rows = Object.entries(members).map(([bio, m]) => ({
    bio, m,
    group: (m.chamber || 'unknown') + ':' + (m.party === majorityParty[m.chamber] ? 'maj' : 'min'),
  }));

  // ── Standardize each signal independently within group ──
  const sp = standardizeSignal(rows, r => r.m.sponsored);
  const co = standardizeSignal(rows, r => r.m.cosponsored);
  console.log(`Global mean rate — sponsored ${sp.gMean.toFixed(3)}, cosponsored ${co.gMean.toFixed(3)}`);

  // ── Blend available standardized signals → deliveryZ ──
  const result = {};
  for (const r of rows) {
    const sZ = sp.zByBio[r.bio];   // null if no sponsored bills
    const cZ = co.zByBio[r.bio];   // null if no cosponsored bills
    let wsum = 0, acc = 0;
    if (sZ != null) { acc += W_SPONSOR * sZ; wsum += W_SPONSOR; }
    if (cZ != null) { acc += W_COSPONSOR * cZ; wsum += W_COSPONSOR; }
    const blended = wsum > 0 ? acc / wsum : null;
    result[r.bio] = {
      deliveryZ: blended == null ? 0 : clamp(Math.tanh(blended * TANH_GAIN), -Z_CLAMP, Z_CLAMP),
      sZ, cZ,
      sponsorCount: (r.m.sponsored && r.m.sponsored.total) || 0,
      cosponsorCount: (r.m.cosponsored && r.m.cosponsored.total) || 0,
      sponsorEff: sp.shrunkByBio[r.bio] != null ? Number(sp.shrunkByBio[r.bio].toFixed(4)) : null,
      cosponsorEff: co.shrunkByBio[r.bio] != null ? Number(co.shrunkByBio[r.bio].toFixed(4)) : null,
    };
  }

  // ── Merge into roster + regenerate ──
  const rosterPath = path.join(DATA_DIR, 'prism_members.json');
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const arr = Array.isArray(roster) ? roster : (roster.members || Object.values(roster)[0]);
  let scored = 0, neutral = 0, viaCosponsorOnly = 0;
  for (const m of arr) {
    const r = result[m.bioguideId];
    if (r) {
      m.sponsorCount = r.sponsorCount;
      m.cosponsorCount = r.cosponsorCount;
      m.sponsorEff = r.sponsorEff;
      m.cosponsorEff = r.cosponsorEff;
      m.deliveryZ = Number(r.deliveryZ.toFixed(4));
      if (r.deliveryZ !== 0) scored++; else neutral++;
      if (r.sZ == null && r.cZ != null) viaCosponsorOnly++;
    } else {
      m.sponsorCount = 0; m.cosponsorCount = 0; m.sponsorEff = null; m.cosponsorEff = null;
      m.deliveryZ = 0; neutral++;
    }
  }
  fs.writeFileSync(rosterPath, JSON.stringify(arr, null, 2));

  const js =
    '/* Auto-generated from prism_members.json so the roster loads on file:// (no fetch/CORS).\n' +
    '   Regenerate: node scripts/score-sponsorship-z.js or re-run the pipeline. ' + arr.length + ' members. */\n' +
    'window.PRISM_MEMBERS_DATA = ' + JSON.stringify(arr) + ';\n' +
    'if (typeof PrismDB!=="undefined" && PrismDB.loadMembers) { try { PrismDB.loadMembers(window.PRISM_MEMBERS_DATA); } catch(e){} }\n';
  fs.writeFileSync(path.join(DATA_DIR, 'prism_members.js'), js);

  // ── Sanity eyeball ──
  const ranked = arr.filter(m => m.deliveryZ !== 0).sort((a, b) => b.deliveryZ - a.deliveryZ);
  const fmt = m => `${(typeof m.name === 'string' ? m.name : m.bioguideId)} ${m.deliveryZ >= 0 ? '+' : ''}${m.deliveryZ}`;
  console.log(`\n✔ deliveryZ: ${scored} scored, ${neutral} neutral. ${viaCosponsorOnly} scored from cosponsorship alone (no authored bills).`);
  console.log('Highest delivery:', ranked.slice(0, 8).map(fmt).join('  |  '));
  console.log('Lowest delivery :', ranked.slice(-8).map(fmt).join('  |  '));
  console.log('\nRegenerated prism_members.json + prism_members.js.');
}

main();
