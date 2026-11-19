import test from 'node:test';
import assert from 'node:assert/strict';

import { createEconomy } from '../src/services/economy.js';
import { createMarket } from '../src/services/market.js';
import { createWeather } from '../src/services/weather.js';
import { createTide } from '../src/services/tide.js';

import tideCommand from '../src/commands/tide.js';
import almanacCommand from '../src/commands/almanac.js';
import contractsCommand from '../src/commands/contracts.js';
import fishCommand from '../src/commands/fish.js';
import workCommand from '../src/commands/work.js';
import dailyCommand from '../src/commands/daily.js';
import bankCommand from '../src/commands/bank.js';
import payCommand from '../src/commands/pay.js';

const PORT = { name: 'Lisbon', country: 'PT', lat: 38.72, lon: -9.14 };

const logger = { info() {}, ok() {}, warn() {}, error() {}, child() { return this; } };

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

async function harness() {
  const store = memoryStore();
  const economy = createEconomy({ store });
  const market = createMarket({
    store,
    logger,
    fetchJson: async () => {
      throw new Error('offline');
    }
  });
  const weather = createWeather({ logger, fetchJson: async () => { throw new Error('offline'); } });
  const tide = createTide({ logger, fetchJson: async () => { throw new Error('offline'); } });

  await economy.create('u1', { name: 'tester', port: PORT });

  const run = async (command, { sub = null, slot = null, amount = null, user = null, strings = {} } = {}) => {
    const payloads = [];
    const reply = async (payload) => {
      payloads.push(payload);
    };
    const interaction = { user: { id: 'u1' }, guildId: 'g1', id: 'i1' };
    const options = {
      getSubcommand: () => sub,
      getInteger: (name) => (name === 'amount' ? amount : slot),
      getString: (name) => strings[name] ?? null,
      getUser: () => user
    };

    await command.run({ interaction, options, reply, economy, market, weather, tide });
    const embed = payloads.at(-1)?.embeds?.[0];
    return { embed, data: embed?.data ?? {} };
  };

  return { economy, market, weather, tide, run };
}

test('/tide renders a real fallback card and counts the visit', async () => {
  const h = await harness();
  const { data } = await h.run(tideCommand);

  assert.match(data.title, /tide/);
  assert.ok(data.description.includes('now'));
  const names = data.fields.map((f) => f.name);
  assert.ok(names.includes('next high'));
  assert.ok(names.includes('fishing'));
  assert.ok(names.includes('next marks'));

  const player = h.economy.get('u1');
  assert.equal(player.stats.tides, 1);
});

test('/almanac combines outlook, tide, moon and planting advice', async () => {
  const h = await harness();
  const { data } = await h.run(almanacCommand);

  assert.match(data.title, /almanac/);
  assert.ok(data.description.includes('plant now'));
  const names = data.fields.map((f) => f.name);
  assert.deepEqual(names, ['six days', 'water', 'bait', 'planting, best day in four', 'warnings']);
  assert.ok(data.fields[0].value.split('\n').length >= 5);
  assert.equal(
    data.fields.find((f) => f.name === 'warnings').value,
    'outlook down - no advisories to read',
    'a dead outlook must not claim there are no warnings'
  );
});

test('/contracts view shows three jobs and take locks one in', async () => {
  const h = await harness();

  const view = await h.run(contractsCommand, { sub: 'view' });
  assert.equal(view.data.title, 'the harbour board');
  assert.equal(view.data.fields.length, 3);

  const take = await h.run(contractsCommand, { sub: 'take', slot: 1 });
  assert.match(take.data.title, /taken/);

  const player = h.economy.get('u1');
  assert.equal(player.contract.slot, 1);
  assert.ok(player.contract.items.length >= 1);
});

test('/contracts deliver pays once and clears the job', async () => {
  const h = await harness();
  await h.run(contractsCommand, { sub: 'take', slot: 2 });

  const contract = h.economy.get('u1').contract;
  await h.economy.update('u1', (p) => {
    for (const item of contract.items) p.goods[item.key] = (p.goods[item.key] ?? 0) + item.qty;
  });

  const before = h.economy.get('u1').wallet;
  const out = await h.run(contractsCommand, { sub: 'deliver' });

  assert.match(out.data.title, /delivered/);

  const after = h.economy.get('u1');
  assert.equal(after.contract, null);
  assert.equal(after.stats.contracts, 1);
  assert.ok(after.wallet > before, 'reward and achievement should land');
  assert.ok(after.achievements.includes('first_contract'));
});

