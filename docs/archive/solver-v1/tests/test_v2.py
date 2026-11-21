"""Hand-checked v2 grids: one per constraint, a target score, curtailment, STEP and a 12-slot grid."""

import time

import pytest

from spot_solver.evaluate import evaluate
from spot_solver.generate import GenParams, draw_grid
from spot_solver.grid import from_dict, load_grids
from spot_solver.solve import solve_v2

from conftest import EXAMPLES, v2_grid

N4 = {"len": [4], "price": 0, "co2": 0}
N5 = {"len": [5], "price": 0, "co2": 0}
G2 = {"len": [2], "price": 2, "co2": 1}
T = {"len": [1], "price": 5, "co2": 2}


def check(grid, score, compositions="1"):
    res = solve_v2(grid, decoys=False)
    assert res["score"] == score
    assert res["compositions"] == compositions
    ev = evaluate(from_dict(grid), res["solution"])
    assert ev.complete, ev.errors
    assert ev.score == score
    return res


def test_min_score_ribbons():
    # Two full nuclear rows, nothing else: score 0.
    check(v2_grid([2, 2, 2, 2], {"N": N4, "T": T}), 0)


def test_price_cap():
    # Free: a TAC on the lone peak (5). Cap 2: export at 3h (costs 2) to lay a gas bar (2 + 2).
    nb = {"price": [-1, -2, -1, -3, -1], "cap": 1, "import": False, "export": True}
    pieces = {"N": N5, "G": G2, "T": T}
    check(v2_grid([2, 2, 3, 2, 2], pieces, neighbor=nb), 5)
    res = check(v2_grid([2, 2, 3, 2, 2], pieces, {"price_cap": 2}, neighbor=nb), 6)
    assert res["solution"]["exports"] == [0, 1, 0, 0, 0]


def test_co2_cap():
    # At most 8 nuclear cells. Free: coal on top scores 4; 0, 1 or 2 coal rows below show the same
    # visible program (slot prices 1 1 1 1), so it counts once. Cap 5: two nuclear rows plus one gas row.
    pieces = {"N": {**N4, "cap": 8}, "C": {"len": [4], "price": 1, "co2": 3}, "G": G2}
    check(v2_grid([3, 3, 3, 3], pieces), 4)
    assert check(v2_grid([3, 3, 3, 3], pieces, {"co2_cap": 5}), 8)["co2"] == 4


def test_no_import():
    nb = {"price": [0, 3, 0, 0], "cap": 1, "import": True, "export": False}
    pieces = {"N": N4, "T": T}
    check(v2_grid([2, 3, 2, 2], pieces, neighbor=nb), 3)
    res = check(v2_grid([2, 3, 2, 2], pieces, {"no_import": True}, neighbor=nb), 5)
    assert all(p["piece"] != "I" for p in res["solution"]["placements"])


def test_smooth():
    # A lone TAC jumps 0 -> 5; smooth 2 forces an export at 0h and a gas bar instead.
    nb = {"price": [-2, -1, -3, -2], "cap": 1, "import": False, "export": True}
    pieces = {"N": N4, "G": G2, "T": T}
    check(v2_grid([2, 3, 2, 2], pieces, neighbor=nb), 5)
    res = check(v2_grid([2, 3, 2, 2], pieces, {"smooth": 2}, neighbor=nb), 6)
    assert res["solution"]["exports"] == [1, 0, 0, 0]


def test_target_score():
    nb = {"price": [-2, -1, -3, -1], "cap": 1, "import": False, "export": True}
    pieces = {"N": N4, "G": G2, "T": T}
    # Score 7 is reached by one composition only: export at 8h, gas bar over 4h-8h.
    res = check(v2_grid([2, 3, 2, 2], pieces, neighbor=nb, optimize="target", target=7), 7)
    assert res["solution"]["exports"] == [0, 0, 1, 0]
    # Score 6 with one export: two ways (a TAC at 4h, or a gas bar over 0h-4h); the cheaper one is the solution.
    check(v2_grid([2, 3, 2, 2], pieces, neighbor=nb, optimize="target", target=6), 6)
    res = solve_v2(v2_grid([2, 3, 2, 2], pieces, neighbor=nb, optimize="target", target=8), decoys=False)
    assert res["status"] == "infeasible"


def test_curtailment_and_step():
    # Surplus at 8h: curtail (penalty 2) or pump there and turbine at 16h to flatten the peak.
    pieces = {"N": N4, "T": T}
    grid = v2_grid([2, 2, 1, 3], pieces, curtail_penalty=2, step=1)
    res = check(grid, 0)
    assert res["solution"]["step"] == [{"pump": 2, "turbine": 3}]
    grid = v2_grid([2, 2, -1, 2], {"N": {"len": [1], "price": 0, "co2": 0}}, curtail_penalty=2)
    res = check(grid, 2)
    assert res["solution"]["curtail"] == [0, 0, 1, 0]


