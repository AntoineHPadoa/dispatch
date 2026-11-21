"""Tests of the lab server: files, API routes, blind grid, plays, notes, promotion, generation job.

Run: solver/.venv/bin/python -m pytest lab/tests -q
"""

from __future__ import annotations

import json
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lab_server  # noqa: E402


def grid(index: int) -> dict:
    return {
        "id": 900 + index, "title": "Pointe du soir", "section": "rated", "columns": ["0h", "6h", "12h", "18h"],
        "demand": [2, 3, 2, 4], "clues": [{"type": "price", "col": 0, "piece": "N"}],
        "difficulty": {"rating": 3, "label": "Difficile", "techniques": ["ribbon"]}, "intro": "secret",
        "lab": {"lot": "t", "index": index, "family": "pointe_soir", "mechanics": ["step"],
                "clue_profile": ["price"], "trace_summary": {"steps": 5},
                "bulletin": {"title": "Pointe", "text": "Texte.", "weather": ["moon", "sun", "sun", "cloud"]}},
    }


OK_REPORT = {"valid": True, "errors": [], "compositions": 1, "deduction": "solved"}


@pytest.fixture
def lab(tmp_path):
    (tmp_path / "candidates").mkdir()
    (tmp_path / "candidates" / "t.json").write_text(json.dumps([grid(1), grid(2)]))
    grids = tmp_path / "grids.json"
    grids.write_text(json.dumps([{"id": 11, "bulletin": {"number": 213, "published": "2026-11-20"}}]))
    return lab_server.Lab(tmp_path, grids, checker=lambda g: dict(OK_REPORT))


