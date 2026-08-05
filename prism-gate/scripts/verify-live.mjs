#!/usr/bin/env node
/**
 * prism-gate — the live write-test.
 *
 * WHY THIS EXISTS (Desk Gate handoff, 2026-08-04, §6):
 *
 *   "A revoked write credential is invisible from the read path. The villa
 *    looked completely healthy while its door was dead."
 *
 * Revoking `unified admin db` by name also killed `Villa Gate`, and nothing
 * looked broken for twenty minutes — because reads are keyless and only a
 * WRITE touches the token. A page load proves nothing. This proves the three
 * things a page load cannot:
 *
 *   1. the desk key still opens the door          (/verify)
 *   2. GITHUB_TOKEN can still actually file       (/file put -> read back -> del)
 *   3. ANTHROPIC_KEY still relays                 (/ai)
 *
 * Run it after EVERY revocation, rotation, or redeploy.
 *
 *   node scripts/verify-live.mjs          # prompts for the key, echoes dots
 *   DESK_KEY=… node scripts/verify-live.mjs
 *
 * The key is read from the environment or a masked prompt, never from argv —
 * argv lands in shell history and in `ps`. Nothing here prints the key, and
 * every response body is scanned for credential material before it is shown
 * (THE ONE RULE: no credential in a response, a log, or an error).
 */

const GATE   = process.env.PRISM_GATE || 'https://prism-gate.shanecorwin.workers.dev';
const REPO   = process.env.PRISM_REPO || 'sailor7613/Prism';
const BRANCH = process.env.PRISM_BRANCH || 'main';
const PROBE  = 'data/_gate_probe.json';

/**
 * The gate only answers callers it recognises — ALLOWED_ORIGINS in
 * prism-gate/src/index.js — and refuses everything else with
 * 403 "not from the newsroom" BEFORE it ever looks at the desk key.
 * Node sends no Origin header at all, so without this every check 403s and the
 * key is never actually tested.
 *
 * `http://localhost:5500` is already on that list, put there deliberately —
 * the source comment reads "localhost is here so the desk can be tested from
 * Live Server before it is pushed." This is that affordance, used from a
 * terminal instead of a browser. It is NOT a way around the lock: origin is a
 * CORS-style guard, and the desk key is still the thing being checked one line
 * later. If you ever drop the localhost entries from the Worker, set
 * PRISM_ORIGIN to an origin that survives.
 */
const ORIGIN = process.env.PRISM_ORIGIN || 'http://localhost:5500';

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', x: '\x1b[0m' };
let failed = 0;
const pass = (m, d) => console.log(`  ${C.g}✓${C.x} ${m}${d ? C.d + '  ' + d + C.x : ''}`);
const fail = (m, d) => { failed++; console.log(`  ${C.r}✗ ${m}${C.x}${d ? '\n      ' + d : ''}`); };
const step = (m) => console.log(`\n${C.y}${m}${C.x}`);

/** THE ONE RULE, enforced on our side too: never surface credential material. */
function safe(text) {
  return String(text)
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-<<REDACTED>>')
    .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, 'gh?_<<REDACTED>>')
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, 'github_pat_<<REDACTED>>')
    .slice(0, 400);
}

/**
 * Read the desk key without echoing it.
 *
 * NOTE (2026-08-05): the first version of this did `rl.output.write = () => {}`
 * to suppress the echo. `rl.output` IS `process.stdout` — that assignment
 * silenced every console.log in the process, so the script ran to completion
 * and printed absolutely nothing. It looked like an instant silent exit.
 * The supported way to mask input is `_writeToOutput`, which touches only the
 * readline interface. Never reassign a stream's own write method.
 */