test('an expired contract clears itself instead of eating the goods', async () => {
  const h = await harness();
  await h.run(contractsCommand, { sub: 'take', slot: 3 });

  await h.economy.update('u1', (p) => {
    p.contract.expires = Date.now() - 1;
    p.goods.kelp = (p.goods.kelp ?? 0) + 5;
  });

  const out = await h.run(contractsCommand, { sub: 'deliver' });
  assert.equal(out.data.title, 'the window closed');

  const player = h.economy.get('u1');
  assert.equal(player.contract, null);
  assert.equal(player.goods.kelp, 5, 'goods are untouched');
});

test('abandon sets the lockout and blocks an immediate take', async () => {
  const h = await harness();
  await h.run(contractsCommand, { sub: 'take', slot: 1 });
  await h.run(contractsCommand, { sub: 'abandon' });

  const player = h.economy.get('u1');
  assert.equal(player.contract, null);
  assert.ok(player.contractLock > Date.now());

  const retry = await h.run(contractsCommand, { sub: 'take', slot: 1 });
  assert.equal(retry.data.title, 'the board is closed to you');
});

test('/fish lands a good offline and says the feeds are down', async () => {
  const h = await harness();
  const out = await h.run(fishCommand);

  assert.match(out.data.description, /you pulled up/);
  assert.match(out.data.footer?.text ?? '', /fallback in use/);
  assert.equal(out.data.description.includes('hPa/3h'), false, 'no fake barometer');

  const player = h.economy.get('u1');
  assert.equal(player.stats.fish, 1);
  const landed = Object.values(player.goods).reduce((sum, qty) => sum + qty, 0);
  assert.equal(landed, 1);

  const names = out.data.fields.map((field) => field.name);
  assert.ok(names.includes('water'));
  assert.ok(names.includes('glass'));
  assert.equal(out.data.fields.find((field) => field.name === 'glass').value, 'no reading');
});

test('two work clicks cannot both pay', async () => {
  const h = await harness();
  const [a, b] = await Promise.all([h.run(workCommand), h.run(workCommand)]);
  const titles = [a.data.title ?? '', b.data.title ?? ''];

  assert.equal(h.economy.get('u1').stats.work, 1, 'one shift stamped');
  assert.equal(titles.filter((title) => /still on shift/.test(title)).length, 1);
});

test('two daily clicks cannot both collect', async () => {
  const h = await harness();
  const before = h.economy.get('u1').wallet;
  const [a, b] = await Promise.all([h.run(dailyCommand), h.run(dailyCommand)]);
  const titles = [a.data.title ?? '', b.data.title ?? ''];
  const player = h.economy.get('u1');

  assert.equal(player.streak, 1);
  assert.equal(titles.filter((title) => title === 'already collected').length, 1);
  assert.ok(player.wallet - before < 400, 'one payout only');
});

test('a deposit cannot empty a wallet that was already spent', async () => {
  const h = await harness();
  const spend = h.economy.update('u1', (p) => {
    p.wallet = 0;
  });
  const out = await h.run(bankCommand, {
    sub: 'deposit',
    strings: { action: 'deposit', amount: '100' }
  });
  await spend;

  const player = h.economy.get('u1');
  assert.equal(player.wallet, 0);
  assert.equal(player.bank, 0);
  assert.equal(out.data.title, 'the vault moved');
});

test('a transfer cannot credit a target when the sender was spent elsewhere', async () => {
  const h = await harness();
  await h.economy.create('u2', { name: 'target', port: PORT });
  const before = h.economy.get('u2').wallet;

  const spend = h.economy.update('u1', (p) => {
    p.wallet = 0;
  });
  const out = await h.run(payCommand, {
    amount: 50,
    user: { id: 'u2', username: 'target', bot: false }
  });
  await spend;

  assert.equal(h.economy.get('u1').wallet, 0);
  assert.equal(h.economy.get('u2').wallet, before, 'no shells minted');
  assert.equal(out.data.title, 'short');
});
