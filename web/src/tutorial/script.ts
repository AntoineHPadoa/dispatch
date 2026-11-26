/*
 * The real tutorial scripts (format: types.ts), one per tutorial grid.
 * - INTRO: the guided tutorial grid (id 14), opened by the « Tutoriel » button; ends on the first « Premiers pas » grid.
 * - DISCOVERY: 1-2 spotlights the first time a « Premiers pas » grid is opened (ids 15-22, one novelty each).
 * - Texts are keys of TUTORIAL in i18n/fr.ts (`<key>.title` for bubble titles); rows are absolute, 0 at the bottom of the grid.
 * - Design and checks: docs/next/tutoriel-v5.html.
 */
import type { TutorialScript } from './types';

export const INTRO: TutorialScript = {
  gridId: 14, kind: 'intro', next: 15,
  steps: [
    { kind: 'present', title: 'intro.welcome.title', text: 'intro.welcome' },
    { kind: 'present', title: 'intro.board.title', text: 'intro.board', target: { kind: 'anchor', anchor: 'board' } },
    { kind: 'present', title: 'intro.production.title', text: 'intro.production', target: { kind: 'board', cols: [0, 7], rows: [0, 0] } },
    { kind: 'present', title: 'intro.book.title', text: 'intro.book', target: { kind: 'anchor', anchor: 'book' } },
    { kind: 'present', title: 'intro.clues.title', text: 'intro.clues', target: { kind: 'anchor', anchor: 'clues' } },
    { kind: 'present', title: 'intro.margins.title', text: 'intro.margins', target: { kind: 'anchor', anchor: 'margins' } },
    { kind: 'present', title: 'intro.tools.title', text: 'intro.tools', target: { kind: 'anchor', anchor: 'tools' } },
    { kind: 'guided', text: 'intro.reactors', target: { kind: 'board', cols: [0, 5], rows: [1, 2] }, technique: 'price_cap', moves: [{ action: 'place', bar: { piece: 'N', row: 1, col: 0, len: 6 }, anyRow: true }, { action: 'place', bar: { piece: 'N', row: 2, col: 0, len: 6 }, anyRow: true }] },
    { kind: 'guided', text: 'intro.dam', target: { kind: 'board', cols: [5, 5], rows: [3, 3] }, technique: 'record', moves: [{ action: 'place', bar: { piece: 'B', row: 3, col: 5, len: 1 } }] },
    { kind: 'guided', text: 'intro.gas3', target: { kind: 'board', cols: [2, 4], rows: [3, 3] }, technique: 'room', moves: [{ action: 'place', bar: { piece: 'G', row: 3, col: 2, len: 3 } }] },
    { kind: 'guided', text: 'intro.gas2', target: { kind: 'board', cols: [6, 7], rows: [1, 2] }, technique: 'room', moves: [{ action: 'place', bar: { piece: 'G', row: 1, col: 6, len: 2 }, anyRow: true }, { action: 'place', bar: { piece: 'G', row: 2, col: 6, len: 2 }, anyRow: true }] },
    { kind: 'guided', text: 'intro.tacs', target: { kind: 'board', cols: [6, 6], rows: [3, 4] }, technique: 'exhausted', moves: [{ action: 'place', bar: { piece: 'T', row: 3, col: 6, len: 1 }, anyRow: true }, { action: 'place', bar: { piece: 'T', row: 4, col: 6, len: 1 }, anyRow: true }] },
    { kind: 'present', title: 'intro.end.title', text: 'intro.end' },
  ],
};

export const DISCOVERY: TutorialScript[] = [
  { gridId: 15, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.export.title', text: 'discovery.export', target: { kind: 'exchange', country: 'DE', cols: [0, 5] } },
  ] },
  { gridId: 16, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.import.title', text: 'discovery.import', target: { kind: 'anchor', anchor: 'book' } },
    { kind: 'present', title: 'discovery.dailyExchanges.title', text: 'discovery.dailyExchanges', target: { kind: 'anchor', anchor: 'clues' } },
  ] },
  { gridId: 17, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.noBook.title', text: 'discovery.noBook', target: { kind: 'anchor', anchor: 'book' } },
  ] },
  { gridId: 18, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.step.title', text: 'discovery.step', target: { kind: 'anchor', anchor: 'step' } },
    { kind: 'present', title: 'discovery.stock.title', text: 'discovery.stock', target: { kind: 'anchor', anchor: 'chip:B' } },
  ] },
  { gridId: 19, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.tall.title', text: 'discovery.tall', target: { kind: 'anchor', anchor: 'chip:C' } },
  ] },
  { gridId: 20, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.ramp.title', text: 'discovery.ramp', target: { kind: 'anchor', anchor: 'chip:C' } },
  ] },
  { gridId: 21, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.co2.title', text: 'discovery.co2', target: { kind: 'anchor', anchor: 'co2' } },
  ] },
  { gridId: 22, kind: 'discovery', steps: [
    { kind: 'present', title: 'discovery.coupled.title', text: 'discovery.coupled', target: { kind: 'exchange', country: 'IT', cols: [0, 7] }, side: 'right' },
  ] },
];

/** Every script, by grid id. */
export const TUTORIAL_SCRIPTS: Readonly<Record<number, TutorialScript>> = Object.fromEntries(
  [INTRO, ...DISCOVERY].map((s) => [s.gridId, s]),
);
