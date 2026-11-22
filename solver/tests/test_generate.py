"""Generator: candidates, rating aim, ramps, bulletins, lot validation, quotas and a small lot."""

import copy
import json
import random
import re

import pytest
from conftest import FIXTURES

from dispatch_solver import cli, exact
from dispatch_solver.board import reference_composition
from dispatch_solver.deduce import deduce
from dispatch_solver.deduce.trace import decisions
from dispatch_solver.generate.bulletin import TEMPLATES, make_bulletin
from dispatch_solver.generate.lot import Quotas, _attempt, _draw, check_lot, config_types, make_candidate, run_lot
from dispatch_solver.generate.silhouettes import FAMILIES, draw_day, sky
from dispatch_solver.grid import WEATHER_KINDS, validate


def first(cfg: dict, aim: int | None = None, seeds: range = range(40)) -> dict:
    for seed in seeds:
        g, _why, _ = make_candidate(cfg, seed, aim)
        if g is not None:
            return g
    raise AssertionError(f"no candidate for {cfg}")


def test_families_stay_in_bounds():
    for fam in FAMILIES:
        for seed in range(5):
            f, demand, r, ff = draw_day(random.Random(seed), 8, fam, height=6)
            res = [demand[c] - r[c] - ff[c] for c in range(8)]
            assert f == fam and max(res) <= 6
            assert min(res) >= (-1 if fam == "surplus_midi" else 1)
            assert all(w in WEATHER_KINDS for w in sky(8, r))


def test_sky_follows_the_family_not_the_clipping():
    """rv8 C6: clipping the residual changes the demand, never R: a winter day gets no sunny slot."""
    for seed in range(40):
        for n in (6, 8, 12):
            _, demand, r, f = draw_day(random.Random(seed), n, "plateau_hiver", height=5)
            assert "sun" not in sky(n, r)
            assert max(demand[c] - r[c] - f[c] for c in range(n)) <= 5


def test_candidate_is_publishable():
    g = first({"cols": 8, "neighbors": 1})
    assert validate(g) == []
    assert exact.count(g).count == 1
    res = deduce(g)
    assert res.solved and res.composition == reference_composition(g)
    assert g["difficulty"]["rating"] == res.rating
    lab = g["lab"]
    assert lab["family"] in FAMILIES and "neighbors:1" in lab["mechanics"]
    assert lab["bulletin"]["title"] == g["title"] and len(lab["bulletin"]["weather"]) == 8
    assert 5 <= max(g["demand"][c] - g["weather"]["R"][c] - g["weather"]["F"][c] for c in range(8)) <= 7


def test_aim_one_gives_easy_grids():
    """rv8 C4: the aimed level is a lever: aim 1 selects clues for the level 1 techniques only.

    The last prune (§8.3, full deduction) may still raise a grid above its aim.
    """
    ratings = []
    for seed in range(10):
        g, _why, _ = make_candidate({"cols": 8, "neighbors": 1}, seed, 1)
        if g is not None:
            assert g["lab"]["aim"] == 1
            ratings.append(g["difficulty"]["rating"])
    assert ratings and ratings.count(1) * 2 > len(ratings)


def test_ramp_candidate_uses_the_ramp():
    g = first({"cols": 8, "ramp": "trap"})
    assert g["pieces"]["C"]["shape"] == "trap" and "ramp:trap" in g["lab"]["mechanics"]
    assert any(p["piece"] == "C" for p in g["solution"]["placements"])
    assert validate(g, allow_ramp=True) == [] and validate(g) != []
    assert set(g["lab"]["ramp_techniques"]) <= {"ramp_plateau", "ramp_shoulder", "ramp_lone", "ramp_relay"}


def test_ramps_vary():
    """rv8 C5: widths are drawn and two ramps may relay; not always one ramp of the shortest width."""
    shapes = set()
    for seed in range(30):
        g, _why, _ = make_candidate({"cols": 12, "ramp": "trap", "neighbors": 1}, seed)
        if g is not None:
            ramps = [p["len"] for p in g["solution"]["placements"] if p["piece"] == "C"]
            shapes.add((len(ramps), max(ramps)))
    assert any(n >= 2 for n, _ in shapes) and any(w > 3 for _, w in shapes)


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())["grid"]


