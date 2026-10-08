# HARDGATE — docs index

| Path | What it is |
|---|---|
| `README.md` (root) | Product + operations manual for the terminal |
| `AGENTS.md` (root) | Canonical agent conventions. Kept at root intentionally: 10+ tests regex its contents, and every agent tooling reads it from the root |
| `docs/ENV-VARS.md` | Every environment variable + GitHub repo variable (single source of truth) |
| `docs/ARCHITECTURE.md` | Measured app map: inline-core design (#4), monolith extraction recipes (#5), root layout (#6), cache-bump quintet (#2) |
| `docs/PROVENANCE.md` | Module credit ledger — guarded by `tests/test-provenance.mjs` |
| `docs/phases/` | Historical phase reports: P0–P5 summaries, fix packs 7–11, LEAN docs, setup-intelligence guides, deployment guides. **Frozen history** — nothing here is load-bearing for the app; moved here from the repo root for tidiness |

Why `AGENTS.md` was not split: the suite pins literals inside it
(`grep -l "AGENTS.md" tests/*.mjs` → 10+ files), so it stays the single
canonical file. The phase-history clutter that motivated the split now lives
in `docs/phases/` instead.
