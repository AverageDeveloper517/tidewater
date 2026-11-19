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
      if (action === 'deposit') {
        p.wallet -= amount;
        p.bank += amount;
      } else {
        p.bank -= amount;
        p.wallet += amount;
      }
      return { wallet: p.wallet, bank: p.bank };
    });

    return reply({
      embeds: [
        card({
          title: action === 'deposit' ? 'vault sealed' : 'vault opened',
          description: `${action === 'deposit' ? 'in' : 'out'}: ${shells(amount)}`,
          color: OK,
          fields: [
            { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
            { name: 'bank', value: `${shells(result.bank)} / ${num(player.bankCap)}`, inline: true }
          ]
        })
      ]
    });
  }
};
