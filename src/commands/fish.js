import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, OK, ACCENT, WARN, DANGER } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, addXp } from '../services/economy.js';
import { waveMood } from '../services/weather.js';
import { catchTable, seaBand, bandReport } from '../lib/water.js';
import { clamp, weighted } from '../lib/util.js';
import { GLYPH } from '../lib/emoji.js';

const RARITY_COLOR = {
  junk: 0x6c757d,
  common: 0x8d99ae,
  uncommon: 0x52b788,
  rare: 0x2ec4b6
};

const GLASS_ARROW = { falling: GLYPH.down, rising: GLYPH.up, steady: GLYPH.flat };

export default {
  data: new SlashCommandBuilder().setName('fish').setDescription('cast off the dock - swell, tide and water temperature decide what bites'),

  ephemeral: true,
  cooldownMs: 45_000,

  async run({ interaction, reply, economy, weather, market, tide }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const [sea, t, wx] = await Promise.all([
      weather.waves(player.port),
      tide.at(player.port),
      weather.forecast(player.port)
    ]);
    const mood = waveMood(sea.height);
    const night = Boolean(wx.isNight);
    const glass = wx.glass ?? { key: 'unknown', label: 'glass unknown', bite: 1, delta: null };

    const rod = player.items.rod ?? 1;
    const charm = player.items.charm ?? 0;
    const luck = (1 + (rod - 1) * 0.18) * (1 + charm * 0.04);
    const light = night ? 1.12 : 1;
    const bite = clamp(t.bite * glass.bite, 0.8, 1.6);

    const table = catchTable({ sst: t.sst, luck, mood, bite, light, night });

    const hit = weighted(table, Math.random);
    const coinRoll = Math.random() < (night ? 0.18 : 0.15);
    const coin = coinRoll ? 10 + Math.floor(Math.random() * 31) : 0;

    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      p.goods[hit.key] = (p.goods[hit.key] ?? 0) + 1;
      p.stats.fish += 1;
      if (glass.key === 'falling') p.stats.glassFalls = (p.stats.glassFalls ?? 0) + 1;
      addXp(p, 8);
      if (coin) credit(p, coin);
      return { key: hit.key, fish: hit.fish, coin, total: p.goods[hit.key] };
    });

    const unit = await market.goods(result.key);
    const band = seaBand(t.sst);
    const report = bandReport(t.sst);
    const resident = report.inBand.slice(0, 2).join(', ');

    const notes = [
      sea.degraded ? 'sea guess' : null,
      t.degraded ? 'tide fallback' : null,
      wx.degraded ? 'sky guess' : null
    ].filter(Boolean);

    const biteLine =
      `tide **${t.biteLabel}** ×${t.bite.toFixed(2)}` +
      (glass.key !== 'unknown' ? ` · ${glass.label} ×${glass.bite.toFixed(2)}` : '');

    return reply({
      embeds: [
        card({
          title: `${GLYPH.wave} ${mood.label} · ${sea.height?.toFixed?.(1) ?? sea.height}m · ${night ? 'night' : 'day'}`,
          description:
            `you pulled up **${result.fish.name}** (${result.fish.rarity}).\n` +
            `worth about ${shells(unit)} at today's board.\n` +
            `${biteLine}` +
            (t.sst != null ? `\n${t.sst.toFixed(1)}°C ${band.label} water${resident ? ` · ${resident} in` : ''}` : '') +
            (night ? '\nnight water ×1.12 rare weight' : '') +
            `\nyou now hold ${num(result.total)}.` +
            (result.coin ? `\n\na coin was tangled in the net: ${shells(result.coin)}.` : '') +
            unlockedText(fresh),
          color: RARITY_COLOR[result.fish.rarity] ?? ACCENT,
          fields: [
            { name: 'rod', value: `level ${rod}`, inline: true },
            { name: 'swell', value: `${sea.height?.toFixed?.(1) ?? sea.height}m`, inline: true },
            { name: 'tide', value: `${t.trend} ${t.level.toFixed(2)}m`, inline: true },
            {
              name: 'water',
              value: t.sst != null ? `${t.sst.toFixed(1)}°C ${band.label}` : 'no reading',
              inline: true
            },
            {
              name: 'glass',
              value:
                glass.delta != null
                  ? `${GLASS_ARROW[glass.key] ?? GLYPH.flat} ${Math.abs(glass.delta).toFixed(1)} hPa/3h`
                  : 'no reading',
              inline: true
            },
            { name: 'light', value: night ? 'after sunset' : 'daylight', inline: true }
          ],
          footer: notes.length ? `${notes.join(' · ')} - fallback in use` : 'Tidewater'
        })
      ]
    });
  }
};
