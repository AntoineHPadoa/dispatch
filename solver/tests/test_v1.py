"""Regression on the 8 demo grids under the legacy scale (cost, then facture)."""

import pytest

from spot_solver.evaluate import evaluate
from spot_solver.grid import from_dict, load_grids
from spot_solver.solve import solve_v1

from conftest import V1_GRIDS

GRIDS = load_grids(V1_GRIDS)


@pytest.mark.parametrize("grid", GRIDS, ids=[str(g["id"]) for g in GRIDS])
def test_v1_optimum_and_uniqueness(grid):
    res = solve_v1(grid)
    assert res["cost"] == grid["optimum"]["cost"]
    assert res["facture"] == grid["optimum"]["facture"]
    assert res["co2"] == grid["optimum"]["co2"]
    assert res["compositions"] == "1"
    ev = evaluate(from_dict(grid), res["solution"])
    assert ev.complete, ev.errors
    assert (ev.cost, ev.facture) == (res["cost"], res["facture"])


@pytest.mark.parametrize("grid", GRIDS, ids=[str(g["id"]) for g in GRIDS])
def test_v1_reference_solution_matches_evaluator(grid):
    ev = evaluate(from_dict(grid), grid["solution"])
    assert ev.complete, ev.errors
    assert (ev.cost, ev.facture, ev.co2) == tuple(grid["optimum"][k] for k in ("cost", "facture", "co2"))
