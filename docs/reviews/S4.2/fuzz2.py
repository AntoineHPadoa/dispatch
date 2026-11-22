"""Random small grids: brute force (brute.py) vs exact.count() vs deduce() (review S4.2).

- Draws 6-column grids with random pieces (tall pieces, trap/stair ramps), 0-2 neighbors, STEP, surplus,
  CO2 cap, max_cells, exact or no inventory, and random true clues taken from one brute-force solution.
- Reports: count mismatch (exact vs brute), composition set mismatch, a "solved" deduction that is not the
  unique composition, a contradiction on a feasible grid, a validator error on a generated grid.

Variant of fuzz.py: STEP with 1 or 2 pairs, exact inventory one grid in two.

Example: ../../../solver/.venv/bin/python fuzz2.py 0 300 > fuzz2-0.log
"""

from __future__ import annotations

import json
import random
import sys
import time

import brute

from dispatch_solver import exact
from dispatch_solver.deduce import deduce
from dispatch_solver.grid import validate

CO2 = {"N": 0, "B": 0, "C": 3, "G": 1, "T": 2}


def draw(rng: random.Random) -> dict:
    n = 6
    nnb = rng.choice([0, 1, 1, 1, 2])
    pieces: dict = {}
    pool = ["N", "B", "C", "G", "T"]
    chosen = sorted(rng.sample(pool, rng.randint(1, 3)), key=pool.index)
    for p in chosen:
        if p == "N":
            d = {"len": rng.choice([[3], [3, 4], [2, 3, 4, 5, 6]]), "height": [1]}
        elif p == "B":
            d = {"len": [1], "height": rng.choice([[1], [1], [1, 2]])}
        elif p == "C":
            kind = rng.choice(["rect", "trap", "stair", "tall"])
            if kind == "trap":
                d = {"shape": "trap", "len": rng.choice([[3], [3, 4]])}
            elif kind == "stair":
                d = {"shape": "stair", "len": rng.choice([[2], [2, 3]])}
            elif kind == "tall":
                d = {"len": [2, 3], "height": rng.choice([[2], [1, 2]])}
            else:
                d = {"len": [3, 4], "height": [1]}
        elif p == "G":
            d = {"len": rng.choice([[2], [2, 3]]), "height": rng.choice([[1], [1], [1, 2]])}
        else:
            d = {"len": [1], "height": [1]}
        d["rank"] = brute.RANK[p]
        d["co2"] = CO2[p]
        pieces[p] = d
    if "T" not in pieces and rng.random() < 0.7:
        pieces["T"] = {"len": [1], "height": [1], "rank": 5, "co2": 2}
    maxh = 3 if nnb < 2 else 2
    lo = -1 if nnb and rng.random() < 0.3 else 0
    demand = [rng.randint(max(lo, 0) if c % 2 else lo, maxh) for c in range(n)]
    neighbors = [
        {"id": cid, "name": cid, "cap": 1, "co2": rng.randint(0, 3)} for cid in ["DE", "ES"][:nnb]
    ]
    step = rng.random() < 0.4
    g = {
        "id": 1,
        "title": "fuzz",
        "section": "rated",
        "columns": [f"{4 * c}h" for c in range(n)],
        "demand": [max(d, 0) for d in demand],
        "pieces": pieces,
        "weather": {"R": [max(0, -d) for d in demand], "F": [0] * n},
        "neighbors": neighbors,
        "step": step,
        "co2_cap": None,
        "inventory": {"level": "none", "pieces": {p: {} for p in pieces}},
        "clues": [],
        "solution": {"exports": {}, "step": [], "placements": []},
        "difficulty": {"rating": 1, "label": "Facile", "techniques": []},
    }
    # negative residual through R: demand 0 with R > 0
    for c in range(n):
        if demand[c] < 0:
            g["demand"][c] = 0
            g["weather"]["R"][c] = -demand[c]
    if step:
        g["clues"].append({"type": "exchanges", "step": rng.choice([1, 2])})
    if "B" in pieces and rng.random() < 0.5:
        g["inventory"]["pieces"]["B"]["max_cells"] = rng.randint(1, 3)
    return g


def clue_pool(g: dict, sample) -> list[dict]:
    placed, ex, pump, turb, so = sample
    n = len(g["columns"])
    nbs = [nb["id"] for nb in g["neighbors"]]
    cells = [dict() for _ in range(n)]
    for key, _p, _ct, _r, c, w, _hf, cols in placed:
        for dc in range(w):
            cells[c + dc][key] = cells[c + dc].get(key, 0) + cols[dc]
    keys = list(g["pieces"]) + [f"I:{k}" for k in nbs]
    out = []
    for c in range(n):
        col = cells[c]
        if col and not any(k.startswith("I:") for k in col):
            top = max(col, key=lambda k: brute.RANK[k])
            out.append({"type": "price", "col": c, "piece": top})
        ks = random.sample(keys, random.randint(1, len(keys)))
        out.append({"type": "column", "col": c, "counts": {k: col.get(k, 0) for k in ks}})
        for k, nid in enumerate(nbs):
            out.append({"type": "flow", "col": c, "country": nid, "dir": "export", "value": ex[c][k]})
            out.append({"type": "flow", "col": c, "country": nid, "dir": "import", "value": col.get(f"I:{nid}", 0)})
    for key, p, _ct, r, c, w, hf, _cols in placed:
        if p != "I":
            out.append({"type": "bar", "piece": p, "col": c, "len": w})
            out.append({"type": "length", "piece": p, "len": w})
    for k, nid in enumerate(nbs):
        out.append({"type": "exchanges", "exports": {nid: sum(ex[c][k] for c in range(n))}})
        out.append({"type": "exchanges", "imports": {nid: sum(col.get(f"I:{nid}", 0) for col in cells)}})
    if nbs:
        out.append({"type": "exchanges", "imports": {"*": sum(v for col in cells for k, v in col.items() if k.startswith("I:"))}})
    return out


