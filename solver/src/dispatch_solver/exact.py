"""Exact solver (OR-Tools CP-SAT): counts the compositions of a §14 grid (§8.1) and returns one solution.

- One boolean per placement; exports per neighbor and column; pumps and turbines per column (pairs are
  rebuilt afterwards: a turbining always follows a pumping); height to fill per column through monotone
  "row r is under the silhouette" booleans; every cell under it covered exactly once, none above.
- Inventory, line capacity, CO2 cap and every clue are constraints (clues.py gives their meaning).
- Counting: solve, forbid that composition ("at least one value differs"), solve again, up to `cap`.

Example: res = count(grid); res.count == 1 and res.composition == reference_composition(grid)
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Any

from ortools.sat.python import cp_model

from .board import Puzzle

NUM_WORKERS = 8  # CP-SAT workers; the generator's worker processes set 1


@dataclass
class ExactResult:
    count: int  # number of compositions found (capped)
    capped: bool
    solutions: list[dict[str, Any]] = field(default_factory=list)  # §14 solutions, one per composition
    compositions: list[dict[str, Any]] = field(default_factory=list)

    @property
    def unique(self) -> bool:
        return self.count == 1

    @property
    def solution(self) -> dict[str, Any] | None:
        return self.solutions[0] if self.solutions else None

    @property
    def composition(self) -> dict[str, Any] | None:
        return self.compositions[0] if self.compositions else None


class Model:
    """CP-SAT model of a grid, with handles on the composition expressions."""

    def __init__(self, pz: Puzzle, extra: Any = None) -> None:
        self.pz = pz
        n = pz.n
        r = pz.rules
        m = self.m = cp_model.CpModel()
        self.x = [m.NewBoolVar(f"x{i}") for i in range(len(pz.placements))]
        self.e = [[m.NewIntVar(0, cap, f"e{k}_{c}") for c in range(n)] for k, cap in enumerate(pz.caps)]
        S = r.step
        self.pump = [m.NewIntVar(0, S, f"p{c}") for c in range(n)]
        self.turb = [m.NewIntVar(0, S, f"t{c}") for c in range(n)]
        m.Add(sum(self.pump) == S)
        m.Add(sum(self.turb) == S)
        for c in range(n):
            m.Add(sum(self.turb[: c + 1]) <= sum(self.pump[:c]))
        for k, c, v, _ in r.export_flows:
            m.Add(self.e[pz.countries.index(k)][c] == v)
        for k, v in r.export_totals.items():
            m.Add(sum(self.e[pz.countries.index(k)]) == v)

        # Silhouette and cover
        self.h = []
        cover: dict[tuple[int, int], list[int]] = {}
        for i, pl in enumerate(pz.placements):
            for cell in pl.cells:
                cover.setdefault(cell, []).append(i)
        for c in range(n):
            h = m.NewIntVar(0, pz.maxh[c], f"h{c}")
            m.Add(h == pz.residual[c] + sum(self.e[k][c] for k in range(len(pz.caps))) + self.pump[c] - self.turb[c])
            self.h.append(h)
            under = [m.NewBoolVar(f"u{r_}_{c}") for r_ in range(pz.maxh[c])]
            for a, b in itertools.pairwise(under):
                m.AddImplication(b, a)
            m.Add(sum(under) == h)
            for r_ in range(pz.maxh[c]):
                m.Add(sum(self.x[i] for i in cover.get((r_, c), [])) == under[r_])

        # Composition expressions
        self.cells: dict[tuple[str, int], Any] = {}
        for k in pz.keys:
            for c in range(n):
                terms = [
                    pl.cells_in(c) * self.x[i] for i, pl in enumerate(pz.placements) if pl.key == k and pl.cells_in(c)
                ]
                self.cells[k, c] = sum(terms) if terms else 0

        # Lines, inventory, CO2
        for k, cap in enumerate(pz.caps):
            for c in range(n):
                m.Add(self.e[k][c] + self.cells.get((f"I:{pz.countries[k]}", c), 0) <= cap)
        for (p, w), v in r.bars.items():
            m.Add(sum(self.x[i] for i, pl in enumerate(pz.placements) if pl.key == p and pl.width == w) == v)
        for g in r.counts:
            expr = sum(self.cells[k, c] for k in g.keys for c in range(n) if g.cols is None or c in g.cols)
            m.Add(expr >= g.lo)
            if g.hi is not None:
                m.Add(expr <= g.hi)
        if r.co2_cap is not None:
            m.Add(sum(pz.co2[k] * self.cells[k, c] for k in pz.keys for c in range(n)) <= r.co2_cap)

        # Clues
        for c, p in r.prices.items():
            want = pz.rank[p]
            for k in pz.keys:
                if (pz.rank[k] is None or pz.rank[k] > want) and not isinstance(self.cells[k, c], int):
                    m.Add(self.cells[k, c] == 0)
            if p in pz.keys:
                m.Add(self.cells[p, c] >= 1)
            else:
                m.AddBoolOr([])  # price of an unavailable plant: infeasible
        for p, c, w, _ in r.programs:
            m.AddBoolOr(
                [self.x[i] for i, pl in enumerate(pz.placements) if pl.key == p and pl.col == c and pl.width == w]
                or [m.NewConstant(0)]
            )
        for p, w, _ in r.lengths:
            m.AddBoolOr(
                [self.x[i] for i, pl in enumerate(pz.placements) if pl.key == p and pl.width == w] or [m.NewConstant(0)]
            )
        for e in r.engaged:
            i = pz.find(e["piece"], e["row"], e["col"], e["len"], e.get("height", 1))
            if i is None:
                m.AddBoolOr([])
            else:
                m.Add(self.x[i] == 1)
        if r.contradictions:
            m.AddBoolOr([])
        if extra is not None:
            extra(self)

    def comp_vars(self) -> list[Any]:
        pz = self.pz
        out = [self.cells[k, c] for k in pz.keys for c in range(pz.n) if not isinstance(self.cells[k, c], int)]
        out += [v for row in self.e for v in row] + self.pump + self.turb
        return out

    def read(self, solver: cp_model.CpSolver) -> tuple[dict[str, Any], dict[str, Any]]:
        """(§14 solution, canonical composition) of the current solution."""
        pz = self.pz
        n = pz.n
        placements = [pl.to_dict() for i, pl in enumerate(pz.placements) if solver.Value(self.x[i])]
        exports = {k: [solver.Value(self.e[j][c]) for c in range(n)] for j, k in enumerate(pz.countries)}
        pumps = [solver.Value(v) for v in self.pump]
        turbs = [solver.Value(v) for v in self.turb]
        pairs: list[dict[str, int]] = []
        waiting: list[int] = []
        for c in range(n):
            for _ in range(turbs[c]):
                pairs.append({"pump": waiting.pop(0), "turbine": c})
            waiting += [c] * pumps[c]
        cells = [
            {
                k: int(solver.Value(self.cells[k, c]))
                for k in pz.keys
                if not isinstance(self.cells[k, c], int) and solver.Value(self.cells[k, c])
            }
            for c in range(n)
        ]
        comp = {
            "cells": [dict(sorted(x.items())) for x in cells],
            "exports": exports,
            "pumps": pumps,
            "turbines": turbs,
        }
        sol = {
            "exports": {k: v for k, v in exports.items() if any(v)},
            "step": pairs,
            "placements": sorted(placements, key=lambda d: (d["col"], d["row"], d["piece"])),
        }
        return sol, comp


def count(g: dict[str, Any] | Puzzle, cap: int = 2, time_limit: float = 30.0, extra: Any = None) -> ExactResult:
    """Compositions of a grid, up to `cap` (2 is enough to decide uniqueness)."""
    pz = g if isinstance(g, Puzzle) else Puzzle(g)
    model = Model(pz, extra)
    m = model.m
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = NUM_WORKERS
    res = ExactResult(0, False)
    comp_vars = model.comp_vars()
    while res.count < cap:
        status = solver.Solve(m)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            if status == cp_model.UNKNOWN:
                raise TimeoutError("CP-SAT timed out")
            return res
        sol, comp = model.read(solver)
        res.count += 1
        res.solutions.append(sol)
        res.compositions.append(comp)
        diffs = []
        for j, v in enumerate(comp_vars):
            val = solver.Value(v)
            lo = m.NewBoolVar(f"lo{res.count}_{j}")
            hi = m.NewBoolVar(f"hi{res.count}_{j}")
            m.Add(v <= val - 1).OnlyEnforceIf(lo)
            m.Add(v >= val + 1).OnlyEnforceIf(hi)
            diffs += [lo, hi]
        m.AddBoolOr(diffs)
    res.capped = True
    return res
