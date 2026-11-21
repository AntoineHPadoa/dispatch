"""Grid format (GAME-DESIGN.md §14): constants, loading and a structural validator.

- validate() is a port of web/src/model/grid.ts validateGrid(): same checks, same English messages, so
  the shared reference grids (fixtures/grids/) compare both implementations error by error.
- Extra, behind a flag: `pieces.C.shape` = "trap" or "stair" (coal ramps, docs/next/rampe.md; no `height`,
  `len` = total width), refused unless allow_ramp=True because the web engine does not know ramps yet.
- load_grids() reads one grid, a list of grids, or a fixture ({"grid": ..., "expect": ...}).

Example: errors = validate(json.load(open("grid.json")))
"""

from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

PIECE_IDS = ("N", "B", "C", "G", "T")
IMPORT_PIECE = "I"
ANY_COUNTRY = "*"
PIECE_SPEC: dict[str, dict[str, int]] = {
    "N": {"rank": 1, "co2": 0},
    "B": {"rank": 2, "co2": 0},
    "C": {"rank": 3, "co2": 3},
    "G": {"rank": 4, "co2": 1},
    "T": {"rank": 5, "co2": 2},
}
MIN_COLUMNS = 6
MAX_COLUMNS = 12
CLUE_TYPES = ("price", "bar", "length", "column", "flow", "exchanges", "engaged")
WEATHER_KINDS = ("sun", "moon", "cloud", "wind")
SHAPES = ("rect", "trap", "stair")
RAMP_PIECE = "C"
RAMP_MIN_WIDTH = {"trap": 3, "stair": 2}
LABELS = {1: "Facile", 2: "Moyen", 3: "Difficile", 4: "Expert"}
_MISSING = object()


def _is_int(v: Any) -> bool:
    if isinstance(v, bool):
        return False
    return isinstance(v, int) or (isinstance(v, float) and v.is_integer())


def _is_nat(v: Any) -> bool:
    return _is_int(v) and v >= 0


def _is_pos(v: Any) -> bool:
    return _is_int(v) and v > 0


def _is_obj(v: Any) -> bool:
    return isinstance(v, dict)


def _is_piece_id(v: Any) -> bool:
    return isinstance(v, str) and v in PIECE_IDS


def _is_size_list(v: Any) -> bool:
    return (
        isinstance(v, list)
        and len(v) > 0
        and all(_is_pos(x) for x in v)
        and all(i == 0 or v[i] > v[i - 1] for i in range(len(v)))
    )


def _is_int_array(v: Any, n: int) -> bool:
    return isinstance(v, list) and len(v) == n and all(_is_int(x) for x in v)


def _js_includes(lst: Any, x: Any) -> bool:
    """Array.prototype.includes with strict equality (no bool/int confusion)."""
    if not isinstance(lst, list) or isinstance(x, bool):
        return False
    return any(not isinstance(y, bool) and y == x and _is_int(y) == _is_int(x) for y in lst)


def is_iso_date(v: Any) -> bool:
    if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return False
    try:
        dt.date.fromisoformat(v)
    except ValueError:
        return False
    return True


