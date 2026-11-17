import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { card, ACCENT } from './theme.js';

export async function paginate(interaction, pages, { build, idle = 120_000 } = {}) {
  let index = 0;
  const scope = `pg:${interaction.id}`;

  const render = (i) => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${scope}:prev`).setLabel('‹').setStyle(ButtonStyle.Secondary).setDisabled(i === 0),
      new ButtonBuilder().setCustomId(`${scope}:next`).setLabel('›').setStyle(ButtonStyle.Secondary).setDisabled(i === pages.length - 1),
      new ButtonBuilder().setCustomId(`${scope}:close`).setLabel('✕').setStyle(ButtonStyle.Danger)
    );
    const select = new StringSelectMenuBuilder()
      .setCustomId(`${scope}:pick`)
      .setPlaceholder('jump to a page')
      .addOptions(pages.map((p, n) => ({ label: p.label.slice(0, 100), value: String(n), default: n === i })));

    return { embeds: [build(i)], components: [row, new ActionRowBuilder().addComponents(select)] };
  };

  await interaction.editReply(render(index));
  const message = await interaction.fetchReply();

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(scope),
    idle
  });

  collector.on('collect', async (i) => {
    if (i.customId.endsWith(':close')) {
      await i.update({ embeds: [card({ title: 'board closed', description: 'the tide took it.', color: ACCENT })], components: [] });
      collector.stop('closed');
      return;
    }
    if (i.isStringSelectMenu()) index = Number(i.values[0]);
    else if (i.customId.endsWith(':next')) index = Math.min(pages.length - 1, index + 1);
    else if (i.customId.endsWith(':prev')) index = Math.max(0, index - 1);
    await i.update(render(index));
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}
