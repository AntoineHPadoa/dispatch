"""Mutated grids for the Python/TS validator comparison (review S4.2).

- Starts from the published grids and the valid fixtures, applies 1-2 random mutations (delete a key,
  null, wrong type, negative, float, out of range, extra key, bulletin) at random paths, writes a JSON list.

Example: python valdiff_gen.py out.json 4000
"""
import copy, json, random, sys, glob

ROOT = "../../.."
bases = json.load(open(f"{ROOT}/web/src/data/grids.json"))
bases += [json.load(open(f))["grid"] for f in sorted(glob.glob(f"{ROOT}/fixtures/grids/valid-*.json")) if "ramp" not in f]
VALUES = [None, True, False, 0, -1, 1, 1.0, 1.5, 2, 99, "", "x", "*", "DE", "N", "I", [], {}, [1], [3, 2], {"a": 1}, "2026-02-30", "2026-12-01"]

def paths(x, pre=()):
    yield pre
    if isinstance(x, dict):
        for k, v in x.items():
            yield from paths(v, pre + (k,))
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from paths(v, pre + (i,))

def mutate(g, rng):
    ps = [p for p in paths(g) if p]
    p = rng.choice(ps)
    parent = g
    for k in p[:-1]:
        parent = parent[k]
    k = p[-1]
    op = rng.random()
    if op < 0.25 and isinstance(parent, dict):
        del parent[k]
    elif op < 0.35 and isinstance(parent, dict):
        parent[rng.choice(["extra", "height", "shape", "country", "step", "max_cells", "cells", "bars", "exports", "imports", "*"])] = rng.choice(VALUES)
    else:
        parent[k] = copy.deepcopy(rng.choice(VALUES))

def bulletin(g, rng):
    n = len(g.get("columns") or [])
    g["bulletin"] = {"number": rng.choice([1, 0, 2.0, "3"]), "title": rng.choice(["T", " ", ""]), "text": rng.choice(["x", "  "]),
                     "weather": rng.choice([["sun"] * n, ["sun"] * (n + 1), ["rain"] * n, "sun"]),
                     "published": rng.choice(["2026-12-01", "2026-02-30", "26-1-1", None])}
    if rng.random() < 0.2:
        g["bulletin"]["extra"] = 1

out = []
rng = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else 0)
for i in range(int(sys.argv[2])):
    g = copy.deepcopy(rng.choice(bases))
    if rng.random() < 0.15:
        bulletin(g, rng)
    for _ in range(rng.choice([1, 1, 2])):
        try:
            mutate(g, rng)
        except (KeyError, IndexError, TypeError):
            pass
    out.append(g)
json.dump(out, open(sys.argv[1], "w"))
