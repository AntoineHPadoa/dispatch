"""Human deduction solver for pose grids: named rules, no trial and error, difficulty rating.

- State: candidate bars (piece, row, col, len), alive silhouettes (exports and STEP choices) and the
  counting constraints of the inventory and of the clues.
- Rules only remove candidates that no solution uses, or place bars every solution uses. They are applied
  easiest first (all instances of the easiest applicable rule, then back to level 1), like a Sudoku rater.
- Solved when the silhouette is fixed and the number of cells of each piece in each column is known (the
  composition), by cells with a single possible piece or by counting (column heights, totals, clues).
  The rating is the level of the hardest rule needed (1 Facile .. 4 Expert).

Example: uv run spot-solver deduce examples/pose_s7.json
"""

from __future__ import annotations

import itertools
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from . import pose
from .grid import Grid

Bar = tuple[str, int, int, int]  # piece, row, col, len
Cell = tuple[int, int]  # row, col

MAX_SCENARIOS = 20000
MAX_TILINGS = 4000  # per row, for "share_out"
MAX_SHARE_WORK = 300000  # prefix states x row vectors, for "share_out"
LABELS = {1: "Facile", 2: "Moyen", 3: "Difficile", 4: "Expert"}


@dataclass(frozen=True)
class Rule:
    id: str
    name: str
    level: int
    text: str  # one sentence for the player (tutorial)


RULE_LIST = [
    Rule("given", "Centrale engagée", 0, "Une barre déjà posée par l'énoncé est acquise."),
    Rule("room", "Pas de place", 1,
         "Une barre ne peut ni dépasser de la silhouette ni chevaucher une barre déjà posée."),
    Rule("exhausted", "Inventaire épuisé", 1,
         "Quand toutes les cases d'une pièce sont trouvées, elle ne va nulle part ailleurs ; une barre plus "
         "longue que ce qu'il reste ne passe plus."),
    Rule("price_cap", "Le prix plafonne la colonne", 1,
         "Sous un prix publié, aucune case n'est plus chère que ce prix."),
    Rule("record", "Le relevé compte les cases", 1,
         "Un relevé de production donne le nombre de cases d'une pièce dans la colonne : s'il est atteint, "
         "plus aucune ; s'il reste juste assez de cases possibles, elles y passent toutes."),
    Rule("flow", "Flux publié", 1,
         "Un flux d'interconnexion publié fixe l'export ou l'import d'un créneau avec un pays."),
    Rule("single_cover", "Une seule barre pour cette case", 1,
         "Une case à paver qu'une seule barre peut encore couvrir reçoit cette barre."),
    Rule("single_spot", "La barre qui ne tient qu'à un endroit", 1,
         "Une barre de l'inventaire qui n'a plus qu'une place possible y va."),
    Rule("program", "Programme publié", 1,
         "La barre annoncée par un programme de centrale va sur la seule ligne où elle tient."),
    Rule("silhouette", "La silhouette suit les barres", 1,
         "Un export ou un pompage qui laisserait une case impossible à couvrir, ou une barre posée hors de la "
         "silhouette, est exclu."),
    Rule("swap", "Cases interchangeables", 1,
         "Quand on connaît le nombre de cases de chaque pièce dans une colonne, l'ordre de ces cases ne compte "
         "pas : la composition est trouvée."),
    Rule("top_price", "La case la plus chère", 2,
         "Un prix publié exige au moins une case à ce prix dans la colonne : s'il n'y a qu'une case possible, "
         "c'est elle."),
    Rule("ribbon", "Le creux coupe le ruban", 2,
         "Chaque ligne se découpe en rubans entre les creux : une barre qui laisserait un bout de ruban "
         "impossible à remplir est exclue, une barre présente dans tous les découpages est posée."),
    Rule("just_enough", "Inventaire juste", 2,
         "S'il reste exactement autant de cases possibles que de cases à poser pour une pièce, toutes ces "
         "cases sont à elle."),
    Rule("column_sum", "Compter la colonne", 2,
         "Une colonne a autant de cases que sa hauteur : connaissant le compte des autres pièces (relevés, "
         "inventaire, ligne d'échange, prix), on en déduit celui qui reste."),
    Rule("carbon", "Plafond carbone", 2,
         "Une barre qui, ajoutée au CO₂ minimal déjà engagé, dépasserait le plafond est exclue."),
    Rule("share_out", "Répartition de l'inventaire", 3,
         "Les barres de l'inventaire doivent toutes trouver une ligne : un découpage de ligne qui empêche "
         "les autres lignes de recevoir le reste est exclu."),
    Rule("refuted", "Hypothèse réfutée", 4,
         "Si poser une barre (ou choisir un export) mène, par les règles simples, à une impasse, ce choix est "
         "exclu."),
]
RULES = {r.id: r for r in RULE_LIST}


class Contradiction(Exception):
    pass


class Unsupported(Exception):
    pass


@dataclass(frozen=True)
class Count:
    """lo <= cells of `pids` (in `cols`, or anywhere) <= hi."""
    pids: frozenset[str]
    cols: frozenset[int] | None
    lo: int
    hi: int | None
    rule_hi: str
    rule_lo: str


