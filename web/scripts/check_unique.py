"""Check every published grid with the Python solver of ../solver (dispatch_solver).

- Each grid of src/data/grids.json must be valid (§14, coal ramps allowed), have exactly one
  composition (§8.1), that composition must be the reference solution's, and the deduction solver
  must reach it (§8.2).
- Prints one line per grid with its rating; a rating different from the stored one is reported, not fatal.

Usage (from web/): ../solver/.venv/bin/python scripts/check_unique.py [src/data/grids.json]
"""

import sys
from pathlib import Path

from dispatch_solver.api import check_published
from dispatch_solver.grid import load_grids

HERE = Path(__file__).resolve().parent


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "src" / "data" / "grids.json"
    # The web game knows coal ramps: validate with allow_ramp, as the game's validateGrid() does.
    ok, lines = check_published(load_grids(src), allow_ramp=True)
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
