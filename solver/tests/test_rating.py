"""Notation A (coupled global mechanics), compactness K, the "coupled" quota key and demand prices (D7)."""

import random

from conftest import grid_by_id

from dispatch_solver.deduce import deduce
from dispatch_solver.deduce.trace import Result, Step, compactness, coupled_globals, decisions
from dispatch_solver.generate.cluesel import clue_pool, demand_prices, select_clues
from dispatch_solver.generate.lot import Quotas, _draw, check_lot, config_types, decision_types


def grid(gid: int) -> dict:
    return grid_by_id(gid)


def test_published_ratings_under_notation_a():
    """G7: STEP coupled to the exchanges, Difficile; G10 and tutorial 9: share_out, capped at Moyen."""
    res = deduce(grid(7))
    assert res.technique_level == 2 and res.coupled_globals == ["step"] and res.rating == 3
    for gid in (10, 13):
        res = deduce(grid(gid))
        assert res.technique_level == 3 and "share_out" in res.techniques()
        assert res.coupled_globals == [] and res.rating == 2
    assert deduce(grid(11)).rating == 1


def _comp(exports: list[int], pumps: list[int], imports: bool = False) -> dict:
    cells = [{"N": 1, **({"I:DE": 1} if imports and c == 0 else {})} for c in range(len(exports))]
    return {"cells": cells, "exports": {"DE": exports}, "pumps": pumps, "turbines": pumps[::-1]}


def test_coupled_globals_need_an_exchange():
    steps = [Step("carbon", ["x"]), Step("silhouette", ["y"], exchanges={"step": [[0, 1]]})]
    assert coupled_globals(steps, _comp([0, 0], [1, 0])) == []  # no neighbor trade: c n°9 profile
    assert coupled_globals(steps, _comp([1, 0], [1, 0])) == ["step", "carbon"]
    assert coupled_globals(steps, _comp([0, 0], [1, 0], imports=True)) == ["step", "carbon"]
    assert coupled_globals(steps[:1], _comp([1, 0], [0, 0])) == ["carbon"]
    assert coupled_globals(steps[1:], _comp([1, 0], [0, 0])) == []  # STEP option fixed but no pair used
    assert coupled_globals(steps, None) == []


def test_rating_caps_techniques_then_adds_coupled_globals():
    comp = _comp([1, 0], [1, 0])
    refuted = Step("refuted", ["x"])
    assert Result("solved", [Step("ribbon", ["x"])], comp).rating == 1
    assert Result("solved", [refuted], comp).rating == 2
    assert Result("solved", [refuted], comp).technique_level == 4
    assert Result("solved", [refuted, Step("carbon", ["x"])], comp).rating == 3
    both = [refuted, Step("carbon", ["x"]), Step("silhouette", ["y"], exchanges={"step": [[0, 1]]})]
    assert Result("solved", both, comp).rating == 4
    assert Result("solved", both, _comp([0, 0], [1, 0])).rating == 2  # same steps, no exchange
    assert Result("solved", [Step("room", ["x"])], comp).summary()["coupled_globals"] == []


def test_compactness_of_g7():
    """K = decision weight / pieces laid: G7's STEP (3) over 7 bars and 2 imports."""
    g = grid(7)
    dec = decisions(g, deduce(g).steps)
    assert dec == {"step": 1}
    assert compactness(g, dec) == 0.33


def test_coupled_quota_key():
    lab = {"decisions": {"step": 1}, "coupled_globals": ["step"]}
    assert decision_types(lab) == {"step", "coupled"}
    assert decision_types({"decisions": {"step": 1}, "coupled_globals": []}) == {"step"}
    assert "coupled" in config_types({"step": 1, "neighbors": 1})
    assert "coupled" in config_types({"co2_cap": "auto", "surplus": True})
    assert "coupled" not in config_types({"step": 1, "co2_cap": "auto"})
    quotas = {"max_with_type": {"coupled": 6}, "min_with_type": {"coupled": 4}, "max_demand_price": 5}
    lot, errors = check_lot({"lot": "x", "size": 20, "mix": [{"cols": 8, "demand_price": True}], "quotas": quotas})
    assert not errors and lot["quotas"]["max_demand_price"] == 5
    _lot, errors = check_lot({"lot": "x", "size": 4, "mix": [{"cols": 8, "demand_price": 1}]})
    assert errors and "demand_price" in errors[0]


