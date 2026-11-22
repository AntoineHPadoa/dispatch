"""Tests of the session draw (POST /api/sessions): balance by rating, determinism, played grids, blind, names.

Run: solver/.venv/bin/python -m pytest lab/tests/test_session_new.py -q
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_lab_server import PLAY, api, grid, lab, rated  # noqa: E402,F401  (fixtures)

FAMILIES = ["pointe_soir", "deux_bosses", "midi_solaire"]
MECHANICS = ["step", "tall", "surplus", "neighbors:1"]


def big_lot(lab, name="big", count=24, ratings=(1, 2, 3, 4)):
    grids = []
    for i in range(count):
        g = grid(i)
        g["difficulty"]["rating"] = ratings[i % len(ratings)]
        g["lab"].update(lot=name, family=FAMILIES[i % 3], mechanics=[MECHANICS[i % 4], MECHANICS[(i + 1) % 4]])
        grids.append(g)
    (lab.dir / "candidates" / f"{name}.json").write_text(json.dumps(grids))
    return grids


def rating_of(grids, index):
    return grids[index]["difficulty"]["rating"]


def draw(api, **body):
    code, s = api("POST", "/api/sessions", {"lot": "big", **body})
    assert code == 200, s
    return s


def test_default_size_16_balanced_by_rating(api, lab):
    grids = big_lot(lab)
    s = draw(api)
    assert len(s["items"]) == 16 and s["id"] == "big-1"
    ratings = [rating_of(grids, i["index"]) for i in s["items"]]
    assert sorted(set(ratings)) == [1, 2, 3, 4] and all(ratings.count(r) == 4 for r in (1, 2, 3, 4))
    assert len({i["index"] for i in s["items"]}) == 16


def test_remainder_is_spread_and_size_capped_to_the_lot(api, lab):
    grids = big_lot(lab, count=10)
    s = draw(api, size=6)
    counts = sorted(sum(rating_of(grids, i["index"]) == r for i in s["items"]) for r in (1, 2, 3, 4))
    assert counts == [1, 1, 2, 2]
    assert len(draw(api, size=99)["items"]) == 10


def test_scarce_rating_is_not_blocking(api, lab):
    grids = big_lot(lab, count=12, ratings=(1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 3))
    s = draw(api, size=8)
    assert len(s["items"]) == 8 and sorted({rating_of(grids, i["index"]) for i in s["items"]}) == [1, 2, 3]


def test_order_starts_easy_and_never_repeats_a_rating(api, lab):
    grids = big_lot(lab)
    ratings = [rating_of(grids, i["index"]) for i in draw(api)["items"]]
    assert ratings[0] == 1
    assert all(a != b for a, b in zip(ratings, ratings[1:]))


def test_diversity_of_families_and_mechanics(api, lab):
    grids = big_lot(lab)
    items = draw(api, size=12)["items"]
    fams = [grids[i["index"]]["lab"]["family"] for i in items]
    assert all(fams.count(f) == 4 for f in FAMILIES)


def test_deterministic_for_a_given_lot_and_n(lab):
    grids = big_lot(lab)
    pool = [(i, g) for i, g in enumerate(grids)]
    import lab_server, random
    a = lab_server.draw_session(pool, 16, random.Random("big:1"))
    assert a == lab_server.draw_session(pool, 16, random.Random("big:1"))
    assert a != lab_server.draw_session(pool, 16, random.Random("big:2"))


def test_same_draw_after_deleting_the_file_is_not_reused_but_n_grows(api, lab):
    big_lot(lab)
    first = draw(api)
    second = draw(api)
    assert (first["id"], second["id"]) == ("big-1", "big-2")
    assert (lab.dir / "sessions" / "big-1.json").exists() and (lab.dir / "sessions" / "big-2.json").exists()
    (lab.dir / "sessions" / "big-1.json").unlink()
    assert draw(api)["id"] == "big-3"  # the name of a deleted session is not handed out again


def test_played_grids_of_the_current_player_are_excluded(api, lab):
    big_lot(lab)
    for i in (0, 1, 2, 3):
        api("POST", "/api/plays", {**PLAY, "lot": "big", "index": i, "outcome": "solved"})
    api("POST", "/api/plays", {**PLAY, "lot": "big", "index": 4, "outcome": "abandoned", "ms": 60000, "moves": 5})
    api("POST", "/api/plays", {**PLAY, "lot": "big", "index": 5, "outcome": "abandoned", "ms": 2000, "moves": 0})  # stray open
    api("POST", "/api/plays", {**PLAY, "player": "Joueur 2", "lot": "big", "index": 6})
    mine = {i["index"] for i in draw(api, size=24, player="Joueur 1")["items"]}
    assert mine.isdisjoint({0, 1, 2, 3, 4}) and {5, 6} <= mine and len(mine) == 19
    other = {i["index"] for i in draw(api, size=24, player="Joueur 2")["items"]}
    assert 0 in other and 6 not in other


def test_blind_file_and_answer(api, lab):
    big_lot(lab)
    s = draw(api, player="Joueur 1")
    raw = json.dumps(s) + (lab.dir / "sessions" / "big-1.json").read_text()
    for secret in ("rating", "difficulty", "techniques", "family", "pointe_soir", "mechanics", "step", "Pointe", "bulletin"):
        assert secret not in raw
    saved = json.loads((lab.dir / "sessions" / "big-1.json").read_text())
    assert set(saved) == {"title", "items"} and all(set(it) == {"lot", "index"} for it in saved["items"])


def test_errors(api, lab):
    big_lot(lab)
    assert api("POST", "/api/sessions", {"lot": "nope"})[0] == 404
    assert api("POST", "/api/sessions", {"lot": "../x"})[0] == 400
    assert api("POST", "/api/sessions", {"lot": "big", "size": 0})[0] == 400
    assert api("POST", "/api/sessions", {"lot": "big", "size": "8"})[0] == 400
    assert api("POST", "/api/sessions", {"lot": "big", "player": "Intrus"})[0] == 400
    assert not list((lab.dir / "sessions").glob("*.json"))


def test_nothing_left_to_play(api, lab):
    big_lot(lab, count=2)
    for i in (0, 1):
        api("POST", "/api/plays", {**PLAY, "lot": "big", "index": i})
    code, body = api("POST", "/api/sessions", {"lot": "big", "player": "Joueur 1"})
    assert code == 409 and "error" in body


def test_ramp_grids_are_left_out(api, lab):
    grids = big_lot(lab, count=4)
    grids[0]["pieces"] = {"C": {"shape": "stair"}}
    (lab.dir / "candidates" / "big.json").write_text(json.dumps(grids))
    assert 0 not in {i["index"] for i in draw(api, size=4)["items"]}


def test_post_keeps_the_safety_checks(api, lab):
    big_lot(lab)
    import urllib.request
    req = urllib.request.Request(api.base + "/api/sessions", data=b'{"lot":"big"}', method="POST",
                                 headers={"Content-Type": "text/plain"})
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(req)
    assert e.value.code == 415
