"""Independent brute-force composition counter for small §14 grids (review S4.2).

- Enumerates every silhouette scenario (exports per neighbor and column, STEP pairs) and every tiling of
  the silhouette by the allowed shapes (rectangles, tall pieces, trap/stair ramps, 1x1 imports).
- Checks inventory, line capacity, CO2 cap and every clue with its own reading of GAME-DESIGN.md §5-§7,
  without importing dispatch_solver, then returns the set of distinct §8.1 compositions.

Example: python brute.py ../../../fixtures/grids/valid-tall-coal.json
"""

from __future__ import annotations

import itertools
import json
import sys
from typing import Any

RANK = {"N": 1, "B": 2, "C": 3, "G": 4, "T": 5}


class Budget(Exception):
    pass


def shapes(d: dict[str, Any]) -> list[tuple[int, int, tuple[int, ...]]]:
    """(width, height field, cells per column) of each allowed shape; every shape's bottom row is full."""
    kind = d.get("shape", "rect")
    if kind == "trap":
        return [(w, 1, (1,) + (2,) * (w - 2) + (1,)) for w in d["len"]]
    if kind == "stair":
        return [(w, 1, (2,) * (w - 1) + (1,)) for w in d["len"]]
    return [(w, h, (h,) * w) for w in d["len"] for h in d["height"]]


