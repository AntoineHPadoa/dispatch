"""Tests of archived lots (lab/candidates/archive/): hidden from the list, read-only, keys still resolve.

Run: solver/.venv/bin/python -m pytest lab/tests/test_archive.py -q
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_lab_server import PLAY, api, grid, lab, rated  # noqa: E402,F401  (fixtures)

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def archived(lab):
    """Lot `old` in the archive, with a play, a note and a session pointing to it."""
    arch = lab.dir / "candidates" / "archive"
    arch.mkdir()
    old = [{**grid(i), "lab": {**grid(i)["lab"], "lot": "old"}} for i in range(2)]
    (arch / "old.json").write_text(json.dumps(old))
    (arch / "old.stats.json").write_text(json.dumps({"lot": "old"}))
    play = {**PLAY, "id": "p1", "schema": 1, "lot": "old", "index": 1, "felt": 2, "attempt": 1}
    (lab.dir / "plays.jsonl").write_text(json.dumps(play) + "\n")
    (lab.dir / "notes.json").write_text(json.dumps({"old:1": {"kept": True, "felt": {"Joueur 1": 2}}}))
    (lab.dir / "sessions" / "mixed.json").write_text(
        json.dumps({"title": "Mixed", "items": [{"lot": "old", "index": 1}, {"lot": "t", "index": 0}]}))
    return lab


def test_archived_lot_is_not_listed(api, archived):
    assert [l["lot"] for l in api("GET", "/api/lots")[1]] == ["t"]


def test_archived_keys_still_resolve_for_reading(api, archived):
    code, cands = api("GET", "/api/candidates?lot=old&player=Joueur%201")
    assert code == 200 and [c["index"] for c in cands] == [0, 1]
    assert cands[1]["revealed"] and cands[1]["kept"] and cands[1]["plays"] == 1
    assert api("GET", "/api/reveal/old/1?player=Joueur%201")[0] == 200
    assert api("GET", "/api/bulletin/old/1")[1]["title"] == "Pointe"
    assert api("GET", "/api/plays?player=Joueur%201")[1][0]["lot"] == "old"
    assert "old:1" in api("GET", "/api/notes?player=Joueur%201")[1]


def test_session_pointing_to_an_archived_lot_does_not_crash(api, archived):
    code, s = api("GET", "/api/session/mixed?player=Joueur%201")
    assert code == 200
    assert [(i["lot"], i["state"], i["playable"]) for i in s["items"]] == [("old", "solved", False), ("t", "todo", True)]


def test_archived_lot_cannot_be_played_drawn_or_promoted(api, archived):
    assert api("GET", "/api/grid/old/0")[0] == 410
    assert api("POST", "/api/sessions", {"lot": "old"})[0] == 410
    assert api("POST", "/api/promote", {"lot": "old", "index": 0, "number": 214, "published": "2026-11-21"})[0] == 410


def test_archived_lot_name_is_never_reused(api, archived):
    code, err = api("POST", "/api/generate", {"lot": "old", "size": 1, "mix": []})
    assert code == 409 and "already exists" in err["error"]


def test_archived_sessions_are_not_listed(api, archived):
    (archived.dir / "sessions" / "archive").mkdir()
    (archived.dir / "sessions" / "mixed.json").rename(archived.dir / "sessions" / "archive" / "mixed.json")
    assert api("GET", "/api/sessions")[1] == []
    assert api("GET", "/api/session/mixed")[0] == 404


def test_shipped_archive_is_hidden_and_live_lots_are_v3(tmp_path):
    """The repo's own lab/: old lots are archived, every live lot is v3-*, v3g<N>-* or the replay lot."""
    import lab_server
    shutil.copytree(ROOT / "lab" / "candidates", tmp_path / "candidates")
    shutil.copytree(ROOT / "lab" / "sessions", tmp_path / "sessions")
    lab = lab_server.Lab(tmp_path, tmp_path / "grids.json")
    live = [l["lot"] for l in lab.lots()]
    assert live and all(re.match(r"v3(g\d+)?-", n) or n == "nuit-rejeu-notees" for n in live)
    for name in ("demo", "demo-01", "nuit-jouer-a", "nuit-jouer-b", "nuit-jouer-c", "nuit-rampe"):
        assert lab.archived(name) and name not in live
    assert "v3-session-1" not in [s["id"] for s in lab.sessions()]
