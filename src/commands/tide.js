import { SlashCommandBuilder } from 'discord.js';
import { card, OK, ACCENT, WARN } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { GLYPH } from '../lib/emoji.js';
import { sparkline, timeTag } from '../lib/util.js';

const mark = (entry) => `${entry.type === 'high' ? '▲' : '▼'} ${entry.type} · ${timeTag(entry.at, 't')}`;

export default {
  data: new SlashCommandBuilder().setName('tide').setDescription('the real tide at your port - next high and low water'),

  ephemeral: false,
  cooldownMs: 4000,

  async run({ interaction, reply, economy, tide }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const t = await tide.at(player.port);
    const { player: after, fresh } = await economy.update(interaction.user.id, (p) => {
      p.stats.tides = (p.stats.tides ?? 0) + 1;
      return { views: p.stats.tides };
    });

    const high = t.extremes.find((e) => e.type === 'high');
    const low = t.extremes.find((e) => e.type === 'low');
    const color = t.trend === 'rising' ? OK : t.trend === 'falling' ? ACCENT : WARN;
    const where = player.port?.name ?? 'the harbour';

    const description =
      `${sparkline(t.spark, 24)}\n` +
      `now **${t.level.toFixed(2)} m** · ${t.trend} ${t.rate.toFixed(2)} m/h\n` +
      `**${t.biteLabel}** - ${t.biteNote}` +
      unlockedText(fresh);

    return reply({
      embeds: [
        card({
          title: `${GLYPH.tide} tide · ${where}`,
          description,
          color,
          fields: [
            {
              name: 'next high',
              value: high ? `${mark(high)}\n${high.level.toFixed(2)} m · ${timeTag(high.at, 'R')}` : 'not in the window',
              inline: true
            },
            {
              name: 'next low',
              value: low ? `${mark(low)}\n${low.level.toFixed(2)} m · ${timeTag(low.at, 'R')}` : 'not in the window',
              inline: true
            },
            { name: 'range (24h)', value: `${t.range.toFixed(2)} m · ${t.tideClass.label}`, inline: true },
            { name: 'water', value: t.sst != null ? `${t.sst.toFixed(1)}°C` : 'no reading', inline: true },
            { name: 'swell', value: t.waveHeight != null ? `${t.waveHeight.toFixed(1)} m · ${t.wavePeriod ?? '?'}s` : 'no reading', inline: true },
            { name: 'fishing', value: `×${t.bite.toFixed(2)} rare weight`, inline: true },
            {
              name: 'moon',
              value: `${t.moon.glyph} ${t.moon.name}\n${t.moon.illuminationPct}% lit · ${t.tideClass.note}`,
              inline: false
            },
            {
              name: 'next marks',
              value:
                t.extremes
                  .slice(0, 4)
                  .map((e) => `${mark(e)} · ${e.level.toFixed(2)} m · ${timeTag(e.at, 'R')}`)
                  .join('\n') || 'none in the next 48h'
            },
            { name: 'checked', value: `${after?.stats?.tides ?? 1} time(s)`, inline: true }
          ],
          footer: t.degraded ? 'tide feed down - lunar curve, not a live reading' : 'open-meteo marine · heights above mean sea level',
          timestamp: true
        })
      ]
    });
  }
};
