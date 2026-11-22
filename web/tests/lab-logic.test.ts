// Lab logic: filters, sort, play recorder, aggregates, bulletin helpers.
import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from '../src/i18n/fr';
import {
  PlayRecorder, displayNumber, feltAverage, filterCandidates, formatDuration, lotTemplate, nextLotName, nextWeather, noFilters,
  playStats, sortCandidates, techniqueLabel, type Candidate, type Play,
} from '../src/lab/logic';

const cand = (index: number, over: Partial<Candidate> = {}): Candidate => ({
  lot: 't', index, title: 'x', cols: 8, clues: 6, rating: 2, techniques: ['record'], family: 'pointe_soir',
  mechanics: ['neighbors:1'], clue_profile: [], trace_summary: { steps: 10 }, silhouette: [1], revealed: true, playable: true, plays: 0, kept: false,
  felt: {}, promoted: null, ...over,
});

describe('filters', () => {
  const list = [
    cand(1, { rating: 1, mechanics: ['step'], plays: 2 }),
    cand(2, { rating: 3, mechanics: ['neighbors:2', 'step'], family: 'deux_bosses', kept: true }),
    cand(3, { rating: 3 }),
  ];
  it('keeps everything with no filter', () => expect(filterCandidates(list, noFilters())).toHaveLength(3));
  it('filters by rating, mechanic (any count), family', () => {
    expect(filterCandidates(list, { ...noFilters(), rating: '3' }).map((c) => c.index)).toEqual([2, 3]);
    expect(filterCandidates(list, { ...noFilters(), mechanic: 'neighbors' }).map((c) => c.index)).toEqual([2, 3]);
    expect(filterCandidates(list, { ...noFilters(), mechanic: 'step' }).map((c) => c.index)).toEqual([1, 2]);
    expect(filterCandidates(list, { ...noFilters(), family: 'deux_bosses' }).map((c) => c.index)).toEqual([2]);
  });
  it('filters by status', () => {
    expect(filterCandidates(list, { ...noFilters(), status: 'new' }).map((c) => c.index)).toEqual([2, 3]);
    expect(filterCandidates(list, { ...noFilters(), status: 'played' }).map((c) => c.index)).toEqual([1]);
    expect(filterCandidates(list, { ...noFilters(), status: 'kept' }).map((c) => c.index)).toEqual([2]);
  });
  it('combines filters', () => {
    expect(filterCandidates(list, { ...noFilters(), rating: '3', mechanic: 'step' }).map((c) => c.index)).toEqual([2]);
  });
});

describe('sort', () => {
  const list = [cand(1, { rating: 3, clues: 5 }), cand(2, { rating: 1, clues: 5 }), cand(3, { rating: 3, clues: 9 })];
  it('sorts both ways and is stable on ties', () => {
    expect(sortCandidates(list, 'rating', 1).map((c) => c.index)).toEqual([2, 1, 3]);
    expect(sortCandidates(list, 'rating', -1).map((c) => c.index)).toEqual([1, 3, 2]);
    expect(sortCandidates(list, 'clues', 1).map((c) => c.index)).toEqual([1, 2, 3]);
  });
  it('sorts by felt average and steps', () => {
    const l = [cand(1, { felt: { a: 4 } }), cand(2, { felt: { a: 1, b: 2 } }), cand(3, { trace_summary: { steps: 3 } })];
    expect(sortCandidates(l, 'felt', -1).map((c) => c.index)).toEqual([1, 2, 3]);
    expect(sortCandidates(l, 'steps', 1).map((c) => c.index)).toEqual([3, 1, 2]);
  });
});

