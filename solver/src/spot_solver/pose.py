"""Pose puzzle mode: read the pose format, constrain the model, solve and count compositions.

- Format: `"mode": "pose"`, `inventory` (4 levels), `clues` (lore clues), legacy `price_clues`,
  `constraints.co2_cap` (pose-mode.md §6).
- Constraints added to the v2 model: whole inventory laid (exact bars, bars count + cells, cells, or no
  count at level "none"), exact exports / imports (per country or all countries) / STEP, no curtailment,
  and the clues: price, bar (program), column (production record), given (pre-placed bar), flow.
- `solve_pose()` finds a pose, counts distinct compositions (cap 10; publishable if exactly one) and runs
  the human deduction solver (`deduce.py`) for the rating.

Example: uv run spot-solver solve examples/pose8.json --pretty
"""

from __future__ import annotations

import time
from typing import Any

from . import deduce
from . import model as M
from .evaluate import evaluate
from .grid import Grid, from_dict

COUNT_CAP = 10
LEVEL_BASE = {"exact": 0, "bars": 3, "cells": 6, "none": 8}  # pose-mode.md §5, point 5
CLUE_TYPES = ("price", "bar", "column", "given", "flow")
ANY_COUNTRY = "I"


def default_columns(n: int) -> list[str]:
    return [f"{(i * 24) // n}h" for i in range(n)]


def normalize(d: dict[str, Any]) -> tuple[Grid, dict[str, Any]]:
    """Build the Grid of a pose dict (no curtailment, exact STEP) and return it with the inventory."""
    inv = d.get("inventory") or {}
    cons = d.get("constraints") or {}
    d2 = {k: v for k, v in d.items()
          if k not in ("mode", "inventory", "price_clues", "clues", "constraints", "curtail_penalty",
                       "objective", "solution", "difficulty", "step")}
    d2["columns"] = d.get("columns") or default_columns(len(d["residual"]))
    # STEP needs a published pair count: there is no safe bound to fall back on.
    if "step" in inv and inv["step"] is None:
        raise ValueError("STEP pair count is not published: set inventory.step (or an exchanges clue step)")
    d2["step"] = int(inv.get("step") or 0)
    d2["objective"] = {"optimize": "min_score", "target": None,
                       "constraints": {"co2_cap": cons.get("co2_cap")}}
    return from_dict(d2), inv


def _eq(m: Any, expr: Any, value: int) -> None:
    """expr == value, where expr may be a plain int (an empty sum): then it is a model-level check."""
    if isinstance(expr, int):
        if expr != value:
            m.AddBoolOr([])  # infeasible
    else:
        m.Add(expr == value)


def _bars_of(h: M.Handles, pid: str) -> list[tuple[int, Any]]:
    return [(length, b) for (p, _r, _c, length), b in h.bars.items() if p == pid]


def apply_inventory(h: M.Handles, inv: dict[str, Any]) -> None:
    """Lay the whole inventory, nothing more: pieces, imports, exports, STEP."""
    m, grid = h.model, h.grid
    specs = inv.get("pieces") or {}
    for pid in grid.pieces:
        spec = specs.get(pid) or {}
        bars = _bars_of(h, pid)
        lens = grid.piece_lens(pid)
        if "bars" in spec:
            wanted = [int(x) for x in spec["bars"]]
            if any(x not in lens for x in wanted):
                m.AddBoolOr([])
                continue
            for length in lens:
                _eq(m, sum(b for ln, b in bars if ln == length), wanted.count(length))
        elif pid not in specs:
            _eq(m, sum(h.counts[pid]), 0)  # a piece absent from the inventory is not laid
        else:
            # Level "none" gives the piece with no count: it is available, nothing more.
            if "count" in spec:
                _eq(m, sum(b for _, b in bars), int(spec["count"]))
            if "cells" in spec:
                _eq(m, sum(h.counts[pid]), int(spec["cells"]))
    for pid in specs:
        if pid not in grid.pieces:
            m.AddBoolOr([])  # inventory names a piece the grid does not have

    imports = inv.get("imports") or {}
    importers = {nb.id: pid for pid, nb in grid.importers.items() if pid in h.counts}
    if inv.get("imports", {}) is None:
        pass  # import totals unknown
    elif ANY_COUNTRY in imports:
        _eq(m, sum(sum(h.counts[pid]) for pid in importers.values()), int(imports[ANY_COUNTRY]))
    else:
        for nid, pid in importers.items():
            _eq(m, sum(h.counts[pid]), int(imports.get(nid, 0)))
    known = {nb.id for nb in grid.neighbors if nb.id in importers}
    if any(k != ANY_COUNTRY and k not in known and int(v) != 0 for k, v in imports.items()):
        m.AddBoolOr([])

    exports = inv.get("exports") or {}
    for nb in grid.neighbors:
        if inv.get("exports", {}) is not None:  # None: export totals unknown
            _eq(m, sum(h.exports[nb.id]), int(exports.get(nb.id, 0)))
    ids = {nb.id for nb in grid.neighbors}
    if any(k not in ids and int(v) != 0 for k, v in exports.items()):
        m.AddBoolOr([])

    _eq(m, sum(h.step.values()) if h.step else 0, grid.step)


