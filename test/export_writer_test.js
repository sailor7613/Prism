// ============================================================
// EXPORT WRITER TEST — Event_Data_Schema_v1 §5 / §7
// Extracts the DOM-free pure functions (EXPORT_PURE block) straight
// out of admin.html and asserts against them, so the test always
// runs against the live code.
//
// Run:  cd Prism && node test/export_writer_test.js
// Exit 0 = all pass. Add cases as the schema evolves.
// ============================================================
const fs = require('fs');
const path = require('path');

// ── Extract the pure block from admin.html ──
const adminPath = path.join(__dirname, '..', 'admin.html');
const admin = fs.readFileSync(adminPath, 'utf8');
const m = admin.match(/\/\/ ── EXPORT_PURE_BEGIN ──([\s\S]*?)\/\/ ── EXPORT_PURE_END ──/);
if (!m) {
  console.error('✗ EXPORT_PURE markers not found in admin.html — did the module move?');
  process.exit(1);
}
eval(m[1]);

// ── Fixtures ──

// Legacy-shaped seed event (goodFaith/badFaith band keys, pre-June shape)
const legacy = {
  id: 'evt_001',
  title: 'ICE killing of Alex Pretti / Second Amendment inversion',
  category: 'Domestic Policy · 2A · Immigration',
  framing: 'On January 24, 2026, ICE agents shot and killed Alex Pretti...',
  prompt: 'Legally armed nurse killed by ICE during immigration operation.',
  meta: { dialecticsRef: 'cs01', status: 'published', editHistory: [] },
  date: '2026-01-24',
  active: true,
  prevalentAxis: 'x',
  antiValentBand: 'badFaith',
  axes: { x: { pos: 'Right', neg: 'Left' }, y: { pos: 'Institutional', neg: 'Grassroots' } },
  responses: {
    A: { xSide: 'left', source: '',
      goodFaith: { text: 'A man was killed by his government. That demands investigation.', xWord: 'government', yWord: 'investigation', words: [] },
      coalition: { text: "We jumped from 'investigate' to 'abolish ICE' too fast.", xWord: 'ICE', yWord: 'jumped', words: [] },
      badFaith:  { text: 'They executed a nurse and hid the footage. Block every DHS dollar.', xWord: 'executed', yWord: 'block', words: [] } },
    B: { xSide: 'right', source: '',
      goodFaith: { text: "Enforcement requires accountability. DHS can't investigate itself.", xWord: 'enforcement', yWord: 'accountability', words: [] },
      coalition: { text: 'I support enforcement. But he was no terrorist and they know it.', xWord: 'enforcement', yWord: 'terrorist', words: [] },
      badFaith:  { text: 'He showed up armed to interfere. The officers are the victims.', xWord: 'armed', yWord: 'officers', words: [] } },
    C: { xSide: 'left', source: '',
      goodFaith: { text: "He saw someone being hurt and stepped in. That's what neighbors do.", xWord: 'neighbors', yWord: 'stepped in', words: [] },
      coalition: { text: 'The arming discourse scares me.', xWord: 'arming', yWord: 'anger', words: [] },
      badFaith:  { text: "Arm up. If they'll execute a nurse, nobody is safe.", xWord: 'arm up', yWord: 'execute', words: [] } },
    D: { xSide: 'right', source: '',
      goodFaith: { text: 'Legal carrier, legal permit, shot on the ground.', xWord: 'legal', yWord: 'gun owner', words: [] },
      coalition: { text: "Our side explained why it was okay. That's tribalism.", xWord: '2A', yWord: 'tribalism', words: [] },
      badFaith:  { text: 'Play stupid games.', xWord: 'armed', yWord: 'federal', words: [{ t: 'armed', w: 'x+', weight: 0.8 }] } }
  },
  diatribe: {
    LF: { text: 'The left is holding what is true...', side: 'left', band: 'fluid' },
    LC: { text: 'The left is watching its own discourse skip...', side: 'left', band: 'coalition' },
    LD: { text: 'The left is reading the killing as proof...', side: 'left', band: 'denominated' },
    RF: { text: 'The principled right is holding the constitutional line...', side: 'right', band: 'fluid' },
    RC: { text: 'The right is watching its own people...', side: 'right', band: 'coalition' },
    RD: { text: 'The right is performing law-and-order loyalty...', side: 'right', band: 'denominated' }
  }
};

