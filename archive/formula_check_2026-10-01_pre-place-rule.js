#!/usr/bin/env node
// ============================================================
// formula_check.js — the conformance pass, mechanized.
//
// TRACE mode  (*.js):   reports the ten slots of Trace_Formula_v1
//                       as FILLED / DECLARED-EMPTY / PARTIAL / MISSING.
// READING mode (*.json): runs the I2-for-frame pass — dates every
//                       fact in `framing` against the reading's window.
//
// v1 · 2026-09-21 · Sailor + Claude
// Companion to Parameters/00_Architecture/Trace_Formula_v1.md.
// The formula is a draft; so is this. It reports, it never edits.
//
// Usage:  node formula_check.js <file.js|file.json> [more ...]
//         node formula_check.js ../../Prism/data/readings/*.json
//
// v1 changes (owed from the 09-20 and 09-21 handoffs):
//   · READING mode + I2-for-frame (09-21 owed #4)
//   · the six blind spots (09-20 owed #8): X-empty, nested `layer`,
//     per-reader z, `zPattern`, `dz: null`, `spokenLayer`
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Ratified mode enum (Trace_Data_Schema_v2 §2) — divergences are the point (O1).
const RATIFIED_MODES = ['vacancy', 'surface-bound', 'inverted-lens', 'method-occluded'];
const GLOSSARY_EXTRA = ['aligned'];   // Glossary §4, parenthetical fifth

const STATIONS = ['LI', 'RI', 'LP', 'RP'];
const RINGS = ['fluid', 'coalition', 'denominated'];

// Readers are not a `readers` array — they are positions[].subjects[] carrying
// role:'reader'. The v0 checker looked for a field that has never existed.
const readersOf = p => (p.subjects || []).filter(s => s && s.role === 'reader');
// S3's declared object lives at `object_declared`; `object` is the coordinate triple.
const declaredObject = t => t.object_declared || t.objectDeclared || t.object || {};

// ============================================================
// TRACE MODE
// ============================================================

// ---- slot predicates: [id, label, test] ---------------------
// Each test returns 'FILLED' | 'MISSING' | {declaredEmpty: reason} | {partial: why}
const SLOTS = [
  ['S1', 'Identity & lifecycle', t =>
    t.id && t.lifecycle && t.lifecycle.status ? 'FILLED' : 'MISSING'],

  ['S2', 'Frame', t =>
    t.frame && t.frame.declared && t.frame.window ? 'FILLED' : 'MISSING'],

  ['S3', 'Object + layer', t => {
    if (!t.object) return 'MISSING';
    // layer is canon-as-concept, homeless-as-field (O5) — reported in observations
    return 'FILLED';
  }],

  ['S4', 'Axes', t =>
    t.axes && t.axes.x && t.axes.y && t.axes.z ? 'FILLED' : 'MISSING'],

  ['S5', 'Refraction', t => {
    if (!(t.object && t.shadow && t.transform && t.transform.primary)) return 'MISSING';
    // dz: null is a DECLARED cross-layer refusal when it carries a reason (TF06).
    // Without a reason it is an omission wearing a null.
    if (t.transform.dz === null) {
      return t.transform.dzReason
        ? { partial: 'dz declared null (cross-layer) with reason — FILLED in form, see observations' }
        : { partial: 'dz is null with NO dzReason — an omission, not a declaration' };
    }
    return 'FILLED';
  }],

  ['S6', 'Predicate table', t => {
    const p = t.predicates;
    if (!p) return 'MISSING';
    const n = (p.operative || []).length + (p.stated || []).length;
    return n > 0 ? 'FILLED' : 'MISSING';
  }],

  // S7 requires permeability{magnitude,mode} — a RATIFIED field, not optional.
  // Positions without it are diffraction run at the old altitude.
  ['S7', 'Diffraction (4 stations)', t => {
    if (!Array.isArray(t.positions) || !t.positions.length) return 'MISSING';
    const withPerm = t.positions.filter(p => p.permeability && p.permeability.mode).length;
    if (withPerm === 0) return { partial: `${t.positions.length} positions, 0 with permeability` };
    if (withPerm < t.positions.length)
      return { partial: `${withPerm}/${t.positions.length} positions carry permeability` };
    return 'FILLED';
  }],

  // 'diatribe' is TS02's key for the same thing — accept both, report the divergence.
  ['S8', 'Diatribe', t => {
    const hasEvent = t.dia && typeof t.dia.composite === 'number';
    const hasStation = (t.positions || []).some(p => p.dia || p.diatribe);
    return hasEvent || hasStation ? 'FILLED' : 'MISSING';
  }],

  ['S9', 'Subjects & roles', t => {
    const top = (t.subjects || []).length;
    const nested = (t.positions || []).reduce((a, p) => a + (p.subjects || []).length, 0);
    return top + nested > 0 ? 'FILLED' : 'MISSING';
  }],

  ['S10', 'Detections', t => {
    if (Array.isArray(t.detections)) {
      return t.detections.length ? 'FILLED' : { declaredEmpty: 'empty array, no reason given' };
    }
    if (t.detections && t.detections.status === 'declared-empty') {
      return { declaredEmpty: t.detections.reason || '(no reason recorded)' };
    }
    return 'MISSING';
  }],
];

