"""Pose mode: the §7 example, one grid per inventory level, minimal clues, imports of any country."""

import json
import random

import pytest

from spot_solver import pose
from spot_solver.cli import main
from spot_solver.evaluate import evaluate
from spot_solver.generate import (GenParams, draw_grid, generate, minimal_clues,
                                  pose_inventory)
from spot_solver.grid import from_dict
from spot_solver.solve import solve_v2

from conftest import EXAMPLES

N = {"len": [3, 4, 5, 6], "price": 0, "co2": 0}
G = {"len": [2, 3], "price": 2, "co2": 1}
T = {"len": [1], "price": 5, "co2": 2}


def pose_grid(residual, inventory, pieces=None, clues=None, **extra):
    d = {"mode": "pose", "residual": residual, "pieces": pieces or {"N": N, "G": G, "T": T},
         "inventory": inventory, "price_clues": clues or [None] * len(residual),
         "constraints": {"co2_cap": extra.pop("co2_cap", None)}}
    d.update(extra)
    return d


def test_example_section_7():
    d = json.loads((EXAMPLES / "pose_s7.json").read_text())
    res = pose.solve_pose(d)
    assert res["status"] == "solved" and res["publishable"]
    assert res["prices"] == [0, 2, 5, 0, 5, 2]
    ev = evaluate(pose.normalize(d)[0], res["solution"])
    assert ev.complete, ev.errors
    # The inventory alone already forces the pose: no clue is needed.
    assert pose.count_pose(d, [None] * 6).count == 1


def test_cli_detects_pose(capsys):
    path = str(EXAMPLES / "pose_s7.json")
    assert main(["solve", path]) == 0
    assert json.loads(capsys.readouterr().out)["mode"] == "pose"
    assert main(["check", path]) == 0
    assert "publishable" in capsys.readouterr().out


def drawn(seed, cols=6, **kw):
    p = GenParams(cols=cols, hmax=4, neighbor=True, **kw)
    raw = draw_grid(random.Random(seed), p, 1)
    raw.pop("curtail_penalty", None)
    raw["objective"] = {"optimize": "min_score", "target": None, "constraints": {}}
    ref = solve_v2(raw, count_cap=1, decoys=False)
    return raw, ref


@pytest.mark.parametrize("level", ["exact", "bars", "cells"])
def test_levels_accept_reference(level):
    raw, ref = drawn(2)
    inv = pose_inventory(from_dict(raw), ref["solution"], level, None)
    d = {k: v for k, v in raw.items() if k != "objective"}
    d.update(mode="pose", inventory=inv, price_clues=[None] * 6)
    res = pose.solve_pose(d, decoys=False)
    assert res["status"] == "solved"
    ev = evaluate(pose.normalize(d)[0], res["solution"])
    assert ev.complete, ev.errors
    # Every level must still allow the reference composition.
    ref_prices = evaluate(from_dict(raw), ref["solution"]).col_price
    assert pose.count_pose(d, ref_prices, cap=10).count >= 1


def test_levels_get_weaker():
    """exact <= bars <= cells in number of compositions, and the levels are not all equal."""
    seen = set()
    for seed in range(1, 9):
        raw, ref = drawn(seed, cols=8)
        counts = []
        for level in ("exact", "bars", "cells"):
            d = {k: v for k, v in raw.items() if k != "objective"}
            d.update(mode="pose", inventory=pose_inventory(from_dict(raw), ref["solution"], level, None),
                     price_clues=[None] * 8)
            counts.append(pose.count_pose(d, cap=10).count)
        assert counts == sorted(counts), (seed, counts)
        seen.add(tuple(counts))
    assert len(seen) > 1


def test_inventory_laid_exactly():
    # Same silhouette, one fewer N bar: the grid cannot be paved, so no pose exists.
    d = pose_grid([2, 2, 2], {"level": "exact", "pieces": {"N": {"bars": [3]}, "T": {"cells": 3}},
                              "exports": {}, "imports": {}, "step": 0})
    assert pose.solve_pose(d)["status"] == "solved"
    d["inventory"]["pieces"]["T"] = {"cells": 2}
    assert pose.solve_pose(d)["status"] == "infeasible"
    d["inventory"]["pieces"]["T"] = {"cells": 4}
    assert pose.solve_pose(d)["status"] == "infeasible"


def test_price_clue_is_a_constraint():
    inv = {"level": "cells", "pieces": {"N": {"cells": 6}, "T": {"cells": 2}}, "exports": {}, "imports": {}, "step": 0}
    d = pose_grid([2, 2, 2, 2], inv, pieces={"N": N, "T": T})
    free = pose.count_pose(d, cap=10).count
    assert free >= 2
    assert pose.count_pose(d, [5, None, None, None], cap=10).count < free
    assert pose.count_pose(d, [7, None, None, None], cap=10).count == 0


