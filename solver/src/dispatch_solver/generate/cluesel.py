"""Clue selection: the smallest set of market clues that makes a grid deducible (§8.2, §8.3, §10 step 5).

- clue_pool(): every clue the reference solution can publish, for the allowed types: price per column,
  record per column and key, flow per column and neighbor, program per bar, running length per plant and
  width, day totals (exports, imports, STEP pairs).
- select_clues(): mandatory clues first (a STEP grid publishes its pairs), then greedy: add the clue that
  leaves the fewest undecided cells after the level 1-2 techniques (ties: the least used clue type), until
  the deduction up to `max_level` solves the grid (levels 3-4 are only tried near the end); then prune
  every clue the grid can do without, at that level then with every technique (§8.3), until stable.
  `max_level` is the generator's lever on the rating; the last prune may raise the rating above it.
  `seed` clues (e.g. a price that makes a demand appear, D7) start in the selection and are pruned last.
- demand_prices(): price clues of the pool on a dear plant (C, G, T) in a column with an export: the price
  says the plant runs although the day's own demand would not call it (tutorial 6, "La case la plus chère").
- Monotone: removing any remaining clue makes the deduction fail (tested).

Example: clues = select_clues(grid, pool)  # None when even the whole pool does not suffice
"""

from __future__ import annotations

import random
from typing import Any

from ..board import Puzzle, reference_composition
from ..deduce import Solver

TYPE_ORDER = ("price", "column", "flow", "bar", "length", "exchanges", "engaged")
PRUNE_ORDER = ("engaged", "bar", "length", "flow", "column", "exchanges", "price")
DEAR_PLANTS = ("C", "G", "T")


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


def demand_prices(g: dict[str, Any], clues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Price clues on a dear plant (DEAR_PLANTS) in a column where the reference exports (D7)."""
    exports = reference_composition(g)["exports"]
    return [
        c
        for c in clues
        if c["type"] == "price" and c["piece"] in DEAR_PLANTS and any(v[c["col"]] for v in exports.values())
    ]


def mandatory_clues(g: dict[str, Any]) -> list[dict[str, Any]]:
    if g["step"] and g["inventory"]["level"] == "none":
        return [{"type": "exchanges", "step": len(g["solution"]["step"])}]
    return []


class _Judge:
    """Runs the deduction on one board with several clue sets (placements built once)."""

    def __init__(self, g: dict[str, Any]) -> None:
        # Built with the mandatory clues: the STEP pairs they publish shape the silhouette options.
        self.pz = Puzzle({**g, "clues": mandatory_clues(g)})
        self.ref = reference_composition(g)

    def run(self, clues: list[dict[str, Any]], level: int) -> Any:
        return Solver(self.pz.with_clues(clues), max_level=level, record=False).run()

    def undecided(self, clues: list[dict[str, Any]], level: int) -> int:
        res = self.run(clues, level)
        if res.status == "contradiction":
            return 10**6
        return 0 if res.solved else res.unresolved

    def solves(self, clues: list[dict[str, Any]], level: int) -> bool:
        """Solved by the techniques up to `level`; the cheap levels are tried first."""
        for lv in sorted({min(level, 2), level}):
            res = self.run(clues, lv)
            if res.solved:
                return res.composition == self.ref
        return False


def select_clues(
    g: dict[str, Any],
    pool: list[dict[str, Any]],
    max_level: int = 4,
    max_clues: int | None = None,
    rng: random.Random | None = None,
    seed: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]] | None:
    """Minimal clue list for g (its reference solution), or None if the pool does not make it deducible.

    max_level: highest technique level allowed (the aimed rating); max_clues: stop (None) past this
    number of clues besides the mandatory ones. rng: draw each clue among those that make progress
    instead of taking the best one, and try the full deduction at every step: less informative clues,
    harder grids (used when aiming at levels 3-4). seed: clues chosen first and pruned last.
    """
    judge = _Judge(g)
    base = mandatory_clues(g)
    seed = [c for c in seed or [] if c not in base]
    chosen = list(base) + seed
    left = [c for c in pool if c not in chosen]
    limit = max_clues if max_clues is not None else len(pool)
    cheap = min(max_level, 2)
    near = len(g["columns"])  # undecided cells under which the full deduction is worth a try
    und = judge.undecided(chosen, cheap)
    while und:
        full = max_level > cheap and (rng is not None or und <= near or not left or len(chosen) - len(base) >= limit)
        if full and judge.solves(chosen, max_level):
            break
        if not left or len(chosen) - len(base) >= limit:
            return None
        used = {c["type"] for c in chosen}
        best = None
        scored = []
        for i, clue in enumerate(left):
            score = (judge.undecided(chosen + [clue], cheap), clue["type"] in used, TYPE_ORDER.index(clue["type"]), i)
            scored.append((score, clue))
            if best is None or score < best[0]:
                best = (score, clue)
        assert best is not None
        if rng is not None:
            useful = [x for x in scored if x[0][0] < und]
            if useful:
                best = rng.choice(useful)
        chosen.append(best[1])
        left.remove(best[1])
        und = best[0][0]
    if und == 0 and judge.run(chosen, cheap).composition != judge.ref:
        return None
    # Prune: drop what the grid can do without (engaged bars first, prices last), first at the aimed
    # level, then with every technique (§8.3 is judged on the full deduction), until nothing moves.
    for level in sorted({max_level, 4}):
        changed = True
        while changed:
            changed = False
            for t in (*PRUNE_ORDER, "seed"):
                for clue in [
                    c
                    for c in chosen
                    if c not in base and ((c in seed) if t == "seed" else c["type"] == t and c not in seed)
                ]:
                    trial = [c for c in chosen if c is not clue]
                    if judge.solves(trial, level):
                        chosen = trial
                        changed = True
    return chosen
