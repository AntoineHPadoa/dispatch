"""Check the ramp mini-grids of docs/next/rampe.md with CP-SAT (throwaway study tool).

- Pieces are cell sets: bar (w x h), trap (1->2->1 ramp), stair (2->1 ramp); a ramp's base row is `row`.
- Each grid must have one composition (cells per piece per column), every clue needed, key placements forced.
- Run: solver/.venv/bin/python docs/next/rampe/check_ramp.py
"""
from pathlib import Path
import itertools
import json
import sys

from ortools.sat.python import cp_model

RANK = {"N": 1, "B": 2, "C": 3, "G": 4, "T": 5}


def shape_cells(kind, w, h=1):
    if kind == "bar":
        return [(dr, dc) for dr in range(h) for dc in range(w)]
    if kind == "trap":
        return [(0, dc) for dc in range(w)] + [(1, dc) for dc in range(1, w - 1)]
    if kind == "stair":
        return [(0, dc) for dc in range(w)] + [(1, dc) for dc in range(w - 1)]
    raise ValueError(kind)


def candidates(g):
    n, d = len(g["demand"]), g["demand"]
    out = []
    for pid, spec in g["pieces"].items():
        kind = spec.get("kind", "bar")
        for w in spec["len"]:
            for h in spec.get("height", [1]):
                cells = shape_cells(kind, w, h)
                for c in range(n - w + 1):
                    for r in range(max(d)):
                        abs_cells = [(r + dr, c + dc) for dr, dc in cells]
                        if all(rr < d[cc] for rr, cc in abs_cells):
                            out.append({"piece": pid, "row": r, "col": c, "len": w, "height": h, "cells": abs_cells})
    return out


def build(g, clues, extra=None):
    m = cp_model.CpModel()
    n, d = len(g["demand"]), g["demand"]
    cand = candidates(g)
    x = [m.NewBoolVar(f"x{i}") for i in range(len(cand))]
    cover = {}
    for i, p in enumerate(cand):
        for cell in p["cells"]:
            cover.setdefault(cell, []).append(x[i])
    for c in range(n):
        for r in range(d[c]):
            m.AddExactlyOne(cover.get((r, c), []))
    pieces = list(g["pieces"])
    cnt = {}
    for pid in pieces:
        for c in range(n):
            terms = [x[i] * sum(1 for cell in p["cells"] if cell[1] == c) for i, p in enumerate(cand) if p["piece"] == pid]
            v = m.NewIntVar(0, d[c], f"n_{pid}_{c}")
            m.Add(v == sum(terms))
            cnt[pid, c] = v
    inv = g.get("inventory")
    if inv:
        for pid, spec in inv.items():
            if "bars" in spec:
                for w in set(spec["bars"]):
                    m.Add(sum(x[i] for i, p in enumerate(cand) if p["piece"] == pid and p["len"] == w) == spec["bars"].count(w))
                m.Add(sum(x[i] for i, p in enumerate(cand) if p["piece"] == pid and p["len"] not in spec["bars"]) == 0)
            if "cells" in spec:
                m.Add(sum(cnt[pid, c] for c in range(n)) == spec["cells"])
            if "max_cells" in spec:
                m.Add(sum(cnt[pid, c] for c in range(n)) <= spec["max_cells"])
    for cl in clues:
        t = cl["type"]
        if t == "price":
            c, pid = cl["col"], cl["piece"]
            m.Add(cnt[pid, c] >= 1)
            for q in pieces:
                if RANK[q] > RANK[pid]:
                    m.Add(cnt[q, c] == 0)
        elif t == "column":
            for pid, k in cl["counts"].items():
                m.Add(cnt[pid, cl["col"]] == k)
        elif t == "bar":
            m.Add(sum(x[i] for i, p in enumerate(cand) if p["piece"] == cl["piece"] and p["col"] == cl["col"] and p["len"] == cl["len"]) >= 1)
        elif t == "length":
            m.Add(sum(x[i] for i, p in enumerate(cand) if p["piece"] == cl["piece"] and p["len"] == cl["len"]) >= 1)
        elif t == "tot":
            m.Add(sum(cnt[cl["piece"], c] for c in range(n)) == cl["cells"])
        else:
            raise ValueError(t)
    if extra:
        extra(m, x, cand, cnt)
    return m, x, cand, cnt


