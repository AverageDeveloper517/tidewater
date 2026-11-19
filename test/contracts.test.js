import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContracts,
  contractValue,
  isExpired,
  missingFor,
  nextUtcMidnight
} from '../src/lib/contracts.js';

const date = new Date('2026-05-14T10:30:00Z');
const guild = '1234567890';

test('the board is deterministic for a guild and a UTC day', () => {
  const a = buildContracts({ guildId: guild, date });
  const b = buildContracts({ guildId: guild, date: new Date('2026-05-14T23:59:00Z') });
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
});

test('another guild or another day gets another board', () => {
  const base = buildContracts({ guildId: guild, date });
  const otherGuild = buildContracts({ guildId: '999', date });
  const otherDay = buildContracts({ guildId: guild, date: new Date('2026-05-15T10:30:00Z') });

  assert.notDeepEqual(base, otherGuild);
  assert.notDeepEqual(base, otherDay);
});

test('contracts have unique slots and references', () => {
  const board = buildContracts({ guildId: guild, date });
  assert.deepEqual(board.map((c) => c.slot), [1, 2, 3]);
  assert.equal(new Set(board.map((c) => c.id)).size, 3);

  for (const contract of board) {
    assert.ok(contract.title.length > 0);
    assert.ok(contract.brief.length > 0);
    assert.ok(contract.items.length >= 1 && contract.items.length <= 2);
    for (const item of contract.items) {
      assert.ok(item.key && item.name);
      assert.ok(item.qty >= 1 && item.qty <= 8);
    }
  }
});

test('a contract pays above the goods value and gives xp', () => {
  const board = buildContracts({ guildId: guild, date });
  for (const contract of board) {
    assert.ok(contract.reward > contractValue(contract));
    assert.ok(contract.reward >= 25);
    assert.ok(contract.xp >= 15 && contract.xp <= 40);
  }
});

test('higher local prices raise the reward', () => {
  const cheap = buildContracts({ guildId: guild, date, priceOf: () => 1 });
  const dear = buildContracts({ guildId: guild, date, priceOf: () => 100 });
  assert.ok(dear[0].reward > cheap[0].reward);
});

test('expiry is the next UTC midnight', () => {
  const expires = nextUtcMidnight(date);
  assert.equal(expires, Date.UTC(2026, 4, 15));
  assert.ok(isExpired({ expires }, expires));
  assert.equal(isExpired({ expires }, expires - 1), false);
  assert.equal(isExpired(null), false);
});

test('missingFor reports only what the hold is short of', () => {
  const contract = {
    items: [
      { key: 'kelp', name: 'Kelp', qty: 4 },
      { key: 'pearl', name: 'Pearl', qty: 2 }
    ]
  };

  assert.deepEqual(missingFor(contract, { kelp: 4, pearl: 2 }), []);

  const missing = missingFor(contract, { kelp: 1, pearl: 2 });
  assert.equal(missing.length, 1);
  assert.equal(missing[0].key, 'kelp');
  assert.equal(missing[0].have, 1);
  assert.equal(missing[0].need, 4);
});