def validate(g: Any, allow_ramp: bool = False) -> list[str]:
    """Structural errors of a §14 grid (empty list = valid). Messages match validateGrid() in grid.ts."""
    errors: list[str] = []
    err = errors.append
    if not _is_obj(g):
        return ["grid: not an object"]

    if not _is_pos(g.get("id")):
        err("id: positive integer expected")
    if not isinstance(g.get("title"), str) or not g.get("title"):
        err("title: non-empty string expected")
    if g.get("section") not in ("tutorial", "rated"):
        err('section: "tutorial" or "rated" expected')
    if "intro" in g and not isinstance(g["intro"], str):
        err("intro: string expected")
    if "teaches" in g and not (isinstance(g["teaches"], list) and all(isinstance(t, str) for t in g["teaches"])):
        err("teaches: string list expected")

    cols_raw = g.get("columns")
    cols = cols_raw if isinstance(cols_raw, list) else []
    n = len(cols)
    if (
        not isinstance(cols_raw, list)
        or n < MIN_COLUMNS
        or n > MAX_COLUMNS
        or not all(isinstance(c, str) for c in cols)
    ):
        err(f"columns: {MIN_COLUMNS} to {MAX_COLUMNS} labels expected")
    if not _is_int_array(g.get("demand"), n):
        err(f"demand: {n} integers expected")
    w = g.get("weather")
    if not _is_obj(w) or not _is_int_array(w.get("R"), n) or not _is_int_array(w.get("F"), n):
        err(f"weather: R and F with {n} integers each expected")
    elif not all(v >= 0 for v in w["R"]) or not all(v >= 0 for v in w["F"]):
        err("weather: values must be >= 0")

    # Pieces
    piece_ids: list[str] = []
    pieces = g.get("pieces")
    if not _is_obj(pieces) or len(pieces) == 0:
        err("pieces: non-empty object expected")
    else:
        for pid, d in pieces.items():
            if not _is_piece_id(pid):
                err(f"pieces.{pid}: unknown piece")
                continue
            piece_ids.append(pid)
            if not _is_obj(d):
                err(f"pieces.{pid}: object expected")
                continue
            if not _is_size_list(d.get("len")):
                err(f"pieces.{pid}.len: ascending positive integers expected")
            ramp = d.get("shape", "rect") != "rect"
            if "shape" in d:
                _check_shape(pid, d, allow_ramp, err)
            if not ramp and not _is_size_list(d.get("height")):
                err(f"pieces.{pid}.height: ascending positive integers expected")
            if not _is_pos(d.get("rank")):
                err(f"pieces.{pid}.rank: positive integer expected")
            elif d["rank"] != PIECE_SPEC[pid]["rank"]:
                err(f"pieces.{pid}.rank: {PIECE_SPEC[pid]['rank']} expected (§3)")
            if not _is_nat(d.get("co2")):
                err(f"pieces.{pid}.co2: integer >= 0 expected")
            elif d["co2"] != PIECE_SPEC[pid]["co2"]:
                err(f"pieces.{pid}.co2: {PIECE_SPEC[pid]['co2']} expected (§3)")

    def piece_def(pid: str) -> dict[str, Any] | None:
        p = pieces.get(pid) if _is_obj(pieces) else None
        return p if _is_obj(p) else None

    def allows_len(pid: str, length: Any) -> bool:
        d = piece_def(pid)
        return d is not None and _js_includes(d.get("len"), length)

    def allows_height(pid: str, height: Any) -> bool:
        d = piece_def(pid)
        if d is not None and d.get("shape", "rect") != "rect":
            return height == 1  # a ramp has a fixed profile: no height on its placements
        return d is not None and _js_includes(d.get("height"), height)

    def check_bar_geometry(at: str, pid: str, p: dict[str, Any]) -> None:
        if _is_pos(p.get("len")) and not allows_len(pid, p["len"]):
            err(f"{at}.len: width not allowed for {pid}")
        if _is_nat(p.get("col")) and _is_pos(p.get("len")) and p["col"] + p["len"] > n:
            err(f"{at}: goes past the last column")
        if not allows_height(pid, p.get("height", 1)):
            err(f"{at}.height: height not allowed for {pid}")

    neighbors = g.get("neighbors")

    def neighbor_cap(nid: Any) -> int | None:
        if not isinstance(neighbors, list):
            return None
        nb = next((x for x in neighbors if _is_obj(x) and x.get("id") == nid), None)
        return nb["cap"] if _is_obj(nb) and _is_pos(nb.get("cap")) else None

    # Neighbors
    countries: list[str] = []
    if not isinstance(neighbors, list):
        err("neighbors: list expected")
    else:
        for i, nb in enumerate(neighbors):
            if (
                not _is_obj(nb)
                or not isinstance(nb.get("id"), str)
                or not nb.get("id")
                or not isinstance(nb.get("name"), str)
            ):
                err(f"neighbors[{i}]: {{id, name, cap, co2}} expected")
                continue
            if nb["id"] == ANY_COUNTRY or nb["id"] in countries:
                err(f"neighbors[{i}].id: invalid or duplicate id")
            countries.append(nb["id"])
            if not _is_pos(nb.get("cap")):
                err(f"neighbors[{i}].cap: positive integer expected")
            if not _is_nat(nb.get("co2")):
                err(f"neighbors[{i}].co2: integer >= 0 expected")

    if not isinstance(g.get("step"), bool):
        err("step: boolean expected")
    if g.get("co2_cap", 0) is not None and not _is_nat(g.get("co2_cap")):
        err("co2_cap: null or integer >= 0 expected")

    def is_col(c: Any) -> bool:
        return _is_nat(c) and c < n

    def check_country_totals(where: str, v: Any, allow_any: bool) -> None:
        if v is _MISSING:  # absent key; an explicit null is refused, as in the TS validator
            return
        if not _is_obj(v):
            err(f"{where}: object expected")
            return
        for k, x in v.items():
            if not (k in countries or (allow_any and k == ANY_COUNTRY)):
                err(f"{where}.{k}: unknown country")
            if not _is_nat(x):
                err(f"{where}.{k}: integer >= 0 expected")
        if allow_any and ANY_COUNTRY in v and len(v) > 1:
            err(f'{where}: "{ANY_COUNTRY}" cannot be mixed with per-country keys')

    # Inventory
    inv = g.get("inventory")
    if not _is_obj(inv):
        err("inventory: object expected")
    else:
        if inv.get("level") not in ("exact", "none"):
            err('inventory.level: "exact" or "none" expected')
        ip = inv.get("pieces")
        if not _is_obj(ip):
            err("inventory.pieces: object expected")
        else:
            for pid in piece_ids:
                if pid not in ip:
                    err(f"inventory.pieces.{pid}: missing (declared in pieces)")
            for pid, spec in ip.items():
                if not _is_piece_id(pid) or pid not in piece_ids:
                    err(f"inventory.pieces.{pid}: not a grid piece")
                    continue
                if not _is_obj(spec):
                    err(f"inventory.pieces.{pid}: object expected")
                    continue
                for k in spec:
                    if k not in ("bars", "cells", "max_cells"):
                        err(f"inventory.pieces.{pid}.{k}: unknown key")
                if "bars" in spec:
                    bars = spec["bars"]
                    if not isinstance(bars, list) or not all(allows_len(pid, x) for x in bars):
                        err(f"inventory.pieces.{pid}.bars: widths allowed for {pid} expected")
                if "cells" in spec and not _is_nat(spec["cells"]):
                    err(f"inventory.pieces.{pid}.cells: integer >= 0 expected")
                if "max_cells" in spec and not _is_nat(spec["max_cells"]):
                    err(f"inventory.pieces.{pid}.max_cells: integer >= 0 expected")
                exact_keys = ("bars" in spec) + ("cells" in spec)
                if inv.get("level") == "exact" and exact_keys != 1:
                    err(f"inventory.pieces.{pid}: exact level needs bars or cells")
                if inv.get("level") == "none" and exact_keys != 0:
                    err(f"inventory.pieces.{pid}: no bars/cells at level none")
        if inv.get("level") == "none" and any(k in inv for k in ("exports", "imports", "step")):
            err("inventory: exchange totals belong to an exchanges clue at level none")
        check_country_totals("inventory.exports", inv.get("exports", _MISSING), False)
        check_country_totals("inventory.imports", inv.get("imports", _MISSING), True)
        if "step" in inv and not _is_nat(inv["step"]):
            err("inventory.step: integer >= 0 expected")
        if _is_pos(inv.get("step")) and g.get("step") is not True:
            err("inventory.step: grid has no STEP")

    clues = g.get("clues")
    if g.get("step") is True and _is_obj(inv):
        published = (inv.get("level") == "exact" and "step" in inv) or (
            isinstance(clues, list) and any(_is_obj(c) and c.get("type") == "exchanges" and "step" in c for c in clues)
        )
        if not published:
            err("step: a STEP grid must publish its number of pairs (inventory.step or an exchanges clue step)")

    # Clues
    if not isinstance(clues, list):
        err("clues: list expected")
    else:
        for i, cl in enumerate(clues):
            at = f"clues[{i}]"
            if not _is_obj(cl) or cl.get("type") not in CLUE_TYPES:
                err(f"{at}: unknown clue type")
                continue
            _check_clue(
                at,
                cl,
                piece_ids,
                countries,
                is_col,
                allows_len,
                neighbor_cap,
                check_country_totals,
                check_bar_geometry,
                n,
                err,
            )

    # Solution
    sol = g.get("solution")
    if not _is_obj(sol):
        err("solution: object expected")
    else:
        ex = sol.get("exports")
        if not _is_obj(ex):
            err("solution.exports: object expected")
        else:
            for k, v in ex.items():
                if k not in countries:
                    err(f"solution.exports.{k}: unknown country")
                if not _is_int_array(v, n) or not all(x >= 0 for x in v):
                    err(f"solution.exports.{k}: {n} integers >= 0 expected")
                elif neighbor_cap(k) is not None and any(x > neighbor_cap(k) for x in v):
                    err(f"solution.exports.{k}: over the line capacity")
        steps = sol.get("step")
        if not isinstance(steps, list):
            err("solution.step: list expected")
        else:
            for i, s in enumerate(steps):
                if not _is_obj(s) or not is_col(s.get("pump")) or not is_col(s.get("turbine")):
                    err(f"solution.step[{i}]: {{pump, turbine}} columns expected")
                elif s["pump"] >= s["turbine"]:
                    err(f"solution.step[{i}]: pump must come before turbine")
            if len(steps) > 0 and g.get("step") is not True:
                err("solution.step: grid has no STEP")
        pl = sol.get("placements")
        if not isinstance(pl, list):
            err("solution.placements: list expected")
        else:
            for i, p in enumerate(pl):
                _check_placement(
                    f"solution.placements[{i}]", p, piece_ids, countries, is_col, check_bar_geometry, n, err
                )

    d = g.get("difficulty")
    if (
        not _is_obj(d)
        or not _is_int(d.get("rating"))
        or d["rating"] < 1
        or d["rating"] > 4
        or not isinstance(d.get("label"), str)
        or not isinstance(d.get("techniques"), list)
        or not all(isinstance(t, str) for t in d["techniques"])
    ):
        err("difficulty: {rating 1-4, label, techniques[]} expected")

    if "bulletin" in g:
        _check_bulletin(g["bulletin"], n, err)
    return errors