describe('PlayRecorder', () => {
  const make = () => {
    let now = 1000;
    const r = new PlayRecorder(() => now);
    return { r, tick: (ms: number) => { now += ms; } };
  };
  it('counts events and stops the clock at the solve', () => {
    const { r, tick } = make();
    r.event('move'); r.event('error'); r.event('error'); r.event('undo'); r.event('erase'); r.event('reset');
    tick(65_000);
    r.event('solved');
    tick(30_000);
    r.event('error'); // after the solve: ignored
    expect(r.finish('Joueur 1', 't', 4)).toEqual({
      player: 'Joueur 1', lot: 't', index: 4, outcome: 'solved', ms: 65_000, wall_ms: 65_000, started: 1, errors: 2, undos: 1, erasers: 1, resets: 1, moves: 1,
    });
    expect(r.elapsed()).toBe(65_000);
  });
  it('records an abandoned game at the moment it is left', () => {
    const { r, tick } = make();
    tick(12_000);
    expect(r.finish('Joueur 2', 't', 1, true)).toMatchObject({ outcome: 'abandoned', ms: 12_000 });
  });
  it('a game left unsolved without the abandon flag is still abandoned', () => {
    const { r, tick } = make();
    tick(500);
    expect(r.finish('p', 't', 1).outcome).toBe('abandoned');
  });
});

describe('PlayRecorder: hidden tab, solve, unload', () => {
  const make = () => {
    let now = 1000;
    const r = new PlayRecorder(() => now);
    return { r, tick: (ms: number) => { now += ms; } };
  };
  it('leaves the hidden time out of the active time', () => {
    const { r, tick } = make();
    tick(10_000);
    r.setHidden(true);
    tick(3_000);
    expect(r.elapsed()).toBe(10_000); // frozen while hidden
    r.setHidden(false);
    tick(5_000);
    r.event('solved');
    expect(r.finish('p', 't', 0)).toMatchObject({ outcome: 'solved', ms: 15_000, wall_ms: 18_000 });
  });
  it('counts a tab still hidden at the end as hidden', () => {
    const { r, tick } = make();
    tick(4_000);
    r.setHidden(true);
    tick(60_000);
    expect(r.finish('p', 't', 0, true)).toMatchObject({ outcome: 'abandoned', ms: 4_000, wall_ms: 64_000 });
  });
  it('a game solved then left by any exit is recorded solved (B2)', () => {
    const { r, tick } = make();
    tick(20_000);
    r.event('solved');
    tick(9_000);
    // cleanup on the home link: not an abandon since the grid is solved
    expect(r.finish('p', 't', 0, !r.solved).outcome).toBe('solved');
  });
  it('an undo after the solve changes nothing in the record (M5)', () => {
    const { r, tick } = make();
    tick(8_000);
    r.event('solved');
    r.event('undo'); r.event('error');
    expect(r.finish('p', 't', 0)).toMatchObject({ outcome: 'solved', ms: 8_000, undos: 0, errors: 0 });
  });
  it('tags a game recorded on page unload', () => {
    const { r, tick } = make();
    tick(3_000);
    expect(r.finish('p', 't', 0, true, 'unload')).toMatchObject({ outcome: 'abandoned', reason: 'unload', ms: 3_000 });
  });
});

describe('blind lists and labels', () => {
  it('counts masked plays without any measure', () => {
    const masked = { player: 'b', lot: 't', index: 1, masked: true } as unknown as Play;
    expect(playStats([masked, masked])).toEqual({ masked: true, games: 2, solved: 0, replays: 0, medianMs: null, meanErrors: null });
  });
  it('numbers candidates from 1', () => expect(displayNumber(0)).toBe('1'));
  it('translates techniques and falls back on the id', () => {
    expect(techniqueLabel('single_cover')).toBe('Une seule barre pour cette case');
    expect(techniqueLabel('record')).toBe('Le relevé compte les cases');
    expect(techniqueLabel('ramp_relay')).toBe('Deux bords se relaient');
    expect(techniqueLabel('given')).toBe('Centrale engagée');
    expect(techniqueLabel('new_tech')).toBe('new tech');
    for (const id of Object.keys(TECHNIQUES)) expect(techniqueLabel(id)).toBe(TECHNIQUES[id]!.name);
  });
});

