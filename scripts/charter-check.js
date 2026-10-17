#!/usr/bin/env node
// charter-check.js — the code half of ../../CHARTER.md.
// Each check below is one invariant from the charter. Any failure exits 1.
// Run: node scripts/charter-check.js        (from Prism/)
// CI:  .github/workflows/charter.yml

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fails = [];
const warns = [];
const fail = (rule, msg) => fails.push(`[${rule}] ${msg}`);
const warn = (rule, msg) => warns.push(`[${rule}] ${msg}`);

const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const walk = (dir, pred) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!/node_modules|_to_delete|archive|_retired/.test(ent.name)) out.push(...walk(p, pred)); }
    else if (pred(p)) out.push(p);
  }
  return out;
};
const flatKeys = (o, prefix = '', acc = []) => {
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) { const kp = prefix ? `${prefix}.${k}` : k; acc.push(kp); flatKeys(v, kp, acc); }
  }
  return acc;
};
const deepStrings = (o, acc = []) => {
  if (typeof o === 'string') acc.push(o);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) deepStrings(v, acc);
  return acc;
};

// ── corpus ───────────────────────────────────────────────────────────────
const readingsDir = path.join(ROOT, 'data', 'readings');
const published = walk(readingsDir, p => p.endsWith('.json') && !/\/(drafts|examples|clips|_retired)\//.test(p));
const races = published.filter(p => /\/races\//.test(p));
const press = walk(path.join(ROOT, 'data', 'press'), p => p.endsWith('.json'));
const codeFiles = [
  ...walk(path.join(ROOT, 'src'), p => /\.(js|mjs)$/.test(p)),
  // scoring and shaping scripts only — fetchers normalise raw party/state labels and are not scoring code
  ...walk(path.join(ROOT, 'scripts'), p => /\.(js|mjs)$/.test(p) && !p.endsWith('charter-check.js') && !/\/(fetch-[^/]+|congress-client|config)\.js$/.test(p)),
];
const uiFiles = [
  ...walk(path.join(ROOT, 'v2'), p => /\.(html|js)$/.test(p)),
  ...walk(path.join(ROOT, 'g4'), p => /\.(html|js)$/.test(p)),
  path.join(ROOT, 'index.html'),
].filter(fs.existsSync);

// ── 1. no-recommendation ─────────────────────────────────────────────────
{
  const banned = /^(.*\.)?(recommend(ation|ed)?|endorse(ment|d)?|shouldWin|winner|verdict|pick|ourPick)$/i;
  for (const f of [...published, ...press]) {
    const d = readJSON(f); if (!d) continue;
    for (const k of flatKeys(d)) if (banned.test(k)) fail('no-recommendation', `${path.relative(ROOT, f)} carries field "${k}"`);
  }
  // a race is a conditional pair, never a pick
  const byRace = {};
  for (const f of races) { const d = readJSON(f); if (d && d.race) (byRace[d.race] ||= []).push(d); }
  for (const [race, rs] of Object.entries(byRace)) {
    if (rs.length < 2) fail('no-recommendation', `race ${race} has ${rs.length} Reading(s); a race must be ≥2 conditional Readings`);
    for (const r of rs) if (!/conditional/i.test(r.centralObject?.state || '')) fail('no-recommendation', `${r.rid}: race centralObject.state must be conditional`);
  }
}

// ── 2. polling-never-z ───────────────────────────────────────────────────
{
  const zPaths = /(^|\.)(z|zPattern|impliedZ|zReason|rims|centers)(\.|$)/;
  for (const f of published) {
    const d = readJSON(f); if (!d) continue;
    const walkZ = (o, p = '') => {
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walkZ(v, p ? `${p}.${k}` : k);
      else if (typeof o === 'string' && zPaths.test(p) && /\bpoll(s|ing|ed)?\b/i.test(o))
        fail('polling-never-z', `${path.relative(ROOT, f)} :: ${p} mentions polling inside a z-bearing field`);
    };
    walkZ(d);
  }
}

// ── 3. provenance-on-published ───────────────────────────────────────────
{
  for (const f of published) {
    const d = readJSON(f); if (!d) continue;
    const rel = path.relative(ROOT, f);
    const author = d.meta?.zFirstAuthoring?.author || d.meta?.author || d.provenance?.draftedBy;
    const formula = d.formulaVersion || d.provenance?.formula;
    const ruled = d.split?.ruledBy || d.provenance?.ruledBy || null;
    const unruledFlag = d.provenance?.unruled === true;
    if (!author) fail('provenance-on-published', `${rel}: no drafting author recorded`);
    if (!formula) fail('provenance-on-published', `${rel}: no formulaVersion recorded`);
    if (!ruled && !unruledFlag) fail('provenance-on-published', `${rel}: neither ruledBy nor provenance.unruled=true — an unruled Reading must say so on its face`);
  }
}

// ── 4. reasons-recorded-not-judged ───────────────────────────────────────
{
  const judging = /^(.*\.)?(true|valid|correct|legitimate|sincere)$/i;
  for (const f of published) {
    const d = readJSON(f); if (!d) continue;
    const rel = path.relative(ROOT, f);
    for (const k of flatKeys(d)) if (judging.test(k)) fail('reasons-recorded-not-judged', `${rel} carries adjudicating field "${k}"`);
    // every band that has a z should have a reason beside it
    const rims = d.split?.zPattern?.rims, centers = d.split?.zPattern?.centers;
    for (const [label, grp] of [['rims', rims], ['centers', centers]]) {
      if (grp && typeof grp === 'object') for (const [band, v] of Object.entries(grp)) {
        if (v && typeof v === 'object' && 'z' in v && !(v.zReason || v.reason || v.why))
          warn('reasons-recorded-not-judged', `${rel}: ${label}.${band} has z without zReason`);
      }
    }
  }
}

// ── 5. no-named-exceptions ───────────────────────────────────────────────
{
  const names = ['Israel','Palestin','Zionis','Ukrain','Russia','Iran','China','Saudi','India','Pakistan','Hamas','NATO',
                 'Democrat','Republican','Trump','Biden','Netanyahu','Putin','Zelensky','Jew','Muslim','Christian','Catholic','Evangelical'];
  const cond = new RegExp(`\\b(if|else if|switch|case|\\?)\\b[^\\n;]{0,120}\\b(${names.join('|')})`, 'i');
  for (const f of codeFiles) {
    const src = fs.readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      if (cond.test(line)) fail('no-named-exceptions', `${path.relative(ROOT, f)}:${i + 1} branches on a named people/state/party: ${line.trim().slice(0, 100)}`);
    });
  }
}

