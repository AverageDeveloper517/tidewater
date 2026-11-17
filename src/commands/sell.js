import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, OK, DANGER, WARN } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit } from '../services/economy.js';
import { GOODS, SELLABLE } from '../data/goods.js';

const choices = SELLABLE.map((key) => ({ name: GOODS[key].name, value: key }));

export default {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('sell goods from the hold at today\'s price')
    .addStringOption((o) => o.setName('good').setDescription('what to sell').setRequired(true).addChoices(...choices))
    .addStringOption((o) => o.setName('quantity').setDescription('a number or "all"').setRequired(true).setMaxLength(12)),

  ephemeral: true,
  cooldownMs: 1000,

  async run({ interaction, options, reply, economy, market }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const key = options.getString('good', true);
    const raw = options.getString('quantity', true).trim().toLowerCase();
    const heldQty = player.goods[key] ?? 0;

    if (!heldQty) {
      return reply({
        embeds: [card({ title: 'nothing there', description: `no ${GOODS[key].name} in the hold.`, color: WARN })]
      });
    }

    const qty = raw === 'all' || raw === 'max' ? heldQty : Number.parseInt(raw, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      return reply({ embeds: [card({ title: 'bad quantity', description: 'a number or `all`.', color: DANGER })] });
    }
    if (qty > heldQty) {
      return reply({
        embeds: [card({ title: 'not enough', description: `you hold ${num(heldQty)}.`, color: DANGER })]
      });
    }

    const unit = await market.goods(key);
    const total = Math.round(unit * qty);

    const { result, fresh } = await economy.update(interaction.user.id, (p) => {
      const have = p.goods[key] ?? 0;
      if (have < qty) return { ok: false };
      p.goods[key] = have - qty;
      if (p.goods[key] === 0) delete p.goods[key];
      credit(p, total);
      return { ok: true, left: p.goods[key] ?? 0, wallet: p.wallet };
    });

    if (!result?.ok) {
      return reply({ embeds: [card({ title: 'not enough', description: 'the hold moved - try again.', color: WARN })] });
    }

    return reply({
      embeds: [
        card({
          title: `sold ${num(qty)} ${GOODS[key].name}`,
          description: `${num(qty)} × ${shells(unit)} = **${shells(total)}**` + unlockedText(fresh),
          color: OK,
          fields: [
            { name: 'wallet', value: shells(result.wallet), inline: true },
            { name: 'left in hold', value: num(result.left), inline: true }
          ],
          footer: 'local goods drift with the real euro quote, once a day'
        })
      ]
    });
  }
};
