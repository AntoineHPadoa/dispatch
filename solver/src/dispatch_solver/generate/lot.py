"""Generator: one candidate grid from a configuration, and lots with imposed diversity (§10).

- Config (one entry of a lot's `mix`): cols, family, height, pieces, tall, ramp, neighbors, step, surplus,
  co2_cap, stock, inventory, clue_types, rating, max_clues, min_decisions, demand_price, hole_types. See
  DEFAULTS; check_lot() refuses unknown keys and bad values before any draw.
- make_candidate(): draw a day, solve the reference (merit order; ramps of drawn widths, sometimes two; with
  `hole_types`, the type of each hole drawn among those that fit), with one export imposed when it trades with
  none of the entry's neighbors (else reject `dead_neighbors`), drop the neighbors the reference never trades
  with (dead mechanic), write the inventory, select the minimal clues up to an aimed technique level, check
  one composition (CP-SAT) and the deduction, drop a CO2 cap no `carbon` step uses (checked again), rate it,
  count its decisions (deduce.trace.decisions; fewer than `min_decisions` is the reject `no_decision`,
  "filling"), write the bulletin draft and the `lab` block (decisions, live mechanics, bars, nuclear prices,
  coupled global mechanics, compactness K, demand prices, ramp_settled_by, cells, full_n_rows,
  cells_per_decision, holes: measures only, all taken on the cleaned grid). `demand_price`: when the pool has
  a price on a dear plant in an export column (D7), one such price starts the clue selection.
- run_lot(): keeps the worker processes busy (rolling queue), accepts in draw order under the quotas
  (silhouette family, mechanics, clue profile, grids whose decisions are all of one type, grids holding
  a decision type: ceiling max_with_type and floor min_with_type, minimum per rating (one number or
  {rating: n}) and per mix entry, grids with a demand price: max_demand_price; near-twins: max_per_mix grids
  per entry, max_with_cols grids per slot count; filler_cells: reject `filler` for a Difficile or Expert with
  that many cells, off by default). Type quotas also take the key "coupled": a global mechanic (STEP or CO2)
  coupled to an exchange, what notation A rates. Draws aim at the ratings still missing (a missing Difficile
  or Expert aims at the entries able to give a coupled global mechanic) and at the mix entries able to give
  a type under its floor; while max_demand_price is not reached, half the draws seed a demand price.
  Soft quota min_with_contested (never a reject): while it is short, a Moyen-and-up grid without a contested
  hole waits, one time in two, until the quota is met or the draws run out (contested holes weigh twice).
  Finished grids refused by a reservation (rating, mix, type floor) wait in a reserve; a draw longer than
  ATTEMPT_SECONDS is the reject `timeout` (config and seed in stats.errors).

Example: grids, stats = run_lot(json.load(open("lab/lots/demo-01.json")))
"""

from __future__ import annotations

import copy
import faulthandler
import json
import random
import re
import signal
import time
from collections import deque
from concurrent.futures import Future, ProcessPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any

from .. import __version__, exact
from ..board import reference_composition
from ..deduce import deduce
from ..deduce.holes import filling_measures, hole_measures, lot_measures
from ..deduce.trace import (
    DECISION_TYPES,
    RAMP_OWN,
    RAMP_RULES,
    compactness,
    decisions,
    live_mechanics,
    ramp_settled_by,
)
from ..grid import LABELS, validate
from .bulletin import make_bulletin
from .cluesel import clue_pool, demand_prices, select_clues
from .draft import make_draft
from .reference import fill_inventory, solve_reference
from .silhouettes import FAMILIES, draw_day

DEFAULTS: dict[str, Any] = {
    "cols": 8,
    "family": "any",
    "height": None,  # None: drawn in 5..7
    "pieces": "NGT",
    "tall": False,
    "ramp": None,
    "neighbors": 0,
    "step": 0,
    "surplus": False,
    "co2_cap": None,
    "stock": None,
    "inventory": "none",
    "clue_types": ["price", "column", "flow", "bar", "length", "exchanges"],
    "rating": None,
    "max_clues": None,
    "min_decisions": 1,  # 0 only for lots that may hold filling grids (tutorials)
    "demand_price": False,  # D7: seed the clue selection with a price on a dear plant in an export column
    "hole_types": False,  # the reference draws the type of each hole among those that fit (contested holes)
    "max_nuclear": None,  # [lo, hi]: nuclear share cap of the reference, drawn per grid (1: no cap); looser skeleton
    "allow_one_plant": False,  # keep grids with a single kind of plant (imports aside) instead of rejecting one_plant
}
COLUMN_COUNTS = (6, 8, 12)
COUNTRIES = [("DE", 2), ("ES", 0), ("UK", 1), ("IT", 2), ("BE", 1)]
QUOTAS = {
    "max_same_family": 3,
    "max_same_mechanics": 4,
    "max_same_clue_profile": 4,
    "min_per_rating": 2,
    "min_per_mix": 1,
    "max_same_single_decision": None,  # grids whose decisions are all of one type, per type (None: no limit)
    "max_with_type": {},  # {decision type: n}: at most n grids holding that type, whatever else they hold
    "min_with_type": {},  # {decision type: n}: at least n grids holding that type (slots reserved, draws aimed)
    "max_demand_price": None,  # at most n grids with a demand price (D7); while under it, draws seed one
    "max_per_mix": None,  # at most n grids per mix entry (None: no limit)
    "max_with_cols": {},  # {slot count: n}: at most n grids of that many slots (e.g. {"12": 5})
    "min_with_contested": None,  # soft: Moyen-and-up grids with a contested hole aimed at, never a reject
    "filler_cells": None,  # reject `filler`: a Difficile or Expert with at least n cells to lay (off by default)
}
COUPLED = "coupled"  # quota key: a global mechanic (STEP or CO2) coupled to an exchange (notation A)
QUOTA_TYPES = (*DECISION_TYPES, COUPLED)
TYPE_QUOTAS = ("max_with_type", "min_with_type")
QUOTA_ALIASES = {"max_same_silhouette": "max_same_family"}
LOT_KEYS = ("lot", "size", "seed", "mix", "quotas", "max_attempts", "comment")
CLUE_TYPES = ("price", "column", "flow", "bar", "length", "exchanges")
# A draw past ATTEMPT_SECONDS is the reject `timeout`: the worker raises it (Python code), or, when the draw is stuck
# in native code, the lot stops waiting for it after HEAD_SECONDS at the head of the ordered queue, and the
# worker dumps its stack to stderr. A stuck worker is terminated at the end of the lot.
ATTEMPT_SECONDS = 300
HEAD_SECONDS = 2 * ATTEMPT_SECONDS
RAMP_WIDTHS = {("trap", 6): [3], ("trap", 8): [3, 4, 5], ("trap", 12): [3, 4, 5, 6], "stair": [2, 3, 4]}


