import test from 'node:test';
import assert from 'node:assert/strict';

import { affinity, bucketFor, createWeather, waveMood, glassFor, BUCKETS } from '../src/services/weather.js';
import { CROPS } from '../src/data/tables.js';

const logger = { warn() {} };
const port = { name: 'Test', lat: 1, lon: 2 };

test('wmo codes map onto six buckets', () => {
  assert.equal(bucketFor(0), 'clear');
  assert.equal(bucketFor(2), 'cloud');
  assert.equal(bucketFor(45), 'fog');
  assert.equal(bucketFor(61), 'rain');
  assert.equal(bucketFor(80), 'rain');
  assert.equal(bucketFor(73), 'snow');
  assert.equal(bucketFor(95), 'storm');
  assert.equal(bucketFor(undefined), 'cloud');
});

test('crop affinity follows loves and hates', () => {
  assert.equal(affinity('clear', CROPS.coral), 1.4);
  assert.equal(affinity('rain', CROPS.coral), 0.55);
  assert.equal(affinity('rain', CROPS.kelp), 1.4);
  assert.equal(affinity('clear', CROPS.kelp), 0.55);
  assert.equal(affinity('storm', CROPS.coral), 0.25);
  assert.equal(affinity('cloud', CROPS.brine), 1.4);
});

test('swell buckets get rougher', () => {
  assert.equal(waveMood(0.2).key, 'glass');
  assert.equal(waveMood(1).key, 'calm');
  assert.equal(waveMood(2).key, 'choppy');
  assert.equal(waveMood(3).key, 'rough');
  assert.equal(waveMood(9).key, 'storm');
});

test('offline weather still returns a usable forecast', async () => {
  const weather = createWeather({
    logger,
    fetchJson: async () => {
      throw new Error('down');
    }
  });

  const wx = await weather.forecast(port);
  assert.equal(wx.degraded, true);
  assert.ok(BUCKETS.includes(wx.bucket));
  assert.notEqual(wx.bucket, 'storm');
  assert.equal(typeof wx.isNight, 'boolean');
  assert.equal(wx.glass.key, 'unknown');
  assert.equal(wx.glass.bite, 1);

  const sea = await weather.waves(port);
  assert.equal(sea.degraded, true);
  assert.ok(sea.height > 0);

  const outlook = await weather.daily(port);
  assert.equal(outlook.days.length, 6);
  assert.equal(outlook.degraded, true);
  assert.ok(outlook.days.every((day) => day.bucket !== 'storm'));

  const none = await weather.forecast(null);
  assert.equal(none.bucket, 'cloud');
});

test('a live-shaped outlook parses sun, rain and wind', async () => {
  const weather = createWeather({
    logger,
    fetchJson: async () => ({
      daily: {
        time: ['2026-05-14', '2026-05-15'],
        weather_code: [0, 61],
        temperature_2m_max: [21.4, 17.2],
        temperature_2m_min: [12.6, 10.1],
        precipitation_sum: [0, 4.2],
        precipitation_probability_max: [5, 82],
        wind_speed_10m_max: [14.2, 46.8],
        uv_index_max: [7.4, 3.1],
        sunrise: ['2026-05-14T05:30', '2026-05-15T05:29'],
        sunset: ['2026-05-14T19:41', '2026-05-15T19:42'],
        daylight_duration: [51120, 51180]
      }
    })
  });

  const outlook = await weather.daily(port);
  assert.equal(outlook.degraded, false);
  assert.equal(outlook.days[0].bucket, 'clear');
  assert.equal(outlook.days[1].bucket, 'rain');
  assert.equal(outlook.days[0].tmax, 21);
  assert.equal(outlook.days[1].precipChance, 82);
  assert.equal(outlook.days[1].wind, 47);
  assert.equal(outlook.days[0].daylightMs, 51120 * 1000);
});

test('a live forecast carries the three-hour barometer trend', async () => {
  const hour = 3_600_000;
  const base = Math.floor(Date.now() / hour) * hour;
  const times = Array.from({ length: 8 }, (_, i) =>
    new Date(base - (7 - i) * hour).toISOString().slice(0, 16)
  );
  const pressures = [1010, 1008, 1006, 1004, 1002.4, 1001, 999, 997.2];

  const weather = createWeather({
    logger,
    fetchJson: async () => ({
      current: {
        temperature_2m: 18.4,
        weather_code: 0,
        wind_speed_10m: 11.2,
        surface_pressure: 997.2
      },
      hourly: { time: times, surface_pressure: pressures },
      daily: {
        sunrise: [new Date(base - 7 * hour).toISOString().slice(0, 16)],
        sunset: [new Date(base + 4 * hour).toISOString().slice(0, 16)],
        daylight_duration: [39600]
      }
    })
  });

  const wx = await weather.forecast(port);
  assert.equal(wx.degraded, false);
  assert.equal(wx.pressure, 997.2);
  assert.equal(wx.pressureDelta, -5.2);
  assert.equal(wx.glass.key, 'falling');
  assert.equal(wx.glass.bite, 1.08);
  assert.equal(wx.glass.storm, false);
});

test('the barometer has pre-midnight hours to compare against', async () => {
  const hour = 3_600_000;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * hour).toISOString().slice(0, 10);
  const start = Math.floor((Date.now() - 24 * hour) / hour) * hour;
  const times = Array.from({ length: 48 }, (_, i) =>
    new Date(start + i * hour).toISOString().slice(0, 16)
  );
  const pressures = Array.from({ length: 48 }, (_, i) => 1000 + i * 0.1);

  let seen = '';
  const weather = createWeather({
    logger,
    fetchJson: async (url) => {
      seen = url;
      return {
        current: { temperature_2m: 12, weather_code: 2, wind_speed_10m: 10, surface_pressure: 1004 },
        hourly: { time: times, surface_pressure: pressures },
        daily: {
          time: [yesterday, today],
          sunrise: [`${yesterday}T06:00`, `${today}T06:00`],
          sunset: [`${yesterday}T18:00`, `${today}T18:00`],
          daylight_duration: [43200, 43200]
        }
      };
    }
  });

  const wx = await weather.forecast(port);
  assert.match(seen, /past_days=1/);
  assert.equal(wx.sunrise, Date.parse(`${today}T06:00Z`), 'sun times come from today, not yesterday');
  assert.notEqual(wx.glass.key, 'unknown', 'a delta exists even just after 00:00 UTC');
});

test('geocode returns null when nothing matches', async () => {
  const weather = createWeather({ logger, fetchJson: async () => ({ results: [] }) });
  assert.equal(await weather.geocode('nowhere'), null);
});