// Modern-shaped event (June canon: cloud-bearing, y-prevalent)
const modern = {
  id: 'evt_010', title: 'The conflict with Iran (general)', category: 'Foreign Policy · Iran',
  date: '2026-06-24', active: false, prompt: 'Is Iran a threat, and is the answer confrontation or diplomacy?',
  framing: 'For two decades...', framingKeywords: ['nuclear', 'JCPOA', 'empire'],
  prevalentAxis: 'y', antiValentBand: 'fluid', antiValentRationale: 'test rationale',
  axes: { x: { pos: 'Threat', neg: 'Non-threat' }, y: { pos: 'Confrontation', neg: 'Diplomacy' } },
  responses: {
    A: { xSide: 'left', source: '', fluid: { cloud: ['jcpoa'], text: 'The deal was working.', xWord: 'deal', yWord: 'working', words: [] },
         coalition: { cloud: ['economy', 'now'], text: 'Fix what is breaking at home.', xWord: 'economy', yWord: 'home', words: [] },
         denominated: { cloud: ['trump', 'provoking'], text: 'Trump is provoking Iran.', xWord: 'trump', yWord: 'provoking', words: [] } },
    B: { xSide: 'right', source: '', fluid: { cloud: ['threat'], text: 'Iran is a threat we deal with.', xWord: 'threat', yWord: 'deal', words: [] },
         coalition: { cloud: ['nuke', 'act'], text: 'They want a nuke.', xWord: 'nuke', yWord: 'act', words: [] },
         denominated: { cloud: ['evil', 'destroy'], text: 'They are evil and must be destroyed.', xWord: 'evil', yWord: 'destroy', words: [] } },
    C: { xSide: 'left', source: '', fluid: { cloud: ['anti-war'], text: 'Not another war.', xWord: 'war', yWord: 'not', words: [] },
         coalition: { cloud: ['empire'], text: 'The empire is out of control.', xWord: 'empire', yWord: 'control', words: [] },
         denominated: { cloud: ['pro-iran'], text: 'Iran stands up to the empire.', xWord: 'iran', yWord: 'empire', words: [] } },
    D: { xSide: 'right', source: '', fluid: { cloud: ['america first'], text: 'Not our fight.', xWord: 'america', yWord: 'fight', words: [] },
         coalition: { cloud: ['no more endless war'], text: 'We bled enough.', xWord: 'war', yWord: 'bled', words: [] },
         denominated: { cloud: ['iran won'], text: 'Iran won.', xWord: 'won', yWord: 'lost', words: [] } }
  },
  diatribe: {
    LF: { text: 'a', side: 'left', band: 'fluid' }, LC: { text: 'b', side: 'left', band: 'coalition' },
    LD: { text: 'c', side: 'left', band: 'denominated' }, RF: { text: 'd', side: 'right', band: 'fluid' },
    RC: { text: 'e', side: 'right', band: 'coalition' }, RD: { text: 'f', side: 'right', band: 'denominated' }
  },
  arcMemberships: [{ arcId: 'arc_001', status: 'confirmed' }],
  meta: { status: 'draft', source: '', dialecticsRef: null, editHistory: [], aiDeltas: [{ field: 'framing', proposalValue: 'x', savedValue: 'y', savedAt: 't', promptId: 'PRISM_SYSTEM_PROMPT_v1' }] }
};

// ── Harness ──
let failures = 0;
function assert(cond, label) {
  if (cond) { console.log('  ✓ ' + label); } else { failures++; console.log('  ✗ FAIL: ' + label); }
}

