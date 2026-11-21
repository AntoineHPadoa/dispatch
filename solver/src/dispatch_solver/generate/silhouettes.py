"""Silhouette families: demand and weather of a drawn day, coherent with the time of day.

- Each family shapes the demand over the day (hour of each column) and the renewables R (sun by day,
  wind by night); the residual (demand - R - F) is what the plants fill.
- draw_day() returns (family, demand, R, F) with the residual clipped to [lo, height] by adjusting the
  demand (R keeps the family's sun and wind), except where the family wants a surplus (negative residual,
  absorbed by an export or pumping).
- sky() gives the bulletin weather of each slot: moon, wind, sun or cloud.

Example: family, demand, r, f = draw_day(random.Random(1), 8, "pointe_soir", height=6)
"""

from __future__ import annotations

import math
import random

FAMILIES = (
    "pointe_soir",
    "deux_bosses",
    "midi_solaire",
    "nuit_plate",
    "surplus_midi",
    "plateau_hiver",
    "vent_nocturne",
)
DAY = (6, 20)  # hours with daylight


def hours(n: int) -> list[float]:
    return [c * 24 / n + 12 / n for c in range(n)]  # middle of each slot


def _bump(t: float, center: float, width: float) -> float:
    return math.exp(-(((t - center) / width) ** 2))


def _shape(family: str, t: float) -> tuple[float, float, float]:
    """(demand 0..1, sun 0..1, wind 0..1) at hour t."""
    sun = _bump(t, 13, 3.2) if DAY[0] <= t < DAY[1] else 0.0
    night = 1.0 if t < DAY[0] or t >= 21 else 0.0
    if family == "pointe_soir":
        return 0.35 + 0.65 * _bump(t, 19, 2.5) + 0.15 * _bump(t, 9, 2), 0.4 * sun, 0.0
    if family == "deux_bosses":
        return 0.3 + 0.6 * _bump(t, 9, 2) + 0.7 * _bump(t, 19, 2), 0.3 * sun, 0.0
    if family == "midi_solaire":
        return 0.55 + 0.3 * _bump(t, 19, 2.5), 1.0 * sun, 0.0
    if family == "surplus_midi":
        return 0.45 + 0.35 * _bump(t, 19, 2.5), 1.25 * sun, 0.0
    if family == "nuit_plate":
        return 0.75 + 0.15 * _bump(t, 12, 5), 0.2 * sun, 0.1 * night
    if family == "plateau_hiver":
        day = 1.0 if 7 <= t < 21 else 0.0
        return 0.45 + 0.5 * day, 0.15 * sun, 0.0
    if family == "vent_nocturne":
        return 0.5 + 0.45 * _bump(t, 18, 3), 0.25 * sun, 0.8 * night
    raise ValueError(family)


def draw_day(
    rng: random.Random, n: int, family: str, height: int = 6, lo: int = 1, f: int | None = None
) -> tuple[str, list[int], list[int], list[int]]:
    """Demand, R and F for `n` slots; residual in [lo, height] (a surplus family may go below 0 once)."""
    if family == "any":
        family = rng.choice(FAMILIES)
    f_val = rng.choice([0, 0, 1]) if f is None else f
    peak = height + rng.randint(1, 3)  # demand scale (residual + renewables)
    demand, r = [], []
    for t in hours(n):
        d, sun, wind = _shape(family, t)
        dem = round(peak * d + rng.uniform(-0.6, 0.6))
        ren = round((sun + wind) * peak * 0.55 + rng.uniform(-0.4, 0.4))
        demand.append(dem)
        r.append(max(0, ren))
    residual = [demand[c] - r[c] - f_val for c in range(n)]
    surplus_col = None
    if family == "surplus_midi":
        day = [c for c, t in enumerate(hours(n)) if 10 <= t < 16]
        surplus_col = rng.choice(day) if day else None
    for c in range(n):
        want = min(height, max(lo, residual[c]))
        if c == surplus_col:
            want = -1
            r[c] = max(r[c], demand[c] - f_val - want, 1 - f_val)  # the sun makes the surplus
        # Clip the demand, not the weather: R stays what the family drew (the sky follows it).
        demand[c] = want + r[c] + f_val
    return family, demand, r, [f_val] * n


def sky(n: int, r: list[int]) -> list[str]:
    out = []
    for t, x in zip(hours(n), r, strict=True):
        if DAY[0] <= t < DAY[1]:
            out.append("sun" if x >= 2 else "cloud")
        else:
            out.append("wind" if x > 0 else "moon")
    return out
