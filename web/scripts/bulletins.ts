/*
 * Hand-written market bulletins of the 4 rated grids (prototype ids 8 to 11).
 * - Read by convert-grids.ts, so `npm run convert` keeps them in src/data/grids.json.
 * - Publication days are consecutive; the sheet of the day follows the browser date (src/model/bulletin.ts).
 */
import type { Bulletin } from '../src/model/grid';

export const BULLETINS: Record<number, Bulletin> = {
  8: {
    number: 211,
    title: 'Nuit calme',
    text: 'Le réseau respire : la demande reste basse presque toute la journée, avec un petit pic en début d’après-midi. '
      + 'Le barrage ne garde que deux cases d’eau en réserve.',
    weather: ['moon', 'moon', 'cloud', 'sun', 'sun', 'sun', 'cloud', 'moon'],
    published: '2026-11-18',
  },
  9: {
    number: 212,
    title: 'Plateau de midi',
    text: 'Le froid s’installe et la demande reste haute toute la journée, sans vraie vallée. '
      + 'Le ruban nucléaire porte l’essentiel, le reste se joue sur les marges.',
    weather: ['moon', 'cloud', 'cloud', 'sun', 'sun', 'cloud', 'wind', 'moon'],
    published: '2026-11-19',
  },
  10: {
    number: 213,
    title: 'Creux de midi',
    text: 'Le soleil de midi soulage le réseau : la demande s’effondre au milieu de la journée, '
      + 'puis repart de plus belle matin et soir. Les rubans longs vont devoir se couper.',
    weather: ['moon', 'cloud', 'cloud', 'sun', 'sun', 'cloud', 'wind', 'moon'],
    published: '2026-11-20',
  },
  11: {
    number: 214,
    title: 'Pointe du soir',
    text: 'Le froid monte et la demande grimpe jusqu’à 6 GW dès midi, sans redescendre avant la nuit. '
      + 'Seul le nucléaire répond à l’appel : l’Allemagne ouvre sa ligne, mais chaque bloc compte.',
    weather: ['moon', 'moon', 'cloud', 'sun', 'sun', 'wind', 'wind', 'moon'],
    published: '2026-11-21',
  },
};
