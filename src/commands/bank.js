import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, OK, WARN, DANGER } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('park shells where nothing can touch them')
    .addStringOption((o) =>
      o
        .setName('action')
        .setDescription('deposit or withdraw')
        .setRequired(true)
        .addChoices({ name: 'deposit', value: 'deposit' }, { name: 'withdraw', value: 'withdraw' })
    )
    .addStringOption((o) =>
      o.setName('amount').setDescription('a number, or "all"').setRequired(true).setMaxLength(12)
    ),

  ephemeral: true,
  cooldownMs: 1000,

  async run({ interaction, options, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const action = options.getString('action', true);
    const raw = options.getString('amount', true).trim().toLowerCase();

    const available = action === 'deposit' ? player.wallet : player.bank;
    const room = Math.max(0, player.bankCap - player.bank);

    let amount;
    if (raw === 'all' || raw === 'max') {
      amount = action === 'deposit' ? Math.min(available, room) : available;
    } else {
      amount = Number.parseInt(raw, 10);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return reply({ embeds: [card({ title: 'bad amount', description: 'give me a number or `all`.', color: DANGER })] });
    }
    if (action === 'deposit' && amount > room) {
      return reply({
        embeds: [
          card({
            title: 'vault is full',
            description: `the vault holds ${shells(player.bankCap)}. buy the next tier with \`/shop buy item:Vault\`.`,
            color: WARN
          })
        ]
      });
    }
    if (amount > available) {
      return reply({
        embeds: [card({ title: 'short', description: `only ${shells(available)} available.`, color: DANGER })]
      });
    }

    const { result, player: after } = await economy.update(interaction.user.id, (p) => {
      // Recompute against the committed wallet: a fill can land between the
      // snapshot above and this update, and a negative balance is not a vault.
      const liveAvailable = action === 'deposit' ? p.wallet : p.bank;
      const liveRoom = Math.max(0, p.bankCap - p.bank);
      const liveAmount =
        raw === 'all' || raw === 'max'
          ? action === 'deposit'
            ? Math.min(liveAvailable, liveRoom)
            : liveAvailable
          : amount;

      if (!Number.isFinite(liveAmount) || liveAmount <= 0) return { ok: false };
      if (action === 'deposit' && liveAmount > liveRoom) return { ok: false };
      if (liveAmount > liveAvailable) return { ok: false };

      if (action === 'deposit') {
        p.wallet -= liveAmount;
        p.bank += liveAmount;
      } else {
        p.bank -= liveAmount;
        p.wallet += liveAmount;
      }
      return { ok: true, wallet: p.wallet, bank: p.bank, amount: liveAmount, cap: p.bankCap };
    });

    if (!result?.ok) {
      return reply({
        embeds: [card({ title: 'the vault moved', description: 'try `/bank` again with the current balance.', color: WARN })]
      });
    }

    return reply({
      embeds: [
        card({
          title: action === 'deposit' ? 'vault sealed' : 'vault opened',
          description: `${action === 'deposit' ? 'in' : 'out'}: ${shells(result.amount)}`,
          color: OK,
          fields: [
            { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
            { name: 'bank', value: `${shells(result.bank)} / ${num(result.cap)}`, inline: true }
          ]
        })
      ]
    });
  }
};
