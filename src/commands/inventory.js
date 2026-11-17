import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, ACCENT, GOLD } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';
import { ITEMS } from '../data/items.js';
import { GOODS } from '../data/goods.js';

const pips = (level, max) => '●'.repeat(level) + '○'.repeat(Math.max(0, max - level));

export default {
  data: new SlashCommandBuilder().setName('inventory').setDescription('kit, hold and collection in one place'),

  ephemeral: true,
  cooldownMs: 1500,

  async run({ interaction, reply, economy, market }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const kit = Object.entries(ITEMS)
      .map(([key, item]) => `${item.glyph} ${item.name} ${pips(player.items[key] ?? 0, item.max)}`)
      .join('\n');

    const board = await market.board();

    const goods = Object.entries(player.goods)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const unit = Math.round((GOODS[key]?.base ?? 0) * board.fxFactor);
        return `${GOODS[key]?.name ?? key} ×${num(qty)} · ~${shells(unit * qty)}`;
      })
      .join('\n');

    const caught = Object.entries(player.catches);
    const rare = caught.filter(([, entry]) => entry.rarity === 'rare' || entry.rarity === 'legendary');

    return reply({
      embeds: [
        card({
          title: 'the hold',
          description: '**kit**\n' + kit,
          color: ACCENT,
          fields: [
            { name: 'goods', value: goods || 'empty - try `/fish` or `/garden`' },
            {
              name: 'collection',
              value: `${num(caught.length)} / 1025 unique${rare.length ? `\nrarest: ${rare.slice(0, 4).map(([, e]) => e.name).join(', ')}` : ''}`
            },
            { name: 'bank', value: `${shells(player.bank)} / ${num(player.bankCap)}`, inline: true },
            { name: 'wallet', value: shells(player.wallet), inline: true }
          ],
          footer: 'Tidewater'
        })
      ]
    });
  }
};
