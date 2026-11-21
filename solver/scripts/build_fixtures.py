"""Build the shared reference grids in fixtures/grids/ (read by pytest and Vitest).

- Valid grids: hand-drawn drafts covering what the published grids do not (several neighbors, tall
  pieces, stock, surplus, CO2 cap, length clues, partial day totals, STEP without inventory, ramps),
  completed by the reference solution and the clue selection, then checked (one composition, deducible).
- Invalid grids: one per validator check, and well-formed grids that are not publishable (two
  compositions, reference breaking a clue, unique but not deducible).
- `expect` holds what both implementations must find; rerun after a solver change and review the diff.
- `unpublishable-unique-but-stuck.json` is kept by hand (found by a random search, rare): the script
  does not rewrite it.

Usage (from solver/): .venv/bin/python scripts/build_fixtures.py [path/to/docs/next/rampe/grids.json]
"""

from __future__ import annotations

import copy
import json
import random
import sys
from pathlib import Path
from typing import Any

from dispatch_solver import exact
from dispatch_solver.board import reference_composition
from dispatch_solver.deduce import deduce
from dispatch_solver.generate.cluesel import clue_pool, select_clues
from dispatch_solver.generate.draft import make_draft
from dispatch_solver.generate.reference import fill_inventory, solve_reference
from dispatch_solver.grid import LABELS, load_grids, validate

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "fixtures" / "grids"
PUBLISHED = ROOT / "web" / "src" / "data" / "grids.json"

TALL_C = {"C": {"len": [3, 4], "height": [1, 2]}}
RAMP_TRAP = {"C": {"len": [3, 4, 5], "shape": "trap"}}
RAMP_STAIR = {"C": {"len": [2, 3, 4], "shape": "stair"}}
RAMP_STUDY = ROOT / "docs" / "next" / "rampe" / "grids.json"

# name: (draft kwargs, level, exports, clue types, requires)
VALID: dict[str, tuple[dict[str, Any], str, dict[str, int], tuple[str, ...], list[str]]] = {
    "two-neighbors-co2": (
        dict(residual=[3, 3, 5, 6, 5, 7, 7, 4], pieces="NGT", neighbors=[("DE", 1, 2), ("ES", 1, 0)], co2_cap=6),
        "none",
        {"DE": 1},
        ("price", "column", "flow", "exchanges"),
        [],
    ),
    "three-neighbors": (
        dict(
            residual=[4, 3, 4, 6, 7, 6, 8, 9, 7, 5],
            pieces="NBCGT",
            neighbors=[("DE", 1, 2), ("ES", 1, 0), ("UK", 1, 1)],
            max_cells={"B": 2},
        ),
        "none",
        {"UK": 1},
        ("price", "column", "flow", "bar", "exchanges"),
        [],
    ),
    "tall-coal": (
        dict(residual=[3, 5, 5, 5, 6, 7, 6, 4], pieces="NCT", shapes=TALL_C),
        "none",
        {},
        ("price", "column", "bar"),
        [],
    ),
    "tall-coal-exact": (
        dict(residual=[2, 4, 4, 4, 5, 6, 5, 3], pieces="NCGT", shapes=TALL_C),
        "exact",
        {},
        ("price", "column"),
        [],
    ),
    "surplus-export": (
        dict(
            residual=[3, 3, 4, -1, 2, 5, 6, 4],
            pieces="NGT",
            neighbors=[("DE", 1, 1)],
            weather_r=[0, 1, 3, 5, 3, 1, 0, 0],
        ),
        "none",
        {"DE": 2},
        ("price", "column", "flow", "exchanges"),
        [],
    ),
    "length-clues": (dict(residual=[3, 4, 4, 5, 5, 6, 6, 4, 3], pieces="NGT"), "none", {}, ("length", "column"), []),
    "partial-totals": (
        dict(residual=[4, 4, 5, 6, 6, 7, 6, 5], pieces="NGT", neighbors=[("DE", 1, 2)]),
        "none",
        {"DE": 2},
        ("column", "price", "exchanges"),
        [],
    ),
    "step-no-inventory": (
        dict(residual=[4, 3, 3, 5, 6, 6, 7, 5], pieces="NGT", neighbors=[("DE", 1, 1)], step=1),
        "none",
        {},
        ("price", "column", "flow", "exchanges"),
        [],
    ),
    "stock-dam": (
        dict(residual=[3, 4, 5, 6, 5, 6, 7, 5], pieces="NBGT", max_cells={"B": 2}),
        "none",
        {},
        ("price", "column", "bar"),
        [],
    ),
    "ramp-trap": (
        dict(residual=[3, 4, 5, 5, 5, 6, 6, 4], pieces="NCGT", shapes=RAMP_TRAP),
        "none",
        {},
        ("price", "column", "bar"),
        ["ramp"],
    ),
    "ramp-stair": (
        dict(residual=[3, 5, 5, 4, 4, 6, 6, 4], pieces="NCT", shapes=RAMP_STAIR),
        "none",
        {},
        ("price", "column", "bar"),
        ["ramp"],
    ),
}


