import { SlashCommandBuilder } from 'discord.js';
import { card, shells, signed, duration, OK, WARN } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, addXp } from '../services/economy.js';

const WAIT = 20 * 3_600_000;
const RESET_AFTER = 48 * 3_600_000;

export default {
  data: new SlashCommandBuilder().setName('daily').setDescription('collect the day one - streak pays more'),

  ephemeral: true,

  async run({ interaction, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const now = Date.now();
    const since = now - player.lastDaily;

    if (player.lastDaily && since < WAIT) {
      return reply({
        embeds: [
          card({
            title: 'already collected',
            description: `come back in **${duration(WAIT - since)}**.`,
            color: WARN
          })
        ]
      });
    }

    const streak = player.lastDaily && since < RESET_AFTER ? player.streak + 1 : 1;
    const base = 120 + Math.min(streak, 30) * 15;
    const bonus = Math.floor(Math.random() * 40);

    const { result, fresh } = await economy.update(interaction.user.id, (p) => {
      p.streak = streak;
      p.lastDaily = now;
      credit(p, base + bonus);
      addXp(p, 20);
      return { base, bonus, total: base + bonus, streak };
    });

    const body =
      `${signed(result.total)} landed.\n` +
      `base **${result.base}** + today's drift **${result.bonus}**\n` +
      `streak **${result.streak} day${result.streak === 1 ? '' : 's'}** - resets if you miss two.` +
      unlockedText(fresh);

    return reply({
      embeds: [
        card({
          title: 'the day is yours',
          description: body,
          color: OK,
          fields: [{ name: 'wallet', value: shells(player.wallet + result.total) }]
        })
      ]
    });
  }
};
