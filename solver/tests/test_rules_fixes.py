"""Deduction rules on crafted states: room against the day totals, ramp_lone and ramp_relay counts, STEP clue boards."""

import copy
import json

from conftest import FIXTURES

from dispatch_solver.board import Puzzle
from dispatch_solver.deduce import deduce
from dispatch_solver.deduce.rules import Solver
from dispatch_solver.deduce.state import View
from dispatch_solver.generate.cluesel import _Judge

# Nuclear only, one neighbor, two exports in the day (the shape of published grid 11).
EXPORTS_DAY = {
    "id": 1,
    "title": "t",
    "section": "rated",
    "columns": ["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h"],
    "demand": [1, 3, 3, 5, 6, 6, 6, 5],
    "pieces": {"N": {"len": [3, 4, 5, 6], "height": [1], "rank": 1, "co2": 0}},
    "weather": {"R": [0] * 8, "F": [0] * 8},
    "neighbors": [{"id": "DE", "name": "Allemagne", "cap": 1, "co2": 3}],
    "step": False,
    "co2_cap": None,
    "inventory": {"level": "none", "pieces": {"N": {}}},
    "clues": [
        {"type": "column", "col": 0, "counts": {"N": 1}},
        {"type": "column", "col": 2, "counts": {"N": 3}},
        {"type": "exchanges", "exports": {"DE": 2}, "imports": {"DE": 0}},
    ],
}


def test_room_checks_a_bar_against_the_day_total():
    """Review C1: a bar raising three columns needs three exports; the day publishes two."""
    res = deduce(EXPORTS_DAY)
    first = res.steps[0]
    assert first.rule == "room" and first.clues == [2] and first.scope == "day"
    assert first.removed == [{"piece": "N", "row": 6, "col": 4, "len": 3}]
    assert res.solved


def test_room_without_totals_keeps_the_bar():
    g = copy.deepcopy(EXPORTS_DAY)
    g["clues"] = g["clues"][:2]
    res = deduce(g)
    assert not any(s.rule == "room" and s.scope == "day" for s in res.steps)


def _t4() -> dict:
    return json.loads((FIXTURES / "valid-ramp-study-T4.json").read_text())["grid"]


def _solver(g: dict) -> tuple[Puzzle, Solver]:
    pz = Puzzle(g)
    s = Solver(pz)
    s.apply_clue_facts()
    return pz, s


def test_ramp_lone_skips_sure_coal_cells():
    """Review C3: a plateau whose lower cell is already sure coal adds one coal cell, not two."""
    g = _t4()
    g["clues"] = [{"type": "column", "col": 1, "counts": {"C": 2}}]
    pz, s = _solver(g)
    ramp = pz.find("C", 1, 0, 4)
    # Only coal can cover (1, 1): that cell is sure coal before any ramp is placed.
    s.st.cands -= {i for i in s.st.cands if (1, 1) in pz.placements[i].cells and pz.placements[i].key != "C"}
    v = View(pz, s.st)
    assert v.sure((1, 1)) and v.dom[(1, 1)] == frozenset("C")
    s.r_ramp_lone(v)
    assert ramp in s.st.cands


def _relay_state(starts: list[int]) -> tuple[Puzzle, Solver, int, list[int]]:
    """T4 with a record of two coal cells at 9h, no plateau over 9h, one ramp ending there."""
    g = _t4()
    g["clues"] = [{"type": "column", "col": 3, "counts": {"C": 2}}]
    pz, s = _solver(g)
    end = pz.find("C", 1, 0, 4)
    keep = {end} | {pz.find("C", r, 3, 4) for r in starts}
    s.st.cands -= {
        i for i in s.st.cands if pz.placements[i].key == "C" and pz.placements[i].cells_in(3) and i not in keep
    }
    return pz, s, end, sorted(keep - {end})


def test_ramp_relay_needs_proof():
    """Review C2: two ramps may start at 9h on two rows; the ramp ending there is not proven."""
    pz, s, end, _ = _relay_state([0, 2])
    s.r_ramp_relay(View(pz, s.st))
    assert end not in s.st.placed


def test_ramp_relay_places_both_shoulders():
    pz, s, end, (start,) = _relay_state([2])
    s.r_ramp_relay(View(pz, s.st))
    assert {end, start} <= s.st.placed


def test_ramp_relay_comes_before_share_out():
    """Review C5: same level, tried first."""
    names = [r.__name__ for _lv, r in Solver(Puzzle(_t4())).rules]
    assert names.index("r_ramp_relay") < names.index("r_share_out")


def test_step_count_from_a_clue_shapes_the_board():
    """Review C6: a STEP grid without inventory publishes its pairs by a clue; the board must see them."""
    g = copy.deepcopy(EXPORTS_DAY)
    g.update(
        step=True,
        neighbors=[],
        clues=[],
        solution={"exports": {}, "step": [{"pump": 0, "turbine": 3}], "placements": []},
    )
    g["inventory"] = {"level": "none", "pieces": {"N": {}}}
    bare = Puzzle(g)
    assert bare.rules.step == 0 and bare.step_options == [()]
    clued = bare.with_clues([{"type": "exchanges", "step": 1}])
    assert clued.rules.step == 1 and len(clued.step_options) > 1
    assert len(_Judge(g).pz.step_options) > 1
