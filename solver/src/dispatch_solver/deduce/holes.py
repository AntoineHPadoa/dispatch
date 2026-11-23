"""Filling and hole measures of a grid (lab block only, no filter; docs/next/v3-criteres-m23.md §2-3).

- cells: cells to lay (every cell of the reference placements, imports included).
- full_n_rows: rows whose every slot holds nuclear in the reference; nuclear_share: nuclear cells / cells.
- cells_per_decision: cells / weight of the decisions (DECISION_WEIGHTS, as in the compactness K).
- holes: a hole is a run of 1 or 2 cells of a row, closed on each side by a weather brick or the grid edge
  (at least one brick), inside every possible silhouette. Its types are the plants that may still fill it
  (View.dom, imports grouped as "I"):
  - at the start, and at the level-1 fixpoint (what the player sees once the obvious steps are done);
  - unique: one type at the level-1 fixpoint;
  - contested: two types or more at the level-1 fixpoint, settled by a step that is not trivial (level >= 2,
    or a step fixing an exchange or laying an import bar).
  find_holes() lists the holes of a board; hole_measures() runs the deduction once and returns
  {n, unique, contested, types}, `types` holding the level-1 types of each contested hole (e.g. "GI").

Example: filling_measures(grid, decisions(grid, deduce(grid).steps)); hole_measures(grid)["contested"]
"""

from __future__ import annotations

from typing import Any

from ..board import Puzzle
from ..grid import IMPORT_PIECE
from .rules import Solver
from .state import Cell, State, View, initial_sil
from .trace import DECISION_WEIGHTS, Step

TYPE_ORDER = "NBCGTI"


def placement_cells(pz: Puzzle, p: dict[str, Any]) -> frozenset[Cell]:
    """Cells of a §14 reference placement on the board pz."""
    key = f"I:{p.get('country', '')}" if p["piece"] == IMPORT_PIECE else p["piece"]
    i = pz.find(key, p["row"], p["col"], p["len"], p.get("height", 1))
    if i is None:
        raise ValueError(f"reference placement {p} is not a placement of the board")
    return pz.placements[i].cells


def filling_measures(g: dict[str, Any], dec: dict[str, int], pz: Puzzle | None = None) -> dict[str, Any]:
    """{cells, full_n_rows, nuclear_share, cells_per_decision} of the reference (None without decision)."""
    pz = pz or Puzzle(g)
    owner: dict[Cell, str] = {}
    for p in g["solution"]["placements"]:
        for x in placement_cells(pz, p):
            owner[x] = p["piece"]
    rows = {r for r, _c in owner}
    full = sum(1 for r in rows if all(owner.get((r, c)) == "N" for c in range(pz.n)))
    weight = sum(DECISION_WEIGHTS[k] * v for k, v in dec.items())
    return {
        "cells": len(owner),
        "full_n_rows": full,
        "nuclear_share": round(sum(1 for k in owner.values() if k == "N") / len(owner), 2) if owner else 0.0,
        "cells_per_decision": round(len(owner) / weight, 1) if weight else None,
    }


def find_holes(pz: Puzzle) -> list[list[Cell]]:
    """Holes of the board: runs of 1 or 2 sure cells of a row between weather bricks or the edge (one brick at
    least), from left to right and bottom to top."""
    v = View(pz, State(set(range(len(pz.placements))), set(), initial_sil(pz)))
    n = pz.n

    def brick(r: int, c: int) -> bool:
        return 0 <= c < n and r < pz.w[c]

    def closed(r: int, c: int) -> bool:
        return c < 0 or c >= n or r < pz.w[c]

    out: list[list[Cell]] = []
    for r in range(max(v.top_min, default=0)):
        c = 0
        while c < n:
            if not v.sure((r, c)):
                c += 1
                continue
            end = c
            while end < n and v.sure((r, end)):
                end += 1
            run = [(r, x) for x in range(c, end)]
            if len(run) <= 2 and closed(r, c - 1) and closed(r, end) and (brick(r, c - 1) or brick(r, end)):
                out.append(run)
            c = end
    return out


def _types(v: View, hole: list[Cell]) -> str:
    keys = {"I" if k.startswith("I:") else k for x in hole for k in v.dom[x]}
    return "".join(sorted(keys, key=TYPE_ORDER.index))


def _nontrivial(s: Step) -> bool:
    return s.level >= 2 or bool(s.exchanges) or any(p["piece"] == IMPORT_PIECE for p in s.placed)


