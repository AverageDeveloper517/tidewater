import { readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { GLYPH } from '../lib/emoji.js';

// Drop PNG/JPG/GIF files into assets/emoji/, name each file after a key in
// src/lib/emoji.js (shell.png, tide.png, ...), then run `npm run emojis`.
// The bot keeps using unicode glyphs for any key with no uploaded emoji.

const logger = createLogger('emoji');
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.gif']);

const dir = resolve('assets/emoji');

const files = (await readdir(dir).catch(() => [])).filter((file) =>
  ALLOWED.has(extname(file).toLowerCase())
);

if (!files.length) {
  logger.warn(`no images in ${dir} - drop PNGs named after a GLYPH key and run again`);
  process.exit(0);
}

const config = loadConfig();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(config.token);
await client.application.fetch();
await client.application.emojis.fetch();

const existing = new Set(client.application.emojis.cache.map((emoji) => emoji.name));

for (const file of files) {
  const name = file
    .slice(0, -extname(file).length)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');

  if (!(name in GLYPH)) {
    logger.warn(`skipped ${file} - "${name}" is not a GLYPH key`);
    continue;
  }
  if (existing.has(name)) {
    logger.info(`skipped ${file} - :${name}: already uploaded`);
    continue;
  }

  const emoji = await client.application.emojis.create({ attachment: join(dir, file), name });
  logger.ok(`uploaded :${name}: ${emoji.toString()}`);
}

logger.ok('done - restart the bot and the glyphs resolve to your art');
client.destroy();
