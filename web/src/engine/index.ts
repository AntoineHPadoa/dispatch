/*
 * Dispatch game engine: pure functions, no DOM, immutable state.
 * - State: newGame, solutionState, silhouette, residual, weatherCells (rows are absolute, 0 at the bottom of the grid).
 * - Actions: place, remove, setExport, addStep, removeStep (each returns {ok, state, error?}).
 * - Checks: checkPlacement (live preview), evaluate (errors, clues, inventory, solved).
 *
 * Example:
 *   let s = newGame(grid);
 *   const r = place(grid, s, {piece: 'N', row: 0, col: 0, len: 6});
 *   if (r.ok) s = r.state;
 *   evaluate(grid, s).unmet;   // French reasons the grid is not solved yet
 */
export * from './state';
export * from './rules';
export * from './evaluate';
export { clueText } from '../i18n/fr';