// ---- load a trace file without a browser --------------------
function loadTrace(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = { module: { exports: {} }, PrismTraces: undefined, console };
  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: file, timeout: 5000 });
  } catch (e) {
    return { error: e.message };
  }
  if (sandbox.module.exports && sandbox.module.exports.id) return { trace: sandbox.module.exports };
  for (const k of Object.keys(sandbox)) {
    const v = sandbox[k];
    if (v && typeof v === 'object' && v.id && (v.positions || v.predicates)) return { trace: v };
  }
  return { error: 'no trace object found (no module.exports, no *_TRACE const)' };
}

// ---- BLIND SPOT 1 · nested `layer` --------------------------
// v0 asked only: is `layer` a top-level field? It is not, and never was.
// It lives nested, in several places, and the places disagree. Report where.
function layerSites(t) {
  const sites = [];
  if (t.layer !== undefined) sites.push(`top-level layer: ${JSON.stringify(t.layer)}`);
  if (t.frame && t.frame.layer !== undefined) sites.push(`frame.layer: ${JSON.stringify(t.frame.layer)}`);
  if (t.object && t.object.layer !== undefined) sites.push(`object.layer: ${JSON.stringify(t.object.layer)}`);
  if (t.shadow && t.shadow.layer !== undefined) sites.push(`shadow.layer: ${JSON.stringify(t.shadow.layer)}`);
  if (t.axes && t.axes.bindingLayer) sites.push(`axes.bindingLayer: ${t.axes.bindingLayer.status || 'present'}`);
  const od = declaredObject(t);
  if (od !== t.object && od.layer !== undefined) sites.push(`object_declared.layer: ${JSON.stringify(od.layer)}`);
  if (od.spokenLayer !== undefined) sites.push(`object_declared.spokenLayer: ${JSON.stringify(od.spokenLayer)}`);
  const zp = (t.positions || []).filter(p => p.zPattern && p.zPattern.layer !== undefined && p.zPattern.layer !== null);
  if (zp.length) sites.push(`${zp.length} position zPattern.layer`);
  const rl = (t.positions || []).reduce((a, p) =>
    a + readersOf(p).filter(r => r.zLayer !== undefined).length, 0);
  if (rl) sites.push(`${rl} reader zLayer`);
  return sites;
}

// ---- BLIND SPOT 2 · per-reader z ----------------------------
function readerZ(t) {
  let readers = 0, withZ = 0, withLayer = 0, withReason = 0;
  for (const p of (t.positions || [])) {
    for (const r of readersOf(p)) {
      readers++;
      if (typeof r.z === 'number') withZ++;
      if (r.zLayer !== undefined) withLayer++;
      if (r.zReason) withReason++;
    }
  }
  return { readers, withZ, withLayer, withReason };
}

// ---- BLIND SPOT 3 · zPattern --------------------------------
// v0.3: a trace position carries a zPattern DERIVED from its readers by ring.
// Centers and rims only — nothing between (R12).
function zPatternAudit(t) {
  const out = { present: 0, absent: [], emptyDeclared: 0, undeclaredEmpty: [], derivationGap: [] };
  for (const p of (t.positions || [])) {
    const zp = p.zPattern;
    if (!zp) { out.absent.push(p.id); continue; }
    out.present++;
    const bothNull = (zp.center === null || zp.center === undefined) &&
                     (zp.rim === null || zp.rim === undefined);
    if (bothNull) {
      if (zp.note) out.emptyDeclared++;
      else out.undeclaredEmpty.push(p.id);
    }
    // a zPattern is DERIVED from readers — a pattern with no reader carrying z is asserted, not derived
    const rz = readersOf(p).filter(r => typeof r.z === 'number').length;
    if (!bothNull && rz === 0) out.derivationGap.push(p.id);
  }
  return out;
}