console.log('— Legacy event (evt_001, goodFaith/badFaith) —');
const n1 = normalizeEventForExport(legacy);
assert(n1.responses.A.fluid && n1.responses.A.fluid.text.startsWith('A man was killed'), 'goodFaith → fluid (content preserved)');
assert(n1.responses.A.denominated && n1.responses.A.denominated.text.startsWith('They executed'), 'badFaith → denominated');
assert(!('goodFaith' in n1.responses.A) && !('badFaith' in n1.responses.A), 'legacy keys removed');
assert(n1.antiValentBand === 'denominated', 'antiValentBand badFaith → denominated');
assert(Array.isArray(n1.responses.B.coalition.cloud) && n1.responses.B.coalition.cloud.length === 0, 'cloud: [] backfilled');
assert(n1.responses.D.denominated.words.length === 1 && n1.responses.D.denominated.words[0].w === 'x+', 'words[] preserved');
assert(n1.meta.aiDeltas.length === 0 && n1.meta.status === 'published', 'meta normalized');
assert(legacy.responses.A.goodFaith.text.length > 0, 'input not mutated');

const md1 = buildEventMarkdown(n1, 1);
assert(md1.startsWith('# evt_001 — ICE killing'), 'header');
assert(md1.includes('**x-prevalent · 2026-01-24'), 'prevalence line');
assert(md1.includes('### A — Left · Institutional  (upper-left)'), 'A = upper-left (−X,+Y) per schema §6');
assert(md1.includes('### B — Right · Institutional  (upper-right)'), 'B = upper-right (+X,+Y)');
assert(md1.includes('### D — Right · Grassroots  (lower-right)'), 'D = lower-right (+X,−Y)');
assert(md1.includes('## The Diatribe') && md1.includes('## Framing keywords'), 'schema §5 sections present');
const jsonBlock1 = md1.match(/## Data\n```json\n([\s\S]*?)\n```/);
assert(!!jsonBlock1, 'Data block present');
const roundtrip1 = JSON.parse(jsonBlock1[1]);
assert(JSON.stringify(roundtrip1) === JSON.stringify(n1), 'JSON block round-trips exactly');
assert(eventExportFilename(n1) === 'evt_001_ice-killing-of-alex-pretti-second.md', 'filename: ' + eventExportFilename(n1));

console.log('\n— Modern event (June canon, cloud-bearing) —');
const n2 = normalizeEventForExport(modern);
assert(n2.responses.B.denominated.cloud.join(' ') === 'evil destroy', 'cloud preserved');
assert(n2.antiValentRationale === 'test rationale', 'antiValentRationale persisted');
assert(n2.arcMemberships && n2.arcMemberships[0].arcId === 'arc_001', 'arcMemberships preserved');
assert(n2.meta.aiDeltas.length === 1 && n2.meta.aiDeltas[0].promptId === 'PRISM_SYSTEM_PROMPT_v1', 'aiDeltas lineage preserved');
const md2 = buildEventMarkdown(n2, 3);
assert(md2.includes('· v3'), 'export version in header');
assert(md2.includes('- **denominated** — `evil · destroy` → "They are evil and must be destroyed."'), 'cloud → response line format');
assert(md2.includes('### A — Non-threat · Confrontation  (upper-left)'), 'y-prevalent axis labels on quadrants');
assert(md2.includes('antiValentBand: **fluid** — test rationale'), 'rationale rendered');

console.log('\n— Edge cases —');
const bare = normalizeEventForExport({ id: 'evt_099', title: "Sailor's «Test»: A/B?!", prevalentAxis: 'y' });
assert(bare.responses.A.fluid.text === '' && bare.responses.C.denominated.cloud.length === 0, 'empty event normalizes without throwing');
assert(buildEventMarkdown(bare, 1).includes('## Data'), 'empty event renders');
assert(/^evt_099_[a-z0-9-]+\.md$/.test(eventExportFilename(bare)), 'messy title slugifies clean: ' + eventExportFilename(bare));
assert(normalizeBandName('coalitional') === 'coalition' && normalizeBandName('nominal') === 'fluid' && normalizeBandName('conviction') === 'denominated', 'diatribeBand/intensityBand aliases');

// Optional: write inspectable samples next to the test
if (process.argv.includes('--samples')) {
  fs.writeFileSync(path.join(__dirname, 'export_sample_legacy.md'), md1);
  fs.writeFileSync(path.join(__dirname, 'export_sample_modern.md'), md2);
  console.log('\nSamples written to test/export_sample_*.md');
}

console.log(failures === 0 ? '\nALL TESTS PASSED (29)' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
