import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, GOLD, ACCENT } from '../lib/theme.js';
import { netWorth } from '../services/economy.js';

const METRICS = [
  { name: 'net worth', value: 'worth' },
  { name: 'level', value: 'level' },
  { name: 'daily streak', value: 'streak' },
  { name: 'collection', value: 'catches' }
];

const MEDAL = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

const valueFor = (player, metric, prices) => {
  switch (metric) {
    case 'level':
      return 1 + Math.floor(Math.sqrt(Math.max(0, player.xp) / 40));
    case 'streak':
      return player.streak;
    case 'catches':
      return Object.keys(player.catches).length;
    default:
      return netWorth(player, prices);
  }
};

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('who is winning the harbour')
    .addStringOption((o) => o.setName('metric').setDescription('what to rank by').addChoices(...METRICS)),

  ephemeral: false,
  cooldownMs: 3000,

  async run({ interaction, options, reply, economy, market }) {
    const metric = options.getString('metric') ?? 'worth';
    const { prices } = await market.board();

    const players = economy.list().filter((player) => {
      // players from before guild tracking show everywhere; everyone else is scoped
      if (!player.guilds || !Object.keys(player.guilds).length) return true;
      return Boolean(player.guilds[interaction.guildId]);
    });

    if (!players.length) {
      return reply({
        embeds: [card({ title: 'nobody here', description: 'no docks in this server yet. `/start` opens the first one.', color: ACCENT })]
      });
    }

    const ranked = players
      .map((p) => ({ player: p, value: valueFor(p, metric, prices) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const label = METRICS.find((m) => m.value === metric)?.name ?? metric;

    const lines = ranked.map((row, index) => {
      const name = row.player.name ?? row.player.id;
      const value =
        metric === 'worth' ? shells(row.value) : metric === 'catches' ? `${num(row.value)} species` : num(row.value);
      return `${MEDAL[index] ?? `${index + 1}.`} **${name}** · ${value}`;
    });

    return reply({
      embeds: [
        card({
          title: `the board · ${label}`,
          description: lines.join('\n'),
          color: GOLD,
          fields: [{ name: 'docks open', value: num(players.length), inline: true }],
          footer: 'net worth uses live prices'
        })
      ]
    });
  }
};
