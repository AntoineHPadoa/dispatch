"""Library entry points used by the CLI, check_unique.py and the local lab server; they return JSON dicts.

- check_grid(): validity, number of compositions, reference match, deduction result and rating.
- deduce_grid(): full deduction trace.
- check_published(): every grid of a file must be valid, unique, equal to its reference, deducible
  (coal ramps accepted, as the web game plays them; allow_ramp=False refuses them).
- A CP-SAT timeout is reported (`error`), never counted as a unique grid.

Example: check_grid(grid)["compositions"] == 1
"""

from __future__ import annotations

from typing import Any

from . import exact
from .board import Puzzle, reference_composition
from .deduce import deduce
from .grid import LABELS, validate


def check_grid(g: dict[str, Any], allow_ramp: bool = False, cap: int = 2) -> dict[str, Any]:
    errors = validate(g, allow_ramp=allow_ramp)
    out: dict[str, Any] = {"id": g.get("id"), "valid": not errors, "errors": errors}
    if errors:
        return out
    pz = Puzzle(g)
    try:
        ex = exact.count(pz, cap=cap)
    except TimeoutError as exc:
        out.update({"compositions": None, "error": str(exc)})
        return out
    ref = reference_composition(g)
    d = deduce(pz, record=True)
    out.update(
        {
            "compositions": ex.count,
            "capped": ex.capped,
            "matches_reference": ex.composition == ref and ex.count >= 1,
            "deduction": d.status,
            "deduction_matches_reference": d.composition == ref if d.solved else None,
            "rating": d.rating if d.solved else None,
            "label": LABELS[d.rating] if d.solved else None,
            "techniques": sorted(d.techniques()),
            "summary": d.summary(),
        }
    )
    if ex.count > 1:
        out["other_composition"] = next((c for c in ex.compositions if c != ref), None)
    return out


def deduce_grid(g: dict[str, Any], max_level: int = 4) -> dict[str, Any]:
    return deduce(g, max_level=max_level).to_dict(steps=True)


def check_published(grids: list[dict[str, Any]], allow_ramp: bool = True) -> tuple[bool, list[str]]:
    """(ok, report lines) for the published grids: valid, one composition, the reference one, deducible.

    allow_ramp: accept coal ramps (`pieces.C.shape`); the web game plays them, so on by default.
    """
    ok = True
    lines = []
    numbers: dict[int, int] = {}
    for g in grids:
        r = check_grid(g, allow_ramp=allow_ramp)
        gid = g.get("id")
        if not r["valid"]:
            lines.append(f"grid {gid}: invalid: {'; '.join(r['errors'])}")
            ok = False
            continue
        if r.get("error"):
            lines.append(f"grid {gid}: {r['error']}")
            ok = False
            continue
        good = r["compositions"] == 1 and r["matches_reference"] and r["deduction"] == "solved"
        stored = g["difficulty"]["rating"]
        note = "" if r["rating"] == stored else f" (stored rating {stored})"
        lines.append(
            f"grid {gid:>2} {g['title']:<40} compositions={r['compositions']} "
            f"reference={'ok' if r['matches_reference'] else 'DIFFERS'} deduction={r['deduction']} "
            f"rating={r['rating']}{note}"
        )
        ok = ok and good
        b = g.get("bulletin")
        if b:
            if b["number"] in numbers:
                lines.append(f"grid {gid}: bulletin number {b['number']} already used by grid {numbers[b['number']]}")
                ok = False
            numbers[b["number"]] = gid
    lines.append("OK: every grid is unique and deducible" if ok else "FAILED")
    return ok, lines
