"""Piece shapes, cell by cell.

- A shape is a list of columns (bottom offset, height) from its lower-left corner. Rectangles come from
  `len` x `height`; coal ramps (`shape`, behind the ramp flag, docs/next/rampe.md) from their profile:
  - trap: 1 -> 2 -> 1, shoulders of one cell, plateau of two, total width `len` (>= 3);
  - stair: 2 -> 1, two cells on `len` - 1 slots then a one-cell step on the right (`len` >= 2).
- A ramp's `row` is its base row. Every shape covers one contiguous run of columns in each row it touches
  (the ribbon rule relies on it).
- A placement is a shape laid at (row, col); its §14 form is `{piece, row, col, len[, height]}`.

Example: shapes_of({"shape": "trap", "len": [3]}) -> [Shape(3, 2, ((0, 1), (0, 2), (0, 1)), "ramp_trap")]
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

Cell = tuple[int, int]  # row, col


@dataclass(frozen=True)
class Shape:
    width: int
    height: int  # plateau / rectangle height, as written in §14 `height`
    columns: tuple[tuple[int, int], ...]  # per column: (bottom offset, height)
    kind: str  # rect | tall | ramp_trap | ramp_stair

    def cells(self, row: int, col: int) -> frozenset[Cell]:
        return frozenset((row + b + k, col + dc) for dc, (b, h) in enumerate(self.columns) for k in range(h))

    def top(self, dc: int) -> int:
        """Rows used in column `dc` of the shape, from its bottom row."""
        b, h = self.columns[dc]
        return b + h


def rect(width: int, height: int) -> Shape:
    return Shape(width, height, tuple((0, height) for _ in range(width)), "rect" if height == 1 else "tall")


def shapes_of(d: dict[str, Any]) -> list[Shape]:
    """Allowed shapes of a §14 piece definition."""
    kind = d.get("shape", "rect")
    if kind == "trap":
        return [Shape(w, 2, ((0, 1),) + ((0, 2),) * (w - 2) + ((0, 1),), "ramp_trap") for w in d["len"]]
    if kind == "stair":
        return [Shape(w, 2, ((0, 2),) * (w - 1) + ((0, 1),), "ramp_stair") for w in d["len"]]
    return [rect(w, h) for h in d["height"] for w in d["len"]]


@dataclass(frozen=True)
class Placement:
    """One shape of one piece laid at (row, col). `key` is the composition key (piece id or I:<country>)."""

    key: str
    piece: str  # piece id, or "I" for an import
    country: str | None
    shape: Shape
    row: int
    col: int
    cells: frozenset[Cell]

    @property
    def width(self) -> int:
        return self.shape.width

    @property
    def height(self) -> int:
        return self.shape.height

    def cells_in(self, c: int) -> int:
        if self.col <= c < self.col + self.width:
            return self.shape.columns[c - self.col][1]
        return 0

    def row_span(self, r: int) -> tuple[int, int] | None:
        """Columns [a, b) this placement covers in row r, or None."""
        cs = [c for rr, c in self.cells if rr == r]
        return (min(cs), max(cs) + 1) if cs else None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"piece": self.piece, "row": self.row, "col": self.col, "len": self.width}
        if self.height != 1 and not self.shape.kind.startswith("ramp"):
            out["height"] = self.height
        if self.country is not None:
            out["country"] = self.country
        return out

    def label(self, columns: list[str]) -> str:
        end = self.col + self.width
        tail = columns[end] if end < len(columns) else "24h"
        size = f"{self.width}" if self.height == 1 else f"{self.width}x{self.height}"
        return f"{self.key} {size} row {self.row + 1} {columns[self.col]}-{tail}"
