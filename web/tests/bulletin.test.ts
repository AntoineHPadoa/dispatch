/*
 * Bulletins: §14 validation and the choice of the sheet of the day.
 * - validateGrid() accepts the 4 hand-written bulletins and rejects malformed ones.
 * - currentBulletin(): latest publication <= today, last one kept when the stock runs out, none before the first.
 * - the converter keeps the bulletins of the 4 rated grids.
 */
import { describe, expect, it } from 'vitest';
import gridsJson from '../src/data/grids.json';
import { currentBulletin, isPublished, localIsoDate, previousBulletins, publishedBulletins, weekdayIndex } from '../src/model/bulletin';
import { dossierNext, dossierProgress, dossiers } from '../src/model/dossiers';
import { renderDossier, renderHome } from '../src/ui/home';
import { sheetSilhouette } from '../src/ui/home-art';
import { emptyProgress, nextGrid, playOrder } from '../src/ui/progress';
import { isIsoDate, validateGrid, type Grid } from '../src/model/grid';

const grids = gridsJson as unknown as Grid[];
const rated = grids.filter((g) => g.section === 'rated');

const withBulletin = (patch: (b: Record<string, unknown>) => void) => {
  const g = structuredClone(rated[0]!) as unknown as Record<string, unknown>;
  patch(g.bulletin as Record<string, unknown>);
  return validateGrid(g);
};

describe('bulletin data', () => {
  it('gives a bulletin to every rated grid, none to the tutorial', () => {
    expect(rated.length).toBeGreaterThan(0);
    expect(rated.every((g) => g.bulletin)).toBe(true);
    expect(grids.filter((g) => g.section === 'tutorial').some((g) => g.bulletin)).toBe(false);
  });

  it('has unique numbers and unique publication days', () => {
    const b = rated.map((g) => g.bulletin!);
    expect(new Set(b.map((x) => x.number)).size).toBe(rated.length);
    expect(new Set(b.map((x) => x.published)).size).toBe(rated.length);
  });

  it('weather has one sky per column', () => {
    for (const g of rated) expect(g.bulletin!.weather).toHaveLength(g.columns.length);
  });
});

describe('bulletin validation', () => {
  it('accepts the shipped bulletins', () => {
    for (const g of rated) expect(validateGrid(g).ok).toBe(true);
  });

  it('rejects each malformed field', () => {
    expect(withBulletin((b) => { b.number = 0; }).errors.join()).toMatch(/bulletin.number/);
    expect(withBulletin((b) => { b.title = ' '; }).errors.join()).toMatch(/bulletin.title/);
    expect(withBulletin((b) => { b.text = 3; }).errors.join()).toMatch(/bulletin.text/);
    expect(withBulletin((b) => { b.weather = ['sun']; }).errors.join()).toMatch(/bulletin.weather/);
    expect(withBulletin((b) => { (b.weather as string[])[0] = 'snow'; }).errors.join()).toMatch(/bulletin.weather/);
    expect(withBulletin((b) => { b.published = '2026-02-30'; }).errors.join()).toMatch(/bulletin.published/);
    expect(withBulletin((b) => { b.published = '21/11/2026'; }).errors.join()).toMatch(/bulletin.published/);
    expect(withBulletin((b) => { b.extra = 1; }).errors.join()).toMatch(/bulletin.extra/);
  });

  it('rejects a bulletin that is not an object', () => {
    const g = structuredClone(rated[0]!) as unknown as Record<string, unknown>;
    g.bulletin = 'x';
    expect(validateGrid(g).errors.join()).toMatch(/bulletin: object/);
  });

  it('isIsoDate checks the calendar', () => {
    expect(isIsoDate('2026-11-21')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate(20261121)).toBe(false);
  });
});

describe('sheet of the day', () => {
  const [a, b, c, d] = rated;
  const days = rated.map((g) => g.bulletin!.published);

  it('is the latest publication <= today', () => {
    expect(currentBulletin(grids, days[1]!)?.id).toBe(b!.id);
    expect(currentBulletin(grids, '2026-11-20')?.id).toBe(c!.id);
  });

  it('a day without publication keeps the previous sheet', () => {
    const gap = structuredClone(grids);
    gap.find((g) => g.id === c!.id)!.bulletin!.published = '2026-11-25';
    expect(currentBulletin(gap, '2026-11-20')?.id).toBe(b!.id);
  });

  it('keeps the last published one when the stock runs out', () => {
    expect(currentBulletin(grids, '2031-01-01')?.id).toBe(d!.id);
  });

  it('is null before the first publication', () => {
    expect(currentBulletin(grids, '2026-01-01')).toBeNull();
    expect(currentBulletin([], '2026-11-21')).toBeNull();
  });

  it('ignores grids without a bulletin and does not depend on input order', () => {
    const shuffled = [d!, ...grids.filter((g) => g.section === 'tutorial'), a!, c!, b!];
    expect(currentBulletin(shuffled, '2031-01-01')?.id).toBe(d!.id);
    expect(publishedBulletins(shuffled, '2026-11-20').map((g) => g.id)).toEqual([a!.id, b!.id, c!.id]);
  });

  it('orders a same-day tie by number', () => {
    const tie = structuredClone([a!, b!]);
    tie[0]!.bulletin!.published = tie[1]!.bulletin!.published;
    tie[0]!.bulletin!.number = 999;
    expect(currentBulletin(tie, '2031-01-01')?.bulletin.number).toBe(999);
  });

  it('localIsoDate formats the local day with zero padding', () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localIsoDate(new Date(2026, 10, 21, 23, 59))).toBe('2026-11-21');
  });
});