@pytest.fixture
def api(lab):
    server = lab_server.serve(lab, 0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    def call(method: str, path: str, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(base + path, data=data, method=method)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    yield call
    server.shutdown()


def test_lots_and_candidates(api):
    assert api("GET", "/api/lots")[1] == [{"lot": "t", "count": 2, "stats": None}]
    code, cands = api("GET", "/api/candidates?lot=t")
    assert code == 200 and [c["index"] for c in cands] == [1, 2]
    c = cands[0]
    assert c["rating"] == 3 and c["family"] == "pointe_soir" and c["plays"] == 0 and not c["kept"]
    assert api("GET", "/api/candidates?lot=nope")[0] == 404
    assert api("GET", "/api/candidates?lot=../x")[0] == 400


def test_blind_grid_hides_solver_info(api):
    code, g = api("GET", "/api/grid/t/2")
    assert code == 200
    assert "lab" not in g and "bulletin" not in g and "intro" not in g
    assert g["difficulty"] == {"rating": 1, "label": "Candidate", "techniques": []}
    assert g["id"] == 2 and g["title"] == "Candidate 2"
    assert api("GET", "/api/grid/t/9")[0] == 404
    # the reveal route gives the measures
    r = api("GET", "/api/reveal/t/2")[1]
    assert r["difficulty"]["rating"] == 3 and r["lab"]["family"] == "pointe_soir"


def test_plays_are_appended_and_counted(api, lab):
    play = {"player": "Joueur 1", "lot": "t", "index": 1, "outcome": "solved", "ms": 61000, "errors": 2, "undos": 3, "erasers": 1}
    code, saved = api("POST", "/api/plays", play)
    assert code == 200 and saved["ms"] == 61000 and saved["resets"] == 0
    api("POST", "/api/plays", {**play, "player": "Joueur 2", "outcome": "abandoned", "ms": 5000})
    lines = (lab.dir / "plays.jsonl").read_text().splitlines()
    assert len(lines) == 2 and json.loads(lines[1])["outcome"] == "abandoned"
    assert api("GET", "/api/candidates?lot=t")[1][0]["plays"] == 2
    assert len(api("GET", "/api/plays?lot=t")[1]) == 2


@pytest.mark.parametrize("patch", [
    {"player": "Nobody"}, {"outcome": "won"}, {"ms": -1}, {"errors": "2"}, {"index": 99}, {"undos": True},
])
def test_invalid_plays_are_rejected(api, patch):
    play = {"player": "Joueur 1", "lot": "t", "index": 1, "outcome": "solved", "ms": 1, **patch}
    assert api("POST", "/api/plays", play)[0] in (400, 404)


def test_notes_keep_felt_and_comment(api):
    code, note = api("PUT", "/api/notes/t/1", {"kept": True, "felt": {"Joueur 1": 3}, "comment": "ok"})
    assert code == 200 and note == {"kept": True, "felt": {"Joueur 1": 3}, "comment": "ok"}
    api("PUT", "/api/notes/t/1", {"felt": {"Joueur 2": 2}})
    cand = api("GET", "/api/candidates?lot=t")[1][0]
    assert cand["kept"] and cand["felt"] == {"Joueur 1": 3, "Joueur 2": 2}
    assert api("PUT", "/api/notes/t/1", {"felt": {"Joueur 1": 7}})[0] == 400
    assert api("PUT", "/api/notes/t/1", {"bulletin": {"weather": ["rain"]}})[0] == 400


def test_bulletin_edits_override_the_draft(api):
    assert api("GET", "/api/reveal/t/1")[1]["bulletin"]["title"] == "Pointe"
    api("PUT", "/api/notes/t/1", {"bulletin": {"title": "Soir de pointe"}})
    b = api("GET", "/api/reveal/t/1")[1]["bulletin"]
    assert b["title"] == "Soir de pointe" and b["text"] == "Texte."


def test_suggest_follows_published_grids(api):
    assert api("GET", "/api/suggest")[1] == {"id": 12, "number": 214, "published": "2026-11-21"}


def test_promotion_strips_lab_and_appends(api, lab):
    api("PUT", "/api/notes/t/1", {"bulletin": {"title": "Soir de pointe"}})
    code, res = api("POST", "/api/promote", {"lot": "t", "index": 1, "number": 214, "published": "2026-11-21"})
    assert code == 200 and res == {"id": 12, "number": 214, "published": "2026-11-21"}
    grids = json.loads(lab.grids_path.read_text())
    new = grids[-1]
    assert "lab" not in new and new["id"] == 12 and new["section"] == "rated"
    assert new["bulletin"] == {"number": 214, "title": "Soir de pointe", "text": "Texte.",
                               "weather": ["moon", "sun", "sun", "cloud"], "published": "2026-11-21"}
    assert api("GET", "/api/candidates?lot=t")[1][0]["promoted"]["id"] == 12
    # a second promotion of the same candidate is refused
    assert api("POST", "/api/promote", {"lot": "t", "index": 1, "number": 215, "published": "2026-11-22"})[0] == 409


@pytest.mark.parametrize("body,code", [
    ({"number": 213, "published": "2026-11-21"}, 409),   # number already used
    ({"number": 214, "published": "21/11/2026"}, 400),   # bad date
    ({"number": 214, "published": "2026-11-21", "id": 11}, 409),  # id already used
])
def test_promotion_refusals_leave_files_untouched(api, lab, body, code):
    before = lab.grids_path.read_text()
    assert api("POST", "/api/promote", {"lot": "t", "index": 2, **body})[0] == code
    assert lab.grids_path.read_text() == before
    assert not lab.notes()


def test_promotion_needs_a_valid_unique_grid(tmp_path):
    (tmp_path / "candidates").mkdir()
    (tmp_path / "candidates" / "t.json").write_text(json.dumps([grid(1)]))
    grids = tmp_path / "grids.json"
    grids.write_text("[]")
    bad = lab_server.Lab(tmp_path, grids, checker=lambda g: {"valid": False, "errors": ["boom"]})
    with pytest.raises(lab_server.LabError, match="boom"):
        bad.promote("t", 1, 1, "2026-11-21")
    two = lab_server.Lab(tmp_path, grids, checker=lambda g: {"valid": True, "compositions": 2, "deduction": "solved"})
    with pytest.raises(lab_server.LabError) as e:
        two.promote("t", 1, 1, "2026-11-21")
    assert e.value.status == 422 and grids.read_text() == "[]"


def test_generation_job(tmp_path):
    (tmp_path / "candidates").mkdir()

    def runner(lot_path, out_dir, log):
        log("tirage 1")
        (out_dir / "g.json").write_text("[]")
        return 0

    lab = lab_server.Lab(tmp_path, tmp_path / "grids.json", runner=runner)
    job = lab.start_generation({"lot": "g", "size": 3, "seed": 1, "mix": []})
    for _ in range(100):
        if lab.job(job["id"])["status"] != "running":
            break
        time.sleep(0.02)
    done = lab.job(job["id"])
    assert done["status"] == "done" and done["log"] == ["tirage 1"]
    assert json.loads((tmp_path / "lots" / "g.json").read_text())["size"] == 3
    assert [x["lot"] for x in lab.lots()] == ["g"]
    with pytest.raises(lab_server.LabError):
        lab.start_generation({"lot": "../bad", "size": 3})
    with pytest.raises(lab_server.LabError):
        lab.start_generation({"lot": "ok", "size": 0})


def test_failed_generation_is_reported(tmp_path):
    lab = lab_server.Lab(tmp_path, tmp_path / "grids.json", runner=lambda *_: 1)
    job = lab.start_generation({"lot": "g", "size": 3})
    for _ in range(100):
        if lab.job(job["id"])["status"] != "running":
            break
        time.sleep(0.02)
    assert lab.job(job["id"])["status"] == "failed"