def read_clues(d: dict[str, Any], prices: list[int | None] | None = None,
               lore: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """All clues of a grid as dicts: `clues` (or `lore`) plus the price list (`price_clues` or `prices`)."""
    out = [dict(c) for c in (d.get("clues") if lore is None else lore) or []]
    for c, v in enumerate((d.get("price_clues") if prices is None else prices) or []):
        if v is not None:
            out.append({"type": "price", "col": c, "value": int(v)})
    for c in out:
        if c.get("type") not in CLUE_TYPES:
            raise ValueError(f"unknown clue type {c.get('type')!r}")
    return out


def neighbor_of(grid: Grid, country: str) -> Any:
    for nb in grid.neighbors:
        if nb.id == country:
            return nb
    raise ValueError(f"unknown country {country!r}")


def apply_clue(h: M.Handles, clue: dict[str, Any]) -> None:
    """Add one clue to the model."""
    m, grid = h.model, h.grid
    kind, c = clue["type"], int(clue["col"])
    if kind == "price":
        m.Add(h.col_price[c] == int(clue["value"]))
    elif kind == "bar":
        # Some bar of this piece covers exactly the slots c .. c+len-1, on any row.
        rows = [b for (p, _r, c0, ln), b in h.bars.items()
                if p == clue["piece"] and c0 == c and ln == int(clue["len"])]
        m.AddBoolOr(rows)
    elif kind == "column":
        for pid, k in clue["counts"].items():
            _eq(m, h.counts[pid][c] if pid in h.counts else 0, int(k))
    elif kind == "given":
        b = h.bars.get((clue["piece"], int(clue["row"]), c, int(clue["len"])))
        if b is None:
            m.AddBoolOr([])
        else:
            m.Add(b == 1)
    elif kind == "flow":
        nb = neighbor_of(grid, clue["country"])
        if clue["dir"] == "export":
            m.Add(h.exports[nb.id][c] == int(clue["value"]))
        else:
            pid = grid.import_pid(nb)
            _eq(m, h.counts[pid][c] if pid in h.counts else 0, int(clue["value"]))


PIECE_NAMES = {"N": ("le nucléaire", "réacteur", "nucléaire"), "B": ("le barrage", "barrage", "barrage"),
               "C": ("le charbon", "centrale à charbon", "charbon"), "G": ("le gaz", "centrale à gaz", "gaz"),
               "T": ("la TAC", "TAC", "TAC")}


def _piece_words(grid: Grid, pid: str) -> tuple[str, str, str]:
    """(price setter, plant, cell noun) in French for a piece or an import."""
    if grid.is_import(pid):
        nb = grid.importers[pid]
        return (f"l'import de {nb.name}", f"import de {nb.name}", f"import de {nb.name}")
    return PIECE_NAMES.get(pid, (pid, pid, pid))


def clue_text(grid: Grid, clue: dict[str, Any]) -> str:
    """French text of a clue, in the market lore."""
    cols = grid.columns
    kind, c = clue["type"], int(clue["col"])
    if kind == "price":
        v = int(clue["value"])
        setters = sorted({_piece_words(grid, pid)[0] for pid in grid.piece_ids()
                          if grid.piece_price(pid, c) == v})
        who = " ou ".join(setters) if setters else "personne"
        return f"À {cols[c]}, le prix est de {v} : c'est {who} qui le fixe."
    if kind == "bar":
        end = (c + int(clue["len"])) * 24 // grid.n
        return f"Un(e) {_piece_words(grid, clue['piece'])[1]} tourne de {cols[c]} à {end}h."
    if kind == "given":
        end = (c + int(clue["len"])) * 24 // grid.n
        return (f"Déjà engagé(e) : {_piece_words(grid, clue['piece'])[1]} de {cols[c]} à {end}h, "
                f"ligne {int(clue['row']) + 1}.")
    if kind == "column":
        parts = [f"{k} case{'s' if int(k) > 1 else ''} de {_piece_words(grid, pid)[2]}" if int(k)
                 else f"aucune case de {_piece_words(grid, pid)[2]}" for pid, k in clue["counts"].items()]
        return f"Relevé de {cols[c]} : {', '.join(parts)}."
    nb = neighbor_of(grid, clue["country"])
    k = int(clue["value"])
    if clue["dir"] == "export":
        return (f"À {cols[c]}, {k} bloc{'s' if k > 1 else ''} exporté{'s' if k > 1 else ''} vers {nb.name}."
                if k else f"À {cols[c]}, aucun export vers {nb.name}.")
    return (f"À {cols[c]}, {k} case{'s' if k > 1 else ''} importée{'s' if k > 1 else ''} de {nb.name}."
            if k else f"À {cols[c]}, aucun import de {nb.name}.")


def build_pose(d: dict[str, Any], clues: list[int | None] | None = None,
               lore: list[dict[str, Any]] | None = None) -> M.Handles:
    """Model of a pose grid; `clues` overrides `price_clues` and `lore` overrides `clues` when given."""
    grid, inv = normalize(d)
    h = M.build(grid)
    apply_inventory(h, inv)
    for clue in read_clues(d, clues, lore):
        apply_clue(h, clue)
    return h


def count_pose(d: dict[str, Any], clues: list[int | None] | None = None, cap: int = COUNT_CAP,
               time_limit: float = 60.0, lore: list[dict[str, Any]] | None = None) -> M.CountResult:
    return M.count(build_pose(d, clues, lore), cap, time_limit)


def difficulty(grid: Grid, inv: dict[str, Any], n_clues: int) -> dict[str, Any]:
    """Level of the inventory + 2 x share of slots without a clue x 5 + active mechanics (all clue types)."""
    level = inv.get("level", "exact")
    n = grid.n
    free = max(0, n - n_clues)
    mechanics = (
        max(0, len(grid.pieces) - 1)
        + len(grid.neighbors)
        + (1 if any(nb.co2 for nb in grid.neighbors) else 0)
        + (1 if grid.step else 0)
        + (1 if grid.objective.co2_cap is not None else 0)
    )
    value = LEVEL_BASE[level] + 2 * (free / n) * 5 + mechanics
    return {"value": round(value, 1), "level": level, "clues": n - free, "mechanics": mechanics}


def solve_pose(d: dict[str, Any], count_cap: int = COUNT_CAP, decoys: bool = True,
               time_limit: float = 60.0) -> dict[str, Any]:
    """Find a pose and count the compositions satisfying the grid. `decoys` adds the difficulty."""
    t0 = time.perf_counter()
    grid, inv = normalize(d)
    cnt = count_pose(d, cap=count_cap, time_limit=time_limit)
    if cnt.count == 0:
        return {"status": "infeasible", "mode": "pose", "time": round(time.perf_counter() - t0, 3)}
    solution = cnt.solutions[0]
    ev = evaluate(grid, solution)
    out: dict[str, Any] = {
        "status": "solved",
        "mode": "pose",
        "co2": ev.co2,
        "prices": ev.col_price,
        "compositions": cnt.label,
        "publishable": cnt.count == 1,
        "solution": solution,
    }
    if ev.errors:
        out["errors"] = ev.errors
    if decoys:
        out["difficulty"] = difficulty(grid, inv, len(read_clues(d)))
        ded = deduce.deduce(d)
        out["difficulty"].update(rating=ded.rating if ded.solved else None,
                                 rating_label=ded.label if ded.solved else "non résoluble sans essai-erreur",
                                 techniques=ded.techniques())
    out["time"] = round(time.perf_counter() - t0, 3)
    return out