@dataclass(frozen=True)
class Scenario:
    h: tuple[int, ...]
    exports: tuple[tuple[str, tuple[int, ...]], ...]
    step: tuple[tuple[int, int], ...]

    def export(self, nid: str, c: int) -> int:
        for k, v in self.exports:
            if k == nid:
                return v[c]
        return 0


def _vectors(n: int, total: int, cap: int) -> list[tuple[int, ...]]:
    """All vectors of n values in 0..cap summing to total."""
    out: list[tuple[int, ...]] = []

    def rec(i: int, left: int, acc: list[int]) -> None:
        if i == n:
            if left == 0:
                out.append(tuple(acc))
            return
        for v in range(min(cap, left) + 1):
            if left - v <= cap * (n - i - 1):
                rec(i + 1, left - v, acc + [v])

    rec(0, total, [])
    return out


class Puzzle:
    """Static data of a pose grid for the deduction solver: pieces, scenarios, constraints, clues."""

    def __init__(self, d: dict[str, Any], lore: list[dict[str, Any]] | None = None,
                 prices: list[int | None] | None = None) -> None:
        grid, inv = pose.normalize(d)
        self.grid: Grid = grid
        self.n = n = grid.n
        self.labels = grid.columns
        self.co2_cap = grid.objective.co2_cap
        specs = inv.get("pieces") or {}
        self.pids: list[str] = [p for p in grid.pieces if p in specs]
        self.lens: dict[str, tuple[int, ...]] = {p: grid.pieces[p].lens for p in self.pids}
        self.counts: list[Count] = []
        self.exact: dict[tuple[str, int], int] = {}
        self.nbars: dict[str, int] = {}
        for p in self.pids:
            spec, piece = specs[p], grid.pieces[p]
            if "bars" in spec:
                wanted = [int(x) for x in spec["bars"]]
                for length in piece.lens:
                    self.exact[p, length] = wanted.count(length)
                self.lens[p] = tuple(x for x in piece.lens if wanted.count(x))
                total = sum(wanted)
                self.counts.append(Count(frozenset([p]), None, total, total, "exhausted", "just_enough"))
            else:
                if "count" in spec:
                    self.nbars[p] = int(spec["count"])
                if "cells" in spec:
                    k = int(spec["cells"])
                    self.counts.append(Count(frozenset([p]), None, k, k, "exhausted", "just_enough"))
            if piece.cap is not None:
                self.counts.append(Count(frozenset([p]), None, 0, int(piece.cap), "exhausted", "just_enough"))
        imports = inv.get("imports") or {}
        importers = {nb.id: grid.import_pid(nb) for nb in grid.neighbors if nb.can_import}
        if pose.ANY_COUNTRY in imports and importers:
            k = int(imports[pose.ANY_COUNTRY])
            if k:
                group = frozenset(importers.values())
                self.pids += sorted(group)
                self.counts.append(Count(group, None, k, k, "exhausted", "just_enough"))
        else:
            for nid, pid in importers.items():
                k = int(imports.get(nid, 0))
                if k:
                    self.pids.append(pid)
                    self.counts.append(Count(frozenset([pid]), None, k, k, "exhausted", "just_enough"))
        for pid in self.pids:
            if grid.is_import(pid):
                self.lens[pid] = (1,)
        self.price_of = {(p, c): grid.piece_price(p, c) for p in self.pids for c in range(n)}
        self.co2_of = {p: grid.piece_co2(p) for p in self.pids}
        self.scenarios = self._scenarios(inv)
        self.prices: dict[int, int] = {}
        self.programs: list[tuple[str, int, int]] = []
        self.givens: list[Bar] = []
        self.export_flows: list[tuple[str, int, int]] = []
        self.clues: list[dict[str, Any]] = []
        self.contradictory = False
        for clue in pose.read_clues(d, prices, lore):
            self._add(clue)

    def _scenarios(self, inv: dict[str, Any]) -> list[Scenario]:
        grid, n = self.grid, self.n
        exports = inv.get("exports") or {}
        per_nb = []
        for nb in grid.exporters:
            total = int(exports.get(nb.id, 0))
            per_nb.append([(nb.id, v) for v in _vectors(n, total, nb.cap)])
        pairs = [(p, t) for p in range(n) for t in range(p + 1, n)]
        steps = list(itertools.combinations_with_replacement(pairs, grid.step)) if grid.step else [()]
        size = len(steps)
        for opts in per_nb:
            size *= len(opts)
        if size > MAX_SCENARIOS:
            raise Unsupported(f"{size} silhouettes")
        out = []
        for combo in itertools.product(*per_nb):
            base = list(grid.residual)
            for _nid, v in combo:
                for c in range(n):
                    base[c] += v[c]
            for st in steps:
                h = list(base)
                for p, t in st:
                    h[p] += 1
                    h[t] -= 1
                if min(h) < 0:
                    continue
                out.append(Scenario(tuple(h), tuple(combo), tuple(st)))
        return out

    def _add(self, clue: dict[str, Any]) -> None:
        self.clues.append(clue)
        kind, c = clue["type"], int(clue["col"])
        if kind == "price":
            v = int(clue["value"])
            if self.prices.get(c, v) != v:
                self.contradictory = True
            self.prices[c] = v
        elif kind == "bar":
            self.programs.append((clue["piece"], c, int(clue["len"])))
        elif kind == "given":
            self.givens.append((clue["piece"], int(clue["row"]), c, int(clue["len"])))
        elif kind == "column":
            for pid, k in clue["counts"].items():
                k = int(k)
                if pid not in self.pids:
                    self.contradictory |= k > 0
                    continue
                self.counts.append(Count(frozenset([pid]), frozenset([c]), k, k, "record", "record"))
        elif kind == "flow":
            nb = pose.neighbor_of(self.grid, clue["country"])
            k = int(clue["value"])
            if clue["dir"] == "export":
                self.export_flows.append((nb.id, c, k))
            else:
                pid = self.grid.import_pid(nb)
                if pid not in self.pids:
                    self.contradictory |= k > 0
                else:
                    self.counts.append(Count(frozenset([pid]), frozenset([c]), k, k, "flow", "flow"))

    def extend(self, clue: dict[str, Any]) -> Puzzle:
        """Copy sharing the static parts, with one more clue."""
        pz = object.__new__(Puzzle)
        pz.__dict__.update(self.__dict__)
        pz.counts = list(self.counts)
        pz.prices = dict(self.prices)
        pz.programs = list(self.programs)
        pz.givens = list(self.givens)
        pz.export_flows = list(self.export_flows)
        pz.clues = list(self.clues)
        pz._add(clue)
        return pz

    def all_bars(self) -> set[Bar]:
        maxh = [max(s.h[c] for s in self.scenarios) for c in range(self.n)] if self.scenarios else [0] * self.n
        out = set()
        for p in self.pids:
            for length in self.lens[p]:
                for c0 in range(self.n - length + 1):
                    for r in range(min(maxh[c0:c0 + length])):
                        out.add((p, r, c0, length))
        return out

    def fmt_bar(self, b: Bar) -> str:
        p, r, c, length = b
        return f"{p}{length if length > 1 else ''} ligne {r + 1} ({self.labels[c]}-{(c + length) * 24 // self.n}h)"

    def fmt_cell(self, cell: Cell) -> str:
        return f"ligne {cell[0] + 1} à {self.labels[cell[1]]}"