@pytest.mark.parametrize(
    "name", ["valid-tall-coal.json", "valid-ramp-trap.json", "valid-ramp-stair.json", "valid-two-neighbors-co2.json"]
)
def test_bulletin_ignores_the_solution(name):
    """rv8 C1: the bulletin is written from the visible grid; another solution gives the same text."""
    g = _fixture(name)
    other = copy.deepcopy(g)
    other["solution"] = {"exports": {}, "step": [], "placements": []}
    for fam in FAMILIES:
        assert make_bulletin(g, fam, random.Random(3)) == make_bulletin(other, fam, random.Random(3))


def test_bulletin_templates_by_shape():
    """rv8 C1, C2: tall coal says 1 or 2 GW; trapezoid and stair have their own sentences."""
    assert all("1 ou 2 GW" in x for x in TEMPLATES["mechanics"]["tall"])
    trap, stair = _fixture("valid-ramp-trap.json"), _fixture("valid-ramp-stair.json")
    for seed in range(20):
        t = make_bulletin(trap, "pointe_soir", random.Random(seed))["text"]
        s = make_bulletin(stair, "pointe_soir", random.Random(seed))["text"]
        assert not any(x in t for x in TEMPLATES["mechanics"]["ramp_stair"])
        assert not any(x in s for x in TEMPLATES["mechanics"]["ramp_trap"])


def test_bulletin_peaks_and_plateau():
    """rv8 C6: two bumps name the evening peak; the winter plateau starts in the day."""
    g = copy.deepcopy(_fixture("valid-tall-coal.json"))
    assert len(g["columns"]) == 8
    g["demand"] = [g["weather"]["R"][c] + g["weather"]["F"][c] + x for c, x in enumerate([6, 6, 6, 3, 2, 4, 5, 4])]
    for seed in range(10):
        b = make_bulletin(g, "deux_bosses", random.Random(seed))
        assert "18h" in b["text"]  # evening peak (5) at 18h; the morning (6) is higher
        b = make_bulletin(g, "plateau_hiver", random.Random(seed))
        assert "De 0h" not in b["text"]


def test_bulletin_only_uses_visible_traits():
    g = next(
        g
        for seed in range(40)
        for g in [make_candidate({"cols": 12, "neighbors": 2, "co2_cap": "auto"}, seed)[0]]
        if g is not None and g["co2_cap"]
    )
    b = make_bulletin(g, g["lab"]["family"], random.Random(1))
    titles = TEMPLATES["titles"][g["lab"]["family"]] + [x for v in TEMPLATES["trait_titles"].values() for x in v]
    assert b["title"] in titles
    allowed = {str(g["co2_cap"])} | {c.rstrip("h") for c in g["columns"]}
    assert set(re.findall(r"\d+", b["text"])) <= allowed
    assert all("points" in x for x in TEMPLATES["mechanics"]["co2"])  # rv8 M4


def test_slot_counts():
    with pytest.raises(ValueError):
        make_candidate({"cols": 10}, 1)


def test_attempt_errors_are_named_rejects():
    """rv8 B1: an error in one draw is a reject, it does not stop the lot."""
    g, why, info = _attempt(({"cols": 10}, 1, None))
    assert g is None and why == "error:ValueError" and "cols" in info["error"]


LAB_TEMPLATE = {
    "lot": "lab-default",
    "size": 6,
    "seed": 1,
    "mix": [{"weight": 1, "cols": 10, "neighbors": 1, "ramp": "G:trapezoid", "pieces": "N,C,G,T"}],
    "quotas": {"max_same_silhouette": 3, "unknown_quota": 1},
}


def test_check_lot_refuses_before_drawing():
    """rv8 B1: every problem of the lot is listed at once; aliases and comma lists are accepted."""
    lot, errors = check_lot(LAB_TEMPLATE)
    assert any("cols" in e for e in errors)
    assert any("ramp" in e for e in errors)
    assert any("unknown_quota" in e for e in errors)
    assert lot["quotas"] == {"max_same_family": 3}
    assert lot["mix"][0]["pieces"] == "NCGT"
    _lot, errors = check_lot({"lot": "x", "size": 2, "mix": [{"cols": 8, "ramp": "trap", "height": 6}]})
    assert errors == []
    _lot, errors = check_lot({"lot": "x", "size": 2, "mix": [{"cols": 8, "colour": 1}]})
    assert errors and "colour" in errors[0]
    with pytest.raises(ValueError):
        run_lot(LAB_TEMPLATE, workers=1)


