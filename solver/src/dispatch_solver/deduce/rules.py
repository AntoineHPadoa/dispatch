"""Human deduction solver: named techniques (§9), easiest first, no trial and error beyond one hypothesis.

- Each turn applies every instance of the easiest technique that changes something, then starts again at
  level 1. A technique only removes candidates no solution uses, or places pieces every solution uses.
- Solved when the silhouette is fixed and the cells of each key in each column are known (the composition):
  by cells with a single possible key, or by counting (Cases interchangeables).
- Stuck: not solvable without guessing; the grid is not publishable.

Example: res = Solver(Puzzle(grid)).run(); res.status, res.rating, res.techniques()
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from typing import Any

from ..board import Exports, Puzzle
from .state import Cell, Contradiction, Sil, State, View, apply_totals, initial_sil
from .trace import RULES, Result, Step

MAX_TILINGS = 4000  # per row, for share_out
MAX_SHARE_WORK = 300000
BIG = 10**6
SilPred = Callable[[int, int, Exports], bool]  # (column, height to fill, exports) -> keep


class Solver:
    def __init__(self, pz: Puzzle, st: State | None = None, max_level: int = 4, record: bool = True) -> None:
        self.pz = pz
        self.max_level = max_level
        self.record = record
        self.steps: list[Step] = []
        r = pz.rules
        self.inv_totals = {
            pz.countries.index(k): v for k, v in r.export_totals.items() if r.export_total_clue.get(k) is None
        }
        self.clue_totals = {
            pz.countries.index(k): (v, r.export_total_clue[k])
            for k, v in r.export_totals.items()
            if r.export_total_clue.get(k) is not None
        }
        if st is None:
            sil = apply_totals(pz, initial_sil(pz), self.inv_totals)
            st = State(set(range(len(pz.placements))), set(), sil)
        self.st = st
        self._cur: Step | None = None
        self.rules: list[tuple[int, Callable[[View], bool]]] = [
            (1, self.r_room),
            (1, self.r_exhausted),
            (1, self.r_price_cap),
            (1, self.r_record),
            (1, self.r_flow),
            (1, self.r_single_cover),
            (1, self.r_single_spot),
            (1, self.r_program),
            (1, self.r_length),
            (1, self.r_silhouette),
            (2, self.r_top_price),
            (2, self.r_ribbon),
            (2, self.r_just_enough),
            (2, self.r_column_sum),
            (2, self.r_carbon),
            (3, self.r_share_out),
            (4, self.r_refuted),
        ]

    # ----- state changes, recorded in the current step -----

    def _begin(self, rule: str, clues: list[int] | None = None) -> Step:
        self._cur = Step(rule, [], clues=sorted({c for c in (clues or []) if c is not None}))
        return self._cur

    def _end(self) -> bool:
        step, self._cur = self._cur, None
        if step is None or not step.effects:
            return False
        if self.record:
            step.shapes = sorted(set(step.shapes))
            self.steps.append(step)
        return True

    def _touch(self, i: int, kind: str) -> None:
        pl = self.pz.placements[i]
        s = self._cur
        if s is None:
            return
        (s.removed if kind == "removed" else s.placed).append(pl.to_dict())
        s.cells += list(pl.cells)
        if pl.shape.kind not in s.shapes:
            s.shapes.append(pl.shape.kind)
        verb = "exclut" if kind == "removed" else "pose"
        s.effects.append(f"{verb} {pl.label(self.pz.columns)}")

    def remove(self, idx: Any) -> None:
        for i in sorted(set(idx)):
            if i in self.st.placed:
                raise Contradiction("placed piece excluded")
            if i in self.st.cands:
                self.st.cands.discard(i)
                self._touch(i, "removed")

    def place(self, idx: Any) -> None:
        for i in sorted(set(idx)):
            if i not in self.st.cands:
                raise Contradiction("impossible piece placed")
            if i not in self.st.placed:
                self.st.placed.add(i)
                self._touch(i, "placed")

    def keep_sil(self, keep: SilPred, steps: Callable[[int], bool] | None = None) -> None:
        """Keep the silhouette options passing `keep(column, height, exports)` (and `steps(option)`)."""
        pz = self.pz
        before = self.st.sil
        after: Sil = {}
        memo: dict[tuple[int, frozenset[Exports], int], frozenset[Exports]] = {}
        for si, cols in before.items():
            if steps is not None and not steps(si):
                continue
            d = pz.deltas[si]
            new = []
            for c, es in enumerate(cols):
                key = (c, es, d[c])
                got = memo.get(key)
                if got is None:
                    base = pz.residual[c] + d[c]
                    got = memo[key] = frozenset(e for e in es if keep(c, base + sum(e), e))
                if not got:
                    break
                new.append(got)
            else:
                after[si] = new
        if after == before:
            return
        after = apply_totals(pz, after, self.inv_totals)
        if not after:
            raise Contradiction("no silhouette left")
        self.st.sil = after
        if self._cur is not None:
            self._cur.effects += self._describe_sil(before, after) if self.record else ["silhouette"]

    def _describe_sil(self, before: Sil, after: Sil) -> list[str]:
        pz = self.pz
        out = []

        def hs(sil: Sil, c: int) -> set[int]:
            return {pz.residual[c] + pz.deltas[si][c] + sum(e) for si, cols in sil.items() for e in cols[c]}

        for c in range(pz.n):
            hb, ha = hs(before, c), hs(after, c)
            if len(hb) > 1 and len(ha) == 1:
                out.append(f"hauteur {next(iter(ha))} à {pz.columns[c]}")
                self._cur.cells.append((next(iter(ha)), c)) if self._cur else None
        if len(after) == 1 and len(before) > 1:
            s = pz.step_options[next(iter(after))]
            out += [f"pompage {pz.columns[p]} -> turbinage {pz.columns[t]}" for p, t in s]
        for k, nid in enumerate(pz.countries):
            for c in range(pz.n):
                vb = {e[k] for cols in before.values() for e in cols[c]}
                va = {e[k] for cols in after.values() for e in cols[c]}
                if len(vb) > 1 and len(va) == 1:
                    out.append(f"export {nid} {next(iter(va))} à {pz.columns[c]}")

        def size(sil: Sil) -> int:
            return sum(len(es) for cols in sil.values() for es in cols)

        return out or [f"silhouettes : {size(before)} -> {size(after)} options"]

    # ----- main loop -----

    def apply_clue_facts(self) -> None:
        pz = self.pz
        if pz.rules.contradictions:
            raise Contradiction("; ".join(pz.rules.contradictions))
        self._begin("given")
        for e in pz.rules.engaged:
            i = pz.find(e["piece"], e["row"], e["col"], e["len"], e.get("height", 1))
            if i is None:
                raise Contradiction("engaged piece does not fit")
            self.place([i])
        self._end()
        flows = pz.rules.export_flows
        if flows:
            self._begin("flow", [f[3] for f in flows])
            want = {(pz.countries.index(k), c): v for k, c, v, _ in flows}
            self.keep_sil(lambda c, h, e: all(e[k] == v for (k, cc), v in want.items() if cc == c))
            self._end()

    def run(self) -> Result:
        try:
            self.apply_clue_facts()
            while True:
                v = View(self.pz, self.st)
                self.check(v)
                if self.solved(v):
                    return Result("solved", self.steps, self.composition(v), 0)
                for level, rule in self.rules:
                    if level <= self.max_level and rule(v):
                        break
                else:
                    return Result("stuck", self.steps, None, v.unresolved())
        except Contradiction as exc:
            return Result("contradiction", self.steps, None, 0, str(exc))

    def bounds(self, v: View) -> tuple[dict[tuple[str, int], int], dict[tuple[str, int], int]]:
        """Bounds on the cells of each key in each column, by counting (raises Contradiction)."""
        pz = self.pz
        lo: dict[tuple[str, int], int] = {}
        hi: dict[tuple[str, int], int] = {}
        for k in pz.keys:
            for c in range(pz.n):
                col = v.column(c)
                lo[k, c] = sum(1 for x in col if v.sure(x) and v.dom[x] == frozenset([k]))
                hi[k, c] = sum(1 for x in col if k in v.dom[x])
        cons: list[tuple[list[tuple[str, int]], int, int]] = []
        for c in range(pz.n):
            cons.append(([(k, c) for k in pz.keys], v.minh[c], v.maxh[c]))
        for g in pz.rules.counts:
            keys = [(k, c) for k in g.keys for c in range(pz.n) if g.cols is None or c in g.cols]
            cons.append((keys, g.lo, g.hi if g.hi is not None else BIG))
        for j, nid in enumerate(pz.countries):
            if f"I:{nid}" in pz.keys:
                for c in range(pz.n):
                    cons.append(([(f"I:{nid}", c)], 0, pz.caps[j] - v.emin[j][c]))
        for c, p in pz.rules.prices.items():
            cons.append(([(p, c)], 1, BIG))
        changed = True
        while changed:
            changed = False
            for keys, a, b in cons:
                slo = sum(lo[k] for k in keys)
                shi = sum(hi[k] for k in keys)
                if slo > b or shi < a:
                    raise Contradiction("impossible counts")
                for k in keys:
                    nlo = max(lo[k], a - (shi - hi[k]))
                    nhi = min(hi[k], b - (slo - lo[k]))
                    if nlo > nhi:
                        raise Contradiction("impossible counts")
                    if (nlo, nhi) != (lo[k], hi[k]):
                        slo += nlo - lo[k]
                        shi += nhi - hi[k]
                        lo[k], hi[k] = nlo, nhi
                        changed = True
        return lo, hi

    def solved(self, v: View) -> bool:
        if not v.single_sil:
            return False
        if all(len(v.dom[x]) == 1 for x in v.cells):
            return True
        lo, hi = self.bounds(v)
        if lo != hi:
            return False
        self._begin("swap")
        for c in sorted({c for r, c in v.cells if len(v.dom[(r, c)]) > 1}):
            parts = [f"{lo[k, c]} {k}" for k in self.pz.keys if lo.get((k, c))]
            self._cur.effects.append(f"{self.pz.columns[c]} : {', '.join(parts)} (ordre libre)")
            self._cur.cells += [x for x in v.column(c) if len(v.dom[x]) > 1]
        self._end()
        return True

    def composition(self, v: View) -> dict[str, Any]:
        pz = self.pz
        lo, _ = self.bounds(v)
        si, cols = next(iter(self.st.sil.items()))
        exps = [next(iter(es)) for es in cols]
        pumps, turbs = [0] * pz.n, [0] * pz.n
        for p, t in pz.step_options[si]:
            pumps[p] += 1
            turbs[t] += 1
        cells = [{k: lo[k, c] for k in sorted(pz.keys) if lo[k, c]} for c in range(pz.n)]
        return {
            "cells": cells,
            "exports": {nid: [e[j] for e in exps] for j, nid in enumerate(pz.countries)},
            "pumps": pumps,
            "turbines": turbs,
        }

    def check(self, v: View) -> None:
        """Cheap global consistency tests (also used to refute hypotheses)."""
        pz = self.pz
        for x in v.cells:
            if v.sure(x) and not v.dom[x]:
                raise Contradiction(f"cell {x} cannot be covered")
        for g in pz.rules.counts:
            scope = self.scope(v, g.cols)
            if g.hi is not None and sum(1 for x in scope if v.sure(x) and v.dom[x] and v.dom[x] <= g.keys) > g.hi:
                raise Contradiction("count exceeded")
            if sum(1 for x in scope if v.dom[x] & g.keys) < g.lo:
                raise Contradiction("count out of reach")
        placed_n = Counter(self._pw(i) for i in self.st.placed) if pz.rules.bars else Counter()
        avail_n = Counter(self._pw(i) for i in self.st.cands) if pz.rules.bars else Counter()
        for (p, w), k in pz.rules.bars.items():
            placed, avail = placed_n[p, w], avail_n[p, w]
            if placed > k or avail < k:
                raise Contradiction("inventory out of reach")
        for c, p in pz.rules.prices.items():
            want = pz.rank[p]
            for x in v.column(c):
                if v.sure(x) and v.dom[x] and all(self._over(k, want) for k in v.dom[x]):
                    raise Contradiction("price exceeded")
            if not any(p in v.dom[x] for x in v.column(c)):
                raise Contradiction("price out of reach")

    def scope(self, v: View, cols: frozenset[int] | None) -> list[Cell]:
        return v.cells if cols is None else [x for x in v.cells if x[1] in cols]

    def free(self) -> set[int]:
        return self.st.cands - self.st.placed

    def _pw(self, i: int) -> tuple[str, int]:
        return self.pz.pw[i]

    def _over(self, key: str, want: int | None) -> bool:
        r = self.pz.rank[key]
        return r is None or (want is not None and r > want)

    # ----- level 1 -----

    def r_room(self, v: View) -> bool:
        self._begin("room")
        bad = v.occ | ((1 << (self.pz.n * (max(v.maxh) + 4))) - 1) & ~v.under
        masks = self.pz.masks
        self.remove([i for i in self.free() if masks[i] & bad])
        return self._end()

    def _count_hi(self, v: View, kinds: tuple[str, ...]) -> None:
        pz = self.pz
        rm: set[int] = set()
        for g in pz.rules.counts:
            if g.rule not in kinds or g.hi is None:
                continue
            sure_in = {x for x in self.scope(v, g.cols) if v.sure(x) and v.dom[x] and v.dom[x] <= g.keys}
            left = g.hi - len(sure_in)
            hits = set()
            for i in self.free():
                pl = pz.placements[i]
                if pl.key not in g.keys:
                    continue
                k = sum(1 for x in pl.cells if (g.cols is None or x[1] in g.cols) and x not in sure_in)
                if k > left:
                    hits.add(i)
            if hits and self._cur is not None and g.clue is not None:
                self._cur.clues.append(g.clue)
            rm |= hits
        if "inventory" in kinds:
            for (p, w), k in pz.rules.bars.items():
                if sum(1 for i in self.st.placed if self._pw(i) == (p, w)) >= k:
                    rm |= {i for i in self.free() if self._pw(i) == (p, w)}
        self.remove(rm)

    def _count_lo(self, v: View, kinds: tuple[str, ...]) -> None:
        for g in self.pz.rules.counts:
            if g.rule not in kinds or g.lo == 0:
                continue
            possible = [x for x in self.scope(v, g.cols) if v.dom[x] & g.keys]
            if len(possible) < g.lo:
                raise Contradiction("count out of reach")
            if len(possible) > g.lo:
                continue
            before = len(self._cur.effects)
            self.remove({i for x in possible for i in v.cover[x] if self.pz.placements[i].key not in g.keys})
            need = {}
            for r, c in possible:
                need[c] = max(need.get(c, 0), r + 1)
            self.keep_sil(self._at_least(need))
            if len(self._cur.effects) > before:
                if g.clue is not None:
                    self._cur.clues.append(g.clue)
                self._cur.cells += possible
                return

    @staticmethod
    def _at_least(need: dict[int, int]) -> SilPred:
        return lambda c, h, e: h >= need.get(c, 0)

    @staticmethod
    def _at_most(cap: dict[int, int]) -> SilPred:
        return lambda c, h, e: h <= cap.get(c, BIG)

    def _day_totals(self, v: View) -> None:
        """Published day totals of exports (exchanges clue): counting over the columns."""
        if not self.clue_totals:
            return
        before = self.st.sil
        after = apply_totals(self.pz, before, {k: t for k, (t, _) in self.clue_totals.items()})
        if after != before:
            if not after:
                raise Contradiction("export total out of reach")
            self.st.sil = apply_totals(self.pz, after, self.inv_totals)
            self._cur.effects += self._describe_sil(before, self.st.sil) if self.record else ["totals"]
            self._cur.clues += [ci for _, ci in self.clue_totals.values()]

    def r_exhausted(self, v: View) -> bool:
        self._begin("exhausted")
        self._count_hi(v, ("inventory",))
        return self._end()

    def r_record(self, v: View) -> bool:
        self._begin("record")
        self._count_hi(v, ("record",))
        if not self._cur.effects:
            self._count_lo(v, ("record",))
        if not self._cur.effects:
            self._day_totals(v)
        return self._end()

    def r_flow(self, v: View) -> bool:
        self._begin("flow")
        self._count_hi(v, ("flow",))
        if not self._cur.effects:
            self._count_lo(v, ("flow",))
        return self._end()

    def r_price_cap(self, v: View) -> bool:
        pz = self.pz
        self._begin("price_cap")
        rm = []
        for i in self.free():
            pl = pz.placements[i]
            for c in range(pl.col, pl.col + pl.width):
                if c in pz.rules.prices and self._over(pl.key, pz.rank[pz.rules.prices[c]]):
                    rm.append(i)
                    self._cur.clues.append(pz.rules.price_clue[c])
                    break
        self.remove(rm)
        return self._end()

    def r_single_cover(self, v: View) -> bool:
        self._begin("single_cover")
        todo = v.sure_mask & ~v.occ
        if todo & ~v.u1:
            raise Contradiction("a cell cannot be covered")
        one = todo & ~v.u2
        masks = self.pz.masks
        self.place([i for i in self.st.cands if masks[i] & one])
        return self._end()

    def r_single_spot(self, v: View) -> bool:
        self._begin("single_spot")
        add: set[int] = set()
        for (p, w), k in self.pz.rules.bars.items():
            need = k - sum(1 for i in self.st.placed if self._pw(i) == (p, w))
            free = [i for i in self.free() if self._pw(i) == (p, w)]
            if need < 0 or len(free) < need:
                raise Contradiction("inventory out of reach")
            if need > 0 and len(free) == need:
                add |= set(free)
        self.place(add)
        return self._end()

    def _one_of(self, rule: str, items: list[tuple[Callable[[int], bool], int]]) -> bool:
        self._begin(rule)
        add = set()
        for match, clue in items:
            if any(match(i) for i in self.st.placed):
                continue
            rows = [i for i in self.st.cands if match(i)]
            if not rows:
                raise Contradiction(f"{rule} clue out of reach")
            if len(rows) == 1 and rows[0] not in add:
                add.add(rows[0])
                self._cur.clues.append(clue)
        self.place(add)
        return self._end()

    def r_program(self, v: View) -> bool:
        pz = self.pz
        return self._one_of(
            "program",
            [
                (
                    (
                        lambda i, p=p, c=c, w=w: (
                            pz.placements[i].key == p and pz.placements[i].col == c and pz.placements[i].width == w
                        )
                    ),
                    ci,
                )
                for p, c, w, ci in pz.rules.programs
            ],
        )

    def r_length(self, v: View) -> bool:
        pz = self.pz
        return self._one_of(
            "length",
            [
                ((lambda i, p=p, w=w: pz.placements[i].key == p and pz.placements[i].width == w), ci)
                for p, w, ci in pz.rules.lengths
            ],
        )

    def r_silhouette(self, v: View) -> bool:
        pz = self.pz
        self._begin("silhouette")
        need: dict[int, int] = {}
        for r, c in v.occupied:
            need[c] = max(need.get(c, 0), r + 1)
        cap: dict[int, int] = {}
        for r, c in v.cells:
            if not v.dom[(r, c)]:
                cap[c] = min(cap.get(c, BIG), r)
        lines: list[tuple[int, int, list[int]]] = []
        for j, nid in enumerate(pz.countries):
            key = f"I:{nid}"
            if key not in pz.keys:
                continue
            for c in range(pz.n):
                rows = [r for r in range(v.maxh[c]) if v.dom[(r, c)] == frozenset([key])]
                if rows:
                    lines.append((j, c, rows))

        def keep(c: int, h: int, e: Exports) -> bool:
            if h < need.get(c, 0) or h > cap.get(c, BIG):
                return False
            return all(e[j] + sum(1 for r in rows if r < h) <= pz.caps[j] for j, cc, rows in lines if cc == c)

        self.keep_sil(keep)
        return self._end()

    # ----- level 2 -----

    def r_top_price(self, v: View) -> bool:
        pz = self.pz
        for c, p in sorted(pz.rules.prices.items()):
            col = v.column(c)
            if any(v.sure(x) and v.dom[x] == frozenset([p]) for x in col):
                continue
            cand = [x for x in col if p in v.dom[x]]
            if not cand:
                raise Contradiction("price out of reach")
            if len(cand) == 1:
                x = cand[0]
                self._begin("top_price", [pz.rules.price_clue[c]])
                self.remove([i for i in v.cover[x] if pz.placements[i].key != p])
                self.keep_sil(self._at_least({c: x[0] + 1}))
                self._cur.cells.append(x)
                if self._end():
                    return True
        return False

    def _row_status(self, v: View, r: int) -> list[str]:
        return ["absent" if r >= v.maxh[c] else "sure" if r < v.minh[c] else "maybe" for c in range(self.pz.n)]

    def _row_segments(self, r: int) -> dict[int, list[tuple[int, int]]]:
        """Candidates covering row r, by first column: (placement, end column)."""
        out: dict[int, list[tuple[int, int]]] = {}
        spans = self.pz.spans
        for i in self.st.cands:
            span = spans[i].get(r)
            if span:
                out.setdefault(span[0], []).append((i, span[1]))
        return out

    def _row_apply(
        self, rule: str, r: int, status: list[str], ways: int, through: dict[int, int], skipped: dict[int, int]
    ) -> bool:
        self._begin(rule)
        self.remove({i for i, k in through.items() if k == 0})
        self.place({i for i, k in through.items() if k == ways} - self.st.placed)
        need, cap = {}, {}
        for c, k in skipped.items():
            if status[c] != "maybe":
                continue
            if k == 0:
                need[c] = r + 1
            elif k == ways:
                cap[c] = r
        if need or cap:
            a, b = self._at_least(need), self._at_most(cap)
            self.keep_sil(lambda c, h, e: a(c, h, e) and b(c, h, e))
        self._cur.cells += [(r, c) for c in range(self.pz.n) if status[c] != "absent"]
        return self._end()

    def r_ribbon(self, v: View) -> bool:
        n = self.pz.n
        for r in range(max(v.maxh)):
            status = self._row_status(v, r)
            segs = self._row_segments(r)
            f = [0] * (n + 1)
            f[0] = 1
            for i in range(n):
                if f[i] == 0:
                    continue
                if status[i] != "sure":
                    f[i + 1] += f[i]
                for _, end in segs.get(i, ()):
                    f[end] += f[i]
            g = [0] * (n + 1)
            g[n] = 1
            for i in range(n - 1, -1, -1):
                g[i] = (g[i + 1] if status[i] != "sure" else 0) + sum(g[end] for _, end in segs.get(i, ()))
            ways = f[n]
            if ways == 0:
                raise Contradiction(f"row {r + 1} cannot be split")
            through = {pi: f[a] * g[end] for a, lst in segs.items() for pi, end in lst}
            skipped = {c: f[c] * g[c + 1] for c in range(n)}
            if self._row_apply("ribbon", r, status, ways, through, skipped):
                return True
        return False

    def r_just_enough(self, v: View) -> bool:
        self._begin("just_enough")
        self._count_lo(v, ("inventory",))
        return self._end()

    def r_column_sum(self, v: View) -> bool:
        lo, hi = self.bounds(v)
        self._begin("column_sum")
        rm: set[int] = set()
        need: dict[int, int] = {}
        for (k, c), top in hi.items():
            col = v.column(c)
            sure = [x for x in col if v.sure(x) and v.dom[x] == frozenset([k])]
            possible = [x for x in col if k in v.dom[x]]
            if top == len(sure) < len(possible):
                rm |= {i for x in possible if x not in sure for i in v.cover[x] if self.pz.placements[i].key == k}
            if lo[k, c] == len(possible) > len(sure):
                rm |= {i for x in possible for i in v.cover[x] if self.pz.placements[i].key != k}
                for r, cc in possible:
                    need[cc] = max(need.get(cc, 0), r + 1)
        self.remove(rm)
        if need:
            self.keep_sil(self._at_least(need))
        return self._end()

    def r_carbon(self, v: View) -> bool:
        pz = self.pz
        if pz.rules.co2_cap is None:
            return False
        self._begin("carbon")
        low = {x: (min(pz.co2[k] for k in v.dom[x]) if v.sure(x) and v.dom[x] else 0) for x in v.cells}
        base = sum(low.values())
        rm = [
            i
            for i in self.free()
            if base + sum(pz.co2[pz.placements[i].key] - low.get(x, 0) for x in pz.placements[i].cells)
            > pz.rules.co2_cap
        ]
        self.remove(rm)
        return self._end()

    # ----- level 3 -----

    def _flat(self, key: str) -> bool:
        """Every candidate of this key lies in a single row."""
        return all(
            len({r for r, _ in self.pz.placements[i].cells}) == 1
            for i in self.st.cands
            if self.pz.placements[i].key == key
        )

    def _dims(self) -> tuple[list[Any], tuple[int, ...]]:
        pz = self.pz
        dims: list[Any] = []
        target: list[int] = []
        for (p, w), k in sorted(pz.rules.bars.items()):
            if self._flat(p):
                dims.append(("x", p, w))
                target.append(k)
        for g in pz.rules.counts:
            if g.cols is None and g.hi == g.lo and all(self._flat(k) for k in g.keys):
                dims.append(("c", g.keys))
                target.append(g.lo)
        return dims, tuple(target)

    def _vector(self, dims: list[Any], tiling: tuple[int, ...]) -> tuple[int, ...]:
        pls = [self.pz.placements[i] for i in tiling]
        out = []
        for d in dims:
            if d[0] == "x":
                out.append(sum(1 for pl in pls if pl.key == d[1] and pl.width == d[2] and pl.shape.height == 1))
            else:
                out.append(sum(pl.width for pl in pls if pl.key in d[1] and len(pl.cells) == pl.width))
        return tuple(out)

    def _tilings(self, v: View, r: int) -> list[tuple[tuple[int, ...], frozenset[int]]] | None:
        n = self.pz.n
        status = self._row_status(v, r)
        segs = self._row_segments(r)
        out: list[tuple[tuple[int, ...], frozenset[int]]] = []

        def rec(i: int, acc: list[int], skipped: list[int]) -> bool:
            if len(out) > MAX_TILINGS:
                return False
            if i == n:
                out.append((tuple(acc), frozenset(skipped)))
                return True
            if status[i] != "sure" and not rec(i + 1, acc, skipped + [i] if status[i] == "maybe" else skipped):
                return False
            for pi, end in segs.get(i, ()):
                if not rec(end, acc + [pi], skipped):
                    return False
            return True

        return out if rec(0, [], []) else None

    def r_share_out(self, v: View) -> bool:
        dims, target = self._dims()
        if not dims:
            return False
        rows = list(range(max(v.maxh)))
        per_row = []
        for r in rows:
            t = self._tilings(v, r)
            if t is None:
                return False
            if not t:
                raise Contradiction(f"row {r + 1} cannot be split")
            per_row.append([(til, skip, self._vector(dims, til)) for til, skip in t])
        vecs = [sorted({u for _, _, u in tl}) for tl in per_row]

        def add(a: tuple[int, ...], b: tuple[int, ...]) -> tuple[int, ...] | None:
            s = tuple(x + y for x, y in zip(a, b))
            return s if all(x <= t for x, t in zip(s, target)) else None

        zero = tuple(0 for _ in dims)
        prefix = [{zero}]
        work = 0
        for us in vecs:
            nxt = set()
            for p in prefix[-1]:
                for u in us:
                    s = add(p, u)
                    if s is not None:
                        nxt.add(s)
            work += len(prefix[-1]) * len(us)
            if work > MAX_SHARE_WORK:
                return False
            prefix.append(nxt)
        suffix: list[set[tuple[int, ...]]] = [set() for _ in range(len(rows) + 1)]
        suffix[len(rows)] = {zero}
        for i in range(len(rows) - 1, -1, -1):
            for p in suffix[i + 1]:
                for u in vecs[i]:
                    s = add(p, u)
                    if s is not None:
                        suffix[i].add(s)
        if target not in prefix[-1]:
            raise Contradiction("inventory cannot be shared out")
        for i, r in enumerate(rows):
            ok_u = set()
            for u in vecs[i]:
                for p in prefix[i]:
                    rest = tuple(t - x - y for t, x, y in zip(target, p, u))
                    if min(rest) >= 0 and rest in suffix[i + 1]:
                        ok_u.add(u)
                        break
            good = [(til, skip) for til, skip, u in per_row[i] if u in ok_u]
            if len(good) == len(per_row[i]):
                continue
            through = {pi: 0 for lst in self._row_segments(r).values() for pi, _ in lst}
            skipped = {c: 0 for c in range(self.pz.n)}
            for til, skip in good:
                for pi in til:
                    through[pi] += 1
                for c in skip:
                    skipped[c] += 1
            if self._row_apply("share_out", r, self._row_status(v, r), len(good), through, skipped):
                return True
        return False

    # ----- level 4 -----

    def _fails(self, st: State) -> bool:
        sub = Solver(self.pz, st, max_level=2, record=False)
        try:
            while True:
                v = View(self.pz, sub.st)
                sub.check(v)
                if sub.solved(v):
                    return False
                for level, rule in sub.rules:
                    if level <= 2 and rule(v):
                        break
                else:
                    return False
        except Contradiction:
            return True

    def r_refuted(self, v: View) -> bool:
        pz = self.pz
        self._begin("refuted")
        bad = []
        for i in sorted(self.free()):
            st = self.st.copy()
            st.placed.add(i)
            if self._fails(st):
                bad.append(i)
        if bad:
            for i in bad:
                self._cur.effects.append(f"poser {pz.placements[i].label(pz.columns)} mène à une impasse")
            saved = list(self._cur.effects)
            self.remove(bad)
            self._cur.effects = saved
            return self._end()
        # Silhouette hypotheses: one STEP option, then one export tuple in one column.
        hyps: list[tuple[str, int, Any, Sil]] = []
        if len(self.st.sil) > 1:
            hyps += [("step", si, None, {si: cols}) for si, cols in self.st.sil.items()]
        for c in range(pz.n):
            values = {e for cols in self.st.sil.values() for e in cols[c]}
            if len(values) > 1:
                for e0 in sorted(values):
                    hyps.append(
                        (
                            "export",
                            c,
                            e0,
                            {
                                si: [frozenset([e0]) if cc == c else es for cc, es in enumerate(cols)]
                                for si, cols in self.st.sil.items()
                                if e0 in cols[c]
                            },
                        )
                    )
        for kind, a, e0, sil in hyps:
            st = self.st.copy()
            st.sil = apply_totals(pz, sil, self.inv_totals)
            if st.sil and not self._fails(st):
                continue
            if kind == "step":
                p_t = ", ".join(f"{pz.columns[p]} -> {pz.columns[t]}" for p, t in pz.step_options[a])
                self._cur.effects.append(f"le pompage {p_t} mène à une impasse")
                self.keep_sil(lambda c, h, e: True, steps=lambda si, a=a: si != a)
            else:
                self._cur.effects.append(f"les exports {e0} à {pz.columns[a]} mènent à une impasse")
                self._cur.cells.append((0, a))
                self.keep_sil(lambda c, h, e, a=a, e0=e0: c != a or e != e0)
            return self._end()
        return self._end()


def rule_level(rule: str) -> int:
    return RULES[rule].level
