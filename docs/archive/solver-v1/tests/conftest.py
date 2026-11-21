"""Shared helpers for the tests: grid paths and a small v2 grid builder."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
V1_GRIDS = ROOT / "docs" / "archive" / "demo" / "grids.json"
EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def v2_grid(residual, pieces, constraints=None, neighbor=None, optimize="min_score", target=None, **extra):
    d = {
        "columns": [f"{i}h" for i in range(len(residual))],
        "residual": residual,
        "pieces": pieces,
        "objective": {"optimize": optimize, "target": target, "constraints": constraints or {}},
    }
    if neighbor:
        d["neighbor"] = neighbor
    d.update(extra)
    return d
