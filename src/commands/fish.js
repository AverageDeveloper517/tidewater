import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, OK, ACCENT, WARN, GOLD, DANGER } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, addXp } from '../services/economy.js';
import { FISH } from '../data/tables.js';
import { waveMood } from '../services/weather.js';
import { weighted } from '../lib/util.js';
import { GLYPH } from '../lib/emoji.js';

const RARITY_COLOR = {
  junk: 0x6c757d,
  common: 0x8d99ae,
  uncommon: 0x52b788,
  rare: 0x2ec4b6
};

export default {
  data: new SlashCommandBuilder().setName('fish').setDescription('cast off the dock - the swell decides what bites'),

  ephemeral: true,
  cooldownMs: 45_000,

  async run({ interaction, reply, economy, weather, market }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const sea = await weather.waves(player.port);
    const mood = waveMood(sea.height);

    const rod = player.items.rod ?? 1;
    const charm = player.items.charm ?? 0;
    const luck = (1 + (rod - 1) * 0.18) * (1 + charm * 0.04);

    const table = Object.entries(FISH).map(([key, fish]) => {
      let weight = fish.weight;
      if (fish.rarity === 'rare') weight *= luck * mood.rare;
      if (fish.rarity === 'uncommon') weight *= 1 + (luck - 1) * 0.5;
      if (fish.rarity === 'junk') weight *= mood.junk;
      return { key, weight, fish };
    });

    const hit = weighted(table, Math.random);
    const coin = Math.random() < 0.15 ? 10 + Math.floor(Math.random() * 31) : 0;

    const { result, fresh, player: after } = await economy.update(interaction.user.id, (p) => {
      p.goods[hit.key] = (p.goods[hit.key] ?? 0) + 1;
      p.stats.fish += 1;
      addXp(p, 8);
      if (coin) credit(p, coin);
      return { key: hit.key, fish: hit.fish, coin, total: p.goods[hit.key] };
    });

    const unit = await market.goods(result.key);

    return reply({
      embeds: [
        card({
          title: `${GLYPH.wave} ${mood.label} · ${sea.height?.toFixed?.(1) ?? sea.height}m`,
          description:
            `you pulled up **${result.fish.name}** (${result.fish.rarity}).\n` +
            `worth about ${shells(unit)} at today's board.\n` +
            `you now hold ${num(result.total)}.` +
            (result.coin ? `\n\na coin was tangled in the net: ${shells(result.coin)}.` : '') +
            unlockedText(fresh),
          color: RARITY_COLOR[result.fish.rarity] ?? ACCENT,
          fields: [
            { name: 'rod', value: `level ${rod}`, inline: true },
            { name: 'swell', value: `${sea.height?.toFixed?.(1) ?? sea.height}m`, inline: true },
            { name: 'sell', value: '`/sell`', inline: true }
          ],
          footer: sea.degraded ? 'sea data unavailable - using the day\'s guess' : 'Tidewater'
        })
      ]
    });
  }
};
