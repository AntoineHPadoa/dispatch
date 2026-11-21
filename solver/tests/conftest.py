"""Shared paths and loaders for the solver tests: published grids and the shared reference grids."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLISHED = ROOT / "web" / "src" / "data" / "grids.json"
FIXTURES = ROOT / "fixtures" / "grids"


def published() -> list[dict]:
    return json.loads(PUBLISHED.read_text())


def fixtures(prefix: str = "") -> list[dict]:
    out = []
    for f in sorted(FIXTURES.glob(f"{prefix}*.json")):
        fx = json.loads(f.read_text())
        fx["file"] = f.name
        out.append(fx)
    return out
