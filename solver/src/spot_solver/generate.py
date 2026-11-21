"""Random grid generator: draws silhouettes, solves them, keeps only publishable v2 grids.

- Residual demand: bounded random walk (daily-curve look), optional surplus column (< 0).
- Neighbor prices: random walk in [-2, 3], rare 4-5 peaks; daily export budget per neighbor.
- One legacy neighbor or several (`neighbors`, CO2 per import).
- Objective `min_score`, or `target`: the smallest score above the optimum reached by exactly one composition.
- Mode `pose`: reference pose = v2 minimal score; inventory at the requested level (exact, bars, cells,
  none). Lore clues (default from the CLI): smallest mix of clues (price, bar, column, given, flow) making
  the grid solvable by the human deduction solver (`deduce.py`), hence unique; optional target rating.
  Legacy (`clue_types=None`): smallest set of price clues making the composition unique.
  Both are greedy then pruned, and rejected beyond `max_clues`.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any

from . import deduce, pose
from .evaluate import evaluate
from .grid import from_dict
from .solve import solve_v2

# Score v2 scale (scoring-v2.md §1).
PIECE_TABLE: dict[str, dict[str, Any]] = {
    "N": {"len": [3, 4, 5, 6], "price": 0, "co2": 0},
    "B": {"len": [1], "price": 1, "co2": 0},
    "C": {"len": [3, 4, 5], "price": 1, "co2": 3},
    "G": {"len": [2, 3], "price": 2, "co2": 1},
    "T": {"len": [1], "price": 5, "co2": 2},
}


@dataclass
class GenParams:
    cols: int = 8
    hmin: int = 1
    hmax: int = 6
    pieces: list[str] = field(default_factory=lambda: ["N", "G", "T"])
    b_cap: int = 2
    n_cap: int | None = None
    neighbor: bool = False
    neighbor_cap: int = 1
    neighbors: dict[str, int] | None = None  # neighbor id -> CO2 per imported cell
    export_budget: int = 2
    peak_rate: float = 0.1  # chance per slot of an exceptional 4-5 neighbor price
    step: int = 0
    surplus: bool = False
    curtail_penalty: int = 2
    objective: str = "min_score"
    target_span: int = 6
    price_cap: int | None = None
    co2_cap: int | None = None
    no_import: bool = False
    smooth: int | None = None
    count: int = 5
    seed: int = 1
    min_difficulty: float = 0.0
    max_attempts: int = 500
    time_limit: float = 20.0
    mode: str = "v2"  # "v2" | "pose"
    level: str = "exact"  # pose inventory level: exact | bars | cells | none
    max_clues: int | None = None  # pose: default half the slots (legacy), the number of slots (lore)
    clue_types: list[str] | None = None  # pose: lore clue types; None = legacy price clues, uniqueness only
    rating: int | None = None  # pose (lore): keep only grids whose deduction rating is exactly this


def _walk(rng: random.Random, n: int, lo: int, hi: int, start: int | None = None) -> list[int]:
    v = rng.randint(lo, hi) if start is None else start
    out = []
    for _ in range(n):
        out.append(v)
        v = max(lo, min(hi, v + rng.choice([-2, -1, -1, 0, 1, 1, 2])))
    return out


def _prices(rng: random.Random, p: GenParams) -> list[int]:
    prices = _walk(rng, p.cols, -2, 3)
    return [rng.randint(4, 5) if rng.random() < p.peak_rate else v for v in prices]


def column_labels(n: int) -> list[str]:
    return [f"{(i * 24) // n}h" for i in range(n)]


def draw_grid(rng: random.Random, p: GenParams, index: int) -> dict[str, Any]:
    if not 4 <= p.cols <= 12:
        raise ValueError("cols must be between 4 and 12")
    residual = _walk(rng, p.cols, p.hmin, p.hmax)
    if p.surplus:
        residual[rng.randrange(p.cols)] = -rng.randint(1, 2)
    pieces: dict[str, Any] = {}
    for pid in p.pieces:
        spec = dict(PIECE_TABLE[pid])
        spec["len"] = [x for x in spec["len"] if x <= p.cols]
        if pid == "B":
            spec["cap"] = p.b_cap
        if pid == "N" and p.n_cap is not None:
            spec["cap"] = p.n_cap
        pieces[pid] = spec
    grid: dict[str, Any] = {
        "id": index,
        "title": f"Generated {index}",
        "columns": column_labels(p.cols),
        "residual": residual,
        "pieces": pieces,
    }
    if p.neighbors:
        grid["neighbors"] = [
            {"id": nid, "name": nid, "price": _prices(rng, p), "cap": p.neighbor_cap,
             "export_budget": p.export_budget, "import": True, "export": True, "co2": co2}
            for nid, co2 in p.neighbors.items()
        ]
    elif p.neighbor:
        grid["neighbor"] = {
            "name": "Voisin",
            "price": _prices(rng, p),
            "cap": p.neighbor_cap,
            "export_budget": p.export_budget,
            "import": True,
            "export": True,
        }
    if p.surplus:
        grid["curtail_penalty"] = p.curtail_penalty
    if p.step:
        grid["step"] = p.step
    cons = {k: v for k, v in {"price_cap": p.price_cap, "co2_cap": p.co2_cap,
                              "smooth": p.smooth}.items() if v is not None}
    if p.no_import:
        cons["no_import"] = True
    grid["objective"] = {"optimize": "min_score", "target": None, "constraints": cons}
    return grid


def finalize(grid: dict[str, Any], res: dict[str, Any]) -> dict[str, Any]:
    grid["optimum"] = {"score": res["score"], "co2": res["co2"]}
    grid["solution"] = res["solution"]
    grid["difficulty"] = res["difficulty"]
    return grid


def pose_inventory(grid: Any, solution: dict[str, Any], level: str, co2_cap: int | None) -> dict[str, Any]:
    """Inventory of a reference solution at the given level (pose-mode.md §2)."""
    bars: dict[str, list[int]] = {}
    for b in solution["placements"]:
        bars.setdefault(b["piece"], []).append(b["len"])
    pieces: dict[str, Any] = {}
    for pid, spec in grid.pieces.items():
        lens = sorted(bars.get(pid, []), reverse=True)
        if not lens:
            continue
        if level == "none":
            pieces[pid] = {}  # the piece is available, its count is not given
        elif len(spec.lens) == 1 and spec.lens[0] == 1 or level == "cells":
            pieces[pid] = {"cells": sum(lens)}
        elif level == "bars":
            pieces[pid] = {"count": len(lens), "cells": sum(lens)}
        else:
            pieces[pid] = {"bars": lens}
    by_nb = {nb.id: sum(len(bars.get(pid, [])) for pid in [grid.import_pid(nb)]) for nb in grid.importers.values()}
    imports: dict[str, int] = {nb.id: by_nb.get(nb.id, 0) for nb in grid.neighbors if nb.can_import}
    if len(imports) > 1 and co2_cap is not None:
        imports = {pose.ANY_COUNTRY: sum(imports.values())}
    exports = grid.read_exports(solution["exports"])
    return {
        "level": level,
        "pieces": pieces,
        "exports": {nb.id: sum(exports[nb.id]) for nb in grid.neighbors if nb.can_export},
        "imports": imports,
        "step": len(solution["step"]),
    }


def _kinds(inv: dict[str, Any]) -> int:
    """Distinct ingredients of an inventory: piece kinds, imports, exports, STEP."""
    return (len(inv["pieces"]) + (sum(inv["imports"].values()) > 0) + (sum(inv["exports"].values()) > 0)
            + (inv["step"] > 0))


def minimal_clues(d: dict[str, Any], ref_prices: list[int], tl: float) -> list[int | None] | None:
    """Smallest set of price clues giving a unique composition: greedy reveal, then prune. None if impossible."""
    n = len(ref_prices)
    if pose.count_pose(d, list(ref_prices), cap=2, time_limit=tl).count != 1:
        return None  # not unique even with every price published
    clues: list[int | None] = [None] * n
    order: list[int] = []
    while True:
        cnt = pose.count_pose(d, clues, time_limit=tl)
        if cnt.count == 1:
            break
        free = [c for c in range(n) if clues[c] is None]
        kills = {c: sum(1 for comp in cnt.compositions if comp["prices"][c] != ref_prices[c]) for c in free}
        best = max(free, key=lambda c: kills[c])
        clues[best] = ref_prices[best]
        order.append(best)
    for c in order:
        trial = list(clues)
        trial[c] = None
        if pose.count_pose(d, trial, cap=2, time_limit=tl).count == 1:
            clues = trial
    return clues


TYPE_ORDER = {"price": 0, "column": 1, "flow": 2, "bar": 3, "given": 4}


def clue_pool(grid: Any, inv: dict[str, Any], solution: dict[str, Any], ref_prices: list[int],
              types: list[str]) -> list[dict[str, Any]]:
    """Every clue the reference pose can publish, of the requested types."""
    n = grid.n
    cells = {pid: [0] * n for pid in grid.piece_ids()}
    for b in solution["placements"]:
        for c in range(b["col"], b["col"] + b["len"]):
            cells[b["piece"]][c] += 1
    plants = [b for b in solution["placements"] if not grid.is_import(b["piece"])]
    out: list[dict[str, Any]] = []
    if "price" in types:
        out += [{"type": "price", "col": c, "value": ref_prices[c]} for c in range(n)]
    if "column" in types:
        out += [{"type": "column", "col": c, "counts": {pid: cells[pid][c]}}
                for c in range(n) for pid in inv["pieces"]]
    if "flow" in types:
        exports = grid.read_exports(solution["exports"])
        imports = inv.get("imports") or {}
        for nb in grid.neighbors:
            if nb.can_export and (inv.get("exports") or {}).get(nb.id, 0):
                out += [{"type": "flow", "col": c, "country": nb.id, "dir": "export", "value": exports[nb.id][c]}
                        for c in range(n)]
            if nb.can_import and (imports.get(nb.id) or imports.get(pose.ANY_COUNTRY)):
                pid = grid.import_pid(nb)
                out += [{"type": "flow", "col": c, "country": nb.id, "dir": "import", "value": cells[pid][c]}
                        for c in range(n)]
    seen = set()
    if "bar" in types:
        for b in plants:
            key = (b["piece"], b["col"], b["len"])
            if key not in seen:
                seen.add(key)
                out.append({"type": "bar", "piece": b["piece"], "col": b["col"], "len": b["len"]})
    if "given" in types:
        out += [{"type": "given", "piece": b["piece"], "row": b["row"], "col": b["col"], "len": b["len"]}
                for b in plants]
    return out


def lore_clues(d: dict[str, Any], pool: list[dict[str, Any]], max_level: int = 4) -> list[dict[str, Any]] | None:
    """Smallest mix of clues making the grid solvable by deduction: greedy reveal, then prune. None if stuck.

    Greedy: each round adds the clue that leaves the fewest unresolved cells after the simple rules
    (levels 1-2), ties broken by type (price first, given last). Prune: drop each clue whose removal keeps
    the grid solvable (givens first, prices last). Solvability is monotone in the clues, so the result is
    minimal: removing any one clue leaves the grid unsolvable by deduction.
    """
    try:
        pz = deduce.Puzzle(d, lore=[], prices=[])
    except deduce.Unsupported:
        return None
    res = deduce.Solver(pz, max_level=max_level).run()
    chosen: list[dict[str, Any]] = []
    while not res.solved:
        if res.status != "stuck" or res.state is None:
            return None
        best, best_key = None, None
        for clue in pool:
            if clue in chosen:
                continue
            st = res.state.copy()
            r2 = deduce.Solver(pz.extend(clue), st, max_level=min(max_level, 2), record=False).run()
            if r2.status == "contradiction":
                continue
            moved = len(st.cands) + len(st.scen) < len(res.state.cands) + len(res.state.scen) or r2.solved
            if not moved and not st.placed - res.state.placed:
                continue  # the clue tells nothing new at this point
            key = (r2.unresolved, len(st.cands) + len(st.scen), TYPE_ORDER[clue["type"]])
            if best_key is None or key < best_key:
                best, best_key = clue, key
        if best is None:
            return None
        chosen.append(best)
        pz = pz.extend(best)
        res = deduce.Solver(pz, res.state.copy(), max_level=max_level).run()
    order = sorted(range(len(chosen)), key=lambda i: (-TYPE_ORDER[chosen[i]["type"]], -i))
    keep = [True] * len(chosen)
    for i in order:
        keep[i] = False
        trial = [c for c, k in zip(chosen, keep) if k]
        if not deduce.deduce(d, max_level, lore=trial, prices=[]).solved:
            keep[i] = True
    return [c for c, k in zip(chosen, keep) if k]


def generate_pose(p: GenParams) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rng = random.Random(p.seed)
    out: list[dict[str, Any]] = []
    stats: dict[str, Any] = {"attempts": 0, "infeasible": 0, "not_unique": 0, "too_easy": 0,
                             "too_many_clues": 0, "trivial": 0, "kept": 0, "clues": 0, "elapsed": 0.0}
    lore = p.clue_types is not None
    max_clues = p.max_clues if p.max_clues is not None else (p.cols if lore else p.cols // 2)
    stats.update({"unsolvable": 0, "ratings": {}, "clue_types": {}})
    t0 = time.perf_counter()
    while len(out) < p.count and stats["attempts"] < p.max_attempts:
        stats["attempts"] += 1
        raw = draw_grid(rng, p, len(out) + 1)
        raw.pop("curtail_penalty", None)  # curtailment is forbidden in pose mode
        raw["objective"] = {"optimize": "min_score", "target": None,
                            "constraints": {} if p.co2_cap is None else {"co2_cap": p.co2_cap}}
        ref = solve_v2(raw, count_cap=1, decoys=False, time_limit=p.time_limit)
        if ref["status"] != "optimal":
            stats["infeasible"] += 1
            continue
        grid = from_dict(raw)
        inventory = pose_inventory(grid, ref["solution"], p.level, p.co2_cap)
        if _kinds(inventory) < 2:
            stats["trivial"] += 1  # a single kind of piece and no exchange: nothing to deduce
            continue
        d = {k: v for k, v in raw.items() if k != "objective"}
        d.update({"mode": "pose", "title": f"Pose {len(out) + 1}", "inventory": inventory,
                  "constraints": {"co2_cap": p.co2_cap}})
        ref_prices = evaluate(grid, ref["solution"]).col_price
        if lore:
            if _keep_lore(d, grid, inventory, ref, ref_prices, p, max_clues, stats):
                d["id"] = len(out) + 1
                out.append(d)
            continue
        try:
            clues = minimal_clues(d, ref_prices, p.time_limit)
        except TimeoutError:
            stats["not_unique"] += 1
            continue
        if clues is None:
            stats["not_unique"] += 1
            continue
        if sum(v is not None for v in clues) > max_clues:
            stats["too_many_clues"] += 1
            continue
        d["price_clues"] = clues
        res = pose.solve_pose(d, count_cap=2, time_limit=p.time_limit)
        if not res["publishable"]:  # safety net, should not happen
            stats["not_unique"] += 1
            continue
        d["difficulty"] = res["difficulty"]
        if d["difficulty"]["value"] < p.min_difficulty:
            stats["too_easy"] += 1
            continue
        d["solution"] = res["solution"]
        d["id"] = len(out) + 1
        out.append(d)
        stats["kept"] += 1
        stats["clues"] += sum(v is not None for v in clues)
    stats["elapsed"] = time.perf_counter() - t0
    return out, stats


def _keep_lore(d: dict[str, Any], grid: Any, inventory: dict[str, Any], ref: dict[str, Any],
               ref_prices: list[int], p: GenParams, max_clues: int, stats: dict[str, Any]) -> bool:
    """Lore clues for a drawn grid; fills `d` and returns True if the grid is publishable."""
    max_level = p.rating or 4
    pool = clue_pool(grid, inventory, ref["solution"], ref_prices, p.clue_types or [])
    clues = lore_clues(d, pool, max_level)
    if clues is None:
        stats["unsolvable"] += 1
        return False
    if len(clues) > max_clues:
        stats["too_many_clues"] += 1
        return False
    res = deduce.deduce(d, max_level, lore=clues, prices=[])
    if p.rating is not None and res.rating != p.rating:
        stats["too_easy"] += 1
        return False
    d["clues"] = sorted(clues, key=lambda c: (TYPE_ORDER[c["type"]], c["col"]))
    for c in d["clues"]:
        c["text"] = pose.clue_text(grid, c)
    cnt = pose.count_pose(d, cap=2, time_limit=p.time_limit)
    if cnt.count != 1:  # safety net: a solved deduction implies a unique composition
        stats["not_unique"] += 1
        return False
    sol = pose.solve_pose(d, count_cap=2, time_limit=p.time_limit)
    d["difficulty"] = sol["difficulty"]
    d["solution"] = ref["solution"]
    stats["kept"] += 1
    stats["clues"] += len(clues)
    stats["ratings"][res.rating] = stats["ratings"].get(res.rating, 0) + 1
    for c in clues:
        stats["clue_types"][c["type"]] = stats["clue_types"].get(c["type"], 0) + 1
    return True


def generate(p: GenParams) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Return publishable grids and attempt statistics."""
    if p.mode == "pose":
        return generate_pose(p)
    rng = random.Random(p.seed)
    out: list[dict[str, Any]] = []
    stats: dict[str, Any] = {"attempts": 0, "infeasible": 0, "not_unique": 0, "too_easy": 0,
                             "too_many_clues": 0, "trivial": 0, "kept": 0, "clues": 0, "elapsed": 0.0}
    while len(out) < p.count and stats["attempts"] < p.max_attempts:
        stats["attempts"] += 1
        grid = draw_grid(rng, p, len(out) + 1)
        res = solve_v2(grid, decoys=False, time_limit=p.time_limit)
        if res["status"] != "optimal":
            stats["infeasible"] += 1
            continue
        if p.objective == "target":
            kept = None
            for t in range(res["score"] + 1, res["score"] + 1 + p.target_span):
                grid["objective"]["optimize"] = "target"
                grid["objective"]["target"] = t
                r2 = solve_v2(grid, count_cap=2, decoys=False, time_limit=p.time_limit)
                if r2.get("publishable"):
                    kept = r2
                    break
            if kept is None:
                stats["not_unique"] += 1
                continue
            res = kept
        elif not res["publishable"]:
            stats["not_unique"] += 1
            continue
        res = solve_v2(grid, count_cap=2, decoys=True, time_limit=p.time_limit)
        if res["difficulty"]["value"] < p.min_difficulty:
            stats["too_easy"] += 1
            continue
        out.append(finalize(grid, res))
        stats["kept"] += 1
    return out, stats
