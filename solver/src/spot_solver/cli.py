"""Command line entry point `spot-solver`.

- solve <grid.json>: optimum, solution, composition count, difficulty (first grid of the file, or --id).
- check <grids.json>: one summary line per grid, compared with the stored optimum.
- solve / check also read pose grids ("mode": "pose").
- deduce <grid.json>: human deduction of a pose grid (rules applied, rating), --max-level to cap the rules.
- generate --mode pose --level exact|bars|cells|none --cols 8 ...: publishable pose grids with the smallest
  mix of lore clues solvable by deduction (--rating to target a rating, --clue-types price for legacy).
- generate --cols 8 --count 5 --seed 1 ...: publishable v2 grids as JSON on stdout.

Example: uv run spot-solver check ../docs/archive/demo/grids.json
"""

from __future__ import annotations

import argparse
import json
import sys

from . import deduce
from .generate import GenParams, generate
from .grid import load_grids
from .solve import solve_any


def _pick(grids: list[dict], gid: int | None) -> dict:
    if gid is None:
        return grids[0]
    for g in grids:
        if g.get("id") == gid:
            return g
    raise SystemExit(f"no grid with id {gid}")


def cmd_solve(a: argparse.Namespace) -> int:
    grid = _pick(load_grids(a.path), a.id)
    res = solve_any(grid, mode=a.mode, count_cap=a.cap)
    print(json.dumps(res, ensure_ascii=False, indent=2 if a.pretty else None))
    return 0 if res.get("status") in ("optimal", "target_reached", "solved") else 1


def cmd_check(a: argparse.Namespace) -> int:
    ok = True
    for g in load_grids(a.path):
        res = solve_any(g, mode=a.mode, count_cap=a.cap, decoys=False)
        stored = g.get("optimum") or {}
        if res.get("status") not in ("optimal", "target_reached", "solved"):
            print(f"#{g.get('id')}: {res.get('status')}")
            ok = False
            continue
        if res.get("mode") == "pose":
            got = f"pose co2 {res['co2']}"
            match = True
        elif "facture" in res:
            got = f"cost {res['cost']} facture {res['facture']} co2 {res['co2']}"
            match = (stored.get("cost"), stored.get("facture")) in ((None, None), (res["cost"], res["facture"]))
        else:
            got = f"score {res['score']} cost {res['cost']} co2 {res['co2']}"
            match = stored.get("score") in (None, res["score"])
        verdict = "publishable" if res["publishable"] else "NOT unique"
        flag = "" if match else f"  MISMATCH stored {stored}"
        ok &= match and res["publishable"]
        print(f"#{g.get('id')} {g.get('title', '')}: {got}, compositions {res['compositions']}, "
              f"{verdict}, {res['time']}s{flag}")
    return 0 if ok else 1


def cmd_deduce(a: argparse.Namespace) -> int:
    grid = _pick(load_grids(a.path), a.id)
    res = deduce.deduce(grid, max_level=a.max_level)
    if a.json:
        print(json.dumps(res.to_dict(), ensure_ascii=False, indent=2))
    else:
        for i, step in enumerate(res.steps, 1):
            rule = deduce.RULES[step.rule]
            print(f"{i:3}. [{rule.level}] {rule.name} : {'; '.join(step.effects)}")
        verdict = (f"résolue, note {res.rating} ({res.label})" if res.solved
                   else f"{res.status} : non résoluble sans essai-erreur ({res.unresolved} cases indécises)")
        print(verdict)
    return 0 if res.solved else 1


def _parse_neighbors(spec: str | None) -> dict[str, int] | None:
    if not spec:
        return None
    out = {}
    for item in spec.split(","):
        nid, _, co2 = item.partition(":")
        out[nid.strip()] = int(co2 or 0)
    return out


