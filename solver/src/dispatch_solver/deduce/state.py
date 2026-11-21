"""Deduction state and its derived view.

- State: candidate placements (indices into Puzzle.placements), placements known to be in the solution,
  and the silhouette domain: for each STEP option still possible, one set of export tuples per column.
- Published export totals of the exact inventory are part of the representation (like the inventory of a
  Sudoku): every change re-applies them by counting bounds, without a trace step. Totals published by an
  `exchanges` clue are a technique of their own (record, day scope).
- View: bounds of the height to fill, placements covering each cell, possible keys per cell.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from ..board import Exports, Puzzle

Cell = tuple[int, int]
Sil = dict[int, list[frozenset[Exports]]]  # step option index -> per column: allowed export tuples


class Contradiction(Exception):
    pass


@dataclass
class State:
    cands: set[int]
    placed: set[int]
    sil: Sil

    def copy(self) -> State:
        return State(set(self.cands), set(self.placed), {s: list(cols) for s, cols in self.sil.items()})


def initial_sil(pz: Puzzle) -> Sil:
    sil: Sil = {}
    for si, s in enumerate(pz.step_options):
        d = pz.step_delta(s)
        cols = [frozenset(e for e in pz.export_options[c] if pz.residual[c] + d[c] + sum(e) >= 0) for c in range(pz.n)]
        if all(cols):
            sil[si] = cols
    return sil


def heights(pz: Puzzle, si: int, c: int, es: frozenset[Exports]) -> set[int]:
    base = pz.residual[c] + pz.step_delta(pz.step_options[si])[c]
    return {base + sum(e) for e in es}


def apply_totals(pz: Puzzle, sil: Sil, totals: dict[int, int]) -> Sil:
    """Bounds pruning of the export tuples by day totals {neighbor index: total}, to a fixpoint."""
    out: Sil = {}
    for si, cols in sil.items():
        cols = list(cols)
        ok = True
        changed = True
        while changed and ok:
            changed = False
            for k, total in totals.items():
                lo = [min(e[k] for e in es) for es in cols]
                hi = [max(e[k] for e in es) for es in cols]
                slo, shi = sum(lo), sum(hi)
                if slo > total or shi < total:
                    ok = False
                    break
                for c, es in enumerate(cols):
                    keep = frozenset(e for e in es if slo - lo[c] <= total - e[k] <= shi - hi[c])
                    if keep != es:
                        if not keep:
                            ok = False
                            break
                        cols[c] = keep
                        changed = True
                if not ok:
                    break
        if ok:
            out[si] = cols
    return out


class View:
    """Derived facts of a state."""

    def __init__(self, pz: Puzzle, st: State) -> None:
        if not st.sil:
            raise Contradiction("no silhouette left")
        n = pz.n
        self.minh = [10 ** 6] * n
        self.maxh = [0] * n
        self.emin = [[10 ** 6] * n for _ in pz.countries]
        self.emax = [[0] * n for _ in pz.countries]
        for si, cols in st.sil.items():
            d = pz.step_delta(pz.step_options[si])
            for c, es in enumerate(cols):
                for e in es:
                    h = pz.residual[c] + d[c] + sum(e)
                    self.minh[c] = min(self.minh[c], h)
                    self.maxh[c] = max(self.maxh[c], h)
                    for k, v in enumerate(e):
                        self.emin[k][c] = min(self.emin[k][c], v)
                        self.emax[k][c] = max(self.emax[k][c], v)
        self.cover: dict[Cell, list[int]] = defaultdict(list)
        for i in st.cands:
            for cell in pz.placements[i].cells:
                self.cover[cell].append(i)
        self.occupied: dict[Cell, int] = {}
        for i in st.placed:
            for cell in pz.placements[i].cells:
                if cell in self.occupied:
                    raise Contradiction("two placed pieces overlap")
                self.occupied[cell] = i
        self.cells: list[Cell] = [(r, c) for c in range(n) for r in range(self.maxh[c])]
        self.dom: dict[Cell, frozenset[str]] = {
            cell: frozenset(pz.placements[i].key for i in self.cover.get(cell, ())) for cell in self.cells}
        self.single_sil = len(st.sil) == 1 and all(len(es) == 1 for es in next(iter(st.sil.values())))

    def sure(self, cell: Cell) -> bool:
        return cell[0] < self.minh[cell[1]]

    def column(self, c: int) -> list[Cell]:
        return [(r, c) for r in range(self.maxh[c])]

    def unresolved(self) -> int:
        return sum(1 for x in self.cells if not (self.sure(x) and len(self.dom[x]) == 1)) + (not self.single_sil)
