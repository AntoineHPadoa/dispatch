"""Piece shapes: rectangles, tall pieces and both ramp profiles, cell by cell."""

from dispatch_solver.shapes import Placement, shapes_of


def cols(sh):
    return [h for _b, h in sh.columns]


def test_rectangles_and_tall():
    shapes = shapes_of({"len": [2, 3], "height": [1, 2]})
    assert [(s.width, s.height, s.kind) for s in shapes] == [
        (2, 1, "rect"),
        (3, 1, "rect"),
        (2, 2, "tall"),
        (3, 2, "tall"),
    ]
    assert len(shapes[3].cells(1, 4)) == 6


def test_trapezoid_profile():
    (sh,) = shapes_of({"len": [4], "shape": "trap"})
    assert cols(sh) == [1, 2, 2, 1]
    assert sh.cells(0, 0) == {(0, 0), (0, 1), (1, 1), (0, 2), (1, 2), (0, 3)}


def test_stair_profile():
    shapes = shapes_of({"len": [2, 3, 4], "shape": "stair"})
    assert [cols(s) for s in shapes] == [[2, 1], [2, 2, 1], [2, 2, 2, 1]]
    assert shapes[1].cells(1, 0) == {(1, 0), (2, 0), (1, 1), (2, 1), (1, 2)}


def test_each_row_is_one_run():
    for d in ({"len": [3, 5], "shape": "trap"}, {"len": [2, 4], "shape": "stair"}, {"len": [3], "height": [2]}):
        for sh in shapes_of(d):
            pl = Placement("G", "G", None, sh, 2, 1, sh.cells(2, 1))
            for r in range(2, 2 + sh.height):
                a, b = pl.row_span(r)
                assert {c for rr, c in pl.cells if rr == r} == set(range(a, b))