def _check_shape(pid: str, d: dict[str, Any], allow_ramp: bool, err: Any) -> None:
    shape = d["shape"]
    if shape not in SHAPES:
        err(f"pieces.{pid}.shape: one of {', '.join(SHAPES)} expected")
        return
    if shape == "rect":
        return
    if not allow_ramp:
        err(f"pieces.{pid}.shape: ramps are not enabled")
        return
    if pid != RAMP_PIECE:
        err(f"pieces.{pid}.shape: only coal ({RAMP_PIECE}) can be a ramp")
    if "height" in d:
        err(f"pieces.{pid}.height: a ramp has no height")
    if _is_size_list(d.get("len")) and min(d["len"]) < RAMP_MIN_WIDTH[shape]:
        err(f"pieces.{pid}.len: a {shape} ramp is at least {RAMP_MIN_WIDTH[shape]} wide")


def _check_clue(
    at: str,
    cl: dict[str, Any],
    piece_ids: list[str],
    countries: list[str],
    is_col: Any,
    allows_len: Any,
    neighbor_cap: Any,
    check_country_totals: Any,
    check_bar_geometry: Any,
    n: int,
    err: Any,
) -> None:
    def need_piece() -> None:
        if not _is_piece_id(cl.get("piece")) or cl.get("piece") not in piece_ids:
            err(f"{at}.piece: not a grid piece")

    def need_col() -> None:
        if not is_col(cl.get("col")):
            err(f"{at}.col: column index expected")

    t = cl["type"]
    if t == "price":
        need_piece()
        need_col()
    elif t == "bar":
        need_piece()
        need_col()
        if _is_piece_id(cl.get("piece")) and not allows_len(cl["piece"], cl.get("len")):
            err(f"{at}.len: width not allowed")
        if _is_nat(cl.get("col")) and _is_pos(cl.get("len")) and cl["col"] + cl["len"] > n:
            err(f"{at}: bar goes past the last column")
    elif t == "length":
        need_piece()
        if _is_piece_id(cl.get("piece")) and not allows_len(cl["piece"], cl.get("len")):
            err(f"{at}.len: width not allowed")
    elif t == "column":
        need_col()
        counts = cl.get("counts")
        if not _is_obj(counts) or len(counts) == 0:
            err(f"{at}.counts: object expected")
            return
        for k, v in counts.items():
            ok = (_is_piece_id(k) and k in piece_ids) or (k.startswith("I:") and k[2:] in countries)
            if not ok:
                err(f"{at}.counts.{k}: unknown piece")
            if not _is_nat(v):
                err(f"{at}.counts.{k}: integer >= 0 expected")
    elif t == "flow":
        need_col()
        if not isinstance(cl.get("country"), str) or cl["country"] not in countries:
            err(f"{at}.country: unknown country")
        if cl.get("dir") not in ("export", "import"):
            err(f'{at}.dir: "export" or "import" expected')
        if not _is_nat(cl.get("value")):
            err(f"{at}.value: integer >= 0 expected")
        elif neighbor_cap(cl.get("country")) is not None and cl["value"] > neighbor_cap(cl["country"]):
            err(f"{at}.value: over the line capacity")
    elif t == "exchanges":
        check_country_totals(f"{at}.exports", cl.get("exports", _MISSING), False)
        check_country_totals(f"{at}.imports", cl.get("imports", _MISSING), True)
        if "step" in cl and not _is_nat(cl["step"]):
            err(f"{at}.step: integer >= 0 expected")
    elif t == "engaged":
        need_piece()
        need_col()
        if not _is_nat(cl.get("row")):
            err(f"{at}.row: integer >= 0 expected")
        if "height" in cl and not _is_pos(cl["height"]):
            err(f"{at}.height: positive integer expected")
        elif _is_piece_id(cl.get("piece")) and cl["piece"] in piece_ids:
            check_bar_geometry(at, cl["piece"], cl)


