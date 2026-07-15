/**
 * candidate-scores.js — the middle stratum's re-merge (persistence §1.5,
 * Newsroom Curation Desk direction handoff, RULED 2026-07-15).
 *
 * data/candidate_scores.json is the committed record of the
 * scored-but-unpromoted stratum: M2 fields + triage state, keyed by cid,
 * each record carrying `mts` (last local mutation, ms — the LWW key).
 * The admin surface writes it via the GitHub contents API (same pipe as
 * PrismSync Readings); this module is the FETCHER side — both sourcing
 * scripts bake the records into candidates.js at scan time so a scan can
 * never clobber scores, and a wiped store / fresh device recovers the
 * stratum from candidates.js itself.
 *
 * What bakes: fitness, framingDraft, suggestedAxes, prevalentAxisGuess,
 * voteMap, status, and mts (so PrismDB.importCandidates can compare ages).
 * What NEVER bakes: promotedEventId — evt ids are device-local; the file
 * carries them as provenance only.
 */

const fs = require('fs');
const path = require('path');

const SCORES_FILE = path.join(__dirname, '..', 'data', 'candidate_scores.json');
const BAKE_FIELDS = ['fitness', 'framingDraft', 'suggestedAxes',
                     'prevalentAxisGuess', 'voteMap', 'status'];

function loadScores(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file || SCORES_FILE, 'utf8'));
    if (j && j.schema === 'candidate_scores/v1' && j.records) return j.records;
  } catch (_) { /* absent or unparseable — the stratum just hasn't been pushed yet */ }
  return null;
}

// Mutates candidates in place; returns how many got a bake.
function bakeScores(candidates, records) {
  if (!records) return 0;
  let baked = 0;
  candidates.forEach(c => {
    const r = records[c.cid];
    if (!r) return;
    BAKE_FIELDS.forEach(k => { if (r[k] != null) c[k] = r[k]; });
    if (r.mts != null) c.mts = r.mts;
    baked++;
  });
  return baked;
}

module.exports = { loadScores, bakeScores, SCORES_FILE, BAKE_FIELDS };
