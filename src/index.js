import { Client, GatewayIntentBits } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import { createStore } from './lib/store.js';
import { createGuard } from './lib/guard.js';
import { loadCommands } from './lib/loader.js';
import { resolveEmoji } from './lib/emoji.js';
import { createSettings } from './services/settings.js';
import { createEconomy } from './services/economy.js';
import { createMarket } from './services/market.js';
import { createWeather } from './services/weather.js';
import { createTide } from './services/tide.js';
import { createDex } from './services/pokedex.js';
import { createTrivia } from './services/trivia.js';

const logger = createLogger('boot');

async function loadEvents(client, dir) {
  const absolute = resolve(dir);
  const files = (await readdir(absolute)).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const mod = await import(pathToFileURL(join(absolute, file)).href);
    if (typeof mod.execute !== 'function') {
      logger.warn(`skipped event ${file} - no execute`);
      continue;
    }

    const names = Array.isArray(mod.events) ? mod.events : [mod.name];
    for (const eventName of names.filter(Boolean)) {
      const handler = (...args) => {
        Promise.resolve(
          mod.execute({
            client,
            logger,
            event: eventName,
            payload: args[0],
            interaction: args[0],
            args
          })
        ).catch((err) => logger.error(`event ${eventName} threw:`, err));
      };
      if (mod.once) client.once(eventName, handler);
      else client.on(eventName, handler);
    }
  }
}

async function main() {
  const config = loadConfig();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [], repliedUser: false }
  });

  client.config = config;
  client.guard = createGuard({ config });
  client.startedAt = Date.now();
  client.store = await createStore(resolve('data/store.json'));

  client.settings = createSettings(client.store);
  client.economy = createEconomy({ store: client.store });
  client.market = createMarket({
    store: client.store,
    logger: logger.child('market'),
    ttlMs: config.marketTtlMs
  });
  client.weather = createWeather({ logger: logger.child('weather') });
  client.tide = createTide({ logger: logger.child('tide') });
  client.dex = createDex({ logger: logger.child('dex') });
  client.trivia = createTrivia({ logger: logger.child('trivia') });
  client.emoji = (name) => resolveEmoji(client, name);

  const { commands, count } = await loadCommands(resolve('src/commands'), logger);
  client.commands = commands;
  logger.info(`${count} slash command(s) ready`);

  await loadEvents(client, resolve('src/events'));
  await client.login(config.token);

  const shutdown = async (signal) => {
    logger.warn(`${signal} - closing`);
    await client.store.close().catch(() => {});
    client.destroy();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => logger.error('unhandled rejection:', err));
process.on('uncaughtException', (err) => logger.error('uncaught exception:', err));

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
