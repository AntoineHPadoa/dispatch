"""Independent checker: applies a solution to a grid and computes its numbers.

- Validates bars (length, bounds, silhouette, overlap), coverage, caps, line, STEP, curtailment.
- Computes v2 score and cell cost, v1 cost and facture, CO2, and the objective constraints.
- Used by the tests to cross-check every solution the CP-SAT model returns.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .grid import Grid


@dataclass
class Evaluation:
    complete: bool
    errors: list[str] = field(default_factory=list)
    heights: list[int] = field(default_factory=list)
    curtail: list[int] = field(default_factory=list)
    col_price: list[int] = field(default_factory=list)
    score: int = 0
    cost: int = 0
    cell_cost: int = 0  # v2 cost: sum of the prices of all cells laid
    facture: int = 0
    co2: int = 0
    composition: tuple = ()


def composition_key(counts: dict[str, list[int]], exports: dict[str, list[int]],
                    step: list[tuple[int, int]], curtail: list[int]) -> tuple:
    """Canonical composition: cells per piece and column, exports, STEP pairs, curtailment."""
    return (
        tuple(sorted((pid, tuple(v)) for pid, v in counts.items() if any(v))),
        tuple(sorted((nid, tuple(v)) for nid, v in exports.items() if any(v))),
        tuple(sorted(step)),
        tuple(curtail),
    )


def evaluate(grid: Grid, solution: dict[str, Any]) -> Evaluation:
    n = grid.n
    errors: list[str] = []
    exports = grid.read_exports(solution.get("exports"))
    total_exp = [sum(v[c] for v in exports.values()) for c in range(n)]
    step = [(int(s["pump"]), int(s["turbine"])) for s in solution.get("step") or []]
    bars = solution.get("placements") or []

    by_id = {nb.id: nb for nb in grid.neighbors}
    for nid, vals in exports.items():
        nb = by_id.get(nid)
        top = nb.cap if nb and nb.can_export else 0
        for c, e in enumerate(vals):
            if e < 0 or e > top:
                errors.append(f"export to {nid} out of range at column {c}")
    if len(step) > grid.step:
        errors.append("too many STEP pairs")
    for p, t in step:
        if not (0 <= p < t < n):
            errors.append(f"invalid STEP pair {p}->{t}")

    raw = []
    for c in range(n):
        v = grid.residual[c] + total_exp[c]
        v += sum(1 for p, _ in step if p == c) - sum(1 for _, t in step if t == c)
        raw.append(v)
    eff = [max(0, v) for v in raw]
    curtail = [max(0, -v) for v in raw]
    if any(curtail) and grid.curtail_penalty is None:
        errors.append("curtailment not allowed")

    known = set(grid.piece_ids())
    covered: set[tuple[int, int]] = set()
    counts: dict[str, list[int]] = {pid: [0] * n for pid in known}
    for b in bars:
        pid, r, c0, length = b["piece"], b["row"], b["col"], b["len"]
        if pid not in known:
            errors.append(f"unknown piece {pid}")
            continue
        if length not in grid.piece_lens(pid):
            errors.append(f"bad length {length} for {pid}")
        if c0 < 0 or r < 0 or c0 + length > n:
            errors.append("bar out of bounds")
            continue
        for k in range(c0, c0 + length):
            if r >= eff[k]:
                errors.append(f"bar {pid} outside silhouette at column {k}")
            if (r, k) in covered:
                errors.append(f"overlap at row {r} column {k}")
            covered.add((r, k))
            counts[pid][k] += 1

    for pid in known:
        cap = grid.piece_cap(pid)
        if cap is not None and sum(counts[pid]) > cap:
            errors.append(f"cap exceeded for {pid}")
    imp_of = {nb.id: pid for pid, nb in grid.importers.items()}
    for nb in grid.neighbors:
        imp = counts.get(imp_of.get(nb.id, ""), [0] * n)
        for c in range(n):
            if exports[nb.id][c] + imp[c] > nb.cap:
                errors.append(f"line to {nb.id} saturated at column {c}")
    missing = sum(1 for c in range(n) for r in range(eff[c]) if (r, c) not in covered)
    if missing:
        errors.append(f"{missing} uncovered cells")

    col_price = []
    cost = co2 = 0
    for c in range(n):
        prices = [grid.piece_price(pid, c) for pid in known if counts[pid][c] > 0]
        col_price.append(max(prices) if prices and eff[c] > 0 else 0)
        for pid in known:
            cost += counts[pid][c] * grid.piece_price(pid, c)
            co2 += counts[pid][c] * grid.piece_co2(pid)
    pen = grid.curtail_penalty or 0
    revenue = sum(exports[nb.id][c] * nb.price[c] for nb in grid.neighbors for c in range(n))
    cell_cost = cost
    cost += pen * sum(curtail) - revenue
    score = sum(col_price) - revenue + pen * sum(curtail)
    facture = sum(eff[c] * col_price[c] for c in range(n))

    obj = grid.objective
    if obj.co2_cap is not None and co2 > obj.co2_cap:
        errors.append("co2 cap exceeded")
    if obj.price_cap is not None and max(col_price, default=0) > obj.price_cap:
        errors.append("price cap exceeded")
    if obj.no_import and any(sum(counts[pid]) for pid in grid.importers):
        errors.append("imports forbidden")
    if obj.smooth is not None:
        for c in range(n - 1):
            if abs(col_price[c] - col_price[c + 1]) > obj.smooth:
                errors.append(f"price jump between columns {c} and {c + 1}")

    return Evaluation(
        complete=not errors, errors=errors, heights=eff, curtail=curtail, col_price=col_price,
        score=score, cost=cost, cell_cost=cell_cost, facture=facture, co2=co2,
        composition=composition_key(counts, exports, step, curtail),
    )