def check_lot(lot: Any) -> tuple[dict[str, Any], list[str]]:
    """(normalised lot, errors) before any draw: unknown keys and bad values are refused, not ignored."""
    errors: list[str] = []
    if not isinstance(lot, dict):
        return {}, ["lot: object expected"]
    out = dict(lot)
    for k in lot:
        if k not in LOT_KEYS:
            errors.append(f"unknown key {k!r} (expected one of {', '.join(LOT_KEYS)})")
    name = lot.get("lot")
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
        errors.append("lot: name of letters, digits, '-' or '_' expected")
    if not _nat(lot.get("size")) or lot["size"] < 1:
        errors.append("size: positive integer expected")
    if "seed" in lot and not _nat(lot["seed"]):
        errors.append("seed: integer >= 0 expected")
    if "max_attempts" in lot and (not _nat(lot["max_attempts"]) or lot["max_attempts"] < 1):
        errors.append("max_attempts: positive integer expected")
    quotas = lot.get("quotas", {})
    if not isinstance(quotas, dict):
        errors.append("quotas: object expected")
        quotas = {}
    norm_q: dict[str, Any] = {}
    for k, v in quotas.items():
        key = QUOTA_ALIASES.get(k, k)
        if key not in QUOTAS:
            errors.append(f"quotas: unknown key {k!r} (expected one of {', '.join(QUOTAS)})")
        elif key in TYPE_QUOTAS:
            if not isinstance(v, dict) or any(not _type_key(t) or not _nat(n) for t, n in v.items()):
                errors.append(
                    f"quotas.{k}: object {{decision type: integer >= 0}} expected ({', '.join(QUOTA_TYPES)};"
                    ' "a+b": both types, "a|b": either)'
                )
            else:
                norm_q[key] = dict(v)
        elif key == "max_with_cols":
            if not isinstance(v, dict) or any(
                str(c) not in map(str, COLUMN_COUNTS) or not _nat(n) for c, n in v.items()
            ):
                errors.append(
                    f"quotas.{k}: object {{slot count ({', '.join(map(str, COLUMN_COUNTS))}): integer >= 0}} expected"
                )
            else:
                norm_q[key] = {int(c): n for c, n in v.items()}
        elif key == "min_per_rating" and isinstance(v, dict):
            if any(str(r) not in ("1", "2", "3", "4") or not _nat(n) for r, n in v.items()):
                errors.append(f"quotas.{k}: integer >= 0, or object {{rating (1-4): integer >= 0}} expected")
            else:
                norm_q[key] = {int(r): n for r, n in v.items()}
        elif v is None and key in ("max_demand_price", "max_per_mix", "min_with_contested", "filler_cells"):
            norm_q[key] = None
        elif not _nat(v):
            errors.append(f"quotas.{k}: integer >= 0 expected")
        else:
            norm_q[key] = v
    out["quotas"] = norm_q
    lo, hi = norm_q.get("min_with_type", {}), norm_q.get("max_with_type", {})
    for t, n in lo.items():
        if t in hi and n > hi[t]:
            errors.append(f"quotas: min_with_type.{t} ({n}) above max_with_type.{t} ({hi[t]})")
        if _nat(lot.get("size")) and n > lot["size"]:
            errors.append(f"quotas: min_with_type.{t} ({n}) above the lot size")
    mix = lot.get("mix")
    if not isinstance(mix, list) or not mix:
        errors.append("mix: non-empty list of configurations expected")
        mix = []
    cap_m = norm_q.get("max_per_mix")
    if cap_m is not None and _nat(lot.get("size")) and cap_m * len(mix) < lot["size"]:
        errors.append(f"quotas: max_per_mix ({cap_m}) x {len(mix)} mix entries is below the lot size")
    if cap_m is not None and cap_m < norm_q.get("min_per_mix", QUOTAS["min_per_mix"]):
        errors.append(f"quotas: max_per_mix ({cap_m}) below min_per_mix")
    out["mix"] = []
    for j, m in enumerate(mix):
        cfg, errs = check_config(m)
        errors += [f"mix[{j}].{e}" for e in errs]
        out["mix"].append(cfg)
    return out, errors


