import { Events, MessageFlags } from 'discord.js';
import { rejectText } from '../lib/guard.js';
import { errorCard } from '../lib/theme.js';
import { truncate } from '../lib/util.js';

export const name = Events.InteractionCreate;

export async function execute({ client, interaction, logger }) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn(`unknown command /${interaction.commandName}`);
    return;
  }

  const rejected = client.guard.check(interaction, command);
  if (rejected) {
    await interaction
      .reply({ content: rejectText(rejected, command), flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return;
  }

  const ephemeral = command.ephemeral !== false;

  try {
    if (command.defer !== false) {
      await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    }

    const reply = (payload) =>
      interaction.editReply(typeof payload === 'string' ? { content: payload } : payload);

    const follow = (payload) =>
      interaction.followUp({
        ...(typeof payload === 'string' ? { content: payload } : payload),
        flags: MessageFlags.Ephemeral
      });

    const started = Date.now();

    await command.run({
      client,
      interaction,
      options: interaction.options,
      reply,
      follow,
      logger: logger.child(interaction.commandName),
      store: client.store,
      settings: client.settings,
      config: client.config,
      economy: client.economy,
      market: client.market,
      weather: client.weather,
      dex: client.dex,
      trivia: client.trivia
    });

    logger.ok(`/${interaction.commandName} - ${Date.now() - started}ms`);
    client.economy.markGuild(interaction.user.id, interaction.guildId);
  } catch (err) {
    logger.error(`/${interaction.commandName} failed:`, err);
    const payload = {
      embeds: [errorCard(truncate(err?.message ?? err, 1000))],
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
}
