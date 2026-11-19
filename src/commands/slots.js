import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, OK, DANGER, GOLD, ACCENT } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, debit, addXp } from '../services/economy.js';
import { SLOT_SYMBOLS, PAYOUTS } from '../data/tables.js';
import { GLYPH } from '../lib/emoji.js';

export default {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('three reels, real odds')
    .addIntegerOption((o) =>
      o.setName('wager').setDescription('shells per spin').setRequired(true).setMinValue(10).setMaxValue(5000)
    ),

  ephemeral: true,
  cooldownMs: 2000,

  async run({ interaction, options, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const wager = options.getInteger('wager', true);

    if (player.wallet < wager) {
      return reply({
        embeds: [card({ title: 'short', description: `you have ${shells(player.wallet)}.`, color: DANGER })]
      });
    }

    const reels = [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);

    let factor = 0;
    let label = 'nothing';
    if (reels[0].key === reels[1].key && reels[1].key === reels[2].key) {
      if (reels[0].key === 'shell') {
        factor = PAYOUTS.jackpot;
        label = 'jackpot';
      } else {
        factor = PAYOUTS.triple;
        label = 'three of a kind';
      }
    } else if (reels[0].key === reels[1].key || reels[1].key === reels[2].key || reels[0].key === reels[2].key) {
      factor = PAYOUTS.pair;
      label = 'a pair';
    }

    const payout = Math.round(wager * factor);
    const net = payout - wager;

    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      if (!debit(p, wager)) return { ok: false };
      p.stats.spins += 1;
      p.stats.gambled += wager;
      if (payout) {
        credit(p, payout);
        p.stats.won += payout;
      }
      if (factor === PAYOUTS.jackpot) p.stats.jackpots += 1;
      return { ok: true, wallet: p.wallet };
    });

    if (!result?.ok) {
      return reply({ embeds: [card({ title: 'short', description: 'the wallet moved - try again.', color: DANGER })] });
    }

    const board = reels.map((r) => r.glyph).join('  ');

    return reply({
      embeds: [
        card({
          title: label,
          description: `\`${board}\`\n\n${factor ? `${wager} → **${shells(payout)}**` : `lost ${shells(wager)}`}` +
            unlockedText(fresh),
          color: factor ? OK : DANGER,
          fields: [
            { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
            { name: 'paid', value: `${factor || 0}×`, inline: true },
            { name: 'net', value: `${net >= 0 ? '+' : '-'}${shells(Math.abs(net))}`, inline: true }
          ],
          footer: `${GLYPH.shell} jackpot 20× · triple 8× · pair 1.6×`
        })
      ]
    });
  }
};
