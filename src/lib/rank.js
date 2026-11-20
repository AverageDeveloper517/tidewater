/**
 * Ranks are the long ladder above levels. They are identity first, but every
 * five levels also adds contract pay, so levelling has a visible economic edge.
 */

export const RANKS = [
  { level: 1, name: 'Deckhand', note: 'the dock is open' },
  { level: 5, name: 'Able Hand', note: 'the harbour knows your name' },
  { level: 10, name: 'Bosun', note: 'crew work comes easier' },
  { level: 15, name: 'Mate', note: 'the board pays attention' },
  { level: 20, name: 'Captain', note: 'your word carries on the pier' },
  { level: 30, name: 'Master', note: 'the fleet asks before it sails' },
  { level: 45, name: 'Harbourmaster', note: 'the tide answers to you' }
];

export const CONTRACT_BONUS_CAP = 0.2;

/** +5% contract pay at levels 5, 10, 15 and 20, then capped. */
export function contractBonus(level = 1) {
  const tiers = Math.floor(Math.max(0, level) / 5);
  return Math.min(CONTRACT_BONUS_CAP, tiers * 0.05);
}

export function rankFor(level = 1) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.level) current = rank;
  }
  return current;
}

export function nextRank(level = 1) {
  return RANKS.find((rank) => rank.level > level) ?? null;
}

export function rankLine(level = 1) {
  const rank = rankFor(level);
  const next = nextRank(level);
  if (!next) return `${rank.name} · the top of the ladder`;
  return `${rank.name} · ${next.name} at level ${next.level}`;
}