def cmd_generate(a: argparse.Namespace) -> int:
    p = GenParams(
        cols=a.cols, hmin=a.hmin, hmax=a.hmax, pieces=a.pieces.split(","), b_cap=a.b_cap, n_cap=a.n_cap,
        neighbor=a.neighbor, neighbor_cap=a.neighbor_cap, neighbors=_parse_neighbors(a.neighbors),
        export_budget=a.export_budget, step=a.step, surplus=a.surplus,
        curtail_penalty=a.curtail_penalty, objective=a.objective, price_cap=a.price_cap,
        co2_cap=a.co2_cap, no_import=a.no_import, smooth=a.smooth, count=a.count, seed=a.seed,
        min_difficulty=a.min_difficulty, max_attempts=a.max_attempts,
        mode=a.mode, level=a.level, max_clues=a.max_clues, rating=a.rating,
        clue_types=None if a.clue_types == "legacy" else a.clue_types.split(","),
    )
    grids, stats = generate(p)
    print(json.dumps(grids, ensure_ascii=False, indent=2))
    print(f"generated {stats['kept']}/{p.count} grids in {stats['attempts']} attempts "
          f"({stats['infeasible']} infeasible, {stats['not_unique']} not unique, {stats['too_easy']} too easy, "
          f"{stats['too_many_clues']} too many clues, {stats['trivial']} trivial, {stats.get('unsolvable', 0)} unsolvable; "
          f"{stats['clues']} clues, {stats['elapsed']:.1f}s)", file=sys.stderr)
    if stats.get("ratings"):
        print(f"ratings {dict(sorted(stats['ratings'].items()))}, clue types {stats['clue_types']}", file=sys.stderr)
    return 0 if stats["kept"] == p.count else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="spot-solver", description="Dispatch solver and generator")
    sub = ap.add_subparsers(dest="cmd", required=True)

    for name in ("solve", "check"):
        sp = sub.add_parser(name)
        sp.add_argument("path")
        sp.add_argument("--mode", choices=["auto", "v1", "v2", "pose"], default="auto",
                        help="v1 = legacy cost-then-facture scale; pose = puzzle de pose (both auto-detected)")
        sp.add_argument("--cap", type=int, default=10, help="stop counting compositions at this number")
        if name == "solve":
            sp.add_argument("--id", type=int, help="grid id when the file holds several grids")
            sp.add_argument("--pretty", action="store_true")

    dd = sub.add_parser("deduce")
    dd.add_argument("path")
    dd.add_argument("--id", type=int, help="grid id when the file holds several grids")
    dd.add_argument("--max-level", type=int, default=4, help="hardest rule level allowed (1-4)")
    dd.add_argument("--json", action="store_true")

    g = sub.add_parser("generate")
    g.add_argument("--mode", choices=["v2", "pose"], default="v2")
    g.add_argument("--level", choices=["exact", "bars", "cells", "none"], default="exact",
                   help="pose inventory level")
    g.add_argument("--max-clues", type=int,
                   help="pose: reject grids needing more clues (default: the slots; half of them in legacy)")
    g.add_argument("--clue-types", default="price,column,flow,bar,given",
                   help="pose: clue types to publish, or 'legacy' (price clues, uniqueness only)")
    g.add_argument("--rating", type=int, choices=[1, 2, 3, 4], help="pose: keep only grids of this rating")
    g.add_argument("--cols", type=int, default=8)
    g.add_argument("--hmin", type=int, default=1)
    g.add_argument("--hmax", type=int, default=6)
    g.add_argument("--pieces", default="N,G,T", help="comma-separated among N,B,C,G,T")
    g.add_argument("--b-cap", type=int, default=2)
    g.add_argument("--n-cap", type=int)
    g.add_argument("--neighbor", action="store_true", help="add a neighbor (import and export)")
    g.add_argument("--neighbors", help="several neighbors as id:co2 pairs, e.g. DE:2,UK:1,FR:0")
    g.add_argument("--export-budget", type=int, default=2, help="blocks exportable per neighbor over the day")
    g.add_argument("--neighbor-cap", type=int, default=1)
    g.add_argument("--step", type=int, default=0, help="number of STEP pairs")
    g.add_argument("--surplus", action="store_true", help="one column with negative residual, curtailment allowed")
    g.add_argument("--curtail-penalty", type=int, default=2)
    g.add_argument("--objective", choices=["min_score", "target"], default="min_score")
    g.add_argument("--price-cap", type=int)
    g.add_argument("--co2-cap", type=int)
    g.add_argument("--no-import", action="store_true")
    g.add_argument("--smooth", type=int)
    g.add_argument("--count", type=int, default=5)
    g.add_argument("--seed", type=int, default=1)
    g.add_argument("--min-difficulty", type=float, default=0.0, help="drop grids below this difficulty")
    g.add_argument("--max-attempts", type=int, default=500)

    a = ap.parse_args(argv)
    return {"solve": cmd_solve, "check": cmd_check, "deduce": cmd_deduce, "generate": cmd_generate}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
