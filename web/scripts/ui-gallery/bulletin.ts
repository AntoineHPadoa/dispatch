/*
 * Gallery build only (vite.config.ts, DISPATCH_GRIDS): the bulletin module with a frozen "today".
 * - Every bulletin counts as published, so every grid opens by URL and the captures do not depend
 *   on the day they are taken; the sheet of the day is the last published bulletin.
 */
export * from '../../src/model/bulletin';

/** Fixed day of the gallery build, after every publication date. */
export const GALLERY_TODAY = '2099-12-31';

export function localIsoDate(_d?: Date): string {
  return GALLERY_TODAY;
}
