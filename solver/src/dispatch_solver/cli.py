"""Command line: check grids, print a deduction trace, check the published grids.

Examples (from solver/):
  .venv/bin/dispatch-solver check ../web/src/data/grids.json --id 7
  .venv/bin/dispatch-solver deduce ../web/src/data/grids.json --id 11 --max-level 2
  .venv/bin/dispatch-solver check-published
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .api import check_grid, check_published, deduce_grid
from .grid import load_grids

PUBLISHED = Path(__file__).resolve().parents[3] / "web" / "src" / "data" / "grids.json"


def _select(path: str, gid: int | None) -> list[dict]:
    grids = load_grids(path)
    if gid is not None:
        grids = [g for g in grids if g.get("id") == gid]
        if not grids:
            sys.exit(f"no grid with id {gid} in {path}")
    return grids


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="dispatch-solver", description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("check", help="validity, compositions, deduction and rating of each grid (JSON lines)")
    p.add_argument("file")
    p.add_argument("--id", type=int)
    p.add_argument("--ramp", action="store_true", help="accept ramp-shaped pieces")
    p.add_argument("--cap", type=int, default=2, help="stop counting compositions at this number")
    p = sub.add_parser("deduce", help="deduction trace of one grid (JSON)")
    p.add_argument("file")
    p.add_argument("--id", type=int)
    p.add_argument("--max-level", type=int, default=4)
    p = sub.add_parser("check-published", help="every published grid is unique, deducible and matches its reference")
    p.add_argument("file", nargs="?", default=str(PUBLISHED))
    a = ap.parse_args(argv)

    if a.cmd == "check":
        for g in _select(a.file, a.id):
            print(json.dumps(check_grid(g, allow_ramp=a.ramp, cap=a.cap), ensure_ascii=False))
        return 0
    if a.cmd == "deduce":
        grids = _select(a.file, a.id)
        if len(grids) != 1:
            sys.exit("deduce needs one grid: pass --id")
        print(json.dumps(deduce_grid(grids[0], a.max_level), ensure_ascii=False, indent=1))
        return 0
    ok, lines = check_published(load_grids(a.file))
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
