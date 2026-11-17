import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, money, ACCENT } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';

export default {
  data: new SlashCommandBuilder().setName('balance').setDescription('wallet, bank and what the portfolio is worth'),

  ephemeral: true,
  cooldownMs: 1500,

  async run({ interaction, reply, economy, market }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const { prices } = await market.board();

    let portfolio = 0;
    const rows = [];
    for (const [key, entry] of Object.entries(player.holdings)) {
      const price = prices[key] ?? 0;
      const value = entry.qty * price;
      portfolio += value;
      rows.push(`${key} · ${num(entry.qty)} × ${money(price)} = ${shells(value)}`);
    }

    return reply({
      embeds: [
        card({
          title: 'balance',
          description: `**${money(player.wallet)}** liquid · **${money(player.bank)}** banked`,
          color: ACCENT,
          fields: [
            { name: 'wallet', value: shells(player.wallet), inline: true },
            { name: 'bank', value: `${shells(player.bank)}`, inline: true },
            { name: 'portfolio', value: shells(portfolio), inline: true },
            { name: 'holdings', value: rows.length ? rows.join('\n') : 'empty' },
            { name: 'net worth', value: shells(player.wallet + player.bank + portfolio) }
          ]
        })
      ]
    });
  }
};
