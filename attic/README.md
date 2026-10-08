# attic/ — unreferenced experiments & superseded utilities (task #6)

These 15 root-level scripts are referenced by NOTHING in the live app:
no `<script src>` in index.html, no service-worker shell entry, no test,
no import in lib/ api/ scripts/, no workflow, no prose in README/AGENTS.
They moved here verbatim (git mv preserves history) so the repo root
reads as the live terminal it is.

Nothing imports from attic/ — it is inert by construction.

| File | What it was |
|---|---|
| `backtest-goldultra-v720.js` | One-off GOLD ULTRA v720 backtest harness (superseded by `scripts/backtest-goldscalp.mjs` / `-goldswing.mjs`) |
| `backtest-goldultra-v720-improved.js` | Variant of the same harness |
| `backtest-goldultra-v720-report.js` | Report builder for the above |
| `create-test-setups.js` | Demo-setup seeder for the Setup Intelligence dashboard (manual utility: `node attic/create-test-setups.js`) |
| `gold-combined.js` | Early combined gold tab prototype (v1105-era; the live tabs are goldind.js / omnigold.js) |
| `hardgate-conviction-system.js` | Phase-3 conviction-system prototype |
| `hardgate-conviction-optimizer.js` | Phase-4 conviction optimizer prototype |
| `hardgate-conviction-bootstrap.js` | Bootstrap for the conviction prototypes |
| `hardgate-gold-ultra-signal-hook.js` | Early GOLD ULTRA signal hook (superseded by the live goldultra-pro.js path) |
| `hardgate-historical-analysis-dashboard.js` | Setup Intelligence historical dashboard prototype |
| `hardgate-lean-bridge.js` | Lean-engine bridge prototype |
| `hardgate-lean-universal-adapter.js` | Lean universal adapter prototype |
| `hardgate-lean-validation-engine.js` | Lean backtest validation engine (docs in docs/phases/LEAN_*) |
| `hardgate-setup-intelligence-monitor.js` | Setup Intelligence live monitor prototype |
| `test-lean-backtest.js` | Lean backtest test harness (`node attic/test-lean-backtest.js`) |

Why not delete: they document design dead-ends worth remembering, and the
owner may still run the two manual utilities. Re-live any of them by
`git mv attic/<file> .` + adding a `<script src>` (and an HG_SHELL entry —
the parity test will remind you).
