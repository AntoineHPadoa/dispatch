"""Market bulletin draft (title, text, sky per slot) written from templates, without any language model.

- Traits come only from what the player sees: silhouette family, peak and surplus slots, neighbors,
  STEP, CO2 cap, coal shape, dam stock. Nothing from the solution, so the text never gives an answer away.
- Templates are data (bulletin_fr.json); the seed picks the variants.
- The draft goes to `lab.bulletin`; the lab adds `number` and `published` when it promotes the grid.

Example: make_bulletin(grid, "pointe_soir", random.Random(3)) -> {"title", "text", "weather"}
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from ..grid import residual
from .draft import with_article
from .silhouettes import sky

TEMPLATES = json.loads((Path(__file__).parent / "bulletin_fr.json").read_text())


def make_bulletin(g: dict[str, Any], family: str, rng: random.Random) -> dict[str, Any]:
    n = len(g["columns"])
    res = residual(g)
    t = TEMPLATES
    peak = g["columns"][max(range(n), key=lambda c: (res[c], c))]
    surplus = next((g["columns"][c] for c in range(n) if res[c] < 0), peak)
    start = next((g["columns"][c] for c in range(n) if res[c] >= max(res) - 1), g["columns"][0])
    fill = {"peak": peak, "surplus": surplus, "start": start}
    parts = [rng.choice(t["openings"][family]).format(**fill)]
    names = [with_article(nb["name"]) for nb in g["neighbors"]]
    pieces = g["pieces"]
    options: list[str] = []
    if len(names) == 1:
        country = names[0]
        options.append(
            rng.choice(t["mechanics"]["neighbors"]).format(country=country, Country=country[0].upper() + country[1:])
        )
    elif names:
        listed = ", ".join(names[:-1]) + " et " + names[-1]
        options.append(
            rng.choice(t["mechanics"]["neighbors_many"]).format(
                countries=listed, Countries=listed[0].upper() + listed[1:]
            )
        )
    if g["step"]:
        options.append(rng.choice(t["mechanics"]["step"]))
    if g.get("co2_cap") is not None:
        options.append(rng.choice(t["mechanics"]["co2"]).format(cap=g["co2_cap"]))
    if pieces.get("C", {}).get("shape", "rect") != "rect":
        options.append(rng.choice(t["mechanics"]["ramp"]))
    elif 2 in pieces.get("C", {}).get("height", []):
        options.append(rng.choice(t["mechanics"]["tall"]))
    stock = g["inventory"]["pieces"].get("B", {}).get("max_cells")
    if stock is not None:
        options.append(rng.choice(t["mechanics"]["stock"]).format(stock=stock))
    if not options:
        options.append(rng.choice(t["mechanics"]["none"]))
    parts.append(rng.choice(options))
    return {"title": rng.choice(t["titles"][family]), "text": " ".join(parts), "weather": sky(n, g["weather"]["R"])}
