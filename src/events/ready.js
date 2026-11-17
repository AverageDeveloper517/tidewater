import { ActivityType, Events } from 'discord.js';
import { duration } from '../lib/theme.js';
import { boardEmbed } from '../lib/boards.js';

export const name = Events.ClientReady;
export const once = true;

const ROTATION = [
  { name: 'the tide come in', type: ActivityType.Watching },
  { name: '/market — live prices', type: ActivityType.Playing },
  { name: 'the harbour', type: ActivityType.Watching },
  { name: '/help', type: ActivityType.Playing }
];

const TICKER_EVERY = 6 * 3_600_000;

async function postTicker(client, logger) {
  const board = await client.market.board({ force: true });
  if (board.degraded) return;

  const embed = boardEmbed(board, { compact: true });

  for (const guild of client.guilds.cache.values()) {
    const config = client.settings.get(guild.id);
    if (!config.ticker || !config.marketChannel) continue;

    try {
      const channel = await client.channels.fetch(config.marketChannel);
      if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`ticker failed in ${guild.id}:`, err.message);
    }
  }
}

export async function execute({ client, logger }) {
  logger.ok(`docked as ${client.user.tag} - ${client.guilds.cache.size} guild(s)`);
  logger.info(`${client.commands.size} slash command(s) loaded - /help for the board`);

  let index = 0;
  const cycle = () => {
    const entry = ROTATION[index % ROTATION.length];
    client.user.setActivity(entry.name, { type: entry.type });
    index += 1;
  };

  cycle();
  setInterval(cycle, 45_000).unref();

  setInterval(() => {
    void postTicker(client, logger).catch((err) => logger.warn('ticker:', err.message));
  }, TICKER_EVERY).unref();

  setInterval(
    () =>
      logger.info(
        `heartbeat - up ${duration(Date.now() - client.startedAt)}, ${client.guilds.cache.size} guild(s), ${client.economy.count()} dock(s), ws ${client.ws.ping}ms`
      ),
    600_000
  ).unref();

  client.user.setStatus('online');
}
