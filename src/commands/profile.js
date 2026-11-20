import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, bar, GOLD, ACCENT } from '../lib/theme.js';
import { requireProfile, levelInfo } from '../lib/flow.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { GLYPH } from '../lib/emoji.js';
import { nextRank, rankFor } from '../lib/rank.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('the public card: level, port, streak, collection')
    .addUserOption((o) => o.setName('user').setDescription('someone else on the dock')),

  ephemeral: false,
  cooldownMs: 2000,

  async run({ interaction, options, reply, economy, market }) {
    const target = options.getUser('user') ?? interaction.user;
    const player = economy.get(target.id);

    if (await requireProfile(reply, player)) return;

    const { prices } = await market.board();
    const { level, into, span } = levelInfo(player);
    const worth = player.wallet + player.bank;
    const unique = Object.keys(player.catches).length;
    const unlocked = new Set(player.achievements ?? []);
    const rank = rankFor(level);
    const next = nextRank(level);

    return reply({
      embeds: [
        card({
          title: `${target.username}`,
          thumbnail: target.displayAvatarURL({ size: 128 }),
          description:
            `**${player.port?.name ?? 'no port'}** · **${rank.name}** · level **${level}** · ${player.streak} day streak\n` +
            `${bar(into, span, 14)} ${into}/${span} xp`,
          color: GOLD,
          fields: [
            { name: 'wallet', value: shells(player.wallet), inline: true },
            { name: 'bank', value: `${shells(player.bank)} / ${num(player.bankCap)}`, inline: true },
            { name: 'on hand', value: shells(worth), inline: true },
            { name: 'portfolio', value: `${Object.keys(player.holdings).length} position(s)`, inline: true },
            { name: 'collection', value: `${unique} / 1025 unique`, inline: true },
            { name: 'achievements', value: `${unlocked.size} / ${ACHIEVEMENTS.length}`, inline: true },
            {
              name: 'rank',
              value: `${rank.name}\n${next ? `${next.name} at level ${next.level}` : 'top of the ladder'}`,
              inline: true
            },
            {
              name: 'harbour log',
              value: `${num(player.stats.logs ?? 0)} jobs\n${num(player.stats.logDays ?? 0)} full pages`,
              inline: true
            },
            {
              name: 'shifts',
              value: `${num(player.stats.work)} worked\n${num(player.stats.fish)} casts\n${num(player.stats.harvest)} harvests`,
              inline: true
            },
            {
              name: 'games',
              value: `${num(player.stats.triviaRight)} right answers\n${num(player.stats.spins)} spins\n${num(player.stats.trades)} trades\n${num(player.stats.contracts ?? 0)} contracts`,
              inline: true
            },
            {
              name: 'last unlock',
              value: [...unlocked].length ? `\`${[...unlocked].pop()}\`` : 'none yet',
              inline: true
            }
          ],
          footer: `${GLYPH.shell} ${num(prices.tide)} tide · ${num(prices.reef)} reef · ${num(prices.glow)} glow`
        })
      ]
    });
  }
};
