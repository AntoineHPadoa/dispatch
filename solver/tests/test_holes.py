"""Filling and hole measures (lab), options of the reference (hole types, nuclear cap, one plant), lab quotas."""

import copy
import importlib.util
import json
import random
from pathlib import Path

from dispatch_solver.board import Puzzle
from dispatch_solver.deduce import deduce
from dispatch_solver.deduce.holes import filling_measures, find_holes, hole_measures, lot_measures, placement_cells
from dispatch_solver.deduce.trace import decisions
from dispatch_solver.generate.lot import Quotas, check_lot, make_candidate
from dispatch_solver.generate.reference import draw_hole_types, solve_reference

GRIDS = json.loads((Path(__file__).parent / "data" / "holes.json").read_text())


def measures(g: dict) -> tuple[dict, dict]:
    return filling_measures(g, decisions(g, deduce(g).steps)), hole_measures(g)


def test_holes_are_runs_of_one_or_two_cells_against_a_brick():
    """gas_only (v3g4-jouer-a n°3): two 2-cell holes on row 1, one on row 2; the 3-cell run beside is none."""
    assert find_holes(Puzzle(GRIDS["gas_only"])) == [[(1, 0), (1, 1)], [(1, 6), (1, 7)], [(2, 6), (2, 7)]]


def test_measures_of_the_spec_examples():
    """docs/next/v3-criteres-m23.md §2-3: the grids the player commented on."""
    fill, holes = measures(GRIDS["gas_only"])  # "du remplissage avec de l'import": holes for gas only
    assert fill == {"cells": 22, "full_n_rows": 0, "nuclear_share": 0.68, "cells_per_decision": 3.1}
    assert holes == {"n": 3, "unique": 3, "contested": 0, "types": []}
    _, holes = measures(GRIDS["tall_contested"])  # c n°10, ★: gas or import, settled by the exports
    assert holes["contested"] == 2 and all(len(t) >= 2 for t in holes["types"])
    _, holes = measures(GRIDS["gas_import_trivial"])  # "le carré de gaz revient": open at level 1, trivial after
    assert holes["n"] == 2 and holes["unique"] == 0 and holes["contested"] == 0
    fill, _ = measures(GRIDS["nuclear_rows"])  # v3g3-b n°13: 50 cells, mostly nuclear
    assert fill["cells"] == 50 and fill["full_n_rows"] == 4


def test_cells_count_every_reference_cell():
    for g in GRIDS.values():
        pz = Puzzle(g)
        fill, _ = measures(g)
        total = sum(len(placement_cells(pz, p)) for p in g["solution"]["placements"])
        assert fill["cells"] == total == sum(sum(col.values()) for col in deduce(g).composition["cells"])


def test_lot_measures_aggregate():
    grids = []
    for g in GRIDS.values():
        fill, holes = measures(g)
        grids.append({**g, "lab": {**fill, "holes": holes}})
    agg = lot_measures(grids)
    assert agg["cells_bands"][">=40"] == 1 and sum(agg["cells_bands"].values()) == 4
    assert agg["holes"]["contested"] == 2 and agg["holes"]["grids_with_contested"] == 1
    assert lot_measures([])["holes"]["holes"] == 0


def _draft(g: dict) -> dict:
    d = copy.deepcopy(g)
    d["clues"] = []
    d["solution"] = {"exports": {}, "step": [], "placements": []}
    d["inventory"] = {"level": "none", "pieces": {k: {} for k in d["pieces"]}}  # as a draft: no bar counts yet
    d["co2_cap"] = None  # an "auto" cap is computed after the reference
    return d


def _hole_types(g: dict, sol: dict) -> set[str]:
    pz = Puzzle(g)
    cells = {x for h in find_holes(pz) for x in h}
    out = set()
    for p in sol["placements"]:
        if placement_cells(pz, p) & cells:
            out.add(p["piece"])
    return out


def test_reference_draws_the_type_of_a_hole():
    """Without hole_types the merit order fills the holes with gas; with it, other fitting types come too."""
    d = _draft(GRIDS["gas_only"])
    pz = Puzzle(d)
    assert all(len(h) == 2 for h, _t in draw_hole_types(pz, random.Random(0)))
    plain, drawn = set(), set()
    for seed in range(8):
        plain |= _hole_types(d, solve_reference(d, random.Random(seed), import_cost=6))
        drawn |= _hole_types(d, solve_reference(d, random.Random(seed), import_cost=6, hole_types=True))
    assert plain == {"G"}
    assert len(drawn) >= 2 and drawn <= {"G", "T", "I"}


def test_hole_types_is_a_config_key():
    _, errors = check_lot({"lot": "t", "size": 1, "mix": [{"hole_types": "yes"}]})
    assert any("hole_types" in e for e in errors)
    for seed in range(30):
        g, _why, _ = make_candidate({"cols": 8, "pieces": "NGT", "neighbors": 1, "hole_types": True}, seed)
        if g is not None:
            break
    assert g is not None and set(g["lab"]["holes"]) == {"n", "unique", "contested", "types"}
    assert {"cells", "full_n_rows", "nuclear_share", "cells_per_decision"} <= set(g["lab"])