describe('home lists', () => {
  const today = '2026-11-21';

  it('previous sheets: published ones except the sheet of the day, newest first', () => {
    const ids = previousBulletins(grids, today).map((g) => g.bulletin.number);
    expect(ids).toEqual([213, 212, 211]);
    expect(previousBulletins(grids, '2026-11-18')).toEqual([]);
    expect(previousBulletins(grids, '2026-11-19').map((g) => g.bulletin.number)).toEqual([211]);
  });

  it('weekdayIndex gives the day of the week of an ISO day', () => {
    expect(weekdayIndex('2026-11-18')).toBe(3);
    expect(weekdayIndex('2026-11-21')).toBe(6);
    expect(weekdayIndex('2026-11-22')).toBe(0);
  });

  it('the training dossier "Premiers pas" holds the 7 tutorial grids in order', () => {
    const [d] = dossiers(grids);
    expect(d?.id).toBe('premiers-pas');
    expect(d?.grids.map((g) => g.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(dossiers(rated)).toEqual([]);
  });

  it('dossier progress counts finished grids; the card opens the first unfinished one', () => {
    const d = dossiers(grids)[0]!;
    const done = new Set([1, 2, 4]);
    expect(dossierProgress(d, (id) => done.has(id))).toEqual({ done: 3, total: 7 });
    expect(dossierNext(d, (id) => done.has(id))?.id).toBe(3);
    expect(dossierNext(d, () => true)?.id).toBe(1);
  });
});

describe('publication gate', () => {
  const tomorrow = structuredClone(grids);
  const last = tomorrow.filter((g) => g.bulletin).sort((x, y) => x.bulletin!.published.localeCompare(y.bulletin!.published)).at(-1)!;
  const today = '2026-11-20';
  last.bulletin!.published = '2026-11-21';

  it('a grid published tomorrow is neither next nor printed', () => {
    const prev = playOrder(tomorrow, today).at(-1)!;
    expect(playOrder(tomorrow, today).some((g) => g.id === last.id)).toBe(false);
    expect(nextGrid(tomorrow, prev.id, today)).toBeNull();
    expect(playOrder(tomorrow, '2026-11-21').some((g) => g.id === last.id)).toBe(true);
  });

  it('a grid published tomorrow is not openable by URL', () => {
    expect(isPublished(last, today)).toBe(false);
    expect(isPublished(last, '2026-11-21')).toBe(true);
    expect(isPublished(grids.find((g) => g.section === 'tutorial')!, '2000-01-01')).toBe(true);
  });

  it('after the last tutorial, next is the sheet of the day, or home once it is done', () => {
    const lastTuto = playOrder(grids, today).filter((g) => g.section === 'tutorial').at(-1)!;
    const daily = currentBulletin(tomorrow, today)!;
    expect(nextGrid(tomorrow, lastTuto.id, today)?.id).toBe(daily.id);
    expect(nextGrid(tomorrow, lastTuto.id, today, (id) => id === daily.id)).toBeNull();
  });
});

describe('home rendering', () => {
  const stub = () => {
    const root = { innerHTML: '', querySelector: () => null } as unknown as HTMLElement;
    return root;
  };

  it('shows the sheet of the day and the previous sheets', () => {
    const root = stub();
    renderHome(root, grids, emptyProgress(), '2026-11-21');
    expect(root.innerHTML).toContain('n° 214');
    expect(root.innerHTML).toContain('n° 213');
    expect(root.innerHTML).not.toContain('Bouclé');
  });

  it('stamps a finished sheet', () => {
    const root = stub();
    const done = rated.at(-1)!;
    const p = { grids: { [done.id]: { status: 'done' } } } as unknown as ReturnType<typeof emptyProgress>;
    renderHome(root, grids, p, '2026-11-21');
    expect(root.innerHTML).toContain('Bouclé');
    // The finished sheet shows its solution: one rectangle per placement, in plant colours.
    expect(root.innerHTML.match(/class="sil-piece"/g)).toHaveLength(done.solution.placements.length);
  });

  it('a finished STEP sheet: one silhouette cell per cell of the laid pieces', () => {
    const g7 = grids.find((g) => g.id === 7)!;
    expect(g7.solution!.step.length).toBeGreaterThan(0);
    const svg = sheetSilhouette(g7, g7.demand.map(() => 'sun' as const), () => '', '', true);
    const covered = g7.solution!.placements.reduce((a, p) => a + p.len * (p.height ?? 1), 0);
    expect(svg.match(/class="sil-cell/g)).toHaveLength(covered);
  });

  it('an open sheet shows no solution', () => {
    const root = stub();
    renderHome(root, grids, emptyProgress(), '2026-11-21');
    expect(root.innerHTML).not.toContain('sil-piece');
  });

  it('before the first publication: no sheet, a line with the first date', () => {
    const root = stub();
    renderHome(root, grids, emptyProgress(), '2026-01-01');
    expect(root.innerHTML).not.toContain('class="sheet"');
    expect(root.innerHTML).toContain('Premier bulletin le 18 novembre 2026');
  });

  it('dossier page lists the 7 tutorial grids', () => {
    const root = stub();
    renderDossier(root, dossiers(grids)[0]!, emptyProgress());
    expect(root.innerHTML.match(/class="fiche /g)).toHaveLength(7);
  });
});