def check_config(m: Any) -> tuple[dict[str, Any], list[str]]:
    """(normalised configuration, errors) of one entry of a lot's mix."""
    if not isinstance(m, dict):
        return {}, ["object expected"]
    errs: list[str] = []
    cfg = dict(m)
    for k in m:
        if k not in DEFAULTS and k != "weight":
            errs.append(f"{k}: unknown key (expected weight or one of {', '.join(DEFAULTS)})")
    w = m.get("weight", 1)
    if isinstance(w, bool) or not isinstance(w, (int, float)) or w <= 0:
        errs.append("weight: positive number expected")
    if "cols" in m and m["cols"] not in COLUMN_COUNTS:
        errs.append(f"cols: one of {', '.join(map(str, COLUMN_COUNTS))} expected (slots of 4 h, 3 h or 2 h)")
    if "family" in m and m["family"] not in (*FAMILIES, "any"):
        errs.append(f"family: one of any, {', '.join(FAMILIES)} expected")
    if m.get("height") is not None and (not _nat(m["height"]) or not 4 <= m["height"] <= 8):
        errs.append("height: integer in 4..8 expected")
    if "pieces" in m:
        p = m["pieces"]
        p = "".join(p) if isinstance(p, list) else p
        if not isinstance(p, str):
            errs.append("pieces: letters among N, B, C, G, T expected")
        else:
            p = re.sub(r"[\s,]", "", p).upper()
            if not p or any(x not in "NBCGT" for x in p) or len(set(p)) != len(p):
                errs.append('pieces: letters among N, B, C, G, T expected, each once (e.g. "NCGT")')
            else:
                cfg["pieces"] = "".join(sorted(p, key="NBCGT".index))
    if "tall" in m and not isinstance(m["tall"], bool):
        errs.append("tall: true or false expected (the tall piece is always coal, 1 or 2 high)")
    if m.get("ramp") is not None and m["ramp"] not in ("trap", "stair"):
        errs.append('ramp: "trap" or "stair" expected (the ramp is always coal)')
    if m.get("ramp") and m.get("tall"):
        errs.append("ramp and tall: coal has one shape per grid")
    if "neighbors" in m and (not _nat(m["neighbors"]) or m["neighbors"] > len(COUNTRIES)):
        errs.append(f"neighbors: integer in 0..{len(COUNTRIES)} expected")
    if "step" in m and (not _nat(m["step"]) or m["step"] > 2):
        errs.append("step: integer in 0..2 expected")
    if "surplus" in m and not isinstance(m["surplus"], bool):
        errs.append("surplus: true or false expected")
    if m.get("co2_cap") is not None and m["co2_cap"] != "auto" and not _nat(m["co2_cap"]):
        errs.append('co2_cap: "auto" or integer >= 0 expected')
    if m.get("stock") is not None and (not _nat(m["stock"]) or m["stock"] < 1):
        errs.append("stock: positive integer expected")
    if "inventory" in m and m["inventory"] not in ("none", "exact"):
        errs.append('inventory: "none" or "exact" expected')
    if "clue_types" in m:
        ct = m["clue_types"]
        if not isinstance(ct, list) or not ct or any(t not in CLUE_TYPES for t in ct):
            errs.append(f"clue_types: non-empty list among {', '.join(CLUE_TYPES)} expected")
    if m.get("rating") is not None and m["rating"] not in (1, 2, 3, 4):
        errs.append("rating: 1, 2, 3 or 4 expected")
    if m.get("max_clues") is not None and (not _nat(m["max_clues"]) or m["max_clues"] < 1):
        errs.append("max_clues: positive integer expected")
    if "min_decisions" in m and not _nat(m["min_decisions"]):
        errs.append("min_decisions: integer >= 0 expected")
    if "demand_price" in m and not isinstance(m["demand_price"], bool):
        errs.append("demand_price: true or false expected")
    for key in ("hole_types", "allow_one_plant"):
        if key in m and not isinstance(m[key], bool):
            errs.append(f"{key}: true or false expected")
    mn = m.get("max_nuclear")
    if mn is not None and not (
        isinstance(mn, list)
        and len(mn) == 2
        and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in mn)
        and 0 < mn[0] <= mn[1] <= 1
    ):
        errs.append("max_nuclear: [lo, hi] expected, 0 < lo <= hi <= 1 (the cap is drawn per grid, 1: no cap)")
    return cfg, errs


