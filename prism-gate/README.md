# The Prism Gate — deploy runbook

**2026-08-04** · The editorial desk's locked drawer. Holds the GitHub token
AND the Anthropic key so that no browser — including yours — ever has to.

Everything here runs **in your own Terminal**, not through a Claude session.
That is deliberate: the tokens and the desk key go from your password manager
into Cloudflare's secret store and are never typed into a chat, never written
to a file on your disk, and never pass through this project's git history.

This is villa-gate's medicine applied to Prism. If you have deployed the
villa-gate, every step here will feel familiar; the differences are noted
where they matter.

---

## 0. What you are building, and why

Until today, `admin-surface.html` kept two live credentials in localStorage
on `sailor7613.github.io` — a fine-grained GitHub PAT with Contents R/W on
this repo, and your `sk-ant-…` Anthropic key. Two problems, one of them
sharper than it looks:

1. **The origin is shared.** Every `sailor7613.github.io` project — the
   villa, Prism, every archived admin surface still sitting in `archive/` —
   serves from the SAME origin, so they all read the same localStorage. An
   XSS hole in any one of them reads the secrets of all of them.
2. **The PAT could rewrite the pages themselves.** Contents R/W on the whole
   repo means a stolen token doesn't just vandalize JSON — it can replace
   `admin-surface.html` with a keylogger and wait for you.

```
your browser                prism-gate (Cloudflare Worker)         GitHub / Anthropic
  desk key ─── POST /file ───►  is this the desk key?
                                is the path under data/?
                                ──── contents API, server-held token ────► GitHub
  desk key ─── POST /ai ─────►  is this the desk key?
                                ──── messages API, server-held key ─────► Anthropic
```

**Reads do not go through it.** Pulls still come straight off the public
repo with no credential, exactly as before. The gate is a *write* door and
an *AI relay* only.

The path restriction is the real upgrade: even a leaked desk key can only
file JSON and images under `data/` — it can never touch `index.html`,
`admin-surface.html`, or anything else the origin serves. The credential
that could rewrite the newsroom no longer exists in any browser.

---

## 1. Cloudflare

Same account as villa-gate; nothing new to sign up for. The free tier's
100,000 requests a day absorbs both Workers without noticing each other.

---

## 2. Mint the token the gate will hold

github.com → **Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**

| Field | Value |
|---|---|
| Repository access | **Only select repositories** → `sailor7613/Prism` |
| Permissions | **Contents: Read and write**. Nothing else |
| Expiration | 90 days |

**This is a NEW token.** Do not reuse the villa-gate's token (its runbook
already rules: no other repository), and do not reuse the old localStorage
PAT — that one gets revoked in step 7, not recycled.

---

## 3. Set the project up

From inside the `prism-gate` folder:

```
npm install
npx wrangler login      # only if this machine hasn't already
```

---

## 4. Put the secrets in

Three commands. Each one prompts, you paste, it never touches disk:

```
npx wrangler secret put GITHUB_TOKEN     # the fine-grained token from step 2
npx wrangler secret put ANTHROPIC_KEY    # your sk-ant-… key
npx wrangler secret put DESK_KEY         # the one key you'll type into the surface
```

Pick the desk key out of Prism's own vocabulary — three words and a number,
memorable, not reused from anywhere, and NOT the villa's house code:
`the-galley-proof-88`, `sixty-forty-oscillation-12`. It is a door code for a
one-person newsroom.

> **Do not put secrets in `wrangler.toml`.** That file gets committed. The
> secret store does not.

---

## 5. Deploy, and tell the client where the drawer is

```
npx wrangler deploy
```

It prints a URL like `https://prism-gate.<your-subdomain>.workers.dev`.
Paste it into `src/js/prism-sync.js`, near the top, marked `── THE GATE ──`:

```js
window.PRISM_GATE = window.PRISM_GATE || 'https://prism-gate.your-subdomain.workers.dev';
```

That one constant serves both files — `prism-ai.js` reads it too.

---

## 6. Check it

`npm test` first — **82 assertions**, none of which need an account or a
network: the Worker runs against a fake GitHub and a fake Anthropic, and the
REAL `prism-sync.js`/`prism-ai.js` run against a fake browser, proving the
legacy credentials are scrubbed on load, no request from either file ever
carries a credential header, and refused paths never reach GitHub.

Then live: open the admin surface, put the desk key in under **Keys** in the
top bar. It verifies at the door — *"✓ the desk knows you"* — rather than at
your first publish (the villa's door_test lesson: a typo should answer
immediately, not surface days later as a mysterious refusal mid-deadline).
Publish a Reading, run one Desk round, and watch:

```
npx wrangler tail
```

---

## 7. Bury the old keys — the step that actually closes the hole

Scrubbing localStorage happens automatically on every device the moment the
new client loads (scrub, never migrate). But **scrubbing a browser does not
un-mint a token**, and this PAT sat on a public shared origin for weeks:

1. github.com → Settings → Developer settings → Fine-grained tokens →
   **revoke the old Prism PAT**.
2. console.anthropic.com → API keys → **rotate the sk-ant key** you'd been
   pasting into the surface, and put the NEW one into the gate (step 4 —
   `wrangler secret put ANTHROPIC_KEY` again). The old one dies with it.
3. While you are standing in GitHub's token settings anyway: the **classic
   deploy token** (`public_repo`, expiring 2026-08-29) has now been carried
   by three handoffs. Rotate it to a fine-grained per-repo token and the
   fourth handoff never has to mention it.

---

## 8. The ceilings

Same two-limiter shape as villa-gate, plus one for the wire:

| | limit | what it stops |
|---|---|---|
| **before** the key check | 12 wrong keys per address per hour | someone trying the drawer all night |
| **after** it | 2,000 file ops per day | a runaway sync loop |
| **after** it | 500 AI relays per day | a stuck retry burning your Anthropic bill |

Set up through the dashboard exactly as for villa-gate: **Workers KV →
Create Instance** named `prism-rate`, bind it to prism-gate as **`RATE`**,
redeploy. And as always: **KV is a speed bump, never the boundary** — every
KV call is wrapped, so a KV outage cannot break the lock. There is a test
for exactly this.

---

## What the gate guarantees, and what it does not

**Does:**

- No GitHub or Anthropic credential ever reaches any browser
- A wrong desk key learns nothing except that it was wrong — `/verify`
  returns the identical refusal, so it is not a cheaper oracle
- Writes land only under `data/`, only as `.json` or image files — the
  served pages are out of reach even with the key
- The conflict flow survives: 409/422 pass through, so "repo changed
  mid-push — pull, then push again" and bake's already-baked case behave
  exactly as before
- Anthropic responses pass through verbatim, so PrismAI's hardening
  (retry, truncation guard, text-block extraction) is untouched

**Does not:**

- Know it's you. Whoever holds the desk key is the editor. One person, one
  key, rotated in ten seconds (`wrangler secret put DESK_KEY`) — that is
  the correct amount of security for a one-person desk, and losing the key
  costs an attacker access to a JSON drawer, not a newsroom.

---

## Flagged, adjacent

`admin.html`, `admin-pad.html` and `v2/index.html` still carry the OLD
direct-call pattern. They stop working for AI/writes the moment the sk-ant
key is rotated (their copy is dead) — which is the correct failure. If any
of them is still a live surface, it needs this same client surgery;
otherwise they belong in `archive/`, and `archive/` itself should some day
move out of the served branch entirely.

---

*— Prism Gate runbook — 2026-08-04 — Sailor / Claude — Western Diametrica —*
