"""Deduction state and its derived view.

- State: candidate placements (indices into Puzzle.placements), placements known to be in the solution,
  and the silhouette domain: for each STEP option still possible, one set of export tuples per column.
- Published export totals of the exact inventory are part of the representation (like the inventory of a
  Sudoku): every change re-applies them by counting bounds, without a trace step. Totals published by an
  `exchanges` clue are a technique of their own (record, day scope).
- View: bounds of the height to fill, placements covering each cell, possible keys per cell.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

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
    for si, d in enumerate(pz.deltas):
        cols = [frozenset(e for e in pz.export_options[c] if pz.residual[c] + d[c] + sum(e) >= 0) for c in range(pz.n)]
        if all(cols):
            sil[si] = cols
    return sil


def apply_totals(pz: Puzzle, sil: Sil, totals: dict[int, int]) -> Sil:
    """Bounds pruning of the export tuples by day totals {neighbor index: total}, to a fixpoint."""
    if not totals:
        return sil
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
                    least = total - (shi - hi[c])
                    most = total - (slo - lo[c])
                    if lo[c] >= least and hi[c] <= most:
                        continue
                    keep = frozenset(e for e in es if least <= e[k] <= most)
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


class _Lazy(dict):
    def __init__(self, fn: Callable[[Cell], Any]) -> None:
        super().__init__()
        self.fn = fn

    def __missing__(self, key: Cell) -> Any:
        val = self[key] = self.fn(key)
        return val


class View:
    """Derived facts of a state; cell sets are bit masks (cell r, c = bit r * n + c).

    minh / maxh are heights to fill (counts of cells); rows are absolute, so column c spans the rows
    w[c] .. w[c] + maxh[c] - 1 above its weather bricks, and the rows under w[c] + minh[c] are sure.
    """

    def __init__(self, pz: Puzzle, st: State) -> None:
        if not st.sil:
            raise Contradiction("no silhouette left")
        n = pz.n
        self.pz, self.st = pz, st
        self.minh = [10**6] * n
        self.maxh = [0] * n
        self.emin = [[10**6] * n for _ in pz.countries]
        self.emax = [[0] * n for _ in pz.countries]
        for c in range(n):
            pairs = {(pz.deltas[si][c], cols[c]) for si, cols in st.sil.items()}
            for d, es in pairs:
                for e in es:
                    h = pz.residual[c] + d + sum(e)
                    if h < self.minh[c]:
                        self.minh[c] = h
                    if h > self.maxh[c]:
                        self.maxh[c] = h
                    for k, v in enumerate(e):
                        if v < self.emin[k][c]:
                            self.emin[k][c] = v
                        if v > self.emax[k][c]:
                            self.emax[k][c] = v
        masks = pz.masks
        self.keymask = {k: 0 for k in pz.keys}
        u1 = u2 = 0
        for i in st.cands:
            m = masks[i]
            self.keymask[pz.placements[i].key] |= m
            u2 |= u1 & m
            u1 |= m
        self.u1, self.u2 = u1, u2
        occ = 0
        self.occupied: dict[Cell, int] = {}
        for i in st.placed:
            if occ & masks[i]:
                raise Contradiction("two placed pieces overlap")
            occ |= masks[i]
            for cell in pz.placements[i].cells:
                self.occupied[cell] = i
        self.occ = occ
        w = self.w = pz.w
        self.top_min = [w[c] + self.minh[c] for c in range(n)]  # rows under it are sure
        self.top_max = [w[c] + self.maxh[c] for c in range(n)]  # rows from it are absent
        self.cells: list[Cell] = [(r, c) for c in range(n) for r in range(w[c], self.top_max[c])]
        under = 0
        sure = 0
        for r, c in self.cells:
            under |= pz.bit(r, c)
            if r < self.top_min[c]:
                sure |= pz.bit(r, c)
        self.under, self.sure_mask = under, sure
        cands = st.cands

        def cover(x: Cell) -> list[int]:
            b = pz.bit(*x)
            return [i for i in cands if masks[i] & b] if u1 & b else []

        def dom(x: Cell) -> frozenset[str]:
            b = pz.bit(*x)
            return frozenset(k for k, m in self.keymask.items() if m & b)

        self.cover: dict[Cell, list[int]] = _Lazy(cover)
        self.dom: dict[Cell, frozenset[str]] = _Lazy(dom)
        self.single_sil = len(st.sil) == 1 and all(len(es) == 1 for es in next(iter(st.sil.values())))

    def sure(self, cell: Cell) -> bool:
        return self.w[cell[1]] <= cell[0] < self.top_min[cell[1]]

    def column(self, c: int) -> list[Cell]:
        return [(r, c) for r in range(self.w[c], self.top_max[c])]

    def unresolved(self) -> int:
        return sum(1 for x in self.cells if not (self.sure(x) and len(self.dom[x]) == 1)) + (not self.single_sil)
