import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, bar, pct, GOLD, ACCENT } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { paginate } from '../lib/components.js';
import { chunk } from '../lib/util.js';

const PER_PAGE = 5;

export default {
  data: new SlashCommandBuilder().setName('achievements').setDescription('everything you have and everything you have not'),

  ephemeral: true,
  cooldownMs: 2000,

  async run({ interaction, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const unlocked = new Set(player.achievements ?? []);
    const groups = chunk(ACHIEVEMENTS, PER_PAGE);

    const pages = groups.map((group, index) => ({
      label: `page ${index + 1}`,
      embed: () => {
        const lines = group.map((entry) => {
          const hit = unlocked.has(entry.id);
          const mark = hit ? '●' : '○';
          const reward = entry.reward ? ` · ${shells(entry.reward)}` : '';
          return `${mark} **${entry.name}**${reward}\n${entry.desc}`;
        });

        const done = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

        return card({
          title: 'achievements',
          description: lines.join('\n\n'),
          color: index === 0 ? GOLD : ACCENT,
          fields: [
            { name: 'progress', value: `${bar(done, ACHIEVEMENTS.length, 12)} ${done}/${ACHIEVEMENTS.length}`, inline: false },
            { name: 'collected', value: shells(ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).reduce((s, a) => s + a.reward, 0)), inline: true },
            { name: 'completion', value: `${pct(done, ACHIEVEMENTS.length)}%`, inline: true },
            { name: 'remaining', value: num(ACHIEVEMENTS.length - done), inline: true }
          ],
          footer: '● unlocked · ○ still out there'
        });
      }
    }));

    await paginate(interaction, pages, { build: (i) => pages[i].embed() });
  }
};
