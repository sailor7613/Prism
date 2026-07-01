/**
 * LOCAL DEV ONLY — derive-panel key prefill.
 *
 * SETUP:
 *   cp v2/derive.key.local.example.js v2/derive.key.local.js
 *   then paste your Anthropic key into derive.key.local.js
 *
 * derive.key.local.js is gitignored (*.key.local.js) and is loaded only when you
 * open the #derive dev panel, purely to prefill the key field so you don't retype
 * it each session.
 *
 * ⚠️  NEVER commit or deploy derive.key.local.js. It holds a billing-attached key
 *     in the web root — safe on localhost, a leak anywhere else. For the beta,
 *     member scoring is PRECOMPUTED in admin and shipped as static data, so no
 *     Anthropic key ever reaches a tester's browser.
 */
window.__PRISM_DERIVE_KEY__ = 'sk-ant-paste-your-key-here';