def _check_placement(
    at: str, p: Any, piece_ids: list[str], countries: list[str], is_col: Any, check_bar_geometry: Any, n: int, err: Any
) -> None:
    if not _is_obj(p):
        err(f"{at}: object expected")
        return
    piece = p.get("piece")
    if piece == IMPORT_PIECE:
        if not isinstance(p.get("country"), str) or p["country"] not in countries:
            err(f"{at}.country: unknown country")
    elif not _is_piece_id(piece) or piece not in piece_ids:
        err(f"{at}.piece: not a grid piece")
    elif "country" in p:
        err(f"{at}.country: only for imports")
    if not _is_nat(p.get("row")) or not is_col(p.get("col")) or not _is_pos(p.get("len")):
        err(f"{at}: row, col, len expected")
    if "height" in p and not _is_pos(p["height"]):
        err(f"{at}.height: positive integer expected")
        return
    if piece == IMPORT_PIECE:
        if _is_pos(p.get("len")) and p["len"] != 1:
            err(f"{at}.len: an import is one cell")
        if p.get("height", 1) != 1:
            err(f"{at}.height: an import is one cell")
        if _is_nat(p.get("col")) and _is_pos(p.get("len")) and p["col"] + p["len"] > n:
            err(f"{at}: goes past the last column")
    elif _is_piece_id(piece) and piece in piece_ids:
        check_bar_geometry(at, piece, p)


