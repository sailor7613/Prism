#!/bin/bash
# Double-click ONCE to let the newsroom auto-publish Claude drafts.
# Saves a GitHub token into scripts/secrets.local.js (gitignored — never
# committed, never leaves this Mac). Use a fine-grained token for
# sailor7613/Prism with Contents: Read and write (the burn-gate token works).
cd "$(dirname "$0")" || exit 1
echo "─────────────────────────────────────────────"
echo "  Prism · auto-publish token"
echo "─────────────────────────────────────────────"
echo
read -r -s -p "Paste the GitHub token (it won't show), then press Enter: " TOK; echo
TOK=$(printf '%s' "$TOK" | tr -d '[:space:]')
[ -z "$TOK" ] && { echo "✗ Nothing pasted."; read -r -p "Press Enter to close."; exit 1; }
PRISM_TOK="$TOK" node -e '
const fs=require("fs"), p="scripts/secrets.local.js"; let cur={};
try { cur=require(require("path").resolve(p)); } catch(e) {}
cur.GITHUB_PUBLISH_TOKEN=process.env.PRISM_TOK;
fs.writeFileSync(p, "// Local secrets — gitignored. Never commit.\nmodule.exports = " + JSON.stringify(cur, null, 2) + ";\n", { mode: 0o600 });
' || { echo "✗ Couldn't save."; read -r -p "Press Enter to close."; exit 1; }
unset TOK
echo "Checking it can reach the repo…"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $(node -e 'console.log(require("./scripts/secrets.local.js").GITHUB_PUBLISH_TOKEN)')" https://api.github.com/repos/sailor7613/Prism/contents/data/newsroom/autopublish.json)
if [ "$CODE" = "200" ] || [ "$CODE" = "404" ]; then echo "✓ Saved and working. Clean Claude drafts will now publish themselves."
else echo "⚠ Saved, but GitHub answered $CODE — check the token has Contents: Read and write on sailor7613/Prism."; fi
echo
read -r -p "Press Enter to close."
