import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { card, shells, OK, DANGER, WARN, ACCENT } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, addXp } from '../services/economy.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const BASE = { easy: 40, medium: 75, hard: 130 };

export default {
  data: new SlashCommandBuilder().setName('trivia').setDescription('answer one question, get paid for being right'),

  ephemeral: true,
  cooldownMs: 3000,

  async run({ interaction, reply, economy, trivia, logger }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const q = await trivia.roll();

    const row = new ActionRowBuilder().addComponents(
      q.answers.slice(0, 4).map((answer, index) =>
        new ButtonBuilder()
          .setCustomId(`tq:${index}`)
          .setLabel(`${LETTERS[index]}. ${answer}`.slice(0, 79))
          .setStyle(ButtonStyle.Secondary)
      )
    );

    await reply({
      embeds: [
        card({
          title: `▤ ${q.category}`,
          description: `**${q.question}**\n\n${q.answers
            .slice(0, 4)
            .map((a, i) => `\`${LETTERS[i]}\` ${a}`)
            .join('\n')}`,
          color: ACCENT,
          footer: `${q.difficulty} · 15s to answer`
        })
      ],
      components: [row]
    });

    const message = await interaction.fetchReply();

    let picked;
    try {
      const hit = await message.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('tq:'),
        time: 15_000
      });
      picked = Number(hit.customId.split(':')[1]);
      await hit.deferUpdate();
    } catch (err) {
      logger.warn('trivia timed out');
      await interaction.editReply({
        embeds: [
          card({
            title: 'time',
            description: `nobody answered. it was **${q.correct}**.`,
            color: WARN
          })
        ],
        components: []
      }).catch(() => {});
      return;
    }

    const correct = q.answers[picked] === q.correct;
    const base = BASE[q.difficulty] ?? 60;

    const { result, fresh } = await economy.update(interaction.user.id, (p) => {
      const streak = (p.stats.triviaStreak ?? 0) + 1;

      if (!correct) {
        p.stats.triviaWrong += 1;
        p.stats.triviaStreak = 0;
        return { correct: false, streak: 0, reward: 0 };
      }

      const bonus = Math.min(5, streak) * 10;
      const reward = base + bonus;
      p.stats.triviaRight += 1;
      p.stats.triviaStreak = streak;
      credit(p, reward);
      addXp(p, 10);
      return { correct: true, streak, reward, bonus };
    });

    return reply({
      embeds: [
        card({
          title: result.correct ? 'correct' : 'wrong',
          description: result.correct
            ? `**${q.correct}**. ${shells(result.reward)} including a ${shells(result.bonus)} streak bonus.\nstreak: **${result.streak}**.`
            : `the answer was **${q.correct}**. no payout, streak reset.`,
          color: result.correct ? OK : DANGER,
          footer: q.source === 'local' ? 'offline question bank' : 'opentdb'
        }),
        card({
          title: 'ledger',
          description: `${result.correct ? '+' : ''}${shells(result.reward)}`,
          color: ACCENT
        })
      ],
      components: []
    });
  }
};
