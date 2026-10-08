# HARDGATE — architecture map (#4, #5, #6 decisions)

Measured 2026-10-10 on `bionic/14-task-hardening`, after the 14-task pass.
Numbers are ground truth from this tree, not estimates.

## The shape

| Layer | What | Size |
|---|---|---|
| App shell | `index.html` (inline core, 6 blocks) + 224 root-level classic scripts | 11,096 lines |
| Offline shell | `sw.js` `HG_SHELL` precache (per-file, never `addAll`) | ~250 entries |
| Node side | `api/` (CommonJS handlers) · `lib/` (ESM) · `scripts/` (walks, watches, `server.mjs`) | — |
| Tests | `tests/` — the offline gate, `npm test`, runs 723 files, ~23.5 min | 733 files |
| Archive | `attic/` — 15 scripts referenced by nothing (experiments + superseded prototypes) | — |

Root .js by domain: gold desks ×32, setup intelligence ×16, pine ports ×15,
hardgate shell/integration ×9(+10 `hg-*`), formation ×9, crypto desks ×8(+7 omni),
fix packs ×5, book/trade/execute ×9, api bridges ×4.

## #4 — why index.html keeps its core inline (and what extraction really costs)

`index.html` carries **6 inline blocks**:

| Block | Size | Role |
|---|---|---|
| 1 | 4,951 chars | early shell glue |
| 2 | 1,000 chars | small boot block |
| 3 | 173,834 chars | app core (scan/aggregation) |
| 4 | 336,013 chars | app core (alert cycle, boot, ticketing) |
| 5 | 62,518 chars | core (rendering) |
| 6 | 4,252 chars | late boot glue |

That is deliberate, not debt:

1. **Offline-by-design.** `sw.js` documents the shell as "the fully
   assembled source" — `index.html` IS the self-contained core; an offline
   client that cannot fetch parts still gets the whole engine from one file.
2. **The tests guard the inline source itself.** 252 of 724 test files read
   `index.html`; the suite pins literal structure inside those blocks —
   e.g. `if (HG_ALERTS_FORCED_ON){ armAlertCycle(); }`
   (`tests/test-v656-stop-autorefresh.mjs`), the `HG_ALERT_CYCLE_MS =
   HG_TAB_ALERT_MS` alias (`test-check-production`, `test-scan-every-10m`),
   the `sendAlertPush` record-then-topic contract (`test-core-fixes`).
   `tests/extract-inline.mjs` syntax-checks every block on every `npm test`.
   The inline core is a *guarded artifact*, like the baked evidence JSONs.

**Real extraction recipe, if ever wanted** (one block per deploy, never bulk):
pick a block → find every test whose regex reads it
(`grep -l "<distinctive literal>" tests/`) → move the block verbatim to
`core/NNN.js`, add `<script src="core/NNN.js?v=…">` in the same document
position, add the file to `HG_SHELL` → repoint each pinning test to the new
file → `npm test` must stay 723/723. Blocks 1, 2, 6 (10 KB total) are the
low-coupling candidates; blocks 3+4 (510 KB) are pinned hardest — start
small, measure the pin count before each move.

## #5 — the monolith tabs and the extraction pattern the repo already trusts

| File | Lines | Size | Loaded by |
|---|---|---|---|
| `omnigold.js` | 17,181 | 872 KB | index.html + evidence walks |
| `goldind.js` | 17,988 | 826 KB | index.html + evidence walks |
| `omniroute.js` | 11,922 | 611 KB | index.html |
| `brain.js` | 6,415 | 318 KB | index.html |

Bulk-splitting these cold is the one move that can silently break every
desk at once — each is boot-loaded in vm by dozens of tests AND
source-regexed for baked literals. The repo already owns the safe pattern:

- **`pinegoldmath.js`** — twelve bar-only Pine ports extracted OUT of the
  gold desks into a sibling loaded before them; "no desk edit, they mint
  record-only through each desk own mint and gates" (build-stamp v1167 pack).
- **`trendtable.js`** — an 872 KB-class matrix split into a loader + 12
  runtime fragments (`trendtable-src-*.js`, now precached).
- **`lib/omnigold-xm-bot-backtest.mjs`** — walk semantics shared by the
  backtests *and* dynamically imported by `omnigold.js:15922`
  (`import('...?v=' + ver)` — self-syncing, no stale cachebuster).

**The recipe (one extraction per deploy):** take one self-contained
pure-function bank at the monolith's top → `git mv` the functions verbatim
into a sibling file (e.g. `omnigold-math.js`) loaded one tag earlier →
add the tag + `HG_SHELL` entry + a line in the test helper that boots the
monolith (`tests/helpers/omnigold-exports.mjs`) → full `npm test` green
before commit. The parity guard (`tests/test-offline-shell-parity.mjs`)
and the syntax gates make a botched split loud, not silent.

## #6 — root layout after the tidy

224 live root scripts by design (a static classic-script app has no
bundler to hide paths); the 15 dead ones now live in `attic/` with a
per-file README. New rule of thumb, enforced socially + by the parity
guard: a root file must be either loaded by `index.html`, runtime-fetched,
or it belongs in `attic/`.

## #2 — the cache-bump sync (a quintet, not a triad)

A deploy number NNN must appear in ALL of:
`sw.js` `HG_CACHE`, `build-stamp.js` `version`, every `index.html`
`<script src="?v=NNN">` (225), and the runtime asset literals
(`hg-api-base.js` ×2 — the Shiva injections, `trendtable.js` ×1 — the
fragment fetch). `npm run check:cache` scans all of them; its first run
caught a live bug: the Shiva desk was still injected with `?v=1124`
(43 deploys stale) and was absent from the offline shell.
Dynamically-built cachebusters (`omnigold.js`'s `'?v=' + ver`) self-sync
and are noted as out of static reach in the check.
