# Lean algorithms — canonical copies

`HardgateStrategyAdapter.cs` is HARDGATE code, but Lean will only compile it
from inside its own tree, at `vendors/Lean/Algorithms/`. That directory belongs
to the **QuantConnect/Lean submodule**, whose remote we do not control — so a
file living only there is untracked by this repo and unversioned by theirs.

It sat in exactly that state until hg-v741: one copy, on one machine, that any
`git submodule update --force` or fresh clone would have deleted without
warning. The documentation (`LEAN_COMPLETE_IMPLEMENTATION.md`) pointed at the
submodule path, so nothing looked wrong.

**This directory is the source of truth.** To build:

```bash
cp lean-algorithms/HardgateStrategyAdapter.cs vendors/Lean/Algorithms/
```

Edit the copy here and re-copy. If you edit the one under `vendors/Lean/`,
copy it back before committing, or the change is lost the next time the
submodule is reset.
