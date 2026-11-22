"""Command line: check grids, print a deduction trace, check the published grids, generate a lot.

- Grids are chosen by `--id` (the grid's id) or `--index` (position in the file, from 0, = `lab.index`).
- Exit codes: check 0 if every grid is valid, else 1 (with --strict, also 1 when a grid is not unique,
  not deducible or differs from its reference); check-published 0 when every grid passes, else 1;
  generate 0 when the lot is full, 1 when it is partial (files written in both cases), 2 when the lot
  file is refused (nothing drawn, nothing written). A missing or unreadable file exits with 2.
- check and check-published accept coal ramps by default (the game plays them); --no-ramp refuses them.

Examples (from solver/):
  .venv/bin/dispatch-solver check ../web/src/data/grids.json --id 7
  .venv/bin/dispatch-solver check ../lab/candidates/v3-jouer-a.json --index 0 --strict
  .venv/bin/dispatch-solver deduce ../web/src/data/grids.json --id 11 --max-level 2
  .venv/bin/dispatch-solver check-published
  .venv/bin/dispatch-solver generate ../lab/lots/demo-01.json --out /tmp/lot-try --workers 6
  .venv/bin/dispatch-solver bulletin ../lab/candidates/v3-jouer-a.json --index 2
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

from .api import check_grid, check_published, deduce_grid
from .generate.bulletin import make_bulletin
from .generate.lot import check_lot, run_lot
from .grid import load_grids, validate

ROOT = Path(__file__).resolve().parents[3]
PUBLISHED = ROOT / "web" / "src" / "data" / "grids.json"
LAB = ROOT / "lab"


def _load(path: str) -> list[dict]:
    try:
        return load_grids(path)
    except OSError as exc:
        _fail(f"cannot read {path}: {exc.strerror}")
    except json.JSONDecodeError as exc:
        _fail(f"{path} is not valid JSON: {exc}")


def _fail(message: str) -> None:
    """Unreadable input: message on stderr, exit code 2 (as documented above)."""
    print(message, file=sys.stderr)
    sys.exit(2)


def _select(path: str, gid: int | None, index: int | None = None) -> list[dict]:
    grids = _load(path)
    if index is not None:
        if not 0 <= index < len(grids):
            sys.exit(f"no grid at index {index} in {path} ({len(grids)} grids)")
        grids = [grids[index]]
    if gid is not None:
        grids = [g for g in grids if g.get("id") == gid]
        if not grids:
            sys.exit(f"no grid with id {gid} in {path}")
    return grids


def _pick(p: argparse.ArgumentParser) -> None:
    p.add_argument("--id", type=int, help="grid id")
    p.add_argument("--index", type=int, help="position in the file, from 0 (lab.index)")


def _ramp(p: argparse.ArgumentParser) -> None:
    p.add_argument("--no-ramp", dest="ramp", action="store_false", help="refuse ramp-shaped pieces")
    p.add_argument("--ramp", dest="ramp", action="store_true", help=argparse.SUPPRESS)  # the default


def _publishable(r: dict) -> bool:
    return bool(
        r["valid"]
        and r.get("compositions") == 1
        and r.get("matches_reference")
        and r.get("deduction") == "solved"
        and r.get("deduction_matches_reference")
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="dispatch-solver", description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("check", help="validity, compositions, deduction and rating of each grid (JSON lines)")
    p.add_argument("file")
    _pick(p)
    _ramp(p)
    p.add_argument("--cap", type=int, default=2, help="stop counting compositions at this number")
    p.add_argument("--strict", action="store_true", help="exit 1 unless every grid is publishable")
    p = sub.add_parser("deduce", help="deduction trace of one grid (JSON)")
    p.add_argument("file")
    _pick(p)
    p.add_argument("--max-level", type=int, default=4)
    p = sub.add_parser("check-published", help="every published grid is unique, deducible and matches its reference")
    p.add_argument("file", nargs="?", default=str(PUBLISHED))
    _ramp(p)
    p = sub.add_parser("generate", help="fill a lot of candidate grids (lab/candidates/<lot>.json and .stats.json)")
    p.add_argument("lot", help="lot file (JSON): lot, size, seed, mix, quotas")
    p.add_argument("--out", default=str(LAB / "candidates"))
    p.add_argument("--workers", type=int, default=6)
    p = sub.add_parser("bulletin", help="draft bulletin of one grid (title, text, sky)")
    p.add_argument("file")
    _pick(p)
    p.add_argument("--seed", type=int, default=1)
    a = ap.parse_args(argv)

    if a.cmd == "check":
        ok = True
        for g in _select(a.file, a.id, a.index):
            r = check_grid(g, allow_ramp=a.ramp, cap=a.cap)
            ok = ok and (_publishable(r) if a.strict else r["valid"])
            print(json.dumps(r, ensure_ascii=False))
        return 0 if ok else 1
    if a.cmd == "deduce":
        grids = _select(a.file, a.id, a.index)
        if len(grids) != 1:
            sys.exit("deduce needs one grid: pass --id or --index")
        errors = validate(grids[0], allow_ramp=True)
        if errors:
            sys.exit("invalid grid: " + "; ".join(errors))
        print(json.dumps(deduce_grid(grids[0], a.max_level), ensure_ascii=False, indent=1))
        return 0
    if a.cmd == "generate":
        return _generate(a)
    if a.cmd == "bulletin":
        grids = _select(a.file, a.id, a.index)
        if len(grids) != 1:
            sys.exit("bulletin needs one grid: pass --id or --index")
        g = grids[0]
        family = g.get("lab", {}).get("family") or "pointe_soir"
        print(json.dumps(make_bulletin(g, family, random.Random(a.seed)), ensure_ascii=False, indent=1))
        return 0
    ok, lines = check_published(_load(a.file), allow_ramp=a.ramp)
    print("\n".join(lines))
    return 0 if ok else 1


def _generate(a: argparse.Namespace) -> int:
    try:
        lot = json.loads(Path(a.lot).read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"invalid lot: {exc}", file=sys.stderr)
        return 2
    lot, errors = check_lot(lot)
    if errors:
        print("invalid lot:\n" + "\n".join(f"- {e}" for e in errors), file=sys.stderr)
        return 2
    out = Path(a.out)
    if (out / "archive" / f"{lot['lot']}.json").exists():
        print(f"invalid lot: {lot['lot']} is archived in {out / 'archive'}: a lot name is never reused", file=sys.stderr)
        return 2
    out.mkdir(parents=True, exist_ok=True)
    grids, extra = run_lot(lot, workers=a.workers, log=lambda m: print(m, file=sys.stderr, flush=True))
    name = lot["lot"]
    (out / f"{name}.json").write_text(json.dumps(grids, ensure_ascii=False, indent=1) + "\n")
    (out / f"{name}.stats.json").write_text(json.dumps(extra["stats"], ensure_ascii=False, indent=1) + "\n")
    if extra["blocked"]:
        (out / f"{name}.blocked.json").write_text(json.dumps(extra["blocked"], ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(extra["stats"], ensure_ascii=False, indent=1))
    return 0 if len(grids) == lot["size"] else 1


if __name__ == "__main__":
    sys.exit(main())
