/**
 * Local secrets template — build-time only.
 *
 * SETUP:
 *   cp scripts/secrets.local.example.js scripts/secrets.local.js
 *   then paste your key(s) into secrets.local.js
 *
 * secrets.local.js is gitignored and is read by scripts/config.js as a fallback
 * when CONGRESS_API_KEY isn't set in the environment. It is NEVER committed and
 * NEVER shipped to the browser or beta testers — these keys are only used by the
 * Node data-pipeline scripts that pre-generate static data.
 *
 * Get a free Congress.gov key at: https://api.congress.gov/sign-up/
 */
module.exports = {
  CONGRESS_API_KEY: 'paste-your-congress-gov-key-here',
};
