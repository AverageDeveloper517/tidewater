import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { boardEmbed } from '../lib/boards.js';

export default {
  data: new SlashCommandBuilder().setName('market').setDescription('live board - real prices, no API keys'),

  ephemeral: false,
  cooldownMs: 3000,

  async run({ interaction, reply, market }) {
    const board = await market.board();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mkt:refresh').setLabel('refresh').setStyle(ButtonStyle.Secondary)
    );

    await reply({ embeds: [boardEmbed(board)], components: [row] });

    const message = await interaction.fetchReply();
    try {
      const hit = await message.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'mkt:refresh',
        time: 45_000
      });
      const fresh = await market.board({ force: true });
      await hit.update({ embeds: [boardEmbed(fresh)], components: [row] });
    } catch {
      await interaction.editReply({ components: [] }).catch(() => {});
    }
  }
};
