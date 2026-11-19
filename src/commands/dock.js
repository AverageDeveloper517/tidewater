import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, duration, ACCENT, GOLD, OK, WARN } from '../lib/theme.js';
import { requireProfile, levelInfo } from '../lib/flow.js';
import { seasonFor } from '../lib/season.js';
import { moonPhase } from '../lib/moon.js';
import { CROPS } from '../data/tables.js';
import { timeTag } from '../lib/util.js';

export default {
  data: new SlashCommandBuilder().setName('dock').setDescription('one card: port, sky, garden, worth'),

  ephemeral: true,
  cooldownMs: 2000,

  async run({ interaction, reply, economy, market, weather, tide }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const [board, wx, t] = await Promise.all([
      market.board(),
      weather.forecast(player.port),
      tide.at(player.port)
    ]);
    const season = seasonFor();
    const moon = moonPhase();
    const { level, into, span } = levelInfo(player);

    let portfolio = 0;
    for (const [key, entry] of Object.entries(player.holdings)) {
      portfolio += entry.qty * (board.prices[key] ?? 0);
    }

    const now = Date.now();
    let gardenLine;
    let gardenColor = ACCENT;

    if (!player.garden) {
      gardenLine = 'empty - `/garden plant crop:Kelp`';
      gardenColor = WARN;
    } else {
      const crop = CROPS[player.garden.crop];
      const left = crop.growMs - (now - player.garden.at);
      gardenLine =
        left > 0
          ? `${crop.glyph} ${crop.name} · ready in ${duration(left)}`
          : `${crop.glyph} ${crop.name} · ready now - \`/garden harvest\``;
      gardenColor = left > 0 ? ACCENT : OK;
    }

    const dailyLeft = player.lastDaily ? 20 * 3_600_000 - (now - player.lastDaily) : 0;
    const workLeft = player.lastWork ? 30 * 60_000 - (now - player.lastWork) : 0;

    const next =
      player.garden && now - player.garden.at >= CROPS[player.garden.crop].growMs
        ? 'harvest the flat, then `/sell`'
        : dailyLeft > 0
          ? '`/fish`, `/catch` or `/market`'
          : '`/daily` is up';

    const where = [player.port?.name, player.port?.country].filter(Boolean).join(', ');

    return reply({
      embeds: [
        card({
          title: `${where} · level ${level}`,
          description:
            `${season.glyph} **${season.name}** — ${season.blurb}\n` +
            `${wx.icon} **${wx.label}**${wx.temp != null ? ` · ${wx.temp}°C` : ''}` +
            `${wx.wind != null ? ` · ${wx.wind} km/h` : ''}\n` +
            `${into}/${span} xp`,
          color: gardenColor,
          fields: [
            { name: 'garden', value: gardenLine },
            { name: 'wallet', value: shells(player.wallet), inline: true },
            { name: 'bank', value: `${shells(player.bank)}`, inline: true },
            { name: 'portfolio', value: shells(portfolio), inline: true },
            { name: 'net worth', value: shells(player.wallet + player.bank + portfolio), inline: true },
            { name: 'streak', value: `${num(player.streak)} day(s)`, inline: true },
            { name: 'collection', value: `${num(Object.keys(player.catches).length)} / 1025`, inline: true },
            {
              name: 'tide',
              value:
                `${t.trend} ${t.level.toFixed(2)} m · ${t.biteLabel}\n` +
                (t.extremes[0]
                  ? `${t.extremes[0].type === 'high' ? '▲' : '▼'} ${timeTag(t.extremes[0].at, 'R')}`
                  : 'no marks in the window'),
              inline: true
            },
            {
              name: 'cooldowns',
              value: `daily ${dailyLeft > 0 ? duration(dailyLeft) : 'ready'}\nwork ${workLeft > 0 ? duration(workLeft) : 'ready'}`,
              inline: true
            },
            { name: 'next', value: next, inline: true }
          ],
          footer:
            `${moon.glyph} ${moon.name} · ${season.name} pays ` +
            Object.entries(season.crop)
              .map(([key, mult]) => `${CROPS[key]?.name ?? key} ×${mult.toFixed(2)}`)
              .join(' · '),
          timestamp: true
        })
      ]
    });
  }
};
