"""Weather bricks: absolute rows, no placement on a weather cell, a weather step cuts the row, surplus coverage."""

from dispatch_solver import exact
from dispatch_solver.board import Puzzle
from dispatch_solver.deduce import deduce
from dispatch_solver.generate.draft import make_draft
from dispatch_solver.grid import validate


def step_grid() -> dict:
    """Flat demand 2, one weather brick at 8h: row 0 is cut there, row 1 runs through."""
    g = make_draft([2, 2, 1, 2, 2, 2], "NG", weather_r=[0, 0, 1, 0, 0, 0])
    g["inventory"] = {"level": "exact", "pieces": {"N": {"bars": [6, 3]}, "G": {"bars": [2]}}}
    g["solution"]["placements"] = [
        {"piece": "G", "row": 0, "col": 0, "len": 2},
        {"piece": "N", "row": 1, "col": 0, "len": 6},
        {"piece": "N", "row": 0, "col": 3, "len": 3},
    ]
    return g


def test_placements_stay_above_the_weather():
    g = step_grid()
    pz = Puzzle(g)
    for pl in pz.placements:
        for r, c in pl.cells:
            assert pz.w[c] <= r < pz.w[c] + pz.maxh[c]
    assert pz.find("N", 0, 0, 6) is None  # would cover the brick at 8h
    i = pz.find("N", 1, 0, 6)
    assert i is not None
    assert "row 2" in pz.placements[i].label(g["columns"])  # traces name the absolute row


def test_a_step_cuts_the_row():
    g = step_grid()
    assert validate(g) == []
    ex = exact.count(g)
    assert ex.unique
    assert {"piece": "N", "row": 1, "col": 0, "len": 6} in ex.solution["placements"]
    res = deduce(g)
    assert res.solved and res.composition == ex.composition


def test_validator_refuses_a_bar_on_a_brick():
    g = step_grid()
    g["solution"]["placements"][1]["row"] = 0
    g["clues"].append({"type": "engaged", "piece": "N", "row": 0, "col": 1, "len": 3})
    assert validate(g) == [
        "clues[0]: covers a weather cell at 8h",
        "solution.placements[1]: covers a weather cell at 8h",
    ]


def test_validator_checks_the_drawing_over_a_surplus():
    """A brick above the demand must be covered by an export or a pump, like any cell of the drawing."""
    g = step_grid()
    g["demand"][2] = 0  # residual -1 at 8h: the brick at row 0 sticks out (lowest faulty row), the N ribbon too
    assert validate(g) == ["solution: cell above the silhouette at 8h, row 0"]
    g["solution"]["exports"] = {"DE": [0, 0, 2, 0, 0, 0]}  # two exports absorb the brick and lift the top to 2
    g["neighbors"] = [{"id": "DE", "name": "Allemagne", "cap": 2, "co2": 3}]
    assert validate(g) == []
    g["solution"]["placements"].append({"piece": "G", "row": 1, "col": 1, "len": 2})  # on the N ribbon
    assert validate(g) == ["solution.placements[3]: overlaps solution.placements[1] at 4h"]
    g["solution"]["placements"] = []
    assert validate(g) == []
