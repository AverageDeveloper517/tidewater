export const ITEMS = {
  rod: {
    name: 'Rod',
    glyph: '⌁',
    max: 5,
    costs: [0, 600, 1_800, 4_200, 9_000],
    blurb: 'better rarity rolls when fishing',
    effect: (level) => `rare weight +${(level - 1) * 18}%`
  },
  net: {
    name: 'Net',
    glyph: '❀',
    max: 5,
    costs: [0, 500, 1_500, 3_500, 7_500],
    blurb: 'more units per harvest',
    effect: (level) => `harvest +${level - 1} unit(s)`
  },
  vault: {
    name: 'Vault',
    glyph: '▣',
    max: 5,
    costs: [0, 800, 2_400, 6_000, 12_000],
    blurb: 'raises the bank cap',
    effect: (level) => `bank cap ${[5_000, 12_000, 30_000, 75_000, 200_000][level - 1]}`
  },
  charm: {
    name: 'Charm',
    glyph: '✷',
    max: 5,
    costs: [1_200, 3_000, 7_000, 15_000, 30_000],
    blurb: 'luck on every roll',
    effect: (level) => `luck +${level * 4}%`
  }
};

export const BANK_CAPS = [5_000, 12_000, 30_000, 75_000, 200_000];

export const baseVault = () => 1;

export const capFor = (level) => BANK_CAPS[Math.min(BANK_CAPS.length - 1, Math.max(0, level - 1))];

export function nextCost(key, level) {
  const item = ITEMS[key];
  if (!item || level >= item.max) return null;
  return item.costs[level];
}
