/**
 * LOCAL DEV ONLY — derive-panel key prefill.
 *
 * SETUP:
 *   cp v2/derive.key.local.example.js v2/derive.key.local.js
 *   then paste your DESK KEY into derive.key.local.js
 *
 * derive.key.local.js is gitignored (*.key.local.js) and is loaded only when you
 * open the #derive dev panel, purely to prefill the key field so you don't retype
 * it each session.
 *
 * 2026-08-05 — this is the DESK KEY now, not an Anthropic key. The derive panel
 * relays through prism-gate (/ai); the sk-ant credential lives in Cloudflare
 * secrets and never reaches a browser. A leaked desk key can only relay an AI
 * call and file .json/images under data/ — it can never touch a served page.
 * That is a real downgrade in blast radius, but it is not nothing:
 *
 * ⚠️  Still NEVER commit or deploy derive.key.local.js. A desk key in the web
 *     root is a working credential for anyone who loads the page. For the beta,
 *     member scoring is PRECOMPUTED in admin and shipped as static data, so no
 *     key of any kind reaches a tester's browser.
 */
window.__PRISM_DERIVE_KEY__ = 'paste-your-desk-key-here';