def test_cli_generate_refuses_a_bad_lot(tmp_path, capsys):
    lot = tmp_path / "bad.json"
    lot.write_text(json.dumps(LAB_TEMPLATE))
    out = tmp_path / "out"
    assert cli.main(["generate", str(lot), "--out", str(out)]) == 2
    assert not out.exists() or not list(out.iterdir())
    assert "cols" in capsys.readouterr().err


def test_cli_check_index_and_exit_code(tmp_path, capsys):
    """rv8 M2: --index picks by position (lab.index); check exits 1 on an invalid grid."""
    g = _fixture("valid-ramp-trap.json")
    path = tmp_path / "grids.json"
    path.write_text(json.dumps([g, {**g, "id": 9}]))
    assert cli.main(["check", str(path), "--index", "1", "--ramp"]) == 0
    assert json.loads(capsys.readouterr().out)["id"] == 9
    path.write_text(json.dumps([{**g, "columns": []}]))
    assert cli.main(["check", str(path), "--index", "0"]) == 1


def test_cli_errors_and_strict(tmp_path, capsys):
    """Review B M2: clean errors, --strict exit code, deduce validates, check-published takes ramps."""
    with pytest.raises(SystemExit) as exc:
        cli.main(["check", str(tmp_path / "missing.json")])
    assert exc.value.code == 2 and "cannot read" in capsys.readouterr().err
    bad = tmp_path / "bad.json"
    bad.write_text("{")
    with pytest.raises(SystemExit) as exc:
        cli.main(["deduce", str(bad), "--id", "1"])
    assert exc.value.code == 2 and "not valid JSON" in capsys.readouterr().err
    g = _fixture("valid-ramp-trap.json")
    path = tmp_path / "grids.json"
    path.write_text(json.dumps([g, {**g, "id": 9}]))
    with pytest.raises(SystemExit) as exc:
        cli.main(["deduce", str(path)])
    assert "--index" in str(exc.value.code)
    two = _fixture("unpublishable-two-compositions.json")
    path.write_text(json.dumps([two]))
    assert cli.main(["check", str(path)]) == 0
    assert cli.main(["check", str(path), "--strict"]) == 1
    path.write_text(json.dumps([_fixture("valid-technique-ramp-plateau.json")]))
    assert cli.main(["check-published", str(path)]) == 0
    assert cli.main(["check-published", str(path), "--no-ramp"]) == 1
    path.write_text(json.dumps([{**g, "columns": []}]))
    with pytest.raises(SystemExit) as exc:
        cli.main(["deduce", str(path), "--index", "0"])
    assert "invalid grid" in str(exc.value.code)
    capsys.readouterr()


def _qgrid(fam: str, r: int, demand: list[int] | None = None) -> dict:
    return {
        "lab": {"family": fam, "mechanics": ["x"], "clue_profile": ["price"]},
        "difficulty": {"rating": r},
        "demand": demand or [len(fam), 3 * r],
        "weather": {"R": [0, 0], "F": [0, 0]},
        "columns": ["a", "b"],
        "pieces": {"N": {}},
    }


def test_quotas():
    q = Quotas(4, {"max_same_family": 1, "min_per_rating": 1})
    a = _qgrid("aa", 1)
    assert q.check(a) is None
    q.add(a)
    assert q.check(_qgrid("aa", 2)) == "quota:family"
    assert q.check(_qgrid("bbb", 1)) == "quota:rating"  # 3 slots left, 3 ratings still missing
    assert q.check(_qgrid("bbb", 2)) is None
    assert q.missing_ratings() == [2, 3, 4]


