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

/** Open-Meteo returns bare local stamps; timezone=UTC means they are UTC. */
function utc(value) {
  if (typeof value !== 'string') return null;
  const hasZone = /[zZ]$/.test(value) || /[+-]\d\d:?\d\d$/.test(value);
  const stamp = Date.parse(hasZone ? value : `${value}Z`);
  return Number.isFinite(stamp) ? stamp : null;
}

/** Rough local night when the sun feed is down: longitude gives solar time. */
function fallbackNight(port, now) {
  const solar = ((now / 3_600_000 + (port?.lon ?? 0) / 15) % 24 + 24) % 24;
  return solar < 6 || solar >= 20;
}

function daylightFrom(sunrise, sunset) {
  if (!sunrise || !sunset) return null;
  return Math.max(0, sunset - sunrise);
}

const numOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

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
      if (!port) {
        return {
          bucket: 'cloud',
          label: LABEL.cloud,
          icon: ICON.cloud,
          temp: null,
          wind: null,
          sunrise: null,
          sunset: null,
          daylightMs: null,
          isNight: false,
          degraded: true
        };
      }
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${port.lat}&longitude=${port.lon}` +
        '&current=temperature_2m,weather_code,wind_speed_10m' +
        '&daily=sunrise,sunset,daylight_duration&forecast_days=1&timezone=UTC';

      try {
        const data = await fetchJson(url, { ttl: 10 * 60_000 });
        const current = data?.current ?? {};
        const bucket = bucketFor(current.weather_code);
        const sunrise = utc(data?.daily?.sunrise?.[0]);
        const sunset = utc(data?.daily?.sunset?.[0]);
        const daylight = numOrNull(data?.daily?.daylight_duration?.[0]);
        const now = Date.now();
        const isNight = sunrise && sunset ? now < sunrise || now >= sunset : fallbackNight(port, now);
        return {
          bucket,
          label: LABEL[bucket],
          icon: ICON[bucket],
          temp: typeof current.temperature_2m === 'number' ? Math.round(current.temperature_2m) : null,
          wind: typeof current.wind_speed_10m === 'number' ? Math.round(current.wind_speed_10m) : null,
          sunrise,
          sunset,
          daylightMs: daylight != null ? Math.round(daylight * 1000) : daylightFrom(sunrise, sunset),
          isNight,
          degraded: false
        };
      } catch (err) {
        logger?.warn('weather: forecast fallback,', err.message);
        const rng = seeded(`${dayKey()}:${port.name}:wx`);
        const bucket = BUCKETS[Math.floor(rng() * 5)]; // never fake a storm
        return {
          bucket,
          label: LABEL[bucket],
          icon: ICON[bucket],
          temp: null,
          wind: null,
          sunrise: null,
          sunset: null,
          daylightMs: null,
          isNight: fallbackNight(port, Date.now()),
          degraded: true
        };
      }
    },

    /** Six-day outlook. Drives the almanac's planting window. */
    async daily(port) {
      if (!port) return { days: [], degraded: true };

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${port.lat}&longitude=${port.lon}` +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,' +
        'precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset,daylight_duration' +
        '&forecast_days=6&timezone=UTC';

      try {
        const data = await fetchJson(url, { ttl: 30 * 60_000 });
        const d = data?.daily ?? {};
        const times = d.time ?? [];
        if (!times.length) throw new Error('no outlook days');

        const days = times.map((date, i) => {
          const bucket = bucketFor(d.weather_code?.[i]);
          const sunrise = utc(d.sunrise?.[i]);
          const sunset = utc(d.sunset?.[i]);
          const tmax = numOrNull(d.temperature_2m_max?.[i]);
          const tmin = numOrNull(d.temperature_2m_min?.[i]);
          const precip = numOrNull(d.precipitation_sum?.[i]);
          const chance = numOrNull(d.precipitation_probability_max?.[i]);
          const wind = numOrNull(d.wind_speed_10m_max?.[i]);
          const uv = numOrNull(d.uv_index_max?.[i]);
          const daylight = numOrNull(d.daylight_duration?.[i]);
          return {
            date,
            bucket,
            label: LABEL[bucket],
            icon: ICON[bucket],
            tmax: tmax == null ? null : Math.round(tmax),
            tmin: tmin == null ? null : Math.round(tmin),
            precip,
            precipChance: chance == null ? null : Math.round(chance),
            wind: wind == null ? null : Math.round(wind),
            uv: uv == null ? null : Math.round(uv * 10) / 10,
            sunrise,
            sunset,
            daylightMs: daylight != null ? Math.round(daylight * 1000) : daylightFrom(sunrise, sunset)
          };
        });

        return { days, degraded: false };
      } catch (err) {
        logger?.warn('weather: outlook fallback,', err.message);
        const rng = seeded(`${dayKey()}:${port.name}:outlook`);
        const safe = ['clear', 'cloud', 'fog', 'rain'];
        const today = new Date();
        const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        const days = Array.from({ length: 6 }, (_, i) => {
          const bucket = safe[Math.floor(rng() * safe.length)];
          const date = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
          return {
            date,
            bucket,
            label: LABEL[bucket],
            icon: ICON[bucket],
            tmax: null,
            tmin: null,
            precip: null,
            precipChance: null,
            wind: null,
            uv: null,
            sunrise: null,
            sunset: null,
            daylightMs: null
          };
        });
        return { days, degraded: true };
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
