"""Build the shared reference grids in fixtures/grids/ (read by pytest and Vitest).

- Valid grids: hand-drawn drafts covering what the published grids do not (several neighbors, tall
  pieces, stock, surplus, CO2 cap, length clues, partial day totals, STEP without inventory, ramps),
  completed by the reference solution and the clue selection, then checked (one composition, deducible).
- Weather bricks: a bar above a weather step and a surplus brick over the demand (checked on the reference);
  the invalid cases include a bar and an engaged clue on a weather cell, overlapping placements, a hole
  and a cell above the silhouette in the reference drawing.
- Invalid grids: one per validator check, with the expected messages written by hand (the contract with
  the TS validator), and well-formed grids that are not publishable (two compositions, reference
  breaking a clue, unique but not deducible).
- Traps of the S4.2 review (fixtures/sources/traps/) and generated grids that show a technique no other
  fixture exercises (length, single_spot, ramp techniques).
- Everything is built first, then written through a temporary folder: a failure deletes nothing.
- `expect` holds what both implementations must find; rerun after a solver change and review the diff.
- `unpublishable-unique-but-stuck.json` is kept by hand (found by a random search, rare): the script
  does not rewrite it.

Usage (from solver/): .venv/bin/python scripts/build_fixtures.py [path/to/docs/next/rampe/grids.json]
"""

from __future__ import annotations

import copy
import json
import os
import random
import sys
import tempfile
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
TRAPS_DIR = ROOT / "fixtures" / "sources" / "traps"
KEPT_BY_HAND = {"unpublishable-unique-but-stuck.json"}

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
            residual=[4, 3, 4, 6, 7, 6, 8, 9, 7, 6, 5, 4],
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
    "length-clues": (dict(residual=[3, 4, 4, 5, 5, 6, 6, 4], pieces="NGT"), "none", {}, ("length", "column"), []),
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
    # Weather bricks (rows are absolute): a bar may run above a weather step, never across it.
    "bar-above-step": (
        dict(residual=[4, 4, 2, 2, 4, 4, 3, 3], pieces="NGT", weather_r=[0, 0, 2, 2, 0, 0, 1, 1]),
        "none",
        {},
        ("price", "column", "bar"),
        [],
    ),
    "surplus-brick": (
        dict(
            residual=[3, 4, 3, -1, 3, 4, 4, 3],
            pieces="NGT",
            neighbors=[("DE", 1, 1)],
            weather_r=[0, 1, 2, 5, 2, 1, 0, 0],
        ),
        "none",
        {"DE": 1},
        ("price", "column", "flow", "exchanges"),
        [],
    ),
}

# What a weather fixture must show, checked on its reference solution.
WEATHER_SHAPES = {"bar-above-step": "above_step", "surplus-brick": "brick_over_demand"}


def weather_shape(g: dict[str, Any], what: str) -> bool:
    w = [r + f for r, f in zip(g["weather"]["R"], g["weather"]["F"])]
    if what == "brick_over_demand":
        return any(w[c] > g["demand"][c] for c in range(len(w)))
    return any(len({w[c] for c in range(p["col"], p["col"] + p["len"])}) > 1 for p in g["solution"]["placements"])


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
    if name in WEATHER_SHAPES and not weather_shape(g, WEATHER_SHAPES[name]):
        raise SystemExit(f"{name}: the reference does not show {WEATHER_SHAPES[name]}")
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


