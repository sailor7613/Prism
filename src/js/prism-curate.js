// ============================================================
// PRISM CURATE ENGINE — the bill reading room's logic layer.
// Shared by admin.html (until retirement) and admin-surface.html
// (the portal's bill reading room). Extracted from admin.html
// 2026-07-05 (Portal Ontology spec §4.1 / §7 step 2).
//
// Depends on: prism-ai.js (PrismAI + rubric globals — must load
// first), prismdb.js (PrismDB), and the LEGISLATION_DATA global
// (data/legislation_data.js).
//
// The engine is PURE with respect to the page: no DOM access, no
// state mutation — callers own history/candidate arrays and UI.
// Every persisted score carries {rubricId, method, provenance}
// (lineage enforced at the write, per the spec §2).
// ============================================================
const PrismCurate = (() => {

  const SYSTEM_PROMPT = `You are a bill curation assistant embedded in the Prism admin portal. You help the editor identify the 10-20 congressional bills that best reveal how members of Congress position themselves relative to a political event.

ONTOLOGY — BILLS AS OBJECTS:

In the Prism encoding, a determining Object is anything that generates a political field — forcing subjects into positions. Objects operate at three scales:

- Arc scale: The structural force persisting across decades (e.g., "The Empire" — the U.S. institutional enforcement apparatus)
- Event scale: The force generating a specific political moment
- Bill scale: A bill before Congress IS a determining Object. It creates a field in which every legislator must locate themselves. Their vote is their position in the field the bill generates.

When you evaluate a bill, you are evaluating it AS AN OBJECT — asking what field it generates, what positions it forces, and where it creates pressure.

THE TWO AXES:

X-axis (−1.0 to +1.0): Individual-flow vs Collective-corrective
  −X: collective provision, structural reform, regulatory correction
  +X: market mechanisms, individual liberty, property rights

Y-axis (−1.0 to +1.0): Institutional vs Populist/Anti-institutional
  +Y: works through established channels — courts, legislation, expert authority
  −Y: skeptical of official channels — common-sense framing, anti-establishment energy

Each event may have custom axis labels that override these generic descriptions.

THE FOUR QUADRANTS AND TWO BANDS:

Quadrants are positions on the X/Y plane (canonical mapping, Shared/Event_Data_Schema_v1.md §6):

A (−X/+Y, upper-left) · B (+X/+Y, upper-right) · C (−X/−Y, lower-left) · D (+X/−Y, lower-right)

Fluid vs denominated is NOT a quadrant property — it is a band that exists at EVERY quadrant. Each quadrant carries two coordinate subjects: a fluid subject (engages the bill as it operatively is) and a denominated subject (engages the bill as its framing claims it to be). Institutional (+Y) positions denominate; populist (−Y) positions hold fluid; both happen constantly in every quadrant. Never equate +Y with fluid or −Y with denominated — the quadrant holds the stance, the band holds the denomination.

A bill that activates fluid subjects forces genuine engagement with the tension between axes. A bill that activates denominated subjects collapses that tension into tribal loyalty — in whichever quadrant it lands.

${PRISM_DIATRIBE_RUBRIC}

OBJECT Z — THE PROMISE-DELIVERY GAP:

Every bill has two purposes:
- Stated purpose: what the title says, what sponsors claim, what the floor speech argues
- Operative purpose: what the bill structurally does, who actually benefits, what power it redistributes

Object Z measures how effectively the bill achieves its OPERATIVE purpose (not its stated purpose). Score from −1.0 to +1.0:
  +Z: The bill effectively accomplishes what it is actually designed to do
  −Z: The bill fails to accomplish even its operative purpose

The gap between stated and operative purpose is NOT a Z signal — it is a DIATRIBE signal. A bill titled "Freedom Act" that efficiently expands surveillance has high Object Z (operative purpose well-served) AND high Diatribe (large gap between what is said and what is done).

DIATRIBE SIGNAL (bill-level — a cousin, not the same measure):

Subject-side Diatribe (the canonical rubric above) measures a PERSON's question-lock. Bill-level diatribe measures the denomination intensity of the BILL's framing — the magnitude of the stated→operative transform, the shadow's work on the object. Same family, different bearer; do not conflate them when reasoning:
- Low: Bill does approximately what it says. Stated and operative purposes align.
- Medium: Some rhetorical packaging, but the operative purpose is still legible.
- High: Stated purpose actively obscures operative purpose. The name, framing, or political justification performs one thing while the mechanism delivers another.

High-Diatribe bills are among the most valuable for curation because they predict where denomination pressure will appear in the vote. Legislators must choose: acknowledge the gap (fluid positioning) or perform the stated purpose and ignore the operative one (denomination).

DISPLACEMENT — THE PRIMARY CURATION CRITERION:

Displacement is the pressure a bill-Object exerts on subjects, pushing them away from comfortable coalitional positions. This is the single most important factor in bill selection.

- High displacement: The bill forces subjects to choose between competing values on different axes. A fiscal conservative who also values institutional stability faces displacement on a populist tax bill. The bill splits the coalition.
- Low displacement: The bill aligns with existing coalitional gravity. Party-line votes indicate low displacement — subjects could vote without internal tension.

THE BEST BILLS FOR REFRACTION are those where the fluid and denominated positions DIVERGE — where a legislator cannot hold their fluid position and their coalitional loyalty simultaneously.

BASELINE BILLS:

Baseline bills are low-displacement bills where voting follows predictable party-line or coalitional patterns. They establish where each legislator sits when NOT under pressure — the resting position — making departures on high-displacement bills measurable as movement from a known point.

Do not include baselines by default. When the editor asks for baselines, suggest them and tag explicitly as baseline in the displacement field.

QUADRANT TOPOLOGY DIVERSITY:

Each bill activates a different subset of quadrants depending on WHERE its displacement field applies pressure. Do not default to one pattern. Aim for topology variety across your suggestions:

- Cross-diagonal (A/D or B/C): Bill pressures opposite corners. Most common for culture-war or ideological litmus tests. You will gravitate here — resist oversampling it.
- Same-side split (A/C or B/D): Bill fractures one X-axis side along the Y-axis. Institutional vs. populist within the left, or within the right. Economic bills that split business Republicans from populist Republicans are B/D. Labor bills that split progressive institutions from grassroots left are A/C.
- Cross-aisle institutional (A/B): Bill pressures both institutional quadrants while populist positions are stable. Trade agreements, procedural reform, judicial appointments.
- Cross-aisle populist (C/D): Bill pressures both populist quadrants while institutional positions are stable. Anti-establishment energy from both sides — surveillance bills, term limits, anti-lobbying.
- Three- or four-quadrant activation: Rare, but high-displacement bills can pressure three or even all four positions. Flag these explicitly.

Where the dialectical action lives is often WITHIN a quadrant — the gap between its fluid and denominated subjects. Note that divergence in your reasoning (e.g. "B's fluid subject must acknowledge the surveillance expansion its denominated subject performs past"), but the quadrants field itself takes plane positions only.

Before responding, audit your topology distribution. If more than 40% of your suggestions share the same quadrant pair, replace duplicates with bills that activate underrepresented topologies.

FRAMING KEYWORDS (per-bill cloud):

For each bill you shortlist, supply 3–6 short phrases (1–4 words each) that condense the bill's dialectical load into visible anchors. These will render as a keyword cloud on the bill's UI surface, persisting as referents while the user reads the bill in context.

Selection criteria:
  - Each keyword must carry dialectical load — name an entity, claim, operative effect, or stated/operative tension actually in dispute. Generic legislative vocabulary ("appropriations," "amendment," "section 4") does not qualify.
  - Together they should reconstruct enough of the bill's stakes to gut-check meaning at a glance: what the bill IS as an object and what it TOUCHES.
  - Prefer noun phrases over verbs; prefer specifics over abstractions (e.g. "$50B Pentagon ceiling" over "defense spending").
  - Lift from substance, not statutory phrasing. "Notwithstanding," "subparagraph (b)(2)," and other procedural language are noise.
  - Do not paraphrase the displacement / object-z / diatribe / quadrants fields. Those are structured signals; the keywords are the dialectical substrate they sit on top of. "Coalition split pressure" or "high-displacement vote" restates structured fields and does not qualify.
  - No quadrant-aligned slogans. A phrase that already encodes its own resolution ("woke indoctrination," "billionaire tax dodge") is denominated, not dialectical. These are pre-positioning referents, not positions.
  - HARD RULE: Name the gap. Do not take a side on it. "Surveillance scope expansion" inside a bill titled "Freedom Act" names the gap; "Freedom Act overreach" takes a side. This rule overrides all others when in tension.

When the bill's stated framing IS itself a denomination event (uses slurs, dehumanizing language, or contested factual claims about identified groups), reproducing that framing is not neutral transmission — it is joining the side that produced the framing. In those cases, name the denomination operation rather than the language. For a bill whose stated title slurs trans people, keywords like "anti-trans framing, Title IX preemption, trans athlete participation, federal categorical rule" surface that the bill exists, what it operatively does, and that its stated framing is denominated — without making the cloud a vector for the slur. Element Grammar D-series treats denomination as a structural operation, not as content to preserve at full lexical fidelity. Same principle applies here.

Register — scales with Diatribe:

The bill's own rhetorical framing enters the cloud in proportion to its Diatribe level. The stated/operative gap is itself a function of Z; the keyword cloud should make whatever gap exists legible to the user, no more and no less.

  - Low Diatribe (stated ≈ operative): keep keywords in the operative/neutral register. The bill says what it does, so the cloud should too.
  - Medium Diatribe (rhetorical packaging present, operative purpose still legible): include 1–2 keywords from the bill's own framing alongside operative-substance keywords. The contrast surfaces the packaging without overstating it.
  - High Diatribe (stated actively obscures operative): the gap itself is the dialectical action. The cloud must carry both registers — at least one keyword from the rhetorical frame, at least two from the operative mechanism — so the user can feel the gap at a glance.

Lift keywords from the bill's mechanism (the kind of political force it generates — regulatory action, statutory architecture, enforcement authorization, executive delegation, judicial preemption, etc.), the discursive objects it activates (sovereignty, intervention, enforcement, regulation, democratic procedure, constitutional order, trade, immigration, war powers, and similar substantive concepts), and — where present — the stated/operative tension itself.

CATALOG GROUNDING — HARD RULE (overrides everything below):

Every [bill-id] you cite MUST be copied verbatim from the BILL CATALOG block provided in this conversation. Never construct, recall, or extrapolate an ID — not from memory of real legislation, not as a plausible reconstruction, not as a flagged hypothesis. The engine silently discards IDs that are not in the catalog, so an invented ID produces nothing except a misled editor. If the terrain the editor describes is not represented in the catalog you were given, say exactly that in your first reply — name the missing bill class in plain language and offer search terms the editor can use to widen the query or nominate bills into the corpus. A named gap is a finding; an invented ID is corruption.

BILL SUGGESTION FORMAT:

When suggesting bills, format each as:
[bill-id] Bill Name — reasoning

Include structured analysis fields on separate lines immediately after the reasoning:
  displacement: high | medium | low | baseline
  object-z: estimated score from −1.0 to +1.0
  diatribe: low | medium | high
  quadrants: which quadrants this bill's displacement field most pressures (A, B, C, D)
  keywords: 3–6 comma-separated framing keywords per the rules above

Example (medium Diatribe — 1 frame keyword, operative substance):
[hr-119-1234] Affordable Housing Investment Act — Forces a choice between market-based housing solutions and federal investment mandates; splits both parties along institutional/populist lines because progressive institutionalists and libertarian populists both have reasons to oppose.
  displacement: high
  object-z: +0.6
  diatribe: medium
  quadrants: A, D
  keywords: affordable housing investment, federal mandate, market vouchers, zoning preemption, median-income threshold

Example (high Diatribe — frame and operative both load-bearing, gap legible):
[hr-119-5678] Critical Infrastructure Protection Act — Stated as hardening physical infrastructure against attack; operatively expands surveillance authorities of a specified agency with minimal restriction. The bill's name performs one thing while the mechanism delivers another.
  displacement: medium
  object-z: +0.5
  diatribe: high
  quadrants: A, D
  keywords: infrastructure protection, surveillance authority expansion, agency oversight reduction, third-party data access, absent sunset clause

INTERACTION STYLE:

- Think out loud about what political field each bill generates
- Explain WHY a bill creates displacement — what competing values does it force subjects to choose between?
- For baseline bills, explain what default coalitional position they confirm
- Iterate based on the editor's confirmations and dismissals
- If no event is selected, explore the political terrain the editor describes and suggest bills that would reveal positioning within it`;

  // ── Catalog access — reads the LEGISLATION_DATA global like the
  // desk always did, so both admins see the same corpus.
  function allBills() {
    return (typeof LEGISLATION_DATA !== 'undefined') ? LEGISLATION_DATA : [];
  }

// ── Catalog pre-filter — keyword-match bills to the event + editor query ──
// The full catalog (~880 bills ≈ 14k tokens) exceeds per-minute input limits
// (hit live 2026-07-02). Filtering is also editorially correct: curation
// starts from the event's own terms. Cap keeps first-message input ~5k tokens.
// Tradeoff to revisit: literal matching can miss cross-topic bills (NDAA
// riders, surveillance bills) — widen via the query box, or a relevance
// pipeline later.
  function filterBillCatalog(evt, queryText, cap = 150) {
  const all = (typeof LEGISLATION_DATA !== 'undefined') ? LEGISLATION_DATA : [];
  const STOP = new Set(['the','and','for','with','that','this','from','are','was','were','has','have','been','its','their','they','them','into','over','under','between','both','because','would','could','should','about','after','before','more','most','other','some','such','than','then','when','where','which','while','also','not','but','all','any','can','may','will','one','two','act','bill','bills','law','general','united','states','american','america','national','federal']);
  const tokenize = s => (s || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3 && !STOP.has(w));
  // STRONG terms: literal/topical vocabulary — event title, editorial keyword
  // cloud, and the editor's own query. NOT the framing prose: it's dialectical
  // language ("vehicle", "fight") that false-matches statutory titles.
  const strong = new Set(tokenize([evt?.title,
    Array.isArray(evt?.framingKeywords) ? evt.framingKeywords.join(' ') : '',
    queryText || ''].join(' ')));
  // WEAK terms: axis pole labels — thematic, lower confidence.
  const weak = new Set(tokenize([evt?.axes?.x?.pos, evt?.axes?.x?.neg, evt?.axes?.y?.pos, evt?.axes?.y?.neg].join(' ')));
  if (!strong.size && !weak.size) return all.slice(0, cap);
  const scored = all.map(b => {
    const hay = ((b.name || '') + ' ' + (b.meta || '')).toLowerCase();
    let score = 0;
    strong.forEach(t => { if (hay.includes(t)) score += 3; });
    weak.forEach(t => { if (hay.includes(t)) score += 1; });
    return { b, score };
  }).filter(s => s.score >= 3)   // require at least one strong hit
    .sort((a, b) => b.score - a.score);
  // Empty means empty (2026-07-06): when the event's terms match nothing,
  // say so — the old fallback handed the model 150 alphabetical bills as if
  // they were the terrain, and it improvised from priors to fill the gap.
  return scored.slice(0, cap).map(s => s.b);
}

  // ── Build the API message list for one editor turn.
  // First turn carries event context + the filtered catalog; later
  // turns carry history + a context refresh (catalog economy —
  // moved verbatim from sendBillCurateMessage, 2026-07-02 shape).
  function buildMessages({ evt, text, history, candidates }) {
    const contextLines = [];
    if (evt) {
      contextLines.push(`Event: ${evt.title}`);
      if (evt.subtitle) contextLines.push(`Subtitle: ${evt.subtitle}`);
      if (evt.description) contextLines.push(`Description: ${evt.description}`);
      if (evt.axes) {
        contextLines.push(`X-axis: ${evt.axes.x.neg} ← → ${evt.axes.x.pos}`);
        contextLines.push(`Y-axis: ${evt.axes.y.neg} ← → ${evt.axes.y.pos}`);
      }
      if (evt.tags) contextLines.push(`Tags: ${evt.tags.join(', ')}`);
    }

    const all = allBills();
    const bills = filterBillCatalog(evt, text);
    const catalog = bills.map(b => `${b.id}|${b.name}|${b.meta}`).join('\n');

    const confirmed = (candidates || []).filter(c => c.status === 'confirmed');
    const dismissed = (candidates || []).filter(c => c.status === 'dismissed');
    let shortlistContext = '';
    if (confirmed.length || dismissed.length) {
      shortlistContext = '\n\nCURRENT SHORTLIST STATE:';
      if (confirmed.length) shortlistContext += '\nConfirmed: ' + confirmed.map(c => c.id).join(', ');
      if (dismissed.length) shortlistContext += '\nDismissed: ' + dismissed.map(c => c.id).join(', ');
    }

    const contextBlock = contextLines.join('\n');
    const apiMessages = [];
    if (!history || history.length === 0) {
      const catalogBlock = bills.length
        ? `BILL CATALOG (${bills.length} of ${all.length} bills — keyword-filtered to this event; if a bill class you'd expect is missing, say so and the editor can widen the search; format: id|name|meta):\n${catalog}`
        : `BILL CATALOG: NO MATCHES — none of the ${all.length} bills in the corpus matched this event's terms. Say so plainly, name the bill class that ought to exist here, and offer search terms to widen the query or nominate into the corpus. Cite no bill IDs this turn.`;
      apiMessages.push({
        role: 'user',
        content: `[Event context]\n${contextBlock}\n\n${catalogBlock}${shortlistContext}\n\n---\n\n${text}`
      });
    } else {
      apiMessages.push(...history);
      apiMessages.push({
        role: 'user',
        content: `[Context refresh]\n${contextBlock}${shortlistContext}\n---\n\n${text}`
      });
    }
    return apiMessages;
  }

  // ── Parse a model reply for bill suggestions + structured analysis
  // fields (moved verbatim from sendBillCurateMessage; legacy LF/RF/
  // LD/RD quadrant codes still mapped on parse).
  function parseCandidates(reply, existingCandidates) {
    const bills = allBills();
    const billRegex = /\[([a-z]+-\d{2,3}-\d+)\]/gi;
    const existingIds = new Set((existingCandidates || []).map(c => c.id));
    let match;
    const newCandidates = [];
    const replyLines = reply.split('\n');

    while ((match = billRegex.exec(reply)) !== null) {
      const billId = match[1].toLowerCase();
      if (existingIds.has(billId)) continue;
      existingIds.add(billId);

      const billData = bills.find(b => b.id === billId);
      if (!billData) continue;

      const afterMatch = reply.substring(match.index + match[0].length);
      const lineEnd = afterMatch.indexOf('\n');
      const restOfLine = lineEnd >= 0 ? afterMatch.substring(0, lineEnd) : afterMatch;
      let reason = restOfLine.replace(/^\s*\**\s*/, '').replace(/^[^—–\-]*[—–\-]\s*/, '').trim();
      if (!reason || reason.length < 5) reason = 'Suggested by AI';

      const matchLineIdx = replyLines.findIndex(l => l.includes(match[0]));
      let displacement = null, objectZ = null, diatribe = null, quadrants = null, framingKeywords = null;
      if (matchLineIdx >= 0) {
        for (let i = matchLineIdx + 1; i < Math.min(matchLineIdx + 9, replyLines.length); i++) {
          if (/^\[([a-z]+-\d{2,3}-\d+)\]/.test(replyLines[i].trim())) break;
          if (/^displacement:\s*(.+)/i.test(replyLines[i].trim())) {
            displacement = replyLines[i].trim().match(/^displacement:\s*(.+)/i)[1].trim().toLowerCase();
          } else if (/^object-z:\s*(.+)/i.test(replyLines[i].trim())) {
            const zStr = replyLines[i].trim().match(/^object-z:\s*(.+)/i)[1].trim();
            objectZ = parseFloat(zStr);
            if (isNaN(objectZ)) objectZ = null;
          } else if (/^diatribe:\s*(.+)/i.test(replyLines[i].trim())) {
            diatribe = replyLines[i].trim().match(/^diatribe:\s*(.+)/i)[1].trim().toLowerCase();
          } else if (/^quadrants:\s*(.+)/i.test(replyLines[i].trim())) {
            const qStr = replyLines[i].trim().match(/^quadrants:\s*(.+)/i)[1].trim();
            const LEGACY_QUAD_MAP = { LF: 'A', RF: 'B', LD: 'C', RD: 'D' };
            quadrants = qStr.split(/[,\s]+/)
              .map(q => q.trim().toUpperCase())
              .map(q => LEGACY_QUAD_MAP[q] || q)
              .filter(q => ['A','B','C','D'].includes(q));
            quadrants = [...new Set(quadrants)];
            if (!quadrants.length) quadrants = null;
          } else if (/^keywords:\s*(.+)/i.test(replyLines[i].trim())) {
            const kwStr = replyLines[i].trim().match(/^keywords:\s*(.+)/i)[1].trim();
            framingKeywords = kwStr.split(',').map(k => k.trim()).filter(Boolean);
            if (!framingKeywords.length) framingKeywords = null;
          }
        }
      }

      newCandidates.push({
        id: billId,
        name: billData.name,
        meta: billData.meta || '',
        reason: reason,
        status: 'candidate',
        displacement: displacement,
        objectZ: objectZ,
        diatribe: diatribe,
        quadrants: quadrants,
        framingKeywords: framingKeywords
      });
    }
    return newCandidates;
  }

  // ── One editor turn end-to-end: build messages → PrismAI.call →
  // parse candidates. Pure: caller owns history/candidates updates.
  // API shape (2026-07-02 hardening): 16k budget, adaptive thinking,
  // medium effort; empty replies throw inside PrismAI.call.
  async function send({ apiKey, evt, text, history, candidates, model }) {
    const apiMessages = buildMessages({ evt, text, history, candidates });
    const reply = await PrismAI.call(apiKey, {
      model: model,
      maxTokens: 16000,
      effort: 'medium',
      system: SYSTEM_PROMPT,
      messages: apiMessages,
      allowTruncated: true   // curate historically surfaced partial replies
                             // rather than discarding them (empty still throws)
    });
    return { reply, newCandidates: parseCandidates(reply, candidates) };
  }

  // ── THE WRITE PATH — Link confirmed bills to the event.
  // Extends the 2026-07-03 desk write (linkedBills + evt.billAnalysis)
  // with the §3 #6 / §5.3 store promotion: every confirmed reading
  // ALSO lands in prism_bill_scores, so a reading earned in one event
  // is visible in all and survives without the event write.
  // Lineage on every score; never write without an event context.
  function applyCuration(eventId, candidates) {
    if (!eventId) return { error: 'no_event' };
    const confirmed = (candidates || []).filter(c => c.status === 'confirmed');
    if (!confirmed.length) return { error: 'none_confirmed' };
    const evt = PrismDB.getEvent(eventId);
    if (!evt) return { error: 'event_missing' };

    // Merge with any existing linked bills (don't remove manually linked ones)
    const linked = new Set(evt.linkedBills || []);
    let newCount = 0;
    confirmed.forEach(c => {
      if (!linked.has(c.id)) { linked.add(c.id); newCount++; }
    });

    // Per-event analysis blob (back-compat: inspector + curate pre-populate
    // read this today; retire once all consumers read the store)
    const analysis = evt.billAnalysis ? { ...evt.billAnalysis } : {};
    let scored = 0;
    confirmed.forEach(c => {
      if (c.displacement || c.objectZ !== null || c.diatribe || c.quadrants || c.framingKeywords) {
        const record = {
          displacement: c.displacement || null,
          objectZ: c.objectZ ?? null,
          diatribe: c.diatribe || null,
          quadrants: c.quadrants || null,
          framingKeywords: c.framingKeywords || null,
          reason: c.reason || null,
          rubricId: (typeof PRISM_DIATRIBE_RUBRIC_ID !== 'undefined') ? PRISM_DIATRIBE_RUBRIC_ID : null,
          method: 'curate',
          provenance: 'AI_CURATED',
          confirmedAt: Date.now()
        };
        analysis[c.id] = record;
        // ── Store promotion: the canonical copy ──
        PrismDB.saveBillScore(Object.assign({ billId: c.id, eventId: eventId, billName: c.name || null }, record));
        scored++;
      }
    });

    PrismDB.updateEvent(eventId, {
      linkedBills: Array.from(linked),
      billAnalysis: analysis
    });

    return { newCount, totalLinked: linked.size, scored };
  }

  return { SYSTEM_PROMPT, filterBillCatalog, buildMessages, parseCandidates, send, applyCuration };
})();
