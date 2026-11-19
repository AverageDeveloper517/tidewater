// The moon is not fetched from anywhere - it is the same arithmetic every
// almanac uses. A synodic month is the time between two new moons; everything
// else (illumination, phase name, spring/neap tides) falls out of that number.

export const SYNODIC_DAYS = 29.530588853;
export const SYNODIC_MS = SYNODIC_DAYS * 86_400_000;

/** A known new moon, 2000-01-06 18:14 UTC, used as the phase origin. */
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

const PHASES = [
  { key: 'new', name: 'new moon', glyph: '○' },
  { key: 'waxing-crescent', name: 'waxing crescent', glyph: '◔' },
  { key: 'first-quarter', name: 'first quarter', glyph: '◐' },
  { key: 'waxing-gibbous', name: 'waxing gibbous', glyph: '◕' },
  { key: 'full', name: 'full moon', glyph: '●' },
  { key: 'waning-gibbous', name: 'waning gibbous', glyph: '◕' },
  { key: 'last-quarter', name: 'last quarter', glyph: '◑' },
  { key: 'waning-crescent', name: 'waning crescent', glyph: '◒' }
];

/** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
export function moonPhaseAt(date = new Date()) {
  const elapsed = date.getTime() - REFERENCE_NEW_MOON;
  const phase = ((elapsed / SYNODIC_MS) % 1 + 1) % 1;
  return phase;
}

export function moonPhase(date = new Date()) {
  const phase = moonPhaseAt(date);
  const index = Math.round(phase * 8) % 8;
  const entry = PHASES[index];
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const ageDays = phase * SYNODIC_DAYS;

  return {
    phase,
    index,
    key: entry.key,
    name: entry.name,
    glyph: entry.glyph,
    illumination,
    illuminationPct: Math.round(illumination * 100),
    waxing: phase < 0.5,
    ageDays,
    // spring tides at new and full, neap tides at the quarters
    springFactor: 0.55 + 0.75 * Math.abs(Math.cos(2 * Math.PI * phase))
  };
}

/** The next occurrence of a named phase: 'new', 'first-quarter', 'full', 'last-quarter'. */
export function nextPhase(date = new Date(), key = 'full') {
  const target = PHASES.findIndex((p) => p.key === key);
  if (target < 0) return null;

  const phase = moonPhaseAt(date);
  let delta = target / 8 - phase;
  if (delta <= 0) delta += 1;
  return new Date(date.getTime() + delta * SYNODIC_MS);
}

export function tideClass(moon) {
  if (moon.springFactor >= 1.15) return { key: 'spring', label: 'spring tide', note: 'the moon is pulling hard' };
  if (moon.springFactor <= 0.72) return { key: 'neap', label: 'neap tide', note: 'the moon is pulling against the sun' };
  return { key: 'mid', label: 'mid tide', note: 'between springs and neaps' };
}
