"""Check that each §14 grid has a unique composition, with the Python CP-SAT solver of ../solver.

- Translates each grid of src/data/grids.json back to the solver's "pose" format:
  piece price = merit rank, import price = 100 (so a price clue "piece X" reads "column price = rank of X",
  which also forbids imports in that column), exchange totals into the inventory, max_cells into a cap.
- Exchange totals come from the inventory (level exact) or from the `exchanges` clue (level none); a total
  the grid does not publish is unknown (free), not zero. A clue that contradicts the inventory is an error.
- Runs `spot-solver solve` on each grid, prints the number of compositions (1 expected) and checks that the
  solution found is the reference solution.

Usage (from web/): ../solver/.venv/bin/python scripts/check_unique.py [src/data/grids.json]
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOLVER = HERE.parent.parent / "solver" / ".venv" / "bin" / "spot-solver"
IMPORT_PRICE = 100


def to_solver(g: dict) -> dict:
    n = len(g["columns"])
    residual = [g["demand"][c] - g["weather"]["R"][c] - g["weather"]["F"][c] for c in range(n)]
    pieces = {}
    for pid, d in g["pieces"].items():
        if d["height"] != [1]:
            raise ValueError(f"grid {g['id']}: the solver only knows one-cell-high bars")
        p = {"len": d["len"], "price": d["rank"], "co2": d["co2"]}
        cap = g["inventory"]["pieces"].get(pid, {}).get("max_cells")
        if cap is not None:
            p["cap"] = cap
        pieces[pid] = p

    exch = {k: g["inventory"][k] for k in ("exports", "imports", "step") if k in g["inventory"]}
    for cl in g["clues"]:
        if cl["type"] != "exchanges":
            continue
        for k in ("exports", "imports", "step"):
            if k in cl and k in exch and exch[k] != cl[k]:
                raise ValueError(f"grid {g['id']}: exchanges clue {k} contradicts the inventory")
            if k in cl:
                exch[k] = cl[k]
    # Totals nobody publishes are unknown (None), except when there is nothing to exchange.
    if g["neighbors"]:
        exch.setdefault("exports", None)
        exch.setdefault("imports", None)
    if g["step"] and exch.get("step") is None:
        raise ValueError(f"grid {g['id']}: a STEP grid must publish its number of pairs (inventory.step or exchanges clue step)")

    inv_pieces = {}
    for pid, spec in g["inventory"]["pieces"].items():
        inv_pieces[pid] = {k: v for k, v in spec.items() if k in ("bars", "cells")}
    imports = (None if exch.get("imports", {}) is None
               else {("I" if k == "*" else k): v for k, v in exch.get("imports", {}).items()})
    inventory = {
        "level": "exact" if g["inventory"]["level"] == "exact" else "none",
        "pieces": inv_pieces,
        "exports": exch.get("exports", {}),
        "imports": imports,
        "step": exch.get("step", 0),
    }

    clues = []
    for cl in g["clues"]:
        t = cl["type"]
        if t == "price":
            clues.append({"type": "price", "col": cl["col"], "value": g["pieces"][cl["piece"]]["rank"]})
        elif t in ("bar", "column", "flow"):
            clues.append({k: v for k, v in cl.items()})
        elif t == "engaged":
            clues.append({"type": "given", "piece": cl["piece"], "row": cl["row"], "col": cl["col"], "len": cl["len"]})
        elif t == "exchanges":
            pass
        else:
            raise ValueError(f"grid {g['id']}: clue type {t} unknown to the solver")

    out = {
        "id": g["id"],
        "title": g["title"],
        "mode": "pose",
        "columns": g["columns"],
        "residual": residual,
        "pieces": pieces,
        "inventory": inventory,
        "constraints": {"co2_cap": g["co2_cap"]},
        "clues": clues,
    }
    if g["neighbors"]:
        out["neighbors"] = [
            {"id": nb["id"], "name": nb["name"], "price": [IMPORT_PRICE] * n, "cap": nb["cap"],
             "export_budget": 99, "import": True, "export": True, "co2": nb["co2"]}
            for nb in g["neighbors"]
        ]
    if g["step"]:
        out["step"] = inventory["step"]
    return out


def reference_diff(g: dict, solution: dict) -> list[str]:
    """Differences between the solver solution and the grid's reference solution (empty = identical)."""
    plants = set(g["pieces"])

    def cells(placements: list[dict]) -> dict:
        out: dict = {}
        for p in placements:
            key = p["piece"] if p["piece"] in plants else "I"
            for c in range(p["col"], p["col"] + p["len"]):
                out[(key, c)] = out.get((key, c), 0) + p.get("height", 1)
        return out

    ref = g["solution"]
    diffs = []
    if cells(solution["placements"]) != cells(ref["placements"]):
        diffs.append("cells per piece and column")
    raw_exports = solution.get("exports") or {}
    if not isinstance(raw_exports, dict):  # grids without neighbor: an (all-zero) list
        raw_exports = {}
    got_exports = {k: v for k, v in raw_exports.items() if any(v)}
    ref_exports = {k: v for k, v in ref["exports"].items() if any(v)}
    if got_exports != ref_exports:
        diffs.append("exports")
    pairs = lambda steps: sorted((s["pump"], s["turbine"]) if isinstance(s, dict) else tuple(s) for s in steps)  # noqa: E731
    if pairs(solution.get("step", [])) != pairs(ref["step"]):
        diffs.append("STEP pairs")
    return diffs


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "src" / "data" / "grids.json"
    grids = json.loads(src.read_text())
    ok = True
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "grids.json"
        path.write_text(json.dumps([to_solver(g) for g in grids]))
        for g in grids:
            res = subprocess.run([str(SOLVER), "solve", str(path), "--id", str(g["id"])],
                                 capture_output=True, text=True, check=False)
            if res.returncode != 0:
                print(f"grid {g['id']}: solver error: {res.stderr.strip()[-300:]}")
                ok = False
                continue
            data = json.loads(res.stdout)
            comps = data.get("compositions")
            rating = (data.get("difficulty") or {}).get("rating")
            print(f"grid {g['id']:>2} {g['title']:<40} compositions={comps} rating={rating}")
            ok = ok and comps == "1"
            diffs = reference_diff(g, data["solution"]) if data.get("solution") else ["no solution"]
            if diffs:
                print(f"grid {g['id']:>2}: solution differs from the reference ({', '.join(diffs)})")
                ok = False
    print("OK: every grid is unique" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
