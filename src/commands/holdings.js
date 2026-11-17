import { SlashCommandBuilder } from 'discord.js';
import { card, money, num, shells, OK, DANGER, ACCENT } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';

export default {
  data: new SlashCommandBuilder().setName('holdings').setDescription('portfolio, cost basis and unrealised profit'),

  ephemeral: true,
  cooldownMs: 1500,

  async run({ interaction, reply, economy, market }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const { prices } = await market.board();
    const keys = Object.keys(player.holdings);

    if (!keys.length) {
      return reply({
        embeds: [
          card({
            title: 'empty hold',
            description: 'no positions. `/market` shows the board, `/trade` opens one.',
            color: ACCENT
          })
        ]
      });
    }

    let value = 0;
    let cost = 0;
    const rows = keys.map((key) => {
      const entry = player.holdings[key];
      const last = prices[key] ?? 0;
      const worth = entry.qty * last;
      const avg = entry.qty ? entry.cost / entry.qty : 0;
      const pnl = worth - entry.cost;
      value += worth;
      cost += entry.cost;
      return (
        `**${key}** · ${num(entry.qty)} @ avg ${money(avg)}\n` +
        `last ${money(last)} · worth ${shells(worth)} · ${pnl >= 0 ? '+' : '-'}${shells(Math.abs(pnl))}`
      );
    });

    const totalPnl = value - cost;

    return reply({
      embeds: [
        card({
          title: 'the hold',
          description: rows.join('\n\n'),
          color: totalPnl >= 0 ? OK : DANGER,
          fields: [
            { name: 'cost', value: shells(cost), inline: true },
            { name: 'value', value: shells(value), inline: true },
            {
              name: 'unrealised',
              value: `${totalPnl >= 0 ? '+' : '-'}${shells(Math.abs(totalPnl))}`,
              inline: true
            }
          ]
        })
      ]
    });
  }
};