def test_mix_minimum_wins_at_the_end():
    """The last slots go to a mix entry still missing, even past a diversity quota."""
    q = Quotas(2, {"max_same_family": 1, "min_per_rating": 0, "min_per_mix": 1}, mixes=2)
    a = _qgrid("aa", 1)
    a["lab"]["mix"] = 0
    q.add(a)
    b = _qgrid("aa", 2)
    b["lab"]["mix"] = 1
    assert q.check(b) is None  # family quota reached, but entry 1 has no grid and one slot is left
    b["lab"]["mix"] = 0
    assert q.check(b) == "quota:family"
    early = Quotas(10, {"max_same_family": 1, "min_per_rating": 0, "min_per_mix": 1}, mixes=3)
    early.add(a)
    b["lab"]["mix"] = 1
    assert early.check(b) == "quota:family"  # 9 slots left for 2 missing entries: the quota holds


def test_duplicates_up_to_a_shift():
    """rv8 M6: the same residual shifted up by one is a duplicate."""
    q = Quotas(4, {"min_per_rating": 0})
    q.add(_qgrid("a", 1, [3, 4]))
    assert q.check(_qgrid("b", 1, [4, 5])) == "duplicate"
    assert q.check(_qgrid("b", 1, [4, 4])) is None


def test_duplicate_key_includes_the_weather():
    """Weather cells are fixed bricks: same residual, different weather steps is a different puzzle."""
    q = Quotas(4, {"min_per_rating": 0})
    q.add(_qgrid("a", 1, [3, 4]))
    sunny = {**_qgrid("b", 1, [5, 4]), "weather": {"R": [2, 0], "F": [0, 0]}}  # residual [3, 4] again
    assert q.check(sunny) is None
    q.add(sunny)
    river = {**_qgrid("c", 1, [6, 5]), "weather": {"R": [2, 0], "F": [1, 1]}}  # residual [3, 4], weather [3, 1]
    assert q.check(river) is None
    same = {**_qgrid("d", 1, [6, 5]), "weather": {"R": [2, 0], "F": [0, 0]}}  # sunny shifted up by one
    assert q.check(same) == "duplicate"


def test_small_lot():
    lot = {
        "lot": "t",
        "size": 3,
        "seed": 2,
        "max_attempts": 40,
        "mix": [{"cols": 6, "neighbors": 1}, {"cols": 8, "ramp": "trap"}],
        "quotas": {"min_per_rating": 0, "max_same_family": 2},
    }
    grids, extra = run_lot(lot, workers=2)
    assert len(grids) == 3
    assert [g["id"] for g in grids] == [1, 2, 3]
    assert [g["lab"]["index"] for g in grids] == [0, 1, 2]
    assert len({g["title"] for g in grids}) == 3  # rv8 M3: no repeated title in a lot
    st = extra["stats"]
    assert st["kept"] == 3 and st["attempts"] >= 3
    assert {"ramp_grids", "ramp_grids_with_technique", "ramp_techniques", "seconds_per_kept_grid"} <= set(st)


def test_dead_mechanics_are_cleaned():
    """C1: every neighbor left trades in the reference; a CO2 cap left is used by a carbon step."""
    seen = {"neighbors": 0, "co2_cap": 0, "kept_cap": 0}
    for cfg in ({"cols": 8, "neighbors": 3}, {"cols": 8, "inventory": "exact", "co2_cap": "auto", "neighbors": 1}):
        for seed in range(12):
            g, _why, _ = make_candidate(cfg, seed)
            if g is None:
                continue
            sol = g["solution"]
            live = set(sol["exports"]) | {p["country"] for p in sol["placements"] if p["piece"] == "I"}
            assert {nb["id"] for nb in g["neighbors"]} <= live
            assert not set(g["lab"]["cleaned"].get("neighbors", [])) & {nb["id"] for nb in g["neighbors"]}
            seen["neighbors"] += len(g["lab"]["cleaned"].get("neighbors", []))
            res = deduce(g)
            assert res.solved and exact.count(g).count == 1
            if g["co2_cap"] is not None:
                assert any(s.rule == "carbon" for s in res.steps) and g["lab"]["decisions"].get("carbon")
                seen["kept_cap"] += 1
            seen["co2_cap"] += "co2_cap" in g["lab"]["cleaned"]
            assert ("co2" in g["lab"]["mechanics"]) == (g["co2_cap"] is not None)
    assert seen["neighbors"] and seen["co2_cap"]


