"""Measure grids under the 'weather = imposed bricks' rule without changing the solver.

- Monkeypatches Puzzle._add_shapes: a placement is a shape laid at an ABSOLUTE row R (weather cells
  fill rows 0..w[c]-1), allowed only when every cell sits above the weather; its cells are then
  translated to the solver's relative rows (row - w[c]). Exact counting is exact under this patch.
- Deduction runs on the same placements; spans of non-contiguous relative rows are approximate, so
  its status/rating is indicative only.
- Usage: python abs_measure.py out.json file1.json [file2.json ...]
"""
import json
import sys
import time

import dispatch_solver.board as B
from dispatch_solver import exact
from dispatch_solver.board import Puzzle, reference_composition
from dispatch_solver.deduce import deduce
from dispatch_solver.grid import validate
from dispatch_solver.shapes import Placement


def weather(g):
    return [g["weather"]["R"][c] + g["weather"]["F"][c] for c in range(len(g["columns"]))]


def patched(self, key, piece, country, shapes):
    w = weather(self.g)
    for sh in shapes:
        for c0 in range(self.n - sh.width + 1):
            cols = list(range(c0, c0 + sh.width))
            lo = max(0, max(w[c] - sh.columns[c - c0][0] for c in cols))
            hi = min(w[c] + self.maxh[c] - sh.top(c - c0) for c in cols)
            for R in range(lo, hi + 1):
                cells = frozenset(
                    (R + b + k - w[c0 + dc], c0 + dc) for dc, (b, h) in enumerate(sh.columns) for k in range(h)
                )
                pl = Placement(key, piece, country, sh, R - w[c0], c0, cells)
                hk = 1 if sh.kind.startswith("ramp") else sh.height
                self.index[key, R - w[c0], c0, sh.width, hk] = len(self.placements)
                self.placements.append(pl)
                self.masks.append(sum(1 << (rr * self.n + cc) for rr, cc in pl.cells))
                self.pw.append((key, sh.width))
                self.spans.append({rr: pl.row_span(rr) for rr in {x for x, _ in pl.cells}})


def straight(g):
    """Reference bars that keep their drawing: constant weather under every column of the bar."""
    w = weather(g)
    bent = 0
    for p in g["solution"]["placements"]:
        if len({w[c] for c in range(p["col"], p["col"] + p["len"])}) > 1:
            bent += 1
    return bent


def measure(g, mode):
    out = {"id": g.get("id"), "title": g.get("title"), "cols": len(g["columns"]), "bent_bars": straight(g),
           "surplus": any(weather(g)[c] > g["demand"][c] for c in range(len(g["columns"]))),
           "engaged_bent": 0}
    w = weather(g)
    for cl in g["clues"]:
        if cl["type"] == "engaged" and len({w[c] for c in range(cl["col"], cl["col"] + cl["len"])}) > 1:
            out["engaged_bent"] += 1
    errs = validate(g, allow_ramp=True)
    if errs:
        out["invalid"] = errs
        return out
    B.Puzzle._add_shapes = patched if mode == "abs" else ORIG
    t = time.time()
    pz = Puzzle(g)
    try:
        ex = exact.count(pz, cap=2)
    except TimeoutError as e:
        out["error"] = str(e)
        return out
    ref = reference_composition(g)
    out["compositions"] = ex.count
    out["matches_reference"] = ex.count >= 1 and ref in ex.compositions
    try:
        d = deduce(pz, record=True)
        out["deduction"] = d.status
        out["deduction_ok"] = d.composition == ref if d.solved else None
        out["rating"] = d.rating if d.solved else None
        out["techniques"] = sorted(d.techniques())
    except Exception as e:  # noqa: BLE001
        out["deduction"] = f"error: {e}"
    out["seconds"] = round(time.time() - t, 1)
    return out


ORIG = B.Puzzle._add_shapes

if __name__ == "__main__":
    res = []
    for f in sys.argv[2:]:
        data = json.load(open(f))
        grids = data if isinstance(data, list) else data.get("grids", [])
        for i, g in enumerate(grids):
            g = {k: v for k, v in g.items() if k != "lab"}
            row = {"file": f.split("/")[-1], "index": i}
            row["now"] = measure(g, "rel")
            row["abs"] = measure(g, "abs")
            res.append(row)
            a, n = row["abs"], row["now"]
            print(row["file"], i, g.get("title"), "| now", n.get("compositions"), n.get("deduction"), n.get("rating"),
                  "| abs", a.get("compositions"), a.get("matches_reference"), a.get("deduction"), a.get("rating"),
                  "bent", a["bent_bars"], flush=True)
    json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
