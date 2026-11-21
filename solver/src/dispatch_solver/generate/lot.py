"""Generator: one candidate grid from a configuration, and lots with imposed diversity (§10).

- Config (one entry of a lot's `mix`): cols, family, height, pieces, tall, ramp, neighbors, step, surplus,
  co2_cap, stock, inventory, clue_types, rating, max_clues. See DEFAULTS; check_lot() refuses unknown
  keys and bad values before any draw.
- make_candidate(): draw a day, solve the reference (merit order; ramps of drawn widths, sometimes two),
  write the inventory, select the minimal clues up to an aimed technique level, check one composition
  (CP-SAT) and the deduction, rate it, write the bulletin draft and the `lab` block.
- run_lot(): keeps the worker processes busy (rolling queue), accepts in draw order under the quotas
  (silhouette family, mechanics, clue profile, minimum per rating and per mix entry). Draws aim at the
  ratings still missing; finished grids refused by the rating reservation wait in a reserve.

Example: grids, stats = run_lot(json.load(open("lab/lots/demo-01.json")))
"""

from __future__ import annotations

import copy
import json
import random
import re
import time
from collections import deque
from concurrent.futures import Future, ProcessPoolExecutor
from typing import Any

from .. import __version__, exact
from ..board import reference_composition
from ..deduce import deduce
from ..deduce.trace import RAMP_RULES
from ..grid import LABELS, validate
from .bulletin import make_bulletin
from .cluesel import clue_pool, select_clues
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
}
COLUMN_COUNTS = (6, 8, 12)
COUNTRIES = [("DE", 2), ("ES", 0), ("UK", 1), ("IT", 2), ("BE", 1)]
QUOTAS = {
    "max_same_family": 3,
    "max_same_mechanics": 4,
    "max_same_clue_profile": 4,
    "min_per_rating": 2,
    "min_per_mix": 1,
}
QUOTA_ALIASES = {"max_same_silhouette": "max_same_family"}
LOT_KEYS = ("lot", "size", "seed", "mix", "quotas", "max_attempts", "comment")
CLUE_TYPES = ("price", "column", "flow", "bar", "length", "exchanges")
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
    norm_q: dict[str, int] = {}
    for k, v in quotas.items():
        key = QUOTA_ALIASES.get(k, k)
        if key not in QUOTAS:
            errors.append(f"quotas: unknown key {k!r} (expected one of {', '.join(QUOTAS)})")
        elif not _nat(v):
            errors.append(f"quotas.{k}: integer >= 0 expected")
        else:
            norm_q[key] = v
    out["quotas"] = norm_q
    mix = lot.get("mix")
    if not isinstance(mix, list) or not mix:
        errors.append("mix: non-empty list of configurations expected")
        mix = []
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
    sol = None
    for cnt in sorted({count, 1}, reverse=True):
        sol = solve_reference(
            d, rng, exports=exports, import_cost=cost, require=require, min_count=cnt, ramp_bonus=bonus
        )
        if sol is None and exports:
            sol = solve_reference(d, rng, import_cost=6, require=require, min_count=cnt, ramp_bonus=bonus)
        if sol is not None:
            break
    if sol is None:
        return None, "infeasible", info
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
    if len({p["piece"] for p in sol["placements"] if p["piece"] != "I"}) < 2:
        return None, "one_plant", info  # imports cheaper than every plant but one: nothing to dispatch
    types = tuple(t for t in cfg["clue_types"] if t != "exchanges" or cfg["inventory"] == "none")
    max_clues = cfg["max_clues"] if cfg["max_clues"] is not None else n
    pool = clue_pool(d, types)
    clues = select_clues(d, pool, max_level=aim, max_clues=max_clues, rng=rng if explore else None)
    if clues is None:
        return None, "too_many_clues", info
    d["clues"] = clues
    ex = exact.count(d)
    if ex.count != 1 or ex.composition != reference_composition(d):
        return None, "not_unique", info
    res = deduce(d)
    if not res.solved:
        return None, "blocked", info
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
        "bulletin": bulletin,
        "generator": f"dispatch-solver {__version__}",
        "seconds": round(time.perf_counter() - t0, 2),
    }
    errors = validate(d, allow_ramp=bool(cfg["ramp"]))
    if errors:
        return None, "invalid: " + "; ".join(errors), info
    return d, None, info


