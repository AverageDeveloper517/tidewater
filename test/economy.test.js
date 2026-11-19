import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankPlayer,
  createEconomy,
  credit,
  debit,
  levelFor,
  netWorth,
  xpForLevel,
  START_WALLET
} from '../src/services/economy.js';

function memoryStore() {
  const data = {};
  return {
    get: (key, fallback = null) => (Object.hasOwn(data, key) ? data[key] : fallback),
    set: (key, value) => {
      data[key] = value;
      return value;
    },
    all: () => data
  };
}

test('level curve is monotonic and matches the xp thresholds', () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(39), 1);
  assert.equal(levelFor(40), 2);
  assert.equal(levelFor(160), 3);
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 40);
  assert.equal(xpForLevel(3), 160);

  let previous = 0;
  for (let xp = 0; xp < 5000; xp += 7) {
    const level = levelFor(xp);
    assert.ok(level >= previous);
    previous = level;
  }
});

test('credit and debit never go negative', () => {
  const player = blankPlayer({ id: '1', name: 'tester' });
  assert.equal(player.wallet, START_WALLET);

  assert.equal(debit(player, 100), true);
  assert.equal(player.wallet, START_WALLET - 100);

  assert.equal(debit(player, 1_000_000), false);
  assert.equal(player.wallet, START_WALLET - 100);

  credit(player, -999);
  assert.equal(player.wallet, 0);
});

test('net worth includes bank, holdings and goods', () => {
  const player = blankPlayer({ id: '2', name: 'worth' });
  player.wallet = 100;
  player.bank = 200;
  player.holdings = { tide: { qty: 2, cost: 8000 } };
  player.goods = { pearl: 3 };

  const worth = netWorth(player, { tide: 4200 });
  assert.equal(worth, 100 + 200 + 8400 + 3 * 260);
});

test('economy refuses updates for unknown players', async () => {
  const economy = createEconomy({ store: memoryStore() });
  const out = await economy.update('nobody', (p) => {
    p.wallet = 1;
  });
  assert.equal(out.missing, true);
  assert.equal(economy.get('nobody'), null);
});

test('create is idempotent and serialises updates per user', async () => {
  const store = memoryStore();
  const economy = createEconomy({ store });

  const first = await economy.create('9', { name: 'dock', port: { name: 'Test', lat: 1, lon: 2 } });
  assert.equal(first.created, true);

  const again = await economy.create('9', { name: 'other', port: null });
  assert.equal(again.created, false);
  assert.equal(economy.get('9').port.name, 'Test');

  await Promise.all(
    Array.from({ length: 25 }, () =>
      economy.update('9', (p) => {
        credit(p, 10);
      })
    )
  );

  assert.equal(economy.get('9').wallet, START_WALLET + 250);
});

test('achievements unlock once and pay once', async () => {
  const economy = createEconomy({ store: memoryStore() });
  await economy.create('3', { name: 'a', port: null });

  const { fresh } = await economy.update('3', (p) => {
    p.stats.work = 10;
  });

  assert.ok(fresh.some((a) => a.id === 'dockhand'));

  const second = await economy.update('3', (p) => {
    p.stats.work = 11;
  });
  assert.equal(second.fresh.length, 0);
});

test('markGuild records each guild once and ignores unknown players', async () => {
  const economy = createEconomy({ store: memoryStore() });
  await economy.create('4', { name: 'g', port: null });

  assert.deepEqual(economy.get('4').guilds, {});

  assert.equal(economy.markGuild('4', 'guild-a'), true);
  assert.equal(economy.markGuild('4', 'guild-a'), false, 'second hit is a no-op');
  assert.equal(economy.markGuild('4', 'guild-b'), true);

  const player = economy.get('4');
  assert.deepEqual(Object.keys(player.guilds).sort(), ['guild-a', 'guild-b']);
  assert.ok(player.guilds['guild-a'] > 0);

  assert.equal(economy.markGuild('4', null), false, 'no guild id is a no-op');
  assert.equal(economy.markGuild('nobody', 'guild-a'), false, 'unknown player is a no-op');
});
