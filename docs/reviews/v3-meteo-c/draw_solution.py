"""Check and draw the reference solution of lab candidates: weather bricks, straight bars, full coverage."""
import json, sys

def cells(p, pieces):
    shape = pieces.get(p["piece"], {}).get("shape", "rect")
    r, c, w, h = p["row"], p["col"], p["len"], p.get("height", 1)
    if shape == "trap":
        return [(r, c + i) for i in range(w)] + [(r + 1, c + i) for i in range(1, w - 1)]
    if shape == "stair":
        raise ValueError("stair")
    return [(r + j, c + i) for i in range(w) for j in range(h)]

def check(g):
    n = len(g["columns"]); sol = g["solution"]
    wth = [g["weather"]["R"][c] + g["weather"]["F"][c] for c in range(n)]
    top = list(g["demand"])
    for e in sol.get("exports", {}).values():
        for c in range(n): top[c] += e[c]
    for s in sol.get("step", []):
        top[s["pump"]] += 1; top[s["turbine"]] -= 1
    grid = {}; errs = []
    for c in range(n):
        for r in range(wth[c]):
            grid[(r, c)] = "R" if r >= g["weather"]["F"][c] else "F"
    for k, p in enumerate(g["placements"] if "placements" in g else sol["placements"]):
        for rc in cells(p, g["pieces"]):
            if rc in grid: errs.append(f"p{k} {p['piece']} overlaps {grid[rc]} at {rc}")
            grid[rc] = p["piece"].lower() if k % 2 else p["piece"]
    for c in range(n):
        if wth[c] > top[c]: errs.append(f"weather above top col {c}")
        for r in range(max(top[c], wth[c]) + 3):
            if (r < top[c]) != ((r, c) in grid): errs.append(f"cell {(r, c)} {'empty' if r < top[c] else 'over top'}")
    return errs, grid, top, n

def draw(grid, top, n):
    H = max(max(top), max(r for r, _ in grid) + 1)
    return "\n".join("".join(grid.get((r, c), "." if r < top[c] else " ") for c in range(n)) for r in range(H - 1, -1, -1))

if __name__ == "__main__":
    path = sys.argv[1]; idx = [int(x) for x in sys.argv[2:]]
    for i, g in enumerate(json.load(open(path))):
        errs, grid, top, n = check(g)
        if errs: print(path, i, errs[:5])
        if i in idx:
            print(f"--- {path.split('/')[-1]}:{i} weather R={g['weather']['R']} F={g['weather']['F']}"); print(draw(grid, top, n))
