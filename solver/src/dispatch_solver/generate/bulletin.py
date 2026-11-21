"""Market bulletin draft (title, text, sky per slot) written from templates, without any language model.

- Traits come only from what the player sees: silhouette family, peak and surplus slots, neighbors,
  STEP, CO2 cap, coal shape (piece definition, not its placements), dam stock. Nothing from the solution,
  so the text never gives an answer away (tested: same bulletin without the solution).
- Titles: by family and by visible trait (« Le lac remonte », « Ligne chargée »…); a lot avoids repeats.
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
from .silhouettes import DAY, hours, sky

TEMPLATES = json.loads((Path(__file__).parent / "bulletin_fr.json").read_text())


def traits(g: dict[str, Any]) -> list[str]:
    """Mechanics the player sees on the grid (never the solution)."""
    out = []
    if g["step"]:
        out.append("step")
    if g["neighbors"]:
        out.append("neighbors")
    if g.get("co2_cap") is not None:
        out.append("co2")
    coal = g["pieces"].get("C", {})
    if coal.get("shape", "rect") != "rect":
        out.append(f"ramp_{coal['shape']}")
    elif 2 in coal.get("height", []):
        out.append("tall")
    if g["inventory"]["pieces"].get("B", {}).get("max_cells") is not None:
        out.append("stock")
    return out


def make_bulletin(
    g: dict[str, Any], family: str, rng: random.Random, avoid: set[str] | frozenset[str] = frozenset()
) -> dict[str, Any]:
    """Draft bulletin from the visible grid only; `avoid`: titles already used in the lot."""
    n = len(g["columns"])
    res = residual(g)
    t = TEMPLATES
    hrs = hours(n)
    cols = g["columns"]
    peak = cols[max(range(n), key=lambda c: (res[c], c))]
    afternoon = [c for c in range(n) if hrs[c] >= 12] or list(range(n))
    evening = cols[max(afternoon, key=lambda c: (res[c], c))]
    surplus = next((cols[c] for c in range(n) if res[c] < 0), peak)
    day = [c for c in range(n) if hrs[c] >= DAY[0]]
    top = max(res[c] for c in day)
    start = next((cols[c] for c in day if res[c] >= top - 1), cols[0])
    fill = {"peak": peak, "evening": evening, "surplus": surplus, "start": start}
    parts = [rng.choice(t["openings"][family]).format(**fill)]
    names = [with_article(nb["name"]) for nb in g["neighbors"]]
    tr = traits(g)
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
    for k in tr:
        if k == "neighbors":
            continue
        line = rng.choice(t["mechanics"][k])
        if k == "co2":
            line = line.format(cap=g["co2_cap"])
        elif k == "stock":
            line = line.format(stock=g["inventory"]["pieces"]["B"]["max_cells"])
        options.append(line)
    if not options:
        options.append(rng.choice(t["mechanics"]["none"]))
    parts.append(rng.choice(options))
    titles = list(t["titles"][family]) + [x for k in tr for x in t["trait_titles"].get(k, [])]
    fresh = [x for x in titles if x not in avoid] or titles
    return {"title": rng.choice(fresh), "text": " ".join(parts), "weather": sky(n, g["weather"]["R"])}
