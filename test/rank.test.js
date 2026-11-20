import test from 'node:test';
import assert from 'node:assert/strict';

import { RANKS, rankFor, nextRank, rankLine, contractBonus, CONTRACT_BONUS_CAP } from '../src/lib/rank.js';

test('ranks follow the level ladder', () => {
  assert.equal(rankFor(1).name, 'Deckhand');
  assert.equal(rankFor(4).name, 'Deckhand');
  assert.equal(rankFor(5).name, 'Able Hand');
  assert.equal(rankFor(14).name, 'Bosun');
  assert.equal(rankFor(15).name, 'Mate');
  assert.equal(rankFor(20).name, 'Captain');
  assert.equal(rankFor(100).name, 'Harbourmaster');
  assert.equal(nextRank(1).name, 'Able Hand');
  assert.equal(nextRank(100), null);
  assert.match(rankLine(5), /Able Hand/);
});

test('contract pay rises every five levels and caps', () => {
  assert.equal(contractBonus(1), 0);
  assert.equal(contractBonus(4), 0);
  assert.equal(contractBonus(5), 0.05);
  assert.equal(contractBonus(9), 0.05);
  assert.equal(contractBonus(10), 0.1);
  assert.equal(contractBonus(20), CONTRACT_BONUS_CAP);
  assert.equal(contractBonus(99), CONTRACT_BONUS_CAP);
  assert.equal(CONTRACT_BONUS_CAP, 0.2);
  assert.equal(RANKS[0].level, 1);
});
