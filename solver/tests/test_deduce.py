"""Deduction solver: soundness against CP-SAT, unknown and published day totals, traces, minimal clues."""

import copy
import json
import random

import pytest
from conftest import FIXTURES, published

from dispatch_solver import exact
from dispatch_solver.board import reference_composition
from dispatch_solver.deduce import RULES, deduce
from dispatch_solver.generate.cluesel import clue_pool, mandatory_clues, select_clues
from dispatch_solver.generate.draft import make_draft
from dispatch_solver.generate.reference import fill_inventory, solve_reference


def drawn(seed: int, **kw) -> dict:
    rng = random.Random(seed)
    n = kw.pop("n", 8)
    d = make_draft([rng.randint(2, 6) for _ in range(n)], kw.pop("pieces", "NGT"), **kw)
    d["solution"] = solve_reference(d, rng, exports={k: 1 for k, _c, _o in kw.get("neighbors", [])})
    fill_inventory(d, "none")
    d["clues"] = mandatory_clues(d)
    return d


def test_unknown_totals_are_free():
    """A neighbor without any exchanges clue: exports and imports may be anything the line allows."""
    g = drawn(3, neighbors=[("DE", 1, 1)])
    assert not any(c["type"] == "exchanges" for c in g["clues"])
    clues = select_clues(g, clue_pool(g, ("price", "column", "flow")))
    assert clues is not None
    g["clues"] = clues
    res = deduce(g)
    assert res.solved and res.composition == reference_composition(g)
    assert exact.count(g).count == 1


def test_day_total_is_a_record_step():
    """C3: a published export total is used by « Le relevé compte les cases » (record), day scope."""
    fx = json.loads((FIXTURES / "valid-partial-totals.json").read_text())
    g = fx["grid"]
    ex_clues = [i for i, c in enumerate(g["clues"]) if c["type"] == "exchanges"]
    assert ex_clues
    res = deduce(g)
    assert any(s.rule == "record" and set(ex_clues) & set(s.clues) for s in res.steps)


def test_trace_fields():
    g = next(x for x in published() if x["id"] == 11)
    res = deduce(g)
    d = res.to_dict()
    assert d["status"] == "solved" and d["rating"] == 4
    assert all(s["rule"] in RULES and s["effects"] for s in d["steps"])
    assert any(s.get("cells") for s in d["steps"])
    assert d["summary"]["order"][0] in RULES and d["summary"]["level2_steps"] >= 1


def test_ramp_steps_are_tagged():
    fx = json.loads((FIXTURES / "valid-ramp-study-T1.json").read_text())
    res = deduce(fx["grid"])
    assert any("ramp_trap" in s.shapes for s in res.steps)
    assert any(k.endswith(":ramp_trap") for k in res.summary()["shape_steps"])


@pytest.mark.parametrize("seed", range(6))
def test_sound_on_random_grids(seed):
    """Whatever clues are given: a solved deduction is the only CP-SAT composition."""
    rng = random.Random(seed)
    g = drawn(seed, neighbors=[("DE", 1, 2)], step=seed % 2)
    pool = clue_pool(g)
    for _ in range(4):
        h = copy.deepcopy(g)
        h["clues"] = mandatory_clues(g) + rng.sample(pool, rng.randint(0, 4))
        res = deduce(h, record=False)
        ex = exact.count(h)
        if res.solved:
            assert ex.count == 1 and res.composition == ex.composition
        assert res.status != "contradiction"  # clues come from the reference: never contradictory


def test_selected_clues_are_minimal():
    g = drawn(5, neighbors=[("DE", 1, 1)], step=1)
    clues = select_clues(g, clue_pool(g))
    assert clues is not None
    g["clues"] = clues
    assert deduce(g).solved
    base = mandatory_clues(g)
    for i, c in enumerate(clues):
        if c in base:
            continue
        fewer = {**g, "clues": clues[:i] + clues[i + 1 :]}
        res = deduce(fewer, record=False)
        assert not (res.solved and res.composition == reference_composition(g)), c
