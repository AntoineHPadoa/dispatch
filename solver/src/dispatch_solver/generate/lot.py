"""Generator: one candidate grid from a configuration, and lots with imposed diversity (§10).

- Config (one entry of a lot's `mix`): cols, family, height, pieces, tall, ramp, neighbors, step, surplus,
  co2_cap, stock, inventory, clue_types, rating, max_clues. See DEFAULTS.
- make_candidate(): draw a day, solve the reference (merit order), write the inventory, select the minimal
  clues, check one composition (CP-SAT) and the deduction, rate it, write the bulletin draft and the `lab`
  block. Returns (grid, None) or (None, reject reason).
- run_lot(): draws attempts in parallel processes, accepts them in attempt order under the quotas (C4:
  silhouette family, mechanics, clue profile, minimum per rating), until the lot is full.

Example: grids, stats = run_lot(json.load(open("lab/lots/demo-01.json")))
"""

from __future__ import annotations

import copy
import random
import time
from concurrent.futures import ProcessPoolExecutor
from typing import Any

from .. import __version__, exact
from ..board import reference_composition
from ..deduce import deduce
from ..grid import LABELS, validate
from .bulletin import make_bulletin
from .cluesel import clue_pool, mandatory_clues, select_clues
from .draft import make_draft
from .reference import fill_inventory, solve_reference
from .silhouettes import FAMILIES, draw_day

