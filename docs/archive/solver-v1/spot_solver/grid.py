"""Grid loading and normalization for Dispatch puzzles.

- Accepts v1 grids (`cost` per piece, top-level `co2_cap`) and v2 grids (`price`, `objective`).
- Accepts one legacy `neighbor` (read as neighbor "X", CO2 0, import piece "I") or a `neighbors` list
  (import piece "I:<id>", exports keyed by neighbor id).
- Exposes a single normalized `Grid` view used by the model, the evaluator and the generator.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

IMPORT = "I"
LEGACY_NEIGHBOR = "X"
DEFAULT_EXPORT_BUDGET = 2  # v2 only; v1 grids have no daily export budget


@dataclass(frozen=True)
class Piece:
    id: str
    lens: tuple[int, ...]
    price: int
    co2: int
    cap: int | None = None


@dataclass(frozen=True)
class Neighbor:
    id: str
    name: str
    price: tuple[int, ...]
    cap: int
    can_import: bool
    can_export: bool
    co2: int = 0
    export_budget: int | None = None  # total blocks exportable over the day (None = unlimited)


@dataclass
class Objective:
    optimize: str = "min_score"  # "min_score" | "target"
    target: int | None = None
    price_cap: int | None = None
    co2_cap: int | None = None
    no_import: bool = False
    smooth: int | None = None


@dataclass
class Grid:
    raw: dict[str, Any]
    columns: list[str]
    residual: list[int]
    pieces: dict[str, Piece]
    neighbors: list[Neighbor]
    legacy_neighbor: bool
    curtail_penalty: int | None
    step: int
    objective: Objective = field(default_factory=Objective)

    @property
    def n(self) -> int:
        return len(self.columns)

    def import_pid(self, nb: Neighbor) -> str:
        return IMPORT if self.legacy_neighbor else f"{IMPORT}:{nb.id}"

    @property
    def importers(self) -> dict[str, Neighbor]:
        """Import piece id -> neighbor, for neighbors that allow imports."""
        return {self.import_pid(nb): nb for nb in self.neighbors if nb.can_import}

    @property
    def exporters(self) -> list[Neighbor]:
        return [nb for nb in self.neighbors if nb.can_export]

    def is_import(self, pid: str) -> bool:
        return pid == IMPORT or pid.startswith(IMPORT + ":")

    def piece_price(self, pid: str, col: int) -> int:
        if self.is_import(pid):
            return self.importers[pid].price[col]
        return self.pieces[pid].price

    def piece_co2(self, pid: str) -> int:
        return self.importers[pid].co2 if self.is_import(pid) else self.pieces[pid].co2

    def piece_lens(self, pid: str) -> tuple[int, ...]:
        return (1,) if self.is_import(pid) else self.pieces[pid].lens

    def piece_cap(self, pid: str) -> int | None:
        return None if self.is_import(pid) else self.pieces[pid].cap

    def piece_ids(self, allow_import: bool = True) -> list[str]:
        ids = list(self.pieces)
        if allow_import:
            ids += list(self.importers)
        return ids

    @property
    def v1(self) -> bool:
        return is_v1(self.raw)

    def height_bound(self, col: int) -> int:
        """Upper bound of the height to pave in a column (all exports and pumps there)."""
        return max(0, self.residual[col] + sum(nb.cap for nb in self.exporters) + self.step)

    def read_exports(self, exports: Any) -> dict[str, list[int]]:
        """Solution exports (list for a legacy neighbor, dict by neighbor id otherwise)."""
        out = {nb.id: [0] * self.n for nb in self.neighbors}
        if isinstance(exports, list):
            if self.neighbors:
                out[self.neighbors[0].id] = list(exports)
        elif isinstance(exports, dict):
            for nid, vals in exports.items():
                out[nid] = list(vals)
        return out

    def write_exports(self, exports: dict[str, list[int]]) -> Any:
        if self.legacy_neighbor or not self.neighbors:
            return exports[self.neighbors[0].id] if self.neighbors else [0] * self.n
        return exports


def _neighbors(d: dict[str, Any]) -> tuple[list[Neighbor], bool]:
    default_budget = None if is_v1(d) else DEFAULT_EXPORT_BUDGET

    def make(nb: dict[str, Any], nid: str, co2: int) -> Neighbor:
        return Neighbor(nid, nb.get("name", nid), tuple(nb["price"]), int(nb.get("cap", 0)),
                        bool(nb.get("import")), bool(nb.get("export")), co2,
                        nb.get("export_budget", default_budget))

    if d.get("neighbors"):
        return [make(nb, nb["id"], int(nb.get("co2", 0))) for nb in d["neighbors"]], False
    if d.get("neighbor"):
        return [make(d["neighbor"], LEGACY_NEIGHBOR, 0)], True
    return [], True


def from_dict(d: dict[str, Any]) -> Grid:
    pieces = {}
    for pid, p in d["pieces"].items():
        price = p["price"] if "price" in p else p["cost"]
        pieces[pid] = Piece(pid, tuple(sorted(p["len"])), int(price), int(p.get("co2", 0)), p.get("cap"))
    neighbors, legacy = _neighbors(d)
    obj_raw = d.get("objective") or {}
    cons = obj_raw.get("constraints") or {}
    objective = Objective(
        optimize=obj_raw.get("optimize", "min_score"),
        target=obj_raw.get("target"),
        price_cap=cons.get("price_cap"),
        co2_cap=cons.get("co2_cap", d.get("co2_cap")),
        no_import=bool(cons.get("no_import", False)),
        smooth=cons.get("smooth"),
    )
    return Grid(
        raw=d,
        columns=list(d["columns"]),
        residual=[int(v) for v in d["residual"]],
        pieces=pieces,
        neighbors=neighbors,
        legacy_neighbor=legacy,
        curtail_penalty=d.get("curtail_penalty"),
        step=int(d.get("step") or 0),
        objective=objective,
    )


def load_grids(path: str | Path) -> list[dict[str, Any]]:
    """Load a file holding one grid object or a list of grids (or {"grids": [...]})."""
    data = json.loads(Path(path).read_text())
    if isinstance(data, dict) and "grids" in data:
        data = data["grids"]
    if isinstance(data, dict):
        data = [data]
    return data


def is_v1(d: dict[str, Any]) -> bool:
    """A v1 grid prices pieces with `cost` and stores `optimum.cost`/`facture`."""
    return any("cost" in p for p in d["pieces"].values()) and "objective" not in d
