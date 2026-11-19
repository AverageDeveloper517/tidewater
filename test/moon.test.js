import test from 'node:test';
import assert from 'node:assert/strict';

import { moonPhase, moonPhaseAt, nextPhase, tideClass, SYNODIC_DAYS } from '../src/lib/moon.js';

test('known new and full moons land where the almanac says', () => {
  const newMoon = moonPhase(new Date('2024-04-08T18:21:00Z'));
  assert.ok(newMoon.illuminationPct <= 1, `new moon should be dark, got ${newMoon.illuminationPct}%`);
  assert.equal(newMoon.key, 'new');

  const fullMoon = moonPhase(new Date('2024-04-23T23:49:00Z'));
  assert.ok(fullMoon.illuminationPct >= 99, `full moon should be lit, got ${fullMoon.illuminationPct}%`);
  assert.equal(fullMoon.key, 'full');
});

test('one synodic month returns to the same phase', () => {
  const start = new Date('2026-03-01T00:00:00Z');
  const later = new Date(start.getTime() + SYNODIC_DAYS * 86_400_000);
  const delta = Math.abs(moonPhaseAt(start) - moonPhaseAt(later));
  assert.ok(Math.min(delta, 1 - delta) < 0.001);
});

test('illumination rises to full and falls back to new', () => {
  const newAt = Date.parse('2024-04-08T18:21:00Z');
  const cycle = SYNODIC_DAYS * 86_400_000;

  const waxing = moonPhase(new Date(newAt + cycle * 0.25));
  const full = moonPhase(new Date(newAt + cycle * 0.5));

  assert.equal(waxing.key, 'first-quarter');
  assert.equal(full.key, 'full');
  assert.ok(full.illuminationPct > waxing.illuminationPct);
  assert.equal(waxing.waxing, true);
});

test('spring tides at new and full, neap tides at the quarters', () => {
  const newAt = Date.parse('2024-04-08T18:21:00Z');
  const cycle = SYNODIC_DAYS * 86_400_000;

  const atNew = moonPhase(new Date(newAt));
  const atFull = moonPhase(new Date(newAt + cycle * 0.5));
  const atQuarter = moonPhase(new Date(newAt + cycle * 0.25));

  assert.equal(tideClass(atNew).key, 'spring');
  assert.equal(tideClass(atFull).key, 'spring');
  assert.equal(tideClass(atQuarter).key, 'neap');
  assert.ok(atNew.springFactor > atQuarter.springFactor);
});

test('nextPhase always returns a future date within one lunar month', () => {
  const now = new Date('2026-11-19T00:00:00Z');
  for (const key of ['new', 'first-quarter', 'full', 'last-quarter']) {
    const next = nextPhase(now, key);
    assert.ok(next instanceof Date);
    assert.ok(next.getTime() > now.getTime(), `${key} should be in the future`);
    assert.ok(next.getTime() - now.getTime() <= SYNODIC_DAYS * 86_400_000 + 1000);
  }
  assert.equal(nextPhase(now, 'not-a-phase'), null);
});
