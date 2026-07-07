// probe-graveyard-cosponsors.js — one-off probe (2026-07-07, Sailor + Claude)
// Question (Sailor): is the 119th graveyard mostly low-support noise, with a
// thin tail of broad-support bills suppressed at the gate?
// Method: seeded random sample of graveyard bills (in policy_area_index_v1,
// not in catalog), fetch bill detail, record cosponsors.count + sponsor party.
// Checkpointed (data/graveyard_probe.json) — safe to re-run until done.
// Non-contrived: pure function of the record; sample seed + size visible here.

const fs = require('fs');
const path = require('path');
const SECRETS = require('./secrets.local.js');

const SAMPLE_SIZE = 300;
const SEED = 119; // reproducible
const DELAY_MS = 300;
const DATA = path.join(__dirname, '..', 'data');
const CKPT = path.join(DATA, 'graveyard_probe.json');

// seeded LCG shuffle
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }

function buildSample() {
  const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'policy_area_index.json'), 'utf8'));
  const cat = JSON.parse(fs.readFileSync(path.join(DATA, 'prism_legislation.json'), 'utf8'));
  const bills = Array.isArray(cat.bills) ? cat.bills : Array.isArray(cat) ? cat : Object.values(cat.bills || cat);
  const catIds = new Set(bills.map(b => b.billId || b.id));
  const grave = Object.keys(idx.bills).filter(id => !catIds.has(id));
  const rnd = lcg(SEED);
  for (let i = grave.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [grave[i], grave[j]] = [grave[j], grave[i]]; }
  return { graveyardTotal: grave.length, sample: grave.slice(0, SAMPLE_SIZE) };
}

async function fetchDetail(billId) {
  const [type, congress, num] = billId.split('-');
  const url = `https://api.congress.gov/v3/bill/${congress}/${type}/${num}?format=json&api_key=${SECRETS.CONGRESS_API_KEY}`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await new Promise(z => setTimeout(z, 5000)); continue; }
      if (!r.ok) return { error: r.status };
      const b = (await r.json()).bill;
      return {
        cosponsors: b.cosponsors ? b.cosponsors.count : 0,
        sponsorParty: b.sponsors && b.sponsors[0] ? b.sponsors[0].party : null,
        title: (b.title || '').slice(0, 120),
        policyArea: b.policyArea ? b.policyArea.name : null,
        latestAction: b.latestAction ? b.latestAction.text.slice(0, 100) : null,
      };
    } catch (e) { await new Promise(z => setTimeout(z, 1500)); }
  }
  return { error: 'retries_exhausted' };
}

(async () => {
  let ck = fs.existsSync(CKPT) ? JSON.parse(fs.readFileSync(CKPT, 'utf8')) : null;
  if (!ck) { const { graveyardTotal, sample } = buildSample(); ck = { version: 'graveyard_probe_v1', seed: SEED, graveyardTotal, sample, results: {} }; }
  const todo = ck.sample.filter(id => !ck.results[id]);
  let n = Object.keys(ck.results).length;
  for (const id of todo) {
    ck.results[id] = await fetchDetail(id);
    fs.writeFileSync(CKPT, JSON.stringify(ck)); // checkpoint every bill — interrupt-safe
    n++;
    if (n % 25 === 0) console.log(`  ${n}/${ck.sample.length}...`);
    await new Promise(z => setTimeout(z, DELAY_MS));
  }
  console.log(`done ${n}/${ck.sample.length}`);
})();
