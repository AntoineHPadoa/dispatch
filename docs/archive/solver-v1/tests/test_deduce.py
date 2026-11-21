"""Deduction solver: each rule on a mini-grid, soundness against CP-SAT, rejection of guess-only grids,
minimal lore clues, level "none" and the lore clues in the CP-SAT model."""

import random

import pytest

from spot_solver import deduce, pose
from spot_solver.evaluate import evaluate
from spot_solver.generate import GenParams, clue_pool, draw_grid, generate, lore_clues, pose_inventory
from spot_solver.grid import from_dict
from spot_solver.solve import solve_v2

N = {"len": [3, 4, 5, 6], "price": 0, "co2": 0}
G = {"len": [2, 3], "price": 2, "co2": 1}
T = {"len": [1], "price": 5, "co2": 2}
LORE = ["price", "column", "flow", "bar", "given"]


def grid(residual, pieces, inv_pieces, clues=(), exports=None, imports=None, step=0, co2_cap=None, **extra):
    d = {"mode": "pose", "residual": residual, "pieces": pieces,
         "inventory": {"level": "cells", "pieces": inv_pieces, "exports": exports or {}, "imports": imports or {},
                       "step": step},
         "clues": list(clues), "constraints": {"co2_cap": co2_cap}}
    d.update(extra)
    return d


def solver(d):
    s = deduce.Solver(deduce.Puzzle(d))
    s.apply_clue_facts()
    return s


def view(s):
    return deduce.View(s.pz, s.st)


def nb(price, imp=True, exp=True):
    return {"price": price, "cap": 1, "import": imp, "export": exp}


# ----- one test per rule -----

def test_given_and_room():
    d = grid([2, 2, 2], {"N": N | {"len": [2, 3]}}, {"N": {"cells": 6}},
             [{"type": "given", "piece": "N", "row": 0, "col": 0, "len": 3}])
    s = solver(d)
    assert s.steps[0].rule == "given" and ("N", 0, 0, 3) in s.st.placed
    s.r_room(view(s))
    assert ("N", 0, 0, 2) not in s.st.cands and ("N", 0, 1, 2) not in s.st.cands
    assert ("N", 1, 0, 2) in s.st.cands


def test_exhausted():
    # Cell (1, 1) can only be a TAC, and the inventory has a single TAC: no TAC anywhere else.
    d = grid([1, 2, 1], {"N": N | {"len": [3]}, "T": T}, {"N": {"bars": [3]}, "T": {"cells": 1}})
    s = solver(d)
    s.r_exhausted(view(s))
    assert not [b for b in s.st.cands if b[0] == "T" and b[1] == 0]
    assert ("T", 1, 1, 1) in s.st.cands


def test_price_cap():
    d = grid([1, 1], {"N": N | {"len": [2]}, "T": T}, {"N": {}, "T": {}},
             [{"type": "price", "col": 0, "value": 0}])
    s = solver(d)
    s.r_price_cap(view(s))
    assert ("T", 0, 0, 1) not in s.st.cands and ("T", 0, 1, 1) in s.st.cands


def test_record_both_ways():
    d = grid([1, 1, 1], {"N": N | {"len": [3]}, "T": T}, {"N": {}, "T": {}},
             [{"type": "column", "col": 1, "counts": {"T": 0}}])
    s = solver(d)
    s.r_record(view(s))
    assert ("T", 0, 1, 1) not in s.st.cands
    d = grid([1, 1, 1], {"N": N | {"len": [3]}, "T": T}, {"N": {}, "T": {}},
             [{"type": "column", "col": 1, "counts": {"T": 1}}])
    s = solver(d)
    s.r_record(view(s))
    assert ("N", 0, 0, 3) not in s.st.cands  # the single cell of 8h must be a TAC


def test_flow_import_and_export():
    d = grid([1, 1, 1], {"N": N | {"len": [3]}}, {"N": {}}, [{"type": "flow", "col": 0, "country": "X",
                                                            "dir": "import", "value": 0}],
             imports={"X": 1}, neighbor=nb([1, 1, 1], exp=False))
    s = solver(d)
    s.r_flow(view(s))
    assert ("I", 0, 0, 1) not in s.st.cands and ("I", 0, 1, 1) in s.st.cands
    d = grid([1, 1, 0], {"N": N | {"len": [3]}}, {"N": {}},
             [{"type": "flow", "col": 2, "country": "X", "dir": "export", "value": 1}],
             exports={"X": 1}, neighbor=nb([1, 1, 1], imp=False))
    s = solver(d)
    assert s.steps[-1].rule == "flow" and view(s).minh == [1, 1, 1]


def test_single_cover():
    d = grid([1, 2, 1], {"N": N | {"len": [3]}, "T": T}, {"N": {"bars": [3]}, "T": {"cells": 1}})
    s = solver(d)
    s.r_single_cover(view(s))
    assert ("T", 1, 1, 1) in s.st.placed