def count(g: dict[str, Any], budget: int = 3_000_000, samples: dict | None = None, stop_after: int = 0, rng: Any = None) -> set[str]:
    n = len(g["columns"])
    res = [g["demand"][c] - g["weather"]["R"][c] - g["weather"]["F"][c] for c in range(n)]
    inv = g["inventory"]
    exact = inv["level"] == "exact"
    nbs = g["neighbors"]
    clues = g["clues"]
    step_n = inv.get("step", 0) if exact else 0
    for cl in clues:
        if cl["type"] == "exchanges" and "step" in cl:
            step_n = cl["step"]
    if not g["step"]:
        step_n = 0
    exp_tot: dict[str, int] = {}
    imp_tot: dict[str, int] = {}
    if exact:
        for nb in nbs:
            exp_tot[nb["id"]] = inv.get("exports", {}).get(nb["id"], 0)
        ii = inv.get("imports", {})
        if "*" in ii:
            imp_tot["*"] = ii["*"]
        else:
            for nb in nbs:
                imp_tot[nb["id"]] = ii.get(nb["id"], 0)
    for cl in clues:
        if cl["type"] == "exchanges":
            exp_tot.update(cl.get("exports", {}))
            imp_tot.update(cl.get("imports", {}))

    # Shapes per key
    kinds: list[tuple[str, str, str | None, int, int, tuple[int, ...]]] = []  # key, piece, country, w, hfield, cols
    for p, d in g["pieces"].items():
        if p not in inv["pieces"]:
            continue
        for w, hf, cols in shapes(d):
            kinds.append((p, p, None, w, hf, cols))
    for nb in nbs:
        kinds.append((f"I:{nb['id']}", "I", nb["id"], 1, 1, (1,)))

    # Monotone pruning: a partial tiling that already breaks one of these can never be completed.
    price_rank = {cl["col"]: RANK[cl["piece"]] for cl in clues if cl["type"] == "price"}
    col_max: dict[tuple[str, int], int] = {}
    for cl in clues:
        if cl["type"] == "column":
            for k, v in cl["counts"].items():
                col_max[k, cl["col"]] = min(v, col_max.get((k, cl["col"]), v))
        if cl["type"] == "flow" and cl["dir"] == "import":
            col_max[f"I:{cl['country']}", cl["col"]] = cl["value"]
    caps = {f"I:{nb['id']}": nb["cap"] for nb in nbs}
    co2 = {p: d["co2"] for p, d in g["pieces"].items()}
    co2.update({f"I:{nb['id']}": nb["co2"] for nb in nbs})
    cell_max: dict[str, int] = {}
    for p, spec in inv["pieces"].items():
        if "cells" in spec:
            cell_max[p] = spec["cells"]
        if "max_cells" in spec:
            cell_max[p] = spec["max_cells"]
    bar_max = {p: spec["bars"] for p, spec in inv["pieces"].items() if "bars" in spec}

    pairs = [(p, t) for p in range(n) for t in range(p + 1, n)]
    step_opts = list(itertools.combinations_with_replacement(pairs, step_n)) if step_n else [()]
    exp_opts = list(itertools.product(*[range(nb["cap"] + 1) for nb in nbs]))
    comps: set[str] = set()
    work = [0]

    scen = [(so, ex) for so in step_opts for ex in itertools.product(exp_opts, repeat=n)]  # ex[c][k]
    if rng is not None:
        rng.shuffle(scen)
    for so, ex in scen:
        pump, turb = [0] * n, [0] * n
        for p, t in so:
            pump[p] += 1
            turb[t] += 1
        if True:
            ok = True
            for k, nb in enumerate(nbs):
                if nb["id"] in exp_tot and sum(ex[c][k] for c in range(n)) != exp_tot[nb["id"]]:
                    ok = False
            for cl in clues:
                if cl["type"] == "flow" and cl["dir"] == "export":
                    k = [nb["id"] for nb in nbs].index(cl["country"])
                    if ex[cl["col"]][k] != cl["value"]:
                        ok = False
            if not ok:
                continue
            h = [res[c] + sum(ex[c]) + pump[c] - turb[c] for c in range(n)]
            if any(x < 0 for x in h):
                continue
            grid = [[False] * h[c] for c in range(n)]
            colcount: dict[tuple[str, int], int] = {}
            keycells: dict[str, int] = {}
            co2sum = [0]

            def allowed(key: str, c: int, w: int, cols: tuple[int, ...], exk: int | None) -> bool:
                for dc in range(w):
                    cc = c + dc
                    if cc in price_rank and (key.startswith("I:") or RANK[key] > price_rank[cc]):
                        return False
                    got = colcount.get((key, cc), 0) + cols[dc]
                    if (key, cc) in col_max and got > col_max[key, cc]:
                        return False
                    if exk is not None and got + ex[cc][exk] > caps[key]:
                        return False
                if key in cell_max and keycells.get(key, 0) + sum(cols) > cell_max[key]:
                    return False
                if key in bar_max:
                    widths = [x[5] for x in placed if x[0] == key] + [w]
                    if len(widths) > len(bar_max[key]) or any(widths.count(x) > bar_max[key].count(x) for x in widths):
                        return False
                if g.get("co2_cap") is not None and co2sum[0] + co2[key] * sum(cols) > g["co2_cap"]:
                    return False
                return True
            placed: list[tuple[str, str, str | None, int, int, int, int, tuple[int, ...]]] = []

            def first_free() -> tuple[int, int] | None:
                for r in range(max(h, default=0)):
                    for c in range(n):
                        if r < h[c] and not grid[c][r]:
                            return r, c
                return None

            def dfs() -> None:
                work[0] += 1
                if work[0] > budget:
                    raise Budget
                cell = first_free()
                if cell is None:
                    comp = check(g, placed, ex, pump, turb, exp_tot, imp_tot, exact, n)
                    if comp is not None:
                        comps.add(comp)
                        if stop_after and len(comps) >= stop_after:
                            raise StopIteration
                        if samples is not None and comp not in samples:
                            samples[comp] = (list(placed), [list(x) for x in ex], list(pump), list(turb), so)
                    return
                r, c = cell
                for key, piece, ctry, w, hf, cols in kinds:
                    if c + w > n:
                        continue
                    exk = [nb["id"] for nb in nbs].index(ctry) if ctry else None
                    if not allowed(key, c, w, cols, exk):
                        continue
                    fits = True
                    for dc in range(w):
                        for k in range(cols[dc]):
                            rr = r + k
                            if rr >= h[c + dc] or grid[c + dc][rr]:
                                fits = False
                                break
                        if not fits:
                            break
                    if not fits:
                        continue
                    for dc in range(w):
                        for k in range(cols[dc]):
                            grid[c + dc][r + k] = True
                    placed.append((key, piece, ctry, r, c, w, hf, cols))
                    for dc in range(w):
                        colcount[key, c + dc] = colcount.get((key, c + dc), 0) + cols[dc]
                    keycells[key] = keycells.get(key, 0) + sum(cols)
                    co2sum[0] += co2[key] * sum(cols)
                    dfs()
                    co2sum[0] -= co2[key] * sum(cols)
                    keycells[key] -= sum(cols)
                    for dc in range(w):
                        colcount[key, c + dc] -= cols[dc]
                    placed.pop()
                    for dc in range(w):
                        for k in range(cols[dc]):
                            grid[c + dc][r + k] = False

            try:
                dfs()
            except StopIteration:
                return comps
    return comps