// ---- BLIND SPOT 4 · X (challenge) declared empty + BOUND ----
// The empty is cheap; the BOUND is the claim. An empty with a weak bound is
// a search that stopped, reported as a fact about the record.
function challengeAudit(t) {
  const c = t.challenge || (t.predicates && t.predicates.challenge);
  if (c === undefined) return { state: 'ABSENT' };
  if (Array.isArray(c)) return { state: c.length ? `FILLED (${c.length})` : 'EMPTY ARRAY — no reason, no bound' };
  if (c.status === 'declared-empty') {
    const reason = c.reason || '';
    // bound strength, mechanically: a per-outlet sweep names outlets; a single pass does not.
    const weak = /one search pass|not a per-outlet|bound is weaker|owed: a per-outlet/i.test(reason);
    const dated = /\d{4}-\d{2}-\d{2}/.test(reason);
    return {
      state: 'DECLARED-EMPTY',
      emptyKind: c.emptyKind || '(no emptyKind)',
      bound: weak ? 'WEAK — self-declared as unratified; per-outlet pass owed'
                  : (reason ? 'stated' : 'NOT STATED — an empty with no bound is not a finding'),
      dated,
      reason: reason.slice(0, 160),
    };
  }
  return { state: 'PRESENT, shape unrecognized' };
}

// ---- BLIND SPOT 5 · spokenLayer -----------------------------
function spokenLayerAudit(t) {
  const o = declaredObject(t);
  if (o.spokenLayer === undefined) return null;
  const same = o.layer === o.spokenLayer;
  return {
    layer: o.layer, spokenLayer: o.spokenLayer, same,
    // the field exists to say the two differ; when they agree it is carrying nothing
    note: same ? 'spokenLayer === layer — the field is idle here'
               : `LAYER SPLIT: scored at ${o.layer}, spoken at ${o.spokenLayer} — the case the field was proposed for`,
  };
}

