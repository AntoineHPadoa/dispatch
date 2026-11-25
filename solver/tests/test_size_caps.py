"""Size caps of a lot (max_cells, max_full_n_rows): reject `quota:cells`, off by default, lower days drawn."""

import random

from dispatch_solver.board import reference_composition
from dispatch_solver.generate.lot import Quotas, _attempt, _draw, check_lot, make_candidate, over_size, reference_size

CAPS = {"max_cells": 20, "max_full_n_rows": 1}


def _lab_grid(cells: int, rows: int) -> dict:
    return {
        "columns": [{}] * 8,
        "difficulty": {"rating": 2},
        "solution": {"placements": []},
        "lab": {
            "family": "pointe_soir",
            "mechanics": [],
            "clue_profile": [],
            "decisions": {"exchange": 1},
            "cells": cells,
            "full_n_rows": rows,
            "mix": 0,
            "seed": cells,
        },
        "demand": [3] * 8,
        "weather": {"R": [0] * 8, "F": [0] * 8},
        "pieces": {},
    }


def test_over_size():
    assert not over_size({"cells": 20, "full_n_rows": 1}, CAPS)
    assert over_size({"cells": 21, "full_n_rows": 0}, CAPS)
    assert over_size({"cells": 10, "full_n_rows": 2}, CAPS)
    assert not over_size({"cells": 99, "full_n_rows": 9}, {"max_cells": None, "max_full_n_rows": None})


def test_size_caps_are_lot_quotas_off_by_default():
    lot, errors = check_lot({"lot": "t", "size": 2, "mix": [{}], "quotas": {"max_cells": 30, "max_full_n_rows": 1}})
    assert not errors and lot["quotas"]["max_cells"] == 30
    _, errors = check_lot({"lot": "t", "size": 2, "mix": [{}], "quotas": {"max_cells": -1}})
    assert errors
    q = Quotas(20, {"min_per_rating": 0})
    assert q.q["max_cells"] is None and q.q["max_full_n_rows"] is None
    assert q.check(_lab_grid(80, 5)) != "quota:cells"  # no cap: never quota:cells
    capped = Quotas(20, {"min_per_rating": 0, **CAPS})
    assert capped.check(_lab_grid(21, 0)) == "quota:cells"
    assert capped.check(_lab_grid(12, 2)) == "quota:cells"
    assert capped.check(_lab_grid(20, 1)) is None


def test_worker_rejects_a_large_reference_before_the_clues():
    cfg = {"cols": 12, "neighbors": 1, "allow_one_plant": True}
    caps = {"max_cells": 20, "max_full_n_rows": None}
    reasons, kept = set(), []
    for s in range(15):
        g, why, _ = make_candidate(cfg, s, None, caps)
        reasons.add(why)
        if g is not None:
            kept.append(g)
    assert "quota:cells" in reasons
    assert all(g["lab"]["cells"] <= 20 for g in kept)
    # Without caps the same draws give larger grids: the cap is a reject, not a change of the draw.
    big = [g for s in range(15) if (g := make_candidate(cfg, s)[0]) is not None]
    assert any(g["lab"]["cells"] > 20 for g in big)
    # The worker passes the caps through; the 3-tuple form stays valid.
    assert _attempt((cfg, 0, None, caps))[1] in reasons
    assert _attempt(({"cols": 6}, 1, None))[1] != "quota:cells"


def test_cells_cap_draws_lower_days():
    mix = [{"cols": 8}, {"cols": 8, "height": 7}]
    q = Quotas(20, {"min_per_rating": 0, "max_cells": 30})
    rng = random.Random(3)
    heights = {i: set() for i in range(2)}
    for _ in range(60):
        cfg, _seed, i, _aim = _draw(rng, mix, [1, 1], q)
        heights[i].add(cfg.get("height"))
    assert heights[0] <= {4, 5, 6} and len(heights[0]) > 1
    assert heights[1] == {7}  # a set height is kept
    cfg, *_ = _draw(random.Random(3), mix, [1, 0.0001], Quotas(20, {"min_per_rating": 0}))
    assert "height" not in cfg  # no cap: the day is drawn as before


def test_reference_size_matches_the_lab_measures():
    """The early size (no board) equals cells and full_n_rows of the finished grid, STEP grids included."""
    cfg = {"cols": 8, "neighbors": 1, "step": 1, "height": 5}
    caps = {"max_cells": 99, "max_full_n_rows": 9}
    kept = [g for s in range(8) if (g := make_candidate(cfg, s, 3, caps)[0]) is not None]
    assert kept
    for g in kept:
        size = reference_size(g, reference_composition(g))
        assert size == {"cells": g["lab"]["cells"], "full_n_rows": g["lab"]["full_n_rows"]}