DEFAULTS: dict[str, Any] = {
    "cols": 8,
    "family": "any",
    "height": 6,
    "pieces": "NGT",
    "tall": None,
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


def make_candidate(cfg: dict[str, Any], seed: int) -> tuple[dict[str, Any] | None, str | None, dict[str, Any]]:
    """(grid, None, info) or (None, reject reason, info) for one attempt."""
    cfg = {**DEFAULTS, **cfg}
    rng = random.Random(seed)
    t0 = time.perf_counter()
    info: dict[str, Any] = {"seed": seed}
    n = cfg["cols"]
    if n not in COLUMN_COUNTS:
        raise ValueError(f"cols: one of {COLUMN_COUNTS} expected (slots of 4 h, 3 h or 2 h, §2)")
    family = cfg["family"]
    if cfg["surplus"]:
        family = "surplus_midi"
    family, demand, r, f = draw_day(rng, n, family, height=cfg["height"])
    info["family"] = family
    nbs = [(k, 1, co2) for k, co2 in rng.sample(COUNTRIES, cfg["neighbors"])] if cfg["neighbors"] else []
    if family == "surplus_midi" and not nbs:
        nbs = [("DE", 1, 2)]
    shapes: dict[str, dict[str, Any]] = {}
    if cfg["tall"]:
        shapes["C"] = {"len": [3, 4], "height": [1, 2]}
    if cfg["ramp"]:
        shapes["C"] = {"len": [3, 4, 5] if cfg["ramp"] == "trap" else [2, 3, 4], "shape": cfg["ramp"]}
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
    sol = solve_reference(d, rng, exports=exports, import_cost=rng.choice([3, 4, 6, 6]), require=require)
    if sol is None and exports:
        sol = solve_reference(d, rng, import_cost=6, require=require)
    if sol is None:
        return None, "infeasible", info
    if cfg["co2_cap"] == "auto":
        d["solution"] = sol
        comp = reference_composition(d)
        co2 = {**{k: v["co2"] for k, v in d["pieces"].items()}, **{f"I:{nb['id']}": nb["co2"] for nb in d["neighbors"]}}
        d["co2_cap"] = sum(co2[k] * v for col in comp["cells"] for k, v in col.items())
    elif cfg["co2_cap"] is not None:
        d["co2_cap"] = cfg["co2_cap"]
    d["solution"] = sol
    fill_inventory(d, cfg["inventory"])
    d["clues"] = []
    comp = reference_composition(d)
    keys = {k for col in comp["cells"] for k in col}
    if len(keys) <= 1 and not any(any(v) for v in comp["exports"].values()) and not sol["step"]:
        return None, "trivial", info
    types = tuple(t for t in cfg["clue_types"] if t != "exchanges" or cfg["inventory"] == "none")
    max_clues = cfg["max_clues"] if cfg["max_clues"] is not None else n
    pool = clue_pool(d, types)
    clues = select_clues(d, pool, max_clues=2 * n)
    if clues is None:
        full = {**d, "clues": mandatory_clues(d) + pool}
        if exact.count(full).count != 1:
            return None, "not_unique", info
        if not deduce(full, record=False).solved:
            return None, "blocked", {**info, "grid": full if cfg["ramp"] else None}
        return None, "too_many_clues", info
    d["clues"] = clues
    if len([c for c in clues if c not in mandatory_clues(d)]) > max_clues:
        return None, "too_many_clues", info
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
    d["lab"] = {
        "seed": seed,
        "family": family,
        "mechanics": mechanics(d),
        "clue_profile": sorted({c["type"] for c in clues}),
        "trace_summary": res.summary(),
        "bulletin": bulletin,
        "generator": f"dispatch-solver {__version__}",
        "seconds": round(time.perf_counter() - t0, 2),
    }
    errors = validate(d, allow_ramp=bool(cfg["ramp"]))
    if errors:
        return None, "invalid: " + "; ".join(errors), info
    return d, None, info


def _attempt(args: tuple[dict[str, Any], int]) -> tuple[dict[str, Any] | None, str | None, dict[str, Any]]:
    cfg, seed = args
    exact.NUM_WORKERS = 1
    try:
        return make_candidate(cfg, seed)
    except TimeoutError:
        return None, "timeout", {"seed": seed}


def _signature(g: dict[str, Any]) -> tuple[Any, ...]:
    res = [g["demand"][c] - g["weather"]["R"][c] - g["weather"]["F"][c] for c in range(len(g["columns"]))]
    return tuple(res), tuple(sorted(g["pieces"]))


class Quotas:
    def __init__(self, size: int, q: dict[str, int], mixes: int = 0) -> None:
        self.size, self.q = size, {**QUOTAS, **q}
        self.mixes = mixes
        self.mix: dict[int, int] = {}
        self.family: dict[str, int] = {}
        self.mech: dict[tuple[str, ...], int] = {}
        self.profile: dict[tuple[str, ...], int] = {}
        self.rating: dict[int, int] = {}
        self.seen: set[tuple[Any, ...]] = set()
        self.kept = 0

    def check(self, g: dict[str, Any]) -> str | None:
        lab = g["lab"]
        if _signature(g) in self.seen:
            return "duplicate"
        if self.family.get(lab["family"], 0) >= self.q["max_same_family"]:
            return "quota:family"
        if self.mech.get(tuple(lab["mechanics"]), 0) >= self.q["max_same_mechanics"]:
            return "quota:mechanics"
        if self.profile.get(tuple(lab["clue_profile"]), 0) >= self.q["max_same_clue_profile"]:
            return "quota:clue_profile"
        # Reserve the slots still needed for the minimum per rating and per mix entry.
        r = g["difficulty"]["rating"]
        m = lab.get("mix", -1)
        need_r = self.q["min_per_rating"]
        need_m = self.q["min_per_mix"]
        missing_r = sum(max(0, need_r - self.rating.get(x, 0)) for x in (1, 2, 3, 4) if x != r)
        missing_m = sum(max(0, need_m - self.mix.get(x, 0)) for x in range(self.mixes) if x != m)
        left = self.size - self.kept - 1
        if left < missing_r and self.rating.get(r, 0) >= need_r:
            return "quota:rating"
        if left < missing_r + missing_m and self.rating.get(r, 0) >= need_r and self.mix.get(m, 0) >= need_m:
            return "quota:mix"
        return None

    def add(self, g: dict[str, Any]) -> None:
        lab = g["lab"]
        self.seen.add(_signature(g))
        self.family[lab["family"]] = self.family.get(lab["family"], 0) + 1
        self.mech[tuple(lab["mechanics"])] = self.mech.get(tuple(lab["mechanics"]), 0) + 1
        self.profile[tuple(lab["clue_profile"])] = self.profile.get(tuple(lab["clue_profile"]), 0) + 1
        r = g["difficulty"]["rating"]
        self.rating[r] = self.rating.get(r, 0) + 1
        self.mix[lab.get("mix", -1)] = self.mix.get(lab.get("mix", -1), 0) + 1
        self.kept += 1


def run_lot(lot: dict[str, Any], workers: int = 6, log: Any = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Fill a lot: {"lot", "size", "seed", "mix": [{"weight", ...config}], "quotas", "max_attempts"}."""
    t0 = time.perf_counter()
    rng = random.Random(lot.get("seed", 1))
    size = lot["size"]
    mix = lot["mix"]
    weights = [m.get("weight", 1) for m in mix]
    quotas = Quotas(size, lot.get("quotas", {}), len(mix))
    max_attempts = lot.get("max_attempts", size * 15)
    kept: list[dict[str, Any]] = []
    blocked: list[dict[str, Any]] = []
    rejects: dict[str, int] = {}
    attempts = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        while len(kept) < size and attempts < max_attempts:
            batch = []
            for _ in range(workers * 2):
                i = rng.choices(range(len(mix)), weights)[0]
                cfg = {k: v for k, v in mix[i].items() if k != "weight"}
                if cfg.get("family", "any") == "any" and not cfg.get("surplus"):
                    # Draw among the families still under their quota, the least used first.
                    room = [f for f in FAMILIES if quotas.family.get(f, 0) < quotas.q["max_same_family"]]
                    if room:
                        low = min(quotas.family.get(f, 0) for f in room)
                        cfg["family"] = rng.choice([f for f in room if quotas.family.get(f, 0) == low])
                batch.append((cfg, rng.randint(0, 10**9), i))
            attempts += len(batch)
            for (cfg, seed, mi), (g, reason, info) in zip(
                batch, pool.map(_attempt, [(c, s) for c, s, _ in batch]), strict=True
            ):
                if g is not None:
                    g["lab"]["mix"] = mi
                    reason = quotas.check(g)
                if reason is None and len(kept) < size:
                    g["lab"].update(lot=lot["lot"], index=len(kept))
                    g["id"] = len(kept) + 1
                    quotas.add(g)
                    kept.append(g)
                    if log:
                        log(
                            f"kept {len(kept)}/{size}: {g['lab']['family']} {g['lab']['mechanics']} "
                            f"rating {g['difficulty']['rating']} clues {len(g['clues'])} {g['lab']['seconds']}s"
                        )
                elif reason is not None:
                    key = reason.split(":")[0] if reason.startswith("invalid") else reason
                    rejects[key] = rejects.get(key, 0) + 1
                    if reason == "blocked" and info.get("grid") is not None:
                        blocked.append({"config": cfg, "seed": seed, "grid": info["grid"]})
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
        "seconds": round(time.perf_counter() - t0, 1),
        "generator": f"dispatch-solver {__version__}",
        "blocked_ramp": len(blocked),
    }
    return kept, {"stats": stats, "blocked": copy.deepcopy(blocked)}
