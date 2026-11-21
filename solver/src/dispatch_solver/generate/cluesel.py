"""Clue selection: the smallest set of market clues that makes a grid deducible (§8.2, §8.3, §10 step 4).

- clue_pool(): every clue the reference solution can publish, for the allowed types: price per column,
  record per column and key, flow per column and neighbor, program per bar, running length per plant and
  width, day totals (exports, imports, STEP pairs).
- select_clues(): mandatory clues first (a STEP grid publishes its pairs), then greedy: add the clue that
  leaves the fewest undecided cells after the level 1-2 techniques (ties: the least used clue type), until
  the full deduction solves the grid; then prune every clue the grid can do without.
- Monotone: removing any remaining clue makes the deduction fail (tested).

Example: clues = select_clues(grid, pool)  # None when even the whole pool does not suffice
"""

from __future__ import annotations

from typing import Any

from ..board import Puzzle, reference_composition
from ..deduce import Solver, deduce

TYPE_ORDER = ("price", "column", "flow", "bar", "length", "exchanges", "engaged")
PRUNE_ORDER = ("engaged", "bar", "length", "flow", "column", "exchanges", "price")


def clue_pool(g: dict[str, Any], types: tuple[str, ...] = TYPE_ORDER[:-1]) -> list[dict[str, Any]]:
    sol = g["solution"]
    n = len(g["columns"])
    comp = reference_composition(g)
    pool: list[dict[str, Any]] = []
    pieces = list(g["pieces"])
    if "price" in types:
        for c in range(n):
            cells = comp["cells"][c]
            if any(k.startswith("I:") for k in cells):
                continue
            top = max((k for k in cells), key=lambda k: g["pieces"][k]["rank"], default=None)
            if top is not None:
                pool.append({"type": "price", "col": c, "piece": top})
    if "column" in types:
        keys = pieces + [f"I:{nb['id']}" for nb in g["neighbors"]]
        for c in range(n):
            for k in keys:
                pool.append({"type": "column", "col": c, "counts": {k: comp["cells"][c].get(k, 0)}})
    if "flow" in types:
        for nb in g["neighbors"]:
            for c in range(n):
                pool.append(
                    {
                        "type": "flow",
                        "col": c,
                        "country": nb["id"],
                        "dir": "export",
                        "value": comp["exports"][nb["id"]][c],
                    }
                )
                imp = comp["cells"][c].get(f"I:{nb['id']}", 0)
                pool.append({"type": "flow", "col": c, "country": nb["id"], "dir": "import", "value": imp})
    if "bar" in types:
        for p in sol["placements"]:
            if p["piece"] != "I" and p["len"] > 1:
                pool.append({"type": "bar", "piece": p["piece"], "col": p["col"], "len": p["len"]})
    if "length" in types:
        seen = set()
        for p in sol["placements"]:
            if p["piece"] != "I" and len(g["pieces"][p["piece"]]["len"]) > 1 and (p["piece"], p["len"]) not in seen:
                seen.add((p["piece"], p["len"]))
                pool.append({"type": "length", "piece": p["piece"], "len": p["len"]})
    if "exchanges" in types and g["neighbors"] and g["inventory"]["level"] == "none":
        for nb in g["neighbors"]:
            pool.append({"type": "exchanges", "exports": {nb["id"]: sum(comp["exports"][nb["id"]])}})
            pool.append(
                {"type": "exchanges", "imports": {nb["id"]: sum(c.get(f"I:{nb['id']}", 0) for c in comp["cells"])}}
            )
    if "engaged" in types:
        for p in sol["placements"]:
            if p["piece"] != "I":
                e = {"type": "engaged", "piece": p["piece"], "row": p["row"], "col": p["col"], "len": p["len"]}
                if p.get("height", 1) != 1:
                    e["height"] = p["height"]
                pool.append(e)
    return pool


def mandatory_clues(g: dict[str, Any]) -> list[dict[str, Any]]:
    if g["step"] and g["inventory"]["level"] == "none":
        return [{"type": "exchanges", "step": len(g["solution"]["step"])}]
    return []


def _with(g: dict[str, Any], clues: list[dict[str, Any]]) -> dict[str, Any]:
    return {**g, "clues": clues}


def _undecided(g: dict[str, Any]) -> int:
    res = Solver(Puzzle(g), max_level=2, record=False).run()
    if res.status == "contradiction":
        return 10**6
    return 0 if res.solved else res.unresolved


def _solves(g: dict[str, Any], max_level: int) -> bool:
    res = deduce(g, max_level=max_level, record=False)
    return res.solved and res.composition == reference_composition(g)


def select_clues(
    g: dict[str, Any], pool: list[dict[str, Any]], max_level: int = 4, max_clues: int | None = None
) -> list[dict[str, Any]] | None:
    """Minimal clue list for g (its reference solution), or None if the pool does not make it deducible."""
    base = mandatory_clues(g)
    chosen = list(base)
    left = [c for c in pool if c not in chosen]
    limit = max_clues if max_clues is not None else len(pool)
    while not _solves(_with(g, chosen), max_level):
        if not left or len(chosen) - len(base) >= limit + 2:
            return None
        used = {c["type"] for c in chosen}
        best = None
        for i, clue in enumerate(left):
            score = (_undecided(_with(g, chosen + [clue])), clue["type"] in used, TYPE_ORDER.index(clue["type"]), i)
            if best is None or score < best[0]:
                best = (score, clue)
        assert best is not None
        chosen.append(best[1])
        left.remove(best[1])
    # Prune: drop what the grid can do without (engaged bars first, prices last).
    for t in PRUNE_ORDER:
        for clue in [c for c in chosen if c["type"] == t and c not in base]:
            trial = [c for c in chosen if c is not clue]
            if _solves(_with(g, trial), max_level):
                chosen = trial
    return chosen
