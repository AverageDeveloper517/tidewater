import { getJson } from '../lib/http.js';
import { WEATHER_MULT } from '../data/tables.js';
import { dayKey, seeded } from '../lib/util.js';

export const BUCKETS = ['clear', 'cloud', 'fog', 'rain', 'snow', 'storm'];

export const ICON = {
  clear: '☀',
  cloud: '☁',
  fog: '▨',
  rain: '☂',
  snow: '❄',
  storm: '⚡'
};

export const LABEL = {
  clear: 'clear',
  cloud: 'cloud cover',
  fog: 'fog',
  rain: 'rain',
  snow: 'snow',
  storm: 'storm'
};

export function bucketFor(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) return 'cloud';
  if (c === 0) return 'clear';
  if (c <= 3) return 'cloud';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 51 && c <= 67) return 'rain';
  if (c >= 71 && c <= 77) return 'snow';
  if (c >= 80 && c <= 82) return 'rain';
  if (c >= 85 && c <= 86) return 'snow';
  if (c >= 95 && c <= 99) return 'storm';
  return 'cloud';
}

export function affinity(bucket, crop) {
  if (bucket === 'storm') return WEATHER_MULT.storm;
  if (crop.loves.includes(bucket)) return WEATHER_MULT.loves;
  if (crop.hates.includes(bucket)) return WEATHER_MULT.hates;
  return WEATHER_MULT.neutral;
}

export function waveMood(height) {
  const h = Number(height) || 0;
  if (h < 0.4) return { key: 'glass', label: 'glass calm', rare: 0.9, junk: 0.7 };
  if (h < 1.2) return { key: 'calm', label: 'calm', rare: 1.0, junk: 1.0 };
  if (h < 2.2) return { key: 'choppy', label: 'choppy', rare: 1.25, junk: 1.1 };
  if (h < 3.5) return { key: 'rough', label: 'rough', rare: 1.6, junk: 1.5 };
  return { key: 'storm', label: 'storm swell', rare: 2.1, junk: 2.4 };
}

export function createWeather({ fetchJson = getJson, logger } = {}) {
  return {
    async geocode(name) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
      const data = await fetchJson(url, { ttl: 86_400_000 });
      const hit = data?.results?.[0];
      if (!hit) return null;
      return {
        name: hit.name,
        region: hit.admin1 ?? null,
        country: hit.country_code ?? hit.country ?? null,
        lat: hit.latitude,
        lon: hit.longitude,
        timezone: hit.timezone ?? 'UTC'
      };
    },

    async forecast(port) {
      if (!port) return { bucket: 'cloud', label: LABEL.cloud, icon: ICON.cloud, temp: null, wind: null, degraded: true };
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${port.lat}&longitude=${port.lon}` +
        '&current=temperature_2m,weather_code,wind_speed_10m&timezone=UTC';

      try {
        const data = await fetchJson(url, { ttl: 10 * 60_000 });
        const current = data?.current ?? {};
        const bucket = bucketFor(current.weather_code);
        return {
          bucket,
          label: LABEL[bucket],
          icon: ICON[bucket],
          temp: typeof current.temperature_2m === 'number' ? Math.round(current.temperature_2m) : null,
          wind: typeof current.wind_speed_10m === 'number' ? Math.round(current.wind_speed_10m) : null,
          degraded: false
        };
      } catch (err) {
        logger?.warn('weather: forecast fallback,', err.message);
        const rng = seeded(`${dayKey()}:${port.name}:wx`);
        const bucket = BUCKETS[Math.floor(rng() * 5)]; // never fake a storm
        return { bucket, label: LABEL[bucket], icon: ICON[bucket], temp: null, wind: null, degraded: true };
      }
    },

    async waves(port) {
      if (!port) return { height: 1, period: 8, degraded: true };
      const url =
        `https://marine-api.open-meteo.com/v1/marine?latitude=${port.lat}&longitude=${port.lon}` +
        '&hourly=wave_height,wave_period&forecast_days=1&timezone=UTC';

      try {
        const data = await fetchJson(url, { ttl: 30 * 60_000 });
        const times = data?.hourly?.time ?? [];
        const heights = data?.hourly?.wave_height ?? [];
        const periods = data?.hourly?.wave_period ?? [];
        if (!times.length) throw new Error('no marine hours');

        const now = Date.now();
        let best = 0;
        let bestDelta = Infinity;
        for (let i = 0; i < times.length; i += 1) {
          const delta = Math.abs(new Date(`${times[i]}Z`).getTime() - now);
          if (delta < bestDelta) {
            bestDelta = delta;
            best = i;
          }
        }

        return {
          height: Number(heights[best] ?? 1),
          period: Number(periods[best] ?? 8),
          degraded: false
        };
      } catch (err) {
        logger?.warn('weather: marine fallback,', err.message);
        const rng = seeded(`${dayKey()}:${port.name}:sea`);
        return { height: Math.round((0.4 + rng() * 2.6) * 10) / 10, period: 6 + Math.round(rng() * 6), degraded: true };
      }
    }
  };
}