def make_exact(g: dict, sample) -> None:
    placed, ex, pump, turb, so = sample
    n = len(g["columns"])
    inv = {"level": "exact", "pieces": {}}
    for p, d in g["pieces"].items():
        mine = [x for x in placed if x[0] == p]
        if d["len"] == [1] and d.get("shape", "rect") == "rect" and d["height"] == [1]:
            inv["pieces"][p] = {"cells": len(mine)}
        else:
            inv["pieces"][p] = {"bars": sorted(x[5] for x in mine)}
    nbs = [nb["id"] for nb in g["neighbors"]]
    if nbs:
        inv["exports"] = {nid: sum(ex[c][k] for c in range(n)) for k, nid in enumerate(nbs)}
        inv["imports"] = {nid: sum(1 for x in placed if x[0] == f"I:{nid}") for nid in nbs}
    if g["step"]:
        inv["step"] = len(so)
        g["clues"] = [c for c in g["clues"] if c["type"] != "exchanges"]
    g["inventory"] = inv


def set_solution(g: dict, sample) -> None:
    placed, ex, pump, turb, so = sample
    pls = []
    for key, p, ct, r, c, w, hf, _cols in placed:
        d = {"piece": p, "row": r, "col": c, "len": w}
        if hf != 1:
            d["height"] = hf
        if ct:
            d["country"] = ct
        pls.append(d)
    nbs = [nb["id"] for nb in g["neighbors"]]
    g["solution"] = {
        "exports": {nid: [ex[c][k] for c in range(len(g["columns"]))] for k, nid in enumerate(nbs)},
        "step": [{"pump": p, "turbine": t} for p, t in so],
        "placements": pls,
    }


def main(seed0: int, count: int) -> None:
    stats = {"runs": 0, "skipped": 0, "solved": 0, "stuck": 0, "unique": 0}
    for seed in range(seed0, seed0 + count):
        rng = random.Random(seed)
        random.seed(seed)
        g = draw(rng)
        samples: dict = {}
        try:
            comps = brute.count(g, budget=300_000, samples=samples, stop_after=3, rng=rng)
        except brute.Budget:
            stats["skipped"] += 1
            continue
        if not comps:
            stats["skipped"] += 1
            continue
        ref = samples[rng.choice(sorted(samples))]
        set_solution(g, ref)
        if rng.random() < 0.5:
            make_exact(g, ref)
        pool = clue_pool(g, ref)
        g["clues"] += rng.sample(pool, min(len(pool), rng.randint(4, 16)))
        if rng.random() < 0.2:
            co2 = {p: d["co2"] for p, d in g["pieces"].items()}
            co2.update({f"I:{nb['id']}": nb["co2"] for nb in g["neighbors"]})
            tot = sum(co2[x[0]] * sum(x[7]) for x in ref[0])
            g["co2_cap"] = tot + rng.randint(0, 2)
        errs = validate(g, allow_ramp=True)
        if errs:
            print(json.dumps({"seed": seed, "kind": "validator", "errors": errs, "grid": g}), flush=True)
            continue
        try:
            comps = brute.count(g, budget=1_500_000)
        except brute.Budget:
            stats["skipped"] += 1
            continue
        stats["runs"] += 1
        t0 = time.time()
        ex = exact.count(g, cap=30)
        excomps = {json.dumps(c, sort_keys=True) for c in ex.compositions}
        if ex.count != min(len(comps), 30) or (len(comps) < 30 and excomps != comps):
            print(json.dumps({"seed": seed, "kind": "exact", "brute": len(comps), "exact": ex.count,
                              "only_brute": sorted(comps - excomps)[:2], "only_exact": sorted(excomps - comps)[:2],
                              "grid": g}), flush=True)
        d = deduce(g, record=True)
        if len(comps) == 1:
            stats["unique"] += 1
        if d.status == "solved":
            stats["solved"] += 1
            if len(comps) != 1 or json.dumps(d.composition, sort_keys=True) not in comps:
                print(json.dumps({"seed": seed, "kind": "deduce-unsound", "brute": len(comps),
                                  "deduced": d.composition, "grid": g}), flush=True)
        elif d.status == "contradiction":
            print(json.dumps({"seed": seed, "kind": "deduce-contradiction", "reason": d.reason, "grid": g}), flush=True)
        else:
            stats["stuck"] += 1
        dt = time.time() - t0
        if dt > 5:
            print(json.dumps({"seed": seed, "kind": "slow", "seconds": round(dt, 1)}), flush=True)
    print(json.dumps({"stats": stats}), flush=True)


if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]))
