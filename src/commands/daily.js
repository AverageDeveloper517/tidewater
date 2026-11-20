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

    // The streak and the cooldown are read inside the per-user queue, so two
    // interactions landing together cannot both collect the day.
    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      const since = now - p.lastDaily;
      if (p.lastDaily && since < WAIT) return { ok: false, wait: WAIT - since };

      const streak = p.lastDaily && since < RESET_AFTER ? p.streak + 1 : 1;
      const base = 120 + Math.min(streak, 30) * 15;
      const bonus = Math.floor(Math.random() * 40);

      p.streak = streak;
      p.lastDaily = now;
      p.stats.dailies = (p.stats.dailies ?? 0) + 1;
      credit(p, base + bonus);
      addXp(p, 20);
      return { ok: true, base, bonus, total: base + bonus, streak, wallet: p.wallet };
    });

    if (!result?.ok) {
      return reply({
        embeds: [
          card({
            title: 'already collected',
            description: `come back in **${duration(result.wait)}**.`,
            color: WARN
          })
        ]
      });
    }

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
          fields: [{ name: 'wallet', value: shells(after?.wallet ?? result.wallet) }]
        })
      ]
    });
  }
};
