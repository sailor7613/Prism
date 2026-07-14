/**
 * fetch-activity.js — Event Engine sourcing, legislative signal (M1).
 * (Event Engine Build Spec v1 §3.1 — ratified 2026-07-13.)
 *
 * Builds the candidate pool the admin newsroom triages: recent roll-call
 * activity grouped by bill, WITH per-member positions attached — the
 * per-event placement that makes the alignment stock tick (spec §2, §7.3).
 *
 * KEYLESS by design: rides the fetch-votes.js roll-call sweep
 * (data/prism_votes.json — clerk.house.gov + senate.gov XML, no
 * Congress.gov key needed). Run `node scripts/fetch-votes.js` first to
 * refresh the sweep; this script then shapes candidates from what's on
 * disk. The Congress.gov-keyed bill-actions path from the spec stays
 * available as a later enrichment — the sweep already covers the "votes
 * with positions" core.
 *
 * Grouping: one candidate per bill with roll calls inside the window.
 * Deliberate deviation from the spec's ts-based cid: cids are
 * DETERMINISTIC ('cand_leg_<billId>') so re-runs upsert in the browser
 * store instead of duplicating — PrismDB.importCandidates preserves
 * local triage status (new/promoted/dismissed) across re-scans.
 *
 * Salience (raw.salience, 0–1): recency + contested margin + volume.
 * A near-tie roll call is a live field; a 90–8 suspension is the field
 * at rest. This is NOT the dialectical-fitness score — fitness stays
 * null until the M2 clustering call argues for two axes (spec §4).
 * The board shows these as 'unscored', sorted by salience.
 *
 * Output: data/candidates.js → window.PRISM_CANDIDATES (script-injected
 * global, same local-file CORS dodge as LEGISLATION_DATA).
 *
 * Usage:
 *   node scripts/fetch-activity.js                # 90-day window, max 40
 *   DAYS=60 MAX=20 node scripts/fetch-activity.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'candidates.js');
const METHOD_ID = 'legislative_rollcall_v1';

const DAYS = parseInt(process.env.DAYS || '90', 10);
const MAX = parseInt(process.env.MAX || '40', 10);

function main() {
  const votesFile = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'prism_votes.json'), 'utf8'));
  const bills = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'prism_legislation.json'), 'utf8'));
  const billById = new Map(bills.map(b => [b.billId, b]));

  const cutoff = Date.now() - DAYS * 864e5;
  const sweepAge = (Date.now() - Date.parse(votesFile.generated)) / 864e5;
  console.log(`sweep generated ${votesFile.generated} (${sweepAge.toFixed(1)}d ago)` +
    (sweepAge > 14 ? ' — consider re-running fetch-votes.js first' : ''));

  // ── recent roll calls, grouped by bill ──
  const byBill = new Map();
  votesFile.votes.forEach(v => {
    const t = Date.parse(v.date);
    if (isNaN(t) || t < cutoff || !v.billId) return;
    if (!byBill.has(v.billId)) byBill.set(v.billId, []);
    byBill.get(v.billId).push({ ...v, _t: t });
  });
  console.log(`${DAYS}-day window: ${byBill.size} bills with roll calls`);

  // ── salience: recency + contested margin + volume ──
  const now = Date.now();
  function salienceOf(votes) {
    const newest = Math.max(...votes.map(v => v._t));
    const recency = Math.max(0, 1 - (now - newest) / (DAYS * 864e5)); // 1 = today
    const contested = Math.max(...votes.map(v =>
      v.margin == null ? 0 : 1 - Math.min(1, Math.abs(v.margin))));   // 1 = tie
    const volume = Math.min(1, votes.length / 4);                     // 4+ rolls = 1
    return +(0.4 * recency + 0.45 * contested + 0.15 * volume).toFixed(3);
  }

  // ── shape candidates (spec §9) ──
  const candidates = [...byBill.entries()].map(([billId, votes]) => {
    votes.sort((a, b) => b._t - a._t);
    const bill = billById.get(billId) || {};
    const latest = votes[0];
    const partySplit = v => Object.entries(v.party || {})
      .map(([p, t]) => `${p} ${t.yea}-${t.nay}`).join(' · ');
    const members = new Set();
    votes.forEach(v => {
      (v.positions?.yea || []).forEach(m => members.add(m));
      (v.positions?.nay || []).forEach(m => members.add(m));
    });
    return {
      cid: 'cand_leg_' + billId,
      source: 'legislative',
      ts: Date.now(),
      raw: {
        method: METHOD_ID,
        billId,
        salience: salienceOf(votes),
        congressGovUrl: bill.congressGovUrl || null,
        votes: votes.map(v => ({
          voteId: v.voteId, chamber: v.chamber, date: v.date,
          question: v.question, result: v.result, margin: v.margin,
          totals: v.totals, party: v.party,
          positions: v.positions            // per-member placements — the payload
        }))
      },
      title: (bill.title || billId) +
        (votes.length > 1 ? ` (${votes.length} roll calls)` : ''),
      summary: votes.map(v =>
        `${new Date(v._t).toISOString().slice(0, 10)} ${v.chamber}: ` +
        `${v.question} — ${v.result} (${v.totals.yea}-${v.totals.nay}` +
        `${partySplit(v) ? '; ' + partySplit(v) : ''})`).join('\n'),
      framingDraft: null,                   // M2: LLM clustering fills
      suggestedAxes: null,                  // M2
      prevalentAxisGuess: null,             // M2
      members: [...members],
      bills: [billId],
      fitness: null,                        // M2 — salience is NOT fitness
      status: 'new'
    };
  });

  candidates.sort((a, b) => b.raw.salience - a.raw.salience);
  const kept = candidates.slice(0, MAX);
  console.log(`${candidates.length} candidates shaped, keeping top ${kept.length} by salience`);
  kept.slice(0, 8).forEach(c => console.log(
    `  ${c.raw.salience.toFixed(2)} ${c.bills[0]} — ${c.title.slice(0, 72)}`));

  const header =
    `// Auto-generated by scripts/fetch-activity.js — ${new Date().toISOString()}\n` +
    `// ${kept.length} legislative candidates · ${DAYS}-day window · method ${METHOD_ID}\n` +
    `// Consumed by admin.html newsroom scan → PrismDB.importCandidates\n`;
  fs.writeFileSync(OUT, header +
    'window.PRISM_CANDIDATES = ' + JSON.stringify(kept, null, 2) + ';\n');
  console.log(`✓ ${OUT} (${kept.length} candidates)`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('FATAL:', e.message); process.exit(1); }
}
module.exports = { METHOD_ID };
