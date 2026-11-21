"""Human deduction solver (GAME-DESIGN.md §9): deduce() runs it on a §14 grid.

Example: res = deduce(grid); res.status, res.rating, res.techniques(), res.summary()
"""

from __future__ import annotations

from typing import Any

from ..board import Puzzle
from .rules import Solver
from .state import Contradiction, State, View
from .trace import RULE_LIST, RULES, Result, Rule, Step

__all__ = ["RULES", "RULE_LIST", "Contradiction", "Result", "Rule", "Solver", "State", "Step", "View", "deduce"]


def deduce(g: dict[str, Any] | Puzzle, max_level: int = 4, record: bool = True) -> Result:
    """Run the deduction solver on a grid with its own clues."""
    pz = g if isinstance(g, Puzzle) else Puzzle(g)
    return Solver(pz, max_level=max_level, record=record).run()
