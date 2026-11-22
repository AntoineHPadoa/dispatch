"""Helpers to write the review's trap grids (review S4.2): base() gives a valid §14 skeleton."""
import json, sys

def base(n=6, demand=None, pieces=None, neighbors=(), step=False, clues=(), inventory=None, R=None, co2_cap=None, solution=None):
    pieces = pieces or {"T": {"len": [1], "height": [1], "rank": 5, "co2": 2}}
    return {
        "id": 1, "title": "trap", "section": "rated",
        "columns": [f"{4*c}h" if n == 6 else f"{2*c}h" for c in range(n)],
        "demand": demand, "pieces": pieces,
        "weather": {"R": R or [0]*n, "F": [0]*n},
        "neighbors": list(neighbors), "step": step, "co2_cap": co2_cap,
        "inventory": inventory or {"level": "none", "pieces": {p: {} for p in pieces}},
        "clues": list(clues),
        "solution": solution or {"exports": {}, "step": [], "placements": []},
        "difficulty": {"rating": 1, "label": "Facile", "techniques": []},
    }