def test_single_spot():
    d = grid([1, 1, 1, 2], {"N": N | {"len": [3, 4]}, "T": T},
             {"N": {"bars": [4]}, "T": {"cells": 1}})
    s = solver(d)
    s.r_single_spot(view(s))
    assert ("N", 0, 0, 4) in s.st.placed


def test_program():
    d = grid([1, 2, 2, 2], {"N": N | {"len": [3]}}, {"N": {}},
             [{"type": "bar", "piece": "N", "col": 0, "len": 3}])
    s = solver(d)
    s.r_program(view(s))
    assert ("N", 0, 0, 3) in s.st.placed


def test_silhouette():
    # One export to place: only the empty slot can take it, else a cell would have no bar.
    d = grid([1, 1, 0], {"N": N | {"len": [3]}}, {"N": {"bars": [3]}}, exports={"X": 1},
             neighbor=nb([1, 1, 1], imp=False))
    s = solver(d)
    assert len(s.st.scen) == 3
    s.r_silhouette(view(s))
    assert [s.pz.scenarios[i].h for i in s.st.scen] == [(1, 1, 1)]


def test_swap_closes_on_counts():
    # Two stacked cells, one TAC and one import: the order is free, the composition is known.
    d = grid([2, 0], {"T": T}, {"T": {"cells": 1}}, imports={"X": 1}, neighbor=nb([1, 1], exp=False) | {"cap": 2})
    res = deduce.Solver(deduce.Puzzle(d)).run()
    assert res.solved and "swap" in res.techniques()
    assert res.composition["counts"] == {"T": [1, 0], "I": [1, 0]}


def test_top_price():
    d = grid([1, 2, 2], {"N": N | {"len": [3]}, "G": G, "T": T}, {"N": {}, "G": {}, "T": {}},
             [{"type": "price", "col": 0, "value": 2}])
    s = solver(d)
    s.r_top_price(view(s))
    assert ("N", 0, 0, 3) not in s.st.cands and ("T", 0, 0, 1) not in s.st.cands
    assert ("G", 0, 0, 2) in s.st.cands


def test_ribbon():
    d = grid([1, 1, 1, 1], {"G": G}, {"G": {}})
    s = solver(d)
    s.r_ribbon(view(s))
    assert s.st.cands == {("G", 0, 0, 2), ("G", 0, 2, 2)} == s.st.placed


def test_just_enough():
    d = grid([1, 1], {"N": N | {"len": [2]}, "T": T}, {"N": {}, "T": {"cells": 2}})
    s = solver(d)
    s.r_just_enough(view(s))
    assert ("N", 0, 0, 2) not in s.st.cands


def test_column_sum():
    # 0h: the line takes one import at most and (1, 0) can only be an import: (0, 0) is nuclear.
    d = grid([2, 1, 1], {"N": N | {"len": [3]}}, {"N": {}}, imports={"X": 2}, neighbor=nb([1, 1, 1], exp=False))
    s = solver(d)
    for rule in (s.r_exhausted, s.r_silhouette, s.r_just_enough):
        assert not rule(view(s))
    s.r_column_sum(view(s))
    assert ("I", 0, 0, 1) not in s.st.cands


def test_carbon():
    d = grid([1, 1], {"N": N | {"len": [2]}, "T": T}, {"N": {}, "T": {}}, co2_cap=1)
    s = solver(d)
    s.r_carbon(view(s))
    assert not [b for b in s.st.cands if b[0] == "T"]


def test_share_out():
    # Row 2 (length 6) is N3+N3 or G2+G2+G2; row 1 (length 7) holds one N3 and two G2, in any order, so
    # no cell is known yet. With a single N3 in the inventory, row 2 cannot be N3+N3: it is G2+G2+G2.
    # The 0h record then puts the N3 at the start of row 1.
    d = grid([2, 2, 2, 2, 2, 2, 1], {"N": N | {"len": [3]}, "G": G | {"len": [2]}},
             {"N": {"bars": [3]}, "G": {"bars": [2, 2, 2, 2, 2]}}, [{"type": "column", "col": 0, "counts": {"N": 1}}])
    s = solver(d)
    while any(rule(view(s)) for _level, rule in s.rules if _level <= 2):
        pass
    assert [b for b in s.st.cands if b[1] == 1 and b[0] == "N"]  # levels 1-2 keep N3+N3 on row 2
    s.r_share_out(view(s))
    assert not [b for b in s.st.cands if b[1] == 1 and b[0] == "N"]
    res = deduce.Solver(deduce.Puzzle(d)).run()
    assert res.solved and res.rating == 3


# ----- generated grids -----

def drawn(seed, level, cols=6, **kw):
    p = GenParams(cols=cols, hmax=4, **kw)
    raw = draw_grid(random.Random(seed), p, 1)
    raw.pop("curtail_penalty", None)
    raw["objective"] = {"optimize": "min_score", "target": None, "constraints": {}}
    ref = solve_v2(raw, count_cap=1, decoys=False)
    g = from_dict(raw)
    inv = pose_inventory(g, ref["solution"], level, None)
    d = {k: v for k, v in raw.items() if k != "objective"}
    d.update(mode="pose", inventory=inv, constraints={"co2_cap": None})
    return d, g, ref


