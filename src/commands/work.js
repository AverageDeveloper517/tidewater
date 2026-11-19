import { SlashCommandBuilder } from 'discord.js';
import { card, shells, signed, duration, ACCENT, GOLD, WARN } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, addXp } from '../services/economy.js';
import { JOBS, FISH } from '../data/tables.js';
import { pick } from '../lib/util.js';

const COOLDOWN = 30 * 60_000;

export default {
  data: new SlashCommandBuilder().setName('work').setDescription('take a shift on the dock'),

  ephemeral: true,

  async run({ interaction, reply, economy, weather }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const now = Date.now();
    const since = now - player.lastWork;

    if (player.lastWork && since < COOLDOWN) {
      return reply({
        embeds: [
          card({
            title: 'still on shift',
            description: `the harbourmaster lets you go in **${duration(COOLDOWN - since)}**.`,
            color: WARN
          })
        ]
      });
    }

    const wx = await weather.forecast(player.port);
    const stormPay = wx.bucket === 'storm' ? 1.35 : wx.bucket === 'rain' ? 1.12 : 1;
    const nightPay = wx.isNight ? 1.15 : 1;
    const levelBonus = Math.floor(Math.sqrt(player.xp) / 2);
    const base = 40 + levelBonus + Math.floor(Math.random() * 31);
    const pay = Math.round(base * stormPay * nightPay);

    const { result, fresh } = await economy.update(interaction.user.id, (p) => {
      p.lastWork = now;
      p.stats.work += 1;
      credit(p, pay);
      addXp(p, 12);
      let extra = null;
      if (Math.random() < 0.12) {
        p.goods.kelp = (p.goods.kelp ?? 0) + 1;
        extra = 'kelp';
      }
      return { pay, job: pick(JOBS), extra, stormPay, nightPay, wallet: p.wallet };
    });

    const lines = [
      `you ${result.job}.`,
      `${signed(result.pay)} for the shift` +
        `${result.stormPay > 1 || result.nightPay > 1 ? ` **(${[result.stormPay > 1 ? `${Math.round((result.stormPay - 1) * 100)}% weather` : null, result.nightPay > 1 ? '15% night' : null].filter(Boolean).join(' + ')} pay)**` : ''}.`
    ];
    if (result.extra) lines.push(`someone left a bundle of ${FISH[result.extra]?.name ?? 'kelp'} by the gate.`);

    return reply({
      embeds: [
        card({
          title: `${wx.icon} ${wx.label} over ${player.port?.name ?? 'the dock'}${wx.isNight ? ' · night shift' : ''}`,
          description: lines.join('\n') + unlockedText(fresh),
          color: GOLD,
          fields: [
            { name: 'wallet', value: shells(result.wallet), inline: true },
            { name: 'shifts', value: String(player.stats.work + 1), inline: true },
            { name: 'light', value: wx.isNight ? 'after sunset' : 'daylight', inline: true }
          ]
        })
      ]
    });
  }
};