def _attempt(
    args: tuple[dict[str, Any], int, int | None],
) -> tuple[dict[str, Any] | None, str | None, dict[str, Any]]:
    """One draw in a worker process; any error is a named reject, it never stops the lot."""
    cfg, seed, aim = args
    exact.NUM_WORKERS = 1
    try:
        return make_candidate(cfg, seed, aim)
    except Exception as exc:  # noqa: BLE001 - one bad draw must not lose the lot
        return None, f"error:{type(exc).__name__}", {"seed": seed, "error": str(exc)[:200]}


def _signatures(g: dict[str, Any]) -> set[tuple[Any, ...]]:
    """Duplicate keys: residual up to a vertical shift with the same plants, and the composition."""
    res = [g["demand"][c] - g["weather"]["R"][c] - g["weather"]["F"][c] for c in range(len(g["columns"]))]
    low = min(res)
    comp = reference_composition(g) if g.get("solution", {}).get("placements") else None
    out = {("shape", tuple(x - low for x in res), tuple(sorted(g["pieces"])))}
    if comp is not None:
        out.add(("comp", json.dumps(comp, sort_keys=True)))
    return out


class Quotas:
    def __init__(self, size: int, q: dict[str, int], mixes: int = 0) -> None:
        self.size, self.q = size, {**QUOTAS, **{QUOTA_ALIASES.get(k, k): v for k, v in q.items()}}
        self.mixes = mixes
        self.mix: dict[int, int] = {}
        self.family: dict[str, int] = {}
        self.mech: dict[tuple[str, ...], int] = {}
        self.profile: dict[tuple[str, ...], int] = {}
        self.rating: dict[int, int] = {}
        self.seen: set[tuple[Any, ...]] = set()
        self.titles: set[str] = set()
        self.kept = 0

    def check(self, g: dict[str, Any]) -> str | None:
        lab = g["lab"]
        if _signatures(g) & self.seen:
            return "duplicate"
        r = g["difficulty"]["rating"]
        m = lab.get("mix", -1)
        need_r = self.q["min_per_rating"]
        need_m = self.q["min_per_mix"]
        missing_r = sum(max(0, need_r - self.rating.get(x, 0)) for x in (1, 2, 3, 4) if x != r)
        missing_m = sum(max(0, need_m - self.mix.get(x, 0)) for x in range(self.mixes) if x != m)
        left = self.size - self.kept - 1
        # A mix entry still under its minimum when only reserved slots remain wins over the diversity quotas.
        last_call = 0 <= m < self.mixes and self.mix.get(m, 0) < need_m and left <= max(missing_r, missing_m)
        if not last_call:
            if self.family.get(lab["family"], 0) >= self.q["max_same_family"]:
                return "quota:family"
            if self.mech.get(tuple(lab["mechanics"]), 0) >= self.q["max_same_mechanics"]:
                return "quota:mechanics"
            if self.profile.get(tuple(lab["clue_profile"]), 0) >= self.q["max_same_clue_profile"]:
                return "quota:clue_profile"
        # Reserve the slots still needed for the minimum per rating and per mix entry.
        if left < missing_r and self.rating.get(r, 0) >= need_r:
            return "quota:rating"
        if left < missing_r + missing_m and self.rating.get(r, 0) >= need_r and self.mix.get(m, 0) >= need_m:
            return "quota:mix"
        return None

    def missing_ratings(self) -> list[int]:
        return [x for x in (1, 2, 3, 4) if self.rating.get(x, 0) < self.q["min_per_rating"]]

    def add(self, g: dict[str, Any]) -> None:
        lab = g["lab"]
        self.seen |= _signatures(g)
        self.titles.add(g.get("title", ""))
        self.family[lab["family"]] = self.family.get(lab["family"], 0) + 1
        self.mech[tuple(lab["mechanics"])] = self.mech.get(tuple(lab["mechanics"]), 0) + 1
        self.profile[tuple(lab["clue_profile"])] = self.profile.get(tuple(lab["clue_profile"]), 0) + 1
        r = g["difficulty"]["rating"]
        self.rating[r] = self.rating.get(r, 0) + 1
        self.mix[lab.get("mix", -1)] = self.mix.get(lab.get("mix", -1), 0) + 1
        self.kept += 1


