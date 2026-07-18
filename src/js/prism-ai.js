// ============================================================
// PRISM AI LAYER — shared model config, canonical rubric, and the
// hardened Anthropic call. Single source of truth for admin.html,
// admin-surface.html, and v2/index.html.
//
// Extracted 2026-07-05 (Portal Ontology spec §7 step 1 — see
// Specs/Prism_Admin_Surface_Portal_Ontology_v1.md). Prior to this the
// rubric lived byte-identical in admin.html + v2/index.html and every
// admin.html call site hand-rolled its own fetch.
//
// Hardening lineage (live-test findings 2026-07-02): current models emit
// a thinking block before text — content[0].text reads the wrong block;
// tight max_tokens starves replies to empty; unbounded thinking consumed
// entire budgets with zero text out. Hence: adaptive thinking + bounded
// effort + a real token floor + text-block-only extraction + truncation
// guard.
// ============================================================
const PrismAI = (() => {

  // ── Model config — one constant so the next retirement is a one-line fix.
  // claude-sonnet-4-20250514 retired upstream (discovered live 2026-07-02:
  // every call site 404'd).
  const MODEL_DEFAULT = 'claude-sonnet-5';
  const RETIRED_MODELS = ['claude-sonnet-4-20250514', 'claude-sonnet-4-6'];

  function migrateModel(m) {
    const s = (m || '').trim();
    if (!s || RETIRED_MODELS.includes(s)) return MODEL_DEFAULT;
    return s;
  }

  // ── Canonical Diatribe rubric — THE single copy. Consumers interpolate
  // it into their system prompts; RUBRIC_ID travels on every interpretive
  // write so drift is detectable in logged scores.
  const RUBRIC_ID = 'PRISM_DIATRIBE_RUBRIC_v1_1';
  const RUBRIC = `DIATRIBE — CANONICAL RUBRIC (${RUBRIC_ID}):

Diatribe (0–100) measures denomination: how far the political object has been displaced by tribal/identity content. Read it by watching the object, not the tone or volume:

0–33 FLUID: the object is present and engaged. Capacity for surprise intact — the position could update on new evidence. Substantive even when forceful.
34–66 COALITION (oscillation zone): the object is narrowing — substance still recoverable but increasingly tribally colored. In transit; recovery and denomination both possible.
67–100 DENOMINATED: the object is gone, replaced by identity/vehicle content. Cannot be surprised. The thing being discussed has become a thing being belonged to.

Denomination is sincere engagement with the wrong question — an orientation error, not bad faith and not low intelligence. A brilliant analyst can score 80; a mediocre one can score 15. Denomination exists in every quadrant: institutional positions denominate, populist positions hold fluid, and vice versa. Never derive Diatribe from quadrant position.

PRIOR-FLOOR: if you are relying primarily on party or demographic prior rather than the subject's own record (confidence ≤ 0.4), report Diatribe in the 40–50 neutral range. Band-crossing denomination may never be inferred from group identity — only from the subject's own documented pattern.

Calibration: most working politicians on live issues fall 25–60. Reserve 67+ for documented, sustained denomination patterns on the specific issue. SYMMETRY CONSTRAINT: structurally equivalent positions must score within 5 points regardless of party or side.`;

  // ── Voice-authoring context — travels as the system prompt on suggest
  // calls (2026-07-18: bare "write a charged political line" prompts hit
  // stop_reason:refusal with no text; the model needs to know what Prism
  // is before it will draft a voice). Single-sourced here for every
  // suggest site, like the rubric.
  const VOICE_CONTEXT = `You are the drafting assistant inside Prism, a civic-education tool that maps public political discourse. Prism displays labeled, illustrative composite "voices" — short lines representing how real positions in a public debate sound from different places on an issue map (its axes and denomination bands are provided per request). These are analytical illustrations for studying discourse structure, equivalent to writing both sides of a debate brief: they are not messaging, persuasion, or astroturf content, and they appear only inside the map, attributed to coordinates, never to people. Draft the requested voice sincerely and charitably — the strongest honest version of how that position sounds — and follow the JSON/format instructions in the request exactly.`;

  // ── The hardened call.
  // opts: {
  //   model,          — optional; migrated through the retired list
  //   maxTokens,      — floored at 1600 (thinking-starvation guard)
  //   effort,         — 'low' (default) | 'medium' | 'high'
  //   system,         — optional system prompt
  //   messages | prompt — full history array, or a single user string
  //   allowTruncated  — default false: stop_reason max_tokens throws
  // }
  // Returns joined text blocks (skips thinking blocks). Throws with the
  // API's error message, a truncation notice, or an empty-reply notice.
  async function call(key, opts = {}) {
    // One quiet retry for the transient outcomes (refusal / truncation /
    // empty) before an error reaches a toast — refusals and thinking
    // starvation are stochastic; the second attempt usually lands.
    try { return await callOnce(key, opts); }
    catch (e) {
      if (/declined|truncated|Empty reply/.test(e.message)) return callOnce(key, opts);
      throw e;
    }
  }

  async function callOnce(key, opts = {}) {
    const messages = opts.messages || [{ role: 'user', content: opts.prompt || '' }];
    const body = {
      model: migrateModel(opts.model),
      max_tokens: Math.max(opts.maxTokens || 200, 1600),
      thinking: { type: 'adaptive' },
      output_config: { effort: opts.effort || 'low' },
      messages
    };
    if (opts.system) body.system = opts.system;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error((e && e.error && e.error.message) || ('HTTP ' + res.status));
    }
    const data = await res.json();
    if (data.stop_reason === 'max_tokens' && !opts.allowTruncated) {
      throw new Error('truncated (max_tokens) — retry');
    }
    const text = (data.content || []).map(b => b.type === 'text' ? b.text : '').join('').trim();
    if (!text) {
      // Name the real cause — 'refusal' is its own stop_reason (2026-07-18:
      // the old message blamed max_tokens for every empty reply).
      if (data.stop_reason === 'refusal') {
        throw new Error('model declined this request (stop_reason: refusal) — retry, or rephrase the framing');
      }
      throw new Error(`Empty reply (stop_reason: ${data.stop_reason}) — likely thinking consumed max_tokens; retry`);
    }
    return text;
  }

  // ── Parse helpers — carve JSON out of fences/prose the model wrapped it in.
  function extractJson(raw) {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('No JSON object in reply: ' + raw.slice(0, 240));
    try { return JSON.parse(raw.slice(s, e + 1)); }
    catch (err) { throw new Error('JSON Parse error — Claude responded: ' + raw.slice(0, 240)); }
  }
  function extractJsonArray(raw) {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { return JSON.parse(m[0]); } catch (e) { return []; }
  }

  return { MODEL_DEFAULT, RETIRED_MODELS, migrateModel, RUBRIC_ID, RUBRIC, VOICE_CONTEXT, call, extractJson, extractJsonArray };
})();

// ── Back-compat globals (consumers strangle off these as they migrate;
// the declarations were REMOVED from admin.html and v2/index.html — this
// file is now the only place they're declared).
const PRISM_DIATRIBE_RUBRIC_ID = PrismAI.RUBRIC_ID;
const PRISM_DIATRIBE_RUBRIC = PrismAI.RUBRIC;
