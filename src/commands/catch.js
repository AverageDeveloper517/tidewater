import { SlashCommandBuilder } from 'discord.js';
import { card, shells, num, OK, GOLD, ACCENT } from '../lib/theme.js';
import { requireProfile, unlockedText } from '../lib/flow.js';
import { credit, addXp } from '../services/economy.js';
import { rarityFor, RARITY } from '../services/pokedex.js';
import { GLYPH } from '../lib/emoji.js';

export default {
  data: new SlashCommandBuilder().setName('catch').setDescription('net something from the water - real pokedex data'),

  ephemeral: true,
  cooldownMs: 90_000,

  async run({ interaction, reply, economy, dex }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const mon = await dex.roll();
    const rarity = rarityFor(mon.baseExp);
    const spec = RARITY[rarity];
    const [lo, hi] = spec.reward;
    const value = lo + Math.floor(Math.random() * (hi - lo + 1));

    const { result, fresh } = await economy.update(interaction.user.id, (p) => {
      p.stats.caught += 1;
      addXp(p, 12);

      const entry = p.catches[mon.id];
      if (entry) {
        entry.count += 1;
        const bounty = Math.max(1, Math.round(value * 0.3));
        credit(p, bounty);
        return { duplicate: true, bounty, count: entry.count };
      }

      p.catches[mon.id] = { name: mon.name, count: 1, rarity };
      credit(p, value);
      return { duplicate: false, bounty: value, count: 1 };
    });

    const unique = Object.keys((await economy.get(interaction.user.id)).catches).length;

    return reply({
      embeds: [
        card({
          title: `${result.duplicate ? 'released' : 'caught'} ${mon.name}`,
          description:
            (result.duplicate
              ? `already in the log - released for a ${shells(result.bounty)} bounty.\n`
              : `new entry in the log.\n`) +
            `rarity **${spec.label}** · base xp ${mon.baseExp}` +
            (mon.types.length ? ` · ${mon.types.join(' / ')}` : '') +
            unlockedText(fresh),
          color: result.duplicate ? ACCENT : spec.color,
          thumbnail: mon.sprite,
          fields: [
            { name: 'payout', value: shells(result.bounty), inline: true },
            { name: 'this one', value: `×${result.count}`, inline: true },
            { name: 'collection', value: `${num(unique)} / 1025`, inline: true }
          ],
          footer: mon.degraded ? 'pokedex offline - harbour list used' : `#${mon.id} · ${GLYPH.catch} Tidewater`
        })
      ]
    });
  }
};
