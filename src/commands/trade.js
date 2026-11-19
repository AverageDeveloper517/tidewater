import { SlashCommandBuilder } from 'discord.js';
import { card, money, num, shells, OK, DANGER, WARN } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, debit } from '../services/economy.js';
import { INSTRUMENTS } from '../data/instruments.js';
import { fee, maxAffordable } from '../services/market.js';

const choices = INSTRUMENTS.map((i) => ({ name: `${i.name} (${i.key})`, value: i.key }));

export default {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('buy or sell an instrument at the live price')
    .addStringOption((o) =>
      o
        .setName('action')
        .setDescription('buy or sell')
        .setRequired(true)
        .addChoices({ name: 'buy', value: 'buy' }, { name: 'sell', value: 'sell' })
    )
    .addStringOption((o) =>
      o.setName('instrument').setDescription('what to trade').setRequired(true).addChoices(...choices)
    )
    .addStringOption((o) =>
      o.setName('quantity').setDescription('a number, or "all"').setRequired(true).setMaxLength(12)
    ),

  ephemeral: true,
  cooldownMs: 1500,

  async run({ interaction, options, reply, economy, market }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const action = options.getString('action', true);
    const key = options.getString('instrument', true);
    const raw = options.getString('quantity', true).trim().toLowerCase();

    const board = await market.board();
    const price = board.prices[key];
    const inst = market.instrument(key);

    if (!price || !inst) {
      return reply({
        embeds: [card({ title: 'no quote', description: 'that instrument is not on the board.', color: DANGER })]
      });
    }

    const owned = player.holdings[key]?.qty ?? 0;
    let qty;

    if (raw === 'all' || raw === 'max') {
      qty = action === 'buy' ? maxAffordable(price, player.wallet) : owned;
    } else {
      qty = Number.parseInt(raw, 10);
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return reply({
        embeds: [card({ title: 'bad quantity', description: 'give me a number or `all`.', color: DANGER })]
      });
    }

    const gross = Math.round(price * qty);
    const cut = fee(gross);

    if (action === 'buy') {
      const total = gross + cut;
      if (player.wallet < total) {
        return reply({
          embeds: [
            card({
              title: 'short',
              description: `that fill costs ${shells(total)} (\`${num(qty)} × ${money(price)} + fee\`).\nyou have ${shells(player.wallet)}.`,
              color: DANGER
            })
          ]
        });
      }

      const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
        if (!debit(p, total)) return { ok: false };
        const entry = p.holdings[key] ?? { qty: 0, cost: 0 };
        entry.qty += qty;
        entry.cost += total;
        p.holdings[key] = entry;
        p.stats.trades += 1;
        return { ok: true, wallet: p.wallet };
      });

      if (!result?.ok) {
        return reply({ embeds: [card({ title: 'short', description: 'the fill moved before it landed.', color: WARN })] });
      }

      return reply({
        embeds: [
          card({
            title: `bought ${num(qty)} ${inst.name}`,
            description: `at ${money(price)} · paid ${shells(total)} including ${shells(cut)} fee.` + unlockedText(fresh),
            color: OK,
            fields: [
              { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
              { name: 'position', value: num(after?.holdings[key]?.qty ?? qty), inline: true },
              { name: 'board', value: board.degraded ? 'last good quote' : 'live', inline: true }
            ]
          })
        ]
      });
    }

    if (qty > owned) {
      return reply({
        embeds: [card({ title: 'not yours', description: `you hold ${num(owned)} ${inst.name}.`, color: DANGER })]
      });
    }

    const proceeds = Math.max(0, gross - cut);

    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      const entry = p.holdings[key] ?? { qty: 0, cost: 0 };
      if (entry.qty < qty) return { ok: false };

      const costOut = entry.qty > 0 ? Math.round(entry.cost * (qty / entry.qty)) : 0;
      entry.qty -= qty;
      entry.cost = Math.max(0, entry.cost - costOut);

      if (entry.qty === 0) delete p.holdings[key];
      else p.holdings[key] = entry;

      credit(p, proceeds);
      p.stats.trades += 1;
      return { ok: true, wallet: p.wallet, costOut };
    });

    if (!result?.ok) {
      return reply({
        embeds: [card({ title: 'not yours', description: 'the position moved before it landed.', color: WARN })]
      });
    }

    const pnl = proceeds - result.costOut;

    return reply({
      embeds: [
        card({
          title: `sold ${num(qty)} ${inst.name}`,
          description: `at ${money(price)} · collected ${shells(proceeds)} after ${shells(cut)} fee.` + unlockedText(fresh),
          color: pnl >= 0 ? OK : DANGER,
          fields: [
            { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
            { name: 'realised', value: `${pnl >= 0 ? '+' : '-'}${shells(Math.abs(pnl))}`, inline: true },
            { name: 'remaining', value: num(after?.holdings[key]?.qty ?? 0), inline: true }
          ]
        })
      ]
    });
  }
};