def build_valid(name: str, spec: tuple[Any, ...], seed: int) -> dict[str, Any]:
    kw, level, exports, types, requires = spec
    rng = random.Random(seed)
    g = make_draft(**kw, gid=100 + seed, title=name)
    sol = solve_reference(g, rng, exports=exports)
    if sol is None:
        raise SystemExit(f"{name}: no reference solution")
    g["solution"] = sol
    fill_inventory(g, level)
    g["clues"] = []
    clues = select_clues(g, clue_pool(g, types))
    if clues is None:
        raise SystemExit(f"{name}: not deducible with {types}")
    g["clues"] = clues
    d = deduce(g)
    g["difficulty"] = {"rating": d.rating, "label": LABELS[d.rating], "techniques": sorted(d.techniques())}
    ex = exact.count(g)
    assert ex.count == 1 and ex.composition == reference_composition(g), name
    errors = validate(g, allow_ramp=bool(requires))
    assert not errors, (name, errors)
    return {
        "name": name,
        "grid": g,
        "expect": {
            "valid": True,
            "errors": [],
            "compositions": 1,
            "deduction": "solved",
            "rating": d.rating,
            "techniques": sorted(d.techniques()),
            "composition": reference_composition(g),
            "requires": requires,
        },
    }


def ramp_study(path: Path) -> list[dict[str, Any]]:
    """The 8 hand-made mini-grids of docs/next/rampe.md, in §14 with their expectations."""
    from dispatch_solver.grid import PIECE_SPEC

    out = []
    for i, (name, m) in enumerate(json.loads(path.read_text()).items(), start=1):
        n = len(m["demand"])
        pieces = {}
        for p, d in m["pieces"].items():
            kind = d.get("kind", "rect")
            pieces[p] = {"len": d["len"], "shape": kind} if kind != "rect" else {"len": d["len"], "height": [1]}
            pieces[p].update(PIECE_SPEC[p])
        inv = m.get("inventory")
        layout = [{k: v for k, v in p.items() if k != "height" or (v != 1 and p["piece"] != "C")} for p in m["layout"]]
        g = {
            "id": 300 + i,
            "title": f"Rampe {name}",
            "section": "tutorial",
            "columns": m["columns"],
            "demand": m["demand"],
            "pieces": pieces,
            "weather": {"R": [0] * n, "F": [0] * n},
            "neighbors": [],
            "step": False,
            "co2_cap": None,
            "inventory": {"level": "exact", "pieces": inv}
            if inv
            else {"level": "none", "pieces": {p: {} for p in pieces}},
            "clues": m["clues"],
            "solution": {"exports": {}, "step": [], "placements": layout},
            "difficulty": {"rating": 1, "label": "Facile", "techniques": []},
        }
        d = deduce(g)
        if d.solved:
            g["difficulty"] = {"rating": d.rating, "label": LABELS[d.rating], "techniques": sorted(d.techniques())}
        ex = exact.count(g)
        errors = validate(g, allow_ramp=True)
        assert not errors, (name, errors)
        expect = {"valid": True, "errors": [], "compositions": ex.count, "deduction": d.status, "requires": ["ramp"]}
        if d.solved:
            expect.update(rating=d.rating, techniques=sorted(d.techniques()), composition=reference_composition(g))
        out.append({"name": f"ramp-study-{name}", "grid": g, "expect": expect})
    return out