def two_countries(co2_cap):
    nb = lambda i, co2: {"id": i, "name": i, "price": [1, 1, 1, 1], "cap": 1, "import": True,
                         "export": False, "co2": co2}
    return pose_grid(
        [1, 1, 1, 2],
        {"level": "cells", "pieces": {"N": {"bars": [4]}}, "exports": {}, "imports": {"I": 1}, "step": 0},
        pieces={"N": N | {"len": [4]}}, neighbors=[nb("DE", 2), nb("FR", 0)], co2_cap=co2_cap)


def test_imports_any_country_and_co2_cap_forces_country():
    free = pose.solve_pose(two_countries(None))
    assert free["compositions"] == "2"  # DE or FR
    capped = pose.solve_pose(two_countries(1))
    assert capped["publishable"]
    imported = [b["piece"] for b in capped["solution"]["placements"] if b["piece"].startswith("I")]
    assert imported == ["I:FR"]


def test_imports_per_country():
    d = two_countries(None)
    d["inventory"]["imports"] = {"DE": 1}
    res = pose.solve_pose(d)
    assert res["publishable"]
    assert [b["piece"] for b in res["solution"]["placements"] if b["piece"].startswith("I")] == ["I:DE"]


def test_exports_and_step_exact():
    nb = {"price": [-1, -1, -1, -1], "cap": 1, "import": False, "export": True}
    inv = {"level": "exact", "pieces": {"N": {"bars": [4]}}, "exports": {"X": 1}, "imports": {}, "step": 0}
    d = pose_grid([0, 1, 1, 1], inv, pieces={"N": N | {"len": [3, 4]}}, neighbor=nb)
    res = pose.solve_pose(d)  # 4 cells to pave: one export in the empty column, one N bar of 4
    assert res["status"] == "solved"
    assert sum(res["solution"]["exports"]) == 1
    d["inventory"]["exports"] = {"X": 0}
    assert pose.solve_pose(d)["status"] == "infeasible"


def test_step_exact():
    # Without STEP the hole at column 2 leaves 2 + 4 cells; one pump there makes two bars of 3 fit.
    inv = {"level": "exact", "pieces": {"N": {"bars": [3, 3]}}, "exports": {}, "imports": {}, "step": 1}
    d = pose_grid([1, 1, 0, 1, 1, 1, 1], inv, pieces={"N": N | {"len": [3]}})
    res = pose.solve_pose(d)
    assert res["status"] == "solved" and res["compositions"] == "2"  # turbine at column 3 or 6
    assert [s["pump"] for s in res["solution"]["step"]] == [2]
    d["inventory"]["step"] = 0
    assert pose.solve_pose(d)["status"] == "infeasible"


def test_step_count_must_be_published():
    inv = {"level": "exact", "pieces": {"N": {"bars": [3, 3]}}, "exports": {}, "imports": {}, "step": None}
    d = pose_grid([1, 1, 0, 1, 1, 1, 1], inv, pieces={"N": N | {"len": [3]}})
    with pytest.raises(ValueError, match="STEP pair count is not published"):
        pose.solve_pose(d)


def test_no_curtailment():
    # A negative column with no export to absorb it cannot be paved.
    d = pose_grid([-1, 2, 2, 2], {"level": "exact", "pieces": {"N": {"bars": [3]}}, "exports": {},
                                  "imports": {}, "step": 0}, curtail_penalty=2)
    assert pose.solve_pose(d)["status"] == "infeasible"


@pytest.mark.parametrize("level", ["exact", "bars", "cells"])
def test_minimal_clues(level):
    grids, stats = generate(GenParams(cols=6, hmax=4, neighbor=True, pieces=["N", "G", "T"], count=2, seed=4,
                                      mode="pose", level=level, max_clues=6, max_attempts=60))
    assert grids, stats
    for g in grids:
        clues = g["price_clues"]
        given = [i for i, v in enumerate(clues) if v is not None]
        assert pose.count_pose(g, cap=2).count == 1
        for i in given:
            fewer = list(clues)
            fewer[i] = None
            assert pose.count_pose(g, fewer, cap=2).count > 1, (level, i)
        assert evaluate(pose.normalize(g)[0], g["solution"]).complete


def test_generate_rejects_beyond_max_clues():
    grids, stats = generate(GenParams(cols=6, hmax=4, neighbor=True, pieces=["N", "G", "T"], count=3, seed=1,
                                      mode="pose", level="cells", max_clues=0, max_attempts=25))
    assert all(sum(v is not None for v in g["price_clues"]) == 0 for g in grids)
    assert stats["too_many_clues"] + stats["not_unique"] + stats["kept"] + stats["infeasible"] == stats["attempts"]
