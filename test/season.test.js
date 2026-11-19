import test from 'node:test';
import assert from 'node:assert/strict';

import { seasonFor, seasonCropMult } from '../src/lib/season.js';

const at = (month) => new Date(Date.UTC(2026, month, 15, 12, 0, 0));

test('seasons follow the real calendar month', () => {
  assert.equal(seasonFor(at(0)).key, 'winter');
  assert.equal(seasonFor(at(1)).key, 'winter');
  assert.equal(seasonFor(at(2)).key, 'spring');
  assert.equal(seasonFor(at(3)).key, 'spring');
  assert.equal(seasonFor(at(4)).key, 'spring');
  assert.equal(seasonFor(at(5)).key, 'summer');
  assert.equal(seasonFor(at(6)).key, 'summer');
  assert.equal(seasonFor(at(7)).key, 'summer');
  assert.equal(seasonFor(at(8)).key, 'autumn');
  assert.equal(seasonFor(at(9)).key, 'autumn');
  assert.equal(seasonFor(at(10)).key, 'autumn');
  assert.equal(seasonFor(at(11)).key, 'winter');
});

test('every season names itself and has crop multipliers', () => {
  for (const month of [0, 2, 5, 8]) {
    const season = seasonFor(at(month));
    assert.ok(season.name);
    assert.ok(season.blurb);
    assert.ok(season.glyph);
    assert.ok(season.crop && Object.keys(season.crop).length > 0);
  }
});

test('crop multipliers are positive and unknown crops are neutral', () => {
  for (const month of [0, 2, 5, 8]) {
    const season = seasonFor(at(month));
    for (const key of ['kelp', 'coral', 'brine']) {
      const mult = seasonCropMult(season, key);
      assert.ok(mult > 0, `${season.key}/${key} should be positive`);
    }
  }

  assert.equal(seasonCropMult(seasonFor(at(0)), 'not_a_crop'), 1);
  assert.equal(seasonCropMult(null, 'kelp'), 1);
});

test('seasons actually change the payout across the year', () => {
  const winter = seasonFor(at(0));
  const summer = seasonFor(at(6));

  assert.notEqual(seasonCropMult(winter, 'kelp'), seasonCropMult(summer, 'kelp'));
});