# name: (mutation of a valid grid, expected messages written by hand, allow_ramp). The messages are the
# contract with web/src/model/grid.ts: Vitest checks the TS validator against them, pytest the Python one.
INVALID: dict[str, tuple[Any, list[str], bool]] = {
    "bad-columns": (
        lambda g: g.update(columns=g["columns"][:5], demand=g["demand"][:5]),
        [
            "columns: 6 to 12 labels expected",
            "weather: R and F with 5 integers each expected",
            "solution.exports.DE: 5 integers >= 0 expected",
            "solution.placements[3]: row, col, len expected",
            "solution.placements[3]: goes past the last column",
        ],
        False,
    ),
    "bad-rank": (lambda g: g["pieces"]["N"].update(rank=2), ["pieces.N.rank: 1 expected (§3)"], False),
    "bad-co2": (lambda g: g["pieces"]["N"].update(co2=1), ["pieces.N.co2: 0 expected (§3)"], False),
    "unknown-piece": (
        lambda g: g["pieces"].update(X={"len": [1], "height": [1], "rank": 1, "co2": 0}),
        ["pieces.X: unknown piece"],
        False,
    ),
    "inventory-missing-piece": (
        lambda g: g["inventory"]["pieces"].pop("N"),
        ["inventory.pieces.N: missing (declared in pieces)"],
        False,
    ),
    "inventory-none-with-totals": (
        lambda g: g["inventory"].update(level="none", exports={"DE": 0}),
        [
            "inventory.pieces.N: no bars/cells at level none",
            "inventory: exchange totals belong to an exchanges clue at level none",
        ],
        False,
    ),
    "imports-mixed": (
        lambda g: g["inventory"].update(imports={"*": 1, "DE": 0}),
        ['inventory.imports: "*" cannot be mixed with per-country keys'],
        False,
    ),
    "null-totals": (lambda g: g["inventory"].update(exports=None), ["inventory.exports: object expected"], False),
    "step-unpublished": (
        lambda g: (g.update(step=True), g["inventory"].pop("step", None)),
        ["step: a STEP grid must publish its number of pairs (inventory.step or an exchanges clue step)"],
        False,
    ),
    "step-without-step": (lambda g: g["inventory"].update(step=1), ["inventory.step: grid has no STEP"], False),
    "exact-no-bars": (
        lambda g: g["inventory"]["pieces"]["N"].pop("bars"),
        ["inventory.pieces.N: exact level needs bars or cells"],
        False,
    ),
    "max-cells-negative": (
        lambda g: g["inventory"]["pieces"]["N"].update(max_cells=-1),
        ["inventory.pieces.N.max_cells: integer >= 0 expected"],
        False,
    ),
    "neighbor-twice": (
        lambda g: g["neighbors"].append(dict(g["neighbors"][0])),
        ["neighbors[1].id: invalid or duplicate id"],
        False,
    ),
    "clue-unknown-type": (
        lambda g: g["clues"].append({"type": "weather", "col": 0}),
        ["clues[1]: unknown clue type"],
        False,
    ),
    "clue-bad-col": (
        lambda g: g["clues"].append({"type": "price", "col": 99, "piece": "N"}),
        ["clues[1].col: column index expected"],
        False,
    ),
    "exchanges-mixed": (
        lambda g: g["clues"].append({"type": "exchanges", "imports": {"*": 1, "DE": 0}}),
        ['clues[1].imports: "*" cannot be mixed with per-country keys'],
        False,
    ),
    "flow-over-cap": (
        lambda g: g["clues"].append({"type": "flow", "col": 0, "country": "DE", "dir": "export", "value": 2}),
        ["clues[1].value: over the line capacity"],
        False,
    ),
    "bar-past-end": (
        lambda g: g["clues"].append({"type": "bar", "piece": "N", "col": 4, "len": 4}),
        ["clues[1]: bar goes past the last column"],
        False,
    ),
    "placement-bad-width": (
        lambda g: g["solution"]["placements"].append({"piece": "N", "row": 9, "col": 0, "len": 2}),
        ["solution.placements[6].len: width not allowed for N"],
        False,
    ),
    "placement-bad-height": (
        lambda g: g["solution"]["placements"].append({"piece": "N", "row": 9, "col": 0, "len": 4, "height": 2}),
        ["solution.placements[6].height: height not allowed for N"],
        False,
    ),
    "placement-past-end": (
        lambda g: g["solution"]["placements"].append({"piece": "N", "row": 9, "col": 4, "len": 4}),
        ["solution.placements[6]: goes past the last column"],
        False,
    ),
    "import-too-wide": (
        lambda g: g["solution"]["placements"].append({"piece": "I", "country": "DE", "row": 9, "col": 0, "len": 2}),
        ["solution.placements[6].len: an import is one cell"],
        False,
    ),
    "step-reversed": (
        lambda g: (
            g.update(step=True),
            g["inventory"].update(step=1),
            g["solution"].update(step=[{"pump": 3, "turbine": 1}]),
        ),
        ["solution.step[0]: pump must come before turbine"],
        False,
    ),
    "export-over-cap": (
        lambda g: g["solution"]["exports"].update(DE=[2, 0, 0, 0, 0, 0]),
        ["solution.exports.DE: over the line capacity"],
        False,
    ),
    "bad-difficulty": (
        lambda g: g["difficulty"].update(rating=5),
        ["difficulty: {rating 1-4, label, techniques[]} expected"],
        False,
    ),
    "head-bad": (
        lambda g: g.update(title="", section="daily"),
        ["title: non-empty string expected", 'section: "tutorial" or "rated" expected'],
        False,
    ),
    "co2-cap-bad": (lambda g: g.update(co2_cap=-1), ["co2_cap: null or integer >= 0 expected"], False),
    "flow-dir-bad": (
        lambda g: g["clues"].append({"type": "flow", "col": 0, "country": "DE", "dir": "both", "value": 0}),
        ['clues[1].dir: "export" or "import" expected'],
        False,
    ),
    "engaged-row-bad": (
        lambda g: g["clues"].append({"type": "engaged", "piece": "N", "row": -1, "col": 0, "len": 3}),
        ["clues[1].row: integer >= 0 expected"],
        False,
    ),
    "placement-on-weather": (
        lambda g: g["weather"].update(R=[0, 0, 1, 0, 0, 0]),
        ["solution.placements[0]: covers a weather cell at 8h"],
        False,
    ),
    "engaged-on-weather": (
        lambda g: (
            g["weather"].update(R=[0, 0, 1, 0, 0, 0]),
            g["clues"].append({"type": "engaged", "piece": "N", "row": 0, "col": 1, "len": 3}),
        ),
        ["clues[1]: covers a weather cell at 8h", "solution.placements[0]: covers a weather cell at 8h"],
        False,
    ),
    "bulletin-text-blank": (
        lambda g: g.update(
            bulletin={"number": 1, "title": "t", "text": "  ", "weather": ["sun"] * 6, "published": "2026-11-18"}
        ),
        ["bulletin.text: non-empty string expected"],
        False,
    ),
    "bulletin-bad": (
        lambda g: g.update(
            bulletin={"number": 0, "title": "", "text": "x", "weather": ["sun"], "published": "2026-13-40"}
        ),
        [
            "bulletin.number: positive integer expected",
            "bulletin.title: non-empty string expected",
            "bulletin.weather: 6 values among sun, moon, cloud, wind expected",
            "bulletin.published: ISO date YYYY-MM-DD expected",
        ],
        False,
    ),
    "placements-overlap": (
        lambda g: g["solution"]["placements"].append({"piece": "N", "row": 0, "col": 0, "len": 3}),
        ["solution.placements[6]: overlaps solution.placements[0] at 0h"],
        False,
    ),
    "drawing-hole": (
        lambda g: g["solution"]["placements"].pop(5),
        ["solution: hole at 8h, row 2"],
        False,
    ),
    "drawing-above-silhouette": (
        lambda g: g["solution"]["placements"].append({"piece": "I", "country": "DE", "row": 1, "col": 0, "len": 1}),
        ["solution: cell above the silhouette at 0h, row 1"],
        False,
    ),
    "ramp-disabled": (
        lambda g: g["pieces"]["N"].update(shape="trap"),
        ["pieces.N.shape: ramps are not enabled"],
        False,
    ),
    "ramp-not-coal": (
        lambda g: g["pieces"]["N"].update(shape="trap"),
        ["pieces.N.shape: only coal (C) can be a ramp", "pieces.N.height: a ramp has no height"],
        True,
    ),
    "ramp-too-narrow": (
        lambda g: (
            g["pieces"].update(C={"len": [2, 3], "shape": "trap", "rank": 3, "co2": 3}),
            g["inventory"]["pieces"].update(C={"bars": [3]}),
        ),
        ["pieces.C.len: a trap ramp is at least 3 wide"],
        True,
    ),
}


