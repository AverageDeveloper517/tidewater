import test from 'node:test';
import assert from 'node:assert/strict';

import { bandFactor, seaBand, bandReport, catchTable, BAND_EDGE } from '../src/lib/water.js';
import { waveMood, glassFor } from '../src/services/weather.js';

const calm = waveMood(1);

test('a species inside its band keeps full weight', () => {
  assert.equal(bandFactor(8, [0, 11]), 1);
  assert.equal(bandFactor(0, [0, 11]), 1);
  assert.equal(bandFactor(11, [0, 11]), 1);
});

test('outside the band the weight falls off over four degrees', () => {
  assert.equal(bandFactor(11 + BAND_EDGE / 2, [0, 11]), 0.5);
  assert.equal(bandFactor(0 - BAND_EDGE / 2, [0, 11]), 0.5);
  assert.equal(bandFactor(0 - BAND_EDGE * 2, [0, 11]), 0.02);
  assert.equal(bandFactor(30, [0, 11]), 0.02);
});

test('no reading leaves every species untouched', () => {
  assert.equal(bandFactor(null, [0, 11]), 1);
  assert.equal(bandFactor(undefined, [0, 11]), 1);
  assert.equal(bandFactor(8, null), 1);
  assert.deepEqual(bandReport(null), { inBand: [], outBand: [] });
});

test('the sea reads cold through tropical', () => {
  assert.equal(seaBand(3).key, 'freezing');
  assert.equal(seaBand(8).key, 'cold');
  assert.equal(seaBand(12).key, 'cool');
  assert.equal(seaBand(18).label, 'temperate');
  assert.equal(seaBand(22).key, 'warm');
  assert.equal(seaBand(27).label, 'tropical');
  assert.equal(seaBand(null).key, 'unknown');
});

test('cold water belongs to cod and herring, warm water to bonito and mahi', () => {
  const cold = bandReport(6);
  assert.ok(cold.inBand.includes('Atlantic cod'));
  assert.ok(cold.inBand.includes('Herring shoal'));
  assert.ok(cold.outBand.includes('Mahi-mahi'));

  const warm = bandReport(25);
  assert.ok(warm.inBand.includes('Bonito'));
  assert.ok(warm.inBand.includes('Mahi-mahi'));
  assert.ok(warm.outBand.includes('Atlantic cod'));
});

test('the catch table follows the water temperature', () => {
  const cold = catchTable({ sst: 6, mood: calm, bite: 1, light: 1 });
  const warm = catchTable({ sst: 25, mood: calm, bite: 1, light: 1 });
  const weightOf = (table, key) => table.find((row) => row.key === key).weight;

  assert.equal(weightOf(cold, 'cod'), 9);
  assert.equal(weightOf(cold, 'mahi'), 0.02 * 1.8);
  assert.equal(weightOf(warm, 'mahi'), 1.8);
  assert.equal(weightOf(warm, 'cod'), 0.02 * 9);
  assert.ok(weightOf(cold, 'cod') > weightOf(cold, 'mahi'));
  assert.ok(weightOf(warm, 'mahi') > weightOf(warm, 'cod'));
});

test('an unknown sea temperature keeps the old table exactly', () => {
  const unknown = catchTable({ sst: null, mood: calm, bite: 1, light: 1 });
  const cod = unknown.find((row) => row.key === 'cod');
  assert.equal(cod.weight, 9);
});

test('a falling glass feeds the fish, a rising one slows them', () => {
  const falling = glassFor({ pressure: 1001.2, delta: -4.2 });
  assert.equal(falling.key, 'falling');
  assert.equal(falling.bite, 1.08);
  assert.equal(falling.storm, false);

  const rising = glassFor({ pressure: 1018, delta: 3.4 });
  assert.equal(rising.key, 'rising');
  assert.equal(rising.bite, 0.97);

  assert.equal(glassFor({ pressure: 1013, delta: 0.4 }).bite, 1);
});

test('a deep low is a storm warning, not a mood', () => {
  const drop = glassFor({ pressure: 996, delta: -6.4 });
  assert.equal(drop.bite, 1.14);
  assert.equal(drop.storm, true);

  const deep = glassFor({ pressure: 982, delta: 0 });
  assert.equal(deep.storm, true);
  assert.equal(deep.bite, 1);
});

test('no barometer means no bonus and no penalty', () => {
  const down = glassFor({ degraded: true });
  assert.equal(down.key, 'unknown');
  assert.equal(down.bite, 1);
  assert.equal(down.delta, null);
  assert.equal(down.storm, false);

  assert.equal(glassFor({ pressure: 1008, delta: null }).key, 'unknown');
  assert.equal(glassFor().key, 'unknown');
});
