"""CP-SAT model of a Dispatch grid: exact placement of bars under a variable silhouette.

- Variables: exports, STEP pairs, column heights (with curtailment), one boolean per possible bar.
- Expressions: v2 score, v2 cell cost, v1 cost and facture, CO2, per-column price.
- `solve()` optimizes, `count()` enumerates distinct optimal compositions with no-good cuts.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ortools.sat.python import cp_model

from .grid import Grid


@dataclass
class Handles:
    grid: Grid
    model: cp_model.CpModel
    exports: dict[str, list[Any]]  # neighbor id -> per-column export
    step: dict[tuple[int, int], Any]
    heff: list[Any]
    curtail: list[Any]
    bars: dict[tuple[str, int, int, int], Any]  # (piece, row, col, len) -> bool
    counts: dict[str, list[Any]]
    col_price: list[Any]
    score: Any
    cost: Any  # v1 cost: cell prices + curtailment penalties - export revenue
    cell_cost: Any  # v2 cost: sum of the prices of all cells laid (imports at the neighbor price)
    facture: Any
    co2: Any
    trades: Any  # blocks exchanged with neighbors (imports + exports), the v2 tie-break
    program: list[Any]  # variables whose values define a distinct solution for counting


def build(grid: Grid, mode: str = "v2") -> Handles:
    """Build the model. `mode` "v1" adds the facture expression; constraints apply in both modes."""
    m = cp_model.CpModel()
    n = grid.n
    obj = grid.objective
    pids = grid.piece_ids(allow_import=not obj.no_import)
    hb = [grid.height_bound(c) for c in range(n)]
    hmax = max(hb + [0])

    exports = {nb.id: [m.NewIntVar(0, nb.cap if nb.can_export else 0, f"e_{nb.id}_{c}") for c in range(n)]
               for nb in grid.neighbors}
    step: dict[tuple[int, int], Any] = {}
    if grid.step:
        for p in range(n):
            for t in range(p + 1, n):
                step[p, t] = m.NewIntVar(0, grid.step, f"s{p}_{t}")
        m.Add(sum(step.values()) <= grid.step)

    heff, curtail, rows = [], [], []
    for c in range(n):
        pumps = sum(v for (p, _), v in step.items() if p == c)
        turbs = sum(v for (_, t), v in step.items() if t == c)
        lo = grid.residual[c] - grid.step
        hraw = m.NewIntVar(min(lo, 0), hb[c], f"hraw{c}")
        m.Add(hraw == grid.residual[c] + sum(e[c] for e in exports.values()) + pumps - turbs)
        h = m.NewIntVar(0, hb[c], f"h{c}")
        cu = m.NewIntVar(0, max(0, -lo), f"cu{c}")
        if grid.curtail_penalty is not None:
            m.AddMaxEquality(h, [hraw, 0])
        else:
            m.Add(hraw >= 0)
            m.Add(h == hraw)
        m.Add(cu == h - hraw)
        heff.append(h)
        curtail.append(cu)
        # y[r] <=> r < h (monotone column of cells to pave)
        y = [m.NewBoolVar(f"y{r}_{c}") for r in range(hb[c])]
        for r in range(1, len(y)):
            m.AddImplication(y[r], y[r - 1])
        m.Add(sum(y) == h)
        rows.append(y)

    bars: dict[tuple[str, int, int, int], Any] = {}
    cover: dict[tuple[int, int], list[Any]] = {}
    counts = {pid: [[] for _ in range(n)] for pid in pids}
    for pid in pids:
        for length in grid.piece_lens(pid):
            for c0 in range(n - length + 1):
                top = min(hb[c0:c0 + length])
                for r in range(top):
                    b = m.NewBoolVar(f"x_{pid}_{r}_{c0}_{length}")
                    bars[pid, r, c0, length] = b
                    for k in range(c0, c0 + length):
                        cover.setdefault((r, k), []).append(b)
                        counts[pid][k].append(b)
    for c in range(n):
        for r in range(hb[c]):
            m.Add(sum(cover.get((r, c), [])) == rows[c][r])

    cnt = {pid: [m.NewIntVar(0, hmax, f"n_{pid}_{c}") for c in range(n)] for pid in pids}
    for pid in pids:
        for c in range(n):
            m.Add(cnt[pid][c] == sum(counts[pid][c]))
        cap = grid.piece_cap(pid)
        if cap is not None:
            m.Add(sum(cnt[pid]) <= cap)
    # Line of each neighbor: exports + imports <= its capacity.
    imp_of = {nb.id: pid for pid, nb in grid.importers.items() if pid in cnt}
    for nb in grid.neighbors:
        for c in range(n):
            imp = cnt[imp_of[nb.id]][c] if nb.id in imp_of else 0
            m.Add(exports[nb.id][c] + imp <= nb.cap)

    # Column price = max price of the pieces used in the column, 0 if nothing to pave.
    all_prices = [grid.piece_price(pid, c) for pid in pids for c in range(n)] + [0]
    low = min(all_prices) - 1
    high = max(all_prices)
    col_price = []
    for c in range(n):
        terms = []
        for pid in pids:
            u = m.NewBoolVar(f"u_{pid}_{c}")
            m.Add(cnt[pid][c] >= 1).OnlyEnforceIf(u)
            m.Add(cnt[pid][c] == 0).OnlyEnforceIf(u.Not())
            price = grid.piece_price(pid, c)
            terms.append(low + (price - low) * u)
        nonempty = rows[c][0] if rows[c] else 0
        terms.append(low * nonempty)
        cp = m.NewIntVar(low, high, f"cp{c}")
        m.AddMaxEquality(cp, terms)
        col_price.append(cp)

    pen = grid.curtail_penalty or 0
    for nb in grid.neighbors:
        if nb.export_budget is not None:
            m.Add(sum(exports[nb.id]) <= nb.export_budget)
    import_vars = [v for pid in imp_of.values() for v in cnt[pid]]
    export_vars = [e for es in exports.values() for e in es]
    trades = sum(import_vars) + sum(export_vars)
    if mode == "v1":
        # Legacy uniqueness: cells per piece and column, exports, STEP.
        program = [v for vs in cnt.values() for v in vs] + export_vars + list(step.values())
    else:
        # Composition: cells per piece (and country for imports) and column, exports, STEP, curtailment.
        program = [v for vs in cnt.values() for v in vs] + export_vars + list(step.values()) + curtail
    revenue = sum(exports[nb.id][c] * nb.price[c] for nb in grid.neighbors for c in range(n))
    co2 = sum(cnt[pid][c] * grid.piece_co2(pid) for pid in pids for c in range(n))
    score = sum(col_price) - revenue + pen * sum(curtail)
    cost = (sum(cnt[pid][c] * grid.piece_price(pid, c) for pid in pids for c in range(n))
            + pen * sum(curtail) - revenue)

    cell_cost = sum(cnt[pid][c] * grid.piece_price(pid, c) for pid in pids for c in range(n))

    facture = 0
    if mode == "v1":
        fs = []
        for c in range(n):
            f = m.NewIntVar(min(0, low * hb[c]), max(0, high * hb[c]), f"f{c}")
            m.AddMultiplicationEquality(f, [heff[c], col_price[c]])
            fs.append(f)
        facture = sum(fs)

    if obj.co2_cap is not None:
        m.Add(co2 <= obj.co2_cap)
    if obj.price_cap is not None:
        for cp in col_price:
            m.Add(cp <= obj.price_cap)
    if obj.smooth is not None:
        for c in range(n - 1):
            m.Add(col_price[c] - col_price[c + 1] <= obj.smooth)
            m.Add(col_price[c + 1] - col_price[c] <= obj.smooth)

    return Handles(grid, m, exports, step, heff, curtail, bars, cnt, col_price, score, cost, cell_cost,
                   facture, co2, trades, program)


@dataclass
class SolveResult:
    status: str  # "optimal" | "infeasible" | "unknown"
    value: int | None = None
    solution: dict[str, Any] | None = None
    wall: float = 0.0


@dataclass
class CountResult:
    count: int
    capped: bool
    compositions: list[dict[str, Any]] = field(default_factory=list)
    solutions: list[dict[str, Any]] = field(default_factory=list)
    wall: float = 0.0

    @property
    def label(self) -> str:
        return f">= {self.count}" if self.capped else str(self.count)


def _solver(time_limit: float, workers: int) -> cp_model.CpSolver:
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = time_limit
    s.parameters.num_workers = workers
    return s


def extract(h: Handles, s: cp_model.CpSolver) -> dict[str, Any]:
    exports = {nid: [s.Value(e) for e in es] for nid, es in h.exports.items()}
    step = []
    for (p, t), v in sorted(h.step.items()):
        step += [{"pump": p, "turbine": t}] * s.Value(v)
    placements = [
        {"piece": pid, "row": r, "col": c, "len": length}
        for (pid, r, c, length), b in h.bars.items() if s.Value(b)
    ]
    placements.sort(key=lambda b: (b["row"], b["col"]))
    return {
        "exports": h.grid.write_exports(exports),
        "step": step,
        "curtail": [s.Value(c) for c in h.curtail],
        "placements": placements,
    }


def composition_of(h: Handles, s: cp_model.CpSolver) -> dict[str, Any]:
    return {
        "prices": [s.Value(v) for v in h.col_price],
        "counts": {pid: [s.Value(v) for v in vs] for pid, vs in h.counts.items()
                   if any(s.Value(v) for v in vs)},
        "exports": h.grid.write_exports({nid: [s.Value(e) for e in es] for nid, es in h.exports.items()}),
        "step": {f"{p}->{t}": s.Value(v) for (p, t), v in h.step.items() if s.Value(v)},
        "curtail": [s.Value(c) for c in h.curtail],
    }


def minimize(h: Handles, expr: Any, time_limit: float = 60.0, workers: int = 8) -> SolveResult:
    t0 = time.perf_counter()
    h.model.Minimize(expr)
    s = _solver(time_limit, workers)
    st = s.Solve(h.model)
    h.model.ClearObjective()
    wall = time.perf_counter() - t0
    if st == cp_model.OPTIMAL:
        return SolveResult("optimal", int(round(s.ObjectiveValue())), extract(h, s), wall)
    if st == cp_model.INFEASIBLE:
        return SolveResult("infeasible", wall=wall)
    return SolveResult("unknown", wall=wall)


def count(h: Handles, cap: int = 10, time_limit: float = 60.0, workers: int = 8) -> CountResult:
    """Count distinct compositions satisfying the model (call after fixing the objective value)."""
    t0 = time.perf_counter()
    comp_vars = h.program
    res = CountResult(0, False)
    while res.count < cap:
        s = _solver(time_limit, workers)
        st = s.Solve(h.model)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            if st != cp_model.INFEASIBLE:
                raise TimeoutError("composition count did not finish within the time limit")
            break
        res.count += 1
        res.compositions.append(composition_of(h, s))
        res.solutions.append(extract(h, s))
        # No-good: at least one composition variable differs from this assignment.
        diffs = []
        for v in comp_vars:
            val = s.Value(v)
            d = h.model.NewBoolVar("")
            h.model.Add(v != val).OnlyEnforceIf(d)
            h.model.Add(v == val).OnlyEnforceIf(d.Not())
            diffs.append(d)
        h.model.AddBoolOr(diffs)
    else:
        res.capped = True
    res.wall = time.perf_counter() - t0
    return res