// ---- the trace report ---------------------------------------
function checkTrace(file) {
  const name = path.basename(file);
  const { trace, error } = loadTrace(file);
  if (error) return { kind: 'trace', name, error };

  const slots = SLOTS.map(([id, label, test]) => ({ id, label, r: test(trace) }));

  const notes = [];

  if (!Array.isArray(trace.findings) || !trace.findings.length)
    notes.push('LEDGER: findings[] absent or empty — trace is unreconstructable');

  const modes = (trace.positions || []).map(p => p.permeability && p.permeability.mode).filter(Boolean);
  const offEnum = [...new Set(modes)].filter(m => !RATIFIED_MODES.includes(m));
  if (offEnum.length)
    notes.push(`O1 modes outside the ratified enum: ${offEnum.map(m =>
      GLOSSARY_EXTRA.includes(m) ? `${m} (glossary-only)` : m).join(', ')}`);

  const spreadShapes = [...new Set((trace.positions || [])
    .map(p => p.internalSpread).filter(v => v !== undefined)
    .map(v => typeof v === 'string' ? 'prose string' : 'object{sigma,facets}'))];
  if (spreadShapes.length)
    notes.push(`O2 internalSpread implemented as: ${spreadShapes.join(' + ')} (ratified: object{sigma,facets})`);

  if (trace.eventType) notes.push(`O4 eventType present: '${trace.eventType}'`);

  // --- O5, rewritten: layer is not homeless, it is SCATTERED ---
  const sites = layerSites(trace);
  if (!sites.length) notes.push('O5 layer: not declared anywhere — not top-level, not nested');
  else notes.push(`O5 layer declared at ${sites.length} site(s): ${sites.join(' · ')}`);
  if (trace.object && trace.shadow &&
      trace.object.layer !== undefined && trace.shadow.layer !== undefined &&
      trace.object.layer !== trace.shadow.layer)
    notes.push(`O5b CROSS-LAYER: object.layer ${trace.object.layer} vs shadow.layer ${trace.shadow.layer} — ` +
               `a dz across these is a layer displacement, not a Z displacement`);

  // --- spokenLayer ---
  const sl = spokenLayerAudit(trace);
  if (sl) notes.push(`spokenLayer present (candidate field, ruling owed): ${sl.note}`);

  // --- per-reader z ---
  const rz = readerZ(trace);
  if (rz.readers) {
    notes.push(`per-reader z: ${rz.withZ}/${rz.readers} readers carry z · ${rz.withLayer} carry zLayer · ${rz.withReason} carry zReason`);
    if (rz.withZ && rz.withLayer < rz.withZ)
      notes.push(`  ^ ${rz.withZ - rz.withLayer} reader z WITHOUT a layer — v0.3: a reader's z carries a layer, because found readers read different layers`);
  }

  // --- zPattern ---
  const zp = zPatternAudit(trace);
  if (zp.present || zp.absent.length) {
    notes.push(`zPattern: ${zp.present}/${(trace.positions || []).length} positions` +
      (zp.absent.length ? ` — absent at ${zp.absent.join(', ')}` : '') +
      (zp.emptyDeclared ? ` · ${zp.emptyDeclared} declared empty with reason` : ''));
    if (zp.undeclaredEmpty.length)
      notes.push(`  ^ zPattern null with NO note at ${zp.undeclaredEmpty.join(', ')} — "no reader, no z" must be DECLARED, not left blank`);
    if (zp.derivationGap.length)
      notes.push(`  ^ zPattern ASSERTED not derived at ${zp.derivationGap.join(', ')} — a pattern with no reader z behind it`);
  }

  // --- dz ---
  if (trace.transform) {
    if (trace.transform.dz === null)
      notes.push(`dz: null — ${trace.transform.dzReason ? 'DECLARED with reason: ' + trace.transform.dzReason.slice(0, 110) : 'NO REASON — an omission wearing a null'}`);
    else if (typeof trace.transform.dz === 'number')
      notes.push(`dz: ${trace.transform.dz} (numeric — presumes object and shadow share a layer; O5b above says whether they do)`);
    else if (trace.transform.dz === undefined)
      notes.push('dz: absent entirely — neither computed nor declared');
  }

  // --- X / challenge ---
  const ch = challengeAudit(trace);
  if (ch.state === 'ABSENT') notes.push('X (challenge): ABSENT — type X is its own array since v0.1; absent is not empty');
  else if (ch.state === 'DECLARED-EMPTY')
    notes.push(`X (challenge): DECLARED-EMPTY · kind=${ch.emptyKind} · bound=${ch.bound}${ch.dated ? ' · sweep dated' : ' · SWEEP NOT DATED'}`);
  else notes.push(`X (challenge): ${ch.state}`);

  const present = STATIONS.filter(s => (trace.positions || []).some(p => p.id === s));
  if (present.length !== 4)
    notes.push(`STATIONS: ${present.length}/4 present (${present.join(', ') || 'none'})`);

  return { kind: 'trace', name, id: trace.id, label: trace.label, slots, notes };
}

// ============================================================
// READING MODE — the I2-for-frame pass
// ============================================================
// Bench #10, 2026-09-21: I2 applies to the FRAME. Events are authored months
// after their windows; the author's present is the contaminant. This pass is
// the first I2 rule that is mechanically checkable.
//
// It does three things, in descending order of certainty:
//   (a) RESOLVES explicit date expressions in `framing` and flags any that
//       land after the window. This is decidable — a leak, not a suspicion.
//   (b) MATCHES the framing against the dated-facts registry (frame_facts.json).
//       A fact dated once is dated for the whole slate.
//   (c) ITEMISES every remaining number and quoted proposal as OWED A DATE,
//       minus whatever meta.framingAudit already accounts for.
// (a) and (b) are findings. (c) is a worksheet.

const MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6, july:7,
                 august:8, september:9, october:10, november:11, december:12 };

function loadFacts() {
  const p = path.join(__dirname, 'frame_facts.json');
  if (!fs.existsSync(p)) return { facts: [], missing: true };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { facts: [], error: e.message }; }
}

