import { SlashCommandBuilder } from 'discord.js';
import { card, shells, signed, OK, DANGER } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';
import { credit, debit } from '../services/economy.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('move shells to another dock')
    .addUserOption((o) => o.setName('user').setDescription('who gets them').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('how many').setRequired(true).setMinValue(1)
    ),

  ephemeral: true,
  cooldownMs: 3000,

  async run({ interaction, options, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const target = options.getUser('user', true);
    const amount = options.getInteger('amount', true);

    if (target.id === interaction.user.id) {
      return reply({ embeds: [card({ title: 'no', description: 'paying yourself is not a trade.', color: DANGER })] });
    }
    if (target.bot) {
      return reply({ embeds: [card({ title: 'no', description: 'bots do not have pockets.', color: DANGER })] });
    }

    const recipient = economy.get(target.id);
    if (!recipient) {
      return reply({
        embeds: [card({ title: 'no dock', description: `${target.username} has not run \`/start\` yet.`, color: DANGER })]
      });
    }
    if (player.wallet < amount) {
      return reply({
        embeds: [card({ title: 'short', description: `you have ${shells(player.wallet)}, not ${shells(amount)}.`, color: DANGER })]
      });
    }

    await economy.update(interaction.user.id, (p) => debit(p, amount));
    const { result, fresh, player: afterTarget } = await economy.update(target.id, (p) => {
      credit(p, amount);
      return p.wallet;
    });
    const sender = economy.get(interaction.user.id);

    return reply({
      embeds: [
        card({
          title: 'transfer cleared',
          description: `${signed(amount)} → **${target.username}**\n\nyour wallet: ${shells(sender?.wallet ?? player.wallet - amount)}\ntheir wallet: ${shells(afterTarget?.wallet ?? result)}`,
          color: OK,
          footer: fresh.length ? `${fresh.map((a) => a.name).join(', ')} unlocked for them` : 'Tidewater'
        })
      ]
    });
  }
};
