"""The published grids (coal ramps included): one composition, the reference one, deducible, with their stored rating."""

import json

import pytest
from conftest import FIXTURES, published

from dispatch_solver import exact
from dispatch_solver.api import check_published
from dispatch_solver.board import reference_composition
from dispatch_solver.deduce import deduce


@pytest.mark.parametrize("g", published(), ids=lambda g: str(g["id"]))
def test_published_grid(g):
    ex = exact.count(g)
    assert ex.count == 1
    assert ex.composition == reference_composition(g)
    res = deduce(g)
    assert res.solved
    assert res.composition == reference_composition(g)
    assert res.rating == g["difficulty"]["rating"]


def test_check_published_reports_ok():
    ok, lines = check_published(published(), allow_ramp=True)
    assert ok and lines[-1].startswith("OK")


def test_check_published_accepts_ramps_on_request():
    g = json.loads((FIXTURES / "valid-technique-ramp-plateau.json").read_text())["grid"]
    ok, lines = check_published([g])
    assert not ok and "ramps are not enabled" in lines[0]
    ok, lines = check_published([g], allow_ramp=True)
    assert ok, lines
