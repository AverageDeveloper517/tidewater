import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, OK, DANGER, WARN, ACCENT } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { debit } from '../services/economy.js';
import { ITEMS, nextCost, capFor } from '../data/items.js';

const pips = (level, max) => '●'.repeat(level) + '○'.repeat(Math.max(0, max - level));

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('upgrade the kit that makes money')
    .addStringOption((o) =>
      o
        .setName('item')
        .setDescription('buy an upgrade - leave empty to see the shelf')
        .addChoices(...Object.entries(ITEMS).map(([key, item]) => ({ name: item.name, value: key })))
    ),

  ephemeral: true,
  cooldownMs: 1500,

  async run({ interaction, options, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const key = options.getString('item');

    if (!key) {
      const rows = Object.entries(ITEMS).map(([k, item]) => {
        const level = player.items[k] ?? 0;
        const cost = nextCost(k, level);
        return (
          `${item.glyph} **${item.name}** ${pips(level, item.max)}\n` +
          `${item.blurb}\n` +
          `${cost == null ? 'maxed' : `next: ${shells(cost)}`} · ${item.effect(Math.min(item.max, level + 1))}`
        );
      });

      return reply({
        embeds: [
          card({
            title: 'the chandlery',
            description: rows.join('\n\n'),
            color: ACCENT,
            footer: 'buy with /shop item:<name>'
          })
        ]
      });
    }

    const item = ITEMS[key];
    const level = player.items[key] ?? 0;

    if (level >= item.max) {
      return reply({ embeds: [card({ title: 'already maxed', description: `${item.name} is as good as it gets.`, color: WARN })] });
    }

    const cost = nextCost(key, level);
    if (player.wallet < cost) {
      return reply({
        embeds: [
          card({
            title: 'short',
            description: `${item.name} ${level + 1} costs ${shells(cost)}. you have ${shells(player.wallet)}.`,
            color: DANGER
          })
        ]
      });
    }

    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      const now = p.items[key] ?? 0;
      const price = nextCost(key, now);
      if (price == null) return { ok: false };
      if (!debit(p, price)) return { ok: false, short: true };
      p.items[key] = now + 1;
      if (key === 'vault') p.bankCap = capFor(p.items.vault);
      return { ok: true, level: p.items[key], wallet: p.wallet, price };
    });

    if (!result?.ok) {
      return reply({ embeds: [card({ title: 'not now', description: 'the shelf moved - try again.', color: WARN })] });
    }

    return reply({
      embeds: [
        card({
          title: `${item.glyph} ${item.name} ${result.level}`,
          description:
            `paid ${shells(result.price)}.\n` +
            `${pips(result.level, item.max)}\n` +
            `${item.effect(result.level)}` +
            unlockedText(fresh),
          color: OK,
          fields: [
            { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
            { name: 'level', value: `${result.level} / ${item.max}`, inline: true },
            ...(key === 'vault' ? [{ name: 'vault cap', value: shells(capFor(result.level)), inline: true }] : [])
          ]
        })
      ]
    });
  }
};