def test_grid8_rescored():
    res = check(load_grids(EXAMPLES / "grid8_v2.json")[0], 7)
    assert res["co2"] == 10


@pytest.mark.parametrize("seed", [1, 2, 3])
def test_twelve_slots_fast(seed):
    import random

    p = GenParams(cols=12, hmax=7, pieces=["N", "B", "C", "G", "T"], neighbor=True, step=1, surplus=True)
    grid = draw_grid(random.Random(seed), p, 1)
    t0 = time.perf_counter()
    res = solve_v2(grid, decoys=False)
    assert time.perf_counter() - t0 < 5
    assert res["status"] == "optimal"
    ev = evaluate(from_dict(grid), res["solution"])
    assert ev.complete and ev.score == res["score"]


def test_several_neighbors_co2_per_import():
    # DE is cheaper (2) but emits 2 CO2 per imported cell; FR costs 3 with no CO2.
    neighbors = [
        {"id": "DE", "name": "Allemagne", "price": [0, 2, 0, 0], "cap": 1, "import": True, "export": False, "co2": 2},
        {"id": "FR", "name": "France", "price": [0, 3, 0, 0], "cap": 1, "import": True, "export": False, "co2": 0},
    ]
    pieces = {"N": N4, "T": T}
    res = check(v2_grid([2, 3, 2, 2], pieces, neighbors=neighbors), 2)
    assert res["co2"] == 2
    assert [p["piece"] for p in res["solution"]["placements"] if p["piece"] != "N"] == ["I:DE"]
    res = check(v2_grid([2, 3, 2, 2], pieces, {"co2_cap": 1}, neighbors=neighbors), 3)
    assert res["co2"] == 0
    assert [p["piece"] for p in res["solution"]["placements"] if p["piece"] != "N"] == ["I:FR"]


def test_several_neighbors_exports_by_country():
    # Nuclear only comes in full rows. With a budget of 4 blocks per line, exporting on both lines
    # everywhere adds two rows for 4 + 3 revenue.
    neighbors = [
        {"id": "DE", "price": [1, 1, 1, 1], "cap": 1, "import": False, "export": True, "co2": 2, "export_budget": 4},
        {"id": "UK", "price": [0, 3, 0, 0], "cap": 1, "import": False, "export": True, "co2": 1, "export_budget": 4},
    ]
    res = check(v2_grid([2, 2, 2, 2], {"N": N4}, neighbors=neighbors), -7)
    assert res["solution"]["exports"] == {"DE": [1, 1, 1, 1], "UK": [1, 1, 1, 1]}


def test_export_budget_default():
    # Default budget 2 per line: one extra row only, UK at 4h (3) + one UK block at 0 + two DE blocks (1 + 1); 3 choices for the free UK block.
    neighbors = [
        {"id": "DE", "price": [1, 1, 1, 1], "cap": 1, "import": False, "export": True},
        {"id": "UK", "price": [0, 3, 0, 0], "cap": 1, "import": False, "export": True},
    ]
    res = check(v2_grid([2, 2, 2, 2], {"N": N4}, neighbors=neighbors), -5, "3")
    assert all(sum(v) <= 2 for v in res["solution"]["exports"].values())


def test_tie_break_fewest_trades():
    # Water (1) and an import at 1 give the same score; the solution without trade wins, uniquely.
    nb = {"price": [0, 1, 0, 0], "cap": 1, "import": True, "export": False}
    pieces = {"N": N4, "B": {"len": [1], "price": 1, "co2": 0, "cap": 1}}
    res = check(v2_grid([2, 3, 2, 2], pieces, neighbor=nb), 1)
    assert res["trades"] == 0
    assert [p["piece"] for p in res["solution"]["placements"] if p["piece"] != "N"] == ["B"]


def test_cost_breaks_ties():
    # Grid 2 of demo/grids-v2.json: both drawings have the same price line (5 5 0 0 0 0) and score 10,
    #   TT NNN      TT NNN
    #   NNNNNN  vs  TTNNNN
    #   NNNNNN      TTNNNN
    # but the second wastes 4 TACs under the ribbons. Only the cheapest (10, not 30) is the solution.
    grid = v2_grid([3, 3, 2, 3, 3, 3], {"N": {"len": [3, 4, 5, 6], "price": 0, "co2": 0}, "T": T})
    res = check(grid, 10)
    ev = evaluate(from_dict(grid), res["solution"])
    assert res["cost"] == ev.cell_cost == 10
    t_cells = [0] * 6
    for b in res["solution"]["placements"]:
        if b["piece"] == "T":
            t_cells[b["col"]] += 1
    assert t_cells == [1, 1, 0, 0, 0, 0]
