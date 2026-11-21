"""Meaning of the inventory and the market clues, shared by the exact and the deduction solvers.

- read_rules() turns a §14 grid into plain constraints: cell counts (inventory, records, import flows,
  import totals), exact bar widths, price, program, length and export-flow clues, exchange totals, engaged
  bars, CO2 cap.
- Exchange totals: exact inventory = published (missing key = 0); level none = what the `exchanges`
  clues publish, the rest is unknown (free). A STEP grid always publishes its number of pairs.
- Composition keys: piece id, or `I:<country>` for imports.

Example: rules = read_rules(grid); rules.prices -> {6: "T"}
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .grid import ANY_COUNTRY
from .shapes import shapes_of


@dataclass(frozen=True)
class Count:
    """lo <= cells of `keys` (in `cols`, or over the day when None) <= hi (None = no bound)."""

    keys: frozenset[str]
    cols: frozenset[int] | None
    lo: int
    hi: int | None
    rule: str  # technique that uses it: exhausted / just_enough (inventory), record, flow
    clue: int | None = None  # index of the clue, None for the inventory


@dataclass
class Rules:
    keys: list[str]  # composition keys in play: available pieces, then I:<country>
    counts: list[Count] = field(default_factory=list)
    bars: dict[tuple[str, int], int] = field(default_factory=dict)  # exact level: (piece, width) -> number
    prices: dict[int, str] = field(default_factory=dict)  # col -> piece
    price_clue: dict[int, int] = field(default_factory=dict)  # col -> clue index
    programs: list[tuple[str, int, int, int]] = field(default_factory=list)  # piece, col, len, clue index
    lengths: list[tuple[str, int, int]] = field(default_factory=list)  # piece, len, clue index
    export_flows: list[tuple[str, int, int, int]] = field(default_factory=list)  # country, col, value, clue
    export_totals: dict[str, int] = field(default_factory=dict)  # country -> total (published only)
    export_total_clue: dict[str, int | None] = field(default_factory=dict)
    step: int = 0
    engaged: list[dict[str, Any]] = field(default_factory=list)
    co2_cap: int | None = None
    contradictions: list[str] = field(default_factory=list)


def read_rules(g: dict[str, Any]) -> Rules:
    inv = g["inventory"]
    exact = inv["level"] == "exact"
    countries = [nb["id"] for nb in g["neighbors"]]
    pieces = [p for p in g["pieces"] if p in inv["pieces"]]
    r = Rules(keys=pieces + [f"I:{k}" for k in countries], co2_cap=g.get("co2_cap"))

    for p in pieces:
        spec = inv["pieces"][p]
        if "bars" in spec:
            for w in g["pieces"][p]["len"]:
                r.bars[p, w] = spec["bars"].count(w)
            size: dict[int, set[int]] = {}
            for sh in shapes_of(g["pieces"][p]):
                size.setdefault(sh.width, set()).add(sum(h for _b, h in sh.columns))
            if all(len(size.get(w, ())) == 1 for w in spec["bars"]):
                total = sum(next(iter(size[w])) for w in spec["bars"])
                r.counts.append(Count(frozenset([p]), None, total, total, "inventory"))
        if "cells" in spec:
            k = spec["cells"]
            r.counts.append(Count(frozenset([p]), None, k, k, "inventory"))
        if "max_cells" in spec:
            r.counts.append(Count(frozenset([p]), None, 0, spec["max_cells"], "inventory"))

    # Exchange totals: inventory (exact) then exchanges clues.
    imports: dict[str, int] = {}
    imports_src: dict[str, int | None] = {}
    if exact:
        for k in countries:
            r.export_totals[k] = inv.get("exports", {}).get(k, 0)
            r.export_total_clue[k] = None
        inv_imp = inv.get("imports", {})
        if ANY_COUNTRY in inv_imp:
            imports[ANY_COUNTRY] = inv_imp[ANY_COUNTRY]
        else:
            for k in countries:
                imports[k] = inv_imp.get(k, 0)
        imports_src = {k: None for k in imports}
        r.step = inv.get("step", 0)
    steps_published = exact

    def merge(store: dict[str, int], src: dict[str, int | None], k: str, v: int, i: int, what: str) -> None:
        if k in store and store[k] != v:
            r.contradictions.append(f"{what} {k}: {store[k]} and {v}")
        store[k] = v
        src.setdefault(k, i)

    for i, cl in enumerate(g["clues"]):
        t = cl["type"]
        if t == "price":
            if cl["col"] in r.prices and r.prices[cl["col"]] != cl["piece"]:
                r.contradictions.append(f"two prices at column {cl['col']}")
            r.prices[cl["col"]] = cl["piece"]
            r.price_clue[cl["col"]] = i
        elif t == "bar":
            r.programs.append((cl["piece"], cl["col"], cl["len"], i))
        elif t == "length":
            r.lengths.append((cl["piece"], cl["len"], i))
        elif t == "column":
            for k, v in cl["counts"].items():
                if k not in r.keys:
                    if v > 0:
                        r.contradictions.append(f"record of an unavailable piece {k}")
                    continue
                r.counts.append(Count(frozenset([k]), frozenset([cl["col"]]), v, v, "record", i))
        elif t == "flow":
            if cl["dir"] == "export":
                for k, c, v, _ in r.export_flows:
                    if (k, c) == (cl["country"], cl["col"]) and v != cl["value"]:
                        r.contradictions.append(f"two flows to {k} at column {c}")
                r.export_flows.append((cl["country"], cl["col"], cl["value"], i))
            else:
                r.counts.append(
                    Count(
                        frozenset([f"I:{cl['country']}"]), frozenset([cl["col"]]), cl["value"], cl["value"], "flow", i
                    )
                )
        elif t == "exchanges":
            for k, v in cl.get("exports", {}).items():
                merge(r.export_totals, r.export_total_clue, k, v, i, "exports")
            for k, v in cl.get("imports", {}).items():
                merge(imports, imports_src, k, v, i, "imports")
            if "step" in cl:
                if steps_published and r.step != cl["step"]:
                    r.contradictions.append(f"step: {r.step} and {cl['step']}")
                r.step = cl["step"]
                steps_published = True
        elif t == "engaged":
            r.engaged.append(dict(cl))

    # A country whose import total is published as 0 offers no import cell at all (not a deduction).
    for k, v in imports.items():
        if v == 0:
            gone = countries if k == ANY_COUNTRY else [k]
            r.keys = [x for x in r.keys if x[2:] not in gone or not x.startswith("I:")]
    for k, v in imports.items():
        if v == 0:
            continue
        keys = frozenset(f"I:{c}" for c in countries) if k == ANY_COUNTRY else frozenset([f"I:{k}"])
        r.counts.append(
            Count(keys, None, v, v, "record" if imports_src.get(k) is not None else "inventory", imports_src.get(k))
        )
    kept = []
    for c in r.counts:
        keys = frozenset(k for k in c.keys if k in r.keys)
        if not keys:
            if c.lo > 0:
                r.contradictions.append(f"count of unavailable cells {sorted(c.keys)}")
            continue
        kept.append(Count(keys, c.cols, c.lo, c.hi, c.rule, c.clue))
    r.counts = kept
    if not g["step"]:
        r.step = 0
    return r
