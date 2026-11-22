"""Checks the reference drawing of every live lab candidate (lab/candidates/*.json, archive excluded).

- Each candidate has a drawing (non-empty `solution.placements`) and passes the grid validator, ramps allowed.
- The validator checks the drawing (GAME-DESIGN.md §14): straight shapes off the weather, no two placements on
  the same cell, and weather + placements cover exactly demand + exports + pumps - turbines in each column.

Run: solver/.venv/bin/python -m pytest lab/tests/test_candidate_drawings.py -q
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from dispatch_solver.grid import validate

CANDIDATES = Path(__file__).resolve().parents[1] / "candidates"


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
    assert grid["solution"]["placements"]
    assert validate(grid, allow_ramp=True) == []
