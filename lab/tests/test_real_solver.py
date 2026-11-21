"""Lab against the real dispatch_solver output (skipped when the package is not installed).

Run: solver/.venv/bin/python -m pytest lab/tests -q
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest

pytest.importorskip("dispatch_solver")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lab_server  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "lab" / "candidates" / "demo-01.json"
PUBLISHED = ROOT / "web" / "src" / "data" / "grids.json"


@pytest.fixture
def lab(tmp_path):
    (tmp_path / "candidates").mkdir()
    shutil.copy(DEMO, tmp_path / "candidates" / "demo-01.json")
    grids = tmp_path / "grids.json"
    shutil.copy(PUBLISHED, grids)
    return lab_server.Lab(tmp_path, grids)


def test_generated_lot_indices_start_at_zero_and_ids_follow(lab):
    grids = json.loads((lab.dir / "candidates" / "demo-01.json").read_text())
    assert [g["lab"]["index"] for g in grids] == list(range(len(grids)))
    assert all(g["id"] == g["lab"]["index"] + 1 for g in grids)
    assert [c["index"] for c in lab.candidates("demo-01", creation=True)] == list(range(len(grids)))


def test_real_ramp_grids_are_flagged(lab):
    cands = lab.candidates("demo-01", creation=True)
    ramps = [c for c in cands if any(m.startswith("ramp") for m in c["mechanics"])]
    assert ramps and all(not c["playable"] for c in ramps)
    assert all(c["playable"] for c in cands if c not in ramps)
    with pytest.raises(lab_server.LabError) as e:
        lab.blind_grid("demo-01", ramps[0]["index"])
    assert e.value.status == 422


def test_real_check_grid_reports_what_promotion_needs():
    published = json.loads(PUBLISHED.read_text())
    report = lab_server.default_checker(published[-1])
    assert report["valid"] and report["compositions"] == 1
    assert report["deduction"] == "solved" and report["matches_reference"] is True


def test_real_candidate_is_promotable_then_refused_twice(lab):
    cand = next(c for c in lab.candidates("demo-01", creation=True) if c["playable"])
    res = lab.promote("demo-01", cand["index"], 900, "2030-01-01")
    published = json.loads(lab.grids_path.read_text())
    assert published[-1]["id"] == res["id"] and "lab" not in published[-1]
    with pytest.raises(lab_server.LabError) as e:
        lab.promote("demo-01", cand["index"], 901, "2030-01-02")
    assert e.value.status == 409