def _draw(
    rng: random.Random, mix: list[dict[str, Any]], weights: list[float], quotas: Quotas
) -> tuple[dict[str, Any], int, int, int]:
    """(config, seed, mix index, aim) of the next attempt, oriented to what the lot still misses."""
    # Entries still under their minimum are drawn five times more often.
    need = quotas.q["min_per_mix"]
    boosted = [w * (5 if quotas.mix.get(j, 0) < need else 1) for j, w in enumerate(weights)]
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
        # Measured recipe for Difficile / Expert: exact inventory, no price clue (unless the entry says).
        if "inventory" not in mix[i]:
            cfg["inventory"] = "exact"
        if "clue_types" not in mix[i]:
            cfg["clue_types"] = [t for t in DEFAULTS["clue_types"] if t != "price"]
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
                f"{g['lab']['seconds']}s"
            )

    pending: deque[tuple[Future, dict[str, Any], int, int]] = deque()
    with ProcessPoolExecutor(max_workers=workers) as pool:
        try:
            while len(kept) < size and (pending or attempts < max_attempts):
                while len(pending) < workers * 2 and attempts < max_attempts:
                    cfg, seed, mi, aim = _draw(rng, mix, weights, quotas)
                    pending.append((pool.submit(_attempt, (cfg, seed, aim)), cfg, seed, mi))
                    attempts += 1
                fut, cfg, seed, mi = pending.popleft()  # accepted in draw order: same lot for the same seed
                g, reason, info = fut.result()
                if g is not None:
                    g["lab"]["mix"] = mi
                    reason = quotas.check(g)
                    if reason in ("quota:rating", "quota:mix"):
                        reserve.append(g)
                if reason is None and len(kept) < size:
                    accept(g)
                    for h in list(reserve):  # a slot reserved for a rating may have been filled
                        if len(kept) < size and quotas.check(h) is None:
                            reserve.remove(h)
                            accept(h)
                elif reason is not None:
                    key = reason.split(":")[0] if reason.startswith(("invalid", "error")) else reason
                    rejects[key] = rejects.get(key, 0) + 1
                    if reason.startswith("error") and len(errors_seen) < 20:
                        errors_seen.append({"config": cfg, "seed": seed, "error": f"{reason}: {info.get('error')}"})
                    if reason == "blocked" and info.get("grid") is not None:
                        blocked.append({"config": cfg, "seed": seed, "grid": info["grid"]})
        finally:
            for fut, *_ in pending:
                fut.cancel()
    ramp = [g for g in kept if any(m.startswith("ramp:") for m in g["lab"]["mechanics"])]
    stats = {
        "lot": lot["lot"],
        "kept": len(kept),
        "size": size,
        "attempts": attempts,
        "rejects": rejects,
        "ratings": {LABELS[r]: quotas.rating.get(r, 0) for r in (1, 2, 3, 4)},
        "families": quotas.family,
        "per_mix": {str(k): v for k, v in sorted(quotas.mix.items())},
        "mechanics": {" ".join(k): v for k, v in quotas.mech.items()},
        "clue_profiles": {" ".join(k): v for k, v in quotas.profile.items()},
        "ramp_grids": len(ramp),
        "ramp_grids_with_technique": sum(1 for g in ramp if g["lab"]["ramp_techniques"]),
        "ramp_techniques": dict(
            sorted({k: sum(g["lab"]["ramp_techniques"].get(k, 0) for g in ramp) for k in RAMP_RULES}.items())
        ),
        "seconds": round(time.perf_counter() - t0, 1),
        "seconds_per_kept_grid": round((time.perf_counter() - t0) / max(1, len(kept)), 1),
        "workers": workers,
        "generator": f"dispatch-solver {__version__}",
        "blocked_ramp": len(blocked),
        "errors": errors_seen,
    }
    return kept, {"stats": stats, "blocked": copy.deepcopy(blocked)}
