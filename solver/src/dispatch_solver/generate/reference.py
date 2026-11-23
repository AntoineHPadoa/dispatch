"""Reference solution of a drawn grid: the merit order (cheapest plants first), with random tie-breaks.

- solve_reference(): CP-SAT minimises the sum of the merit-order ranks of the laid cells (imports cost
  `import_cost`), plus a tiny random weight per placement so that equal-cost layouts vary with the seed.
  A required shape (ramp, tall piece) may be asked several times, and ramp cells may get a bonus (wider
  ramps, two ramps relaying each other).
  Exchange totals of the draft (exports per neighbor, STEP pairs) are imposed.
  `hole_types`: each hole (deduce.holes.find_holes: 1 or 2 cells between weather bricks) gets a type drawn
  among those that fit it (gas, peaker, import when a neighbor allows it…), instead of the cheapest one; the
  clue selection then has to settle it (contested holes, v3-criteres-m23.md §3). Infeasible: drawn without.
  `max_nuclear`: at most that share of the laid cells is nuclear (a looser skeleton than the merit order,
  docs/next/v3-challenge.md §6). Infeasible: solved without the cap.
- fill_inventory(): writes `inventory` (exact: bar widths, cells of one-cell plants; none: `{}`) from the
  reference, keeping `max_cells`.

Example: sol = solve_reference(draft, rng, exports={"DE": 1}); grid["solution"] = sol
"""

from __future__ import annotations

import random
from typing import Any

from ortools.sat.python import cp_model

from .. import exact
from ..board import Puzzle
from ..deduce.holes import find_holes
from ..exact import Model


def solve_reference(
    draft: dict[str, Any],
    rng: random.Random,
    exports: dict[str, int] | None = None,
    import_cost: int = 6,
    time_limit: float = 10.0,
    require: tuple[str, ...] = (),
    min_count: int = 1,
    ramp_bonus: int = 0,
    hole_types: bool = False,
    max_nuclear: float | None = None,
) -> dict[str, Any] | None:
    """§14 solution of the draft at minimal merit-order cost, or None if infeasible.

    `require`: shape kinds the solution must use at least `min_count` times (e.g. "ramp_trap", "tall").
    `ramp_bonus`: cost removed per ramp cell, so that wider ramps (and relays) win over the shortest one.
    """
    pz = Puzzle(draft)
    holes = draw_hole_types(pz, rng) if hole_types else []
    caps = [max_nuclear] if max_nuclear is not None and max_nuclear < 1 else []
    tries: list[tuple[Any, list[float]]] = []
    for t in [(holes, caps), (holes, []), ([], caps), ([], [])]:  # drop the hole types, then the cap, then both
        if t not in tries:
            tries.append(t)
    for hs, cap in tries:
        out = _solve(pz, rng, exports, import_cost, time_limit, require, min_count, ramp_bonus, hs, cap)
        if out is not None:
            return out
    return None


def _group(key: str) -> str:
    return "I" if key.startswith("I:") else key


def draw_hole_types(pz: Puzzle, rng: random.Random) -> list[tuple[list[tuple[int, int]], str]]:
    """[(hole cells, type)]: for each hole, a type drawn among those that can cover every cell of it."""
    out = []
    for hole in find_holes(pz):
        fits = sorted(
            {
                t
                for t in {_group(pl.key) for pl in pz.placements}
                if all(any(_group(pl.key) == t and x in pl.cells for pl in pz.placements) for x in hole)
            },
            key="NBCGTI".index,
        )
        if len(fits) >= 2:
            out.append((hole, rng.choice(fits)))
    return out


def _solve(
    pz: Puzzle,
    rng: random.Random,
    exports: dict[str, int] | None,
    import_cost: int,
    time_limit: float,
    require: tuple[str, ...],
    min_count: int,
    ramp_bonus: int,
    holes: list[tuple[list[tuple[int, int]], str]],
    nuclear_cap: list[float],
) -> dict[str, Any] | None:
    def extra(model: Model) -> None:
        m = model.m
        for k, v in (exports or {}).items():
            m.Add(sum(model.e[pz.countries.index(k)]) == v)
        cost = []
        for k in pz.keys:
            unit = import_cost if pz.rank[k] is None else pz.rank[k]
            for c in range(pz.n):
                if not isinstance(model.cells[k, c], int):
                    cost.append(100 * unit * model.cells[k, c])
        cost += [rng.randint(0, 20) * x for x in model.x]
        if ramp_bonus:
            cost += [
                -ramp_bonus * len(pl.cells) * model.x[i]
                for i, pl in enumerate(pz.placements)
                if pl.shape.kind.startswith("ramp")
            ]
        for hole, t in holes:
            for x in hole:
                m.Add(
                    sum(model.x[i] for i, pl in enumerate(pz.placements) if _group(pl.key) == t and x in pl.cells) == 1
                )
        for share in nuclear_cap:
            if "N" in pz.keys:
                laid = sum(model.cells[k, c] for k in pz.keys for c in range(pz.n))
                m.Add(100 * sum(model.cells["N", c] for c in range(pz.n)) <= round(100 * share) * laid)
        for kind in require:
            m.Add(sum(model.x[i] for i, pl in enumerate(pz.placements) if pl.shape.kind == kind) >= min_count)
        m.Minimize(sum(cost))

    model = Model(pz, extra)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = exact.NUM_WORKERS
    solver.parameters.random_seed = rng.randint(0, 10**6)
    if solver.Solve(model.m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    sol, _ = model.read(solver)
    return {
        "exports": {k: v for k, v in sol["exports"].items() if any(v)},
        "step": sol["step"],
        "placements": sol["placements"],
    }


def fill_inventory(g: dict[str, Any], level: str) -> None:
    """Inventory of the given level from g["solution"]; only the plants the reference uses are listed."""
    sol = g["solution"]
    used = sorted({p["piece"] for p in sol["placements"] if p["piece"] != "I"}, key="NBCGT".index)
    old = g.get("inventory", {}).get("pieces", {})
    pieces: dict[str, dict[str, Any]] = {}
    for pid in used:
        spec: dict[str, Any] = {}
        if level == "exact":
            mine = [p for p in sol["placements"] if p["piece"] == pid]
            if g["pieces"][pid]["len"] == [1] and g["pieces"][pid].get("height") == [1]:
                spec["cells"] = len(mine)
            else:
                spec["bars"] = sorted((p["len"] for p in mine), reverse=True)
        if "max_cells" in old.get(pid, {}):
            spec["max_cells"] = old[pid]["max_cells"]
        pieces[pid] = spec
    g["pieces"] = {k: v for k, v in g["pieces"].items() if k in used}
    inv: dict[str, Any] = {"level": level, "pieces": pieces}
    if level == "exact":
        n = len(g["columns"])
        inv["exports"] = {nb["id"]: sum(sol["exports"].get(nb["id"], [0] * n)) for nb in g["neighbors"]}
        inv["imports"] = {
            nb["id"]: sum(p["len"] for p in sol["placements"] if p["piece"] == "I" and p["country"] == nb["id"])
            for nb in g["neighbors"]
        }
        if g["step"]:
            inv["step"] = len(sol["step"])
    g["inventory"] = inv