def cells_of(b: Bar) -> tuple[Cell, ...]:
    return tuple((b[1], k) for k in range(b[2], b[2] + b[3]))


@dataclass
class State:
    cands: set[Bar]
    placed: set[Bar]
    scen: list[int]

    def copy(self) -> State:
        return State(set(self.cands), set(self.placed), list(self.scen))


class View:
    """Derived facts of a state: silhouette bounds, bars covering each cell, possible pieces per cell."""

    def __init__(self, pz: Puzzle, st: State) -> None:
        if not st.scen:
            raise Contradiction("aucune silhouette possible")
        n = pz.n
        hs = [pz.scenarios[i].h for i in st.scen]
        self.minh = [min(h[c] for h in hs) for c in range(n)]
        self.maxh = [max(h[c] for h in hs) for c in range(n)]
        self.cover: dict[Cell, list[Bar]] = defaultdict(list)
        for b in st.cands:
            for cell in cells_of(b):
                self.cover[cell].append(b)
        self.occupied: dict[Cell, Bar] = {}
        for b in st.placed:
            for cell in cells_of(b):
                if cell in self.occupied:
                    raise Contradiction("deux barres posées se chevauchent")
                self.occupied[cell] = b
        self.cells = [(r, c) for c in range(n) for r in range(self.maxh[c])]
        self.dom: dict[Cell, frozenset[str]] = {cell: frozenset(b[0] for b in self.cover.get(cell, ()))
                                               for cell in self.cells}

    def sure(self, cell: Cell) -> bool:
        return cell[0] < self.minh[cell[1]]

    def resolved(self, cell: Cell) -> bool:
        return self.sure(cell) and len(self.dom[cell]) == 1

    def unresolved(self, nscen: int) -> int:
        return sum(1 for cell in self.cells if not self.resolved(cell)) + (nscen > 1)


@dataclass
class Step:
    rule: str
    effects: list[str]

    def to_dict(self) -> dict[str, Any]:
        r = RULES[self.rule]
        return {"rule": r.id, "name": r.name, "level": r.level, "effects": self.effects}


