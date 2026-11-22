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
from dispatch_solver.generate.bulletin import TEMPLATES, make_bulletin
from dispatch_solver.generate.lot import Quotas, _attempt, check_lot, make_candidate, run_lot
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
    g = first({"cols": 12, "neighbors": 2, "co2_cap": "auto"})
    assert g["co2_cap"] > 0
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
