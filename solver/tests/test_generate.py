"""Generator: candidates, bulletins, quotas and a small lot."""

import random
import re

import pytest

from dispatch_solver import exact
from dispatch_solver.board import reference_composition
from dispatch_solver.deduce import deduce
from dispatch_solver.generate.bulletin import TEMPLATES, make_bulletin
from dispatch_solver.generate.lot import Quotas, make_candidate, run_lot
from dispatch_solver.generate.silhouettes import FAMILIES, draw_day, sky
from dispatch_solver.grid import WEATHER_KINDS, validate


def test_families_stay_in_bounds():
    for fam in FAMILIES:
        for seed in range(5):
            f, demand, r, ff = draw_day(random.Random(seed), 8, fam, height=6)
            res = [demand[c] - r[c] - ff[c] for c in range(8)]
            assert f == fam and max(res) <= 6
            assert min(res) >= (-1 if fam == "surplus_midi" else 1)
            assert all(w in WEATHER_KINDS for w in sky(8, r))


def test_candidate_is_publishable():
    g, why, _ = make_candidate({"cols": 8, "neighbors": 1}, 11)
    assert why is None
    assert validate(g) == []
    assert exact.count(g).count == 1
    res = deduce(g)
    assert res.solved and res.composition == reference_composition(g)
    assert g["difficulty"]["rating"] == res.rating
    lab = g["lab"]
    assert lab["family"] in FAMILIES and "neighbors:1" in lab["mechanics"]
    assert lab["bulletin"]["title"] == g["title"] and len(lab["bulletin"]["weather"]) == 8


def test_ramp_candidate_uses_the_ramp():
    g, why, _ = make_candidate({"cols": 8, "ramp": "trap"}, 3)
    assert why is None
    assert g["pieces"]["C"]["shape"] == "trap" and "ramp:trap" in g["lab"]["mechanics"]
    assert any(p["piece"] == "C" for p in g["solution"]["placements"])
    assert validate(g, allow_ramp=True) == [] and validate(g) != []


def test_bulletin_only_uses_visible_traits():
    g = next(
        g
        for seed in range(20)
        for g, _, _ in [make_candidate({"cols": 12, "neighbors": 2, "co2_cap": "auto"}, seed)]
        if g is not None
    )
    assert g["co2_cap"] > 0
    b = make_bulletin(g, g["lab"]["family"], random.Random(1))
    assert b["title"] in TEMPLATES["titles"][g["lab"]["family"]]
    assert all(nb["name"] in b["text"] for nb in g["neighbors"]) or str(g["co2_cap"]) in b["text"]
    allowed = {str(g["co2_cap"])} | {c.rstrip("h") for c in g["columns"]}
    assert set(re.findall(r"\d+", b["text"])) <= allowed


def test_slot_counts():
    with pytest.raises(ValueError):
        make_candidate({"cols": 10}, 1)


def test_quotas():
    q = Quotas(4, {"max_same_family": 1, "min_per_rating": 1})

    def grid(fam, r):
        return {
            "lab": {"family": fam, "mechanics": ["x"], "clue_profile": ["price"]},
            "difficulty": {"rating": r},
            "demand": [len(fam), r],
            "weather": {"R": [0, 0], "F": [0, 0]},
            "columns": ["a", "b"],
            "pieces": {"N": {}},
        }

    a = grid("aa", 1)
    assert q.check(a) is None
    q.add(a)
    assert q.check(grid("aa", 2)) == "quota:family"
    assert q.check(grid("bbb", 1)) == "quota:rating"  # 3 slots left, 3 ratings still missing
    assert q.check(grid("bbb", 2)) is None


def test_small_lot():
    lot = {
        "lot": "t",
        "size": 3,
        "seed": 2,
        "max_attempts": 40,
        "mix": [{"cols": 6, "neighbors": 1}, {"cols": 8, "ramp": "trap"}],
        "quotas": {"min_per_rating": 0, "max_same_family": 2},
    }
    grids, extra = run_lot(lot, workers=2)
    assert len(grids) == 3
    assert [g["id"] for g in grids] == [1, 2, 3]
    assert extra["stats"]["kept"] == 3 and extra["stats"]["attempts"] >= 3