def test_decisions_measure_and_no_decision_reject():
    """A grid without any decision is filling (reject no_decision); min_decisions 0 lets it through."""
    reasons, kinds = set(), set()
    for seed in range(30):
        g, why, _ = make_candidate({"cols": 8}, seed)
        reasons.add(why)
        if g is not None:
            dec = g["lab"]["decisions"]
            assert sum(dec.values()) >= 1 and dec == decisions(g, deduce(g).steps)
            assert set(g["lab"]["live_mechanics"]) == set(dec) - {"price"}
            assert g["lab"]["bars"] == sum(1 for p in g["solution"]["placements"] if p["piece"] != "I")
            kinds |= set(dec)
    assert "no_decision" in reasons
    filling = [
        g
        for seed in range(30)
        for g in [make_candidate({"cols": 8, "min_decisions": 0}, seed)[0]]
        if g is not None and not g["lab"]["decisions"]
    ]
    assert filling
    _lot, errors = check_lot({"lot": "x", "size": 2, "mix": [{"cols": 8, "min_decisions": -1}]})
    assert errors and "min_decisions" in errors[0]


def test_a_published_flow_is_not_a_decision():
    g = first({"cols": 8, "neighbors": 1, "inventory": "exact"}, seeds=range(80))
    dec = g["lab"]["decisions"]
    found = [(k, c) for k, v in g["solution"]["exports"].items() for c, x in enumerate(v) if x]
    if not found or not dec.get("exchange"):
        pytest.skip("no export decision in this draw")
    k, c = found[0]
    flow = {"type": "flow", "col": c, "country": k, "dir": "export", "value": g["solution"]["exports"][k][c]}
    h = {**g, "clues": g["clues"] + [flow]}
    assert decisions(h, deduce(h).steps).get("exchange", 0) == dec["exchange"] - 1


def _dgrid(fam: str, r: int, dec: dict) -> dict:
    g = _qgrid(fam, r, [1, 2 + 3 * len(fam) + len(dec)])  # distinct residual shapes: no duplicate
    g["lab"]["decisions"] = dec
    return g


def test_single_decision_quota():
    q = Quotas(10, {"min_per_rating": 0, "max_same_family": 10, "max_same_single_decision": 1})
    q.add(_dgrid("a", 1, {"exchange": 2}))
    assert q.check(_dgrid("bb", 1, {"exchange": 1})) == "quota:single_decision"
    assert q.check(_dgrid("ccc", 1, {"exchange": 1, "tall": 1})) is None  # two types: not a single-type grid
    assert q.check(_dgrid("dddd", 1, {"step": 1})) is None
    assert Quotas(10, {"min_per_rating": 0}).check(_dgrid("eeeee", 1, {"exchange": 1})) is None  # no limit by default


def test_type_ceiling_counts_presence():
    """max_with_type counts the grids holding a type, whatever else they hold."""
    q = Quotas(10, {"min_per_rating": 0, "max_same_family": 10, "max_with_type": {"exchange": 1}})
    q.add(_dgrid("a", 1, {"exchange": 1, "tall": 1}))
    assert q.check(_dgrid("bb", 1, {"exchange": 2, "step": 1})) == "quota:with_type"
    assert q.check(_dgrid("ccc", 1, {"step": 1})) is None


def test_type_floor_reserves_slots():
    """min_with_type reserves the last slots for the types still missing; one grid may fill several."""
    q = Quotas(3, {"min_per_rating": 0, "max_same_family": 10, "min_with_type": {"carbon": 1, "stock": 1}})
    assert q.missing_types() == ["carbon", "stock"]
    assert q.check(_dgrid("a", 1, {"exchange": 1})) is None  # 2 slots left for a deficit of 2
    q.add(_dgrid("a", 1, {"exchange": 1}))
    assert q.check(_dgrid("bb", 1, {"exchange": 1})) == "quota:type_floor"
    assert q.check(_dgrid("ccc", 1, {"carbon": 1, "stock": 1})) is None
    q.add(_dgrid("ccc", 1, {"carbon": 1, "stock": 1}))
    assert q.type_deficit() == 0 and q.check(_dgrid("dddd", 1, {"exchange": 1})) is None