def hole_measures(g: dict[str, Any], pz: Puzzle | None = None) -> dict[str, Any]:
    """{n, unique, contested, types} of grid g with its clues (see the module docstring)."""
    pz = pz or Puzzle(g)
    holes = find_holes(pz)
    if not holes:
        return {"n": 0, "unique": 0, "contested": 0, "types": []}
    solver = Solver(pz)
    seen: list[tuple[int, list[str]]] = []  # (steps recorded before the turn, types of each hole)
    solver.observe = lambda v: seen.append((len(solver.steps), [_types(v, h) for h in holes]))
    res = solver.run()
    if not res.solved or not seen:
        return {"n": len(holes), "unique": 0, "contested": 0, "types": []}
    steps = res.steps
    first_hard = next((i for i, s in enumerate(steps) if s.level >= 2), len(steps))
    # The loop always tries level 1 first: the last turn before the first level-2 step is the level-1 fixpoint.
    fix = [t for k, t in seen if k <= first_hard][-1]
    unique = contested = 0
    types: list[str] = []
    for h, hole in enumerate(holes):
        if len(fix[h]) <= 1:
            unique += 1
            continue
        # Turn after which the hole has one type left (else the end of the run): the steps of that turn settle it.
        settled = next((j for j, (_k, t) in enumerate(seen) if j and len(t[h]) <= 1), None)
        lo = seen[settled - 1][0] if settled is not None else seen[-1][0]
        hi = seen[settled][0] if settled is not None else len(steps)
        turn = steps[lo:hi]
        cols = {c for _r, c in hole}
        near = [s for s in turn if set(s.cells) & set(hole) or set(s.columns) & cols or s.exchanges] or turn
        if any(_nontrivial(s) for s in near):
            contested += 1
            types.append(fix[h])
    return {"n": len(holes), "unique": unique, "contested": contested, "types": types}


CELL_BANDS = ((0, 28, "<=28"), (29, 39, "29-39"), (40, 10**6, ">=40"))


def _spread(values: list[float]) -> dict[str, float]:
    """Median, min and max (empty: {})."""
    if not values:
        return {}
    v = sorted(values)
    mid = len(v) // 2
    median = v[mid] if len(v) % 2 else (v[mid - 1] + v[mid]) / 2
    return {"median": round(median, 2), "min": v[0], "max": v[-1]}


def lot_measures(grids: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregates of the filling and hole measures of a lot (`.stats.json`); grids lacking them are skipped."""
    gs = [g for g in grids if "cells" in g.get("lab", {})]

    def band(g: dict[str, Any]) -> str:
        return next(name for lo, hi, name in CELL_BANDS if lo <= g["lab"]["cells"] <= hi)

    contested = [g for g in gs if g["lab"]["holes"]["contested"]]
    types: dict[str, int] = {}
    for g in gs:
        for t in g["lab"]["holes"]["types"]:
            types[t] = types.get(t, 0) + 1
    return {
        "cells": _spread([g["lab"]["cells"] for g in gs]),
        "cells_bands": {name: sum(1 for g in gs if band(g) == name) for _lo, _hi, name in CELL_BANDS},
        "hard_cells_bands": {
            name: sum(1 for g in gs if band(g) == name and g["difficulty"]["rating"] >= 3)
            for _lo, _hi, name in CELL_BANDS
        },
        "full_n_rows": dict(
            sorted(
                {
                    str(k): sum(1 for g in gs if g["lab"]["full_n_rows"] == k)
                    for k in {g["lab"]["full_n_rows"] for g in gs}
                }.items()
            )
        ),
        "nuclear_share": _spread([g["lab"]["nuclear_share"] for g in gs if "nuclear_share" in g["lab"]]),
        "nuclear_under_half": sum(1 for g in gs if g["lab"].get("nuclear_share", 1) < 0.5),
        "cells_per_decision": _spread([g["lab"]["cells_per_decision"] for g in gs if g["lab"]["cells_per_decision"]]),
        "holes": {
            "grids_with_holes": sum(1 for g in gs if g["lab"]["holes"]["n"]),
            "holes": sum(g["lab"]["holes"]["n"] for g in gs),
            "unique": sum(g["lab"]["holes"]["unique"] for g in gs),
            "contested": sum(g["lab"]["holes"]["contested"] for g in gs),
            "grids_with_contested": len(contested),
            "medium_up_with_contested": sum(1 for g in contested if g["difficulty"]["rating"] >= 2),
            "medium_up": sum(1 for g in gs if g["difficulty"]["rating"] >= 2),
            "contested_types": dict(sorted(types.items())),
        },
    }
