"""Draft grids: the §14 skeleton the generator fills (no clue, no solution yet).

- PIECE_TABLE: default shapes of each plant (§3); `tall` and `ramp` variants are opt-in.
- make_draft(): columns labels, demand, weather, pieces, neighbors, STEP pairs, CO2 cap, max_cells.

Example: d = make_draft([3, 4, 6, 7, 6, 8, 8, 5], "NGT", neighbors=[("DE", 1, 2)])
"""

from __future__ import annotations

from typing import Any

from ..grid import PIECE_SPEC

PIECE_TABLE: dict[str, dict[str, Any]] = {
    "N": {"len": [3, 4, 5, 6], "height": [1]},
    "B": {"len": [1], "height": [1]},
    "C": {"len": [3, 4, 5], "height": [1]},
    "G": {"len": [2, 3], "height": [1]},
    "T": {"len": [1], "height": [1]},
}
COUNTRY_NAMES = {
    "DE": "Allemagne",
    "ES": "Espagne",
    "UK": "Royaume-Uni",
    "IT": "Italie",
    "BE": "Belgique",
    "CH": "Suisse",
}


def column_labels(n: int) -> list[str]:
    step = 24 / n
    return [f"{int(i * step)}h" if (i * step).is_integer() else f"{i * step:g}h" for i in range(n)]


def make_draft(
    residual: list[int],
    pieces: str,
    *,
    neighbors: list[tuple[str, int, int]] = (),
    step: int = 0,
    co2_cap: int | None = None,
    weather_r: list[int] | None = None,
    f: int = 0,
    shapes: dict[str, dict[str, Any]] | None = None,
    max_cells: dict[str, int] | None = None,
    gid: int = 1,
    title: str = "Brouillon",
) -> dict[str, Any]:
    """A §14 draft whose residual demand is `residual` (demand = residual + R + F)."""
    n = len(residual)
    r = weather_r or [0] * n
    defs = {}
    for p in pieces:
        d = {**PIECE_TABLE[p], **(shapes or {}).get(p, {})}
        if d.get("shape", "rect") != "rect":
            d.pop("height", None)
        defs[p] = {**d, **PIECE_SPEC[p]}
    inv = {p: ({"max_cells": max_cells[p]} if max_cells and p in max_cells else {}) for p in pieces}
    g: dict[str, Any] = {
        "id": gid,
        "title": title,
        "section": "rated",
        "columns": column_labels(n),
        "demand": [residual[c] + r[c] + f for c in range(n)],
        "pieces": defs,
        "weather": {"R": list(r), "F": [f] * n},
        "neighbors": [{"id": k, "name": COUNTRY_NAMES.get(k, k), "cap": cap, "co2": co2} for k, cap, co2 in neighbors],
        "step": step > 0,
        "co2_cap": co2_cap,
        "inventory": {"level": "none", "pieces": inv},
        "clues": [{"type": "exchanges", "step": step}] if step else [],
        "solution": {"exports": {}, "step": [], "placements": []},
        "difficulty": {"rating": 1, "label": "Facile", "techniques": []},
    }
    return g
