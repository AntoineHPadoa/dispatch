"""Deduction techniques (GAME-DESIGN.md §9), trace steps and the result of a deduction run.

- RULES: id, French name, level and the sentence shown to the player, identical to TECHNIQUES in
  web/src/i18n/fr.ts and to GAME-DESIGN.md §9 (tested). `given` is level 0 and not shown.
- RAMP_RULES: the four trapezoid techniques (docs/next/rampe.md §2), counted per grid in lab.ramp_techniques.
  RAMP_LABELS (plateau, shoulder) are room and single_cover named for a ramp: they teach, they do not
  measure what the ramp adds. RAMP_OWN (lone, relay) are the deductions only a ramp allows.
- Step: one application of a technique, with what it changed (placements, silhouette), where (cells,
  columns), why (clue indices), which shapes were involved (rect, tall, ramp_trap, ramp_stair), the
  exchanges it fixed ({country: {"export": [[col, value]]}, "step": [[pump, turbine]]}) and `scope: "day"`
  when a day total was used.
- Result.rating: notation A. Techniques rated with RATING_LEVELS (ribbon 1, share_out 2, refuted 3, the
  others at their level), capped at Moyen (TECHNIQUE_CAP), plus one step per global mechanic coupled to an
  exchange (coupled_globals(): the STEP found or an active CO2 cap, only when the solution trades with a
  neighbor). The rule levels themselves (loop order, max_level) are unchanged.
- Result.summary(): the measures kept for the lab and the difficulty calibration.
- compactness(): K = weight of the decisions / pieces laid (bars and imports), a lab measure only.
- decisions(): the choices the deduction must settle and that change the solution, by type (DECISION_TYPES),
  from the reference solution, the clues and the trace; a grid without any is "filling" (lab.decisions).
- ramp_steps() / ramp_settled_by(): which rule lays each ramp bar (None when a clue gives it).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..grid import LABELS


@dataclass(frozen=True)
class Rule:
    id: str
    name: str
    level: int
    text: str


RULE_LIST = [
    Rule("given", "Centrale engagée", 0, "Une centrale déjà posée par l’énoncé est acquise."),
    Rule(
        "room",
        "Pas de place",
        1,
        "Un groupe ne peut ni dépasser de la silhouette ni chevaucher un groupe déjà posé.",
    ),
    Rule(
        "exhausted",
        "Carnet épuisé",
        1,
        "Quand tous les blocs d’une centrale sont trouvés, elle ne va nulle part ailleurs ; un groupe plus long que ce qu’il reste ne passe plus.",
    ),
    Rule(
        "price_cap",
        "Le prix plafonne la colonne",
        1,
        "Sous un prix publié, aucun bloc n’est plus cher que ce prix.",
    ),
    Rule(
        "record",
        "Le relevé compte les blocs",
        1,
        "Un relevé atteint interdit d’autres blocs de cette centrale ; s’il reste juste assez de blocs possibles, ils y passent tous. Les échanges du jour se comptent de même.",
    ),
    Rule(
        "flow",
        "Flux publié",
        1,
        "Un flux publié fixe l’export ou l’import d’un créneau avec un pays.",
    ),
    Rule(
        "single_cover",
        "Un seul groupe pour ce bloc",
        1,
        "Un bloc qu’un seul groupe peut encore couvrir reçoit ce groupe.",
    ),
    Rule(
        "single_spot",
        "Le groupe qui ne tient qu’à un endroit",
        1,
        "Un groupe du carnet d’ordres qui n’a plus qu’une place possible y va.",
    ),
    Rule(
        "program",
        "Programme publié",
        1,
        "Le groupe annoncé par un programme va sur la seule ligne où il tient.",
    ),
    Rule(
        "length",
        "Durée de marche",
        1,
        "Le groupe dont on connaît la durée de marche va à la seule place où cette durée tient.",
    ),
    Rule(
        "silhouette",
        "La silhouette suit les groupes",
        1,
        "Un export ou un pompage qui laisserait un bloc impossible à couvrir est exclu.",
    ),
    Rule(
        "swap",
        "Blocs interchangeables",
        1,
        "Quand on connaît le nombre de blocs de chaque centrale dans une colonne, l’ordre ne compte pas.",
    ),
    Rule(
        "top_price",
        "Le bloc le plus cher",
        2,
        "Un prix publié exige au moins un bloc de cette centrale dans la colonne : s’il n’y a qu’une place possible, c’est elle.",
    ),
    Rule(
        "ribbon",
        "Le creux coupe le ruban",
        2,
        "Chaque ligne se découpe en rubans entre les creux : un groupe qui laisserait un bout impossible à remplir est exclu.",
    ),
    Rule(
        "just_enough",
        "Carnet juste",
        2,
        "S’il reste exactement autant de blocs possibles que de blocs à poser pour une centrale, tous sont à elle.",
    ),
    Rule(
        "column_sum",
        "Compter la colonne",
        2,
        "Une colonne a autant de blocs que sa hauteur : connaissant les autres centrales, on déduit celle qui reste.",
    ),
    Rule(
        "carbon",
        "Plafond carbone",
        2,
        "Un groupe qui ferait dépasser le plafond CO₂ est exclu.",
    ),
    Rule(
        "ramp_plateau",
        "Le plateau barre la ligne du dessus",
        1,
        "Au-dessus de sa base, le groupe à paliers occupe aussi la ligne suivante sur tout son plateau : aucun ruban de cette ligne ne le traverse.",
    ),
    Rule(
        "ramp_shoulder",
        "Le bord appelle un bloc",
        1,
        "Le bloc au-dessus d’un bord est fermé côté plateau : seul un groupe d’un bloc, ou un groupe qui s’arrête pile là, peut le couvrir.",
    ),
    Rule(
        "ramp_lone",
        "Un bloc seul est un bord",
        2,
        "Un seul bloc à paliers dans une colonne, c’est un bord : le groupe continue sur deux blocs d’un côté et s’arrête de l’autre.",
    ),
    Rule(
        "ramp_relay",
        "Deux bords se relaient",
        3,
        "Deux blocs à paliers sans plateau autour : un groupe s’arrête et un autre démarre sur son bord.",
    ),
    Rule(
        "share_out",
        "Répartition du carnet",
        3,
        "Les groupes doivent tous trouver une ligne : un découpage qui empêche les autres de se placer est exclu.",
    ),
    Rule(
        "refuted",
        "Hypothèse réfutée",
        4,
        "Si un choix mène à une impasse par les règles simples, il est exclu (une seule hypothèse, jamais imbriquée).",
    ),
]
RULES = {r.id: r for r in RULE_LIST}
RAMP_LABELS = ("ramp_plateau", "ramp_shoulder")
RAMP_OWN = ("ramp_lone", "ramp_relay")
RAMP_RULES = RAMP_LABELS + RAMP_OWN
# Notation A (docs/next/v3-criteres-j2.md): technique levels for the rating, then capped at Moyen.
RATING_LEVELS = {"ribbon": 1, "share_out": 2, "refuted": 3}
TECHNIQUE_CAP = 2


def coupled_globals(steps: list[Step], composition: dict[str, Any] | None) -> list[str]:
    """Global mechanics the deduction uses (STEP option fixed by a step, CO2 cap removing a placement), kept
    only when the solution has at least one exchange (an export or an import): without a neighbor they do
    not make a grid hard (c n°9, felt 1)."""
    if composition is None:
        return []
    traded = any(any(v) for v in composition.get("exports", {}).values()) or any(
        k.startswith("I:") for col in composition["cells"] for k in col
    )
    if not traded:
        return []
    out = []
    if any(composition.get("pumps", [])) and any("step" in s.exchanges for s in steps):
        out.append("step")
    if any(s.rule == "carbon" for s in steps):
        out.append("carbon")
    return out


@dataclass
class Step:
    rule: str
    effects: list[str]
    removed: list[dict[str, Any]] = field(default_factory=list)
    placed: list[dict[str, Any]] = field(default_factory=list)
    cells: list[tuple[int, int]] = field(default_factory=list)
    clues: list[int] = field(default_factory=list)
    shapes: list[str] = field(default_factory=list)
    columns: list[int] = field(default_factory=list)  # slots whose exchanges or counts changed
    exchanges: dict[str, Any] = field(default_factory=dict)  # {country: {"export": [[col, value]]}, "step": [[p, t]]}
    scope: str | None = None  # "day" when a day total (inventory or exchanges clue) was used

    @property
    def level(self) -> int:
        return RULES[self.rule].level

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "rule": self.rule,
            "name": RULES[self.rule].name,
            "level": self.level,
            "effects": self.effects,
        }
        for k in ("removed", "placed", "clues", "shapes", "exchanges"):
            if getattr(self, k):
                out[k] = getattr(self, k)
        if self.cells:
            out["cells"] = [list(x) for x in sorted(set(self.cells))]
        if self.columns:
            out["columns"] = sorted(set(self.columns))
        if self.scope:
            out["scope"] = self.scope
        return out


@dataclass
class Result:
    status: str  # solved | stuck | contradiction
    steps: list[Step] = field(default_factory=list)
    composition: dict[str, Any] | None = None
    unresolved: int = 0
    reason: str = ""

    @property
    def solved(self) -> bool:
        return self.status == "solved"

    @property
    def technique_level(self) -> int:
        """Highest rule level used (§9 table), before notation A."""
        return max([s.level for s in self.steps] + [1])

    @property
    def coupled_globals(self) -> list[str]:
        return coupled_globals(self.steps, self.composition)

    @property
    def rating(self) -> int:
        """Notation A: min(techniques rated by RATING_LEVELS, Moyen) + one per coupled global mechanic."""
        tech = max([RATING_LEVELS.get(s.rule, s.level) for s in self.steps] + [1])
        return min(4, min(tech, TECHNIQUE_CAP) + len(self.coupled_globals))

    @property
    def label(self) -> str:
        return LABELS[self.rating]

    def techniques(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for s in self.steps:
            if s.level:
                out[s.rule] = out.get(s.rule, 0) + 1
        return out

    def summary(self) -> dict[str, Any]:
        order: list[str] = []
        for s in self.steps:
            if s.level and s.rule not in order:
                order.append(s.rule)
        shapes: dict[str, int] = {}
        for s in self.steps:
            for k in set(s.shapes) - {"rect"}:
                shapes[f"{s.rule}:{k}"] = shapes.get(f"{s.rule}:{k}", 0) + 1
        return {
            "steps": sum(1 for s in self.steps if s.level),
            "level2_steps": sum(1 for s in self.steps if s.level >= 2),
            "single_effect_steps": sum(1 for s in self.steps if s.level and len(s.effects) == 1),
            "order": order,
            "techniques": self.techniques(),
            "shape_steps": shapes,
            "technique_level": self.technique_level,
            "coupled_globals": self.coupled_globals,
        }

    def to_dict(self, steps: bool = True) -> dict[str, Any]:
        out: dict[str, Any] = {
            "status": self.status,
            "rating": self.rating if self.solved else None,
            "label": self.label if self.solved else None,
            "techniques": self.techniques(),
            "unresolved": self.unresolved,
            "summary": self.summary(),
        }
        if self.reason:
            out["reason"] = self.reason
        if steps:
            out["steps"] = [s.to_dict() for s in self.steps]
        if self.composition is not None:
            out["composition"] = self.composition
        return out


# A decision is a choice of the reference solution that the deduction has to settle (no clue states it,
# the empty board does not force it) and that changes the solution. One unit per item:
# - exchange: a (neighbor, slot) with a non-zero export or import. An export counts when a step other than
#   `flow` fixes its value (an export never fixed by a step is forced from the start) and no flow clue
#   publishes it. An import bar counts when a step other than `flow` lays it and no flow clue or column
#   record of that neighbor gives it; an import only found by counting the columns at the end is filling.
# - step: a pumping / turbining pair of the reference, when a step fixes the STEP option.
# - tall: a coal bar laid 2 high (the tall piece may be 1 or 2), unless an engaged clue lays it.
# - ramp: a coal ramp bar (trap / stair) whose place or width the deduction settles. A clue that gives it is
#   no decision: an engaged clue or a program (`bar`) naming it, or a step reading a clue (`given`,
#   `program`, `length`) that lays it. ramp_steps() says which rule laid each ramp decision.
# - carbon: 1 when the CO2 cap removes something (a `carbon` step).
# - stock: 1 when the dam's stock (max_cells, free inventory) is all used and an `exhausted` step applies it.
# - price: a price clue that forces its plant into a single cell (`top_price` step), per clue.
DECISION_TYPES = ("exchange", "step", "tall", "ramp", "carbon", "stock", "price")
MECHANIC_TYPES = ("exchange", "step", "tall", "ramp", "carbon", "stock")  # live mechanics (C3): price excluded


def decisions(g: dict[str, Any], steps: list[Step]) -> dict[str, int]:
    """{type: count} of the decisions of grid g (its reference solution) under the trace `steps`."""
    sol = g["solution"]
    clues = g.get("clues", [])
    out: dict[str, int] = {}

    def add(kind: str, k: int = 1) -> None:
        if k:
            out[kind] = out.get(kind, 0) + k

    flows = {(c["country"], c["col"], c.get("dir", "export")) for c in clues if c["type"] == "flow"}
    records = {(k[2:], c["col"]) for c in clues if c["type"] == "column" for k in c["counts"] if k.startswith("I:")}
    fixed_by: dict[tuple[str, int], str] = {}
    step_rule: str | None = None
    for s in steps:
        for nid, ex in s.exchanges.items():
            if nid == "step":
                step_rule = step_rule or s.rule
                continue
            for c, _v in ex.get("export", []):
                fixed_by.setdefault((nid, c), s.rule)
    for nid, values in sol.get("exports", {}).items():
        for c, v in enumerate(values):
            if v and (nid, c, "export") not in flows and fixed_by.get((nid, c), "flow") != "flow":
                add("exchange")
    placed_by: dict[tuple[str, int], str] = {}
    for s in steps:
        for p in s.placed:
            if p["piece"] == "I":
                placed_by.setdefault((p["country"], p["col"]), s.rule)
    imports = {(p["country"], p["col"]) for p in sol["placements"] if p["piece"] == "I"}
    add(
        "exchange",
        sum(
            1
            for x in imports
            if (*x, "import") not in flows and x not in records and placed_by.get(x, "given") not in ("given", "flow")
        ),
    )
    if sol.get("step") and step_rule is not None:
        add("step", len(sol["step"]))
    engaged = {(c["piece"], c["row"], c["col"], c["len"]) for c in clues if c["type"] == "engaged"}
    coal = g["pieces"].get("C", {})
    ramps = ramp_steps(g, steps)
    for p in sol["placements"]:
        if p["piece"] != "C" or (p["piece"], p["row"], p["col"], p["len"]) in engaged:
            continue
        if coal.get("shape", "rect") != "rect":
            add("ramp", int(ramps.get((p["row"], p["col"], p["len"])) is not None))
        elif p.get("height", 1) == 2:
            add("tall")
    if any(s.rule == "carbon" for s in steps):
        add("carbon")
    inv = g.get("inventory", {})
    cap = inv.get("pieces", {}).get("B", {}).get("max_cells")
    if cap is not None and inv.get("level") == "none":
        used = sum(p["len"] for p in sol["placements"] if p["piece"] == "B")
        if used == cap and any(s.rule == "exhausted" and any(r["piece"] == "B" for r in s.removed) for s in steps):
            add("stock")
    add("price", len({i for s in steps if s.rule == "top_price" for i in s.clues}))
    return dict(sorted(out.items(), key=lambda kv: DECISION_TYPES.index(kv[0])))


CLUE_RULES = ("given", "program", "length")  # steps that lay what a clue states


def ramp_steps(g: dict[str, Any], steps: list[Step]) -> dict[tuple[int, int, int], str | None]:
    """{(row, col, len): rule} for each ramp bar of the reference: the rule of the step that lays it,
    "eliminated" when no step lays it (every other place was excluded), or None when a clue gives it (engaged,
    a program naming it, or a step of CLUE_RULES). Rectangle coal: {}."""
    if g["pieces"].get("C", {}).get("shape", "rect") == "rect":
        return {}
    clues = g.get("clues", [])
    given = {(c["row"], c["col"], c["len"]) for c in clues if c["type"] == "engaged" and c["piece"] == "C"}
    programs = {(c["col"], c["len"]) for c in clues if c["type"] == "bar" and c["piece"] == "C"}
    laid: dict[tuple[int, int, int], str] = {}
    for s in steps:
        for p in s.placed:
            if p["piece"] == "C":
                laid.setdefault((p["row"], p["col"], p["len"]), s.rule)
    out: dict[tuple[int, int, int], str | None] = {}
    for p in g["solution"]["placements"]:
        if p["piece"] != "C":
            continue
        key = (p["row"], p["col"], p["len"])
        rule = laid.get(key)
        out[key] = None if key in given or key[1:] in programs or rule in CLUE_RULES else rule or "eliminated"
    return out


def ramp_settled_by(g: dict[str, Any], steps: list[Step]) -> dict[str, int]:
    """{rule: ramp decisions it settles} (lab measure): ramp_* techniques or the generic ones."""
    out: dict[str, int] = {}
    for rule in ramp_steps(g, steps).values():
        if rule is not None:
            out[rule] = out.get(rule, 0) + 1
    return dict(sorted(out.items()))


# Weight of one decision of each type in the compactness K (v3-criteres-j2.md §2).
DECISION_WEIGHTS = {"step": 3, "carbon": 3, "tall": 2, "ramp": 2, "exchange": 1, "stock": 1, "price": 1}


def compactness(g: dict[str, Any], dec: dict[str, int]) -> float:
    """K = weight of the decisions / pieces laid by the reference (bars and import bars), rounded to 0.01."""
    pieces = len(g["solution"]["placements"])
    weight = sum(DECISION_WEIGHTS[k] * v for k, v in dec.items())
    return round(weight / pieces, 2) if pieces else 0.0


def live_mechanics(dec: dict[str, int]) -> list[str]:
    """Mechanics that change the solution and that the deduction must find (C3): decision types but price."""
    return [k for k in MECHANIC_TYPES if dec.get(k)]
