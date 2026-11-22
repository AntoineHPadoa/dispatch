"""Tests of the lab sessions: list, per-player state, hold items, blind rules, safety.

Run: solver/.venv/bin/python -m pytest lab/tests/test_sessions.py -q
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_lab_server import PLAY, api, grid, lab, rated  # noqa: E402,F401  (fixtures)

SESSION = {"title": "Session T", "items": [
    {"lot": "t", "index": 1}, {"lot": "t", "index": 0, "hold": "en attente"}, {"lot": "t", "index": 5}]}


def write_session(lab, name="s1", data=None):
    (lab.dir / "sessions" / f"{name}.json").write_text(json.dumps(data or SESSION))


def test_list_sessions(api, lab):
    assert api("GET", "/api/sessions") == (200, [])
    write_session(lab)
    assert api("GET", "/api/sessions")[1] == [{"id": "s1", "title": "Session T", "count": 3}]


def test_session_items_in_order_with_number_and_hold(api, lab):
    write_session(lab)
    code, s = api("GET", "/api/session/s1?player=Joueur%201")
    assert code == 200 and s["title"] == "Session T"
    assert [(i["position"], i["lot"], i["number"], i["state"]) for i in s["items"]] == [
        (1, "t", 2, "todo"), (2, "t", 1, "todo"), (3, "t", 6, "todo")]
    assert s["items"][1]["hold"] == "en attente" and "hold" not in s["items"][0]
    assert s["items"][2]["playable"] is False  # unknown candidate: listed, not launchable


def test_state_per_player_and_phantom_ignored(api, lab):
    write_session(lab)
    api("POST", "/api/plays", {**PLAY, "index": 1, "outcome": "solved"})
    api("POST", "/api/plays", {**PLAY, "player": "Joueur 2", "index": 1, "outcome": "abandoned", "ms": 60000, "moves": 4})
    api("POST", "/api/plays", {**PLAY, "index": 0, "outcome": "abandoned", "ms": 3000, "moves": 0})  # stray open
    states = lambda p: [i["state"] for i in api("GET", f"/api/session/s1?player={p.replace(' ', '%20')}")[1]["items"]]  # noqa: E731
    assert states("Joueur 1") == ["solved", "todo", "todo"]
    assert states("Joueur 2") == ["abandoned", "todo", "todo"]
    # a solve after an abandon wins
    api("POST", "/api/plays", {**PLAY, "player": "Joueur 2", "index": 1, "outcome": "solved"})
    assert states("Joueur 2")[0] == "solved"
    assert api("GET", "/api/session/s1")[1]["items"][0]["state"] == "todo"  # no player: nothing played


def test_session_never_leaks_solver_data(api, lab):
    write_session(lab)
    rated(api, "Joueur 1", 1, felt=4)
    api("PUT", "/api/notes/t/1", {"kept": True})
    raw = json.dumps(api("GET", "/api/session/s1?player=Joueur%202&creation=1")[1])
    for secret in ("Pointe", "pointe_soir", "ribbon", "rating", "difficulty", "techniques", "felt", "comment", "title\": \"Candidate"):
        assert secret not in raw
    assert set(api("GET", "/api/session/s1?player=Joueur%201")[1]["items"][0]) == {
        "position", "lot", "index", "number", "state", "attempts", "playable"}


def test_unknown_or_unsafe_session(api):
    assert api("GET", "/api/session/nope")[0] == 404
    assert api("GET", "/api/session/..%2Fx")[0] in (400, 404)
    assert api("GET", "/api/session/a.b")[0] == 404


def test_session_routes_keep_the_host_check(api, lab):
    import urllib.request
    write_session(lab)
    req = urllib.request.Request(api.base + "/api/sessions", headers={"Host": "evil.example"})
    try:
        urllib.request.urlopen(req)
        assert False, "foreign host accepted"
    except urllib.error.HTTPError as e:
        assert e.code == 403


def test_shipped_session_matches_the_sheet():
    path = Path(__file__).resolve().parents[1] / "sessions" / "v3-session-1.json"
    data = json.loads(path.read_text())
    assert data["title"] == "Session 1" and len(data["items"]) == 16
    sheet = Path(__file__).resolve().parents[2] / "docs" / "next" / "v3-session-1.md"
    rows = [l.split("|")[1:4] for l in sheet.read_text().splitlines() if l.startswith("| ") and l.split("|")[1].strip().isdigit() and l.split("|")[3].strip().isdigit()]
    assert [(r[1].strip(), int(r[2]) - 1) for r in rows] == [(i["lot"], i["index"]) for i in data["items"]]
    assert [i["lot"] + str(i["index"]) for i in data["items"] if "hold" in i] == ["nuit-jouer-a3"]


def test_sessions_listed_newest_first(api, lab):
    import os
    for n, name in enumerate(("a", "b", "c")):
        write_session(lab, name)
        os.utime(lab.dir / "sessions" / f"{name}.json", (1000 + n, 1000 + n))
    os.utime(lab.dir / "sessions" / "a.json", (2000, 2000))
    assert [s["id"] for s in api("GET", "/api/sessions")[1]] == ["a", "c", "b"]


def test_sort_uses_the_stored_creation_time_over_the_file_time(api, lab):
    import os
    write_session(lab, "old", {**SESSION, "created": 1000})
    write_session(lab, "new", {**SESSION, "created": 2000})
    os.utime(lab.dir / "sessions" / "old.json", (9000, 9000))  # touched afterwards: still the older session
    assert [s["id"] for s in api("GET", "/api/sessions")[1]] == ["new", "old"]
