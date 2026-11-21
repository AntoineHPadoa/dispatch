"""Reference solution of a drawn grid: the merit order (cheapest plants first), with random tie-breaks.

- solve_reference(): CP-SAT minimises the sum of the merit-order ranks of the laid cells (imports cost
  `import_cost`), plus a tiny random weight per placement so that equal-cost layouts vary with the seed.
  Exchange totals of the draft (exports per neighbor, STEP pairs) are imposed.
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
from ..exact import Model


def solve_reference(
    draft: dict[str, Any],
    rng: random.Random,
    exports: dict[str, int] | None = None,
    import_cost: int = 6,
    time_limit: float = 10.0,
    require: tuple[str, ...] = (),
) -> dict[str, Any] | None:
    """§14 solution of the draft at minimal merit-order cost, or None if infeasible.

    `require`: shape kinds the solution must use at least once (e.g. "ramp_trap", "tall").
    """
    pz = Puzzle(draft)

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
        for kind in require:
            m.AddBoolOr(
                [model.x[i] for i, pl in enumerate(pz.placements) if pl.shape.kind == kind] or [m.NewConstant(0)]
            )
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