@pytest.mark.parametrize("level", ["exact", "cells", "none"])
def test_sound_against_cp(level):
    """Solved by deduction => unique for CP-SAT, with the same composition; every clue at once solves."""
    for seed in range(1, 7):
        d, g, ref = drawn(seed, level, neighbor=True)
        prices = evaluate(g, ref["solution"]).col_price
        res = deduce.deduce(d, prices=prices)
        cnt = pose.count_pose(d, prices, cap=2)
        if res.solved:
            assert cnt.count == 1
            comp = cnt.compositions[0]
            assert {p: v for p, v in comp["counts"].items()} == res.composition["counts"]
        pool = clue_pool(g, d["inventory"], ref["solution"], prices, LORE)
        assert deduce.deduce(d, lore=pool, prices=[]).solved


UNIQUE_BUT_GUESS = grid([2, 4, 4, 4, 2, 3], {"N": N, "G": G, "T": T}, {"N": {"cells": 15}},
                        exports={"X": 1}, imports={"X": 5},
                        neighbor={"price": [-1, -2, -2, -2, 5, -1], "cap": 1, "export_budget": 2,
                                  "import": True, "export": True})


def test_unique_but_not_deducible_is_rejected():
    assert pose.count_pose(UNIQUE_BUT_GUESS, cap=2).count == 1
    res = deduce.deduce(UNIQUE_BUT_GUESS)
    assert res.status == "stuck" and res.unresolved > 0
    assert lore_clues(UNIQUE_BUT_GUESS, []) is None  # no clue to add: not publishable
    assert pose.solve_pose(UNIQUE_BUT_GUESS)["difficulty"]["rating"] is None


@pytest.mark.parametrize("level", ["exact", "cells", "none"])
def test_lore_clues_minimal(level):
    grids, stats = generate(GenParams(cols=6, hmax=4, neighbor=True, count=2, seed=4, mode="pose",
                                      level=level, clue_types=LORE, max_attempts=40))
    assert len(grids) == 2, stats
    for g in grids:
        clues = g["clues"]
        assert pose.count_pose(g, cap=2).count == 1
        res = deduce.deduce(g)
        assert res.solved and res.rating == g["difficulty"]["rating"]
        for i in range(len(clues)):
            fewer = clues[:i] + clues[i + 1:]
            assert not deduce.deduce(g, lore=fewer).solved, (level, clues[i])
        assert evaluate(pose.normalize(g)[0], g["solution"]).complete
        assert all(c["text"] for c in clues)


def test_rating_target():
    grids, stats = generate(GenParams(cols=6, hmax=4, neighbor=True, count=2, seed=2, mode="pose",
                                      level="none", clue_types=LORE, rating=2, max_attempts=40))
    assert grids, stats
    assert all(g["difficulty"]["rating"] == 2 for g in grids)


def test_expert_needs_refutation():
    grids, stats = generate(GenParams(cols=8, neighbor=True, step=1, count=1, seed=3, mode="pose",
                                      level="none", clue_types=LORE, rating=4, max_attempts=20))
    assert grids, stats
    g = grids[0]
    assert not deduce.deduce(g, max_level=3).solved
    assert deduce.deduce(g).solved


def test_level_none_has_no_counts():
    d, g, ref = drawn(1, "none", neighbor=True)
    assert all(spec == {} for spec in d["inventory"]["pieces"].values())
    prices = evaluate(g, ref["solution"]).col_price
    assert pose.count_pose(d, prices, cap=10).count >= 1  # the reference pose stays allowed
    d2, *_ = drawn(1, "cells", neighbor=True)
    assert pose.count_pose(d, cap=10).count >= pose.count_pose(d2, cap=10).count


@pytest.mark.parametrize("clue", [
    {"type": "bar", "piece": "N", "col": 1, "len": 3},
    {"type": "column", "col": 0, "counts": {"T": 1}},
    {"type": "given", "piece": "N", "row": 0, "col": 0, "len": 3},
    {"type": "flow", "col": 3, "country": "X", "dir": "export", "value": 1},
])
def test_lore_clues_in_cp_model(clue):
    """Each clue type is a real constraint: compositions with it are a strict subset of those without."""
    d = grid([1, 1, 1, 0], {"N": N | {"len": [3]}, "T": T}, {"N": {}, "T": {}}, exports={"X": 1},
             neighbor=nb([1, 1, 1, 1], imp=False))
    free = pose.count_pose(d, cap=20)
    with_clue = pose.count_pose(d, cap=20, lore=[clue])
    assert 1 <= with_clue.count < free.count
    assert deduce.deduce(d, lore=[clue]).status != "contradiction"