def _check_bulletin(b: Any, n: int, err: Any) -> None:
    if not _is_obj(b):
        err("bulletin: object expected")
        return
    if not _is_pos(b.get("number")):
        err("bulletin.number: positive integer expected")
    if not isinstance(b.get("title"), str) or not b["title"].strip():
        err("bulletin.title: non-empty string expected")
    if not isinstance(b.get("text"), str) or not b["text"].strip():
        err("bulletin.text: non-empty string expected")
    wv = b.get("weather")
    if not isinstance(wv, list) or len(wv) != n or not all(x in WEATHER_KINDS for x in wv):
        err(f"bulletin.weather: {n} values among {', '.join(WEATHER_KINDS)} expected")
    if not is_iso_date(b.get("published")):
        err("bulletin.published: ISO date YYYY-MM-DD expected")
    for k in b:
        if k not in ("number", "title", "text", "weather", "published"):
            err(f"bulletin.{k}: unknown key")


def residual(g: dict[str, Any]) -> list[int]:
    """Demand left to the dispatchable plants: demand - renewables - run-of-river (may be negative)."""
    return [g["demand"][c] - g["weather"]["R"][c] - g["weather"]["F"][c] for c in range(len(g["columns"]))]


def load_grids(path: str | Path) -> list[dict[str, Any]]:
    """Grids of a JSON file: one grid, a list of grids, or fixtures ({"grid", "expect"})."""
    data = json.loads(Path(path).read_text())
    items = data if isinstance(data, list) else [data]
    return [x["grid"] if isinstance(x, dict) and "grid" in x and "expect" in x else x for x in items]
