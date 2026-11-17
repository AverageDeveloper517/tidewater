import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

export async function loadCommands(dir, logger) {
  const absolute = resolve(dir);
  const entries = (await readdir(absolute, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const commands = new Map();

  for (const entry of entries) {
    const mod = await import(pathToFileURL(join(absolute, entry.name)).href);
    const command = mod.default;

    if (!command?.data || typeof command.run !== 'function') {
      logger.warn(`skipped ${entry.name} - needs a default export with data + run`);
      continue;
    }

    const json = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
    if (!json?.name) {
      logger.warn(`skipped ${entry.name} - slash data has no name`);
      continue;
    }
    if (commands.has(json.name)) {
      throw new Error(`duplicate slash command "${json.name}" in ${entry.name}`);
    }

    command.data = json;
    commands.set(json.name, command);
  }

  return { commands, count: commands.size };
}
