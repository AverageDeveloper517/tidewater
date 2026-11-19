import test from 'node:test';
import assert from 'node:assert/strict';

import { createMarket, fee, goodPrice, maxAffordable, priceInstrument } from '../src/services/market.js';
import { INSTRUMENTS } from '../src/data/instruments.js';

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

const logger = { warn() {} };

const live = {
  crypto: { bitcoin: { usd: 90_000 }, ethereum: { usd: 3_500 }, solana: { usd: 200 } },
  fx: { EUR: 0.9, JPY: 150 }
};

const fakeFetch = async (url) => {
  if (url.includes('coingecko')) {
    return { bitcoin: { usd: 90_000 }, ethereum: { usd: 3_500 }, solana: { usd: 200 } };
  }
  return { rates: { EUR: 0.9, JPY: 150 } };
};

const downFetch = async () => {
  throw new Error('network down');
};

test('prices map live data onto the shell base', () => {
  const tide = INSTRUMENTS.find((i) => i.key === 'tide');
  assert.equal(priceInstrument(tide, live), 4200);

  const euro = INSTRUMENTS.find((i) => i.key === 'euro');
  assert.equal(priceInstrument(euro, live), 111.11);

  const yen = INSTRUMENTS.find((i) => i.key === 'yen');
  assert.equal(priceInstrument(yen, live), 0.67);
});

test('a live board fills every instrument and is not degraded', async () => {
  const market = createMarket({ store: memoryStore(), logger, fetchJson: fakeFetch });
  const board = await market.board();

  assert.equal(board.rows.length, INSTRUMENTS.length);
  assert.equal(board.degraded, false);
  assert.equal(board.prices.tide, 4200);
  assert.equal(board.prices.euro, 111.11);
  assert.ok(board.fxFactor > 1);
});

test('a dead feed falls back to base prices instead of throwing', async () => {
  const market = createMarket({ store: memoryStore(), logger, fetchJson: downFetch });
  const board = await market.board();

  assert.equal(board.rows.length, INSTRUMENTS.length);
  assert.equal(board.degraded, true);
  assert.equal(board.prices.tide, 4200);
  assert.equal(board.prices.reef, 165);
  assert.equal(board.prices.glow, 9.5);
});

test('last good prices survive a partial outage', async () => {
  const store = memoryStore();
  const healthy = createMarket({ store, logger, fetchJson: fakeFetch });
  await healthy.board();

  const partial = createMarket({
    store,
    logger,
    fetchJson: async (url) => {
      if (url.includes('coingecko')) return { bitcoin: { usd: 90_000 }, ethereum: { usd: 3_500 }, solana: { usd: 200 } };
      throw new Error('fx down');
    }
  });

  const board = await partial.board();
  assert.equal(board.prices.euro, 111.11);
  assert.equal(board.degraded, true);
});

test('fee and goods pricing are deterministic per day', () => {
  assert.equal(fee(10_000), 50);
  const a = goodPrice('pearl', 1, new Date('2026-01-01T00:00:00Z'));
  const b = goodPrice('pearl', 1, new Date('2026-01-01T23:00:00Z'));
  assert.equal(a, b);
  assert.ok(a > 0);
  assert.ok(goodPrice('pearl', 2) > goodPrice('pearl', 1));
  assert.equal(goodPrice('nope', 1), 0);
});

test('buy all never quotes a fill the wallet cannot cover', () => {
  for (const price of [0.63, 3.46, 82.4, 110.14, 2881.43]) {
    for (let wallet = 1; wallet <= 20_000; wallet += 13) {
      const qty = maxAffordable(price, wallet);
      const gross = Math.round(price * qty);
      assert.ok(gross + fee(gross) <= wallet, `${qty} @ ${price} fits ${wallet}`);

      if (qty > 0) {
        const next = Math.round(price * (qty + 1));
        assert.ok(next + fee(next) > wallet, `${qty + 1} @ ${price} must not fit ${wallet}`);
      }
    }
  }

  // the regression: the old formula quoted 4,075 units for 14,170 shells
  assert.equal(maxAffordable(3.46, 14_170), 4_074);
});
