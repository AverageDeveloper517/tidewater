import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTide,
  describeTide,
  findExtremes,
  nextExtremes,
  parseSeries,
  parseUtc,
  rangeIn,
  currentAt,
  syntheticTide,
  tideMood
} from '../src/services/tide.js';
import { sparkline, timeTag } from '../src/lib/util.js';

const HOUR = 3_600_000;
const start = Date.UTC(2026, 0, 1);
const sine = Array.from({ length: 49 }, (_, i) => ({
  at: start + i * HOUR,
  level: 1.5 * Math.sin((2 * Math.PI * i) / 12.4206)
}));

test('hourly marine stamps parse as UTC', () => {
  assert.equal(parseUtc('2026-01-01T00:00'), Date.UTC(2026, 0, 1));
  assert.equal(parseUtc('2026-01-01T00:00Z'), Date.UTC(2026, 0, 1));
  assert.ok(Number.isNaN(parseUtc('nope')));
});

test('parseSeries keeps finite hours only', () => {
  const points = parseSeries({
    time: ['2026-01-01T00:00', '2026-01-01T01:00', '2026-01-01T02:00'],
    sea_level_height_msl: [0.4, null, -0.2]
  });
  assert.equal(points.length, 2);
  assert.equal(points[0].level, 0.4);
});

test('extremes land on the sine peaks and troughs', () => {
  const extremes = findExtremes(sine);
  assert.ok(extremes.length >= 6);

  const firstHigh = extremes.find((e) => e.type === 'high');
  const firstLow = extremes.find((e) => e.type === 'low');
  assert.ok(firstHigh.at > start);
  assert.ok(firstLow.at > start);

  const future = nextExtremes(extremes, start + 13 * HOUR, 2);
  assert.equal(future.length, 2);
  assert.ok(future.every((e) => e.at > start + 13 * HOUR));
  assert.ok(future[0].at <= future[1].at);
});

test('current level interpolates between hours and reports a slope', () => {
  const atHalf = currentAt(sine, start + 0.5 * HOUR);
  const atOne = currentAt(sine, start + HOUR);
  assert.ok(Math.abs(atHalf.level - (sine[0].level + sine[1].level) / 2) < 0.2);
  assert.ok(atOne.slope > 0, 'first hour is rising');
});

test('range measures the next 24 hours', () => {
  const range = rangeIn(sine, start, 24);
  assert.ok(range > 1.5);
  assert.ok(range < 4);
});

test('tide mood rewards rising spring water and caps the rest', () => {
  const rising = tideMood({ trend: 'rising', range: 3, springFactor: 1.25 });
  const falling = tideMood({ trend: 'falling', range: 3, springFactor: 1.25 });
  const slack = tideMood({ trend: 'slack', range: 3, springFactor: 1 });
  const offline = tideMood({ degraded: true });

  assert.ok(rising.bite > falling.bite);
  assert.ok(falling.bite > slack.bite);
  assert.equal(offline.bite, 1);
  assert.ok(rising.bite <= 1.45);
  assert.equal(rising.label, 'feeding tide');
});

test('describeTide folds the series into a readable card', () => {
  const tide = describeTide(sine, { now: start + 2 * HOUR });
  assert.equal(tide.trend, 'rising');
  assert.ok(tide.level > 0);
  assert.ok(tide.range > 0);
  assert.equal(tide.extremes.length, 4);
  assert.equal(tide.spark.length > 12, true);
  assert.equal(tide.degraded, false);
  assert.equal(tide.source, 'open-meteo marine');
});

test('the lunar fallback is deterministic per port and still moves', () => {
  const port = { name: 'Test', lat: 1, lon: 2 };
  const a = syntheticTide(port, new Date(start));
  const b = syntheticTide(port, new Date(start));
  assert.deepEqual(a, b);
  assert.equal(a.length, 48);
  assert.ok(Math.max(...a.map((p) => p.level)) > Math.min(...a.map((p) => p.level)));
});

test('the tide service falls back when the feed throws', async () => {
  const tide = createTide({
    fetchJson: async () => {
      throw new Error('down');
    },
    logger: { warn() {} }
  });

  const port = { name: 'Test', lat: 1, lon: 2 };
  const first = await tide.at(port);
  const second = await tide.at(port);

  assert.equal(first.degraded, true);
  assert.equal(first.source, 'lunar fallback');
  assert.equal(first.bite, 1);
  assert.ok(first.extremes.length > 0);
  assert.equal(first.level, second.level);
});

test('sparkline and timestamp helpers are safe on tiny inputs', () => {
  assert.equal(sparkline([1]), '');
  assert.equal(sparkline([]), '');
  assert.equal(sparkline([2, 2, 2]).length, 3);
  assert.equal(sparkline([1, 2, 3, 4], 4).length, 4);
  assert.match(timeTag(0), /^<t:0:/);
});
