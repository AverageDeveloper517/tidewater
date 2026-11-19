// The calendar is real too. Seasons come from the actual month (UTC), not a
// counter on a server, so the flat changes on its own.

const SEASONS = {
  winter: {
    name: 'winter',
    glyph: '❄',
    blurb: 'cold water, thin light',
    crop: { kelp: 1.1, coral: 0.85, brine: 0.9 }
  },
  spring: {
    name: 'spring',
    glyph: '✧',
    blurb: 'the flat wakes up',
    crop: { kelp: 1.05, coral: 1, brine: 1.1 }
  },
  summer: {
    name: 'summer',
    glyph: '☀',
    blurb: 'long light, warm shallows',
    crop: { kelp: 0.9, coral: 1.15, brine: 1.2 }
  },
  autumn: {
    name: 'autumn',
    glyph: '☂',
    blurb: 'grey skies, heavy water',
    crop: { kelp: 1.15, coral: 0.95, brine: 1 }
  }
};

export function seasonFor(date = new Date()) {
  const month = date.getUTCMonth(); // 0 = January, 11 = December
  const key =
    month <= 1 || month === 11 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn';

  return { key, ...SEASONS[key] };
}

export function seasonCropMult(season, cropKey) {
  return season?.crop?.[cropKey] ?? 1;
}