// ── 6. recusal-honored ───────────────────────────────────────────────────
{
  const rec = readJSON(path.join(ROOT, 'data', 'charter', 'recusal.json'));
  const terms = (rec?.terms || []).map(t => t.toLowerCase());
  const authorName = /sailor|shane/i;
  for (const f of published) {
    const d = readJSON(f); if (!d) continue;
    const hay = [d.title, d.centralObject?.ref, d.centralObject?.name, ...(d.framingKeywords || [])].filter(Boolean).join(' ').toLowerCase();
    const hot = terms.some(t => hay.includes(t));
    if (!hot) continue;
    const drafter = d.meta?.zFirstAuthoring?.author || d.provenance?.draftedBy || '';
    const ruled = d.split?.ruledBy || d.provenance?.ruledBy || '';
    if (authorName.test(drafter)) fail('recusal-honored', `${path.relative(ROOT, f)}: hot object drafted by the author (${drafter}); must be agent-drafted, author-ruled`);
    if (!ruled) warn('recusal-honored', `${path.relative(ROOT, f)}: hot object not yet ruled`);
  }
}

// ── 7. no-trackers ───────────────────────────────────────────────────────
{
  const trackers = /googletagmanager|google-analytics|gtag\(|segment\.(com|io)|connect\.facebook\.net|fbq\(|plausible\.io|posthog|mixpanel|hotjar|clarity\.ms|amplitude|fullstory|sentry\.io/i;
  for (const f of uiFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const m = src.match(trackers);
    if (m) fail('no-trackers', `${path.relative(ROOT, f)} references ${m[0]}`);
  }
}

// ── report ───────────────────────────────────────────────────────────────
console.log(`charter-check · ${published.length} published Readings · ${races.length} race Readings · ${press.length} press files · ${codeFiles.length} code files · ${uiFiles.length} UI files`);
for (const w of warns) console.log('  warn  ' + w);
for (const f of fails) console.log('  FAIL  ' + f);
if (fails.length) { console.log(`\n${fails.length} invariant failure(s). The charter is load-bearing; fix or rule.`); process.exit(1); }
console.log(`\nAll charter invariants hold.${warns.length ? ` (${warns.length} warning(s).)` : ''}`);