def check(g, placed, ex, pump, turb, exp_tot, imp_tot, exact, n) -> str | None:
    nbs = [nb["id"] for nb in g["neighbors"]]
    cells = [dict() for _ in range(n)]
    for key, _p, _ct, _r, c, w, _hf, cols in placed:
        for dc in range(w):
            cells[c + dc][key] = cells[c + dc].get(key, 0) + cols[dc]
    inv = g["inventory"]
    for p, spec in inv["pieces"].items():
        mine = [x for x in placed if x[0] == p]
        tot = sum(sum(x[7]) for x in mine)
        if "bars" in spec and sorted(x[5] for x in mine) != sorted(spec["bars"]):
            return None
        if "cells" in spec and tot != spec["cells"]:
            return None
        if "max_cells" in spec and tot > spec["max_cells"]:
            return None
    for k, nid in enumerate(nbs):
        cap = g["neighbors"][k]["cap"]
        for c in range(n):
            if ex[c][k] + cells[c].get(f"I:{nid}", 0) > cap:
                return None
    imp = {nid: sum(cells[c].get(f"I:{nid}", 0) for c in range(n)) for nid in nbs}
    for k, v in imp_tot.items():
        got = sum(imp.values()) if k == "*" else imp[k]
        if got != v:
            return None
    if g.get("co2_cap") is not None:
        co2 = {p: d["co2"] for p, d in g["pieces"].items()}
        co2.update({f"I:{nb['id']}": nb["co2"] for nb in g["neighbors"]})
        if sum(co2[k] * v for col in cells for k, v in col.items()) > g["co2_cap"]:
            return None
    for cl in g["clues"]:
        t = cl["type"]
        if t == "price":
            col = cells[cl["col"]]
            if any(k.startswith("I:") for k in col):
                return None
            if col.get(cl["piece"], 0) < 1 or max(RANK[k] for k in col) != RANK[cl["piece"]]:
                return None
        elif t == "bar":
            if not any(x[1] == cl["piece"] and x[4] == cl["col"] and x[5] == cl["len"] for x in placed):
                return None
        elif t == "length":
            if not any(x[1] == cl["piece"] and x[5] == cl["len"] for x in placed):
                return None
        elif t == "column":
            for k, v in cl["counts"].items():
                if cells[cl["col"]].get(k, 0) != v:
                    return None
        elif t == "flow" and cl["dir"] == "import":
            if cells[cl["col"]].get(f"I:{cl['country']}", 0) != cl["value"]:
                return None
        elif t == "engaged":
            want = (cl["piece"], cl["row"], cl["col"], cl["len"], cl.get("height", 1))
            if not any((x[1], x[3], x[4], x[5], x[6]) == want for x in placed):
                return None
    comp = {
        "cells": [dict(sorted(col.items())) for col in cells],
        "exports": {nid: [ex[c][k] for c in range(n)] for k, nid in enumerate(nbs)},
        "pumps": list(pump),
        "turbines": list(turb),
    }
    return json.dumps(comp, sort_keys=True)


if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    g = data["grid"] if "grid" in data else data
    cs = count(g)
    print(len(cs))
