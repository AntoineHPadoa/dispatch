"""Exact solver: composition counting, STEP pairs and line capacity."""

import json

from conftest import FIXTURES, published

from dispatch_solver import exact
from dispatch_solver.board import composition_of, reference_composition


def test_two_compositions_found():
    fx = json.loads((FIXTURES / "unpublishable-two-compositions.json").read_text())
    res = exact.count(fx["grid"], cap=5)
    assert res.count >= 2 and len({json.dumps(c, sort_keys=True) for c in res.compositions}) == res.count


def test_step_pairs_rebuilt():
    g = next(x for x in published() if x["step"])
    res = exact.count(g)
    sol = res.solution
    assert all(p["pump"] < p["turbine"] for p in sol["step"])
    assert composition_of(g, sol["placements"], sol["exports"], sol["step"]) == reference_composition(g)


def test_infeasible_grid_has_no_composition():
    fx = json.loads((FIXTURES / "unpublishable-reference-breaks-clue.json").read_text())
    assert exact.count(fx["grid"]).count == fx["expect"]["compositions"]
