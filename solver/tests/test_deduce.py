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
    steps = [s for s in res.steps if s.rule == "record" and set(ex_clues) & set(s.clues)]
    assert steps and all(s.scope == "day" for s in steps)
    assert all(s.to_dict()["scope"] == "day" for s in steps)


def test_exchanges_are_structured():
    """S4.2 C3: a fixed export is a structured change with its slot, not only French text."""
    fx = json.loads((FIXTURES / "valid-surplus-export.json").read_text())
    res = deduce(fx["grid"])
    fixed = [s for s in res.steps if s.exchanges]
    assert fixed
    for s in fixed:
        for country, ch in s.exchanges.items():
            if country != "step":
                assert all(c in s.columns for c, _v in ch["export"])


def test_inventory_totals_are_steps():
    """S4.2 C3: the exact inventory's exchange totals are applied by a traced step, not silently."""
    g = next(x for x in published() if x["id"] == 7)
    res = deduce(g)
    assert any(s.rule == "exhausted" and s.scope == "day" for s in res.steps)


def test_swap_needs_local_counts():
    """S4.2 C1: counting the column height is Compter la colonne (level 2), not Cases interchangeables."""
    fx = json.loads((FIXTURES / "valid-trap-swap-hides-column-sum-col-record.json").read_text())
    res = deduce(fx["grid"])
    assert res.solved and res.rating == 2 and "column_sum" in res.techniques()


def test_refutation_has_a_budget():
    """S4.2 C7: a stuck grid gives up within a bounded time."""
    import time

    fx = json.loads((FIXTURES / "unpublishable-unique-but-stuck.json").read_text())
    t = time.perf_counter()
    assert deduce(fx["grid"], record=False).status == "stuck"
    assert time.perf_counter() - t < 10


def test_ramp_techniques_in_traces():
    """rv8 C5: the trapezoid techniques of the study are named in the traces."""
    found = set()
    for name in ("valid-ramp-study-T2.json", "valid-ramp-study-T3.json", "valid-technique-ramp-shoulder.json"):
        res = deduce(json.loads((FIXTURES / name).read_text())["grid"])
        found |= {s.rule for s in res.steps}
    assert {"ramp_lone", "ramp_plateau", "ramp_shoulder"} <= found


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
