"""High-level solving: optimum, solution, composition count and difficulty for one grid.

- v2: `min_score` (minimize score) or `target` (score == target), under the grid constraints,
  then lowest cost (sum of all cell prices), then fewest blocks exchanged; uniqueness on the composition
  (cells per piece and column, imports per country, exports, STEP, curtailment).
- v1 (regression only): minimize cost, then facture; count compositions at that optimum.
"""

from __future__ import annotations

import math
import time
from typing import Any

from . import model as M
from .evaluate import evaluate
from .grid import Grid, from_dict, is_v1

COUNT_CAP = 10
DECOY_CAP = 20


def solve_v2(d: dict[str, Any], count_cap: int = COUNT_CAP, decoys: bool = True,
             time_limit: float = 60.0) -> dict[str, Any]:
    grid = from_dict(d)
    obj = grid.objective
    t0 = time.perf_counter()
    if obj.optimize == "target":
        if obj.target is None:
            raise ValueError("objective 'target' needs a 'target' value")
        value = int(obj.target)
    elif obj.optimize == "min_score":
        h = M.build(grid)
        best = M.minimize(h, h.score, time_limit)
        if best.status != "optimal":
            return {"status": best.status, "time": round(time.perf_counter() - t0, 3)}
        value = best.value
    else:
        raise ValueError(f"unknown objective {obj.optimize!r}")

    h = M.build(grid)
    h.model.Add(h.score == value)
    # Tie-breaks: lowest cost, then fewest blocks exchanged with neighbors.
    cheapest = M.minimize(h, h.cell_cost, time_limit)
    if cheapest.status != "optimal":
        return {"status": cheapest.status, "time": round(time.perf_counter() - t0, 3)}
    h.model.Add(h.cell_cost == cheapest.value)
    fewest = M.minimize(h, h.trades, time_limit)
    if fewest.status != "optimal":
        return {"status": fewest.status, "time": round(time.perf_counter() - t0, 3)}
    h.model.Add(h.trades == fewest.value)
    cnt = M.count(h, count_cap, time_limit)
    solution = cnt.solutions[0]
    ev = evaluate(grid, solution)
    out: dict[str, Any] = {
        "status": "optimal" if obj.optimize == "min_score" else "target_reached",
        "objective": obj.optimize,
        "score": value,
        "co2": ev.co2,
        "cost": cheapest.value,
        "trades": fewest.value,
        "compositions": cnt.label,
        "publishable": cnt.count == 1,
        "solution": solution,
    }
    if decoys:
        out["difficulty"] = difficulty(grid, value, cheapest.value, cnt.count, time_limit)
    out["time"] = round(time.perf_counter() - t0, 3)
    return out


def count_near(grid: Grid, value: int, best_cost: int, time_limit: float = 60.0) -> M.CountResult:
    """Decoys: compositions at the optimal score (or the target) whose cost is the optimal cost + 1."""
    h = M.build(grid)
    h.model.Add(h.score == value)
    h.model.Add(h.cell_cost == best_cost + 1)
    return M.count(h, DECOY_CAP, time_limit)


def difficulty(grid: Grid, value: int, best_cost: int, n_opt: int, time_limit: float = 60.0) -> dict[str, Any]:
    """Difficulty = size + mechanics + decoys (see README for the rationale)."""
    near = count_near(grid, value, best_cost, time_limit)
    cells = sum(max(0, r) for r in grid.residual)
    obj = grid.objective
    mechanics = (
        max(0, len(grid.pieces) - 1)
        + len(grid.neighbors)
        + (1 if any(nb.co2 for nb in grid.neighbors) else 0)
        + (1 if grid.step else 0)
        + (1 if grid.curtail_penalty is not None and min(grid.residual) < 0 else 0)
        + sum(x is not None for x in (obj.price_cap, obj.co2_cap, obj.smooth))
        + (1 if obj.no_import else 0)
    )
    score = cells / 10 + mechanics + 2 * math.log2(1 + near.count)
    return {
        "value": round(score, 1),
        "cells": cells,
        "mechanics": mechanics,
        "decoys": near.label,
        "optimal_compositions": n_opt,
    }


def solve_v1(d: dict[str, Any], count_cap: int = COUNT_CAP, time_limit: float = 60.0) -> dict[str, Any]:
    grid = from_dict(d)
    t0 = time.perf_counter()
    h = M.build(grid, mode="v1")
    best_cost = M.minimize(h, h.cost, time_limit)
    if best_cost.status != "optimal":
        return {"status": best_cost.status}
    h.model.Add(h.cost == best_cost.value)
    best_f = M.minimize(h, h.facture, time_limit)
    h.model.Add(h.facture == best_f.value)
    cnt = M.count(h, count_cap, time_limit)
    ev = evaluate(grid, cnt.solutions[0])
    return {
        "status": "optimal",
        "objective": "v1_cost_then_facture",
        "cost": best_cost.value,
        "facture": best_f.value,
        "co2": ev.co2,
        "compositions": cnt.label,
        "publishable": cnt.count == 1,
        "solution": cnt.solutions[0],
        "time": round(time.perf_counter() - t0, 3),
    }


def solve_any(d: dict[str, Any], mode: str = "auto", **kw: Any) -> dict[str, Any]:
    if mode == "pose" or (mode == "auto" and d.get("mode") == "pose"):
        from .pose import solve_pose
        return solve_pose(d, **kw)
    if mode == "v1" or (mode == "auto" and is_v1(d)):
        return solve_v1(d, **{k: v for k, v in kw.items() if k != "decoys"})
    return solve_v2(d, **kw)