def _nat(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def mechanics(g: dict[str, Any]) -> list[str]:
    out = []
    if g["neighbors"]:
        out.append(f"neighbors:{len(g['neighbors'])}")
    if g["step"]:
        out.append("step")
    if any(
        x < 0 for x in (g["demand"][c] - g["weather"]["R"][c] - g["weather"]["F"][c] for c in range(len(g["columns"])))
    ):
        out.append("surplus")
    if g.get("co2_cap") is not None:
        out.append("co2")
    c = g["pieces"].get("C", {})
    if c.get("shape", "rect") != "rect":
        out.append(f"ramp:{c['shape']}")
    elif 2 in c.get("height", []):
        out.append("tall")
    if any("max_cells" in s for s in g["inventory"]["pieces"].values()):
        out.append("stock")
    out.append(f"inventory:{g['inventory']['level']}")
    return out


def make_candidate(
    cfg: dict[str, Any], seed: int, aim: int | None = None
) -> tuple[dict[str, Any] | None, str | None, dict[str, Any]]:
    """(grid, None, info) or (None, reject reason, info) for one attempt.

    aim: highest technique level the clue selection may count on (the lot's lever on the rating);
    a configuration's `rating` sets it and rejects any other rating.
    """
    cfg = {**DEFAULTS, **cfg}
    rng = random.Random(seed)
    t0 = time.perf_counter()
    info: dict[str, Any] = {"seed": seed}
    n = cfg["cols"]
    if n not in COLUMN_COUNTS:
        raise ValueError(f"cols: one of {COLUMN_COUNTS} expected (slots of 4 h, 3 h or 2 h, §2)")
    explore = (cfg["rating"] or aim or 0) >= 3  # aimed at levels 3-4: less informative clues
    aim = cfg["rating"] or aim or 4
    info["aim"] = aim
    family = cfg["family"]
    if cfg["surplus"]:
        family = "surplus_midi"
    height = cfg["height"] or rng.randint(5, 7)
    family, demand, r, f = draw_day(rng, n, family, height=height)
    info["family"] = family
    nbs = [(k, 1, co2) for k, co2 in rng.sample(COUNTRIES, cfg["neighbors"])] if cfg["neighbors"] else []
    if family == "surplus_midi" and not nbs:
        nbs = [("DE", 1, 2)]
    shapes: dict[str, dict[str, Any]] = {}
    if cfg["tall"]:
        shapes["C"] = {"len": [3, 4], "height": [1, 2]}
    if cfg["ramp"]:
        widths = RAMP_WIDTHS["stair"] if cfg["ramp"] == "stair" else RAMP_WIDTHS["trap", n]
        shapes["C"] = {"len": widths, "shape": cfg["ramp"]}
    pieces = cfg["pieces"]
    if (cfg["tall"] or cfg["ramp"]) and "C" not in pieces:
        pieces = "".join(sorted(set(pieces + "C"), key="NBCGT".index))
    residual = [demand[c] - r[c] - f[c] for c in range(n)]
    stock = {"B": cfg["stock"]} if cfg["stock"] and "B" in pieces else None
    d = make_draft(
        residual,
        pieces,
        neighbors=nbs,
        step=cfg["step"],
        weather_r=r,
        f=f[0],
        shapes=shapes,
        max_cells=stock,
        gid=1,
        title="Candidate",
    )
    exports = {k: rng.randint(0, 2) for k, _c, _o in nbs} if nbs and rng.random() < 0.6 else None
    require = (f"ramp_{cfg['ramp']}",) if cfg["ramp"] else ("tall",) if cfg["tall"] else ()
    # Ramps: a bonus per ramp cell draws wider ramps, and sometimes two ramps relaying each other (C5).
    bonus = rng.choice([0, 100, 200, 300]) if cfg["ramp"] else 0
    count = rng.choice([1, 1, 2]) if cfg["ramp"] else 1
    cost = rng.choice([3, 4, 6, 6])
    holes = cfg["hole_types"]
    nuclear_cap = round(rng.uniform(*cfg["max_nuclear"]), 2) if cfg["max_nuclear"] else None
    if nuclear_cap is not None:
        info["nuclear_cap"] = nuclear_cap

    def reference(ex: dict[str, int] | None, fallback: bool = True) -> dict[str, Any] | None:
        """Merit-order reference, two ramps first when drawn; `fallback`: without the exports if they fail."""
        for cnt in sorted({count, 1}, reverse=True):
            out = solve_reference(
                d,
                rng,
                exports=ex,
                import_cost=cost,
                require=require,
                min_count=cnt,
                ramp_bonus=bonus,
                hole_types=holes,
                max_nuclear=nuclear_cap,
            )
            if out is None and ex and fallback:
                out = solve_reference(
                    d,
                    rng,
                    import_cost=6,
                    require=require,
                    min_count=cnt,
                    ramp_bonus=bonus,
                    hole_types=holes,
                    max_nuclear=nuclear_cap,
                )
            if out is not None:
                return out
        return None

    sol = reference(exports)
    if sol is None:
        return None, "infeasible", info
    if cfg["neighbors"] and not _live(sol):
        # An entry with neighbors keeps at least one (v3g3 A): a reference trading with none of them is solved
        # again with one export imposed; if none holds, the draw is the reject `dead_neighbors`, never a grid
        # without neighbor filed under an entry that has some.
        k = rng.choice([nb["id"] for nb in d["neighbors"]])
        sol = next((x for v in rng.sample([1, 2], 2) if (x := reference({k: v}, fallback=False))), None)
        if sol is None:
            return None, "dead_neighbors", info
    # Dead mechanic (C1): a neighbor the reference never trades with is dropped before the clue selection.
    live = _live(sol)
    cleaned: dict[str, Any] = {}
    dead = [nb["id"] for nb in d["neighbors"] if nb["id"] not in live]
    if dead:
        d["neighbors"] = [nb for nb in d["neighbors"] if nb["id"] in live]
        cleaned["neighbors"] = dead
    if cfg["co2_cap"] == "auto":
        d["solution"] = sol
        comp = reference_composition(d)
        co2 = {**{k: v["co2"] for k, v in d["pieces"].items()}, **{f"I:{nb['id']}": nb["co2"] for nb in d["neighbors"]}}
        d["co2_cap"] = sum(co2[k] * v for col in comp["cells"] for k, v in col.items())
        if d["co2_cap"] == 0:
            return None, "trivial", info  # a cap of 0 says nothing the player cannot see at once
    elif cfg["co2_cap"] is not None:
        d["co2_cap"] = cfg["co2_cap"]
    d["solution"] = sol
    fill_inventory(d, cfg["inventory"])
    d["clues"] = []
    comp = reference_composition(d)
    keys = {k for col in comp["cells"] for k in col}
    if len(keys) <= 1 and not any(any(v) for v in comp["exports"].values()) and not sol["step"]:
        return None, "trivial", info
    if len({p["piece"] for p in sol["placements"] if p["piece"] != "I"}) < 2 and not cfg["allow_one_plant"]:
        return None, "one_plant", info  # imports cheaper than every plant but one: nothing to dispatch
    types = tuple(t for t in cfg["clue_types"] if t != "exchanges" or cfg["inventory"] == "none")
    max_clues = cfg["max_clues"] if cfg["max_clues"] is not None else n
    pool = clue_pool(d, types)
    seed_clues = demand_prices(d, pool) if cfg["demand_price"] else []
    seed_clues = [rng.choice(seed_clues)] if seed_clues else []
    clues = select_clues(d, pool, max_level=aim, max_clues=max_clues, rng=rng if explore else None, seed=seed_clues)
    if clues is None:
        return None, "too_many_clues", info
    d["clues"] = clues
    ex = exact.count(d)
    if ex.count != 1 or ex.composition != reference_composition(d):
        return None, "not_unique", info
    res = deduce(d)
    if not res.solved:
        return None, "blocked", info
    if d.get("co2_cap") is not None and not any(s.rule == "carbon" for s in res.steps):
        # Dead mechanic (C1): a CO2 cap no step uses is dropped; the grid is checked again without it.
        cleaned["co2_cap"] = d["co2_cap"]
        d["co2_cap"] = None
        ex = exact.count(d)
        if ex.count != 1 or ex.composition != reference_composition(d):
            return None, "not_unique", info
        res = deduce(d)
        if not res.solved:
            return None, "blocked", info
    dec = decisions(d, res.steps)
    if sum(dec.values()) < cfg["min_decisions"]:
        return None, "no_decision", info
    if cfg["rating"] is not None and res.rating != cfg["rating"]:
        return None, "rating_mismatch", info
    d["difficulty"] = {"rating": res.rating, "label": LABELS[res.rating], "techniques": sorted(res.techniques())}
    bulletin = make_bulletin(d, family, rng)
    d["title"] = bulletin["title"]
    summary = res.summary()
    d["lab"] = {
        "seed": seed,
        "aim": aim,
        "family": family,
        "mechanics": mechanics(d),
        "clue_profile": sorted({c["type"] for c in clues}),
        "trace_summary": summary,
        "ramp_techniques": {k: v for k, v in summary["techniques"].items() if k in RAMP_RULES},
        "ramp_settled_by": ramp_settled_by(d, res.steps),
        "decisions": dec,
        "live_mechanics": live_mechanics(dec),
        "coupled_globals": res.coupled_globals,
        "compactness": compactness(d, dec),
        **filling_measures(d, dec),
        "holes": hole_measures(d),
        "demand_prices": len(demand_prices(d, clues)),
        "bars": sum(1 for p in sol["placements"] if p["piece"] != "I"),
        "nuclear_prices": sum(1 for c in clues if c["type"] == "price" and c["piece"] == "N")
        if d["inventory"]["level"] == "none"
        else 0,
        "cleaned": cleaned,
        **({"nuclear_cap": nuclear_cap} if nuclear_cap is not None else {}),
        "bulletin": bulletin,
        "generator": f"dispatch-solver {__version__}",
        "seconds": round(time.perf_counter() - t0, 2),
    }
    errors = validate(d, allow_ramp=bool(cfg["ramp"]))
    if errors:
        return None, "invalid: " + "; ".join(errors), info
    return d, None, info


def _live(sol: dict[str, Any]) -> set[str]:
    """Neighbors the reference trades with (an export or an import bar)."""
    return set(sol["exports"]) | {p["country"] for p in sol["placements"] if p["piece"] == "I"}


def _attempt(
    args: tuple[dict[str, Any], int, int | None],
) -> tuple[dict[str, Any] | None, str | None, dict[str, Any]]:
    """One draw in a worker process; any error is a named reject, it never stops the lot."""
    cfg, seed, aim = args
    exact.NUM_WORKERS = 1

    def expire(_signum: int, _frame: Any) -> None:
        raise TimeoutError(f"draw longer than {ATTEMPT_SECONDS} s")

    timed = ATTEMPT_SECONDS and hasattr(signal, "SIGALRM")
    if timed:
        signal.signal(signal.SIGALRM, expire)
        signal.alarm(ATTEMPT_SECONDS)
        faulthandler.dump_traceback_later(ATTEMPT_SECONDS + 30)
    try:
        return make_candidate(cfg, seed, aim)
    except TimeoutError as exc:
        return None, "timeout", {"seed": seed, "family": cfg.get("family", "any"), "error": str(exc)}
    except Exception as exc:  # noqa: BLE001 - one bad draw must not lose the lot
        family = "surplus_midi" if cfg.get("surplus") else cfg.get("family", "any")  # as drawn, before draw_day
        return None, f"error:{type(exc).__name__}", {"seed": seed, "family": family, "error": str(exc)[:200]}
    finally:
        if timed:
            signal.alarm(0)
            faulthandler.cancel_dump_traceback_later()


def _signatures(g: dict[str, Any]) -> set[tuple[Any, ...]]:
    """Duplicate keys: residual up to a vertical shift with the same plants and weather, and the composition.

    The weather profile is part of the shape key: weather cells are fixed bricks, so two days with the same
    residual but different weather steps are different puzzles.
    """
    n = len(g["columns"])
    weather = tuple(g["weather"]["R"][c] + g["weather"]["F"][c] for c in range(n))
    res = [g["demand"][c] - weather[c] for c in range(n)]
    low = min(res)
    comp = reference_composition(g) if g.get("solution", {}).get("placements") else None
    out = {("shape", tuple(x - low for x in res), weather, tuple(sorted(g["pieces"])))}
    if comp is not None:
        out.add(("comp", json.dumps(comp, sort_keys=True)))
    return out


def _type_key(key: Any) -> bool:
    """A type quota key: one decision type (or "coupled"), "a+b" (all of them) or "a|b" (any of them)."""
    if not isinstance(key, str) or ("+" in key and "|" in key):
        return False
    return all(t in QUOTA_TYPES for t in re.split(r"[+|]", key))


def key_matches(key: str, kinds: set[str]) -> bool:
    """Whether a grid (or a mix entry) holding the decision types `kinds` counts for a type quota key."""
    if "|" in key:
        return any(t in kinds for t in key.split("|"))
    return all(t in kinds for t in key.split("+"))


def decision_types(lab: dict[str, Any]) -> set[str]:
    """Decision types present in a grid (count > 0), plus "coupled" when a global mechanic is coupled."""
    out = {k for k, v in lab.get("decisions", {}).items() if v}
    if lab.get("coupled_globals"):
        out.add(COUPLED)
    return out


def config_types(cfg: dict[str, Any]) -> set[str]:
    """Decision types a mix entry can produce (its mechanics); price is left out, never aimed at."""
    out = set()
    if cfg.get("neighbors") or cfg.get("surplus"):
        out.add("exchange")
    if cfg.get("step"):
        out.add("step")
    if cfg.get("tall"):
        out.add("tall")
    if cfg.get("ramp"):
        out.add("ramp")
    if cfg.get("co2_cap") is not None:
        out.add("carbon")
    if cfg.get("stock"):
        out.add("stock")
    if out & {"step", "carbon"} and "exchange" in out:
        out.add(COUPLED)
    return out


def single_decision_type(lab: dict[str, Any]) -> str | None:
    """The decision type of a grid whose decisions are all of one type, else None (none, or several types)."""
    kinds = [k for k, v in lab.get("decisions", {}).items() if v]
    return kinds[0] if len(kinds) == 1 else None


class Quotas:
    def __init__(self, size: int, q: dict[str, int], mixes: int = 0) -> None:
        self.size, self.q = size, {**QUOTAS, **{QUOTA_ALIASES.get(k, k): v for k, v in q.items()}}
        self.mixes = mixes
        self.mix: dict[int, int] = {}
        self.cols: dict[int, int] = {}
        self.family: dict[str, int] = {}
        self.mech: dict[tuple[str, ...], int] = {}
        self.profile: dict[tuple[str, ...], int] = {}
        self.rating: dict[int, int] = {}
        self.single: dict[str, int] = {}
        self.with_type: dict[str, int] = {}
        self.demand = 0  # grids with a demand price (D7)
        self.contested = 0  # Moyen-and-up grids with a contested hole
        self.seen: set[tuple[Any, ...]] = set()
        self.titles: set[str] = set()
        self.kept = 0

    def check(self, g: dict[str, Any]) -> str | None:
        lab = g["lab"]
        if _signatures(g) & self.seen:
            return "duplicate"
        r = g["difficulty"]["rating"]
        cap_f = self.q["filler_cells"]
        if cap_f is not None and r >= 3 and lab.get("cells", 0) >= cap_f:
            return "filler"
        m = lab.get("mix", -1)
        need_m = self.q["min_per_mix"]
        missing_r = sum(max(0, self.need(x) - self.rating.get(x, 0)) for x in (1, 2, 3, 4) if x != r)
        missing_m = sum(max(0, need_m - self.mix.get(x, 0)) for x in range(self.mixes) if x != m)
        left = self.size - self.kept - 1
        kinds = self.keys(decision_types(lab))
        # A mix entry still under its minimum when only reserved slots remain wins over the diversity quotas.
        last_call = 0 <= m < self.mixes and self.mix.get(m, 0) < need_m and left <= max(missing_r, missing_m)
        if not last_call:
            if self.family.get(lab["family"], 0) >= self.q["max_same_family"]:
                return "quota:family"
            if self.mech.get(tuple(lab["mechanics"]), 0) >= self.q["max_same_mechanics"]:
                return "quota:mechanics"
            if self.profile.get(tuple(lab["clue_profile"]), 0) >= self.q["max_same_clue_profile"]:
                return "quota:clue_profile"
            one = single_decision_type(lab)
            cap = self.q["max_same_single_decision"]
            if one is not None and cap is not None and self.single.get(one, 0) >= cap:
                return "quota:single_decision"
            if any(self.with_type.get(t, 0) >= n for t, n in self.q["max_with_type"].items() if t in kinds):
                return "quota:with_type"
            cap_d = self.q["max_demand_price"]
            if lab.get("demand_prices") and cap_d is not None and self.demand >= cap_d:
                return "quota:demand_price"
            cap_n = self.q["max_with_cols"].get(len(g["columns"]))
            if cap_n is not None and self.cols.get(len(g["columns"]), 0) >= cap_n:
                return "quota:cols"
        # Near-twins (v3g3 B): no mix entry gives more than max_per_mix grids, even at the end of the lot.
        cap_m = self.q["max_per_mix"]
        if cap_m is not None and m >= 0 and self.mix.get(m, 0) >= cap_m:
            return "quota:per_mix"
        # Reserve the slots still needed for the minimum per rating and per mix entry.
        if left < missing_r and self.rating.get(r, 0) >= self.need(r):
            return "quota:rating"
        # Notation A: a Difficile or an Expert holds a coupled global mechanic. Under a "coupled" ceiling, a
        # coupled grid that fills no missing hard rating must leave room for the hard ratings still missing.
        cap_c = self.q["max_with_type"].get(COUPLED)
        if cap_c is not None and COUPLED in kinds and not (r >= 3 and self.rating.get(r, 0) < self.need(r)):
            hard = sum(max(0, self.need(x) - self.rating.get(x, 0)) for x in (3, 4))
            if cap_c - self.with_type.get(COUPLED, 0) - 1 < hard:
                return "quota:rating"
        if left < missing_r + missing_m and self.rating.get(r, 0) >= self.need(r) and self.mix.get(m, 0) >= need_m:
            return "quota:mix"
        # Floors per decision type, reserved jointly with the ratings (a grid may fill a rating and types at
        # once): once the deficits fit in the slots left, a grid must keep them fitting; before, it must
        # reduce them. Separate reservations let the last slot need a rare pair (a Difficile with stock).
        if self.q["min_with_type"]:
            r_now = sum(max(0, self.need(x) - self.rating.get(x, 0)) for x in (1, 2, 3, 4))
            r_after = r_now - (self.rating.get(r, 0) < self.need(r))
            t_now = self.type_deficit()
            t_after = t_now - len(kinds & set(self.missing_types()))
            d_now, d_after = r_now + t_now, r_after + t_after
            if d_after > left and (d_now <= left + 1 or d_after >= d_now):
                return "quota:type_floor" if t_after == t_now else "quota:rating"
        return None

    def keys(self, kinds: set[str]) -> set[str]:
        """Decision types, plus the combined quota keys ("step+carbon", "step|carbon") they match."""
        combined = {k for q in TYPE_QUOTAS for k in self.q[q] if not k.isalpha()}
        return kinds | {k for k in combined if key_matches(k, kinds)}

    def missing_types(self) -> list[str]:
        return [t for t, n in self.q["min_with_type"].items() if self.with_type.get(t, 0) < n]

    def capped_types(self) -> list[str]:
        return [t for t, n in self.q["max_with_type"].items() if self.with_type.get(t, 0) >= n]

    def type_deficit(self) -> int:
        return sum(max(0, n - self.with_type.get(t, 0)) for t, n in self.q["min_with_type"].items())

    def missing_ratings(self) -> list[int]:
        return [x for x in (1, 2, 3, 4) if self.rating.get(x, 0) < self.need(x)]

    def need(self, rating: int) -> int:
        """Minimum of grids of a rating: min_per_rating is one number for all, or {rating: n} (others: 2)."""
        v = self.q["min_per_rating"]
        return v.get(rating, QUOTAS["min_per_rating"]) if isinstance(v, dict) else v

    def add(self, g: dict[str, Any]) -> None:
        lab = g["lab"]
        self.seen |= _signatures(g)
        self.titles.add(g.get("title", ""))
        self.family[lab["family"]] = self.family.get(lab["family"], 0) + 1
        self.mech[tuple(lab["mechanics"])] = self.mech.get(tuple(lab["mechanics"]), 0) + 1
        self.profile[tuple(lab["clue_profile"])] = self.profile.get(tuple(lab["clue_profile"]), 0) + 1
        one = single_decision_type(lab)
        if one is not None:
            self.single[one] = self.single.get(one, 0) + 1
        for t in self.keys(decision_types(lab)):
            self.with_type[t] = self.with_type.get(t, 0) + 1
        if lab.get("demand_prices"):
            self.demand += 1
        r = g["difficulty"]["rating"]
        self.rating[r] = self.rating.get(r, 0) + 1
        self.mix[lab.get("mix", -1)] = self.mix.get(lab.get("mix", -1), 0) + 1
        self.cols[len(g["columns"])] = self.cols.get(len(g["columns"]), 0) + 1
        if r >= 2 and lab.get("holes", {}).get("contested"):
            self.contested += 1
        self.kept += 1

    def short_contested(self) -> bool:
        target = self.q["min_with_contested"]
        return target is not None and self.contested < target

    def holds(self, g: dict[str, Any]) -> bool:
        """Contested holes weigh twice (soft quota min_with_contested): while it is short, a Moyen-and-up grid
        without one waits, one time in two (coin of its seed), until the quota is met or the draws run out."""
        lab = g["lab"]
        if not self.short_contested() or g["difficulty"]["rating"] < 2 or lab.get("holes", {}).get("contested"):
            return False
        return random.Random(lab["seed"]).random() < 0.5


def _draw(
    rng: random.Random, mix: list[dict[str, Any]], weights: list[float], quotas: Quotas
) -> tuple[dict[str, Any], int, int, int]:
    """(config, seed, mix index, aim) of the next attempt, oriented to what the lot still misses."""
    # Entries still under their minimum, or able to give a decision type still under its floor, are drawn five
    # times more often; entries that give a type already at its ceiling, five times less.
    need = quotas.q["min_per_mix"]
    missing, capped = set(quotas.missing_types()), set(quotas.capped_types())
    hard = {3, 4} & set(quotas.missing_ratings())
    if hard and COUPLED not in capped:
        missing.add(COUPLED)  # notation A: Difficile and Expert need a global mechanic coupled to an exchange
    boosted = []
    for j, w in enumerate(weights):
        kinds = quotas.keys(config_types(mix[j]))
        w *= 5 if quotas.mix.get(j, 0) < need else 1
        w *= 5 if kinds & missing else 1
        w /= 5 if kinds & capped else 1
        # Entries at their max_per_mix, or whose slot count is at its ceiling, are almost never drawn.
        cap_m, cap_n = quotas.q["max_per_mix"], quotas.q["max_with_cols"].get(mix[j].get("cols", DEFAULTS["cols"]))
        w /= 25 if cap_m is not None and quotas.mix.get(j, 0) >= cap_m else 1
        w /= 25 if cap_n is not None and quotas.cols.get(mix[j].get("cols", DEFAULTS["cols"]), 0) >= cap_n else 1
        w *= 5 if 4 in hard and {"step", "carbon", "exchange"} <= kinds else 1  # an Expert needs both, coupled
        boosted.append(w)
    i = rng.choices(range(len(mix)), boosted)[0]
    cfg = {k: v for k, v in mix[i].items() if k != "weight"}
    if cfg.get("family", "any") == "any" and not cfg.get("surplus"):
        # Draw among the families still under their quota, the least used first.
        room = [f for f in FAMILIES if quotas.family.get(f, 0) < quotas.q["max_same_family"]]
        if room:
            low = min(quotas.family.get(f, 0) for f in room)
            cfg["family"] = rng.choice([f for f in room if quotas.family.get(f, 0) == low])
    # Rating lever (C4): aim at a missing rating most of the time, else at any level.
    missing = quotas.missing_ratings()
    aim = rng.choice(missing) if missing and rng.random() < 0.7 else rng.choice([1, 2, 2, 3, 4])
    if aim >= 3:
        # Measured recipe for levels 3-4: exact inventory, no price clue (unless the entry says). A CO2 cap or a
        # dam stock keeps its free inventory: in an exact one, it is dead.
        if "inventory" not in mix[i] and mix[i].get("co2_cap") is None and not mix[i].get("stock"):
            cfg["inventory"] = "exact"
        if "clue_types" not in mix[i]:
            cfg["clue_types"] = [t for t in DEFAULTS["clue_types"] if t != "price"]
    cap_d = quotas.q["max_demand_price"]
    if cap_d is not None and "demand_price" not in mix[i] and quotas.demand < cap_d and rng.random() < 0.5:
        cfg["demand_price"] = True
    return cfg, rng.randint(0, 10**9), i, aim


def run_lot(lot: dict[str, Any], workers: int = 6, log: Any = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Fill a lot: {"lot", "size", "seed", "mix": [{"weight", ...config}], "quotas", "max_attempts"}.

    Raises ValueError with every problem of the lot before the first draw (see check_lot).
    """
    lot, errors = check_lot(lot)
    if errors:
        raise ValueError("invalid lot: " + "; ".join(errors))
    t0 = time.perf_counter()
    rng = random.Random(lot.get("seed", 1))
    size = lot["size"]
    mix = lot["mix"]
    weights = [m.get("weight", 1) for m in mix]
    quotas = Quotas(size, lot.get("quotas", {}), len(mix))
    max_attempts = lot.get("max_attempts", size * 15)
    kept: list[dict[str, Any]] = []
    reserve: list[dict[str, Any]] = []  # finished grids refused only by the rating / mix reservation
    blocked: list[dict[str, Any]] = []
    rejects: dict[str, int] = {}
    # family -> {"attempts": n, reject reason: n}: generator rejects only (infeasible, one_plant, trivial, too_many_clues…).
    # Quota rejects are not counted, nor the draws cancelled when the lot fills up, so its attempts sum to less than
    # `attempts`. A draw that raised before its day was drawn is filed under its configured family ("any" if none).
    by_family: dict[str, dict[str, int]] = {}
    errors_seen: list[dict[str, Any]] = []
    attempts = 0

    def accept(g: dict[str, Any]) -> None:
        if g.get("title") in quotas.titles:
            b = make_bulletin(g, g["lab"]["family"], random.Random(g["lab"]["seed"]), avoid=quotas.titles)
            g["lab"]["bulletin"], g["title"] = b, b["title"]
        g["lab"].update(lot=lot["lot"], index=len(kept))
        g["id"] = len(kept) + 1
        quotas.add(g)
        kept.append(g)
        if log:
            log(
                f"kept {len(kept)}/{size}: {g['lab']['family']} {g['lab']['mechanics']} "
                f"rating {g['difficulty']['rating']} (aim {g['lab']['aim']}) clues {len(g['clues'])} "
                f"{g['lab']['seconds']}s; missing ratings {quotas.missing_ratings()} types {quotas.missing_types()}"
            )

    held: list[dict[str, Any]] = []  # Moyen-and-up grids without a contested hole, waiting (min_with_contested)
    n_held = 0

    def drain(final: bool = False) -> None:
        """Accept the reserve grids a filled slot frees, then the held grids once the contested quota is met."""
        for pool_ in (reserve, held):
            if pool_ is held and quotas.short_contested() and not final:
                break
            for h in list(pool_):
                if len(kept) < size and quotas.check(h) is None:
                    pool_.remove(h)
                    accept(h)

    pending: deque[tuple[Future, dict[str, Any], int, int]] = deque()
    stuck = done = 0
    pool = ProcessPoolExecutor(max_workers=workers)
    try:
        while len(kept) < size and (pending or attempts < max_attempts):
            while len(pending) < workers * 2 and attempts < max_attempts:
                cfg, seed, mi, aim = _draw(rng, mix, weights, quotas)
                pending.append((pool.submit(_attempt, (cfg, seed, aim)), cfg, seed, mi))
                attempts += 1
            fut, cfg, seed, mi = pending.popleft()  # accepted in draw order: same lot for the same seed
            try:
                g, reason, info = fut.result(timeout=HEAD_SECONDS if ATTEMPT_SECONDS else None)
            except FutureTimeout:
                stuck += 1
                g, reason = None, "timeout"
                info = {"seed": seed, "family": cfg.get("family", "any"), "error": f"no result after {HEAD_SECONDS} s"}
            done += 1
            if log and done % 50 == 0:
                log(f"progress: {done} draws done, {len(kept)}/{size} kept, rejects {dict(sorted(rejects.items()))}")
            fam = by_family.setdefault(info.get("family", "?"), {"attempts": 0})
            fam["attempts"] += 1
            if reason is not None:
                fkey = reason.split(":")[0] if reason.startswith(("invalid", "error")) else reason
                fam[fkey] = fam.get(fkey, 0) + 1
            if g is not None:
                g["lab"]["mix"] = mi
                reason = quotas.check(g)
                if reason in ("quota:rating", "quota:mix", "quota:type_floor"):
                    reserve.append(g)
                elif reason is None and len(kept) < size and quotas.holds(g):
                    held.append(g)
                    n_held += 1
                    reason = "held"
            if reason is None and len(kept) < size:
                accept(g)
                drain()
            elif reason is not None and reason != "held":
                key = reason.split(":")[0] if reason.startswith(("invalid", "error")) else reason
                rejects[key] = rejects.get(key, 0) + 1
                if reason.startswith(("error", "timeout")) and len(errors_seen) < 20:
                    errors_seen.append({"config": cfg, "seed": seed, "error": f"{reason}: {info.get('error')}"})
                if reason == "blocked" and info.get("grid") is not None:
                    blocked.append({"config": cfg, "seed": seed, "grid": info["grid"]})
        drain(final=True)  # the draws ran out: held grids still fill the lot
    finally:
        for fut, *_ in pending:
            fut.cancel()
        procs = list((pool._processes or {}).values())  # no public way to stop a stuck worker
        pool.shutdown(wait=not stuck, cancel_futures=True)
        if stuck:
            for proc in procs:
                proc.terminate()
    ramp = [g for g in kept if any(m.startswith("ramp:") for m in g["lab"]["mechanics"])]
    stats = {
        "lot": lot["lot"],
        "kept": len(kept),
        "size": size,
        "attempts": attempts,
        "rejects": rejects,
        "rejects_by_family": dict(sorted(by_family.items())),
        "ratings": {LABELS[r]: quotas.rating.get(r, 0) for r in (1, 2, 3, 4)},
        "families": quotas.family,
        "per_mix": {str(k): v for k, v in sorted(quotas.mix.items())},
        "mechanics": {" ".join(k): v for k, v in quotas.mech.items()},
        "clue_profiles": {" ".join(k): v for k, v in quotas.profile.items()},
        "decisions": {
            "by_type": {t: sum(g["lab"]["decisions"].get(t, 0) for g in kept) for t in DECISION_TYPES},
            "grids_with_type": {t: sum(1 for g in kept if g["lab"]["decisions"].get(t)) for t in DECISION_TYPES},
            "single_type": dict(sorted(quotas.single.items())),
            "type_quotas": {k: quotas.q[k] for k in TYPE_QUOTAS if quotas.q[k]},
            "grids_with_key": dict(sorted(quotas.with_type.items())),
            "coupled_globals": {
                "grids": sum(1 for g in kept if g["lab"]["coupled_globals"]),
                "step": sum(1 for g in kept if "step" in g["lab"]["coupled_globals"]),
                "carbon": sum(1 for g in kept if "carbon" in g["lab"]["coupled_globals"]),
            },
            "per_grid": dict(
                sorted(
                    {
                        n: sum(1 for g in kept if sum(g["lab"]["decisions"].values()) == n)
                        for n in {sum(g["lab"]["decisions"].values()) for g in kept}
                    }.items()
                )
            ),
            "live_mechanics": dict(
                sorted(
                    {
                        n: sum(1 for g in kept if len(g["lab"]["live_mechanics"]) == n)
                        for n in {len(g["lab"]["live_mechanics"]) for g in kept}
                    }.items()
                )
            ),
        },
        "demand_price_grids": quotas.demand,
        "contested_quota": {
            "min_with_contested": quotas.q["min_with_contested"],
            "medium_up_with_contested": quotas.contested,
            "held": n_held,
            "held_left_out": len(held),
        },
        "compactness": _spread([g["lab"]["compactness"] for g in kept]),
        **lot_measures(kept),
        "cleaned": {
            "neighbors": sum(len(g["lab"]["cleaned"].get("neighbors", [])) for g in kept),
            "co2_cap": sum(1 for g in kept if "co2_cap" in g["lab"]["cleaned"]),
        },
        "ramp_grids": len(ramp),
        "ramp_grids_with_technique": sum(1 for g in ramp if g["lab"]["ramp_techniques"]),
        "ramp_grids_with_own_technique": sum(1 for g in ramp if set(g["lab"]["ramp_techniques"]) & set(RAMP_OWN)),
        "ramp_techniques": dict(
            sorted({k: sum(g["lab"]["ramp_techniques"].get(k, 0) for g in ramp) for k in RAMP_RULES}.items())
        ),
        "ramp_settled_by": _merge([g["lab"].get("ramp_settled_by", {}) for g in ramp]),
        "ramp_relays": sum(1 for g in ramp if sum(1 for p in g["solution"]["placements"] if p["piece"] == "C") >= 2),
        "cols": {str(k): v for k, v in sorted(quotas.cols.items())},
        "seconds": round(time.perf_counter() - t0, 1),
        "seconds_per_kept_grid": round((time.perf_counter() - t0) / max(1, len(kept)), 1),
        "workers": workers,
        "generator": f"dispatch-solver {__version__}",
        "blocked_ramp": len(blocked),
        "errors": errors_seen,
    }
    return kept, {"stats": stats, "blocked": copy.deepcopy(blocked)}


def _merge(counts: list[dict[str, int]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for c in counts:
        for k, v in c.items():
            out[k] = out.get(k, 0) + v
    return dict(sorted(out.items()))


def _spread(values: list[float]) -> dict[str, float]:
    """Median, min and max of a measure (empty lot: {})."""
    if not values:
        return {}
    v = sorted(values)
    mid = len(v) // 2
    median = v[mid] if len(v) % 2 else (v[mid - 1] + v[mid]) / 2
    return {"median": round(median, 2), "min": v[0], "max": v[-1]}