def test_type_quotas_are_checked():
    _lot, errors = check_lot({"lot": "x", "size": 4, "mix": [{"cols": 8}], "quotas": {"min_with_type": {"exchang": 1}}})
    assert errors and "min_with_type" in errors[0]
    _lot, errors = check_lot(
        {
            "lot": "x",
            "size": 4,
            "mix": [{"cols": 8}],
            "quotas": {"min_with_type": {"step": 3}, "max_with_type": {"step": 2}},
        }
    )
    assert errors and "above max_with_type" in errors[0]
    lot, errors = check_lot({"lot": "x", "size": 4, "mix": [{"cols": 8}], "quotas": {"max_with_type": {"step": 2}}})
    assert not errors and lot["quotas"]["max_with_type"] == {"step": 2}


def test_draws_aim_at_missing_types():
    """Entries able to give a type under its floor are drawn more, entries giving a capped type less."""
    mix = [{"cols": 8, "neighbors": 1}, {"cols": 8, "step": 1, "co2_cap": "auto"}]
    q = Quotas(20, {"min_per_mix": 0, "min_with_type": {"carbon": 3}, "max_with_type": {"exchange": 1}})
    q.with_type["exchange"] = 1
    rng = random.Random(3)
    picks = [_draw(rng, mix, [1, 1], q)[2] for _ in range(400)]
    assert picks.count(1) > 300
    assert config_types(mix[1]) == {"step", "carbon"}


def test_type_floor_is_reserved_with_the_ratings():
    """Rating and type deficits share the slots: the last slot never needs a rare pair (rating + type)."""
    q = Quotas(3, {"min_per_rating": 0, "max_same_family": 10, "min_with_type": {"stock": 1}})
    q.q["min_per_rating"] = 1
    q.rating = {1: 1, 2: 1}  # ratings 3 and 4 missing, plus stock: 3 for 3 slots
    assert q.check(_dgrid("a", 3, {"exchange": 1})) is None  # fills rating 3: 2 left for 2
    q.add(_dgrid("a", 3, {"exchange": 1}))
    assert q.check(_dgrid("bb", 1, {"exchange": 1})) == "quota:type_floor"
    assert q.check(_dgrid("ccc", 1, {"stock": 1})) is None
    assert q.check(_dgrid("dddd", 4, {"exchange": 1})) is None


def test_combined_type_keys():
    """ "a+b" counts the grids holding both types, "a|b" those holding either; draws aim at them too."""
    q = Quotas(10, {"min_per_rating": 0, "max_same_family": 10, "min_with_type": {"step+carbon": 1, "step|carbon": 2}})
    q.add(_dgrid("a", 1, {"step": 1}))
    assert q.with_type == {"step": 1, "step|carbon": 1}
    assert q.missing_types() == ["step+carbon", "step|carbon"]
    q.add(_dgrid("bb", 1, {"step": 1, "carbon": 1, "exchange": 1}))
    assert q.missing_types() == [] and q.with_type["step+carbon"] == 1
    assert q.keys({"carbon"}) == {"carbon", "step|carbon"}
    for key, ok in (("step+carbon", True), ("step|carbon", True), ("step+carbon|tall", False), ("steps", False)):
        _lot, errors = check_lot({"lot": "x", "size": 4, "mix": [{"cols": 8}], "quotas": {"min_with_type": {key: 1}}})
        assert not errors if ok else errors


def test_an_entry_with_neighbors_keeps_one():
    """v3g3 A: an entry with neighbors never gives a grid without any; the lab measures are those of the
    cleaned grid (decisions, coupled globals, live mechanics), so the quotas see what the player plays."""
    reasons = set()
    kept = 0
    for seed in range(30):
        g, why, _ = make_candidate({"cols": 8, "step": 1, "neighbors": 1}, seed)
        reasons.add(why)
        if g is None:
            continue
        kept += 1
        assert g["neighbors"] and "neighbors:1" in g["lab"]["mechanics"]
        res = deduce(g)
        dec = decisions(g, res.steps)
        assert g["lab"]["decisions"] == dec and g["lab"]["coupled_globals"] == res.coupled_globals
        assert g["lab"]["live_mechanics"] == [k for k in dec if k != "price"]
    assert kept >= 10 and reasons <= {None, "one_plant", "too_many_clues", "dead_neighbors", "trivial", "no_decision"}


