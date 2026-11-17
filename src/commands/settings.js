import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { card, OK, WARN, ACCENT } from '../lib/theme.js';

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('where the market ticker posts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) => o.setName('market_channel').setDescription('channel for the periodic market post'))
    .addBooleanOption((o) => o.setName('ticker').setDescription('turn the periodic market post on or off')),

  ephemeral: true,
  memberPermissions: [PermissionFlagsBits.ManageGuild],

  async run({ interaction, options, reply, settings }) {
    const channel = options.getChannel('market_channel');
    const ticker = options.getBoolean('ticker');
    const guildId = interaction.guildId;

    if (channel == null && ticker == null) {
      const current = settings.get(guildId);
      return reply({
        embeds: [
          card({
            title: 'settings',
            description:
              `market channel: ${current.marketChannel ? `<#${current.marketChannel}>` : 'not set'}\n` +
              `ticker: **${current.ticker ? 'on' : 'off'}**\n\n` +
              '`/settings market_channel:#market ticker:true`',
            color: ACCENT
          })
        ]
      });
    }

    const patch = {};
    if (channel != null) patch.marketChannel = channel.id;
    if (ticker != null) patch.ticker = ticker;
    settings.set(guildId, patch);

    const next = settings.get(guildId);

    return reply({
      embeds: [
        card({
          title: 'saved',
          description:
            `market channel: ${next.marketChannel ? `<#${next.marketChannel}>` : 'not set'}\n` +
            `ticker: **${next.ticker ? 'on' : 'off'}**`,
          color: next.ticker && next.marketChannel ? OK : WARN
        })
      ]
    });
  }
};
