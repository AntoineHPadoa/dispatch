/*
 * Daily sheet selection (pure, no DOM).
 * - publishedBulletins(): grids with a bulletin published on or before a day, oldest first.
 * - currentBulletin(): the grid of the day = latest publication date <= today; when the stock runs
 *   out, the last published one stays; before the first publication there is none.
 * - localIsoDate(): the browser's local day as `YYYY-MM-DD`.
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

/** The sheet of the day, or null when nothing is published yet. */
export function currentBulletin(grids: readonly Grid[], today: string): BulletinGrid | null {
  const list = publishedBulletins(grids, today);
  return list[list.length - 1] ?? null;
}
