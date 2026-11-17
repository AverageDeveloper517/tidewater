import test from 'node:test';
import assert from 'node:assert/strict';

import { affinity, bucketFor, createWeather, waveMood, BUCKETS } from '../src/services/weather.js';
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

  const sea = await weather.waves(port);
  assert.equal(sea.degraded, true);
  assert.ok(sea.height > 0);

  const none = await weather.forecast(null);
  assert.equal(none.bucket, 'cloud');
});

test('geocode returns null when nothing matches', async () => {
  const weather = createWeather({ logger, fetchJson: async () => ({ results: [] }) });
  assert.equal(await weather.geocode('nowhere'), null);
});
