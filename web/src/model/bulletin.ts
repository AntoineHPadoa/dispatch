/*
 * Daily sheet selection (pure, no DOM).
 * - publishedBulletins(): grids with a bulletin published on or before a day, oldest first.
 * - isPublished(): false for a bulletin dated after a day (direct URLs fall back to home).
 * - currentBulletin(): the grid of the day = latest publication date <= today; when the stock runs
 *   out, the last published one stays; before the first publication there is none.
 * - previousBulletins(): the other published sheets, newest first.
 * - localIsoDate(), weekdayIndex(): the local day as `YYYY-MM-DD`; day of the week of such a day.
 */
import type { Grid } from './grid';

export type BulletinGrid = Grid & { bulletin: NonNullable<Grid['bulletin']> };

/** Local calendar day of a date as `YYYY-MM-DD`. */
export function localIsoDate(d: Date = new Date()): string {
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Grids published on or before `today` (ISO), oldest first; same day: lower number first. */
export function publishedBulletins(grids: readonly Grid[], today: string): BulletinGrid[] {
  return grids
    .filter((g): g is BulletinGrid => g.bulletin !== undefined && g.bulletin.published <= today)
    .sort((a, b) => a.bulletin.published.localeCompare(b.bulletin.published) || a.bulletin.number - b.bulletin.number);
}

/** A grid can be opened by URL unless its bulletin is not published yet on `today`. */
export function isPublished(grid: Grid, today: string): boolean {
  return !grid.bulletin || grid.bulletin.published <= today;
}

/** The sheet of the day, or null when nothing is published yet. */
export function currentBulletin(grids: readonly Grid[], today: string): BulletinGrid | null {
  const list = publishedBulletins(grids, today);
  return list[list.length - 1] ?? null;
}

/** Published bulletins other than the sheet of the day, newest first. */
export function previousBulletins(grids: readonly Grid[], today: string): BulletinGrid[] {
  const list = publishedBulletins(grids, today);
  return list.slice(0, -1).reverse();
}

/** Day of the week (0 = Sunday) of an ISO day, from the calendar date (no time zone involved). */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