@dataclass
class Result:
    status: str  # solved | stuck | contradiction | unsupported
    rating: int
    steps: list[Step] = field(default_factory=list)
    unresolved: int = 0
    composition: dict[str, Any] | None = None
    state: State | None = None

    @property
    def label(self) -> str:
        return LABELS.get(self.rating, "")

    @property
    def solved(self) -> bool:
        return self.status == "solved"

    def techniques(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for s in self.steps:
            if RULES[s.rule].level:
                out[s.rule] = out.get(s.rule, 0) + 1
        return out

    def to_dict(self, steps: bool = True) -> dict[str, Any]:
        out: dict[str, Any] = {"status": self.status, "rating": self.rating, "label": self.label,
                               "techniques": self.techniques(), "unresolved": self.unresolved}
        if steps:
            out["steps"] = [s.to_dict() for s in self.steps]
        if self.composition is not None:
            out["composition"] = self.composition
        return out


class Solver:
    def __init__(self, pz: Puzzle, st: State | None = None, max_level: int = 4, record: bool = True) -> None:
        self.pz = pz
        self.max_level = max_level
        self.record = record
        self.steps: list[Step] = []
        self.st = st if st is not None else State(pz.all_bars(), set(), list(range(len(pz.scenarios))))
        self.rules: list[tuple[int, Callable[[View], list[str]]]] = [
            (1, self.r_room), (1, self.r_exhausted), (1, self.r_price_cap), (1, self.r_record),
            (1, self.r_flow), (1, self.r_single_cover), (1, self.r_single_spot), (1, self.r_program),
            (1, self.r_silhouette), (2, self.r_top_price), (2, self.r_ribbon), (2, self.r_just_enough),
            (2, self.r_column_sum), (2, self.r_carbon), (3, self.r_share_out), (4, self.r_refuted),
        ]

    # ----- state changes -----

    def _note(self, rule: str, effects: list[str]) -> list[str]:
        if effects and self.record:
            self.steps.append(Step(rule, effects))
        return effects

    def remove(self, bars: set[Bar] | list[Bar]) -> list[str]:
        out = []
        for b in sorted(set(bars)):
            if b in self.st.placed:
                raise Contradiction(f"{self.pz.fmt_bar(b)} posée mais exclue")
            if b in self.st.cands:
                self.st.cands.discard(b)
                out.append(f"exclut {self.pz.fmt_bar(b)}")
        return out

    def place(self, bars: set[Bar] | list[Bar]) -> list[str]:
        out = []
        for b in sorted(set(bars)):
            if b not in self.st.cands:
                raise Contradiction(f"{self.pz.fmt_bar(b)} impossible")
            if b not in self.st.placed:
                self.st.placed.add(b)
                out.append(f"pose {self.pz.fmt_bar(b)}")
        return out

    def keep_scenarios(self, keep: Callable[[Scenario], bool]) -> list[str]:
        pz = self.pz
        before = [pz.scenarios[i] for i in self.st.scen]
        alive = [i for i in self.st.scen if keep(pz.scenarios[i])]
        if len(alive) == len(before):
            return []
        if not alive:
            raise Contradiction("aucune silhouette possible")
        self.st.scen = alive
        after = [pz.scenarios[i] for i in alive]
        out = []
        for c in range(pz.n):
            hb = {s.h[c] for s in before}
            ha = {s.h[c] for s in after}
            if len(hb) > 1 and len(ha) == 1:
                out.append(f"hauteur {next(iter(ha))} à {pz.labels[c]}")
        if len(after) == 1:
            s = after[0]
            ex = [f"export {nid} à {pz.labels[c]}" for nid, v in s.exports for c in range(pz.n) if v[c]]
            st = [f"pompage {pz.labels[p]} → turbinage {pz.labels[t]}" for p, t in s.step]
            out += ex + st
        return out or [f"silhouettes possibles : {len(before)} → {len(after)}"]

    def apply_clue_facts(self) -> None:
        """Facts given by the clues themselves: pre-placed bars, published export flows."""
        pz = self.pz
        if pz.contradictory:
            raise Contradiction("indices contradictoires")
        eff = self.place([b for b in pz.givens if b not in self.st.placed])
        self._note("given", eff)
        if pz.export_flows:
            eff = self.keep_scenarios(lambda s: all(s.export(nid, c) == k for nid, c, k in pz.export_flows))
            self._note("flow", eff)

    # ----- main loop -----

    def solved(self, v: View) -> bool:
        """Single silhouette and known composition: every cell resolved, or every column count tight."""
        if len(self.st.scen) != 1:
            return False
        if all(len(v.dom[cell]) == 1 for cell in v.cells):
            return True
        lo, hi = self.bounds(v)
        if lo != hi:
            return False
        cols = sorted({c for r, c in v.cells if len(v.dom[(r, c)]) > 1})
        eff = []
        for c in cols:
            parts = [f"{lo[p, c]} {p}" for p in self.pz.pids if lo.get((p, c))]
            eff.append(f"{self.pz.labels[c]} : {', '.join(parts)} (ordre libre)")
        self._note("swap", eff)
        return True

    def bounds(self, v: View) -> tuple[dict[tuple[str, int], int], dict[tuple[str, int], int]]:
        """Bounds on the cells of each piece in each column, by counting (raises Contradiction)."""
        pz = self.pz
        lo: dict[tuple[str, int], int] = {}
        hi: dict[tuple[str, int], int] = {}
        for p in pz.pids:
            for c in range(pz.n):
                col = [(r, c) for r in range(v.maxh[c])]
                lo[p, c] = sum(1 for x in col if v.sure(x) and v.dom[x] == frozenset([p]))
                hi[p, c] = sum(1 for x in col if p in v.dom[x])
        cons: list[tuple[list[tuple[str, int]], int, int]] = []
        for c in range(pz.n):
            cons.append(([(p, c) for p in pz.pids], v.minh[c], v.maxh[c]))
        for g in pz.counts:
            keys = [(p, c) for p in g.pids for c in range(pz.n) if g.cols is None or c in g.cols]
            cons.append((keys, g.lo, g.hi if g.hi is not None else 10 ** 6))
        for nb in pz.grid.neighbors:
            pid = pz.grid.import_pid(nb)
            if pid in pz.pids:
                for c in range(pz.n):
                    free = max(nb.cap - pz.scenarios[i].export(nb.id, c) for i in self.st.scen)
                    cons.append(([(pid, c)], 0, free))
        for c, val in pz.prices.items():
            if val != 0 or v.minh[c] > 0:
                cons.append(([(p, c) for p in pz.pids if pz.price_of[p, c] == val], 1, 10 ** 6))
        changed = True
        while changed:
            changed = False
            for keys, a, b in cons:
                slo = sum(lo[k] for k in keys)
                shi = sum(hi[k] for k in keys)
                if slo > b or shi < a:
                    raise Contradiction("comptes impossibles")
                for k in keys:
                    nlo = max(lo[k], a - (shi - hi[k]))
                    nhi = min(hi[k], b - (slo - lo[k]))
                    if nlo > nhi:
                        raise Contradiction("comptes impossibles")
                    if (nlo, nhi) != (lo[k], hi[k]):
                        slo += nlo - lo[k]
                        shi += nhi - hi[k]
                        lo[k], hi[k] = nlo, nhi
                        changed = True
        return lo, hi

    def run(self) -> Result:
        try:
            self.apply_clue_facts()
            while True:
                v = View(self.pz, self.st)
                self.check(v)
                if self.solved(v):
                    return self.result("solved", v)
                for level, rule in self.rules:
                    if level > self.max_level:
                        continue
                    if rule(v):
                        break
                else:
                    return self.result("stuck", v)
        except Contradiction:
            return Result("contradiction", self.rating(), self.steps, state=self.st)

    def rating(self) -> int:
        return max([RULES[s.rule].level for s in self.steps] + [1])

    def result(self, status: str, v: View) -> Result:
        comp = self.composition(v) if status == "solved" else None
        return Result(status, self.rating(), self.steps, v.unresolved(len(self.st.scen)), comp, self.st)

    def composition(self, v: View) -> dict[str, Any]:
        pz = self.pz
        s = pz.scenarios[self.st.scen[0]]
        lo, _ = self.bounds(v)
        counts = {p: [lo[p, c] for c in range(pz.n)] for p in pz.pids}
        return {"counts": {p: vs for p, vs in counts.items() if any(vs)},
                "exports": {nid: list(vs) for nid, vs in s.exports if any(vs)},
                "step": [list(x) for x in s.step], "heights": list(s.h)}

    def check(self, v: View) -> None:
        """Cheap global consistency tests (used to refute hypotheses)."""
        for cell in v.cells:
            if v.sure(cell) and not v.dom[cell]:
                raise Contradiction(f"case {self.pz.fmt_cell(cell)} sans barre")
        for g in self.pz.counts:
            scope = self.scope(v, g)
            if g.hi is not None and sum(1 for x in scope if v.sure(x) and v.dom[x] and v.dom[x] <= g.pids) > g.hi:
                raise Contradiction("compte dépassé")
            if sum(1 for x in scope if v.dom[x] & g.pids) < g.lo:
                raise Contradiction("compte impossible")
        for (p, length), k in self.pz.exact.items():
            placed = sum(1 for b in self.st.placed if b[0] == p and b[3] == length)
            avail = sum(1 for b in self.st.cands if b[0] == p and b[3] == length)
            if placed > k or avail < k:
                raise Contradiction("inventaire impossible")
        for c, val in self.pz.prices.items():
            col = [(r, c) for r in range(v.maxh[c])]
            if any(v.sure(x) and v.dom[x] and min(self.pz.price_of[p, c] for p in v.dom[x]) > val for x in col):
                raise Contradiction("prix dépassé")
            if (val != 0 or v.minh[c] > 0) and not any(
                    any(self.pz.price_of[p, c] == val for p in v.dom[x]) for x in col):
                raise Contradiction("prix introuvable")

    def scope(self, v: View, g: Count) -> list[Cell]:
        if g.cols is None:
            return v.cells
        return [cell for cell in v.cells if cell[1] in g.cols]

    def free(self) -> set[Bar]:
        return self.st.cands - self.st.placed

    # ----- level 1 -----

    def r_room(self, v: View) -> list[str]:
        rm = [b for b in self.free()
              if any(cell in v.occupied or cell[0] >= v.maxh[cell[1]] for cell in cells_of(b))]
        return self._note("room", self.remove(rm))

    def _count_hi(self, v: View, rule: str) -> list[str]:
        rm: set[Bar] = set()
        for g in self.pz.counts:
            if g.rule_hi != rule or g.hi is None:
                continue
            sure_in = {x for x in self.scope(v, g) if v.sure(x) and v.dom[x] and v.dom[x] <= g.pids}
            left = g.hi - len(sure_in)
            for b in self.free():
                if b[0] not in g.pids:
                    continue
                k = sum(1 for x in cells_of(b) if (g.cols is None or x[1] in g.cols) and x not in sure_in)
                if k > left:
                    rm.add(b)
        if rule == "exhausted":
            for (p, length), k in self.pz.exact.items():
                if sum(1 for b in self.st.placed if b[0] == p and b[3] == length) >= k:
                    rm |= {b for b in self.free() if b[0] == p and b[3] == length}
            for p, k in self.pz.nbars.items():
                if sum(1 for b in self.st.placed if b[0] == p) >= k:
                    rm |= {b for b in self.free() if b[0] == p}
        return self.remove(rm)

    def _count_lo(self, v: View, rule: str) -> list[str]:
        for g in self.pz.counts:
            if g.rule_lo != rule or g.lo == 0:
                continue
            possible = [x for x in self.scope(v, g) if v.dom[x] & g.pids]
            if len(possible) < g.lo:
                raise Contradiction("compte impossible")
            if len(possible) > g.lo:
                continue
            rm = {b for x in possible for b in v.cover[x] if b[0] not in g.pids}
            eff = self.remove(rm)
            eff += self.keep_scenarios(lambda s, cells=possible: all(r < s.h[c] for r, c in cells))
            if eff:
                return eff
        return []

    def r_exhausted(self, v: View) -> list[str]:
        return self._note("exhausted", self._count_hi(v, "exhausted"))

    def r_record(self, v: View) -> list[str]:
        return self._note("record", self._count_hi(v, "record") or self._count_lo(v, "record"))

    def r_flow(self, v: View) -> list[str]:
        return self._note("flow", self._count_hi(v, "flow") or self._count_lo(v, "flow"))

    def r_price_cap(self, v: View) -> list[str]:
        rm = [b for b in self.free() for c in range(b[2], b[2] + b[3])
              if c in self.pz.prices and self.pz.price_of[b[0], c] > self.pz.prices[c]]
        return self._note("price_cap", self.remove(rm))

    def r_single_cover(self, v: View) -> list[str]:
        add = set()
        for cell in v.cells:
            if v.sure(cell) and cell not in v.occupied:
                bars = v.cover.get(cell, [])
                if not bars:
                    raise Contradiction(f"case {self.pz.fmt_cell(cell)} sans barre")
                if len(bars) == 1:
                    add.add(bars[0])
        return self._note("single_cover", self.place(add))

    def r_single_spot(self, v: View) -> list[str]:
        add: set[Bar] = set()
        for (p, length), k in self.pz.exact.items():
            need = k - sum(1 for b in self.st.placed if b[0] == p and b[3] == length)
            free = [b for b in self.free() if b[0] == p and b[3] == length]
            if need < 0 or len(free) < need:
                raise Contradiction("inventaire impossible")
            if need > 0 and len(free) == need:
                add |= set(free)
        return self._note("single_spot", self.place(add))

    def r_program(self, v: View) -> list[str]:
        add: set[Bar] = set()
        for p, c, length in self.pz.programs:
            if any(b[0] == p and b[2] == c and b[3] == length for b in self.st.placed):
                continue
            rows = [b for b in self.st.cands if b[0] == p and b[2] == c and b[3] == length]
            if not rows:
                raise Contradiction("programme impossible")
            if len(rows) == 1:
                add.add(rows[0])
        return self._note("program", self.place(add))

    def r_silhouette(self, v: View) -> list[str]:
        pz = self.pz
        placed_cells = list(v.occupied)
        empty = [cell for cell in v.cells if not v.dom[cell]]
        lines = []
        for nb in pz.grid.neighbors:
            pid = pz.grid.import_pid(nb)
            if nb.can_export and pid in pz.pids:
                for c in range(pz.n):
                    rows = [r for r in range(v.maxh[c]) if v.dom[(r, c)] == frozenset([pid])]
                    if rows:
                        lines.append((nb, c, rows))

        def keep(s: Scenario) -> bool:
            if any(r >= s.h[c] for r, c in placed_cells):
                return False
            if any(r < s.h[c] for r, c in empty):
                return False
            return all(s.export(nb.id, c) + sum(1 for r in rows if r < s.h[c]) <= nb.cap
                       for nb, c, rows in lines)

        return self._note("silhouette", self.keep_scenarios(keep))

    # ----- level 2 -----

    def r_top_price(self, v: View) -> list[str]:
        pz = self.pz
        for c, val in sorted(pz.prices.items()):
            col = [(r, c) for r in range(v.maxh[c])]
            if any(v.sure(x) and v.dom[x] and all(pz.price_of[p, c] == val for p in v.dom[x]) for x in col):
                continue
            if val == 0 and v.minh[c] == 0:
                continue  # an empty column also costs 0
            cand = [x for x in col if any(pz.price_of[p, c] == val for p in v.dom[x])]
            if not cand:
                raise Contradiction("prix introuvable")
            if len(cand) == 1:
                x = cand[0]
                eff = self.remove([b for b in v.cover[x] if pz.price_of[b[0], c] != val])
                eff += self.keep_scenarios(lambda s, x=x: x[0] < s.h[x[1]])
                if eff:
                    return self._note("top_price", eff)
        return []

    def _row_status(self, v: View, r: int) -> list[str]:
        return ["absent" if r >= v.maxh[c] else "sure" if r < v.minh[c] else "maybe" for c in range(self.pz.n)]

    def _row_starts(self, r: int) -> dict[int, list[Bar]]:
        starts: dict[int, list[Bar]] = defaultdict(list)
        for b in self.st.cands:
            if b[1] == r:
                starts[b[2]].append(b)
        return starts

    def _forced_from(self, r: int, status: list[str], ways: int, through: dict[Bar, int],
                     skipped: dict[int, int]) -> tuple[set[Bar], set[Bar], list[Callable[[Scenario], bool]]]:
        rm = {b for b, k in through.items() if k == 0}
        add = {b for b, k in through.items() if k == ways}
        filters: list[Callable[[Scenario], bool]] = []
        for c, k in skipped.items():
            if status[c] != "maybe":
                continue
            if k == 0:
                filters.append(lambda s, c=c: r < s.h[c])
            elif k == ways:
                filters.append(lambda s, c=c: r >= s.h[c])
        return rm, add, filters

    def _apply_row(self, rm: set[Bar], add: set[Bar], filters: list[Callable[[Scenario], bool]]) -> list[str]:
        eff = self.remove(rm)
        eff += self.place(add - rm)
        if filters:
            eff += self.keep_scenarios(lambda s: all(f(s) for f in filters))
        return eff

    def r_ribbon(self, v: View) -> list[str]:
        n = self.pz.n
        for r in range(max(v.maxh)):
            status = self._row_status(v, r)
            starts = self._row_starts(r)
            f = [0] * (n + 1)
            f[0] = 1
            for i in range(n):
                if f[i] == 0:
                    continue
                if status[i] != "sure":
                    f[i + 1] += f[i]
                for b in starts.get(i, ()):
                    f[i + b[3]] += f[i]
            g = [0] * (n + 1)
            g[n] = 1
            for i in range(n - 1, -1, -1):
                g[i] = (g[i + 1] if status[i] != "sure" else 0) + sum(g[i + b[3]] for b in starts.get(i, ()))
            ways = f[n]
            if ways == 0:
                raise Contradiction(f"ligne {r + 1} impossible à découper")
            through = {b: f[b[2]] * g[b[2] + b[3]] for bs in starts.values() for b in bs}
            skipped = {c: f[c] * g[c + 1] for c in range(n)}
            rm, add, filters = self._forced_from(r, status, ways, through, skipped)
            eff = self._apply_row(rm, add - self.st.placed, filters)
            if eff:
                return self._note("ribbon", eff)
        return []

    def r_just_enough(self, v: View) -> list[str]:
        return self._note("just_enough", self._count_lo(v, "just_enough"))

    def r_column_sum(self, v: View) -> list[str]:
        lo, hi = self.bounds(v)
        rm: set[Bar] = set()
        must: list[Cell] = []
        for (p, c), top in hi.items():
            col = [(r, c) for r in range(v.maxh[c])]
            sure = [x for x in col if v.sure(x) and v.dom[x] == frozenset([p])]
            possible = [x for x in col if p in v.dom[x]]
            if top == len(sure) < len(possible):
                rm |= {b for x in possible if x not in sure for b in v.cover[x] if b[0] == p}
            if lo[p, c] == len(possible) > len(sure):
                rm |= {b for x in possible for b in v.cover[x] if b[0] != p}
                must += possible
        eff = self.remove(rm)
        if must:
            eff += self.keep_scenarios(lambda s: all(r < s.h[c] for r, c in must))
        return self._note("column_sum", eff)

    def r_carbon(self, v: View) -> list[str]:
        pz = self.pz
        if pz.co2_cap is None:
            return []
        low = {x: (min(pz.co2_of[p] for p in v.dom[x]) if v.sure(x) and v.dom[x] else 0) for x in v.cells}
        base = sum(low.values())
        rm = [b for b in self.free()
              if base + sum(pz.co2_of[b[0]] - low[x] for x in cells_of(b)) > pz.co2_cap]
        return self._note("carbon", self.remove(rm))

    # ----- level 3 -----

    def _dims(self) -> tuple[list[Any], tuple[int, ...]]:
        dims: list[Any] = []
        target: list[int] = []
        for key, k in sorted(self.pz.exact.items()):
            dims.append(("x",) + key)
            target.append(k)
        for p, k in sorted(self.pz.nbars.items()):
            dims.append(("n", p))
            target.append(k)
        for g in self.pz.counts:
            if g.cols is None and g.hi == g.lo and g.rule_lo == "just_enough":
                dims.append(("c", g.pids))
                target.append(g.lo)
        return dims, tuple(target)

    def _vector(self, dims: list[Any], tiling: tuple[Bar, ...]) -> tuple[int, ...]:
        out = []
        for d in dims:
            if d[0] == "x":
                out.append(sum(1 for b in tiling if b[0] == d[1] and b[3] == d[2]))
            elif d[0] == "n":
                out.append(sum(1 for b in tiling if b[0] == d[1]))
            else:
                out.append(sum(b[3] for b in tiling if b[0] in d[1]))
        return tuple(out)

    def _tilings(self, v: View, r: int) -> list[tuple[tuple[Bar, ...], frozenset[int]]] | None:
        n = self.pz.n
        status = self._row_status(v, r)
        starts = self._row_starts(r)
        out: list[tuple[tuple[Bar, ...], frozenset[int]]] = []

        def rec(i: int, acc: list[Bar], skipped: list[int]) -> bool:
            if len(out) > MAX_TILINGS:
                return False
            if i == n:
                out.append((tuple(acc), frozenset(skipped)))
                return True
            if status[i] != "sure" and not rec(i + 1, acc, skipped + [i] if status[i] == "maybe" else skipped):
                return False
            for b in starts.get(i, ()):
                if not rec(i + b[3], acc + [b], skipped):
                    return False
            return True

        return out if rec(0, [], []) else None

    def r_share_out(self, v: View) -> list[str]:
        dims, target = self._dims()
        if not dims:
            return []
        rows = list(range(max(v.maxh)))
        per_row = []
        for r in rows:
            t = self._tilings(v, r)
            if t is None:
                return []
            if not t:
                raise Contradiction(f"ligne {r + 1} impossible à découper")
            per_row.append([(til, skip, self._vector(dims, til)) for til, skip in t])
        vecs = [sorted({u for _, _, u in tl}) for tl in per_row]

        def add(a: tuple[int, ...], b: tuple[int, ...]) -> tuple[int, ...] | None:
            s = tuple(x + y for x, y in zip(a, b))
            return s if all(x <= t for x, t in zip(s, target)) else None

        zero = tuple(0 for _ in dims)
        prefix = [{zero}]
        work = 0
        for us in vecs:
            nxt = set()
            for p in prefix[-1]:
                for u in us:
                    s = add(p, u)
                    if s is not None:
                        nxt.add(s)
            work += len(prefix[-1]) * len(us)
            if work > MAX_SHARE_WORK:
                return []
            prefix.append(nxt)
        suffix = [set() for _ in range(len(rows) + 1)]
        suffix[len(rows)] = {zero}
        for i in range(len(rows) - 1, -1, -1):
            for p in suffix[i + 1]:
                for u in vecs[i]:
                    s = add(p, u)
                    if s is not None:
                        suffix[i].add(s)
        if target not in prefix[-1]:
            raise Contradiction("inventaire impossible à répartir")
        for i, r in enumerate(rows):
            ok_u = set()
            for u in vecs[i]:
                for p in prefix[i]:
                    rest = tuple(t - x - y for t, x, y in zip(target, p, u))
                    if min(rest) >= 0 and rest in suffix[i + 1]:
                        ok_u.add(u)
                        break
            good = [(til, skip) for til, skip, u in per_row[i] if u in ok_u]
            if len(good) == len(per_row[i]):
                continue
            ways = len(good)
            through: dict[Bar, int] = {b: 0 for b in self.st.cands if b[1] == r}
            skipped = {c: 0 for c in range(self.pz.n)}
            for til, skip in good:
                for b in til:
                    through[b] += 1
                for c in skip:
                    skipped[c] += 1
            status = self._row_status(v, r)
            rm, add_bars, filters = self._forced_from(r, status, ways, through, skipped)
            eff = self._apply_row(rm, add_bars - self.st.placed, filters)
            if eff:
                return self._note("share_out", eff)
        return []

    # ----- level 4 -----

    def _fails(self, st: State) -> bool:
        sub = Solver(self.pz, st, max_level=2, record=False)
        try:
            while True:
                v = View(self.pz, sub.st)
                sub.check(v)
                if sub.solved(v):
                    return False
                for level, rule in sub.rules:
                    if level <= 2 and rule(v):
                        break
                else:
                    return False
        except Contradiction:
            return True

    def r_refuted(self, v: View) -> list[str]:
        bad: list[Bar] = []
        for b in sorted(self.free()):
            st = self.st.copy()
            st.placed.add(b)
            if self._fails(st):
                bad.append(b)
        if bad:
            eff = [f"poser {self.pz.fmt_bar(b)} mène à une impasse" for b in bad]
            self.remove(bad)
            return self._note("refuted", eff)
        if len(self.st.scen) > 1:
            dead = []
            for i in self.st.scen:
                st = self.st.copy()
                st.scen = [i]
                if self._fails(st):
                    dead.append(i)
            if dead:
                keep = set(self.st.scen) - set(dead)
                return self._note("refuted", self.keep_scenarios(lambda s: s in {self.pz.scenarios[i] for i in keep}))
        return []


def deduce(d: dict[str, Any], max_level: int = 4, lore: list[dict[str, Any]] | None = None,
           prices: list[int | None] | None = None) -> Result:
    """Run the deduction solver on a pose grid (its own clues, or `lore` / `prices` when given)."""
    try:
        pz = Puzzle(d, lore, prices)
    except Unsupported:
        return Result("unsupported", 0)
    return Solver(pz, max_level=max_level).run()
