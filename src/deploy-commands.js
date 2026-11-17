import { REST, Routes } from 'discord.js';
import { createLogger } from './lib/logger.js';
import { loadConfig } from './lib/config.js';
import { loadCommands } from './lib/loader.js';

const logger = createLogger('deploy');

async function main() {
  const config = loadConfig();
  const { commands } = await loadCommands('src/commands', logger);
  const body = [...commands.values()].map((command) => command.data);

  const rest = new REST({ version: '10' }).setToken(config.token);
  const appId = (await rest.get(Routes.currentApplication())).id;

  const route = config.guildId
    ? Routes.applicationGuildCommands(appId, config.guildId)
    : Routes.applicationCommands(appId);

  const existing = await rest.get(route).catch(() => []);

  const before = new Map(existing.map((c) => [c.name, JSON.stringify(normalize(c))]));
  const after = new Map(body.map((c) => [c.name, JSON.stringify(normalize(c))]));

  const added = [...after.keys()].filter((name) => !before.has(name));
  const removed = [...before.keys()].filter((name) => !after.has(name));
  const changed = [...after.keys()].filter(
    (name) => before.has(name) && before.get(name) !== after.get(name)
  );

  if (!added.length && !removed.length && !changed.length) {
    logger.ok(`already up to date - ${after.size} command(s)`);
    return;
  }

  for (const name of added) logger.info(`+ /${name}`);
  for (const name of changed) logger.info(`~ /${name}`);
  for (const name of removed) logger.info(`- /${name}`);

  await rest.put(route, { body });
  logger.ok(
    `registered ${body.length} command(s) ${config.guildId ? `in guild ${config.guildId}` : 'globally'}`
  );
}

function normalize(command) {
  const copy = { ...command };
  delete copy.id;
  delete copy.application_id;
  delete copy.guild_id;
  delete copy.version;
  return copy;
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
