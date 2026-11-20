import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, bar, duration, OK, ACCENT, GOLD, WARN } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { addXp, credit, levelFor } from '../services/economy.js';
import {
  logTasksFor,
  logProgress,
  statSnapshot,
  taskReward,
  bonusReward,
  nextUtcMidnight,
  TASK_XP,
  BONUS_XP
} from '../data/log.js';
import { dayKey } from '../lib/util.js';

const today = () => dayKey(new Date());

export default {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('three jobs for today - finish them before midnight UTC')
    .addSubcommand((s) => s.setName('view').setDescription('the page and your progress'))
    .addSubcommand((s) => s.setName('claim').setDescription('pay out everything you have finished')),

  ephemeral: true,
  cooldownMs: 1500,

  async run({ interaction, options, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const sub = options.getSubcommand();
    const day = today();
    const tasks = logTasksFor(interaction.user.id, day);
    const level = levelFor(player.xp);
    const current = player.log?.day === day ? player.log : null;
    const base = current?.base ?? player.stats;
    const claimed = new Set(current?.claimed ?? []);

    if (sub === 'view') {
      const rows = tasks.map((task) => {
        const progress = Math.min(task.target, logProgress(task, player.stats, base));
        const done = progress >= task.target;
        const paid = claimed.has(task.id);
        const mark = paid ? '●' : done ? '◉' : '○';
        return {
          name: `${mark} ${task.name}${paid ? ' · paid' : ''}`,
          value:
            `${bar(progress, task.target, 8)} ${progress}/${task.target} · ` +
            `${shells(taskReward(level))} + ${TASK_XP} xp\n\`${task.hint}\``,
          inline: false
        };
      });

      const paidCount = tasks.filter((task) => claimed.has(task.id)).length;
      const ready = tasks.filter(
        (task) => !claimed.has(task.id) && logProgress(task, player.stats, base) >= task.target
      ).length;

      const status = !current
        ? 'a fresh page. three jobs before midnight UTC.'
        : `${paidCount}/3 paid${ready ? ` · **${ready} ready**` : ''}` +
          `${current.bonus ? ' · the full page is paid' : ''}`;

      return reply({
        embeds: [
          card({
            title: 'the day\'s log',
            description: `${status}\nfinish all three for ${shells(bonusReward(level))} and +${BONUS_XP} xp.`,
            color: ready ? OK : ACCENT,
            fields: rows,
            footer: `resets in ${duration(nextUtcMidnight() - Date.now())} · /log claim`
          })
        ]
      });
    }

    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      const dayNow = today();

      if (!p.log || p.log.day !== dayNow) {
        p.log = { day: dayNow, base: statSnapshot(p.stats), claimed: [], bonus: false };
        return { ok: false, reset: true };
      }

      if (!Array.isArray(p.log.claimed)) p.log.claimed = [];
      const dayTasks = logTasksFor(p.id, dayNow);
      const levelNow = levelFor(p.xp);

      const done = dayTasks.filter(
        (task) => !p.log.claimed.includes(task.id) && logProgress(task, p.stats, p.log.base) >= task.target
      );

      if (!done.length) {
        return {
          ok: false,
          none: true,
          remaining: dayTasks.filter((task) => !p.log.claimed.includes(task.id)).map((task) => task.hint)
        };
      }

      let total = 0;
      for (const task of done) {
        const reward = taskReward(levelNow);
        credit(p, reward);
        addXp(p, TASK_XP);
        p.log.claimed.push(task.id);
        p.stats.logs = (p.stats.logs ?? 0) + 1;
        total += reward;
      }

      let bonus = 0;
      if (dayTasks.every((task) => p.log.claimed.includes(task.id)) && !p.log.bonus) {
        bonus = bonusReward(levelNow);
        p.log.bonus = true;
        p.stats.logDays = (p.stats.logDays ?? 0) + 1;
        credit(p, bonus);
        addXp(p, BONUS_XP);
        total += bonus;
      }

      return {
        ok: true,
        claimed: done.map((task) => task.name),
        bonus,
        total,
        wallet: p.wallet,
        level: levelNow
      };
    });

    if (!result?.ok) {
      if (result?.reset) {
        return reply({
          embeds: [
            card({
              title: 'the page turned',
              description: 'midnight UTC landed while you were reading. `/log` again for the new page.',
              color: WARN
            })
          ]
        });
      }

      return reply({
        embeds: [
          card({
            title: 'nothing finished yet',
            description:
              (result?.remaining?.length
                ? `still open: ${result.remaining.join(', ')}`
                : 'the page is already paid.') + '\n\n`/log` shows the progress bars.',
            color: WARN
          })
        ]
      });
    }

    return reply({
      embeds: [
        card({
          title: 'log paid',
          description:
            result.claimed.map((name) => `✓ ${name}`).join('\n') +
            (result.bonus ? `\n\n**full page** · +${shells(result.bonus)} and +${BONUS_XP} xp` : '') +
            `\n\n**${shells(result.total)}** and +${result.claimed.length * TASK_XP + (result.bonus ? BONUS_XP : 0)} xp.` +
            unlockedText(fresh),
          color: OK,
          fields: [
            { name: 'wallet', value: shells(after?.wallet ?? result.wallet), inline: true },
            { name: 'paid today', value: `${num(result.claimed.length)}/3${result.bonus ? ' + full page' : ''}`, inline: true },
            { name: 'level', value: String(result.level), inline: true }
          ],
          footer: result.bonus ? 'the whole page, clean' : 'come back before midnight UTC'
        })
      ]
    });
  }
};
