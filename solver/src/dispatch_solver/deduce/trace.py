"""Deduction techniques (GAME-DESIGN.md §9), trace steps and the result of a deduction run.

- RULES: id, French name, level and the sentence shown to the player (tutorial). Ids are the ones the
  grids and web/src/i18n/fr.ts already use; `length` is new (the `length` clue had no technique).
- Step: one application of a technique, with what it changed (placements, silhouette), where (cells),
  why (clue indices) and which shapes were involved (rect, tall, ramp_trapezoid, ramp_stair).
- Result.summary(): the measures kept for the lab and the difficulty calibration.
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
    Rule("given", "Centrale engagée", 0, "Une centrale déjà posée par l'énoncé est acquise."),
    Rule(
        "room",
        "Pas de place",
        1,
        "Une centrale ne peut ni dépasser de la silhouette ni chevaucher une centrale déjà posée.",
    ),
    Rule(
        "exhausted",
        "Inventaire épuisé",
        1,
        "Quand toutes les cases d'une pièce sont trouvées, elle ne va nulle part ailleurs ; une centrale plus "
        "grande que ce qu'il reste ne passe plus.",
    ),
    Rule(
        "price_cap", "Le prix plafonne la colonne", 1, "Sous un prix publié, aucune case n'est plus chère que ce prix."
    ),
    Rule(
        "record",
        "Le relevé compte les cases",
        1,
        "Un relevé (d'un créneau ou de la journée) donne un nombre de cases ou d'échanges : s'il est atteint, "
        "plus aucun ; s'il reste juste assez de places possibles, elles y passent toutes.",
    ),
    Rule(
        "flow", "Flux publié", 1, "Un flux d'interconnexion publié fixe l'export ou l'import d'un créneau avec un pays."
    ),
    Rule(
        "single_cover",
        "Une seule centrale pour cette case",
        1,
        "Une case à couvrir qu'une seule centrale peut encore couvrir la reçoit.",
    ),
    Rule(
        "single_spot",
        "La centrale qui ne tient qu'à un endroit",
        1,
        "Une centrale de l'inventaire qui n'a plus qu'une place possible y va.",
    ),
    Rule("program", "Programme publié", 1, "La centrale annoncée par un programme va à la seule place où elle tient."),
    Rule(
        "length",
        "Durée de marche",
        1,
        "La centrale dont on connaît la durée de marche va à la seule place où cette durée tient.",
    ),
    Rule(
        "silhouette",
        "La silhouette suit les centrales",
        1,
        "Un export ou un pompage qui laisserait une case impossible à couvrir, ou une centrale posée hors de la "
        "silhouette, est exclu.",
    ),
    Rule(
        "swap",
        "Cases interchangeables",
        1,
        "Quand on connaît le nombre de cases de chaque pièce dans une colonne, l'ordre ne compte pas.",
    ),
    Rule(
        "top_price",
        "La case la plus chère",
        2,
        "Un prix publié exige au moins une case de cette centrale dans la colonne : s'il n'y a qu'une place "
        "possible, c'est elle.",
    ),
    Rule(
        "ribbon",
        "Le creux coupe le ruban",
        2,
        "Chaque ligne se découpe en rubans entre les creux : une centrale qui laisserait un bout impossible à "
        "remplir est exclue, une centrale présente dans tous les découpages est posée.",
    ),
    Rule(
        "just_enough",
        "Inventaire juste",
        2,
        "S'il reste exactement autant de cases possibles que de cases à poser pour une pièce, toutes sont à elle.",
    ),
    Rule(
        "column_sum",
        "Compter la colonne",
        2,
        "Une colonne a autant de cases que sa hauteur : connaissant les autres pièces, on déduit celle qui reste.",
    ),
    Rule("carbon", "Plafond carbone", 2, "Une centrale qui ferait dépasser le plafond CO₂ est exclue."),
    Rule(
        "share_out",
        "Répartition de l'inventaire",
        3,
        "Les centrales doivent toutes trouver une ligne : un découpage qui empêche les autres de se placer est exclu.",
    ),
    Rule(
        "refuted",
        "Hypothèse réfutée",
        4,
        "Si un choix mène à une impasse par les règles simples, il est exclu (une seule hypothèse, jamais imbriquée).",
    ),
]
RULES = {r.id: r for r in RULE_LIST}


@dataclass
class Step:
    rule: str
    effects: list[str]
    removed: list[dict[str, Any]] = field(default_factory=list)
    placed: list[dict[str, Any]] = field(default_factory=list)
    cells: list[tuple[int, int]] = field(default_factory=list)
    clues: list[int] = field(default_factory=list)
    shapes: list[str] = field(default_factory=list)

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
        for k in ("removed", "placed", "clues", "shapes"):
            if getattr(self, k):
                out[k] = getattr(self, k)
        if self.cells:
            out["cells"] = [list(x) for x in sorted(set(self.cells))]
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
    def rating(self) -> int:
        return max([s.level for s in self.steps] + [1])

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
