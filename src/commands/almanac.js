import { SlashCommandBuilder } from 'discord.js';
import { card, ACCENT, GOLD, WARN } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';
import { seasonFor, seasonCropMult } from '../lib/season.js';
import { moonPhase, nextPhase } from '../lib/moon.js';
import { affinity } from '../services/weather.js';
import { seaBand, bandReport } from '../lib/water.js';
import { CROPS } from '../data/tables.js';
import { GLYPH } from '../lib/emoji.js';
import { timeTag } from '../lib/util.js';

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GLASS_ARROW = { falling: GLYPH.down, rising: GLYPH.up, steady: GLYPH.flat };

const weekday = (date) => {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) ? WEEK[new Date(stamp).getUTCDay()] : '—';
};

const dayLine = (day) => {
  const temps =
    day.tmax != null && day.tmin != null ? `${day.tmax}°/${day.tmin}°` : '—';
  const rain = day.precip != null ? `${day.precip.toFixed(1)}mm` : '—';
  const chance = day.precipChance != null ? ` ${day.precipChance}%` : '';
  const wind = day.wind != null ? `${day.wind} km/h` : '—';
  return `${day.icon} **${weekday(day.date)}** ${temps} · ${rain}${chance} · ${wind}`;
};

export default {
  data: new SlashCommandBuilder().setName('almanac').setDescription('six-day outlook, tide, moon and the best crop to plant'),

  ephemeral: true,
  cooldownMs: 5000,

  async run({ interaction, reply, economy, weather, tide }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const [outlook, t, wx] = await Promise.all([
      weather.daily(player.port),
      tide.at(player.port),
      weather.forecast(player.port)
    ]);
    const glass = wx.glass ?? { key: 'unknown', bite: 1, delta: null, storm: false };
    const band = seaBand(t.sst);
    const report = bandReport(t.sst);
    const resident = report.inBand.slice(0, 2).join(', ');
    const now = Date.now();
    const season = seasonFor(new Date(now));
    const moon = moonPhase(new Date(now));
    const full = nextPhase(new Date(now), 'full');
    const today = outlook.days[0] ?? null;

    const crops = Object.entries(CROPS)
      .map(([key, crop]) => {
        const seasonMult = seasonCropMult(season, key);
        let best = null;

        for (const day of outlook.days.slice(0, 4)) {
          const mult = affinity(day.bucket, crop);
          const total = mult * seasonMult;
          if (!best || total > best.total) best = { day, mult, total };
        }

        return { key, crop, seasonMult, best };
      })
      .sort((a, b) => (b.best?.total ?? 0) - (a.best?.total ?? 0));

    const planting = crops
      .slice(0, 3)
      .filter((row) => row.best)
      .map(
        (row) =>
          `${row.crop.glyph} **${row.crop.name}** · ${row.best.day.icon} ${weekday(row.best.day.date)} ` +
          `×${row.best.mult.toFixed(2)} · season ×${row.seasonMult.toFixed(2)} → **×${row.best.total.toFixed(2)}**`
      )
      .join('\n');

    const nowRow = today
      ? Object.entries(CROPS)
          .map(([key, crop]) => {
            const mult = affinity(today.bucket, crop);
            const seasonMult = seasonCropMult(season, key);
            return { crop, mult, seasonMult, total: mult * seasonMult };
          })
          .sort((a, b) => b.total - a.total)[0]
      : null;

    const nowLine = nowRow
      ? `plant now: **${nowRow.crop.name}** ${today.icon} ×${nowRow.mult.toFixed(2)} · season ×${nowRow.seasonMult.toFixed(2)} → ×${nowRow.total.toFixed(2)}`
      : 'planting advice needs the outlook';

    const high = t.extremes.find((e) => e.type === 'high');
    const low = t.extremes.find((e) => e.type === 'low');

    const advisories = [];
    if (glass.storm) {
      const drop = glass.delta != null && glass.delta <= -6;
      advisories.push(
        `${GLYPH.storm} ${drop ? `glass down ${Math.abs(glass.delta).toFixed(1)} hPa/3h` : `deep low ${glass.pressure} hPa`} - storm coming`
      );
    }
    for (const day of outlook.days) {
      if (day.wind != null && day.wind >= 45) advisories.push(`${GLYPH.warn} small-craft advisory ${weekday(day.date)} (${day.wind} km/h)`);
      if (day.precip != null && day.precip >= 20) advisories.push(`${GLYPH.warn} heavy rain ${weekday(day.date)} (${day.precip.toFixed(0)} mm)`);
      if (day.uv != null && day.uv >= 8) advisories.push(`${GLYPH.warn} high UV ${weekday(day.date)} (${day.uv})`);
    }

    const sun =
      today?.sunrise && today?.sunset
        ? `↑ ${timeTag(today.sunrise, 't')} ↓ ${timeTag(today.sunset, 't')} · ${(today.daylightMs / 3_600_000).toFixed(1)}h of light`
        : 'sun times unavailable';

    const tideLine = [
      high ? `▲ high ${timeTag(high.at, 'R')} · ${high.level.toFixed(2)} m` : null,
      low ? `▼ low ${timeTag(low.at, 'R')} · ${low.level.toFixed(2)} m` : null
    ]
      .filter(Boolean)
      .join('\n');

    const degraded = outlook.degraded || t.degraded || wx.degraded;
    const color = advisories.length ? WARN : nowRow ? GOLD : ACCENT;

    return reply({
      embeds: [
        card({
          title: `${season.glyph} almanac · ${player.port?.name ?? 'the harbour'}`,
          description:
            `**${season.name}** — ${season.blurb}\n` +
            `${moon.glyph} ${moon.name} · ${moon.illuminationPct}% lit · full ${timeTag(full, 'R')}\n` +
            `${sun}\n\n${nowLine}`,
          color,
          fields: [
            {
              name: 'six days',
              value: outlook.days.slice(0, 5).map(dayLine).join('\n') || 'outlook unavailable'
            },
            {
              name: 'water',
              value:
                (tideLine || 'no marks in the window') +
                `\nrange ${t.range.toFixed(2)} m · ${t.tideClass.label}` +
                (t.sst != null ? `\nsea ${t.sst.toFixed(1)}°C · ${band.label}${resident ? ` · ${resident} in` : ''}` : ''),
              inline: true
            },
            {
              name: 'bait',
              value:
                `tide ×${t.bite.toFixed(2)} · ${t.biteLabel}\n` +
                (glass.delta != null
                  ? `${GLASS_ARROW[glass.key] ?? GLYPH.flat} glass ${glass.key} ×${glass.bite.toFixed(2)}`
                  : 'glass unknown'),
              inline: true
            },
            { name: 'planting, best day in four', value: planting || 'no forecast to plan against' },
            {
              name: 'warnings',
              value: advisories.length
                ? advisories.slice(0, 4).join('\n')
                : outlook.degraded
                  ? 'outlook down - no advisories to read'
                  : 'none in the next six days'
            }
          ],
          footer: degraded
            ? 'one feed is down - shaped by the fallback tables'
            : 'season from the real calendar · outlook and tide from open-meteo',
          timestamp: true
        })
      ]
    });
  }
};
