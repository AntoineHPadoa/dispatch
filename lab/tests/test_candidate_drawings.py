"""Replays the reference drawing of every live lab candidate (lab/candidates/*.json, archive excluded).

- No placement cell on a weather brick, no two placements on the same cell, no hole, nothing above the top.
- Top of column c = demand + exports + pumps - turbines: the drawing covers exactly the cells from the weather up.
- Shapes as in §3/§14: rectangle `len` x `height`; ramp `trap` 1-2-1 and `stair` 2-1; an import is one cell.

Run: solver/.venv/bin/python -m pytest lab/tests/test_candidate_drawings.py -q
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

CANDIDATES = Path(__file__).resolve().parents[1] / "candidates"


def placement_cells(p: dict, pieces: dict) -> list[tuple[int, int]]:
    """(row, col) cells of one placement, rows counted from the bottom of the grid."""
    r, c, w = p["row"], p["col"], p.get("len", 1)
    shape = pieces.get(p["piece"], {}).get("shape", "rect")
    if shape == "trap":
        spans = [1] + [2] * (w - 2) + [1]
    elif shape == "stair":
        spans = [2] * (w - 1) + [1]
    else:
        spans = [p.get("height", 1)] * w
    return [(r + k, c + dc) for dc, h in enumerate(spans) for k in range(h)]


def drawing_errors(g: dict) -> list[str]:
    n = len(g["columns"])
    sol = g["solution"]
    weather = [g["weather"]["R"][c] + g["weather"]["F"][c] for c in range(n)]
    top = list(g["demand"])
    for e in sol.get("exports", {}).values():
        for c in range(n):
            top[c] += e[c]
    for pair in sol.get("step", []):
        top[pair["pump"]] += 1
        top[pair["turbine"]] -= 1
    owner: dict[tuple[int, int], str] = {(r, c): "weather" for c in range(n) for r in range(weather[c])}
    errors = []
    for k, p in enumerate(sol["placements"]):
        for rc in placement_cells(p, g["pieces"]):
            if not 0 <= rc[1] < n:
                errors.append(f"placements[{k}] {p['piece']} out of the grid at {rc}")
            elif rc in owner:
                errors.append(f"placements[{k}] {p['piece']} on {owner[rc]} at {rc}")
            owner[rc] = f"placements[{k}] {p['piece']}"
    for c in range(n):
        if weather[c] > top[c]:
            errors.append(f"weather above the top at column {c}")
        height = max([top[c], weather[c]] + [r + 1 for r, cc in owner if cc == c])
        for r in range(height):
            if r < top[c] and (r, c) not in owner:
                errors.append(f"hole at {(r, c)}")
            elif r >= top[c] and (r, c) in owner:
                errors.append(f"{owner[(r, c)]} above the top at {(r, c)}")
    return errors


def live_candidates() -> list[tuple[str, int, dict]]:
    out = []
    for f in sorted(CANDIDATES.glob("*.json")):  # not recursive: archive/ is left out
        if f.name.endswith((".stats.json", ".blocked.json")):
            continue
        out += [(f.stem, i, g) for i, g in enumerate(json.loads(f.read_text()))]
    return out


CASES = live_candidates()


def test_there_are_live_candidates():
    assert CASES


@pytest.mark.parametrize("lot,index,grid", CASES, ids=[f"{lot}:{i}" for lot, i, _ in CASES])
def test_reference_drawing_is_legal(lot, index, grid):
    assert drawing_errors(grid) == []


def test_checker_catches_overlap_hole_and_weather():
    g = {"columns": ["0h", "12h"], "demand": [2, 2], "weather": {"R": [0, 0], "F": [1, 0]}, "pieces": {"N": {}},
         "solution": {"placements": [{"piece": "N", "row": 1, "col": 0, "len": 2}]}}
    assert drawing_errors(g) == ["hole at (0, 1)"]
    g["solution"]["placements"].append({"piece": "N", "row": 1, "col": 0, "len": 2})
    assert "placements[1] N on placements[0] N at (1, 0)" in drawing_errors(g)
    g["solution"]["placements"] = [{"piece": "N", "row": 0, "col": 0, "len": 2}, {"piece": "N", "row": 1, "col": 0, "len": 2}]
    assert "placements[0] N on weather at (0, 0)" in drawing_errors(g)
