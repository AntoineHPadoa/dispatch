"""Shared reference grids: compositions, deduction status, rating, techniques and composition."""

import pytest
from conftest import fixtures

from dispatch_solver import exact
from dispatch_solver.board import reference_composition
from dispatch_solver.deduce import deduce

PLAYED = [fx for fx in fixtures() if fx["expect"]["valid"]]


@pytest.mark.parametrize("fx", PLAYED, ids=lambda fx: fx["file"])
def test_fixture_solvers(fx):
    g, e = fx["grid"], fx["expect"]
    ex = exact.count(g, cap=2)
    assert ex.count == e["compositions"]
    res = deduce(g)
    if "deduction" in e:
        assert res.status == e["deduction"]
    if e["compositions"] == 1 and e.get("deduction") == "solved":
        assert ex.composition == reference_composition(g) == e["composition"]
        assert res.composition == e["composition"]
        assert res.rating == e["rating"]
        assert sorted(res.techniques()) == e["techniques"]
    if e.get("reference_solves") is False:
        assert ex.composition != reference_composition(g)
