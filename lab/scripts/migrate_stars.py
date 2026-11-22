"""One-off migration of lab/notes.json to stars per player (`kept: {player: true}`).

- A boolean `kept` becomes `{"Joueur 1": true}` (false is dropped), as the server reads it.
- Joueur 2 gets a star on every grid of his session lab/sessions/v3-joueur2.json that he solved (non-phantom plays
  of lab/plays.jsonl).
- Run it with the lab server stopped: it rewrites notes.json without the server's lock.
- Idempotent; the previous file is saved as notes.json.bak. `--dry-run` only prints the changes.

Usage (from the repository root):
    solver/.venv/bin/python lab/scripts/migrate_stars.py [--lab-dir lab] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lab_server import LEGACY_PLAYER, Lab  # noqa: E402

PLAYER_2 = "Joueur 2"
SESSION_2 = "v3-joueur2"


def migrate(notes: dict[str, Any], plays: list[dict[str, Any]], session_grids: set[tuple[str, int]]) -> dict[str, Any]:
    """Notes with per-player stars: legacy stars go to Joueur 1, Joueur 2 stars the grids he solved."""
    out = {key: dict(note) for key, note in notes.items()}
    for note in out.values():
        Lab._migrate_kept(note)
    for p in plays:
        if p.get("player") == PLAYER_2 and p.get("outcome") == "solved" and not p.get("phantom") and (p.get("lot"), p.get("index")) in session_grids:
            out.setdefault(f"{p['lot']}:{p['index']}", {}).setdefault("kept", {})[PLAYER_2] = True
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lab-dir", type=Path, default=Path("lab"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    notes_path = a.lab_dir / "notes.json"
    notes = json.loads(notes_path.read_text())
    plays = [json.loads(line) for line in (a.lab_dir / "plays.jsonl").read_text().splitlines() if line.strip()]
    session = json.loads((a.lab_dir / "sessions" / f"{SESSION_2}.json").read_text())
    out = migrate(notes, plays, {(item["lot"], item["index"]) for item in session["items"]})
    stars = {p: sum(1 for n in out.values() if n.get("kept", {}).get(p)) for p in (LEGACY_PLAYER, PLAYER_2)}
    print(f"stars: {stars}; notes: {len(notes)} -> {len(out)}")
    if a.dry_run or out == notes:
        print("nothing written" if a.dry_run else "already migrated")
        return 0
    shutil.copy(notes_path, notes_path.with_suffix(".json.bak"))
    notes_path.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
