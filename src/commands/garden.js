import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, duration, OK, WARN, DANGER, ACCENT, GOLD } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { debit, addXp } from '../services/economy.js';
import { CROPS } from '../data/tables.js';
import { affinity } from '../services/weather.js';
import { roll } from '../lib/util.js';

const cropChoices = Object.entries(CROPS).map(([key, crop]) => ({ name: crop.name, value: key }));

export default {
  data: new SlashCommandBuilder()
    .setName('garden')
    .setDescription('grow something on the tide flat - the weather is real')
    .addSubcommand((s) =>
      s
        .setName('plant')
        .setDescription('put a crop in the water')
        .addStringOption((o) =>
          o.setName('crop').setDescription('what to grow').setRequired(true).addChoices(...cropChoices)
        )
    )
    .addSubcommand((s) => s.setName('harvest').setDescription('pull whatever is ready'))
    .addSubcommand((s) => s.setName('view').setDescription('what is growing and what the sky is doing')),

  ephemeral: true,
  cooldownMs: 1500,

  async run({ interaction, options, reply, economy, weather, market }) {
    const snapshot = economy.get(interaction.user.id);
    if (await requireProfile(reply, snapshot)) return;

    const sub = options.getSubcommand();
    const now = Date.now();

    if (sub === 'plant') {
      const key = options.getString('crop', true);
      const crop = CROPS[key];

      if (snapshot.garden) {
        return reply({
          embeds: [
            card({
              title: 'bed is taken',
              description: `**${CROPS[snapshot.garden.crop]?.name ?? 'something'}** is already in the water. \`/garden harvest\` first.`,
              color: WARN
            })
          ]
        });
      }
      if (snapshot.wallet < crop.seed) {
        return reply({
          embeds: [
            card({ title: 'no seed money', description: `${crop.name} costs ${shells(crop.seed)} in seed.`, color: DANGER })
          ]
        });
      }

      const wx = await weather.forecast(snapshot.port);
      const mult = affinity(wx.bucket, crop);

      const { result, fresh } = await economy.update(interaction.user.id, (p) => {
        if (p.garden) return { ok: false };
        if (!debit(p, crop.seed)) return { ok: false };
        p.garden = { crop: key, at: now };
        return { ok: true };
      });

      if (!result?.ok) {
        return reply({
          embeds: [card({ title: 'not now', description: 'the bed filled before you planted.', color: WARN })]
        });
      }

      return reply({
        embeds: [
          card({
            title: `${crop.glyph} ${crop.name} planted`,
            description:
              `seed cost ${shells(crop.seed)} · ready in **${duration(crop.growMs)}**.\n\n` +
              `${wx.icon} it is **${wx.label}** in ${snapshot.port?.name ?? 'port'} right now - ` +
              `${mult >= 1.4 ? 'perfect for this one' : mult < 1 ? 'this crop will sulk' : 'nothing special, nothing fatal'}.` +
              unlockedText(fresh),
            color: OK,
            fields: [
              { name: 'wants', value: crop.loves.join(', '), inline: true },
              { name: 'hates', value: crop.hates.join(', '), inline: true },
              { name: 'yield now', value: `×${mult.toFixed(2)}`, inline: true }
            ]
          })
        ]
      });
    }

    if (sub === 'view') {
      const wx = await weather.forecast(snapshot.port);
      const board = await market.board();

      if (!snapshot.garden) {
        return reply({
          embeds: [
            card({
              title: 'the flat is empty',
              description: `nothing planted. ${wx.icon} ${wx.label} in ${snapshot.port?.name ?? 'port'}.\n\ntry \`/garden plant crop:Kelp\`.`,
              color: ACCENT
            })
          ]
        });
      }

      const crop = CROPS[snapshot.garden.crop];
      const left = crop.growMs - (now - snapshot.garden.at);

      return reply({
        embeds: [
          card({
            title: `${crop.glyph} ${crop.name}`,
            description: left > 0 ? `ready in **${duration(left)}**.` : 'ready now - `/garden harvest`.',
            color: left > 0 ? ACCENT : GOLD,
            fields: [
              { name: 'sky', value: `${wx.icon} ${wx.label}`, inline: true },
              { name: 'multiplier', value: `×${affinity(wx.bucket, crop).toFixed(2)}`, inline: true },
              { name: 'fx drift', value: `${board.fxFactor.toFixed(2)}× local prices`, inline: true }
            ]
          })
        ]
      });
    }

    // harvest
    if (!snapshot.garden) {
      return reply({ embeds: [card({ title: 'nothing to pull', description: '`/garden plant` first.', color: WARN })] });
    }

    const crop = CROPS[snapshot.garden.crop];
    const elapsed = now - snapshot.garden.at;
    if (elapsed < crop.growMs) {
      return reply({
        embeds: [
          card({ title: 'not ready', description: `${crop.name} needs **${duration(crop.growMs - elapsed)}** more.`, color: WARN })
        ]
      });
    }

    const wx = await weather.forecast(snapshot.port);

    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      if (!p.garden) return { ok: false };
      const plantedKey = p.garden.crop;
      const planted = CROPS[plantedKey];
      if (Date.now() - p.garden.at < planted.growMs) return { ok: false, early: true };

      const mult = affinity(wx.bucket, planted);
      const base = roll(Math.random, planted.yield[0], planted.yield[1]) + ((p.items.net ?? 1) - 1);
      const qty = Math.max(1, Math.round(base * mult));

      p.goods[plantedKey] = (p.goods[plantedKey] ?? 0) + qty;
      p.garden = null;
      p.stats.harvest += 1;
      addXp(p, 10);

      return { ok: true, qty, base, key: plantedKey, mult };
    });

    if (!result?.ok) {
      return reply({ embeds: [card({ title: 'not ready', description: 'something moved - try again.', color: WARN })] });
    }

    const unit = await market.goods(result.key);
    const value = Math.round(unit * result.qty);

    return reply({
      embeds: [
        card({
          title: `${crop.glyph} harvest`,
          description:
            `pulled **${result.qty} ${crop.name}** from ${result.base} base units.\n` +
            `${wx.icon} ${wx.label} → ×${result.mult.toFixed(2)}` +
            unlockedText(fresh),
          color: OK,
          fields: [
            { name: 'in the hold', value: `${num(after?.goods[result.key] ?? result.qty)}`, inline: true },
            { name: 'rough value', value: shells(value), inline: true },
            { name: 'sell it', value: '`/sell`', inline: true }
          ]
        })
      ]
    });
  }
};
