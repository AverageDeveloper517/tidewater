// Sea level is real. Open-Meteo Marine publishes an hourly tide height (metres
// above mean sea level) from the same keyless endpoint the wave data comes from.
// We turn that series into a current height, a trend, and the next high/low
// water marks. When the feed dies, a deterministic lunar tide keeps the harbour
// readable instead of pretending the water is flat.

import { getJson } from '../lib/http.js';
import { moonPhase, tideClass } from '../lib/moon.js';
import { clamp, seeded } from '../lib/util.js';

const HOUR_MS = 3_600_000;
const MARINE = 'https://marine-api.open-meteo.com/v1/marine';

const round2 = (n) => Math.round(n * 100) / 100;

export function parseUtc(value) {
  if (typeof value !== 'string') return NaN;
  const hasZone = /[zZ]$/.test(value) || /[+-]\d\d:?\d\d$/.test(value);
  return Date.parse(hasZone ? value : `${value}Z`);
}

export function parseSeries(hourly) {
  const times = hourly?.time ?? [];
  const levels = hourly?.sea_level_height_msl ?? [];
  const points = [];

  for (let i = 0; i < times.length; i += 1) {
    const at = parseUtc(times[i]);
    const raw = levels[i];
    if (raw == null || raw === '') continue;
    const level = Number(raw);
    if (Number.isFinite(at) && Number.isFinite(level)) points.push({ at, level });
  }

  return points;
}

/** Local maxima and minima, refined with a parabola through the three hourly samples. */
export function findExtremes(points) {
  const extremes = [];

  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1].level;
    const b = points[i].level;
    const c = points[i + 1].level;

    let type = null;
    if (b > a && b >= c) type = 'high';
    else if (b < a && b <= c) type = 'low';
    if (!type) continue;

    const denom = a - 2 * b + c;
    const offset = denom === 0 ? 0 : clamp((0.5 * (a - c)) / denom, -0.5, 0.5);
    const vertex = denom === 0 ? b : b - (c - a) ** 2 / (8 * denom);

    extremes.push({
      type,
      at: points[i].at + offset * HOUR_MS,
      level: round2(vertex)
    });
  }

  return extremes;
}

export function nextExtremes(extremes, now = Date.now(), count = 4) {
  return extremes.filter((e) => e.at > now).slice(0, count);
}

export function currentAt(points, now = Date.now()) {
  if (!points.length) return { level: 0, slope: 0 };

  let index = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (points[i].at <= now) index = i;
    else break;
  }

  const a = points[index];
  const b = points[Math.min(index + 1, points.length - 1)];
  const span = b.at - a.at || HOUR_MS;
  const progress = clamp((now - a.at) / span, 0, 1);

  return {
    level: a.level + (b.level - a.level) * progress,
    slope: ((b.level - a.level) / span) * HOUR_MS
  };
}

export function rangeIn(points, now = Date.now(), hours = 24) {
  const until = now + hours * HOUR_MS;
  const window = points.filter((p) => p.at >= now && p.at <= until);
  const use = window.length >= 3 ? window : points;
  if (!use.length) return 0;
  const levels = use.map((p) => p.level);
  return round2(Math.max(...levels) - Math.min(...levels));
}

export function trendFor(slope) {
  if (slope > 0.06) return 'rising';
  if (slope < -0.06) return 'falling';
  return 'slack';
}

/** How the tide changes the bite. Rising water over a big range is the good one. */
export function tideMood({ trend, range = 0, springFactor = 1, degraded = false } = {}) {
  if (degraded) return { bite: 1, label: 'tide unknown', note: 'no tide feed - fishing is unchanged' };

  let bite = 1;
  if (trend === 'rising') bite += clamp(range / 8, 0, 0.18) + Math.max(0, springFactor - 1) * 0.18;
  else if (trend === 'falling') bite += clamp(range / 14, 0, 0.1);
  else bite -= 0.08;

  bite = clamp(round2(bite), 0.85, 1.45);

  const label =
    trend === 'rising' ? 'feeding tide' : trend === 'falling' ? 'ebbing tide' : 'slack water';
  const note =
    trend === 'rising'
      ? 'fish move up the flat with the water'
      : trend === 'falling'
        ? 'they follow the drop out'
        : 'the water is turning - short window';

  return { bite, label, note };
}

