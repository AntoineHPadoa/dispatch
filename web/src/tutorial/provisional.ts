/*
 * Provisional tutorial script on grid 7 (STEP, exchanges, exact inventory), to exercise the
 * spotlight and guided-solve engine until the real tutorial grid exists.
 */
import type { TutorialScript } from './types';

export const PROVISIONAL_SCRIPT: TutorialScript = {
  gridId: 7,
  kind: 'intro',
  steps: [
    { kind: 'present', title: 'demo.welcome.title', text: 'demo.welcome' },
    { kind: 'present', title: 'demo.board.title', text: 'demo.board', target: { kind: 'anchor', anchor: 'board' } },
    { kind: 'present', title: 'demo.book.title', text: 'demo.book', target: { kind: 'anchor', anchor: 'book' }, side: 'left' },
    { kind: 'present', title: 'demo.clues.title', text: 'demo.clues', target: { kind: 'anchor', anchor: 'clues' }, side: 'left' },
    { kind: 'present', title: 'demo.exchanges.title', text: 'demo.exchanges', target: { kind: 'exchange', country: 'DE', cols: [0, 7] } },
    { kind: 'present', title: 'demo.margins.title', text: 'demo.margins', target: { kind: 'anchor', anchor: 'margins' } },
    { kind: 'present', title: 'demo.tools.title', text: 'demo.tools', target: { kind: 'anchor', anchor: 'tools' } },
    { kind: 'guided', technique: 'silhouette', text: 'demo.step', target: { kind: 'board', cols: [3, 4] }, moves: [{ action: 'addStep', pump: 3, turbine: 4 }] },
    { kind: 'guided', technique: 'price_cap', text: 'demo.row0a', target: { kind: 'board', cols: [0, 2], rows: [0, 0] }, moves: [{ action: 'place', bar: { piece: 'N', row: 0, col: 0, len: 3 } }] },
    { kind: 'guided', technique: 'column_sum', text: 'demo.row0b', target: { kind: 'board', cols: [3, 5], rows: [0, 0] }, moves: [{ action: 'place', bar: { piece: 'N', row: 0, col: 3, len: 3 } }] },
    { kind: 'guided', technique: 'record', text: 'demo.imports', target: { kind: 'board', cols: [6, 7], rows: [0, 0] }, moves: [
      { action: 'place', bar: { piece: 'I', country: 'DE', row: 0, col: 6, len: 1 } },
      { action: 'place', bar: { piece: 'I', country: 'DE', row: 0, col: 7, len: 1 } },
    ] },
    { kind: 'guided', technique: 'just_enough', text: 'demo.rest', target: { kind: 'board', cols: [0, 7], rows: [1, 3] }, moves: [
      { action: 'place', bar: { piece: 'N', row: 1, col: 0, len: 4 } },
      { action: 'place', bar: { piece: 'N', row: 1, col: 4, len: 4 } },
      { action: 'place', bar: { piece: 'N', row: 2, col: 1, len: 4 } },
      { action: 'place', bar: { piece: 'N', row: 2, col: 5, len: 3 } },
      { action: 'place', bar: { piece: 'N', row: 3, col: 3, len: 4 } },
    ] },
    { kind: 'present', title: 'demo.end.title', text: 'demo.end' },
  ],
};