async function readKey() {
  if (process.env.DESK_KEY) return process.env.DESK_KEY.trim();

  if (!process.stdin.isTTY) {
    console.error(
      `${C.r}No TTY, so the key cannot be prompted for.${C.x}\n` +
      `Run it directly (not through a pipe):  node scripts/verify-live.mjs\n` +
      `or pass the key in the environment:    DESK_KEY=… node scripts/verify-live.mjs`
    );
    process.exit(2);
  }

  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = function (s) {
    if (muted) { if (/\S/.test(s)) rl.output.write('•'); }   // one dot per keystroke
    else rl.output.write(s);
  };

  const key = await new Promise((resolve) => {
    rl.question('desk key (not echoed): ', (answer) => resolve(answer));
    muted = true;
    rl.on('close', () => resolve(''));       // Ctrl-D / EOF resolves instead of hanging
  });
  muted = false;
  rl.close();
  process.stdout.write('\n');
  return String(key).trim();
}

async function post(route, payload) {
  const res = await fetch(GATE + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify(payload),
  });
  let json = null, text = '';
  try { text = await res.text(); json = JSON.parse(text); } catch (_) {}
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  console.log(`\n${C.d}gate  ${GATE}\nrepo  ${REPO}@${BRANCH}${C.x}`);

  const key = await readKey();
  if (!key) { console.error(`${C.r}No desk key given — nothing to test.${C.x}`); process.exit(2); }

  // ── 0. the doorstep — are we even allowed to knock? ──────────────────
  {
    // Use the REAL key here, not an empty one. An empty code fails admit() and
    // burns one of the 12-per-hour guess attempts — and this probe runs on
    // EVERY invocation. With the §1 wrong-key assertion that made two guesses
    // per run, so six runs in an hour would lock the operator out of their own
    // gate while debugging. A correct key still gets 403 if the origin is
    // wrong, which is all this probe needs to distinguish.
    const probe = await post('/verify', { code: key });
    if (probe.status === 403) {
      console.error(
        `\n${C.r}The gate refused this caller before looking at any key.${C.x}\n` +
        `  ${safe(probe.text)}\n\n` +
        `Origin sent: ${ORIGIN}\n` +
        `That origin is not in ALLOWED_ORIGINS in prism-gate/src/index.js.\n` +
        `Set one that is:  PRISM_ORIGIN=https://sailor7613.github.io npm run verify:live\n`
      );
      process.exit(2);
    }
  }

  // ── 1. the door ──────────────────────────────────────────────────────
  step('1 · the door — is the desk key still good?');
  {
    const r = await post('/verify', { code: key });
    if (r.ok) pass('/verify accepts the key', `HTTP ${r.status}`);
    else {
      fail(`/verify refused — HTTP ${r.status}`, safe(r.text));
      if (r.status === 401) {
        console.log(`      ${C.y}Everything below will fail too. Check the desk key first.${C.x}`);
      }
    }

    const bad = await post('/verify', { code: key + 'x' });
    if (bad.status === 401) pass('a wrong key still gets 401', 'the shared refusal line holds');
    else fail(`a wrong key returned ${bad.status}, expected 401`, safe(bad.text));
  }

  // ── 2. the write — the whole point ───────────────────────────────────
  step('2 · the write — can GITHUB_TOKEN still actually file?');
  let sha = null;
  {
    const stamp = new Date().toISOString();
    const body = JSON.stringify({ probe: 'prism-gate verify-live', at: stamp }, null, 2);
    const put = await post('/file', {
      code: key, op: 'put', path: PROBE,
      content: Buffer.from(body, 'utf8').toString('base64'),
      message: 'gate probe: verify the write path is live',
    });
    if (put.ok) {
      sha = put.json?.content?.sha || put.json?.sha || null;
      pass('PUT accepted — the token can write', `HTTP ${put.status}`);
    } else {
      fail(`PUT refused — HTTP ${put.status}`, safe(put.text));
      if (put.status === 401) {
        // The gate checks the desk key BEFORE it ever touches GitHub, so a 401
        // here says nothing about GITHUB_TOKEN — it says the desk key is wrong.
        console.log('      The DESK KEY is wrong or was changed. GITHUB_TOKEN is not implicated:');
        console.log('      the gate checks the key before it ever reaches GitHub.');
      } else {
        console.log(`      ${C.r}THIS IS THE §6 FAILURE.${C.x} Reads would still look perfectly healthy.`);
        console.log('      Most likely: GITHUB_TOKEN was revoked or expired. Re-mint, then');
        console.log('      npx wrangler secret put GITHUB_TOKEN');
      }
    }

    // read it back KEYLESS — proves it truly landed, not just that the gate said so
    if (put.ok) {
      const url = `https://api.github.com/repos/${REPO}/contents/${PROBE}?ref=${BRANCH}`;
      const r = await fetch(url, { headers: { accept: 'application/vnd.github+json' } });
      if (r.ok) {
        const j = await r.json();
        sha = j.sha || sha;
        const landed = Buffer.from(j.content || '', 'base64').toString('utf8');
        if (landed.includes(stamp)) pass('read back keyless — the bytes really landed', PROBE);
        else fail('read back, but the timestamp does not match', 'a stale cache, or the write went elsewhere');
      } else {
        fail(`could not read the probe back — HTTP ${r.status}`, 'the gate reported success; GitHub disagrees');
      }
    }
  }

  // ── 3. clean up after ourselves ──────────────────────────────────────
  step('3 · unfile the probe');
  if (sha) {
    const del = await post('/file', { code: key, op: 'del', path: PROBE, sha, message: 'gate probe: done' });
    if (del.ok) pass('probe removed', 'the delete path works too');
    else fail(`could not remove the probe — HTTP ${del.status}`, safe(del.text) + `\n      Remove ${PROBE} by hand.`);
  } else {
    console.log(`  ${C.d}– skipped (nothing was filed)${C.x}`);
  }

  // ── 4. the relay — the one that catches a botched rotation ───────────
  step('4 · the relay — does ANTHROPIC_KEY still work?');
  {
    const r = await post('/ai', {
      code: key,
      body: { model: 'claude-sonnet-4-5', max_tokens: 16, messages: [{ role: 'user', content: 'Reply with the single word: open' }] },
    });
    if (r.ok) {
      const said = (r.json?.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
      pass('/ai relayed', said ? `the model said "${safe(said)}"` : `stop_reason: ${r.json?.stop_reason}`);
    } else if (r.status === 401) {
      fail('/ai — 401 from Anthropic', 'the rotated key never reached Cloudflare, or it was mistyped.\n      npx wrangler secret put ANTHROPIC_KEY');
    } else {
      fail(`/ai refused — HTTP ${r.status}`, safe(r.text));
    }
  }

  // ── 5. THE ONE RULE ──────────────────────────────────────────────────
  step('5 · THE ONE RULE — did anything leak?');
  {
    const bodies = [
      await post('/file', { code: key, op: 'put', path: 'data/../index.html', content: 'eA==' }),
      await post('/ai', { code: key, body: { messages: [] } }),
    ];
    const all = bodies.map((r) => r.text).join('\n');
    const leak = /sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(all);
    if (leak) fail('a response body contained credential material', 'THE ONE RULE is broken — stop and fix the gate.');
    else pass('no credential in any refusal body', 'checked the traversal and empty-messages refusals');

    if (bodies[0].status >= 400) pass('the traversal path was refused', 'data/../index.html never reached GitHub');
    else fail('data/../index.html was NOT refused', 'the path allowlist is not holding — stop and fix the gate.');
  }

  console.log(
    failed
      ? `\n${C.r}${failed} check${failed > 1 ? 's' : ''} failed.${C.x} The gate is not carrying what you think it is.\n`
      : `\n${C.g}All green.${C.x} Door, write, read-back, relay and THE ONE RULE all hold.\n`
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  const networkish = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(
    String(e) + String((e && e.cause) || '')
  );
  console.error(`\n${C.r}The test could not finish.${C.x}`);
  if (networkish) {
    // A stack trace through undici's internals tells nobody anything useful.
    console.error(`The gate at ${GATE} could not be reached.`);
    console.error('Check that you are online and that the URL above is right — it is the');
    console.error('value at the `── THE GATE ──` marker in src/js/prism-sync.js.');
  } else {
    console.error(safe(e && e.stack ? e.stack : String(e)));
  }
  process.exit(1);
});
