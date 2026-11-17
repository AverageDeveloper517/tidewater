// Hits every public endpoint this bot depends on and prints what came back.
// Useful before a release, or when a feed starts behaving differently.
//   node scripts/smoke-live.js

import { createWeather } from '../src/services/weather.js';
import { createMarket } from '../src/services/market.js';
import { createTrivia } from '../src/services/trivia.js';
import { createDex } from '../src/services/pokedex.js';

const logger = { info: console.log, ok: console.log, warn: (m, e) => console.warn('warn:', m, e ?? '') };

const store = { get: () => null, set: () => {} };

const weather = createWeather({ logger });
const market = createMarket({ store, logger, ttlMs: 0 });
const trivia = createTrivia({ logger });
const dex = createDex({ logger });

const failures = [];

function check(name, condition, detail) {
  if (condition) console.log(`ok   ${name} - ${detail}`);
  else {
    console.log(`FAIL ${name} - ${detail}`);
    failures.push(name);
  }
}

const port = await weather.geocode('Lisbon');
check('geocode', Boolean(port), port ? `${port.name}, ${port.country} (${port.lat}, ${port.lon})` : 'no result');

if (port) {
  const wx = await weather.forecast(port);
  check('forecast', !wx.degraded && wx.bucket, `${wx.bucket} ${wx.temp ?? '?'}C`);

  const sea = await weather.waves(port);
  check('marine', !sea.degraded && sea.height > 0, `${sea.height}m / ${sea.period}s`);
}

const board = await market.board({ force: true });
check(
  'market',
  board.rows.length === 5,
  board.rows.map((r) => `${r.key} ${r.price}`).join(', ')
);
check('market live', !board.degraded, board.degraded ? 'fell back to base prices' : 'all feeds up');

const question = await trivia.roll();
check('trivia', Boolean(question.question), `${question.source}, ${question.answers.length} answers`);

const mon = await dex.roll();
check('pokedex', Boolean(mon.name), `${mon.name} (#${mon.id}), base xp ${mon.baseExp}`);

if (failures.length) {
  console.error(`\n${failures.length} feed(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\nall feeds healthy');
