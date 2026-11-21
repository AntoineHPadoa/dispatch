"""Tests of the lab server: files, API routes, blind grid, plays, notes, promotion, generation job.

Run: solver/.venv/bin/python -m pytest lab/tests -q
"""

from __future__ import annotations

import json
import socket
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


OK_REPORT = {"valid": True, "errors": [], "compositions": 1, "deduction": "solved", "matches_reference": True}


@pytest.fixture
def lab(tmp_path):
    (tmp_path / "candidates").mkdir()
    (tmp_path / "candidates" / "t.json").write_text(json.dumps([grid(0), grid(1)]))
    grids = tmp_path / "grids.json"
    grids.write_text(json.dumps([{"id": 11, "bulletin": {"number": 213, "published": "2026-11-20"}}], indent=2, ensure_ascii=False) + "\n")
    return lab_server.Lab(tmp_path, grids, checker=lambda g: dict(OK_REPORT))


@pytest.fixture
def api(lab):
    server = lab_server.serve(lab, 0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    def call(method: str, path: str, body=None):
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        req = urllib.request.Request(base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    call.base = base
    yield call
    server.shutdown()


PLAY = {"player": "Joueur 1", "lot": "t", "index": 0, "outcome": "solved", "ms": 61000, "errors": 2, "undos": 3, "erasers": 1}


def rated(api, player="Joueur 1", index=0, felt=3):
    """Play a candidate and rate it, which reveals it to that player."""
    play = api("POST", "/api/plays", {**PLAY, "player": player, "index": index})[1]
    assert api("POST", f"/api/plays/{play['id']}/rate", {"felt": felt})[0] == 200
    return play


def test_lots_and_candidates(api):
    assert api("GET", "/api/lots")[1] == [{"lot": "t", "count": 2, "stats": None}]
    code, cands = api("GET", "/api/candidates?lot=t&creation=1")
    assert code == 200 and [c["index"] for c in cands] == [0, 1]
    c = cands[0]
    assert c["rating"] == 3 and c["family"] == "pointe_soir" and c["plays"] == 0 and not c["kept"]
    assert api("GET", "/api/candidates?lot=nope")[0] == 404
    assert api("GET", "/api/candidates?lot=../x")[0] == 400


def test_candidate_zero_is_playable_and_numbered_from_one(api):
    code, g = api("GET", "/api/grid/t/0")
    assert code == 200 and g["id"] == 900 and g["title"] == "Candidate 1"
    assert api("GET", "/api/grid/t/1")[1]["title"] == "Candidate 2"


def test_blind_grid_hides_solver_info(api):
    code, g = api("GET", "/api/grid/t/1")
    assert code == 200
    assert "lab" not in g and "bulletin" not in g and "intro" not in g
    assert g["difficulty"] == {"rating": 1, "label": "Candidate", "techniques": []}
    assert api("GET", "/api/grid/t/9")[0] == 404


def test_list_hides_solver_measures_until_the_player_rated(api):
    """B1: no rating, techniques, steps or other player's measures before the player's own rating."""
    rated(api, "Joueur 2", 0, felt=4)
    c = api("GET", "/api/candidates?lot=t&player=Joueur%201")[1][0]
    assert c["revealed"] is False
    assert c["rating"] is None and c["techniques"] == [] and c["trace_summary"] == {} and c["felt"] == {}
    assert c["plays"] == 1 and c["title"] == "Candidate 1"  # the draft title can hint at the difficulty too
    # without a player nothing is shown either
    assert api("GET", "/api/candidates?lot=t")[1][0]["rating"] is None
    # the other player's plays lose their measures, the player's own keep them
    other = api("GET", "/api/plays?lot=t&player=Joueur%201")[1][0]
    assert other["masked"] is True and "ms" not in other and "felt" not in other and "outcome" not in other
    assert "felt" not in api("GET", "/api/notes?player=Joueur%201")[1]["t:0"]
    # Joueur 2 rated it: they see everything, including their own play
    c2 = api("GET", "/api/candidates?lot=t&player=Joueur%202")[1][0]
    assert c2["revealed"] and c2["rating"] == 3 and c2["techniques"] == ["ribbon"] and c2["felt"] == {"Joueur 2": 4}
    # once Joueur 1 has rated, they see Joueur 2's rating too
    rated(api, "Joueur 1", 0, felt=2)
    c1 = api("GET", "/api/candidates?lot=t&player=Joueur%201")[1][0]
    assert c1["rating"] == 3 and c1["felt"] == {"Joueur 2": 4, "Joueur 1": 2}
    assert "ms" in api("GET", "/api/plays?lot=t&player=Joueur%201")[1][0]


def test_creation_mode_shows_everything(api):
    c = api("GET", "/api/candidates?lot=t&creation=1")[1][0]
    assert c["rating"] == 3 and c["techniques"] == ["ribbon"] and c["trace_summary"] == {"steps": 5}


def test_reveal_needs_the_players_rating(api):
    assert api("GET", "/api/reveal/t/0?player=Joueur%201")[0] == 403
    assert api("GET", "/api/reveal/t/0")[0] == 403
    rated(api, "Joueur 1", 0)
    assert api("GET", "/api/reveal/t/0?player=Joueur%202")[0] == 403
    r = api("GET", "/api/reveal/t/0?player=Joueur%201")[1]
    assert r["difficulty"]["rating"] == 3 and r["lab"]["family"] == "pointe_soir"
    assert api("GET", "/api/reveal/t/1?creation=1")[0] == 200


def test_bulletin_route_is_not_gated(api):
    assert api("GET", "/api/bulletin/t/0")[1]["title"] == "Pointe"


def test_plays_are_appended_and_counted(api, lab):
    code, saved = api("POST", "/api/plays", PLAY)
    assert code == 200 and saved["ms"] == 61000 and saved["resets"] == 0
    api("POST", "/api/plays", {**PLAY, "player": "Joueur 2", "outcome": "abandoned", "ms": 5000})
    lines = (lab.dir / "plays.jsonl").read_text().splitlines()
    assert len(lines) == 2 and json.loads(lines[1])["outcome"] == "abandoned"
    assert api("GET", "/api/candidates?lot=t")[1][0]["plays"] == 2
    assert len(api("GET", "/api/plays?lot=t&creation=1")[1]) == 2


def test_play_lines_carry_hash_attempt_start_and_schema(api, lab):
    first = api("POST", "/api/plays", {**PLAY, "started": 1700000000, "wall_ms": 70000})[1]
    second = api("POST", "/api/plays", PLAY)[1]
    other = api("POST", "/api/plays", {**PLAY, "player": "Joueur 2"})[1]
    assert first["schema"] == 1 and first["started"] == 1700000000 and first["wall_ms"] == 70000
    assert (first["attempt"], second["attempt"], other["attempt"]) == (1, 2, 1)
    assert first["grid_hash"] == second["grid_hash"] and len(first["grid_hash"]) == 40
    assert first["id"] != second["id"] and first["felt"] is None
    # the hash ignores the lab block and changes with the grid
    g = grid(0)
    g["lab"]["family"] = "other"
    assert lab_server.Lab.grid_hash(g) == first["grid_hash"]
    g["demand"] = [9, 9, 9, 9]
    assert lab_server.Lab.grid_hash(g) != first["grid_hash"]


def test_a_stray_open_is_not_an_attempt(api):
    """Review S8 B C10: an abandon without any move, or within 10 s, leaves the real first game at attempt 1."""
    stray = api("POST", "/api/plays", {**PLAY, "outcome": "abandoned", "ms": 3000, "moves": 0, "reason": "unload"})[1]
    idle = api("POST", "/api/plays", {**PLAY, "outcome": "abandoned", "ms": 90000, "moves": 0})[1]
    real = api("POST", "/api/plays", {**PLAY, "moves": 12})[1]
    replay = api("POST", "/api/plays", {**PLAY, "moves": 9})[1]
    assert stray["phantom"] and idle["phantom"] and not real["phantom"]
    assert (real["attempt"], replay["attempt"]) == (1, 2)
    quick = api("POST", "/api/plays", {**PLAY, "player": "Joueur 2", "outcome": "abandoned", "ms": 4000})[1]
    assert quick["phantom"]  # a legacy record without moves: only the time decides


def test_wall_time_cannot_be_below_active_time(api):
    assert api("POST", "/api/plays", {**PLAY, "ms": 5000, "wall_ms": 100})[0] == 400


@pytest.mark.parametrize("patch", [
    {"player": "Nobody"}, {"outcome": "won"}, {"ms": -1}, {"errors": "2"}, {"index": 99}, {"undos": True}, {"started": -3},
])
def test_invalid_plays_are_rejected(api, patch):
    assert api("POST", "/api/plays", {**PLAY, **patch})[0] in (400, 404)


def test_felt_is_stored_with_the_play_and_locked(api, lab):
    """C3 + C4: the rating lives in the play line; a second rating is refused."""
    play = api("POST", "/api/plays", PLAY)[1]
    code, done = api("POST", f"/api/plays/{play['id']}/rate", {"felt": 3, "comment": "ok"})
    assert code == 200 and done["felt"] == 3
    assert json.loads((lab.dir / "plays.jsonl").read_text().splitlines()[0])["felt"] == 3
    assert api("POST", f"/api/plays/{play['id']}/rate", {"felt": 1})[0] == 409
    assert lab.notes()["t:0"] == {"felt": {"Joueur 1": 3}, "comment": "ok"}
    # a later play of the same candidate keeps its own rating, the notes keep the first
    again = api("POST", "/api/plays", PLAY)[1]
    api("POST", f"/api/plays/{again['id']}/rate", {"felt": 4})
    assert lab.notes()["t:0"]["felt"] == {"Joueur 1": 3}
    assert [p["felt"] for p in lab.plays()] == [3, 4]
    assert api("POST", "/api/plays/nope/rate", {"felt": 2})[0] == 404
    assert api("POST", f"/api/plays/{again['id']}/rate", {"felt": 9})[0] in (400, 409)


def test_notes_keep_and_comment(api):
    code, note = api("PUT", "/api/notes/t/0", {"kept": True, "comment": "ok"})
    assert code == 200 and note == {"kept": True, "comment": "ok"}
    cand = api("GET", "/api/candidates?lot=t")[1][0]
    assert cand["kept"]
    assert api("PUT", "/api/notes/t/0", {"bulletin": {"weather": ["rain"]}})[0] == 400


def test_bulletin_edits_override_the_draft(api):
    assert api("GET", "/api/bulletin/t/0")[1]["title"] == "Pointe"
    api("PUT", "/api/notes/t/0", {"bulletin": {"title": "Soir de pointe"}})
    b = api("GET", "/api/bulletin/t/0")[1]
    assert b["title"] == "Soir de pointe" and b["text"] == "Texte."


def test_suggest_follows_published_grids(api):
    assert api("GET", "/api/suggest")[1] == {"id": 12, "number": 214, "published": "2026-11-21"}


def test_promotion_strips_lab_and_appends(api, lab):
    api("PUT", "/api/notes/t/0", {"bulletin": {"title": "Soir de pointe"}})
    code, res = api("POST", "/api/promote", {"lot": "t", "index": 0, "number": 214, "published": "2026-11-21"})
    assert code == 200 and res == {"id": 12, "number": 214, "published": "2026-11-21"}
    grids = json.loads(lab.grids_path.read_text())
    new = grids[-1]
    assert "lab" not in new and new["id"] == 12 and new["section"] == "rated"
    assert new["title"] == "Soir de pointe"  # M7: the grid title follows the bulletin title
    assert new["bulletin"] == {"number": 214, "title": "Soir de pointe", "text": "Texte.",
                               "weather": ["moon", "sun", "sun", "cloud"], "published": "2026-11-21"}
    assert api("GET", "/api/candidates?lot=t")[1][0]["promoted"]["id"] == 12
    # a second promotion of the same candidate is refused
    assert api("POST", "/api/promote", {"lot": "t", "index": 0, "number": 215, "published": "2026-11-22"})[0] == 409
    # M4: the bulletin of a promoted candidate can no longer be edited
    assert api("PUT", "/api/notes/t/0", {"bulletin": {"title": "x"}})[0] == 409


def test_promotion_keeps_the_indentation_of_grids_json(api, lab):
    """C5: grids.json is written with indent 2, so the diff only adds the new grid."""
    before = lab.grids_path.read_text()
    assert json.dumps(json.loads(before), ensure_ascii=False, indent=2) + "\n" == before
    api("POST", "/api/promote", {"lot": "t", "index": 0, "number": 214, "published": "2026-11-21"})
    after = lab.grids_path.read_text()
    assert json.dumps(json.loads(after), ensure_ascii=False, indent=2) + "\n" == after
    old_lines, new_lines = before.splitlines(), after.splitlines()
    assert new_lines[:len(old_lines) - 2] == old_lines[:-2]  # existing grids untouched, only the closing bracket moves


@pytest.mark.parametrize("body,code", [
    ({"number": 213, "published": "2026-11-21"}, 409),   # number already used
    ({"number": 214, "published": "2026-11-20"}, 409),   # date already taken
    ({"number": 212, "published": "2026-11-22"}, 409),   # older number, later date
    ({"number": 214, "published": "21/11/2026"}, 400),   # bad date
    ({"number": 214, "published": "2026-11-21", "id": 11}, 409),  # id already used
    ({"number": 214, "published": "2026-11-21", "id": "12"}, 400),  # id not an integer
])
def test_promotion_refusals_leave_files_untouched(api, lab, body, code):
    before = lab.grids_path.read_text()
    assert api("POST", "/api/promote", {"lot": "t", "index": 1, **body})[0] == code
    assert lab.grids_path.read_text() == before
    assert not lab.notes()


def test_promotion_needs_a_valid_unique_grid(tmp_path):
    (tmp_path / "candidates").mkdir()
    (tmp_path / "candidates" / "t.json").write_text(json.dumps([grid(0)]))
    grids = tmp_path / "grids.json"
    grids.write_text("[]")
    bad = lab_server.Lab(tmp_path, grids, checker=lambda g: {"valid": False, "errors": ["boom"]})
    with pytest.raises(lab_server.LabError, match="boom"):
        bad.promote("t", 0, 1, "2026-11-21")
    two = lab_server.Lab(tmp_path, grids, checker=lambda g: {**OK_REPORT, "compositions": 2})
    with pytest.raises(lab_server.LabError) as e:
        two.promote("t", 0, 1, "2026-11-21")
    assert e.value.status == 422 and grids.read_text() == "[]"


@pytest.mark.parametrize("report", [{**OK_REPORT, "matches_reference": False}, {k: v for k, v in OK_REPORT.items() if k != "matches_reference"}])
def test_promotion_needs_the_reference_solution_to_match(tmp_path, report):
    """C9: the CI check (check_published) also requires matches_reference."""
    (tmp_path / "candidates").mkdir()
    (tmp_path / "candidates" / "t.json").write_text(json.dumps([grid(0)]))
    grids = tmp_path / "grids.json"
    grids.write_text("[]")
    lab = lab_server.Lab(tmp_path, grids, checker=lambda g: dict(report))
    with pytest.raises(lab_server.LabError) as e:
        lab.promote("t", 0, 1, "2026-11-21")
    assert e.value.status == 422 and "matches_reference" in str(e.value) and grids.read_text() == "[]"


def wait(lab, job):
    for _ in range(200):
        if lab.job(job["id"])["status"] != "running":
            break
        time.sleep(0.02)
    return lab.job(job["id"])


def test_generation_job(tmp_path):
    (tmp_path / "candidates").mkdir()

    def runner(lot_path, out_dir, log):
        log("tirage 1")
        (out_dir / "g.json").write_text("[]")
        return 0

    lab = lab_server.Lab(tmp_path, tmp_path / "grids.json", runner=runner)
    done = wait(lab, lab.start_generation({"lot": "g", "size": 3, "seed": 1, "mix": []}))
    assert done["status"] == "done" and done["log"] == ["tirage 1"]
    assert json.loads((tmp_path / "lots" / "g.json").read_text())["size"] == 3
    assert [x["lot"] for x in lab.lots()] == ["g"]
    with pytest.raises(lab_server.LabError):
        lab.start_generation({"lot": "../bad", "size": 3})
    with pytest.raises(lab_server.LabError):
        lab.start_generation({"lot": "ok", "size": 0})


def test_an_existing_lot_is_never_overwritten(tmp_path):
    """C3: plays and notes point to lot:index, so a lot name cannot be reused."""
    (tmp_path / "candidates").mkdir()
    (tmp_path / "candidates" / "t.json").write_text(json.dumps([grid(0)]))
    lab = lab_server.Lab(tmp_path, tmp_path / "grids.json", runner=lambda *_: 0)
    with pytest.raises(lab_server.LabError) as e:
        lab.start_generation({"lot": "t", "size": 3})
    assert e.value.status == 409
    assert json.loads((tmp_path / "candidates" / "t.json").read_text())[0]["id"] == 900


def test_failed_generation_is_reported(tmp_path):
    lab = lab_server.Lab(tmp_path, tmp_path / "grids.json", runner=lambda *_: 1)
    assert wait(lab, lab.start_generation({"lot": "g", "size": 3}))["status"] == "failed"


def test_partial_lot_is_reported_as_partial(tmp_path):
    """M8: the CLI exits 1 on a partial lot but writes the candidates it found."""
    def runner(lot_path, out_dir, log):
        (out_dir / "g.json").write_text(json.dumps([grid(0), grid(1)]))
        return 1

    lab = lab_server.Lab(tmp_path, tmp_path / "grids.json", runner=runner)
    done = wait(lab, lab.start_generation({"lot": "g", "size": 5}))
    assert done["status"] == "partial" and done["kept"] == 2 and done["size"] == 5


def test_only_unplayable_shapes_are_flagged_and_refused(tmp_path):
    trap = grid(0)
    trap["lab"]["mechanics"] = ["neighbors:1", "ramp:trap"]
    trap["pieces"] = {"C": {"len": [3], "shape": "trap"}, "N": {"len": [2], "height": [1]}}
    stair = grid(2)
    stair["pieces"] = {"C": {"len": [3], "shape": "stair"}, "N": {"len": [2], "height": [1]}}
    (tmp_path / "candidates").mkdir()
    (tmp_path / "candidates" / "t.json").write_text(json.dumps([trap, grid(1), stair]))
    grids = tmp_path / "grids.json"
    grids.write_text("[]")
    lab = lab_server.Lab(tmp_path, grids, checker=lambda x: dict(OK_REPORT))
    # The web game plays trapezoid ramps, not staircases.
    assert [c["playable"] for c in lab.candidates("t", creation=True)] == [True, True, False]
    with pytest.raises(lab_server.LabError) as e:
        lab.blind_grid("t", 2)
    assert e.value.status == 422
    with pytest.raises(lab_server.LabError):
        lab.promote("t", 2, 1, "2026-11-21")
    assert grids.read_text() == "[]"


@pytest.mark.parametrize("method,path,body", [
    ("PUT", "/api/notes/t/0", {"bulletin": "x"}),
    ("PUT", "/api/notes/t/0", {"bulletin": {"weather": 3}}),
    ("POST", "/api/plays/zzz/rate", {"felt": {"a": 1}}),
    ("POST", "/api/promote", {"lot": "t", "index": 0, "number": 214, "published": "2026-11-21", "id": [1]}),
    ("POST", "/api/plays", {**PLAY, "ms": None}),
])
def test_malformed_bodies_get_a_400_not_a_dropped_connection(api, method, path, body):
    """M1: wrong types answer 4xx with a JSON error."""
    code, data = api(method, path, body)
    assert 400 <= code < 500 and "error" in data


def raw(api, method, path, headers, body=b""):
    """HTTP request with explicit headers; returns the status."""
    port = int(api.base.rsplit(":", 1)[1])
    lines = [f"{method} {path} HTTP/1.1"] + [f"{k}: {v}" for k, v in headers.items()] + [f"Content-Length: {len(body)}", "Connection: close", "", ""]
    with socket.create_connection(("127.0.0.1", port)) as s:
        s.sendall("\r\n".join(lines).encode() + body)
        data = b""
        while chunk := s.recv(4096):
            data += chunk
    return int(data.split(b" ", 2)[1])


def test_writes_must_be_json_from_a_local_origin(api, lab):
    """C6: text/plain forms and foreign origins cannot write; foreign Host (DNS rebinding) cannot read."""
    host = api.base.removeprefix("http://")
    body = json.dumps(PLAY).encode()
    ok = {"Host": host, "Content-Type": "application/json"}
    assert raw(api, "POST", "/api/plays", {**ok, "Content-Type": "text/plain", "Origin": "https://evil.example"}, body) == 403
    assert raw(api, "POST", "/api/plays", {**ok, "Content-Type": "text/plain"}, body) == 415
    assert raw(api, "POST", "/api/plays", {**ok, "Origin": "https://evil.example"}, body) == 403
    assert raw(api, "PUT", "/api/notes/t/0", {**ok, "Content-Type": "text/plain"}, b"{}") == 415
    assert raw(api, "GET", "/api/lots", {"Host": "evil.example"}) == 403
    assert raw(api, "GET", "/api/lots", {"Host": host, "Origin": "http://evil.example"}) == 403
    assert not (lab.dir / "plays.jsonl").exists()
    assert raw(api, "POST", "/api/plays", {**ok, "Origin": "http://localhost:5173", "Host": "localhost:5173"}, body) == 200
    assert raw(api, "GET", "/api/lots", {"Host": "127.0.0.1:5173"}) == 200
