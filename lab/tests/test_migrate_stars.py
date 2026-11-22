"""Tests of the stars migration (lab/scripts/migrate_stars.py).

Run: solver/.venv/bin/python -m pytest lab/tests/test_migrate_stars.py -q
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import migrate_stars  # noqa: E402

SCRIPT = Path(migrate_stars.__file__)


def play(player, lot, index, outcome="solved", phantom=False):
    return {"player": player, "lot": lot, "index": index, "outcome": outcome, "phantom": phantom}


def test_legacy_stars_go_to_player_1_and_player_2_stars_what_he_solved():
    notes = {"a:0": {"kept": True, "felt": {"Joueur 1": 2}}, "a:1": {"kept": False}, "a:2": {"comment": {"Joueur 1": "x"}}}
    plays = [play("Joueur 2", "a", 0), play("Joueur 2", "a", 3), play("Joueur 2", "a", 4, outcome="abandoned"),
             play("Joueur 2", "a", 5, phantom=True), play("Joueur 2", "other", 1), play("Joueur 1", "a", 6), play("Joueur 2", "a", 7)]
    out = migrate_stars.migrate(notes, plays, {("a", 0), ("a", 3), ("a", 4), ("a", 5)})
    assert out["a:0"] == {"kept": {"Joueur 1": True, "Joueur 2": True}, "felt": {"Joueur 1": 2}}
    assert out["a:1"] == {}
    assert out["a:2"] == {"comment": {"Joueur 1": "x"}}
    assert out["a:3"] == {"kept": {"Joueur 2": True}}
    assert set(out) == {"a:0", "a:1", "a:2", "a:3"}  # abandoned, phantom, other lot, Joueur 1 and out-of-session (a:7) plays add nothing
    assert notes["a:0"]["kept"] is True  # the input is not modified


def test_migration_is_idempotent():
    notes = {"a:0": {"kept": True}}
    plays = [play("Joueur 2", "a", 1)]
    once = migrate_stars.migrate(notes, plays, {("a", 0), ("a", 3), ("a", 4), ("a", 5)})
    assert migrate_stars.migrate(once, plays, {"a"}) == once


def test_command_writes_a_backup_and_reruns_cleanly(tmp_path):
    lab = tmp_path / "lab"
    (lab / "sessions").mkdir(parents=True)
    (lab / "notes.json").write_text(json.dumps({"a:0": {"kept": True}}))
    (lab / "plays.jsonl").write_text("\n".join(json.dumps(p) for p in [play("Joueur 2", "a", 0), play("Joueur 2", "a", 2)]) + "\n")
    (lab / "sessions" / "v3-joueur2.json").write_text(json.dumps({"items": [{"lot": "a", "index": 0}]}))
    cmd = [sys.executable, str(SCRIPT), "--lab-dir", str(lab)]
    dry = subprocess.run([*cmd, "--dry-run"], capture_output=True, text=True, check=True)
    assert "nothing written" in dry.stdout and json.loads((lab / "notes.json").read_text()) == {"a:0": {"kept": True}}
    subprocess.run(cmd, check=True, capture_output=True)
    assert json.loads((lab / "notes.json.bak").read_text()) == {"a:0": {"kept": True}}
    assert json.loads((lab / "notes.json").read_text()) == {
        "a:0": {"kept": {"Joueur 1": True, "Joueur 2": True}}}  # a:2 is not in his session
    again = subprocess.run(cmd, capture_output=True, text=True, check=True)
    assert "already migrated" in again.stdout
