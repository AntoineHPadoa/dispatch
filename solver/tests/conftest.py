"""Shared paths and loaders for the solver tests: published grids, the former tutorials kept as test data, and the shared reference grids."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLISHED = ROOT / "web" / "src" / "data" / "grids.json"
FIXTURES = ROOT / "fixtures" / "grids"
LEGACY = ROOT / "fixtures" / "legacy-tutorials.json"


def published() -> list[dict]:
    return json.loads(PUBLISHED.read_text())


def legacy() -> list[dict]:
    """The former tutorial grids (ids 1-7, 12, 13), no longer published, kept as test data."""
    return json.loads(LEGACY.read_text())


def grid_by_id(gid: int) -> dict:
    """A published grid, else a former tutorial, by id."""
    return next(g for g in published() + legacy() if g["id"] == gid)


def fixtures(prefix: str = "") -> list[dict]:
    out = []
    for f in sorted(FIXTURES.glob(f"{prefix}*.json")):
        fx = json.loads(f.read_text())
        fx["file"] = f.name
        out.append(fx)
    return out
