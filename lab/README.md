# Lab

Local tool to generate, play, rate and promote candidate grids. Launch: `lab/run.sh`, then open `http://localhost:5173/dispatch/lab.html`.

## Files (all in `lab/`, versioned)

- `candidates/<lot>.json`: grids written by `dispatch-solver generate`, with a `lab` block (index from 0, family, mechanics, trace summary, bulletin draft). A lot name is never reused: the server refuses an existing one, so `lot:index` always points to the same grid.
- `plays.jsonl`: one JSON line per game (below).
- `notes.json`: per `lot:index`: `kept`, `comment`, `felt` (first rating of each player), `bulletin` edits, `promoted`.

## `plays.jsonl` format (schema 1)

| Field | Meaning |
|---|---|
| `schema` | 1 |
| `id` | unique id of the play (hex) |
| `player`, `lot`, `index` | who played which candidate (`index` from 0, shown as `index + 1`) |
| `grid_hash` | sha1 of the grid without its `lab` block: the exact grid played |
| `attempt` | 1 for the first play of this grid by this player, then 2, 3… A replay of a known grid has a biased time and error count: filter on `attempt == 1` to calibrate |
| `started`, `ts` | start and end of the game, epoch seconds |
| `outcome` | `solved` (saved at the solve) or `abandoned` |
| `ms` | active time: the time the tab was hidden is not counted |
| `wall_ms` | wall-clock time, hidden time included (`wall_ms >= ms`) |
| `errors` | a pose refused by the engine, or a pose that contradicts a clue. An export or a STEP pair that contradicts a clue is **not** counted |
| `undos`, `erasers`, `resets` | undo presses, erasures with the eraser, resets |
| `felt` | perceived difficulty 1 to 4, set once from the end screen (`null` until then, and for abandoned games left by closing the tab) |
| `reason` | `unload` when the game was recorded by closing or reloading the tab, else `null` |

An abandoned game is recorded when the player gives up, leaves the game screen, reloads or closes the tab (after 2 s of play). A solved game is recorded at the solve and stays solved whatever the player does next.

## Blind rules

- The grid sent to the game has no `lab` block, no bulletin, no draft title or difficulty.
- The list, the plays and the notes hide the solver rating, techniques, steps, the draft title and the other player's measures (time, errors, rating) on every candidate the current player has not rated yet. `Mode création` (top bar) shows everything, to sort a lot without playing it: do not calibrate with it on.
- `/api/reveal` answers 403 until the player has rated the candidate.

## Server safety

Listens on 127.0.0.1. Every request must carry a local `Host`; a request with an `Origin` other than `localhost:5173` or `127.0.0.1:5173` is refused; writes must be `Content-Type: application/json`.