def test_per_mix_and_slot_ceilings():
    """Near-twins: at most max_per_mix grids per mix entry, at most max_with_cols[n] grids of n slots."""
    q = Quotas(10, {"min_per_rating": 0, "max_same_family": 10, "max_per_mix": 1, "max_with_cols": {12: 1}}, mixes=3)
    a = _qgrid("a", 1)
    a["lab"]["mix"] = 0
    q.add(a)
    b = _qgrid("bb", 1)
    b["lab"]["mix"] = 0
    assert q.check(b) == "quota:per_mix"
    b["lab"]["mix"] = 1
    assert q.check(b) is None
    long_day = {**_qgrid("ccc", 1), "columns": ["x"] * 12, "weather": {"R": [0] * 12, "F": [0] * 12}}
    long_day["demand"] = [3] * 11 + [4]
    long_day["lab"] = {**long_day["lab"], "mix": 1}
    q.add(long_day)
    other = {**long_day, "demand": [3] * 10 + [5, 4], "lab": {**long_day["lab"], "mix": 2, "family": "dddd"}}
    assert q.check(other) == "quota:cols"
    mix = [{"cols": 8}, {"cols": 12}, {"cols": 6}]
    rng = random.Random(1)
    picks = [_draw(rng, mix, [1, 1, 1], q)[2] for _ in range(300)]
    assert picks.count(0) < 20 and picks.count(1) < 20  # entry 0 at its max, entry 1 on 12 slots at its ceiling
    lot, errors = check_lot(
        {"lot": "x", "size": 4, "mix": [{"cols": 8}] * 2, "quotas": {"max_per_mix": 2, "max_with_cols": {"12": 1}}}
    )
    assert not errors and lot["quotas"]["max_with_cols"] == {12: 1}
    for quotas, word in (
        ({"max_per_mix": 1}, "below the lot size"),
        ({"max_with_cols": {"10": 1}}, "max_with_cols"),
        ({"max_per_mix": 2, "min_per_mix": 3}, "below min_per_mix"),
    ):
        _lot, errors = check_lot({"lot": "x", "size": 4, "mix": [{"cols": 8}] * 2, "quotas": quotas})
        assert errors and word in " ".join(errors)


def test_a_ramp_given_by_a_clue_is_no_decision():
    """A ramp bar is a decision when the deduction settles it, not when an engaged or a program clue gives it."""
    g = first({"cols": 8, "ramp": "trap"}, seeds=range(60))
    res = deduce(g)
    n = decisions(g, res.steps)["ramp"]
    bars = [p for p in g["solution"]["placements"] if p["piece"] == "C"]
    assert n >= 1 and sum(g["lab"]["ramp_settled_by"].values()) == n
    p = bars[0]
    for clue in (
        {"type": "bar", "piece": "C", "col": p["col"], "len": p["len"]},
        {"type": "engaged", "piece": "C", "row": p["row"], "col": p["col"], "len": p["len"]},
    ):
        h = {**g, "clues": g["clues"] + [clue]}
        r = deduce(h)
        assert r.solved and decisions(h, r.steps).get("ramp", 0) == n - 1


def test_a_long_draw_is_a_timeout_reject(monkeypatch):
    """A draw past ATTEMPT_SECONDS is the named reject `timeout`, never a lot stuck behind it."""
    import time

    from dispatch_solver.generate import lot as lot_module

    monkeypatch.setattr(lot_module, "ATTEMPT_SECONDS", 1)
    monkeypatch.setattr(lot_module, "make_candidate", lambda *a: time.sleep(5))
    t0 = time.perf_counter()
    g, why, info = _attempt(({"cols": 8}, 1, None))
    assert g is None and why == "timeout" and "1 s" in info["error"]
    assert time.perf_counter() - t0 < 4