def _lgrid(fam: str, lab: dict) -> dict:
    return {
        "lab": {"family": fam, "mechanics": ["x"], "clue_profile": ["price"], **lab},
        "difficulty": {"rating": 1},
        "demand": [1, 2 + 3 * len(fam)],
        "weather": {"R": [0, 0], "F": [0, 0]},
        "columns": ["a", "b"],
        "pieces": {"N": {}},
    }


def test_coupled_ceiling_and_demand_price_cap():
    q = Quotas(10, {"min_per_rating": 0, "max_same_family": 10, "max_with_type": {"coupled": 1}, "max_demand_price": 1})
    q.add(_lgrid("a", {"decisions": {"carbon": 1}, "coupled_globals": ["carbon"], "demand_prices": 1}))
    assert q.with_type["coupled"] == 1 and q.demand == 1
    assert q.check(_lgrid("bb", {"decisions": {"step": 1}, "coupled_globals": ["step"]})) == "quota:with_type"
    assert q.check(_lgrid("ccc", {"decisions": {"step": 1}, "coupled_globals": []})) is None
    assert q.check(_lgrid("dddd", {"decisions": {"exchange": 1}, "demand_prices": 1})) == "quota:demand_price"


def test_draws_seed_demand_prices_under_the_cap_and_aim_at_coupled_for_hard_ratings():
    mix = [{"cols": 8, "neighbors": 1}, {"cols": 8, "neighbors": 1, "step": 1}]
    q = Quotas(20, {"min_per_mix": 0, "min_per_rating": 1, "max_demand_price": 2})
    q.rating = {1: 1, 2: 1}  # Difficile and Expert missing: entries able to give a coupled mechanic first
    rng = random.Random(5)
    draws = [_draw(rng, mix, [1, 1], q) for _ in range(400)]
    assert sum(1 for d in draws if d[2] == 1) > 300
    assert 100 < sum(1 for d in draws if d[0].get("demand_price")) < 300
    q.demand = 2
    assert not any(_draw(rng, mix, [1, 1], q)[0].get("demand_price") for _ in range(50))


def test_demand_price_of_tutorial_6_is_kept_by_the_selection():
    """Tutorial 6: a gas price in a column where the nuclear covers the demand, the export brings the gas."""
    g = grid(6)
    assert [c["piece"] for c in demand_prices(g, g["clues"])] == ["G"]
    pool = clue_pool(g)
    seed = demand_prices(g, pool)
    assert seed
    clues = select_clues(g, pool, seed=seed[:1])
    assert clues is not None and seed[0] in clues


def test_coupled_ceiling_is_reserved_for_the_hard_ratings():
    """Under a coupled ceiling, a coupled Moyen may not take the last coupled slot a missing Expert needs."""
    q = Quotas(20, {"min_per_rating": 1, "max_same_family": 20, "max_with_type": {"coupled": 2}})
    q.rating = {1: 1, 2: 1, 3: 1}
    q.add(_lgrid("a", {"decisions": {"carbon": 1}, "coupled_globals": ["carbon"]}))
    moyen = _lgrid("bb", {"decisions": {"step": 1}, "coupled_globals": ["step"]})
    assert q.check(moyen) == "quota:rating"
    expert = _lgrid("ccc", {"decisions": {"step": 1, "carbon": 1}, "coupled_globals": ["step", "carbon"]})
    expert["difficulty"]["rating"] = 4
    assert q.check(expert) is None
    q.rating[4] = 1
    assert q.check(moyen) is None


def test_a_missing_expert_aims_at_step_and_co2_with_a_neighbor():
    mix = [{"cols": 8, "neighbors": 1, "step": 1}, {"cols": 8, "neighbors": 1, "step": 1, "co2_cap": "auto"}]
    q = Quotas(20, {"min_per_mix": 0, "min_per_rating": 1})
    q.rating = {1: 1, 2: 1, 3: 1}
    rng = random.Random(7)
    assert sum(1 for _ in range(400) if _draw(rng, mix, [1, 1], q)[2] == 1) > 300
