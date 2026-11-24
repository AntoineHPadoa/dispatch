# Lab

Local tool to generate, play, rate and promote candidate grids. Launch: `lab/run.sh`, then open `http://localhost:5173/dispatch/lab.html`. What the sessions established, the method to keep and the backlog: `docs/next/v3-synthese.md`.

## Files (all in `lab/`, versioned)

- `lots/<lot>.json`: generator configs. `lots/reference.json` holds the settings to start from: copy it, rename the lot, change the seed.
- `candidates/<lot>.json`: grids written by `dispatch-solver generate`, with a `lab` block (index from 0, family, mechanics, trace summary, decisions, measures, bulletin draft; listed in `GAME-DESIGN.md` §10). A lot name is never reused: the server refuses an existing one, so `lot:index` always points to the same grid.
- `candidates/archive/<lot>.json`: lots set aside: a rule change made their grids invalid, or a newer lot replaced them unplayed. Not listed by the lab and read-only: their `lot:index` keys still resolve for notes, plays and sessions (a session item there shows as not playable), but they cannot be played, drawn into a session or promoted, and their names are never reused (server and `dispatch-solver generate` both refuse them). `sessions/archive/` holds abandoned sessions, not listed.
- `sessions/<id>.json`: an ordered list of candidates to play in a row: `{"title": …, "items": [{"lot": …, "index": …, "hold"?: "text"}, …]}` (`index` from 0). An item with `hold` is shown with that text and cannot be launched. Page: `#/session` (lists every session, newest first), `#/session/<id>`. A session is written by hand or drawn from a lot (below).
- `plays.jsonl`: one JSON line per game (below).
- `candidates/V3*.md`: one report per generator version (what changed, lot figures).
- `notes.json`: per `lot:index`: `kept` (`{player: true}`, the ★ of each player; an older boolean is read as « Joueur 1 »'s), `comment` (`{player: text}`, one per player; `""` for an older comment whose author is unknown), `felt` (first rating of each player), `bulletin` edits, `promoted`.

## `plays.jsonl` format (schema 1)

| Field | Meaning |
|---|---|
| `schema` | 1 |
| `id` | unique id of the play (hex) |
| `player`, `lot`, `index` | who played which candidate (`index` from 0, shown as `index + 1`) |
| `grid_hash` | sha1 of the grid without its `lab` block: the exact grid played |
| `attempt` | 1 for the first play of this grid by this player, then 2, 3… A replay of a known grid has a biased time and error count: filter on `attempt == 1` to calibrate (the lab's aggregates do) |
| `phantom` | `true` for a stray open: abandoned without any move, or within 10 s. It does not count as an attempt, so the real first game keeps `attempt: 1` |
| `started`, `ts` | start and end of the game, epoch seconds |
| `outcome` | `solved` (saved at the solve) or `abandoned` |
| `ms` | active time: the time the tab was hidden is not counted |
| `wall_ms` | wall-clock time, hidden time included (`wall_ms >= ms`) |
| `errors` | a pose refused by the engine, or a pose that contradicts a clue. An export or a STEP pair that contradicts a clue is **not** counted |
| `undos`, `erasers`, `resets` | undo presses, erasures with the eraser, resets |
| `moves` | poses, exports and STEP pairs laid (missing in plays recorded before it existed) |
| `felt` | perceived difficulty 1 to 4, set once from the end screen (`null` until then, and for abandoned games left by closing the tab) |
| `reason` | `unload` when the game was recorded by closing or reloading the tab, else `null` |

An abandoned game is recorded when the player gives up, leaves the game screen, reloads or closes the tab (after 2 s of play). A solved game is recorded at the solve and stays solved whatever the player does next.

## Blind rules

- The grid sent to the game has no `lab` block, no bulletin, no draft title or difficulty.
- The list, the plays and the notes hide the solver rating, techniques, steps, the draft title and the other player's measures (time, errors, rating) on every candidate the current player has not rated yet. `Mode création` (top bar) shows everything, to sort a lot without playing it: do not calibrate with it on.
- `/api/reveal` answers 403 until the player has rated the candidate.
- Comments (`notes.json`) are hidden with the felt ratings: another player's « trop dur » shows only after the player's own rating.
- Not blind, by choice: `/api/bulletin/<lot>/<i>` serves the bulletin draft (title, text) to the « Gardées » screen, even for a candidate kept without being played. The title can hint at the mechanics (« Frontière ouverte »), never at the rating.

## Server safety

Listens on 127.0.0.1. Every request must carry a local `Host`; a request with an `Origin` other than `localhost` or `127.0.0.1` on the Vite port (5173) or the server port (8765 by default) is refused; writes must be `Content-Type: application/json`.

## Sessions

- Server: `GET /api/sessions` (id, title, count; newest first by the `created` time stored in the file, else the file time) and `GET /api/session/<id>?player=…`: items in order with `position`, `lot`, `index`, `number` (index + 1), `state` for that player (`solved`, `abandoned`, `todo`; stray `phantom` plays ignored, a solve wins over an abandon), `attempts`, `playable` and `hold`. Nothing else is sent: no note, rating, technique or draft title, so the blind rules hold.
- Page `#/session/<id>`: numbered list, progress « 7 / 16 », « Jouer la suivante » (first item not solved, not held, playable; an abandoned grid is played again).
- A game started from the session has the id in its hash (`#/partie/<lot>/<i>/<session>`, then `#/fin/<lot>/<i>/<session>`). The end screen is the usual one, plus a reminder « Belle ou pas belle, et pourquoi ? », « Retour à la session » and « Grille suivante » (enabled once the rating is validated). After the last grid: `#/session/<id>/fin`, with « Session terminée » when nothing is left to play.

### Nouvelle session (tirage)

- Page: on the lot list, « Nouvelle session » with an editable size (6 by default, a casual player's session; capped to the lot size) draws a session, writes it and opens it in the « Session » tab.
- Server: `POST /api/sessions` with `{lot, size?, player?}` writes `lab/sessions/<lot>-<n>.json` (`n` = last number used for the lot + 1, remembered in `lab/sessions/.counters.json` and not only read from the files: a name is never reused, even after deleting the latest session) and returns the session as `GET /api/session/<id>` does.
- Draw (`draw_session`), deterministic (seed = `<lot>:<n>`): playable candidates only (no staircase), minus those the `player` has already played (a non-phantom play, `attempt >= 1`; without `player`, nothing is excluded).
  - Balance: same count per solver rating when possible (round-robin, a rating short of candidates gives its share to the others), then within a rating the candidate that adds the least to the families and mechanics already drawn.
  - Order: a random permutation (same seed) under two constraints: a short grid first (8 slots; the easiest of the short ones drawn; any grid if none is short), then never two long grids (12 slots or more) in a row when the drawn grids allow it. No rule on neighbouring ratings: any pattern in the order would reveal the rating of the next grid once the player has seen the previous ones.
  - Candidates without a solver rating are left out (they cannot be balanced).
- Blind: the rating is used on the server only. The file holds `title`, `created` (epoch seconds) and `items: [{lot, index}]`; the answer has no rating, technique or draft title.

## ★ per player

- `PUT /api/notes/<lot>/<i>` with `{"kept": true|false, "player": "Joueur 2"}` sets or clears the ★ of that player only (a known player is required, like for a comment). `notes.json` keeps `kept: {player: true}`; a boolean `kept` from an older file is read as Joueur 1's (`lab_server.LEGACY_PLAYER`) and rewritten on the next note update.
- Blind, like the other measures: a player always sees their own ★; another player's ★ shows only once the viewer has rated the grid (or in creation mode). The candidate list carries `kept` (own ★, used by the star column and the « gardée » filter) and `kept_any` (someone's ★, once visible).
- Promotion: a grid is kept, and listed in « Gardées », as soon as one player has kept it (`kept_any`).
- Migration of an existing `notes.json` (legacy ★ to Joueur 1; Joueur 2 starred the grids of `sessions/v3-joueur2.json` he solved; run it with the lab server stopped): `solver/.venv/bin/python lab/scripts/migrate_stars.py` from the repository root (`--dry-run` first; the old file is saved as `notes.json.bak`; idempotent). Tests: `lab/tests/test_migrate_stars.py`.

## Measures and difficulty

- The `lab` block measures each grid for analysis only (decisions, `cells`, nuclear share, K, holes…); none is a filter except the reject of a grid without any decision. Which ones held up: `docs/next/v3-synthese.md` §2.
- Objective difficulty rule, computed next to the felt rating from a first play (`GAME-DESIGN.md` §10): abandoned → Expert; else ≥ 6 s per cell → Difficile; else an eraser, undo or reset, or ≥ 2.5 s per cell → Moyen; else Facile. `errors` do not count.
