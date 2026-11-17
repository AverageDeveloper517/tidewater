export const INSTRUMENTS = [
  {
    key: 'tide',
    name: 'Tide',
    glyph: '≋',
    source: 'crypto',
    id: 'bitcoin',
    ref: 90_000,
    base: 4_200,
    blurb: 'the big slow one'
  },
  {
    key: 'reef',
    name: 'Reef',
    glyph: '❖',
    source: 'crypto',
    id: 'ethereum',
    ref: 3_500,
    base: 165,
    blurb: 'the builder one'
  },
  {
    key: 'glow',
    name: 'Glow',
    glyph: '✦',
    source: 'crypto',
    id: 'solana',
    ref: 200,
    base: 9.5,
    blurb: 'the fast cheap one'
  },
  {
    key: 'euro',
    name: 'Euro note',
    glyph: '◎',
    source: 'fx',
    code: 'EUR',
    base: 100,
    blurb: 'paper, but real paper'
  },
  {
    key: 'yen',
    name: 'Yen note',
    glyph: '◇',
    source: 'fx',
    code: 'JPY',
    base: 1,
    blurb: 'small numbers, big volume'
  }
];

export const BY_KEY = Object.fromEntries(INSTRUMENTS.map((i) => [i.key, i]));

export const TRADE_FEE = 0.005;
