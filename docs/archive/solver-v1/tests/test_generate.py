"""Generator: reproducible, publishable grids that the evaluator accepts."""

from spot_solver.evaluate import evaluate
from spot_solver.generate import GenParams, generate
from spot_solver.grid import from_dict
from spot_solver.solve import solve_v2


def test_generate_publishable_and_reproducible():
    p = GenParams(cols=6, hmax=4, pieces=["N", "G", "T"], neighbor=True, count=2, seed=7)
    grids, stats = generate(p)
    assert stats["kept"] == 2
    for g in grids:
        ev = evaluate(from_dict(g), g["solution"])
        assert ev.complete and ev.score == g["optimum"]["score"]
        assert solve_v2(g, decoys=False)["publishable"]
        assert "value" in g["difficulty"]
    again, _ = generate(p)
    assert [g["residual"] for g in again] == [g["residual"] for g in grids]


def test_generate_target():
    p = GenParams(cols=6, hmax=4, pieces=["N", "B", "G", "T"], objective="target", count=1, seed=3)
    grids, _ = generate(p)
    g = grids[0]
    assert g["objective"]["optimize"] == "target"
    assert g["optimum"]["score"] == g["objective"]["target"]
    assert solve_v2(g, decoys=False)["publishable"]


def test_generate_several_neighbors():
    p = GenParams(cols=6, hmax=4, pieces=["N", "G", "T"], neighbors={"DE": 2, "FR": 0}, co2_cap=4, count=1, seed=5)
    grids, _ = generate(p)
    g = grids[0]
    assert [nb["id"] for nb in g["neighbors"]] == ["DE", "FR"]
    assert set(g["solution"]["exports"]) == {"DE", "FR"}
    ev = evaluate(from_dict(g), g["solution"])
    assert ev.complete and ev.co2 <= 4