def invalid_cases(base: dict[str, Any]) -> dict[str, Any]:
    """name -> mutated copy of a valid grid (validator errors)."""

    def mut(f: Any) -> dict[str, Any]:
        g = copy.deepcopy(base)
        f(g)
        return g

    return {
        "bad-columns": mut(lambda g: g.update(columns=g["columns"][:5], demand=g["demand"][:5])),
        "bad-rank": mut(lambda g: g["pieces"]["N"].update(rank=2)),
        "bad-co2": mut(lambda g: g["pieces"]["N"].update(co2=1)),
        "unknown-piece": mut(lambda g: g["pieces"].update(X={"len": [1], "height": [1], "rank": 1, "co2": 0})),
        "inventory-missing-piece": mut(lambda g: g["inventory"]["pieces"].pop("N")),
        "inventory-none-with-totals": mut(lambda g: g["inventory"].update(level="none", exports={"DE": 0})),
        "imports-mixed": mut(lambda g: g["inventory"].update(imports={"*": 1, "DE": 0})),
        "step-unpublished": mut(lambda g: (g.update(step=True), g["inventory"].pop("step", None))),
        "clue-unknown-type": mut(lambda g: g["clues"].append({"type": "weather", "col": 0})),
        "clue-bad-col": mut(lambda g: g["clues"].append({"type": "price", "col": 99, "piece": "N"})),
        "flow-over-cap": mut(
            lambda g: g["clues"].append({"type": "flow", "col": 0, "country": "DE", "dir": "export", "value": 2})
        ),
        "bar-past-end": mut(lambda g: g["clues"].append({"type": "bar", "piece": "N", "col": 4, "len": 4})),
        "placement-bad-width": mut(
            lambda g: g["solution"]["placements"].append({"piece": "N", "row": 9, "col": 0, "len": 2})
        ),
        "import-too-wide": mut(
            lambda g: g["solution"]["placements"].append({"piece": "I", "country": "DE", "row": 9, "col": 0, "len": 2})
        ),
        "step-reversed": mut(
            lambda g: (
                g.update(step=True),
                g["inventory"].update(step=1),
                g["solution"].update(step=[{"pump": 3, "turbine": 1}]),
            )
        ),
        "export-over-cap": mut(lambda g: g["solution"]["exports"].update(DE=[2, 0, 0, 0, 0, 0])),
        "bad-difficulty": mut(lambda g: g["difficulty"].update(rating=5)),
        "ramp-disabled": mut(lambda g: g["pieces"]["N"].update(shape="trap")),
    }


def semantic_cases(published: list[dict[str, Any]]) -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    """Well-formed grids that are not publishable."""
    out = []
    expert = copy.deepcopy(next(g for g in published if g["id"] == 11))
    # Two compositions: drop clues until uniqueness breaks.
    for i in range(len(expert["clues"])):
        g = copy.deepcopy(expert)
        if g["clues"][i]["type"] == "exchanges":
            continue
        g["clues"].pop(i)
        ex = exact.count(g)
        if ex.count > 1:
            g["id"] = 201
            out.append(
                (
                    "two-compositions",
                    g,
                    {
                        "valid": True,
                        "errors": [],
                        "compositions": 2,
                        "deduction": deduce(g, record=False).status,
                        "requires": [],
                    },
                )
            )
            break
    # Reference breaking a clue: a record that contradicts the reference.
    g = copy.deepcopy(next(x for x in published if x["id"] == 9))
    g["id"] = 202
    rec = next(c for c in g["clues"] if c["type"] == "column")
    k = next(iter(rec["counts"]))
    rec["counts"][k] += 1
    ex = exact.count(g)
    out.append(
        (
            "reference-breaks-clue",
            g,
            {
                "valid": True,
                "errors": [],
                "compositions": ex.count,
                "deduction": deduce(g, record=False).status,
                "reference_solves": False,
                "requires": [],
            },
        )
    )
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.json"):
        if f.name != "unpublishable-unique-but-stuck.json":
            f.unlink()
    for seed, (name, spec) in enumerate(VALID.items(), start=1):
        fx = build_valid(name, spec, seed)
        (OUT / f"valid-{name}.json").write_text(json.dumps(fx, ensure_ascii=False, indent=1) + "\n")
        e = fx["expect"]
        print(f"valid-{name}: rating {e['rating']} {e['techniques']} clues={len(fx['grid']['clues'])}")
    study = Path(sys.argv[1]) if len(sys.argv) > 1 else RAMP_STUDY
    for fx in ramp_study(study):
        (OUT / f"valid-{fx['name']}.json").write_text(json.dumps(fx, ensure_ascii=False, indent=1) + "\n")
        e = fx["expect"]
        print(
            f"valid-{fx['name']}: compositions {e['compositions']} {e['deduction']} {e.get('rating')} "
            f"{e.get('techniques')}"
        )
    published = load_grids(PUBLISHED)
    base = copy.deepcopy(next(g for g in published if g["id"] == 5))
    for name, g in invalid_cases(base).items():
        errors = validate(g)
        assert errors, name
        req = ["ramp"] if "ramp" in name else []
        fx = {"name": name, "grid": g, "expect": {"valid": False, "errors": errors, "requires": req}}
        (OUT / f"invalid-{name}.json").write_text(json.dumps(fx, ensure_ascii=False, indent=1) + "\n")
        print(f"invalid-{name}: {errors}")
    for name, g, expect in semantic_cases(published):
        fx = {"name": name, "grid": g, "expect": expect}
        (OUT / f"unpublishable-{name}.json").write_text(json.dumps(fx, ensure_ascii=False, indent=1) + "\n")
        print(f"unpublishable-{name}: {expect}")


if __name__ == "__main__":
    main()