/**
 * A deterministic stand-in: the principal lunar semidiurnal component (M2,
 * 12.4206 h) plus a small solar one. Same port, same curve, every restart.
 */
export function syntheticTide(port, date = new Date()) {
  const rng = seeded(
    `${port?.name ?? 'harbour'}:${Number(port?.lat ?? 0).toFixed(2)}:${Number(port?.lon ?? 0).toFixed(2)}`
  );
  const amplitude = 0.55 + rng() * 1.15;
  const phase = rng() * Math.PI * 2;
  const inequality = rng() * 0.22;
  const start = Math.floor(date.getTime() / HOUR_MS) * HOUR_MS - 12 * HOUR_MS;

  const moon = moonPhase(date);
  const spring = moon.springFactor;
  const points = [];

  for (let i = 0; i < 48; i += 1) {
    const at = start + i * HOUR_MS;
    const h = (at - start) / HOUR_MS;
    const m2 = Math.sin((2 * Math.PI * h) / 12.4206 + phase);
    const s2 = Math.sin((2 * Math.PI * h) / 12 + phase * 0.7) * inequality;
    points.push({ at, level: round2(amplitude * spring * (m2 + s2)) });
  }

  return points;
}

function seriesValue(hourly, key, now) {
  const times = hourly?.time ?? [];
  const values = hourly?.[key] ?? [];
  if (!times.length) return null;

  let best = null;
  let bestDelta = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const raw = values[i];
    if (raw == null || raw === '') continue;
    const at = parseUtc(times[i]);
    const delta = Math.abs(at - now);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = Number(raw);
    }
  }
  return best == null || !Number.isFinite(best) ? null : round2(best);
}

export function describeTide(points, { hourly = null, now = Date.now(), degraded = false, source } = {}) {
  const { level, slope } = currentAt(points, now);
  const trend = trendFor(slope);
  const range = rangeIn(points, now, 24);
  const extremes = nextExtremes(findExtremes(points), now, 4);
  const moon = moonPhase(new Date(now));
  const klass = tideClass(moon);
  const mood = tideMood({ trend, range, springFactor: moon.springFactor, degraded });

  const spark = points
    .filter((p) => p.at >= now - HOUR_MS && p.at <= now + 23 * HOUR_MS)
    .map((p) => p.level);

  return {
    at: now,
    level: round2(level),
    rate: round2(Math.abs(slope)),
    trend,
    range,
    extremes,
    moon,
    tideClass: klass,
    bite: mood.bite,
    biteLabel: mood.label,
    biteNote: mood.note,
    spark,
    sst: seriesValue(hourly, 'sea_surface_temperature', now),
    waveHeight: seriesValue(hourly, 'wave_height', now),
    wavePeriod: seriesValue(hourly, 'wave_period', now),
    degraded,
    source: source ?? (degraded ? 'lunar fallback' : 'open-meteo marine')
  };
}

export function createTide({ fetchJson = getJson, logger, ttlMs = 15 * 60_000 } = {}) {
  const cache = new Map();

  const keyFor = (port) =>
    `${Number(port?.lat ?? 0).toFixed(2)},${Number(port?.lon ?? 0).toFixed(2)}`;

  return {
    async at(port) {
      const now = Date.now();

      if (!port) {
        return describeTide(syntheticTide(null, new Date(now)), {
          now,
          degraded: true,
          source: 'lunar fallback'
        });
      }

      const key = keyFor(port);
      const hit = cache.get(key);
      if (hit && hit.expires > now) return hit.value;

      const url =
        `${MARINE}?latitude=${port.lat}&longitude=${port.lon}` +
        '&hourly=sea_level_height_msl,wave_height,wave_period,sea_surface_temperature' +
        '&forecast_days=2&timezone=UTC';

      try {
        const data = await fetchJson(url, { ttl: ttlMs });
        const points = parseSeries(data?.hourly);
        if (points.length < 6) throw new Error('not enough tide hours');

        const tide = describeTide(points, { hourly: data.hourly, now, degraded: false });
        cache.set(key, { expires: now + ttlMs, value: tide });
        return tide;
      } catch (err) {
        logger?.warn('tide: feed down, using lunar fallback,', err.message);
        const tide = describeTide(syntheticTide(port, new Date(now)), {
          now,
          degraded: true,
          source: 'lunar fallback'
        });
        cache.set(key, { expires: now + 2 * 60_000, value: tide });
        return tide;
      }
    }
  };
}