def _hgrid(fam: str, r: int, contested: int, cells: int = 20, seed: int = 0) -> dict:
    return {
        "columns": ["a", "b"],
        "demand": [1, 2 + 3 * len(fam)],
        "weather": {"R": [0, 0], "F": [0, 0]},
        "pieces": {"N": {}},
        "difficulty": {"rating": r},
        "lab": {
            "family": fam,
            "mechanics": [],
            "clue_profile": [],
            "seed": seed,
            "cells": cells,
            "holes": {"n": contested, "unique": 0, "contested": contested, "types": ["GT"] * contested},
        },
    }


def test_contested_soft_quota_holds_half_and_never_rejects():
    q = Quotas(20, {"min_per_rating": 0, "max_same_family": 20, "min_with_contested": 1})
    plain = [_hgrid("a" * (i + 1), 2, 0, seed=i) for i in range(40)]
    held = [g for g in plain if q.holds(g)]
    assert 10 <= len(held) <= 30  # one time in two, by the grid's seed
    assert all(q.check(g) is None for g in plain)  # never a reject
    assert not q.holds(_hgrid("x", 1, 0, seed=held[0]["lab"]["seed"]))  # Facile: not concerned
    assert not q.holds(_hgrid("y", 2, 1, seed=held[0]["lab"]["seed"]))  # has a contested hole
    q.add(_hgrid("z", 3, 1))
    assert not q.short_contested() and not any(q.holds(g) for g in plain)  # quota met: nothing waits
    assert not Quotas(20, {}).holds(held[0])  # no quota: nothing waits


def test_filler_reject_is_off_by_default():
    big = _hgrid("a", 3, 0, cells=45)
    assert Quotas(20, {"min_per_rating": 0}).check(big) is None
    q = Quotas(20, {"min_per_rating": 0, "filler_cells": 40})
    assert q.check(big) == "filler"
    assert q.check(_hgrid("b", 2, 0, cells=45)) is None  # Moyen: never
    assert q.check(_hgrid("c", 4, 0, cells=39)) is None


def test_min_per_rating_per_rating():
    lot, errors = check_lot({"lot": "t", "size": 20, "mix": [{}], "quotas": {"min_per_rating": {"4": 3, "3": 4}}})
    assert not errors and lot["quotas"]["min_per_rating"] == {4: 3, 3: 4}
    q = Quotas(20, lot["quotas"])
    assert [q.need(r) for r in (1, 2, 3, 4)] == [2, 2, 4, 3]
    assert q.missing_ratings() == [1, 2, 3, 4]
    _, errors = check_lot({"lot": "t", "size": 20, "mix": [{}], "quotas": {"min_per_rating": {"5": 1}}})
    assert errors


def test_rerate_rewrites_the_measures():
    spec = importlib.util.spec_from_file_location(
        "rerate_lots", Path(__file__).parents[1] / "scripts" / "rerate_lots.py"
    )
    rerate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(rerate)
    out = rerate.rerate(GRIDS["tall_contested"])
    assert out["problems"] == []
    assert out["measures"]["holes"]["contested"] == 2
    assert {"cells", "full_n_rows", "cells_per_decision"} <= set(out["measures"])


def test_nuclear_cap_loosens_the_skeleton():
    """max_nuclear caps the nuclear share of the reference; without it, the merit order fills with nuclear."""
    d = _draft(GRIDS["nuclear_rows"])  # 50 cells, mostly nuclear
    share = []
    for cap in (None, 0.5):
        sol = solve_reference(d, random.Random(1), import_cost=6, max_nuclear=cap)
        g = {**d, "solution": sol}
        share.append(filling_measures(g, {})["nuclear_share"])
    assert share[0] > 0.8 and share[1] <= 0.5


def test_skeleton_config_keys():
    _, errors = check_lot(
        {"lot": "t", "size": 1, "mix": [{"max_nuclear": [0.8, 0.3]}, {"max_nuclear": 0.5}, {"allow_one_plant": 1}]}
    )
    assert sum("max_nuclear" in e for e in errors) == 2 and any("allow_one_plant" in e for e in errors)
    cfg = {"cols": 6, "pieces": "NG", "max_nuclear": [0.3, 0.6], "allow_one_plant": True, "min_decisions": 0}
    kept = [g for s in range(20) if (g := make_candidate(cfg, s)[0]) is not None]
    assert kept and all(0.3 <= g["lab"]["nuclear_cap"] <= 0.6 for g in kept)
    assert all(g["lab"]["nuclear_share"] <= g["lab"]["nuclear_cap"] + 1e-9 for g in kept)
    reasons = {make_candidate({**cfg, "allow_one_plant": False}, s)[1] for s in range(20)}
    one = [
        g
        for s in range(40)
        if (g := make_candidate({"cols": 6, "pieces": "NG", "allow_one_plant": True, "min_decisions": 0}, s)[0])
        and len({p["piece"] for p in g["solution"]["placements"] if p["piece"] != "I"}) == 1
    ]
    assert one or "one_plant" not in reasons
