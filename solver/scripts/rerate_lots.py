"""Re-rate lab candidate lots after a deduction change, without drawing new grids.

- For each candidate: one composition equal to the reference (CP-SAT), full deduction, then each clue
  removed in turn (§8.3: none may be useless). Rating (notation A), techniques, lab.trace_summary,
  lab.ramp_techniques and the measures lab.decisions, lab.live_mechanics, lab.coupled_globals,
  lab.compactness and lab.demand_prices are rewritten; the stats file gets the new ratings and ramp counts.
- Prints one line per grid whose rating changed and every grid that is no longer publishable
  (not unique, blocked, or a clue became useless). Such grids are kept and flagged in `lab.recheck`.

Usage (from solver/): .venv/bin/python scripts/rerate_lots.py ../lab/candidates/v3-jouer-a.json [...]
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

from dispatch_solver import exact
from dispatch_solver.board import reference_composition
from dispatch_solver.deduce import deduce
from dispatch_solver.deduce.trace import RAMP_OWN, RAMP_RULES, compactness, decisions, live_mechanics
from dispatch_solver.generate.cluesel import demand_prices, mandatory_clues
from dispatch_solver.grid import LABELS


def rerate(g: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"problems": []}
    ex = exact.count(g)
    if ex.count != 1 or ex.composition != reference_composition(g):
        out["problems"].append("not_unique")
    res = deduce(g)
    if not res.solved or res.composition != reference_composition(g):
        out["problems"].append("blocked")
        return out
    base = mandatory_clues(g)
    for i, clue in enumerate(g["clues"]):
        if clue in base:
            continue  # a STEP grid without inventory must publish its pairs
        trial = {**g, "clues": g["clues"][:i] + g["clues"][i + 1 :]}
        r = deduce(trial, record=False)
        if r.solved and r.composition == reference_composition(g) and exact.count(trial).count == 1:
            out["problems"].append(f"useless_clue:{i}")
    summary = res.summary()
    out["difficulty"] = {"rating": res.rating, "label": LABELS[res.rating], "techniques": sorted(res.techniques())}
    out["trace_summary"] = summary
    out["ramp_techniques"] = {k: v for k, v in summary["techniques"].items() if k in RAMP_RULES}
    dec = decisions(g, res.steps)
    out["measures"] = {
        "decisions": dec,
        "live_mechanics": live_mechanics(dec),
        "coupled_globals": res.coupled_globals,
        "compactness": compactness(g, dec),
        "demand_prices": len(demand_prices(g, g["clues"])),
    }
    return out


def main(paths: list[str]) -> None:
    for path in map(Path, paths):
        grids = json.loads(path.read_text())
        with ProcessPoolExecutor() as pool:
            results = list(pool.map(rerate, grids))
        for i, (g, r) in enumerate(zip(grids, results)):
            old = g["difficulty"]["label"]
            if "difficulty" in r:
                g["difficulty"] = r["difficulty"]
                g["lab"]["trace_summary"] = r["trace_summary"]
                g["lab"]["ramp_techniques"] = r["ramp_techniques"]
                g["lab"].update(r["measures"])
            if r["problems"]:
                g["lab"]["recheck"] = r["problems"]
            else:
                g["lab"].pop("recheck", None)
            new = g["difficulty"]["label"]
            if new != old or r["problems"]:
                print(f"{path.stem}[{i}] {old} -> {new} {' '.join(r['problems'])}".rstrip())
        path.write_text(json.dumps(grids, ensure_ascii=False, indent=1) + "\n")
        stats_path = path.with_suffix(".stats.json")
        if stats_path.exists():
            stats = json.loads(stats_path.read_text())
            stats["ratings"] = {
                LABELS[k]: sum(1 for g in grids if g["difficulty"]["rating"] == k) for k in (1, 2, 3, 4)
            }
            ramp = [g for g in grids if any(m.startswith("ramp:") for m in g["lab"]["mechanics"])]
            stats["ramp_grids_with_technique"] = sum(1 for g in ramp if g["lab"]["ramp_techniques"])
            stats["ramp_grids_with_own_technique"] = sum(
                1 for g in ramp if set(g["lab"]["ramp_techniques"]) & set(RAMP_OWN)
            )
            stats["ramp_techniques"] = {k: sum(g["lab"]["ramp_techniques"].get(k, 0) for g in ramp) for k in RAMP_RULES}
            stats["rerated"] = "scripts/rerate_lots.py (notation A, S4.16)"
            stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=1) + "\n")
        print(f"{path.name}: {len(grids)} grids, ratings {stats['ratings'] if stats_path.exists() else '-'}")


if __name__ == "__main__":
    main(sys.argv[1:])