def compositions(g, clues, cap=50, extra=None):
    """Return the list of distinct compositions (up to cap), each with one concrete layout."""
    m, x, cand, cnt = build(g, clues, extra)
    found = []
    solver = cp_model.CpSolver()
    solver.parameters.num_workers = 8
    while len(found) < cap:
        st = solver.Solve(m)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break
        comp = {k: solver.Value(v) for k, v in cnt.items()}
        layout = [{k: cand[i][k] for k in ("piece", "row", "col", "len", "height")} for i in range(len(cand)) if solver.Value(x[i])]
        found.append((comp, layout))
        diffs = []
        for k, v in cnt.items():
            b = m.NewBoolVar("")
            m.Add(v != comp[k]).OnlyEnforceIf(b)
            diffs.append(b)
        m.AddBoolOr(diffs)
    return found


def implied(g, clues, extra):
    """True if the constraint added by `extra` is impossible, i.e. its negation holds in every solution."""
    m, *_ = build(g, clues, extra)
    s = cp_model.CpSolver()
    return s.Solve(m) == cp_model.INFEASIBLE


def comp_str(g, comp):
    n = len(g["demand"])
    rows = []
    for pid in g["pieces"]:
        rows.append(f"  {pid}: " + " ".join(str(comp[pid, c]) for c in range(n)))
    return "\n".join(rows)


def draw(g, layout):
    n, d = len(g["demand"]), g["demand"]
    H = max(d)
    grid = [["  " for _ in range(n)] for _ in range(H)]
    for c in range(n):
        for r in range(d[c]):
            grid[r][c] = " ."
    for k, p in enumerate(layout):
        spec = g["pieces"][p["piece"]]
        for dr, dc in shape_cells(spec.get("kind", "bar"), p["len"], p.get("height", 1)):
            grid[p["row"] + dr][p["col"] + dc] = " " + p["piece"]
    return "\n".join("".join(row) for row in reversed(grid))


def report(name, g, clues, cap=20):
    found = compositions(g, clues, cap)
    print(f"== {name}: {len(found)} composition(s){'+' if len(found) >= cap else ''}")
    for comp, lay in found[:3]:
        print(draw(g, lay))
        print(comp_str(g, comp))
        print("  layout:", json.dumps(lay))
    if len(found) == 1:
        for i, cl in enumerate(clues):
            rest = clues[:i] + clues[i + 1:]
            k = len(compositions(g, rest, 3))
            print(f"  without {json.dumps(cl)} -> {k}{'+' if k >= 3 else ''} composition(s)")
    return found

import json
G = json.load(open(Path(__file__).with_name("grids.json")))
KEY = {  # placements (piece, row, col, len) that every solution must contain
 "T1": [("C",1,0,3), ("T",2,0,1)],
 "T2": [("C",1,3,4), ("G",2,1,3)],
 "T3": [("C",0,2,4), ("N",1,0,3), ("N",2,1,3)],
 "T4": [("C",2,3,4), ("C",1,0,4), ("T",2,0,1)],
 "E1": [("C",1,1,4), ("T",2,4,1)],
 "E2": [("C",1,0,2)],
 "E3": [("C",1,0,3), ("G",2,2,3)],
 "E4": [("C",0,0,3), ("C",1,2,3), ("T",2,1,1), ("N",2,4,4)],
}
ok = True
for name, g in G.items():
    comps = compositions(g, g["clues"], 3)
    needed = [len(compositions(g, g["clues"][:i] + g["clues"][i+1:], 2)) > 1 for i in range(len(g["clues"]))]
    forced = []
    for (p, r, c, w) in KEY[name]:
        def extra(m, x, cand, cnt, p=p, r=r, c=c, w=w):
            for i, q in enumerate(cand):
                if (q["piece"], q["row"], q["col"], q["len"]) == (p, r, c, w):
                    m.Add(x[i] == 0)
        forced.append(implied(g, g["clues"], extra))
    good = len(comps) == 1 and all(needed) and all(forced)
    ok &= good
    print(f"{name}: compositions={len(comps)} clues_needed={needed} key_forced={forced} -> {'OK' if good else 'FAIL'}")
    print(draw(g, comps[0][1]))
print("ALL OK" if ok else "SOME FAIL")