def invalid_cases(base: dict[str, Any]) -> dict[str, tuple[dict[str, Any], list[str], bool]]:
    """name -> (mutated copy of a valid grid, expected errors, allow_ramp)."""
    out = {}
    for name, (f, errors, allow) in INVALID.items():
        g = copy.deepcopy(base)
        f(g)
        out[name] = (g, errors, allow)
    return out


# Hand-made traps of the S4.2 review (fixtures/sources/traps/): name -> what they pin down.
TRAPS = {
    "co2-country": "carbon: the CO2 cap picks the importing country",
    "line-cap-after-export-flow": "flow: an export that fills the line leaves no room for an import",
    "swap-hides-column-sum-col-record": "column_sum, not swap: the count needs the column height",
    "swap-hides-column-sum-day-total": "column_sum, not swap: the count needs the column height (day total)",
    "max-cells-tall": "a tall dam bar counts its cells in max_cells",
    "tall-vs-two-bars": "same drawing, two compositions (tall coal or two gas bars)",
}

# Generated grids that exercise a technique no other fixture shows: name -> (config, technique).
TECHNIQUE_GRIDS = {
    "technique-length": ({"cols": 8, "clue_types": ["length", "column"]}, "length"),
    "technique-single-spot": ({"cols": 6, "inventory": "exact", "neighbors": 1}, "single_spot"),
    "technique-ramp-plateau": ({"cols": 8, "ramp": "trap"}, "ramp_plateau"),
    "technique-ramp-shoulder": ({"cols": 8, "ramp": "trap"}, "ramp_shoulder"),
}