// Resolve month-name references against the window. A framing written for a
// June window that says "In September" is leaking; one that says "In February"
// is looking backward, which is allowed.
function explicitDateLeaks(framing, windowDate) {
  const leaks = [];
  const w = new Date(windowDate + 'T00:00:00Z');
  if (isNaN(w)) return leaks;
  const wy = w.getUTCFullYear(), wm = w.getUTCMonth() + 1;

  // ISO dates
  for (const m of framing.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (d > w) leaks.push({ text: m[0], resolved: m[0], why: 'ISO date after the window' });
  }

  // "In September", "on June 3", "September 9" — month names with optional day
  // Day = 1–2 digits NOT followed by a third digit, so "November 2025" is a
  // month + year, not "November 20" + junk (cried wolf on the Refund, 09-21).
  // Capitalised only: "may import" is a verb (cried wolf on TSMC, 09-21). A
  // month name in a framing is always capitalised; lower-case is never a date.
  const monthRe = new RegExp(`\\b(${Object.keys(MONTHS).map(m => m[0].toUpperCase() + m.slice(1)).join('|')})\\b(\\s+(\\d{1,2})(?!\\d))?(,?\\s+(20\\d{2}))?`, 'g');
  for (const m of framing.matchAll(monthRe)) {
    const mm = MONTHS[m[1].toLowerCase()];
    const dd = m[3] ? parseInt(m[3], 10) : null;
    const yy = m[5] ? parseInt(m[5], 10) : null;
    // An explicit year settles it: only flag when that year+month is after the window.
    if (yy !== null) {
      if (yy > wy || (yy === wy && (mm > wm || (mm === wm && dd && dd > w.getUTCDate()))))
        leaks.push({ text: m[0].trim(), resolved: `${yy}-${String(mm).padStart(2, '0')}`,
                     why: 'explicit year-month after the window' });
      continue;
    }
    // A bare month name in a framing means the nearest such month at or before
    // the window UNLESS it is later in the same year, which is the leak.
    if (mm > wm) {
      leaks.push({
        text: m[0].trim(),
        resolved: `${wy}-${String(mm).padStart(2, '0')}${dd ? '-' + String(dd).padStart(2, '0') : ''}`,
        why: `bare month, no year — falls after the window month if read as ${wy}; harmless if it means ${wy - 1}. ` +
             `A frame that cannot be dated from its own text is not audited. WRITE THE YEAR.`,
      });
    } else if (mm === wm && dd && dd > w.getUTCDate()) {
      leaks.push({
        text: m[0].trim(),
        resolved: `${wy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
        why: 'same month, day after the window',
      });
    }
  }
  return leaks;
}

// WHOLE-WORD matching. v1 used a bare substring and flagged 'landscapers' and
// 'scapegoating' as hits on CAPE. A registry that cries wolf stops being read,
// so a term matches only when no letter sits against either end of it.
const esc = t => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Optional trailing 's': the registry stores 'market access fee', the framing
// writes 'market access fees'. A plural is the same fact. Still blocks
// 'landscapers'/'scapegoating' on CAPE — those are followed by a letter.
const termRe = t => new RegExp(`(?<![A-Za-z])${esc(t)}s?(?![A-Za-z])`, 'i');

function factHits(text, windowDate, facts) {
  const hits = [];
  const w = new Date(windowDate + 'T00:00:00Z');
  for (const f of facts) {
    const terms = Array.isArray(f.match) ? f.match : [f.match];
    if (!terms.every(t => termRe(t).test(text))) continue;
    const fd = new Date(f.date + 'T00:00:00Z');
    if (fd > w) hits.push({ ...f, days: Math.round((fd - w) / 86400000) });
  }
  return hits;
}
const registryLeaks = factHits;

// Every number and every quoted phrase is a fact that owes a date.
// "$71B" in the audit and "$71 billion" in the framing are the same fact. Normalise
// before comparing, or the worksheet re-asks every question the audit already answered.
function normTok(t) {
  return String(t).toLowerCase()
    .replace(/\s+/g, '')
    .replace(/trillion/g, 't').replace(/billion/g, 'b').replace(/million/g, 'm')
    .replace(/[,\u201c\u201d"']/g, '');
}

function itemiseUndated(framing, audit) {
  const accounted = new Set();
  if (audit) {
    for (const k of ['verifiedInWindow', 'keptUnverifiedDate']) {
      for (const s of (audit[k] || [])) {
        for (const tok of String(s).match(/\$[\d.,]+\s*(?:trillion|billion|million|[btmk])?\b|\b\d+(?:\.\d+)?%|"[^"]+"/gi) || [])
          accounted.add(normTok(tok));
      }
    }
  }
  const items = [];
  const seen = new Set();
  // money, percentages, bare large numbers, and quoted proposals
  const re = /\$[\d.,]+\s*(?:trillion|billion|million)?|\b\d+(?:\.\d+)?%|"[^"]{3,60}"|“[^”]{3,60}”/g;
  for (const m of framing.match(re) || []) {
    const key = normTok(m);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ text: m.trim(), accounted: accounted.has(key) });
  }
  return items;
}

// ── THE WHOLE-READING SWEEP (2026-09-21b) ────────────────────────────
// The framing is not the only place the author's present gets in. The 09-21
// sweep found the same leak in a keyword cloud and, 72 days out of window, in
// a band's yWord. Every AUTHORED string is in scope. `meta` is not: the audit
// trail is supposed to name the leak it removed.
const SCOPE = [
  [/^\.framing$|^\.prompt$/,                       'FRAME'],
  [/^\.framingKeywords\[/,                          'CLOUD'],
  [/^\.responses\.[A-D]\.\w+\.(xWord|yWord)$/,      'WORD TAG'],
  [/^\.responses\.[A-D]\.\w+\.words\[/,           'WORD TAG'],
  [/^\.responses\.[A-D]\.\w+\.text$/,              'BAND TEXT'],
  [/^\.responses\.[A-D]\.\w+\.zReason$/,           'Z REASON'],
  [/^\.diatribe\.\w+\.(text|keywords)/,            'DIATRIBE'],
  [/^\.(antiValentRationale|split)/,               'NOTE'],
];
const scopeOf = path => (SCOPE.find(([re]) => re.test(path)) || [null, 'OTHER'])[1];

function sweepReading(d, windowDate, facts) {
  const out = [];
  const seen = new Set();
  (function walk(o, path) {
    if (o === null || o === undefined) return;
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (path === '' && k === 'meta') continue;     // audit trail, by design
        walk(v, `${path}.${k}`);
      }
      return;
    }
    if (typeof o !== 'string' || !o) return;
    for (const h of factHits(o, windowDate, facts)) {
      const key = `${path}|${h.match[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ path, scope: scopeOf(path), ...h });
    }
  })(d, '');
  return out;
}

// A Reading's window. RULED 2026-09-21 (Sailor): readings carry a window and it
// is as tight as it can be — DEFAULT = the trigger day. Longer only when the
// Reading declares it and says why. Readers arriving later are still adjacent
// under I2-extended (TF06); the window governs FACTS, not readers.
function windowOf(d) {
  const w = d.window;
  if (w && w.close) return { close: w.close, declared: true, why: w.why || '(no reason given)' };
  return { close: d.date, declared: false, why: null };
}

function checkReading(file) {
  const name = path.basename(file);
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { kind: 'reading', name, error: e.message }; }

  const framing = [d.framing || '', d.prompt || ''].join('\n');
  const win = windowOf(d);
  const windowDate = win.close;
  const audit = (d.meta || {}).framingAudit;
  const reg = loadFacts();

  return {
    kind: 'reading', name,
    title: d.title, date: windowDate,
    status: (d.meta || {}).status,
    hasAudit: !!audit,
    auditDate: audit && audit.date,
    explicit: windowDate ? explicitDateLeaks(framing, windowDate) : [],
    registry: windowDate ? registryLeaks(framing, windowDate, reg.facts || []) : [],
    sweep: windowDate ? sweepReading(d, windowDate, reg.facts || []) : [],
    win,
    owed: itemiseUndated(framing, audit),
    registryMissing: reg.missing,
    // schema keys added 09-21 — the storage contract is amended in Schema_v2_Addendum
    newKeys: ['diatribeLayer', 'objectLayer'].filter(k => d[k] !== undefined),
    instrumentRings: (() => {
      const out = [];
      for (const [q, resp] of Object.entries(d.responses || {}))
        for (const ring of RINGS)
          if (resp[ring] && resp[ring].instrument) out.push(`${q}.${ring}`);
      return out;
    })(),
    // THE RIM RULE — R-0921-1 (RULED 2026-09-21). (a) instrument{holder, trusted} is
    // a permanent field on every band; (b) a rim's z is signed by its declared
    // trust — a denominated band whose z sign disagrees with instrument.trusted
    // is a formula fault. Pre-v1 Readings (formulaVersion < 1) are exempt.
    rimRule: (() => {
      const fv = parseFloat(d.formulaVersion || '0');
      const faults = [], missing = [], acknowledged = [];
      if (!(fv >= 1)) return { exempt: true, faults, missing, acknowledged };
      for (const [q, resp] of Object.entries(d.responses || {}))
        for (const ring of RINGS) {
          const b = resp[ring]; if (!b) continue;
          const ins = b.instrument;
          if (!ins || typeof ins.holder !== 'string' || typeof ins.trusted !== 'boolean') { missing.push(`${q}.${ring}`); continue; }
          if (ring === 'denominated' && typeof b.z === 'number' && b.z !== 0 && ((b.z > 0) !== ins.trusted)) {
            // An acknowledged exception (bench #14: believes delivery, not to them)
            // is declared on the band as instrument.exception and reported, not faulted.
            if (typeof ins.exception === 'string' && ins.exception.length) acknowledged.push(`${q}.${ring}: ${ins.exception}`);
            else faults.push(`${q}.${ring}: z ${b.z >= 0 ? '+' : ''}${b.z} but trusted=${ins.trusted}`);
          }
        }
      return { exempt: false, faults, missing, acknowledged };
    })(),
    // THE HIGHLIGHT (protocol v1.4, 2026-09-27). Each Diatribe line's keywords[]
    // is layered: keywords[0] is the object, the rest express the response;
    // two to four phrases, each verbatim in that line's text.
    // The portal lights exactly these; an empty keywords[] falls back to the
    // framing nouns, which is the "same glow at every band" the rule retires.
    // Only Readings authored under the protocol (authorTier "claude") or the
    // example are held to it; older Sailor Readings are reported, not faulted.
    highlight: (() => {
      const faults = [], missing = [];
      const held = d.authorTier === 'claude' || d.example === true || (d.meta && d.meta.status === 'example');
      for (const k of ['LF', 'LC', 'LD', 'RF', 'RC', 'RD']) {
        const line = d.diatribe && d.diatribe[k]; if (!line) continue;
        const kw = Array.isArray(line.keywords) ? line.keywords.filter(w => typeof w === 'string' && w.trim()) : [];
        if (!kw.length) { missing.push(k); continue; }
        if (kw.length > 4) faults.push(`${k}: ${kw.length} keywords (four at most; the first is the object)`);
        const text = String(line.text || '').toLowerCase();
        for (const w of kw) if (!text.includes(w.trim().toLowerCase())) faults.push(`${k}: "${w}" is not in the line`);
      }
      return { held, faults, missing };
    })(),
  };
}

