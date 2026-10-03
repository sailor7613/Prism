# GitHub workflows — install by hand

Cowork's remote file tools can't write under `.github/` (protected path), so the
workflow files live here and get copied into place once:

    cp scripts/github-workflows/*.yml .github/workflows/

Then commit. Both need **Settings → Actions → General → Workflow permissions →
"Read and write permissions"** on the Prism repo.

- `scan-objects.yml` — the newsroom's daily GDELT scan → `data/newsroom/` (05:30 PT).
- `bake-seed.yml` — rebakes `data/readings_seed.js` when the live tier changes.
- `active-layer.yml` — PG01 §6, the active layer: EIA flows + prices, GDELT detection → `data/active/` (07:00 PT). Needs the `EIA_API_KEY` repo secret (free key).
