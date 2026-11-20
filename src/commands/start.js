import { SlashCommandBuilder } from 'discord.js';
import { card, shells, OK, DANGER, ACCENT } from '../lib/theme.js';
import { GLYPH } from '../lib/emoji.js';

export default {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('open your dock and pick a home port')
    .addStringOption((o) =>
      o
        .setName('port')
        .setDescription('a real city - weather and waves are read from here')
        .setRequired(true)
        .setMaxLength(80)
    ),

  ephemeral: true,
  cooldownMs: 5000,

  async run({ interaction, options, reply, economy, weather, logger }) {
    const existing = economy.get(interaction.user.id);
    if (existing) {
      return reply({
        embeds: [
          card({
            title: 'already docked',
            description: `your port is **${existing.port?.name ?? 'unknown'}**. try \`/profile\`, \`/daily\` or \`/market\`.`,
            color: ACCENT
          })
        ]
      });
    }

    const query = options.getString('port', true).trim();

    let port = null;
    try {
      port = await weather.geocode(query);
    } catch (err) {
      logger.warn('geocode failed:', err.message);
    }

    if (!port) {
      return reply({
        embeds: [
          card({
            title: 'no such port',
            description: `could not find **${query}**. try a bigger place - \`Lisbon\`, \`Osaka\`, \`Cape Town\`.`,
            color: DANGER
          })
        ]
      });
    }

    const { created, player } = await economy.create(interaction.user.id, {
      name: interaction.user.username,
      port
    });

    if (!created) {
      return reply({
        embeds: [
          card({
            title: 'already docked',
            description: `your port is **${player.port?.name ?? 'unknown'}** - the dock opened on another click.`,
            color: ACCENT
          })
        ]
      });
    }

    const wx = await weather.forecast(port);
    const where = [port.name, port.region, port.country].filter(Boolean).join(', ');

    return reply({
      embeds: [
        card({
          title: `${GLYPH.shell} ${port.name} is open`,
          description:
            `welcome to the dock, **${interaction.user.username}**.\n\n` +
            `you start with ${shells(player.wallet)} and a rod with a bad attitude.\n` +
            `everything you make is real - the market moves with actual prices, and your garden reads the real weather.`,
          color: OK,
          fields: [
            { name: 'port', value: where, inline: true },
            { name: 'conditions', value: `${wx.icon} ${wx.label}${wx.temp != null ? ` · ${wx.temp}°C` : ''}`, inline: true },
            { name: 'next', value: '`/log` for three jobs\n`/daily` for the first shells\n`/fish` then `/sell` to fill the hold\n`/dock` names the next move' }
          ]
        })
      ]
    });
  }
};