// ============================================================
// OUTPUT
// ============================================================

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node formula_check.js <trace_data.js | reading.json> ...');
  process.exit(1);
}

let anyIncomplete = false, anyLeak = false;

for (const f of files) {
  const isReading = f.toLowerCase().endsWith('.json');
  const r = isReading ? checkReading(f) : checkTrace(f);

  console.log('\n' + '='.repeat(66));
  if (r.error) { console.log(`${r.name}\n  ERROR: ${r.error}`); continue; }

  if (r.kind === 'trace') {
    console.log(`${r.id} — ${r.label}`);
    console.log(`  ${r.name}`);
    console.log('-'.repeat(66));
    let filled = 0, empty = 0, missing = 0;
    for (const s of r.slots) {
      let mark, detail = '';
      if (s.r === 'FILLED') { mark = 'FILLED       '; filled++; }
      else if (s.r === 'MISSING') { mark = 'MISSING      '; missing++; }
      else if (s.r.partial) { mark = 'PARTIAL      '; detail = ` — ${s.r.partial}`; missing++; }
      else { mark = 'DECLARED-EMPTY'; detail = ` — ${s.r.declaredEmpty}`; empty++; }
      console.log(`  ${s.id.padEnd(4)} ${mark}  ${s.label}${detail}`);
    }
    const complete = missing === 0;
    if (!complete) anyIncomplete = true;
    console.log('-'.repeat(66));
    console.log(`  FORMULA-COMPLETE: ${complete ? 'YES' : 'NO'}   ` +
      `(${filled} filled · ${empty} declared-empty · ${missing} missing)`);
    if (r.notes.length) {
      console.log('\n  Observations:');
      for (const n of r.notes) console.log(`    · ${n}`);
    }
    continue;
  }

  // ---- reading report ----
  console.log(`${r.title || '(untitled)'}`);
  console.log(`  ${r.name}  ·  window ${r.date || '(NO DATE — cannot run the pass)'}` +
    `${r.win && r.win.declared ? ` → ${r.win.close} (declared: ${r.win.why})` : ' (trigger day — default)'}` +
    `  ·  ${r.status || '?'}`);
  console.log('-'.repeat(66));
  if (r.registryMissing) console.log('  (frame_facts.json not found — registry pass skipped)');

  const leaks = r.explicit.length + r.registry.length;
  if (leaks || (r.sweep || []).some(h => h.scope !== 'FRAME')) anyLeak = true;
  if (r.rimRule && !r.rimRule.exempt && (r.rimRule.faults.length || r.rimRule.missing.length)) anyIncomplete = true;
  if (r.highlight && r.highlight.held && (r.highlight.faults.length || r.highlight.missing.length)) anyIncomplete = true;

  if (r.registry.length) {
    console.log('  FRAME LEAK — dated facts from the registry, after the window:');
    for (const h of r.registry)
      console.log(`    !! "${h.match.join('" + "')}" — ${h.fact}\n       dated ${h.date} (+${h.days}d after window) · ${h.source}`);
  }
  const beyond = (r.sweep || []).filter(h => h.scope !== 'FRAME');
  if (beyond.length) {
    console.log('  LEAK BEYOND THE FRAMING — same test, every authored string:');
    for (const h of beyond)
      console.log(`    !! [${h.scope}] ${h.path}\n       "${h.match[0]}" dated ${h.date} (+${h.days}d after window) · ${h.fact}`);
  }
  if (r.explicit.length) {
    console.log('  DATE EXPRESSIONS resolving after the window:');
    for (const e of r.explicit)
      console.log(`    ?  "${e.text}" -> ${e.resolved} · ${e.why}`);
  }
  if (!leaks && !beyond.length) console.log('  Window sweep: no leak detected by registry or explicit date.');

  const unaccounted = r.owed.filter(i => !i.accounted);
  console.log(`\n  OWED A DATE — ${unaccounted.length} of ${r.owed.length} items not accounted for in meta.framingAudit:`);
  if (!r.hasAudit) console.log('    (no meta.framingAudit on this reading — the frame has never been audited)');
  for (const i of unaccounted) console.log(`    -  ${i.text}`);
  if (!unaccounted.length && r.owed.length) console.log('    (all accounted for)');

  if (r.hasAudit) console.log(`\n  meta.framingAudit present, dated ${r.auditDate || '(undated)'}`);
  if (r.newKeys.length) console.log(`  Schema v2 keys present: ${r.newKeys.join(', ')}`);
  if (r.instrumentRings.length) console.log(`  instrument{} on: ${r.instrumentRings.join(', ')}`);
  if (r.rimRule && !r.rimRule.exempt) {
    if (r.rimRule.missing.length) console.log(`  RIM RULE — instrument{} MISSING on: ${r.rimRule.missing.join(', ')}`);
    if (r.rimRule.faults.length) { console.log('  RIM RULE FAULT — rim z sign disagrees with declared trust:'); r.rimRule.faults.forEach(f => console.log(`    !! ${f}`)); }
    (r.rimRule.acknowledged || []).forEach(a => console.log(`  Rim rule — acknowledged exception (bench #14): ${a}`));
    if (!r.rimRule.missing.length && !r.rimRule.faults.length) console.log('  Rim rule (R-0921-1): all twelve carry instrument{}; rim signs agree with trust.');
  }
  if (r.highlight) {
    const h = r.highlight, tag = h.held ? 'HIGHLIGHT RULE' : 'Highlight (not held — pre-v1.4 Reading)';
    if (h.missing.length) console.log(`  ${tag} — keywords[] empty on: ${h.missing.join(', ')}${h.held ? '' : ' (the caption falls back to the framing nouns)'}`);
    if (h.faults.length) { console.log(`  ${tag} FAULT:`); h.faults.forEach(f => console.log(`    !! ${f}`)); }
    if (!h.missing.length && !h.faults.length) console.log('  Highlight rule (v1.4): every Diatribe line carries its own lit phrase, verbatim.');
  }
}

console.log('\n' + '='.repeat(66));
if (anyLeak)
  console.log('FRAME LEAKS FOUND. A leak is the author\'s present inside the window.\n' +
              'The registry pass is decidable; the date-expression pass is a flag, not a verdict.\n' +
              'The OWED list is a worksheet: date each item, then record it in meta.framingAudit.');
if (anyIncomplete)
  console.log('Some traces are not formula-complete. A MISSING slot is not a failure —\n' +
              'it is either work owed or a declared empty that has not been written down.');
if (!anyLeak && !anyIncomplete) console.log('All clean.');
console.log('='.repeat(66) + '\n');