describe('aggregates', () => {
  const play = (o: Partial<Play>): Play => ({ player: 'a', lot: 't', index: 1, outcome: 'solved', ms: 1000, errors: 0, undos: 0, erasers: 0, resets: 0, ts: 0, ...o });
  it('summarises plays', () => {
    const s = playStats([play({ ms: 60_000, errors: 2 }), play({ ms: 120_000, errors: 4 }), play({ outcome: 'abandoned', ms: 5 })]);
    expect(s).toEqual({ masked: false, games: 3, solved: 2, replays: 0, medianMs: 90_000, meanErrors: 3 });
    expect(playStats([])).toEqual({ masked: false, games: 0, solved: 0, replays: 0, medianMs: null, meanErrors: null });
    expect(playStats([play({ outcome: 'abandoned' })]).medianMs).toBeNull();
  });
  it('keeps first plays only: replays and stray opens are left out (review S8 B C9, C10)', () => {
    const s = playStats([
      play({ ms: 300_000, attempt: 1 }),
      play({ ms: 40_000, attempt: 2 }),
      play({ outcome: 'abandoned', ms: 3_000, phantom: true, attempt: 1 }),
    ]);
    expect(s).toMatchObject({ games: 1, solved: 1, replays: 1, medianMs: 300_000 });
  });
  it('averages felt ratings', () => {
    expect(feltAverage({})).toBeNull();
    expect(feltAverage({ a: 3, b: 2 })).toBe(2.5);
  });
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(468_000)).toBe('07:48');
    expect(formatDuration(3_725_000)).toBe('62:05');
  });
});

describe('bulletin and lot helpers', () => {
  it('cycles the weather', () => {
    expect(nextWeather('sun')).toBe('moon');
    expect(nextWeather('wind')).toBe('sun');
  });
  it('names the next lot', () => {
    expect(nextLotName([])).toBe('lot-01');
    expect(nextLotName(['demo-01', 'lot-03', 'lot-12'])).toBe('lot-13');
  });
  it('builds a lot skeleton', () => {
    expect(lotTemplate('lot-01', 20, 7)).toMatchObject({ lot: 'lot-01', size: 20, seed: 7 });
  });
});

describe('lab clue count and eyebrow', () => {
  it('labClueCount matches the game card, exchanges line of an exact inventory included', async () => {
    const { default: data } = await import('../src/data/grids.json');
    const { shownClueCount } = await import('../src/ui/panels');
    const { labClueCount } = await import('../src/lab/logic');
    const grids = data as unknown as import('../src/model/grid').Grid[];
    const withLine = grids.filter((g) => g.inventory.level === 'exact' && !g.clues.some((c) => c.type === 'exchanges'));
    expect(withLine.length).toBeGreaterThan(0);
    for (const g of grids) {
      expect(labClueCount({ clues: g.clues, inventory: g.inventory, step: g.step })).toBe(shownClueCount(g));
    }
    const g = withLine.find((x) => x.inventory.exports || x.inventory.imports || x.inventory.step !== undefined);
    if (g) expect(labClueCount(g)).toBe(g.clues.length + 1);
    expect(labClueCount(undefined)).toBeUndefined();
  });

  it('the game eyebrow takes the lab label in place of "Grille notée", published games keep it', async () => {
    const { default: data } = await import('../src/data/grids.json');
    const { gameEyebrow } = await import('../src/ui/game');
    const grids = data as unknown as import('../src/model/grid').Grid[];
    const g = { ...grids.find((x) => x.section !== 'tutorial')!, bulletin: undefined };
    expect(gameEyebrow(g, grids)).toContain('Grille notée');
    expect(gameEyebrow(g, grids, 'Candidate')).toMatch(/^Candidate/);
    expect(gameEyebrow(g, grids, 'Candidate')).not.toContain('Grille notée');
  });
});
