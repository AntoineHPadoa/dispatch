"""Validator: same verdict and messages as web/src/model/grid.ts on the shared reference grids."""

import pytest
from conftest import fixtures, published

from dispatch_solver.grid import validate


@pytest.mark.parametrize("fx", fixtures(), ids=lambda fx: fx["file"])
def test_fixture_verdict(fx):
    allow = fx["expect"].get("allow_ramp", "ramp" in fx["expect"]["requires"] and fx["expect"]["valid"])
    assert validate(fx["grid"], allow_ramp=allow) == fx["expect"]["errors"]


def test_published_grids_are_valid():
    for g in published():
        assert validate(g) == [], g["id"]


def test_ramp_needs_the_flag():
    fx = next(f for f in fixtures("valid-ramp-"))
    assert validate(fx["grid"]) == ["pieces.C.shape: ramps are not enabled"]
    g = {**fx["grid"], "pieces": {**fx["grid"]["pieces"], "N": {**fx["grid"]["pieces"]["N"], "shape": "trap"}}}
    assert "pieces.N.shape: only coal (C) can be a ramp" in validate(g, allow_ramp=True)


def test_bulletin_checks():
    g = dict(published()[0])
    n = len(g["columns"])
    g["bulletin"] = {
        "number": 3,
        "title": "Pointe du soir",
        "text": "Froid.",
        "weather": ["sun"] * n,
        "published": "2026-12-01",
    }
    assert validate(g) == []
    g["bulletin"] = {**g["bulletin"], "published": "2026-02-30", "weather": ["rain"] * n, "extra": 1}
    assert validate(g) == [
        f"bulletin.weather: {n} values among sun, moon, cloud, wind expected",
        "bulletin.published: ISO date YYYY-MM-DD expected",
        "bulletin.extra: unknown key",
    ]
