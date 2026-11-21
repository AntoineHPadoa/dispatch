"""Static board of a §14 grid, shared by both solvers: placements, silhouette options, composition.

- Puzzle: residual demand, composition keys, rules (clues.py), every placement that may fit, and the
  silhouette options: STEP options (sets of pump/turbine pairs) x per-column export tuples (one value per
  neighbor). Height to fill: residual + exports + pumping - turbining, never negative (a surplus is
  absorbed by exports or pumping). with_clues() reuses the placements for another clue set (generator).
- composition_of(): §8.1 composition of a solution, in the same canonical form as the web engine's
  composition(): per column {key: cells} (zeros omitted), exports per neighbor, pumps and turbines.

Example: pz = Puzzle(grid); len(pz.placements)
"""

from __future__ import annotations

import copy
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
            list(itertools.combinations_with_replacement(pairs, self.rules.step)) if self.rules.step else [()]
        )
        self.export_options: list[list[Exports]] = []
        for c in range(n):
            ranges = [list(range(cap + 1)) for cap in self.caps]
            self.export_options.append([tuple(x) for x in itertools.product(*ranges)])
        self.deltas: list[list[int]] = [self.step_delta(s) for s in self.step_options]
        self.maxh = [0] * n
        for d in self.deltas:
            for c in range(n):
                self.maxh[c] = max(self.maxh[c], self.residual[c] + d[c] + max(sum(e) for e in self.export_options[c]))

        # Placements (cell r, c is bit r * n + c of a mask)
        self.placements: list[Placement] = []
        self.masks: list[int] = []
        self.pw: list[tuple[str, int]] = []  # (key, width) per placement
        self.spans: list[dict[int, tuple[int, int]]] = []  # per placement: row -> columns [a, b)
        self.index: dict[tuple[str, int, int, int, int], int] = {}
        for k in self.keys:
            if k.startswith("I:"):
                self._add_shapes(k, IMPORT_PIECE, k[2:], [rect(1, 1)])
            else:
                # Exact inventory: widths it does not list are not offered (not a deduction).
                shapes = [sh for sh in shapes_of(g["pieces"][k]) if self.rules.bars.get((k, sh.width), 1) > 0]
                self._add_shapes(k, k, None, shapes)

    def with_clues(self, clues: list[dict[str, Any]]) -> Puzzle:
        """Same board with other clues: placements are reused unless the composition keys change."""
        g = {**self.g, "clues": clues}
        rules = read_rules(g)
        if rules.keys != self.keys:
            return Puzzle(g)
        out = copy.copy(self)
        out.g, out.rules = g, rules
        return out

    def _add_shapes(self, key: str, piece: str, country: str | None, shapes: list[Shape]) -> None:
        for sh in shapes:
            for c0 in range(self.n - sh.width + 1):
                room = min(self.maxh[c0 + dc] - sh.top(dc) for dc in range(sh.width))
                for r in range(room + 1):
                    pl = Placement(key, piece, country, sh, r, c0, sh.cells(r, c0))
                    self.index[key, r, c0, sh.width, 1 if sh.kind.startswith("ramp") else sh.height] = len(
                        self.placements
                    )
                    self.placements.append(pl)
                    self.masks.append(sum(1 << (rr * self.n + cc) for rr, cc in pl.cells))
                    self.pw.append((key, sh.width))
                    self.spans.append({rr: pl.row_span(rr) for rr in {x for x, _ in pl.cells}})

    def bit(self, r: int, c: int) -> int:
        return 1 << (r * self.n + c)

    def step_delta(self, s: StepOption) -> list[int]:
        d = [0] * self.n
        for p, t in s:
            d[p] += 1
            d[t] -= 1
        return d

    def find(self, key: str, row: int, col: int, width: int, height: int = 1) -> int | None:
        """Index of the placement matching §14 fields (a ramp has no height: 1)."""
        return self.index.get((key, row, col, width, height))


def composition_of(
    g: dict[str, Any],
    placements: list[dict[str, Any]],
    exports: dict[str, list[int]],
    step: list[dict[str, int]] | list[tuple[int, int]],
) -> dict[str, Any]:
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
    return {
        "cells": [dict(sorted(x.items())) for x in cells],
        "exports": out_exports,
        "pumps": pumps,
        "turbines": turbines,
    }


def _shape_columns(g: dict[str, Any], p: dict[str, Any]) -> list[int]:
    """Cells per column of a §14 placement."""
    if p["piece"] != IMPORT_PIECE:
        d = g["pieces"].get(p["piece"], {})
        if d.get("shape", "rect") != "rect":
            sh = next(x for x in shapes_of(d) if x.width == p["len"])
            return [h for _b, h in sh.columns]
    return [p.get("height", 1)] * p["len"]


def reference_composition(g: dict[str, Any]) -> dict[str, Any]:
    sol = g["solution"]
    return composition_of(g, sol["placements"], sol["exports"], sol["step"])
