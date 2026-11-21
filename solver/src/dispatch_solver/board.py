"""Static board of a §14 grid, shared by both solvers: placements, silhouette options, composition.

- Puzzle: residual demand, composition keys, rules (clues.py), every placement that may fit, and the
  silhouette options: STEP options (sets of pump/turbine pairs) x per-column export tuples (one value per
  neighbor). Height to fill: residual + exports + pumping - turbining, never negative (surplus absorbed).
- composition_of(): §8.1 composition of a solution, in the same canonical form as the web engine's
  composition(): per column {key: cells} (zeros omitted), exports per neighbor, pumps and turbines.

Example: pz = Puzzle(grid); len(pz.placements)
"""

from __future__ import annotations

import itertools
from typing import Any

from .clues import Rules, read_rules
from .grid import IMPORT_PIECE, residual
from .shapes import Placement, Shape, rect, shapes_of

StepOption = tuple[tuple[int, int], ...]  # sorted (pump, turbine) pairs
Exports = tuple[int, ...]  # one value per neighbor, in grid order


class Puzzle:
    def __init__(self, g: dict[str, Any]) -> None:
        self.g = g
        self.n = n = len(g["columns"])
        self.columns: list[str] = g["columns"]
        self.residual = residual(g)
        self.rules: Rules = read_rules(g)
        self.keys = self.rules.keys
        self.countries: list[str] = [nb["id"] for nb in g["neighbors"]]
        self.caps: list[int] = [nb["cap"] for nb in g["neighbors"]]
        self.rank: dict[str, int | None] = {}
        self.co2: dict[str, int] = {}
        for k in self.keys:
            if k.startswith("I:"):
                self.rank[k] = None
                self.co2[k] = next(nb["co2"] for nb in g["neighbors"] if nb["id"] == k[2:])
            else:
                self.rank[k] = g["pieces"][k]["rank"]
                self.co2[k] = g["pieces"][k]["co2"]

        # Silhouette options
        pairs = [(p, t) for p in range(n) for t in range(p + 1, n)]
        self.step_options: list[StepOption] = (
            list(itertools.combinations_with_replacement(pairs, self.rules.step)) if self.rules.step else [()])
        fixed: dict[tuple[int, int], int] = {}
        for k, c, v, _ in self.rules.export_flows:
            i = self.countries.index(k)
            if fixed.get((i, c), v) != v:
                self.rules.contradictions.append(f"two flows to {k} at column {c}")
            fixed[i, c] = v
        self.export_options: list[list[Exports]] = []
        for c in range(n):
            ranges = [list(range(cap + 1)) for cap in self.caps]
            self.export_options.append([tuple(x) for x in itertools.product(*ranges)])
        self.maxh = [0] * n
        for s in self.step_options:
            d = self.step_delta(s)
            for c in range(n):
                self.maxh[c] = max(self.maxh[c], self.residual[c] + d[c] + max(sum(e) for e in self.export_options[c]))

        # Placements
        self.placements: list[Placement] = []
        self.index: dict[tuple[str, int, int, int, int, int], int] = {}
        for k in self.keys:
            if k.startswith("I:"):
                self._add_shapes(k, IMPORT_PIECE, k[2:], [rect(1, 1)])
            else:
                # Exact inventory: widths it does not list are not offered (not a deduction).
                shapes = [sh for sh in shapes_of(g["pieces"][k]) if self.rules.bars.get((k, sh.width), 1) > 0]
                self._add_shapes(k, k, None, shapes)

    def _add_shapes(self, key: str, piece: str, country: str | None, shapes: list[Shape]) -> None:
        for sh in shapes:
            for c0 in range(self.n - sh.width + 1):
                room = min(self.maxh[c0 + dc] - sh.top(dc) for dc in range(sh.width))
                for r in range(room + 1):
                    pl = Placement(key, piece, country, sh, r, c0, sh.cells(r, c0))
                    self.index[key, r, c0, sh.width, sh.height, sh.low] = len(self.placements)
                    self.placements.append(pl)

    def step_delta(self, s: StepOption) -> list[int]:
        d = [0] * self.n
        for p, t in s:
            d[p] += 1
            d[t] -= 1
        return d

    def find(self, key: str, row: int, col: int, width: int, height: int = 1) -> int | None:
        """Index of a rectangle-or-ramp placement matching §14 fields (first low-step variant)."""
        for (k, r, c, w, h, _low), i in self.index.items():
            if (k, r, c, w, h) == (key, row, col, width, height):
                return i
        return None


def composition_of(g: dict[str, Any], placements: list[dict[str, Any]], exports: dict[str, list[int]],
                   step: list[dict[str, int]] | list[tuple[int, int]]) -> dict[str, Any]:
    """Canonical §8.1 composition (same shape as composition() in web/src/engine/evaluate.ts)."""
    n = len(g["columns"])
    cells: list[dict[str, int]] = [{} for _ in range(n)]
    for p in placements:
        key = f"I:{p.get('country', '')}" if p["piece"] == IMPORT_PIECE else p["piece"]
        cols = _shape_columns(g, p)
        for dc, h in enumerate(cols):
            c = p["col"] + dc
            if c < n:
                cells[c][key] = cells[c].get(key, 0) + h
    out_exports = {nb["id"]: [(exports.get(nb["id"]) or [0] * n)[c] for c in range(n)] for nb in g["neighbors"]}
    pumps, turbines = [0] * n, [0] * n
    for s in step:
        p, t = (s["pump"], s["turbine"]) if isinstance(s, dict) else s
        pumps[p] += 1
        turbines[t] += 1
    return {"cells": [dict(sorted(x.items())) for x in cells], "exports": out_exports,
            "pumps": pumps, "turbines": turbines}


def _shape_columns(g: dict[str, Any], p: dict[str, Any]) -> list[int]:
    """Cells per column of a §14 placement (ramps: first shape of that width and height)."""
    h = p.get("height", 1)
    if p["piece"] != IMPORT_PIECE:
        d = g["pieces"].get(p["piece"], {})
        if d.get("ramp"):
            for sh in shapes_of(d):
                if sh.width == p["len"] and sh.height == h and sh.low == p.get("low", sh.low):
                    return [ch for _b, ch in sh.columns]
    return [h] * p["len"]


def reference_composition(g: dict[str, Any]) -> dict[str, Any]:
    sol = g["solution"]
    return composition_of(g, sol["placements"], sol["exports"], sol["step"])