def traps() -> list[dict[str, Any]]:
    out = []
    for name, why in TRAPS.items():
        raw = json.loads((TRAPS_DIR / f"{name}.json").read_text())
        g = raw.get("grid", raw)
        ex = exact.count(g, cap=5)
        if ex.count == 1:
            g["solution"] = ex.solution  # the traps were written without their reference
        d = deduce(g)
        expect: dict[str, Any] = {
            "valid": True,
            "errors": [],
            "compositions": ex.count,
            "deduction": d.status,
            "requires": [],
            "note": why,
        }
        if d.solved and ex.count == 1:
            expect.update(rating=d.rating, techniques=sorted(d.techniques()), composition=reference_composition(g))
        out.append({"name": f"trap-{name}", "grid": g, "expect": expect})
    return out


def technique_grids() -> list[dict[str, Any]]:
    from dispatch_solver.generate.lot import make_candidate

    out = []
    for name, (cfg, tech) in TECHNIQUE_GRIDS.items():
        for seed in range(400):
            g, _why, _ = make_candidate(cfg, seed)
            if g is not None and tech in g["difficulty"]["techniques"]:
                break
        else:
            raise SystemExit(f"{name}: no grid shows {tech}")
        g.pop("lab")
        g["id"] = 400 + len(out)
        d = deduce(g)
        ramp = bool(cfg.get("ramp"))
        out.append(
            {
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
                    "requires": ["ramp"] if ramp else [],
                    "note": f"seed {seed} of {cfg}",
                },
            }
        )
    return out


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
    exact.NUM_WORKERS = 1  # reproducible references (S4.2 M1)
    built: dict[str, dict[str, Any]] = {}  # file name -> fixture; nothing is written before all are built
    for seed, (name, spec) in enumerate(VALID.items(), start=1):
        fx = build_valid(name, spec, seed)
        built[f"valid-{name}.json"] = fx
        e = fx["expect"]
        print(f"valid-{name}: rating {e['rating']} {e['techniques']} clues={len(fx['grid']['clues'])}")
    study = Path(sys.argv[1]) if len(sys.argv) > 1 else RAMP_STUDY
    for fx in ramp_study(study):
        built[f"valid-{fx['name']}.json"] = fx
        e = fx["expect"]
        print(
            f"valid-{fx['name']}: compositions {e['compositions']} {e['deduction']} {e.get('rating')} "
            f"{e.get('techniques')}"
        )
    for fx in traps() + technique_grids():
        e = fx["expect"]
        prefix = "valid" if e.get("composition") is not None else "unpublishable"
        built[f"{prefix}-{fx['name']}.json"] = fx
        print(f"{prefix}-{fx['name']}: {e['compositions']} {e['deduction']} {e.get('rating')} {e.get('techniques')}")
    published = load_grids(PUBLISHED)
    base = copy.deepcopy(next(g for g in published if g["id"] == 5))
    for name, (g, expected, allow) in invalid_cases(base).items():
        errors = validate(g, allow_ramp=allow)
        if errors != expected:
            raise SystemExit(f"invalid-{name}: validate() gives {errors}, expected {expected}")
        req = ["ramp"] if "ramp" in name else []
        expect: dict[str, Any] = {"valid": False, "errors": expected, "requires": req}
        if allow:
            expect["allow_ramp"] = True
        built[f"invalid-{name}.json"] = {"name": name, "grid": g, "expect": expect}
        print(f"invalid-{name}: {errors}")
    for name, g, expect in semantic_cases(published):
        built[f"unpublishable-{name}.json"] = {"name": name, "grid": g, "expect": expect}
        print(f"unpublishable-{name}: {expect}")
    # Write to a temporary folder, then swap: a failure above leaves fixtures/grids/ untouched (S4.2 B1).
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=OUT.parent) as tmp:
        for fname, fx in built.items():
            (Path(tmp) / fname).write_text(json.dumps(fx, ensure_ascii=False, indent=1) + "\n")
        for f in OUT.glob("*.json"):
            if f.name not in KEPT_BY_HAND and f.name not in built:
                f.unlink()
        for fname in built:
            os.replace(Path(tmp) / fname, OUT / fname)


if __name__ == "__main__":
    main()
