import { getJson } from '../lib/http.js';
import { FALLBACK_POKEMON } from '../data/fallback-pokemon.js';

export const MAX_DEX = 1025;

export const spriteFor = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const RARITY = {
  common: { label: 'common', reward: [18, 34], color: 0x8d99ae },
  uncommon: { label: 'uncommon', reward: [45, 80], color: 0x52b788 },
  rare: { label: 'rare', reward: [120, 200], color: 0x2ec4b6 },
  legendary: { label: 'legendary', reward: [450, 900], color: 0xe9c46a }
};

export function rarityFor(baseExp) {
  const xp = Number(baseExp) || 0;
  if (xp >= 220) return 'legendary';
  if (xp >= 150) return 'rare';
  if (xp >= 90) return 'uncommon';
  return 'common';
}

export function createDex({ fetchJson = getJson, logger } = {}) {
  return {
    async roll(random = Math.random) {
      const id = 1 + Math.floor(random() * MAX_DEX);
      try {
        const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}`, { ttl: 86_400_000 });
        return {
          id: data.id,
          name: data.name,
          baseExp: data.base_experience ?? 60,
          types: (data.types ?? []).map((t) => t.type.name),
          sprite: spriteFor(data.id),
          degraded: false
        };
      } catch (err) {
        logger?.warn('pokedex: fallback,', err.message);
        const local = FALLBACK_POKEMON[Math.floor(random() * FALLBACK_POKEMON.length)];
        return { ...local, types: [], sprite: spriteFor(local.id), degraded: true };
      }
    }
  };
}
